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
import type {
  Block,
  Junction,
  WireEndpoint,
  Position,
  PortPosition,
  SerializableCircuitState,
} from '../components/OneCanvas/types';
import { isCanvasDocument, isSchematicDocument } from '../types/document';
import {
  alignComponents,
  distributeComponents,
  flipComponents,
} from '../components/OneCanvas/utils/canvas-commands';
import type { CanvasFacadeReturn, WireDrawingState } from '../types/canvasFacade';

// ============================================================================
// Constants
// ============================================================================

const EXIT_DETECTION_THRESHOLD = 4;

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
        components: {},
        wires: [],
        metadata: { name: 'Untitled Circuit', description: '', tags: [] },
      };
    }
    return {
      components: Object.fromEntries(activeDocumentState.components),
      junctions:
        activeDocumentState.junctions.size > 0
          ? Object.fromEntries(activeDocumentState.junctions)
          : undefined,
      wires: activeDocumentState.wires,
      metadata: activeDocumentState.metadata,
      viewport: {
        zoom: activeDocumentState.zoom,
        panX: activeDocumentState.pan.x,
        panY: activeDocumentState.pan.y,
      },
    };
  }, [activeDocumentState]);

  const loadDocumentCircuit = useCallback(
    (data: SerializableCircuitState) => {
      if (!documentId) return;
      if (document && isCanvasDocument(document)) {
        updateCanvasData(documentId, (docData) => {
          docData.components = new Map(Object.entries(data.components)) as Map<string, Block>;
          docData.junctions = data.junctions
            ? (new Map(Object.entries(data.junctions)) as Map<string, Junction>)
            : new Map();
          docData.wires = [...data.wires];
          docData.metadata = { ...data.metadata };
          if (data.viewport) {
            docData.zoom = data.viewport.zoom;
            docData.pan = { x: data.viewport.panX, y: data.viewport.panY };
          }
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
            components: { ...data.components },
            junctions: data.junctions ? { ...data.junctions } : undefined,
            wires: data.wires.map((wire) => ({
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
            metadata: { ...data.metadata },
            viewport: data.viewport
              ? {
                  zoom: data.viewport.zoom,
                  panX: data.viewport.panX,
                  panY: data.viewport.panY,
                }
              : { zoom: 1, panX: 0, panY: 0 },
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
        gridSize: activeDocumentState.gridSize,
        snapToGrid: activeDocumentState.snapToGrid,
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
        moveComponent: () => {},
        updateComponent: () => {},
        moveJunction: () => {},
        addWire: () => null,
        removeWire: () => {},
        createJunctionOnWire: () => null,
        updateWireHandle: () => {},
        recalculateWireHandles: () => {},
        removeWireHandle: () => {},
        moveWireSegment: () => {},
        dragWireSegment: () => null,
        insertEndpointHandle: () => {},
        cleanupOverlappingHandles: () => {},
        commitWirePolyline: () => {},
        alignSelected: () => {},
        distributeSelected: () => {},
        flipSelected: () => {},
        getCircuitData: () => ({
          components: {},
          wires: [],
          metadata: { name: 'Untitled Circuit', description: '', tags: [] },
          viewport: { zoom: 1, panX: 0, panY: 0 },
        }),
        loadCircuit: () => {},
        wireDrawing: documentWireDrawing,
        startWireDrawing: startDocumentWireDrawing,
        updateWireDrawing: updateDocumentWireDrawing,
        cancelWireDrawing: cancelDocumentWireDrawing,
        selectedIds: documentSelectedIds,
        setSelection: setDocumentSelection,
        addToSelection: addDocumentSelection,
        toggleSelection: toggleDocumentSelection,
        clearSelection: clearDocumentSelection,
        setPan: () => {},
        setZoom: () => {},
        gridSize: 20,
        snapToGrid: true,
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
    getDocumentCircuitData,
    loadDocumentCircuit,
    documentUndo,
    documentRedo,
    documentCanUndo,
    documentCanRedo,
    // Global adapter
    globalFacade,
  ]);
}
