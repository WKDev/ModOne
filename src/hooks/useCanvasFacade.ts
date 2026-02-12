/**
 * Canvas Facade Hook
 *
 * Single entry point for all canvas state access from UI components.
 * Routes to document-based state (useCanvasDocument) or global canvasStore
 * based on whether a documentId is present.
 *
 * UI components must use this hook instead of importing canvasStore directly.
 *
 * @see PRD_OneCanvas_Stabilization.md — Phase 1, Task 1.1
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { useDocumentRegistry } from '../stores/documentRegistry';
import { useCanvasDocument } from '../stores/hooks/useCanvasDocument';
import type {
  Block,
  Junction,
  WireEndpoint,
  Position,
  PortPosition,
  SerializableCircuitState,
} from '../components/OneCanvas/types';
import { getAllSelectedIds } from '../components/OneCanvas/types';
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
 *                     If null, falls back to global canvasStore.
 */
export function useCanvasFacade(documentId: string | null): CanvasFacadeReturn {
  const documentState = useCanvasDocument(documentId);

  // --------------------------------------------------------------------------
  // Document-mode local interaction state
  // --------------------------------------------------------------------------

  const [documentWireDrawing, setDocumentWireDrawing] = useState<WireDrawingState | null>(null);
  const [documentSelectedIds, setDocumentSelectedIds] = useState<Set<string>>(new Set());
  const pushHistory = useDocumentRegistry((state) => state.pushHistory);
  const updateCanvasData = useDocumentRegistry((state) => state.updateCanvasData);

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
      if (!documentId || !documentState) return;
      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        docData.components = alignComponents(docData.components, documentSelectedIds, direction);
      });
    },
    [documentId, documentState, documentSelectedIds, pushHistory, updateCanvasData]
  );

  const distributeDocumentSelected = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      if (!documentId || !documentState) return;
      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        docData.components = distributeComponents(docData.components, documentSelectedIds, direction);
      });
    },
    [documentId, documentState, documentSelectedIds, pushHistory, updateCanvasData]
  );

  const flipDocumentSelected = useCallback(
    (axis: 'horizontal' | 'vertical') => {
      if (!documentId || !documentState) return;
      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        docData.components = flipComponents(docData.components, documentSelectedIds, axis);
      });
    },
    [documentId, documentState, documentSelectedIds, pushHistory, updateCanvasData]
  );

  // --------------------------------------------------------------------------
  // Document-mode circuitIO
  // --------------------------------------------------------------------------

  const getDocumentCircuitData = useCallback((): SerializableCircuitState => {
    if (!documentState) {
      return {
        components: {},
        wires: [],
        metadata: { name: 'Untitled Circuit', description: '', tags: [] },
      };
    }
    return {
      components: Object.fromEntries(documentState.components),
      junctions: documentState.junctions.size > 0 ? Object.fromEntries(documentState.junctions) : undefined,
      wires: documentState.wires,
      metadata: documentState.metadata,
      viewport: {
        zoom: documentState.zoom,
        panX: documentState.pan.x,
        panY: documentState.pan.y,
      },
    };
  }, [documentState]);

  const loadDocumentCircuit = useCallback(
    (data: SerializableCircuitState) => {
      if (!documentId) return;
      // Load into document registry via updateCanvasData
      updateCanvasData(documentId, (docData) => {
        docData.components = new Map(Object.entries(data.components)) as Map<string, Block>;
        docData.junctions = data.junctions
          ? new Map(Object.entries(data.junctions)) as Map<string, Junction>
          : new Map();
        docData.wires = [...data.wires];
        docData.metadata = { ...data.metadata };
        if (data.viewport) {
          docData.zoom = data.viewport.zoom;
          docData.pan = { x: data.viewport.panX, y: data.viewport.panY };
        }
      });
    },
    [documentId, updateCanvasData]
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
  // Global store selectors (fallback mode)
  // --------------------------------------------------------------------------

  const globalComponents = useCanvasStore((state) => state.components);
  const globalJunctions = useCanvasStore((state) => state.junctions);
  const globalWires = useCanvasStore((state) => state.wires);
  const globalZoom = useCanvasStore((state) => state.zoom);
  const globalPan = useCanvasStore((state) => state.pan);
  const globalAddComponent = useCanvasStore((state) => state.addComponent);
  const globalAddWire = useCanvasStore((state) => state.addWire);
  const globalMoveComponent = useCanvasStore((state) => state.moveComponent);
  const globalRemoveWire = useCanvasStore((state) => state.removeWire);
  const globalCreateJunctionOnWire = useCanvasStore((state) => state.createJunctionOnWire);
  const globalMoveJunction = useCanvasStore((state) => state.moveJunction);
  const globalRecalculateWireHandles = useCanvasStore((state) => state.recalculateWireHandles);
  const globalUpdateWireHandle = useCanvasStore((state) => state.updateWireHandle);
  const globalRemoveWireHandle = useCanvasStore((state) => state.removeWireHandle);
  const globalMoveWireSegment = useCanvasStore((state) => state.moveWireSegment);
  const globalInsertEndpointHandle = useCanvasStore((state) => state.insertEndpointHandle);
  const globalCleanupOverlappingHandles = useCanvasStore((state) => state.cleanupOverlappingHandles);
  const globalCommitWirePolyline = useCanvasStore((state) => state.commitWirePolyline);
  const globalUpdateComponent = useCanvasStore((state) => state.updateComponent);

  const wireDrawing = useCanvasStore((state) => state.wireDrawing);
  const startWireDrawing = useCanvasStore((state) => state.startWireDrawing);
  const updateWireDrawing = useCanvasStore((state) => state.updateWireDrawing);
  const cancelWireDrawing = useCanvasStore((state) => state.cancelWireDrawing);
  const globalSelection = useCanvasStore((state) => state.selection);
  const selectedIds = useMemo(() => new Set(getAllSelectedIds(globalSelection)), [globalSelection]);
  const globalSetSelection = useCanvasStore((state) => state.setSelection);
  const globalAddToSelection = useCanvasStore((state) => state.addToSelection);
  const globalToggleSelection = useCanvasStore((state) => state.toggleSelection);
  const globalClearSelection = useCanvasStore((state) => state.clearSelection);
  const setPan = useCanvasStore((state) => state.setPan);
  const globalSetZoom = useCanvasStore((state) => state.setZoom);
  const globalGridSize = useCanvasStore((state) => state.gridSize);
  const globalSnapToGrid = useCanvasStore((state) => state.snapToGrid);
  const alignSelected = useCanvasStore((state) => state.alignSelected);
  const distributeSelected = useCanvasStore((state) => state.distributeSelected);
  const flipSelected = useCanvasStore((state) => state.flipSelected);
  const globalUndo = useCanvasStore((state) => state.undo);
  const globalRedo = useCanvasStore((state) => state.redo);

  // Global circuitIO
  const getGlobalCircuitData = useCallback((): SerializableCircuitState => {
    return useCanvasStore.getState().getCircuitData();
  }, []);

  const loadGlobalCircuit = useCallback((data: SerializableCircuitState) => {
    useCanvasStore.getState().loadCircuit(data);
  }, []);

  const globalCanUndo = useCanvasStore((state) => state.history.length > 0 && state.historyIndex >= 0);
  const globalCanRedo = useCanvasStore((state) => state.historyIndex < state.history.length - 1);

  // --------------------------------------------------------------------------
  // Build return value
  // --------------------------------------------------------------------------

  return useMemo((): CanvasFacadeReturn => {
    if (documentState) {
      return {
        // Selectors
        components: documentState.components,
        junctions: documentState.junctions,
        wires: documentState.wires,
        zoom: documentState.zoom,
        pan: documentState.pan,
        // Component Commands
        addComponent: documentState.addComponent,
        moveComponent: (id, position, skipHistory, skipWireRecalc) =>
          documentState.moveComponent(id, position, skipHistory, skipWireRecalc),
        updateComponent: documentState.updateComponent,
        // Junction Commands
        moveJunction: (id, position, skipHistory, skipWireRecalc) =>
          documentState.moveJunction(id, position, skipHistory, skipWireRecalc),
        // Wire Commands
        addWire: documentState.addWire,
        removeWire: documentState.removeWire,
        createJunctionOnWire: documentState.createJunctionOnWire,
        recalculateWireHandles: documentState.recalculateWireHandles,
        updateWireHandle: documentState.updateWireHandle,
        removeWireHandle: documentState.removeWireHandle,
        moveWireSegment: documentState.moveWireSegment,
        insertEndpointHandle: documentState.insertEndpointHandle,
        cleanupOverlappingHandles: documentState.cleanupOverlappingHandles,
        commitWirePolyline: documentState.commitWirePolyline,
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
        setPan: documentState.setPan,
        setZoom: documentState.setZoom,
        gridSize: documentState.gridSize,
        snapToGrid: documentState.snapToGrid,
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

    return {
      // Selectors
      components: globalComponents,
      junctions: globalJunctions,
      wires: globalWires,
      zoom: globalZoom,
      pan: globalPan,
      // Component Commands
      addComponent: globalAddComponent,
      moveComponent: (id, position, skipHistory, skipWireRecalc) =>
        globalMoveComponent(id, position, skipHistory, skipWireRecalc),
      updateComponent: globalUpdateComponent,
      // Junction Commands
      moveJunction: (id, position, skipHistory, skipWireRecalc) =>
        globalMoveJunction(id, position, skipHistory, skipWireRecalc),
      // Wire Commands
      addWire: globalAddWire,
      removeWire: globalRemoveWire,
      createJunctionOnWire: globalCreateJunctionOnWire,
      recalculateWireHandles: globalRecalculateWireHandles,
      updateWireHandle: globalUpdateWireHandle,
      removeWireHandle: globalRemoveWireHandle,
      moveWireSegment: globalMoveWireSegment,
      insertEndpointHandle: globalInsertEndpointHandle,
      cleanupOverlappingHandles: globalCleanupOverlappingHandles,
      commitWirePolyline: globalCommitWirePolyline,
      // Alignment
      alignSelected,
      distributeSelected,
      flipSelected,
      // CircuitIO
      getCircuitData: getGlobalCircuitData,
      loadCircuit: loadGlobalCircuit,
      // Wire Drawing
      wireDrawing,
      startWireDrawing,
      updateWireDrawing,
      cancelWireDrawing,
      // Selection
      selectedIds,
      setSelection: globalSetSelection,
      addToSelection: globalAddToSelection,
      toggleSelection: globalToggleSelection,
      clearSelection: globalClearSelection,
      // Viewport
      setPan,
      setZoom: globalSetZoom,
      gridSize: globalGridSize,
      snapToGrid: globalSnapToGrid,
      // History
      undo: globalUndo,
      redo: globalRedo,
      canUndo: globalCanUndo,
      canRedo: globalCanRedo,
      // Metadata
      isDocumentMode: false,
      documentId: null,
    };
  }, [
    // Document state
    documentState,
    documentWireDrawing,
    documentSelectedIds,
    documentId,
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
    // Global state
    globalComponents,
    globalJunctions,
    globalWires,
    globalZoom,
    globalPan,
    globalAddComponent,
    globalAddWire,
    globalMoveComponent,
    globalMoveJunction,
    globalRecalculateWireHandles,
    globalRemoveWire,
    globalCreateJunctionOnWire,
    globalUpdateComponent,
    globalUpdateWireHandle,
    globalRemoveWireHandle,
    globalMoveWireSegment,
    globalInsertEndpointHandle,
    globalCleanupOverlappingHandles,
    globalCommitWirePolyline,
    wireDrawing,
    startWireDrawing,
    updateWireDrawing,
    cancelWireDrawing,
    selectedIds,
    globalSetSelection,
    globalAddToSelection,
    globalToggleSelection,
    globalClearSelection,
    setPan,
    globalSetZoom,
    globalGridSize,
    globalSnapToGrid,
    alignSelected,
    distributeSelected,
    flipSelected,
    getGlobalCircuitData,
    loadGlobalCircuit,
    globalUndo,
    globalRedo,
    globalCanUndo,
    globalCanRedo,
  ]);
}
