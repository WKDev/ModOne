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
import type { LadderElement, VerticalLinkEntity } from '../../../types/ladder';
import type { UseLadderDocumentReturn } from '../../../stores/hooks/useLadderDocument';
import { useLadderUIStore } from '../../../stores/ladderUIStore';
import { handlePlacement } from '../utils/ladderPlacement';
import { getVerticalWireSegmentDistance, resolveVerticalWireHitTarget } from './verticalWireInteraction';

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
  const { selectedElementIds, activeTool, monitoringState, mode, cursorCell } = useLadderUIStore(
    useShallow((state) => ({
      selectedElementIds: state.selectedElementIds,
      activeTool: state.activeTool,
      monitoringState: state.monitoringState,
      mode: state.mode,
      cursorCell: state.cursorCell,
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
      ladderDoc.verticalLinks,
      ladderDoc.wires,
      ladderDoc.gridConfig,
      selectedElementIds,
      cursorCell,
    );
  }, [hostRef, ladderDoc?.elements, ladderDoc?.verticalLinks, ladderDoc?.wires, ladderDoc?.gridConfig, ladderDoc, selectedElementIds, cursorCell]);

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
  }, [hostRef, mode, monitoringState, ladderDoc?.elements, ladderDoc]);

  // ===========================================================================
  // Auto-scroll when cursor cell changes (keyboard navigation)
  // ===========================================================================

  useEffect(() => {
    if (!hostRef || !cursorCell || !ladderDoc) return;
    hostRef.scrollToCell(
      cursorCell.row,
      cursorCell.col,
      ladderDoc.gridConfig.cellWidth,
      ladderDoc.gridConfig.cellHeight,
    );
  }, [hostRef, cursorCell, ladderDoc?.gridConfig.cellWidth, ladderDoc?.gridConfig.cellHeight, ladderDoc]);

  // ===========================================================================
  // Grid config → EventBridge & Host sync
  // ===========================================================================

  useEffect(() => {
    if (!hostRef || !ladderDoc) return;

    hostRef.eventBridge.setGridConfig(
      ladderDoc.gridConfig.cellWidth,
      ladderDoc.gridConfig.cellHeight,
    );

    // Sync world width based on grid columns
    const gridWidth = ladderDoc.gridConfig.columns * ladderDoc.gridConfig.cellWidth;
    hostRef.updateWorldConfig(gridWidth);
  }, [hostRef, ladderDoc?.gridConfig.columns, ladderDoc?.gridConfig.cellWidth, ladderDoc?.gridConfig.cellHeight, ladderDoc]);

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
    const { gridRow, gridCol, shiftKey, ctrlKey, worldX } = event;
    const uiStore = useLadderUIStore.getState();

    // --- Edge Hit Testing for Vertical Wires ---
    const cellWidth = doc.gridConfig.cellWidth;
    const cellHeight = doc.gridConfig.cellHeight;
    const { targetCol, targetRow, isEdgeClick } = resolveVerticalWireHitTarget(
      worldX,
      event.worldY,
      gridCol,
      gridRow,
      cellWidth,
      cellHeight,
    );

    // --- Click-to-place: active tool is set ---
    if (tool) {
      if (tool === 'wire_v') {
        // Force placement on nearest edge if using vertical wire tool
        handlePlacement(doc, tool, gridRow, targetCol, shiftKey, targetRow);
        uiStore.setCursorCell({ row: gridRow, col: targetCol });
        uiStore.setSelectionAnchor({ row: gridRow, col: targetCol });
      } else {
        handlePlacement(doc, tool, gridRow, gridCol, shiftKey);
        uiStore.setCursorCell({ row: gridRow, col: gridCol });
        uiStore.setSelectionAnchor({ row: gridRow, col: gridCol });
      }
      return;
    }

    // --- Always update cursor cell on click ---
    // If it's a clear edge click, we might want to move cursor to that boundary?
    // For now, keep standard cell cursor but prioritize selection.
    uiStore.setCursorCell({ row: gridRow, col: gridCol });

    // --- Range selection via Shift+Click ---
    if (shiftKey && !ctrlKey) {
      const anchor = uiStore.selectionAnchor;
      if (anchor) {
        // Select all elements within the rectangular range anchor → cursor
        const minRow = Math.min(anchor.row, gridRow);
        const maxRow = Math.max(anchor.row, gridRow);
        const minCol = Math.min(anchor.col, gridCol);
        const maxCol = Math.max(anchor.col, gridCol);

        const rangeIds: string[] = [];
        for (const el of doc.elements.values()) {
          if (
            el.position.row >= minRow && el.position.row <= maxRow &&
            el.position.col >= minCol && el.position.col <= maxCol
          ) {
            rangeIds.push(el.id);
          }
        }
        uiStore.setSelection(rangeIds);
        return;
      }
    }

    // --- Selection: no active tool ---
    // 1. Try to find a vertical wire if click was near an edge
    let targetElement: LadderElement | undefined;
    let targetVerticalLink: VerticalLinkEntity | undefined;
    if (isEdgeClick) {
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const verticalLink of doc.verticalLinks.values()) {
        if (verticalLink.position.col !== targetCol) continue;
        if (Math.abs(verticalLink.position.row - targetRow) > 1) continue;

        const distance = getVerticalWireSegmentDistance(event.worldY, verticalLink.position.row, cellHeight);
        if (distance <= cellHeight * 0.4 && distance < bestDistance) {
          targetVerticalLink = verticalLink;
          bestDistance = distance;
        }
      }
    }

    if (!targetVerticalLink) {
      targetElement = doc.getElementAt(gridRow, gridCol, 'instruction');
    }

    const selectedId = targetVerticalLink?.id ?? targetElement?.id;

    if (selectedId) {
      if (ctrlKey) {
        uiStore.toggleSelection(selectedId);
        if (!uiStore.selectionAnchor) {
          uiStore.setSelectionAnchor({ row: gridRow, col: gridCol });
        }
      } else {
        uiStore.setSelection([selectedId]);
        uiStore.setSelectionAnchor({ row: gridRow, col: gridCol });
      }
    } else {
      // Click empty cell
      if (!ctrlKey && !shiftKey) {
        uiStore.clearSelection();
        uiStore.setSelectionAnchor({ row: gridRow, col: gridCol });
      }
    }
  }, []);


  const handleCellRightClick = useCallback((event: LadderPointerEvent) => {
    const doc = ladderDocRef.current;
    if (!doc) return;

    // Cancel drag on right-click
    dragHandlerRef.current?.cancel();

    const { gridRow, gridCol, worldX, worldY } = event;
    const { targetCol, targetRow, isEdgeClick } = resolveVerticalWireHitTarget(
      worldX,
      worldY,
      gridCol,
      gridRow,
      doc.gridConfig.cellWidth,
      doc.gridConfig.cellHeight,
    );

    const existingVerticalLink = isEdgeClick ? doc.getVerticalLinkAt(targetRow, targetCol) : undefined;
    const existingElement = existingVerticalLink ? undefined : doc.getElementAt(gridRow, gridCol);

    if (existingVerticalLink || existingElement) {
      const state = useLadderUIStore.getState();
      const id = existingVerticalLink?.id ?? existingElement?.id;
      if (id && !state.selectedElementIds.has(id)) {
        state.setSelection([id]);
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

