/**
 * Canvas Facade Hook
 *
 * Single entry point for all canvas state access from UI components.
 * Routes to document-based state (useCanvasDocument) or the legacy
 * GlobalCanvasAdapter based on whether a documentId is present.
 *
 * UI components must use this hook instead of importing canvasStore directly.
 *
 * @see PRD_OneCanvas_Stabilization.md — Phase 1, Task 1.1
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalCanvasAdapter } from '../stores/adapters/globalCanvasAdapter';
import { useDocumentRegistry } from '../stores/documentRegistry';
import { useCanvasDocument } from '../stores/hooks/useCanvasDocument';
import { useSchematicCanvasDocument } from '../stores/hooks/useSchematicCanvasDocument';
import { useProjectStore } from '../stores/projectStore';
import type {
  Block,
  Junction,
  WireEndpoint,
  Position,
  PortPosition,
  RuntimeGridUnit,
  SerializableCircuitState,
} from '../components/OneCanvas/types';
import {
  GRID_MODULE_MM,
  GRID_VERSION,
  ensureRuntimeGridUnit,
  normalizeGridSizeForRuntime,
  normalizeSerializableCircuitState,
} from '../components/OneCanvas/canvasUnits';
import { isCanvasDocument, isSchematicDocument } from '../types/document';
import {
  alignComponents,
  distributeComponents,
  flipComponents,
  rotateAndUpdateWires,
} from '../components/OneCanvas/utils/canvas-commands';
import { useSettingsStore } from '../stores/settingsStore';
import type { CanvasFacadeReturn, WireDrawingState } from '../types/canvasFacade';

// ============================================================================
// Constants
// ============================================================================

const EXIT_DETECTION_THRESHOLD = 4;
const DEFAULT_PROJECT_CANVAS_SETTINGS = {
  grid_size: GRID_MODULE_MM,
  snap_to_grid: true,
  show_grid: true,
  grid_style: 'dots' as const,
  grid_unit: 'mm' as const,
};

// ============================================================================
// Helpers
// ============================================================================

function detectExitDirection(start: Position, current: Position): PortPosition | undefined {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX < EXIT_DETECTION_THRESHOLD && absY < EXIT_DETECTION_THRESHOLD) {
    return undefined;
  }

  if (absX >= absY) {
    return dx >= 0 ? 'right' : 'left';
  }

  return dy >= 0 ? 'bottom' : 'top';
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Unified canvas state facade.
 *
 * @param documentId - If provided, routes to document-based state.
 *                     If null, falls back to GlobalCanvasAdapter (deprecated).
 */
export function useCanvasFacade(documentId: string | null): CanvasFacadeReturn {
  const document = useDocumentRegistry((state) =>
    documentId ? state.documents.get(documentId) : undefined
  );
  const canvasDocumentState = useCanvasDocument(documentId);
  const schematicDocumentState = useSchematicCanvasDocument(documentId);

  // Global fallback via adapter (all hook calls are unconditional)
  const globalFacade = useGlobalCanvasAdapter();

  // --------------------------------------------------------------------------
  // Document-mode local interaction state
  // --------------------------------------------------------------------------

  const [documentWireDrawing, setDocumentWireDrawing] = useState<WireDrawingState | null>(null);
  const [documentSelectedIds, setDocumentSelectedIds] = useState<Set<string>>(new Set());
  const pushHistory = useDocumentRegistry((state) => state.pushHistory);
  const updateCanvasData = useDocumentRegistry((state) => state.updateCanvasData);
  const updateSchematicData = useDocumentRegistry((state) => state.updateSchematicData);

  const activeDocumentState = useMemo(() => {
    if (document && isCanvasDocument(document)) {
      return canvasDocumentState;
    }
    if (document && isSchematicDocument(document)) {
      return schematicDocumentState;
    }
    return null;
  }, [document, canvasDocumentState, schematicDocumentState]);

  // Project defaults for new/global canvases. Loaded document state remains authoritative.
  const projectCanvasSettings = useProjectStore((s) => s.currentProject?.config.canvas);
  const updateProjectConfig = useProjectStore((s) => s.updateConfig);

  const projectGrid = useMemo(
    () => normalizeGridSizeForRuntime(
      projectCanvasSettings?.grid_size ?? GRID_MODULE_MM,
      projectCanvasSettings?.grid_unit,
    ),
    [projectCanvasSettings?.grid_size, projectCanvasSettings?.grid_unit]
  );

  const gridSize = activeDocumentState?.gridSize ?? projectGrid.gridSize;
  const snapToGrid = activeDocumentState?.snapToGrid ?? projectCanvasSettings?.snap_to_grid ?? true;
  const showGrid = activeDocumentState?.showGrid ?? projectCanvasSettings?.show_grid ?? true;
  const gridStyle = activeDocumentState?.gridStyle ?? projectCanvasSettings?.grid_style ?? 'dots';
  const gridUnit = activeDocumentState?.gridUnit ?? projectGrid.gridUnit;

  const setGridSize = useCallback((size: number) => {
    updateProjectConfig({
      canvas: {
        ...(projectCanvasSettings || DEFAULT_PROJECT_CANVAS_SETTINGS),
        grid_size: size,
      },
    });
    activeDocumentState?.setGridSize(size);
  }, [updateProjectConfig, projectCanvasSettings, activeDocumentState]);

  const setGridStyle = useCallback((style: 'dots' | 'lines') => {
    updateProjectConfig({
      canvas: {
        ...(projectCanvasSettings || DEFAULT_PROJECT_CANVAS_SETTINGS),
        grid_style: style,
      },
    });
    activeDocumentState?.setGridStyle(style);
  }, [updateProjectConfig, projectCanvasSettings, activeDocumentState]);

  const setGridUnit = useCallback((unit: RuntimeGridUnit) => {
    updateProjectConfig({
      canvas: {
        ...(projectCanvasSettings || DEFAULT_PROJECT_CANVAS_SETTINGS),
        grid_unit: unit,
      },
    });
    // activeDocumentState might need to handle unit if it stores it independently
    if (activeDocumentState && 'setGridUnit' in activeDocumentState) {
      (activeDocumentState as any).setGridUnit(unit);
    }
  }, [updateProjectConfig, projectCanvasSettings, activeDocumentState]);

  const toggleGrid = useCallback(() => {
    const nextValue = !showGrid;
    updateProjectConfig({
      canvas: {
        ...(projectCanvasSettings || DEFAULT_PROJECT_CANVAS_SETTINGS),
        show_grid: nextValue,
      },
    });
    activeDocumentState?.toggleGrid();
  }, [showGrid, updateProjectConfig, projectCanvasSettings, activeDocumentState]);

  const toggleSnap = useCallback(() => {
    const nextValue = !snapToGrid;
    updateProjectConfig({
      canvas: {
        ...(projectCanvasSettings || DEFAULT_PROJECT_CANVAS_SETTINGS),
        snap_to_grid: nextValue,
      },
    });
    activeDocumentState?.toggleSnap();
  }, [snapToGrid, updateProjectConfig, projectCanvasSettings, activeDocumentState]);

  // Document-mode canvases keep their own persisted grid state. Mutations still
  // mirror into project config via the setters above so future canvases inherit it.

  // Reset interaction state when document changes
  useEffect(() => {
    setDocumentWireDrawing(null);
    setDocumentSelectedIds(new Set());
  }, [documentId]);

  // --------------------------------------------------------------------------
  // Document-mode selection helpers
  // --------------------------------------------------------------------------

  const setDocumentSelection = useCallback((ids: string[]) => {
    setDocumentSelectedIds(new Set(ids));
  }, []);

  const addDocumentSelection = useCallback((id: string) => {
    setDocumentSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const toggleDocumentSelection = useCallback((id: string) => {
    setDocumentSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearDocumentSelection = useCallback(() => {
    setDocumentSelectedIds(new Set());
  }, []);

  // --------------------------------------------------------------------------
  // Document-mode wire drawing helpers
  // --------------------------------------------------------------------------

  const startDocumentWireDrawing = useCallback(
    (from: WireEndpoint, options?: { skipValidation?: boolean; startPosition?: Position }) => {
      const startPosition = options?.startPosition;
      setDocumentWireDrawing({
        from,
        tempPosition: startPosition ? { ...startPosition } : { x: 0, y: 0 },
        startPosition,
        exitDirection: undefined,
      });
    },
    []
  );

  const updateDocumentWireDrawing = useCallback((position: Position) => {
    setDocumentWireDrawing((prev) => {
      if (!prev) return null;

      let exitDirection = prev.exitDirection;
      if (!exitDirection && prev.startPosition) {
        exitDirection = detectExitDirection(prev.startPosition, position);
      }

      return {
        ...prev,
        tempPosition: position,
        exitDirection,
      };
    });
  }, []);

  const cancelDocumentWireDrawing = useCallback(() => {
    setDocumentWireDrawing(null);
  }, []);

  // --------------------------------------------------------------------------
  // Document-mode align/distribute/flip (delegates to canvas-commands)
  // --------------------------------------------------------------------------

  const alignDocumentSelected = useCallback(
    (direction: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => {
      if (!documentId || !activeDocumentState) return;
      pushHistory(documentId);
      if (document && isCanvasDocument(document)) {
        updateCanvasData(documentId, (docData) => {
          docData.components = alignComponents(docData.components, documentSelectedIds, direction);
        });
        return;
      }
      if (document && isSchematicDocument(document)) {
        updateSchematicData(documentId, (docData) => {
          const page =
            docData.schematic.pages.find(
              (candidate) => candidate.id === docData.schematic.activePageId
            ) ?? null;
          if (!page) return;
          const components = alignComponents(
            new Map(Object.entries(page.circuit.components)) as Map<string, Block>,
            documentSelectedIds,
            direction
          );
          page.circuit.components = Object.fromEntries(components);
          page.updatedAt = new Date().toISOString();
          docData.schematic.updatedAt = new Date().toISOString();
        });
      }
    },
    [
      documentId,
      activeDocumentState,
      documentSelectedIds,
      pushHistory,
      document,
      updateCanvasData,
      updateSchematicData,
    ]
  );

  const distributeDocumentSelected = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      if (!documentId || !activeDocumentState) return;
      pushHistory(documentId);
      if (document && isCanvasDocument(document)) {
        updateCanvasData(documentId, (docData) => {
          docData.components = distributeComponents(docData.components, documentSelectedIds, direction);
        });
        return;
      }
      if (document && isSchematicDocument(document)) {
        updateSchematicData(documentId, (docData) => {
          const page =
            docData.schematic.pages.find(
              (candidate) => candidate.id === docData.schematic.activePageId
            ) ?? null;
          if (!page) return;
          const components = distributeComponents(
            new Map(Object.entries(page.circuit.components)) as Map<string, Block>,
            documentSelectedIds,
            direction
          );
          page.circuit.components = Object.fromEntries(components);
          page.updatedAt = new Date().toISOString();
          docData.schematic.updatedAt = new Date().toISOString();
        });
      }
    },
    [
      documentId,
      activeDocumentState,
      documentSelectedIds,
      pushHistory,
      document,
      updateCanvasData,
      updateSchematicData,
    ]
  );

  const rotateDocumentSelected = useCallback(
    (degrees: number) => {
      if (!documentId || !activeDocumentState) return;
      pushHistory(documentId);
      const keep = useSettingsStore.getState().getMergedSettings().symbolRotationKeepConnections;
      if (document && isCanvasDocument(document)) {
        updateCanvasData(documentId, (docData) => {
          const result = rotateAndUpdateWires(
            docData.components,
            docData.wires,
            docData.junctions,
            documentSelectedIds,
            degrees,
            keep
          );
          docData.components = result.components;
          docData.wires = result.wires;
        });
        return;
      }
      if (document && isSchematicDocument(document)) {
        updateSchematicData(documentId, (docData) => {
          const page =
            docData.schematic.pages.find(
              (candidate) => candidate.id === docData.schematic.activePageId
            ) ?? null;
          if (!page) return;
          const components = new Map(Object.entries(page.circuit.components)) as Map<string, Block>;
          const junctions = page.circuit.junctions
            ? (new Map(Object.entries(page.circuit.junctions)) as Map<string, Junction>)
            : undefined;
          const result = rotateAndUpdateWires(
            components,
            page.circuit.wires,
            junctions,
            documentSelectedIds,
            degrees,
            keep
          );
          page.circuit.components = Object.fromEntries(result.components);
          page.circuit.wires = result.wires;
          page.updatedAt = new Date().toISOString();
          docData.schematic.updatedAt = new Date().toISOString();
        });
      }
    },
    [
      documentId,
      activeDocumentState,
      documentSelectedIds,
      pushHistory,
      document,
      updateCanvasData,
      updateSchematicData,
    ]
  );

  const flipDocumentSelected = useCallback(
    (axis: 'horizontal' | 'vertical') => {
      if (!documentId || !activeDocumentState) return;
      pushHistory(documentId);
      if (document && isCanvasDocument(document)) {
        updateCanvasData(documentId, (docData) => {
          docData.components = flipComponents(docData.components, documentSelectedIds, axis);
        });
        return;
      }
      if (document && isSchematicDocument(document)) {
        updateSchematicData(documentId, (docData) => {
          const page =
            docData.schematic.pages.find(
              (candidate) => candidate.id === docData.schematic.activePageId
            ) ?? null;
          if (!page) return;
          const components = flipComponents(
            new Map(Object.entries(page.circuit.components)) as Map<string, Block>,
            documentSelectedIds,
            axis
          );
          page.circuit.components = Object.fromEntries(components);
          page.updatedAt = new Date().toISOString();
          docData.schematic.updatedAt = new Date().toISOString();
        });
      }
    },
    [
      documentId,
      activeDocumentState,
      documentSelectedIds,
      pushHistory,
      document,
      updateCanvasData,
      updateSchematicData,
    ]
  );

  // --------------------------------------------------------------------------
  // Document-mode circuitIO
  // --------------------------------------------------------------------------

  const getDocumentCircuitData = useCallback((): SerializableCircuitState => {
    if (!activeDocumentState) {
      return {
        version: GRID_VERSION,
        components: {},
        wires: [],
        metadata: { name: 'Untitled Circuit', description: '', tags: [], version: GRID_VERSION },
        gridSize: GRID_MODULE_MM,
        showGrid: true,
        gridStyle: 'dots',
        gridUnit: 'mm',
      };
    }
    return {
      version: GRID_VERSION,
      components: Object.fromEntries(activeDocumentState.components),
      junctions:
        activeDocumentState.junctions.size > 0
          ? Object.fromEntries(activeDocumentState.junctions)
          : undefined,
      wires: activeDocumentState.wires,
      metadata: { ...activeDocumentState.metadata, version: GRID_VERSION },
      viewport: {
        zoom: activeDocumentState.zoom,
        panX: activeDocumentState.pan.x,
        panY: activeDocumentState.pan.y,
      },
      gridSize,
      showGrid,
      gridStyle,
      gridUnit,
    };
  }, [activeDocumentState, gridSize, showGrid, gridStyle, gridUnit]);

  const loadDocumentCircuit = useCallback(
    (data: SerializableCircuitState) => {
      if (!documentId) return;
      const normalized = normalizeSerializableCircuitState(data);
      if (document && isCanvasDocument(document)) {
        updateCanvasData(documentId, (docData) => {
          docData.components = new Map(Object.entries(normalized.components)) as Map<string, Block>;
          docData.junctions = normalized.junctions
            ? (new Map(Object.entries(normalized.junctions)) as Map<string, Junction>)
            : new Map();
          docData.wires = [...normalized.wires];
          docData.metadata = { ...normalized.metadata };
          if (normalized.viewport) {
            docData.zoom = normalized.viewport.zoom;
            docData.pan = { x: normalized.viewport.panX, y: normalized.viewport.panY };
          }
          docData.gridSize = normalized.gridSize ?? docData.gridSize;
          docData.showGrid = normalized.showGrid ?? docData.showGrid;
          docData.gridStyle = normalized.gridStyle ?? docData.gridStyle;
          docData.gridUnit = ensureRuntimeGridUnit(normalized.gridUnit);
        });
        return;
      }
      if (document && isSchematicDocument(document)) {
        updateSchematicData(documentId, (docData) => {
          const page =
            docData.schematic.pages.find(
              (candidate) => candidate.id === docData.schematic.activePageId
            ) ?? null;
          if (!page) return;
          page.circuit = {
            version: GRID_VERSION,
            components: { ...normalized.components },
            junctions: normalized.junctions ? { ...normalized.junctions } : undefined,
            wires: normalized.wires.map((wire) => ({
              ...wire,
              from: { ...wire.from },
              to: { ...wire.to },
              handles: wire.handles
                ? wire.handles.map((handle) => ({
                  ...handle,
                  position: { ...handle.position },
                }))
                : undefined,
            })),
            metadata: { ...normalized.metadata, version: GRID_VERSION },
            viewport: normalized.viewport
              ? {
                zoom: normalized.viewport.zoom,
                panX: normalized.viewport.panX,
                panY: normalized.viewport.panY,
              }
              : { zoom: 1, panX: 0, panY: 0 },
            gridSize: normalized.gridSize,
            showGrid: normalized.showGrid,
            gridStyle: normalized.gridStyle,
            gridUnit: ensureRuntimeGridUnit(normalized.gridUnit),
          };
          page.updatedAt = new Date().toISOString();
          docData.schematic.updatedAt = new Date().toISOString();
        });
      }
    },
    [documentId, document, updateCanvasData, updateSchematicData]
  );

  // --------------------------------------------------------------------------
  // Document-mode undo/redo
  // --------------------------------------------------------------------------

  const undoDoc = useDocumentRegistry((state) => state.undo);
  const redoDoc = useDocumentRegistry((state) => state.redo);
  const canUndoDoc = useDocumentRegistry((state) => state.canUndo);
  const canRedoDoc = useDocumentRegistry((state) => state.canRedo);

  const documentUndo = useCallback(() => {
    if (documentId) undoDoc(documentId);
  }, [documentId, undoDoc]);

  const documentRedo = useCallback(() => {
    if (documentId) redoDoc(documentId);
  }, [documentId, redoDoc]);

  const documentCanUndo = documentId ? canUndoDoc(documentId) : false;
  const documentCanRedo = documentId ? canRedoDoc(documentId) : false;

  // --------------------------------------------------------------------------
  // Build return value: document path vs global adapter
  // --------------------------------------------------------------------------

  return useMemo((): CanvasFacadeReturn => {
    if (activeDocumentState) {
      return {
        // Selectors
        components: activeDocumentState.components,
        junctions: activeDocumentState.junctions,
        wires: activeDocumentState.wires,
        zoom: activeDocumentState.zoom,
        pan: activeDocumentState.pan,
        // Component Commands
        addComponent: activeDocumentState.addComponent,
        moveComponent: (id, position, skipHistory, skipWireRecalc) =>
          activeDocumentState.moveComponent(id, position, skipHistory, skipWireRecalc),
        updateComponent: activeDocumentState.updateComponent,
        removeComponent: activeDocumentState.removeComponent,
        // Junction Commands
        moveJunction: (id, position, skipHistory, skipWireRecalc) =>
          activeDocumentState.moveJunction(id, position, skipHistory, skipWireRecalc),
        // Wire Commands
        addWire: activeDocumentState.addWire,
        removeWire: activeDocumentState.removeWire,
        createJunctionOnWire: activeDocumentState.createJunctionOnWire,
        recalculateWireHandles: activeDocumentState.recalculateWireHandles,
        updateWireHandle: activeDocumentState.updateWireHandle,
        removeWireHandle: activeDocumentState.removeWireHandle,
        moveWireSegment: activeDocumentState.moveWireSegment,
        dragWireSegment: activeDocumentState.dragWireSegment,
        insertEndpointHandle: activeDocumentState.insertEndpointHandle,
        cleanupOverlappingHandles: activeDocumentState.cleanupOverlappingHandles,
        commitWirePolyline: activeDocumentState.commitWirePolyline,
        // Alignment
        alignSelected: alignDocumentSelected,
        distributeSelected: distributeDocumentSelected,
        flipSelected: flipDocumentSelected,
        rotateSelected: rotateDocumentSelected,
        // CircuitIO
        getCircuitData: getDocumentCircuitData,
        loadCircuit: loadDocumentCircuit,
        // Wire Drawing
        wireDrawing: documentWireDrawing,
        startWireDrawing: startDocumentWireDrawing,
        updateWireDrawing: updateDocumentWireDrawing,
        cancelWireDrawing: cancelDocumentWireDrawing,
        // Selection
        selectedIds: documentSelectedIds,
        setSelection: setDocumentSelection,
        addToSelection: addDocumentSelection,
        toggleSelection: toggleDocumentSelection,
        clearSelection: clearDocumentSelection,
        // Viewport
        setPan: activeDocumentState.setPan,
        setZoom: activeDocumentState.setZoom,
        gridSize,
        snapToGrid,
        showGrid,
        gridStyle,
        gridUnit,

        toggleGrid,
        toggleSnap,
        setGridSize,
        setGridStyle,
        setGridUnit,
        // History
        undo: documentUndo,
        redo: documentRedo,
        canUndo: documentCanUndo,
        canRedo: documentCanRedo,
        // Metadata
        isDocumentMode: true,
        documentId,
      };
    }

    if (documentId && import.meta.env.DEV) {
      console.warn('[useCanvasFacade] document-bound canvas facade unavailable; returning inert facade instead of global fallback', {
        documentId,
        documentType: document?.type ?? 'missing',
      });
    }

    if (documentId) {
      return {
        components: new Map(),
        junctions: new Map(),
        wires: [],
        zoom: 1,
        pan: { x: 0, y: 0 },
        addComponent: () => '',
        moveComponent: () => { },
        updateComponent: () => { },
        removeComponent: () => { },
        moveJunction: () => { },
        addWire: () => null,
        removeWire: () => { },
        createJunctionOnWire: () => null,
        updateWireHandle: () => { },
        recalculateWireHandles: () => { },
        removeWireHandle: () => { },
        moveWireSegment: () => { },
        dragWireSegment: () => null,
        insertEndpointHandle: () => { },
        cleanupOverlappingHandles: () => { },
        commitWirePolyline: () => { },
        alignSelected: () => { },
        distributeSelected: () => { },
        flipSelected: () => { },
        rotateSelected: () => { },
        getCircuitData: () => ({
          components: {},
          wires: [],
          metadata: { name: 'Untitled Circuit', description: '', tags: [] },
          viewport: { zoom: 1, panX: 0, panY: 0 },
        }),
        loadCircuit: () => { },
        wireDrawing: documentWireDrawing,
        startWireDrawing: startDocumentWireDrawing,
        updateWireDrawing: updateDocumentWireDrawing,
        cancelWireDrawing: cancelDocumentWireDrawing,
        selectedIds: documentSelectedIds,
        setSelection: setDocumentSelection,
        addToSelection: addDocumentSelection,
        toggleSelection: toggleDocumentSelection,
        clearSelection: clearDocumentSelection,
        setPan: () => { },
        setZoom: () => { },
        gridSize: 4,
        snapToGrid: true,
        showGrid: true,
        gridStyle: 'dots',
        gridUnit: 'mm',
        toggleGrid: () => { },
        toggleSnap: () => { },
        setGridSize: () => { },
        setGridStyle: () => { },
        setGridUnit: () => { },
        undo: documentUndo,
        redo: documentRedo,
        canUndo: documentCanUndo,
        canRedo: documentCanRedo,
        isDocumentMode: true,
        documentId,
      };
    }

    return globalFacade;
  }, [
    // Document state
    activeDocumentState,
    documentWireDrawing,
    documentSelectedIds,
    documentId,
    document,
    // Document callbacks
    setDocumentSelection,
    addDocumentSelection,
    toggleDocumentSelection,
    clearDocumentSelection,
    startDocumentWireDrawing,
    updateDocumentWireDrawing,
    cancelDocumentWireDrawing,
    alignDocumentSelected,
    distributeDocumentSelected,
    flipDocumentSelected,
    rotateDocumentSelected,
    getDocumentCircuitData,
    loadDocumentCircuit,
    documentUndo,
    documentRedo,
    documentCanUndo,
    documentCanRedo,
    // Global adapter
    globalFacade,
    // Grid settings
    gridSize,
    showGrid,
    gridStyle,
    gridUnit,
    snapToGrid,
    toggleGrid,
    toggleSnap,
    setGridSize,
    setGridStyle,
    setGridUnit,
  ]);
}


