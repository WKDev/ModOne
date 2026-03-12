/**
 * ladderPlacement Utility
 *
 * Shared logic for placing ladder elements on the grid.
 * Used by both mouse interactions (useLadderPixiRenderer) and keyboard shortcuts.
 */

import { useLadderUIStore } from '../../../stores/ladderUIStore';
import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { isLadderDocument } from '../../../types/document';
import {
  isWireType,
  getVerticalLinkRowFromMainGridRow,
} from '../../../types/ladder';
import { toast } from 'sonner';
import { validatePlacement } from './validation';
import type {
  LadderElementType,
  GridPosition,
  LadderElement,
  VerticalLinkPosition,
  VerticalLinkEntity,
} from '../../../types/ladder';
import {
  analyzeNeighborDirections,
  resolveWireElementType,
  updateAdjacentWires,
  applyWireTypeUpdate,
  mergeWireDirections,
  recalculateWireType,
} from './wireGenerator';

function generateId(prefix: string): string {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function refreshVerticalLinkNeighbors(
  elements: Map<string, LadderElement>,
  verticalLinks: Map<string, VerticalLinkEntity>,
  gridConfig: { columns: number },
  positions: VerticalLinkPosition[],
): void {
  const visited = new Set<string>();

  for (const position of positions) {
    const affectedCells = [
      { row: position.row - 1, col: position.col },
      { row: position.row, col: position.col },
    ].filter((cell) => cell.row >= 0 && cell.col >= 0 && cell.col < gridConfig.columns);

    for (const cell of affectedCells) {
      const key = cell.row + '-' + cell.col;
      if (visited.has(key)) continue;
      visited.add(key);

      const current = Array.from(elements.values()).find(
        (element) => element.position.row === cell.row && element.position.col === cell.col,
      );

      if (current) {
        if (isWireType(current.type)) {
          const selfUpdate = recalculateWireType(current, elements, gridConfig as any, undefined, verticalLinks);
          if (selfUpdate) {
            applyWireTypeUpdate(current, selfUpdate);
          }
        } else {
          current.properties.connectedDirections = analyzeNeighborDirections(
            cell,
            elements,
            gridConfig as any,
            undefined,
            verticalLinks,
          );
        }
      }

      const adjacentUpdates = updateAdjacentWires(cell, elements, gridConfig as any, undefined, verticalLinks);
      for (const update of adjacentUpdates) {
        const adjacent = elements.get(update.elementId);
        if (adjacent && isWireType(adjacent.type)) {
          applyWireTypeUpdate(adjacent, update);
        }
      }
    }
  }
}

export function handlePlacement(
  doc: {
    elements: Map<string, LadderElement>;
    verticalLinks: Map<string, VerticalLinkEntity>;
    gridConfig: { columns: number };
    addElement: (type: LadderElementType, pos: GridPosition) => string | null;
    addVerticalLink: (pos: VerticalLinkPosition) => string | null;
    mergeWireElement: (id: string, type: 'wire_h' | 'wire_v') => void;
    placeVerticalLinkSpan: (col: number, start: number, end: number) => void;
    getElementAt: (row: number, col: number) => LadderElement | undefined;
    getVerticalLinkAt: (row: number, col: number) => VerticalLinkEntity | undefined;
  },
  tool: LadderElementType,
  row: number,
  col: number,
  shiftKey: boolean = false,
  verticalLinkRow?: number,
): void {
  if (tool === 'wire_v') {
    const targetRow = verticalLinkRow ?? getVerticalLinkRowFromMainGridRow(row);
    const existingVerticalLink = doc.getVerticalLinkAt(targetRow, col);

    if (shiftKey) {
      const lastPos = useLadderUIStore.getState().lastWireVPlacement;
      if (lastPos && lastPos.col === col) {
        doc.placeVerticalLinkSpan(col, lastPos.row, targetRow);
        useLadderUIStore.getState().setLastWireVPlacement({ row: targetRow, col });
        return;
      }
    }

    if (!existingVerticalLink) {
      const newId = doc.addVerticalLink({ row: targetRow, col });
      if (newId) {
        trackWireVPlacement(tool, targetRow, col);
      }
    }
    return;
  }

  const existingElement = doc.getElementAt(row, col);

  if (isWireType(tool) && existingElement && isWireType(existingElement.type)) {
    doc.mergeWireElement(existingElement.id, tool as 'wire_h' | 'wire_v');
    trackWireVPlacement(tool, row, col);
    return;
  }

  if (!existingElement) {
    if (!isWireType(tool)) {
      const validation = validatePlacement(tool, { row, col }, doc.gridConfig.columns);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
    }

    const newId = doc.addElement(tool, { row, col });
    if (newId) {
      trackWireVPlacement(tool, row, col);
      if (!isWireType(tool)) {
        useLadderUIStore.getState().setSelection([newId]);
      }
    }
  }
}

export function placeElementAtCursor(documentId: string, tool: LadderElementType): void {
  const uiStore = useLadderUIStore.getState();
  const cursor = uiStore.cursorCell;
  const mode = uiStore.mode;

  if (!cursor || mode !== 'edit' || !documentId) return;

  const registry = useDocumentRegistry.getState();
  const doc = registry.getDocument(documentId);
  if (!doc || !isLadderDocument(doc)) return;

  const { row, col } = cursor;
  const data = doc.data;

  if (tool === 'wire_v') {
    const targetRow = getVerticalLinkRowFromMainGridRow(row);
    const existingVerticalLink = Array.from(data.verticalLinks.values()).find(
      (verticalLink) => verticalLink.position.row === targetRow && verticalLink.position.col === col,
    );
    if (existingVerticalLink) return;

    registry.pushHistory(documentId, 'Add wire_v');
    registry.updateLadderData(documentId, (docData) => {
      const id = generateId('vertical-link');
      docData.verticalLinks.set(id, {
        id,
        position: { row: targetRow, col },
        properties: { isValid: true },
      });
      refreshVerticalLinkNeighbors(docData.elements, docData.verticalLinks, docData.gridConfig, [{ row: targetRow, col }]);
    });

    trackWireVPlacement(tool, targetRow, col);
    return;
  }

  const existingElement = Array.from(data.elements.values()).find(
    (el) => el.position.row === row && el.position.col === col,
  );

  if (existingElement && !isWireType(existingElement.type)) {
    return;
  }

  if (isWireType(tool) && existingElement && isWireType(existingElement.type)) {
    registry.pushHistory(documentId, 'Merge ' + tool);
    registry.updateLadderData(documentId, (docData) => {
      const el = docData.elements.get(existingElement.id);
      if (!el) return;
      const mergeUpdate = mergeWireDirections(el, tool as 'wire_h' | 'wire_v', docData.elements, docData.gridConfig, undefined, docData.verticalLinks);
      if (mergeUpdate) applyWireTypeUpdate(el, mergeUpdate);

      const adjUpdates = updateAdjacentWires(el.position, docData.elements, docData.gridConfig, undefined, docData.verticalLinks);
      for (const u of adjUpdates) {
        const adj = docData.elements.get(u.elementId);
        if (adj && isWireType(adj.type)) applyWireTypeUpdate(adj, u);
      }
    });
    return;
  }

  if (!existingElement) {
    if (!isWireType(tool)) {
      const validation = validatePlacement(tool, { row, col }, data.gridConfig.columns);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
    }

    registry.pushHistory(documentId, 'Add ' + tool);
    registry.updateLadderData(documentId, (docData) => {
      let resolvedType: LadderElementType = tool;
      let wireDirection: string | undefined;
      let wireDirections: number | undefined;
      if (tool === 'wire_h') {
        const resolved = resolveWireElementType(cursor, tool as 'wire_h' | 'wire_v', docData.elements, docData.gridConfig, undefined, docData.verticalLinks);
        resolvedType = resolved.type;
        wireDirection = resolved.direction;
        wireDirections = resolved.directions;
      }

      const id = generateId(resolvedType);
      const newElement: LadderElement = {
        id,
        type: resolvedType,
        position: { ...cursor },
        properties: {
          ...(wireDirection !== undefined ? { direction: wireDirection } : {}),
          ...(wireDirections !== undefined ? { connectedDirections: wireDirections } : {}),
        },
      } as LadderElement;

      docData.elements.set(id, newElement);

      const adjUpdates = updateAdjacentWires(cursor, docData.elements, docData.gridConfig, undefined, docData.verticalLinks);
      for (const u of adjUpdates) {
        const adj = docData.elements.get(u.elementId);
        if (adj && isWireType(adj.type)) applyWireTypeUpdate(adj, u);
      }

      if (!isWireType(tool)) {
        uiStore.setSelection([id]);
      }
    });

    trackWireVPlacement(tool, row, col);
  }
}

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
