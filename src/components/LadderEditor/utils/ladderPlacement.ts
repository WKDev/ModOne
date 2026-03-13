/**
 * Shared placement logic for the graph-first ladder editor.
 */

import { toast } from 'sonner';
import { useLadderUIStore } from '../../../stores/ladderUIStore';
import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { isLadderDocument } from '../../../types/document';
import { getVerticalLinkRowFromMainGridRow, isWireType } from '../../../types/ladder';
import type {
  GridPosition,
  HorizontalEdgeEntity,
  LadderElement,
  LadderElementType,
  VerticalLinkEntity,
  VerticalLinkPosition,
} from '../../../types/ladder';
import { validatePlacement } from './validation';

export function handlePlacement(
  doc: {
    gridConfig: { columns: number };
    addElement: (type: LadderElementType, pos: GridPosition) => string | null;
    placeHorizontalRun: (row: number, startBoundaryCol: number, endBoundaryCol: number) => string | null;
    addVerticalLink: (pos: VerticalLinkPosition) => string | null;
    placeVerticalLinkSpan: (col: number, start: number, end: number) => void;
    getElementAt: (row: number, col: number) => LadderElement | undefined;
    getHorizontalEdgeAt: (row: number, col: number) => HorizontalEdgeEntity | undefined;
    getVerticalLinkAt: (row: number, col: number) => VerticalLinkEntity | undefined;
  },
  tool: LadderElementType,
  row: number,
  col: number,
  shiftKey = false,
  verticalLinkRow?: number,
): void {
  if (tool === 'wire_v') {
    const gapRow = verticalLinkRow ?? getVerticalLinkRowFromMainGridRow(row);
    if (shiftKey) {
      const last = useLadderUIStore.getState().lastWireVPlacement;
      if (last && last.col === col) {
        doc.placeVerticalLinkSpan(col, last.row, gapRow);
        useLadderUIStore.getState().setLastWireVPlacement({ row: gapRow, col });
        return;
      }
    }

    const placedId = doc.addVerticalLink({ row: gapRow, col });
    if (placedId) {
      useLadderUIStore.getState().setLastWireVPlacement({ row: gapRow, col });
    }
    return;
  }

  if (tool === 'wire_h') {
    doc.placeHorizontalRun(row, col, col + 1);
    useLadderUIStore.getState().setLastWireVPlacement(null);
    return;
  }

  const existingElement = doc.getElementAt(row, col);
  if (existingElement) {
    return;
  }

  const validation = validatePlacement(tool, { row, col }, doc.gridConfig.columns);
  if (!validation.valid) {
    toast.error(validation.error);
    return;
  }

  const newId = doc.addElement(tool, { row, col });
  if (newId) {
    useLadderUIStore.getState().setSelection([newId]);
    useLadderUIStore.getState().setLastWireVPlacement(null);
  }
}

export function placeElementAtCursor(documentId: string, tool: LadderElementType): void {
  const uiStore = useLadderUIStore.getState();
  const cursor = uiStore.cursorCell;
  const mode = uiStore.mode;
  if (!cursor || mode !== 'edit') return;

  const registry = useDocumentRegistry.getState();
  const doc = registry.getDocument(documentId);
  if (!doc || !isLadderDocument(doc)) return;

  const { row, col } = cursor;
  if (tool === 'wire_v') {
    const gapRow = getVerticalLinkRowFromMainGridRow(row);
    const existing = Array.from(doc.data.verticalEdges.values()).find(
      (edge) => edge.position.row === gapRow && edge.position.col === col,
    );
    if (existing) return;

    registry.pushHistory(documentId, 'Place vertical edge');
    registry.updateLadderData(documentId, (docData) => {
      const id = `v-edge-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      docData.verticalEdges.set(id, {
        id,
        position: { row: gapRow, col },
        properties: { isValid: true },
      });
    });
    useLadderUIStore.getState().setLastWireVPlacement({ row: gapRow, col });
    return;
  }

  if (tool === 'wire_h') {
    registry.pushHistory(documentId, 'Place horizontal run');
    registry.updateLadderData(documentId, (docData) => {
      const id = `h-edge-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      docData.horizontalEdges.set(id, {
        id,
        position: { row, startBoundaryCol: col, endBoundaryCol: col + 1 },
        properties: { isValid: true },
      });
    });
    useLadderUIStore.getState().setLastWireVPlacement(null);
    return;
  }

  if (isWireType(tool)) return;
  const validation = validatePlacement(tool, cursor, doc.data.gridConfig.columns);
  if (!validation.valid) {
    toast.error(validation.error);
    return;
  }

  const existing = Array.from(doc.data.elements.values()).find(
    (element) => element.position.row === row && element.position.col === col,
  );
  if (existing) return;

  registry.pushHistory(documentId, `Place ${tool}`);
  const newId = `${tool}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  registry.updateLadderData(documentId, (docData) => {
    docData.elements.set(newId, {
      id: newId,
      type: tool as LadderElement['type'],
      position: { ...cursor },
      properties: {},
    } as LadderElement);
  });
  useLadderUIStore.getState().setSelection([newId]);
}
