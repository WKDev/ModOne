/**
 * useLadderPixiRenderer Hook
 *
 * Bridges the React/Zustand data layer with the Pixi.js rendering layer.
 *
 * Responsibilities:
 * - Creates and manages LadderSyncEngine lifecycle
 * - Subscribes to useLadderDocument data and ladderUIStore selection
 * - Drives fullSync / incremental updates on data change
 * - Wires LadderEventBridge callbacks for click-to-place, selection, and drag
 */

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { LadderPixiCanvasHostRef } from './LadderPixiCanvasHost';
import { LadderSyncEngine } from './LadderSyncEngine';
import { LadderDragHandler } from './interactions/LadderDragHandler';
import type { LadderPointerEvent } from './LadderEventBridge';
import type { UseLadderDocumentReturn } from '../../../stores/hooks/useLadderDocument';
import { useLadderUIStore } from '../../../stores/ladderUIStore';
import { isWireType } from '../../../types/ladder';
import type { LadderElementType } from '../../../types/ladder';

// ============================================================================
// Types
// ============================================================================

export interface UseLadderPixiRendererOptions {
  /** The Pixi canvas host ref (app, viewport, layers, eventBridge) */
  hostRef: LadderPixiCanvasHostRef | null;
  /** The ladder document hook return value */
  ladderDoc: UseLadderDocumentReturn | null;
  /** Whether the editor is in monitor (read-only) mode */
  readonly?: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useLadderPixiRenderer({
  hostRef,
  ladderDoc,
  readonly = false,
}: UseLadderPixiRendererOptions): void {
  const syncEngineRef = useRef<LadderSyncEngine | null>(null);
  const dragHandlerRef = useRef<LadderDragHandler | null>(null);

  // Subscribe to UI store state
  const { selectedElementIds, activeTool, monitoringState, mode } = useLadderUIStore(
    useShallow((state) => ({
      selectedElementIds: state.selectedElementIds,
      activeTool: state.activeTool,
      monitoringState: state.monitoringState,
      mode: state.mode,
    }))
  );

  // Stable references for callbacks
  const ladderDocRef = useRef(ladderDoc);
  const readonlyRef = useRef(readonly);
  const activeToolRef = useRef(activeTool);

  useEffect(() => {
    ladderDocRef.current = ladderDoc;
  }, [ladderDoc]);

  useEffect(() => {
    readonlyRef.current = readonly;
  }, [readonly]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // ===========================================================================
  // SyncEngine + DragHandler lifecycle
  // ===========================================================================

  useEffect(() => {
    if (!hostRef) return;

    const engine = new LadderSyncEngine(hostRef.layers);
    syncEngineRef.current = engine;

    const dragHandler = new LadderDragHandler(engine, engine.overlayLayer);
    dragHandlerRef.current = dragHandler;

    return () => {
      dragHandler.destroy();
      dragHandlerRef.current = null;
      engine.destroy();
      syncEngineRef.current = null;
    };
  }, [hostRef]);

  // ===========================================================================
  // Full sync when data changes
  // ===========================================================================

  useEffect(() => {
    const engine = syncEngineRef.current;
    if (!engine || !ladderDoc) return;

    engine.fullSync(
      ladderDoc.elements,
      ladderDoc.wires,
      ladderDoc.gridConfig,
      selectedElementIds,
    );
  }, [ladderDoc?.elements, ladderDoc?.wires, ladderDoc?.gridConfig, ladderDoc, selectedElementIds]);

  // ===========================================================================
  // Monitoring visualization sync
  // ===========================================================================

  useEffect(() => {
    const engine = syncEngineRef.current;
    if (!engine || !ladderDoc) return;

    if (mode === 'monitor' && monitoringState) {
      engine.applyMonitoring(monitoringState, ladderDoc.elements);
    } else {
      engine.clearMonitoring();
    }
  }, [mode, monitoringState, ladderDoc?.elements, ladderDoc]);

  // ===========================================================================
  // Grid config → EventBridge sync
  // ===========================================================================

  useEffect(() => {
    if (!hostRef || !ladderDoc) return;

    hostRef.eventBridge.setGridConfig(
      ladderDoc.gridConfig.cellWidth,
      ladderDoc.gridConfig.cellHeight,
    );
  }, [hostRef, ladderDoc?.gridConfig.cellWidth, ladderDoc?.gridConfig.cellHeight, ladderDoc]);

  // ===========================================================================
  // Event callbacks
  // ===========================================================================

  const handlePointerDown = useCallback((event: LadderPointerEvent) => {
    const doc = ladderDocRef.current;
    if (!doc || readonlyRef.current) return;

    // If no active tool, let drag handler evaluate
    if (!activeToolRef.current) {
      dragHandlerRef.current?.onPointerDown(event, doc, doc.gridConfig);
    }
  }, []);

  const handlePointerMove = useCallback((event: LadderPointerEvent) => {
    const doc = ladderDocRef.current;
    if (!doc || readonlyRef.current) return;

    // Forward to drag handler
    dragHandlerRef.current?.onPointerMove(event, doc, doc.gridConfig);
  }, []);

  const handlePointerUp = useCallback((event: LadderPointerEvent) => {
    const doc = ladderDocRef.current;
    if (!doc || readonlyRef.current) return;

    // If drag handler was active, let it handle pointer up
    if (dragHandlerRef.current?.isActive) {
      dragHandlerRef.current.onPointerUp(event, doc, doc.gridConfig);
      return; // Don't pass to click handler
    }

    // Cancel any pending drag (didn't reach threshold)
    dragHandlerRef.current?.cancel();
  }, []);

  const handleCellClick = useCallback((event: LadderPointerEvent) => {
    const doc = ladderDocRef.current;
    if (!doc || readonlyRef.current) return;

    // If drag was active (consumed the pointer up), skip click
    if (dragHandlerRef.current?.isActive) return;

    const tool = activeToolRef.current;
    const { gridRow, gridCol, shiftKey, ctrlKey } = event;

    // --- Click-to-place: active tool is set ---
    if (tool) {
      handlePlacement(doc, tool, gridRow, gridCol, shiftKey);
      return;
    }

    // --- Selection: no active tool ---
    const existingElement = doc.getElementAt(gridRow, gridCol);

    if (existingElement) {
      if (ctrlKey || shiftKey) {
        // Toggle selection
        useLadderUIStore.getState().toggleSelection(existingElement.id);
      } else {
        // Replace selection
        useLadderUIStore.getState().setSelection([existingElement.id]);
      }
    } else {
      // Click empty cell → clear selection
      if (!ctrlKey && !shiftKey) {
        useLadderUIStore.getState().clearSelection();
      }
    }
  }, []);

  const handleCellRightClick = useCallback((event: LadderPointerEvent) => {
    const doc = ladderDocRef.current;
    if (!doc) return;

    // Cancel drag on right-click
    dragHandlerRef.current?.cancel();

    const { gridRow, gridCol } = event;
    const existingElement = doc.getElementAt(gridRow, gridCol);

    if (existingElement) {
      // Select the right-clicked element if not already selected
      const state = useLadderUIStore.getState();
      if (!state.selectedElementIds.has(existingElement.id)) {
        state.setSelection([existingElement.id]);
      }
    }

    // Context menu will be handled by the React layer (LadderEditor)
    // via the native contextmenu event on the canvas container
  }, []);

  // ===========================================================================
  // Wire EventBridge callbacks
  // ===========================================================================

  useEffect(() => {
    if (!hostRef) return;

    hostRef.eventBridge.setCallbacks({
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onCellClick: handleCellClick,
      onCellRightClick: handleCellRightClick,
    });

    return () => {
      hostRef.eventBridge.setCallbacks({});
    };
  }, [hostRef, handlePointerDown, handlePointerMove, handlePointerUp, handleCellClick, handleCellRightClick]);
}

// ============================================================================
// Placement logic (extracted for clarity)
// ============================================================================

function handlePlacement(
  doc: UseLadderDocumentReturn,
  tool: LadderElementType,
  row: number,
  col: number,
  shiftKey: boolean,
): void {
  const existingElement = doc.getElementAt(row, col);

  // Wire tool: merge onto existing wire if applicable
  if (isWireType(tool) && existingElement && isWireType(existingElement.type)) {
    doc.mergeWireElement(existingElement.id, tool as 'wire_h' | 'wire_v');
    trackWireVPlacement(tool, row, col);
    return;
  }

  // Vertical wire + Shift → span from last placement
  if (tool === 'wire_v' && shiftKey) {
    const lastPos = useLadderUIStore.getState().lastWireVPlacement;
    if (lastPos && lastPos.col === col) {
      doc.placeVerticalWireSpan(col, lastPos.row, row);
      useLadderUIStore.getState().setLastWireVPlacement({ row, col });
      return;
    }
  }

  // Normal placement on empty cell
  if (!existingElement) {
    const newId = doc.addElement(tool, { row, col });
    if (newId) {
      trackWireVPlacement(tool, row, col);
      // Auto-select placed element (non-wire)
      if (!isWireType(tool)) {
        useLadderUIStore.getState().setSelection([newId]);
      }
    }
  }
}

/** Track last wire_v placement for Shift+Click spanning */
function trackWireVPlacement(
  tool: LadderElementType,
  row: number,
  col: number,
): void {
  if (tool === 'wire_v') {
    useLadderUIStore.getState().setLastWireVPlacement({ row, col });
  } else {
    useLadderUIStore.getState().setLastWireVPlacement(null);
  }
}
