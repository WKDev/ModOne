import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { LadderPixiCanvasHostRef } from './LadderPixiCanvasHost';
import { LadderSyncEngine } from './LadderSyncEngine';
import { LadderDragHandler } from './interactions/LadderDragHandler';
import { LadderDragSelectHandler } from './interactions/LadderDragSelectHandler';
import type { LadderPointerEvent } from './LadderEventBridge';
import type { UseLadderDocumentReturn } from '../../../stores/hooks/useLadderDocument';
import { useLadderUIStore } from '../../../stores/ladderUIStore';
import { handlePlacement } from '../utils/ladderPlacement';
import {
  getHorizontalWireMidline,
  resolveHorizontalWireHitTarget,
  resolveVerticalWireHitTarget,
} from './verticalWireInteraction';

export interface UseLadderPixiRendererOptions {
  hostRef: LadderPixiCanvasHostRef | null;
  ladderDoc: UseLadderDocumentReturn | null;
  readonly?: boolean;
}

export function useLadderPixiRenderer({
  hostRef,
  ladderDoc,
  readonly = false,
}: UseLadderPixiRendererOptions): void {
  const syncEngineRef = useRef<LadderSyncEngine | null>(null);
  const dragHandlerRef = useRef<LadderDragHandler | null>(null);
  const dragSelectHandlerRef = useRef<LadderDragSelectHandler | null>(null);

  const { selectedElementIds, activeTool, monitoringState, mode, cursorCell } = useLadderUIStore(
    useShallow((state) => ({
      selectedElementIds: state.selectedElementIds,
      activeTool: state.activeTool,
      monitoringState: state.monitoringState,
      mode: state.mode,
      cursorCell: state.cursorCell,
    })),
  );

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

  useEffect(() => {
    if (!hostRef) return;

    const engine = new LadderSyncEngine(hostRef.layers);
    const dragHandler = new LadderDragHandler(engine, engine.overlayLayer);
    const dragSelectHandler = new LadderDragSelectHandler(engine);
    syncEngineRef.current = engine;
    dragHandlerRef.current = dragHandler;
    dragSelectHandlerRef.current = dragSelectHandler;

    return () => {
      dragSelectHandler.destroy();
      dragSelectHandlerRef.current = null;
      dragHandler.destroy();
      dragHandlerRef.current = null;
      engine.destroy();
      syncEngineRef.current = null;
    };
  }, [hostRef]);

  useEffect(() => {
    const engine = syncEngineRef.current;
    if (!engine || !ladderDoc) return;

    engine.fullSync(
      ladderDoc.elements,
      ladderDoc.horizontalEdges,
      ladderDoc.verticalEdges,
      ladderDoc.topologyCache,
      ladderDoc.gridConfig,
      selectedElementIds,
      cursorCell,
    );
  }, [
    hostRef,
    ladderDoc,
    ladderDoc?.elements,
    ladderDoc?.horizontalEdges,
    ladderDoc?.verticalEdges,
    ladderDoc?.topologyCache,
    ladderDoc?.gridConfig,
    selectedElementIds,
    cursorCell,
  ]);

  useEffect(() => {
    const engine = syncEngineRef.current;
    if (!engine || !ladderDoc) return;
    if (mode === 'monitor' && monitoringState) {
      engine.applyMonitoring(monitoringState, ladderDoc.elements);
    } else {
      engine.clearMonitoring();
    }
  }, [hostRef, ladderDoc, mode, monitoringState]);

  useEffect(() => {
    if (!hostRef || !ladderDoc || !cursorCell) return;
    hostRef.scrollToCell(
      cursorCell.row,
      cursorCell.col,
      ladderDoc.gridConfig.cellWidth,
      ladderDoc.gridConfig.cellHeight,
    );
  }, [cursorCell, hostRef, ladderDoc]);

  useEffect(() => {
    if (!hostRef || !ladderDoc) return;
    hostRef.eventBridge.setGridConfig(ladderDoc.gridConfig.cellWidth, ladderDoc.gridConfig.cellHeight);
    hostRef.updateWorldConfig(ladderDoc.gridConfig.columns * ladderDoc.gridConfig.cellWidth);
  }, [hostRef, ladderDoc]);

  const resolveSelectionTarget = useCallback((event: LadderPointerEvent, doc: UseLadderDocumentReturn) => {
    const cellWidth = doc.gridConfig.cellWidth;
    const cellHeight = doc.gridConfig.cellHeight;

    const vertical = resolveVerticalWireHitTarget(
      event.worldX,
      event.worldY,
      event.gridCol,
      event.gridRow,
      cellWidth,
      cellHeight,
    );
    const horizontal = resolveHorizontalWireHitTarget(
      event.worldY,
      event.gridCol,
      event.gridRow,
      cellHeight,
    );

    const verticalEdge = vertical.isEdgeClick ? doc.getVerticalLinkAt(vertical.targetRow, vertical.targetCol) : undefined;
    const horizontalEdge = horizontal.isEdgeClick ? doc.getHorizontalEdgeAt(horizontal.row, horizontal.col) : undefined;
    const element = doc.getElementAt(event.gridRow, event.gridCol, 'instruction');

    const verticalDistance = verticalEdge ? Math.abs(event.worldX - vertical.targetCol * cellWidth) : Number.POSITIVE_INFINITY;
    const horizontalDistance = horizontalEdge ? Math.abs(event.worldY - (horizontal.row * cellHeight + getHorizontalWireMidline(cellHeight))) : Number.POSITIVE_INFINITY;

    if (verticalEdge || horizontalEdge) {
      if (verticalDistance <= horizontalDistance) {
        return {
          id: verticalEdge?.id,
          kind: verticalEdge ? 'vertical-edge' as const : null,
          cursorCell: { row: event.gridRow, col: vertical.targetCol },
          edgeHover: verticalEdge ? { kind: 'vertical-edge' as const, row: vertical.targetRow, col: vertical.targetCol } : null,
        };
      }

      return {
        id: horizontalEdge?.id,
        kind: horizontalEdge ? 'horizontal-edge' as const : null,
        cursorCell: { row: event.gridRow, col: event.gridCol },
        edgeHover: horizontalEdge ? { kind: 'horizontal-edge' as const, row: horizontal.row, col: horizontal.col } : null,
      };
    }

    return {
      id: element?.id,
      kind: element ? 'cell' as const : null,
      cursorCell: { row: event.gridRow, col: event.gridCol },
      edgeHover: null,
    };
  }, []);

  const handlePointerDown = useCallback((event: LadderPointerEvent) => {
    const doc = ladderDocRef.current;
    if (!doc || readonlyRef.current) return;
    if (!activeToolRef.current) {
      // Try element drag first; if no element hit, try drag-select
      const claimed = dragHandlerRef.current?.onPointerDown(event, doc, doc.gridConfig);
      if (!claimed) {
        dragSelectHandlerRef.current?.onPointerDown(event, doc, doc.gridConfig);
      }
    }
  }, []);

  const handlePointerMove = useCallback((event: LadderPointerEvent) => {
    const doc = ladderDocRef.current;
    if (!doc || readonlyRef.current) return;

    // Drag-select takes priority when active
    if (dragSelectHandlerRef.current?.onPointerMove(event, doc, doc.gridConfig)) {
      return;
    }

    dragHandlerRef.current?.onPointerMove(event, doc, doc.gridConfig);

    const uiStore = useLadderUIStore.getState();
    const cellHeight = doc.gridConfig.cellHeight;
    const vertical = resolveVerticalWireHitTarget(
      event.worldX,
      event.worldY,
      event.gridCol,
      event.gridRow,
      doc.gridConfig.cellWidth,
      cellHeight,
    );
    const horizontal = resolveHorizontalWireHitTarget(
      event.worldY,
      event.gridCol,
      event.gridRow,
      cellHeight,
    );

    if (doc.getVerticalLinkAt(vertical.targetRow, vertical.targetCol)) {
      uiStore.setEdgeHover({ kind: 'vertical-edge', row: vertical.targetRow, col: vertical.targetCol });
    } else if (horizontal.isEdgeClick && doc.getHorizontalEdgeAt(horizontal.row, horizontal.col)) {
      uiStore.setEdgeHover({ kind: 'horizontal-edge', row: horizontal.row, col: horizontal.col });
    } else {
      uiStore.setEdgeHover(null);
    }
  }, []);

  const handlePointerUp = useCallback((event: LadderPointerEvent) => {
    const doc = ladderDocRef.current;
    if (!doc || readonlyRef.current) return;
    if (dragSelectHandlerRef.current?.isActive) {
      dragSelectHandlerRef.current.onPointerUp();
      return;
    }
    if (dragHandlerRef.current?.isActive) {
      dragHandlerRef.current.onPointerUp(event, doc, doc.gridConfig);
      return;
    }
    dragHandlerRef.current?.cancel();
  }, []);

  const handleCellClick = useCallback((event: LadderPointerEvent) => {
    const doc = ladderDocRef.current;
    if (!doc || readonlyRef.current) return;
    if (dragHandlerRef.current?.isActive) return;
    if (dragSelectHandlerRef.current?.isActive) return;

    const uiStore = useLadderUIStore.getState();
    const tool = activeToolRef.current;

    const verticalTarget = resolveVerticalWireHitTarget(
      event.worldX,
      event.worldY,
      event.gridCol,
      event.gridRow,
      doc.gridConfig.cellWidth,
      doc.gridConfig.cellHeight,
    );

    if (tool) {
      if (tool === 'wire_v') {
        handlePlacement(doc, tool, event.gridRow, verticalTarget.targetCol, event.shiftKey, verticalTarget.targetRow);
        uiStore.setCursorCell({ row: event.gridRow, col: verticalTarget.targetCol });
        uiStore.setSelectionAnchor({ row: event.gridRow, col: verticalTarget.targetCol });
      } else {
        handlePlacement(doc, tool, event.gridRow, event.gridCol, event.shiftKey);
        uiStore.setCursorCell({ row: event.gridRow, col: event.gridCol });
        uiStore.setSelectionAnchor({ row: event.gridRow, col: event.gridCol });
      }
      return;
    }

    const target = resolveSelectionTarget(event, doc);
    uiStore.setCursorCell(target.cursorCell);
    uiStore.setEdgeHover(target.edgeHover);

    if (event.shiftKey && !event.ctrlKey) {
      const anchor = uiStore.selectionAnchor;
      if (anchor) {
        const minRow = Math.min(anchor.row, event.gridRow);
        const maxRow = Math.max(anchor.row, event.gridRow);
        const minCol = Math.min(anchor.col, event.gridCol);
        const maxCol = Math.max(anchor.col, event.gridCol);
        const rangeIds: string[] = [];
        for (const element of doc.elements.values()) {
          if (
            element.position.row >= minRow && element.position.row <= maxRow &&
            element.position.col >= minCol && element.position.col <= maxCol
          ) {
            rangeIds.push(element.id);
          }
        }
        uiStore.setSelection(rangeIds);
        return;
      }
    }

    if (target.id) {
      if (event.ctrlKey) {
        uiStore.toggleSelection(target.id);
      } else {
        uiStore.setSelection([target.id]);
      }
      uiStore.setSelectionAnchor({ row: event.gridRow, col: event.gridCol });
      return;
    }

    if (!event.ctrlKey && !event.shiftKey) {
      uiStore.clearSelection();
      uiStore.setSelectionAnchor({ row: event.gridRow, col: event.gridCol });
    }
  }, [resolveSelectionTarget]);

  const handleCellRightClick = useCallback((event: LadderPointerEvent) => {
    const doc = ladderDocRef.current;
    if (!doc) return;
    dragHandlerRef.current?.cancel();

    const target = resolveSelectionTarget(event, doc);
    if (target.id) {
      const uiStore = useLadderUIStore.getState();
      if (!uiStore.selectedElementIds.has(target.id)) {
        uiStore.setSelection([target.id]);
      }
    }
  }, [resolveSelectionTarget]);

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
  }, [handleCellClick, handleCellRightClick, handlePointerDown, handlePointerMove, handlePointerUp, hostRef]);
}
