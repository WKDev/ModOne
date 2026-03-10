/**
 * Global Canvas Adapter
 *
 * Wraps the legacy `canvasStore` behind the `CanvasFacadeReturn` interface.
 * This is the ONLY module allowed to import `canvasStore` directly
 * (besides canvasStore.ts itself).
 *
 * DEPRECATED: This adapter exists as a temporary fallback for when no
 * documentId is available. It will be removed once all canvas access
 * is routed through the document registry (Task 3.5).
 *
 * @see PRD_OneCanvas_Stabilization.md — Phase 3, Task 3.1
 */

import { useCallback, useMemo } from 'react';
import { useCanvasStore } from '../canvasStore';
import { getAllSelectedIds } from '../../components/OneCanvas/types';
import type { CanvasFacadeReturn } from '../../types/canvasFacade';
import type { SerializableCircuitState } from '../../components/OneCanvas/types';

import type { Block } from '../../components/OneCanvas/types';
// ============================================================================
// Hook
// ============================================================================

// Dev-time deprecation tracking (warns once per session)
let _hasWarnedDeprecation = false;

/**
 * React hook that provides the global canvasStore state through the
 * CanvasFacadeReturn interface.
 *
 * All `useCanvasStore(selector)` calls are made unconditionally to
 * satisfy React hook rules. The returned object is memoized.
 *
 * @deprecated Use document-mode via useCanvasDocument instead.
 */
export function useGlobalCanvasAdapter(): CanvasFacadeReturn {
  // Dev-time deprecation warning (once per session)
  if (import.meta.env.DEV && !_hasWarnedDeprecation) {
    _hasWarnedDeprecation = true;
    console.warn(
      '[DEPRECATED] useGlobalCanvasAdapter: global canvasStore fallback is active. ' +
      'All canvas access should use document-mode (documentId). ' +
      'See PRD_OneCanvas_Stabilization.md — Task 3.4'
    );
  }
  // --------------------------------------------------------------------------
  // Selectors (all unconditional — React hook rules)
  // --------------------------------------------------------------------------

  const globalComponents = useCanvasStore((s) => s.components);
  const globalJunctions = useCanvasStore((s) => s.junctions);
  const globalWires = useCanvasStore((s) => s.wires);
  const globalZoom = useCanvasStore((s) => s.zoom);
  const globalPan = useCanvasStore((s) => s.pan);

  // Component commands
  const globalAddComponent = useCanvasStore((s) => s.addComponent);
  const globalMoveComponent = useCanvasStore((s) => s.moveComponent);
  const globalUpdateComponent = useCanvasStore((s) => s.updateComponent);

  // Junction commands
  const globalMoveJunction = useCanvasStore((s) => s.moveJunction);

  // Wire commands
  const globalAddWire = useCanvasStore((s) => s.addWire);
  const globalRemoveWire = useCanvasStore((s) => s.removeWire);
  const globalCreateJunctionOnWire = useCanvasStore((s) => s.createJunctionOnWire);
  const globalRecalculateWireHandles = useCanvasStore((s) => s.recalculateWireHandles);
  const globalUpdateWireHandle = useCanvasStore((s) => s.updateWireHandle);
  const globalRemoveWireHandle = useCanvasStore((s) => s.removeWireHandle);
  const globalMoveWireSegment = useCanvasStore((s) => s.moveWireSegment);
  const globalInsertEndpointHandle = useCanvasStore((s) => s.insertEndpointHandle);
  const globalCleanupOverlappingHandles = useCanvasStore((s) => s.cleanupOverlappingHandles);
  const globalCommitWirePolyline = useCanvasStore((s) => s.commitWirePolyline);

  // Wire drawing
  const wireDrawing = useCanvasStore((s) => s.wireDrawing);
  const startWireDrawing = useCanvasStore((s) => s.startWireDrawing);
  const updateWireDrawing = useCanvasStore((s) => s.updateWireDrawing);
  const cancelWireDrawing = useCanvasStore((s) => s.cancelWireDrawing);

  // Selection
  const globalSelection = useCanvasStore((s) => s.selection);
  const selectedIds = useMemo(
    () => new Set(getAllSelectedIds(globalSelection)),
    [globalSelection]
  );
  const globalSetSelection = useCanvasStore((s) => s.setSelection);
  const globalAddToSelection = useCanvasStore((s) => s.addToSelection);
  const globalToggleSelection = useCanvasStore((s) => s.toggleSelection);
  const globalClearSelection = useCanvasStore((s) => s.clearSelection);

  // Viewport
  const setPan = useCanvasStore((s) => s.setPan);
  const globalSetZoom = useCanvasStore((s) => s.setZoom);
  const globalGridSize = useCanvasStore((s) => s.gridSize);
  const globalSnapToGrid = useCanvasStore((s) => s.snapToGrid);

  // Alignment
  const alignSelected = useCanvasStore((s) => s.alignSelected);
  const distributeSelected = useCanvasStore((s) => s.distributeSelected);
  const flipSelected = useCanvasStore((s) => s.flipSelected);

  // History
  const globalUndo = useCanvasStore((s) => s.undo);
  const globalRedo = useCanvasStore((s) => s.redo);
  const globalCanUndo = useCanvasStore(
    (s) => s.history.length > 0 && s.historyIndex >= 0
  );
  const globalCanRedo = useCanvasStore(
    (s) => s.historyIndex < s.history.length - 1
  );

  // --------------------------------------------------------------------------
  // Circuit I/O (non-reactive, uses getState())
  // --------------------------------------------------------------------------

  const getCircuitData = useCallback(
    (): SerializableCircuitState => useCanvasStore.getState().getCircuitData(),
    []
  );

  const loadCircuit = useCallback(
    (data: SerializableCircuitState) => useCanvasStore.getState().loadCircuit(data),
    []
  );

  // --------------------------------------------------------------------------
  // Build return value
  // --------------------------------------------------------------------------

  return useMemo(
    (): CanvasFacadeReturn => ({
      // Selectors
      components: globalComponents as unknown as Map<string, Block>,
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
      dragWireSegment: () => null,
      insertEndpointHandle: globalInsertEndpointHandle,
      cleanupOverlappingHandles: globalCleanupOverlappingHandles,
      commitWirePolyline: globalCommitWirePolyline,

      // Alignment
      alignSelected,
      distributeSelected,
      flipSelected,

      // Circuit I/O
      getCircuitData,
      loadCircuit,

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
    }),
    [
      // Selectors
      globalComponents,
      globalJunctions,
      globalWires,
      globalZoom,
      globalPan,
      // Component commands
      globalAddComponent,
      globalMoveComponent,
      globalUpdateComponent,
      // Junction commands
      globalMoveJunction,
      // Wire commands
      globalAddWire,
      globalRemoveWire,
      globalCreateJunctionOnWire,
      globalRecalculateWireHandles,
      globalUpdateWireHandle,
      globalRemoveWireHandle,
      globalMoveWireSegment,
      globalInsertEndpointHandle,
      globalCleanupOverlappingHandles,
      globalCommitWirePolyline,
      // Alignment
      alignSelected,
      distributeSelected,
      flipSelected,
      // Circuit I/O
      getCircuitData,
      loadCircuit,
      // Wire drawing
      wireDrawing,
      startWireDrawing,
      updateWireDrawing,
      cancelWireDrawing,
      // Selection
      selectedIds,
      globalSetSelection,
      globalAddToSelection,
      globalToggleSelection,
      globalClearSelection,
      // Viewport
      setPan,
      globalSetZoom,
      globalGridSize,
      globalSnapToGrid,
      // History
      globalUndo,
      globalRedo,
      globalCanUndo,
      globalCanRedo,
    ]
  );
}
