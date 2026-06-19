/**
 * useLadderDocument Hook
 *
 * Graph-first ladder document API built around:
 * - logic cells
 * - horizontal edges
 * - vertical edges
 * - derived topology cache
 */

import { useCallback, useMemo } from 'react';
import { useDocumentRegistry } from '../documentRegistry';
import { isLadderDocument } from '../../types/document';
import type {
  CompareProperties,
  ContactProperties,
  CoilProperties,
  CounterProperties,
  DerivedTopology,
  ElementProperties,
  GridPosition,
  HorizontalEdgeEntity,
  LadderElement,
  LadderElementType,
  LadderGridConfig,
  LadderNode,
  LadderProgramAST,
  LadderSelectionItem,
  TimerProperties,
  VerticalEdgeEntity,
  VerticalEdgePosition,
  VerticalLinkEntity,
  VerticalLinkPosition,
} from '../../types/ladder';
import {
  getVerticalLinkRowFromMainGridRow,
  isCompareType,
  isContactType,
  isCoilType,
  isCounterType,
  isLogicElement,
  isTimerType,
} from '../../types/ladder';
import { rebuildLadderTopologyCache, buildCellCoordKey, buildVerticalEdgeCoordKey, findHorizontalEdgeContainingCell } from '../../components/LadderEditor/utils/topologyBuilder';

export interface UseLadderDocumentReturn {
  elements: Map<string, LadderElement>;
  horizontalEdges: Map<string, HorizontalEdgeEntity>;
  verticalEdges: Map<string, VerticalEdgeEntity>;
  topologyCache?: DerivedTopology;
  comment?: string;
  gridConfig: LadderGridConfig;
  rungLabels: Map<number, string>;
  isDirty: boolean;

  placeCell: (type: LadderElementType, position: GridPosition, props?: Partial<LadderElement>) => string | null;
  placeHorizontalRun: (row: number, startBoundaryCol: number, endBoundaryCol: number) => string | null;
  toggleVerticalEdge: (gapRow: number, boundaryCol: number) => string | null;
  moveCell: (id: string, position: GridPosition) => void;
  moveVerticalEdge: (id: string, position: VerticalEdgePosition) => void;
  resizeHorizontalRun: (id: string, startBoundaryCol: number, endBoundaryCol: number) => void;
  deleteSelection: (selection: Iterable<string | LadderSelectionItem>) => void;
  rebuildTopology: () => void;

  addElement: (type: LadderElementType, position: GridPosition, props?: Partial<LadderElement>) => string | null;
  removeElement: (id: string) => void;
  moveElement: (id: string, position: GridPosition) => void;
  updateElement: (id: string, updates: Partial<LadderElement>) => void;
  duplicateElement: (id: string) => string | null;
  getElementAt: (row: number, col: number, typeFilter?: 'instruction') => LadderElement | undefined;

  addVerticalLink: (position: VerticalLinkPosition) => string | null;
  removeVerticalLink: (id: string) => void;
  moveVerticalLink: (id: string, position: VerticalLinkPosition) => void;
  getVerticalLinkAt: (row: number, col: number) => VerticalLinkEntity | undefined;
  placeVerticalLinkSpan: (col: number, startRow: number, endRow: number) => void;
  getHorizontalEdgeAt: (row: number, col: number) => HorizontalEdgeEntity | undefined;

  updateComment: (comment: string) => void;
  updateRungLabel: (row: number, label: string) => void;
  setGridConfig: (config: Partial<LadderGridConfig>) => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  pushHistory: (description?: string) => void;

  loadFromAST: (ast: LadderProgramAST) => void;
  exportToAST: () => LadderProgramAST | null;

  clearAll: () => void;
  markSaved: () => void;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function cloneElementDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getDefaultProperties(type: LadderElementType): ElementProperties {
  if (isContactType(type)) return {} as ContactProperties;
  if (isCoilType(type)) return {} as CoilProperties;
  if (isTimerType(type)) {
    return { presetTime: 1000, timeBase: 'ms' } as TimerProperties;
  }
  if (isCounterType(type)) {
    return { presetValue: 10 } as CounterProperties;
  }
  if (isCompareType(type)) {
    return { operator: '=', compareValue: 0 } as CompareProperties;
  }

  return {};
}

function isValidCellPosition(
  elements: Map<string, LadderElement>,
  position: GridPosition,
  gridConfig: LadderGridConfig,
  excludeId?: string,
): boolean {
  if (position.row < 0 || position.col < 0 || position.col >= gridConfig.columns) {
    return false;
  }

  for (const [id, element] of elements) {
    if (excludeId && id === excludeId) continue;
    if (element.position.row === position.row && element.position.col === position.col) {
      return false;
    }
  }

  return true;
}

function isValidVerticalEdgePosition(
  position: VerticalEdgePosition,
  gridConfig: LadderGridConfig,
): boolean {
  return position.row >= 0 && position.col >= 0 && position.col <= gridConfig.columns;
}

function isValidHorizontalRun(
  row: number,
  startBoundaryCol: number,
  endBoundaryCol: number,
  gridConfig: LadderGridConfig,
): boolean {
  if (row < 0) return false;
  if (startBoundaryCol < 0 || endBoundaryCol < 0) return false;
  if (startBoundaryCol > gridConfig.columns || endBoundaryCol > gridConfig.columns) return false;
  return startBoundaryCol !== endBoundaryCol;
}

function normalizeSelectionIds(selection: Iterable<string | LadderSelectionItem>): string[] {
  const ids: string[] = [];
  for (const item of selection) {
    ids.push(typeof item === 'string' ? item : item.id);
  }
  return ids;
}

function convertASTToElements(_nodes: LadderNode[]): LadderElement[] {
  return [];
}

function convertElementsToAST(_elements: Map<string, LadderElement>): LadderNode[] {
  return [];
}

export function useLadderDocument(documentId: string | null): UseLadderDocumentReturn | null {
  const document = useDocumentRegistry((state) =>
    documentId ? state.documents.get(documentId) : undefined,
  );
  const updateLadderData = useDocumentRegistry((state) => state.updateLadderData);
  const pushHistoryAction = useDocumentRegistry((state) => state.pushHistory);
  const undoAction = useDocumentRegistry((state) => state.undo);
  const redoAction = useDocumentRegistry((state) => state.redo);
  const canUndoCheck = useDocumentRegistry((state) => state.canUndo);
  const canRedoCheck = useDocumentRegistry((state) => state.canRedo);
  const markClean = useDocumentRegistry((state) => state.markClean);

  const ladderDoc = document && isLadderDocument(document) ? document : null;
  const data = ladderDoc?.data;

  const mutate = useCallback((description: string | undefined, mutator: (docData: NonNullable<typeof data>) => void) => {
    if (!documentId || !data) return;
    pushHistoryAction(documentId, description);
    updateLadderData(documentId, (docData) => {
      mutator(docData);
      docData.topologyCache = rebuildLadderTopologyCache(docData);
    });
  }, [data, documentId, pushHistoryAction, updateLadderData]);

  const rebuildTopology = useCallback(() => {
    if (!documentId || !data) return;
    updateLadderData(documentId, (docData) => {
      docData.topologyCache = rebuildLadderTopologyCache(docData);
    });
  }, [data, documentId, updateLadderData]);

  const getElementAt = useCallback((row: number, col: number): LadderElement | undefined => {
    if (!data) return undefined;
    const cache = data.topologyCache ?? rebuildLadderTopologyCache(data);
    const elementId = cache.cellsByCoord.get(buildCellCoordKey(row, col));
    return elementId ? data.elements.get(elementId) : undefined;
  }, [data]);

  const getHorizontalEdgeAt = useCallback((row: number, col: number): HorizontalEdgeEntity | undefined => {
    if (!data) return undefined;
    return findHorizontalEdgeContainingCell(data.horizontalEdges, row, col);
  }, [data]);

  const getVerticalLinkAt = useCallback((row: number, col: number): VerticalLinkEntity | undefined => {
    if (!data) return undefined;
    const cache = data.topologyCache ?? rebuildLadderTopologyCache(data);
    const edgeId = cache.verticalEdgesByCoord.get(buildVerticalEdgeCoordKey(row, col));
    return edgeId ? data.verticalEdges.get(edgeId) : undefined;
  }, [data]);

  const placeCell = useCallback((type: LadderElementType, position: GridPosition, props: Partial<LadderElement> = {}): string | null => {
    if (!data || !documentId) return null;
    if (!isLogicElement({ type, position, id: 'tmp', properties: {} } as LadderElement)) {
      return null;
    }
    if (!isValidCellPosition(data.elements, position, data.gridConfig)) {
      return null;
    }

    const id = generateId(type);
    const newElement: LadderElement = {
      id,
      type: type as LadderElement['type'],
      position: { ...position },
      properties: { ...getDefaultProperties(type), ...(props.properties ?? {}) },
      address: props.address,
      label: props.label,
      selected: false,
    } as LadderElement;

    mutate(`Place ${type}`, (docData) => {
      docData.elements.set(id, newElement);
    });

    return id;
  }, [data, documentId, mutate]);

  const placeHorizontalRun = useCallback((row: number, startBoundaryCol: number, endBoundaryCol: number): string | null => {
    if (!data || !documentId) return null;
    const start = Math.min(startBoundaryCol, endBoundaryCol);
    const end = Math.max(startBoundaryCol, endBoundaryCol);
    if (!isValidHorizontalRun(row, start, end, data.gridConfig)) {
      return null;
    }

    const id = generateId('h-edge');
    mutate('Place horizontal run', (docData) => {
      docData.horizontalEdges.set(id, {
        id,
        position: { row, startBoundaryCol: start, endBoundaryCol: end },
        properties: { isValid: true },
      });
    });
    return id;
  }, [data, documentId, mutate]);

  const toggleVerticalEdge = useCallback((gapRow: number, boundaryCol: number): string | null => {
    if (!data || !documentId) return null;
    const position = { row: gapRow, col: boundaryCol };
    if (!isValidVerticalEdgePosition(position, data.gridConfig)) {
      return null;
    }

    const existing = getVerticalLinkAt(gapRow, boundaryCol);
    if (existing) {
      mutate('Remove vertical edge', (docData) => {
        docData.verticalEdges.delete(existing.id);
      });
      return existing.id;
    }

    const id = generateId('v-edge');
    mutate('Place vertical edge', (docData) => {
      docData.verticalEdges.set(id, {
        id,
        position,
        properties: { isValid: true },
      });
    });
    return id;
  }, [data, documentId, getVerticalLinkAt, mutate]);

  const moveCell = useCallback((id: string, position: GridPosition) => {
    if (!data) return;
    if (!isValidCellPosition(data.elements, position, data.gridConfig, id)) {
      return;
    }
    mutate('Move cell', (docData) => {
      const element = docData.elements.get(id);
      if (element) {
        element.position = { ...position };
      }
    });
  }, [data, mutate]);

  const moveVerticalEdge = useCallback((id: string, position: VerticalEdgePosition) => {
    if (!data || !isValidVerticalEdgePosition(position, data.gridConfig)) return;
    mutate('Move vertical edge', (docData) => {
      const verticalEdge = docData.verticalEdges.get(id);
      if (verticalEdge) {
        verticalEdge.position = { ...position };
      }
    });
  }, [data, mutate]);

  const resizeHorizontalRun = useCallback((id: string, startBoundaryCol: number, endBoundaryCol: number) => {
    if (!data) return;
    const edge = data.horizontalEdges.get(id);
    if (!edge) return;
    const start = Math.min(startBoundaryCol, endBoundaryCol);
    const end = Math.max(startBoundaryCol, endBoundaryCol);
    if (!isValidHorizontalRun(edge.position.row, start, end, data.gridConfig)) return;

    mutate('Resize horizontal run', (docData) => {
      const current = docData.horizontalEdges.get(id);
      if (current) {
        current.position.startBoundaryCol = start;
        current.position.endBoundaryCol = end;
      }
    });
  }, [data, mutate]);

  const removeElement = useCallback((id: string) => {
    mutate('Remove ladder entity', (docData) => {
      docData.elements.delete(id);
      docData.horizontalEdges.delete(id);
      docData.verticalEdges.delete(id);
    });
  }, [mutate]);

  const deleteSelection = useCallback((selection: Iterable<string | LadderSelectionItem>) => {
    const ids = normalizeSelectionIds(selection);
    if (ids.length === 0) return;
    mutate(`Delete ${ids.length} ladder entities`, (docData) => {
      for (const id of ids) {
        docData.elements.delete(id);
        docData.horizontalEdges.delete(id);
        docData.verticalEdges.delete(id);
      }
    });
  }, [mutate]);

  const updateElement = useCallback((id: string, updates: Partial<LadderElement>) => {
    mutate('Update cell', (docData) => {
      const element = docData.elements.get(id);
      if (element) {
        Object.assign(element, updates);
      }
    });
  }, [mutate]);

  const duplicateElement = useCallback((id: string): string | null => {
    if (!data) return null;
    const element = data.elements.get(id);
    if (!element) return null;

    const candidatePositions: GridPosition[] = [
      { row: element.position.row, col: element.position.col + 1 },
      { row: element.position.row + 1, col: element.position.col },
      { row: element.position.row, col: element.position.col - 1 },
      { row: element.position.row - 1, col: element.position.col },
    ];
    const target = candidatePositions.find((position) => isValidCellPosition(data.elements, position, data.gridConfig));
    if (!target) return null;

    const duplicated = cloneElementDeep(element);
    duplicated.id = generateId(element.type);
    duplicated.position = target;
    duplicated.selected = false;

    mutate(`Duplicate ${element.type}`, (docData) => {
      docData.elements.set(duplicated.id, duplicated);
    });

    return duplicated.id;
  }, [data, mutate]);

  const addElement = useCallback((type: LadderElementType, position: GridPosition, props: Partial<LadderElement> = {}): string | null => {
    if (type === 'wire_h') {
      return placeHorizontalRun(position.row, position.col, position.col + 1);
    }
    if (type === 'wire_v') {
      return toggleVerticalEdge(getVerticalLinkRowFromMainGridRow(position.row), position.col);
    }

    return placeCell(type, position, props);
  }, [placeCell, placeHorizontalRun, toggleVerticalEdge]);

  const addVerticalLink = useCallback((position: VerticalLinkPosition): string | null => {
    if (!data || !documentId) return null;
    const existing = getVerticalLinkAt(position.row, position.col);
    if (existing) return existing.id;

    const id = generateId('v-edge');
    mutate('Place vertical edge', (docData) => {
      docData.verticalEdges.set(id, {
        id,
        position: { ...position },
        properties: { isValid: true },
      });
    });
    return id;
  }, [data, documentId, getVerticalLinkAt, mutate]);

  const removeVerticalLink = useCallback((id: string) => {
    mutate('Remove vertical edge', (docData) => {
      docData.verticalEdges.delete(id);
    });
  }, [mutate]);

  const moveVerticalLink = useCallback((id: string, position: VerticalLinkPosition) => {
    moveVerticalEdge(id, position);
  }, [moveVerticalEdge]);

  const placeVerticalLinkSpan = useCallback((col: number, startRow: number, endRow: number) => {
    if (!data || !documentId) return;
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    mutate('Place vertical span', (docData) => {
      for (let gapRow = minRow; gapRow <= maxRow; gapRow++) {
        const key = buildVerticalEdgeCoordKey(gapRow, col);
        if (docData.topologyCache?.verticalEdgesByCoord.get(key)) continue;
        const id = generateId('v-edge');
        docData.verticalEdges.set(id, {
          id,
          position: { row: gapRow, col },
          properties: { isValid: true },
        });
      }
    });
  }, [data, documentId, mutate]);

  const moveElement = useCallback((id: string, position: GridPosition) => {
    if (data?.elements.has(id)) {
      moveCell(id, position);
      return;
    }
    if (data?.verticalEdges.has(id)) {
      moveVerticalEdge(id, { row: position.row, col: position.col });
    }
  }, [data, moveCell, moveVerticalEdge]);

  const updateComment = useCallback((comment: string) => {
    mutate('Update ladder comment', (docData) => {
      docData.comment = comment;
    });
  }, [mutate]);

  const updateRungLabel = useCallback((row: number, label: string) => {
    mutate(`Update rung label ${row}`, (docData) => {
      if (label.trim() === '') {
        docData.rungLabels.delete(row);
      } else {
        docData.rungLabels.set(row, label);
      }
    });
  }, [mutate]);

  const setGridConfig = useCallback((config: Partial<LadderGridConfig>) => {
    if (!data) return;
    mutate('Update ladder grid config', (docData) => {
      docData.gridConfig = { ...docData.gridConfig, ...config };

      for (const [id, element] of docData.elements) {
        if (!isValidCellPosition(docData.elements, element.position, docData.gridConfig, id)) {
          docData.elements.delete(id);
        }
      }

      for (const [id, edge] of docData.horizontalEdges) {
        if (!isValidHorizontalRun(edge.position.row, edge.position.startBoundaryCol, edge.position.endBoundaryCol, docData.gridConfig)) {
          docData.horizontalEdges.delete(id);
        }
      }

      for (const [id, edge] of docData.verticalEdges) {
        if (!isValidVerticalEdgePosition(edge.position, docData.gridConfig)) {
          docData.verticalEdges.delete(id);
        }
      }
    });
  }, [data, mutate]);

  const pushHistory = useCallback((description?: string) => {
    if (!documentId) return;
    pushHistoryAction(documentId, description);
  }, [documentId, pushHistoryAction]);

  const loadFromAST = useCallback((ast: LadderProgramAST) => {
    if (!documentId) return;
    updateLadderData(documentId, (docData) => {
      const allElements: LadderElement[] = [];
      ast.networks.forEach((network) => {
        allElements.push(...convertASTToElements(network.nodes));
      });
      docData.elements = new Map(allElements.map((element) => [element.id, element]));
      docData.horizontalEdges = new Map();
      docData.verticalEdges = new Map();
      docData.comment = ast.networks[0]?.comment;
      docData.topologyCache = rebuildLadderTopologyCache(docData);
    });
  }, [documentId, updateLadderData]);

  const exportToAST = useCallback((): LadderProgramAST | null => {
    if (!data || data.elements.size === 0) return null;
    void convertElementsToAST(data.elements);
    return null;
  }, [data]);

  const undo = useCallback(() => {
    if (documentId) undoAction(documentId);
  }, [documentId, undoAction]);

  const redo = useCallback(() => {
    if (documentId) redoAction(documentId);
  }, [documentId, redoAction]);

  const canUndo = documentId ? canUndoCheck(documentId) : false;
  const canRedo = documentId ? canRedoCheck(documentId) : false;

  const clearAll = useCallback(() => {
    mutate('Clear ladder document', (docData) => {
      docData.elements = new Map();
      docData.horizontalEdges = new Map();
      docData.verticalEdges = new Map();
      docData.comment = undefined;
      docData.rungLabels = new Map();
    });
  }, [mutate]);

  const markSavedCallback = useCallback(() => {
    if (documentId) {
      markClean(documentId);
    }
  }, [documentId, markClean]);

  return useMemo(() => {
    if (!ladderDoc || !data) return null;
    const topologyCache = data.topologyCache ?? rebuildLadderTopologyCache(data);

    return {
      elements: data.elements,
      horizontalEdges: data.horizontalEdges,
      verticalEdges: data.verticalEdges,
      topologyCache,
      comment: data.comment,
      rungLabels: data.rungLabels,
      gridConfig: data.gridConfig,
      isDirty: ladderDoc.isDirty,
      placeCell,
      placeHorizontalRun,
      toggleVerticalEdge,
      moveCell,
      moveVerticalEdge,
      resizeHorizontalRun,
      deleteSelection,
      rebuildTopology,
      addElement,
      removeElement,
      moveElement,
      updateElement,
      duplicateElement,
      getElementAt,
      addVerticalLink,
      removeVerticalLink,
      moveVerticalLink,
      getVerticalLinkAt,
      placeVerticalLinkSpan,
      getHorizontalEdgeAt,
      updateComment,
      updateRungLabel,
      setGridConfig,
      undo,
      redo,
      canUndo,
      canRedo,
      pushHistory,
      loadFromAST,
      exportToAST,
      clearAll,
      markSaved: markSavedCallback,
    };
  }, [
    addElement,
    addVerticalLink,
    canRedo,
    canUndo,
    clearAll,
    data,
    deleteSelection,
    duplicateElement,
    exportToAST,
    getElementAt,
    getHorizontalEdgeAt,
    getVerticalLinkAt,
    ladderDoc,
    loadFromAST,
    markSavedCallback,
    moveCell,
    moveElement,
    moveVerticalEdge,
    moveVerticalLink,
    placeCell,
    placeHorizontalRun,
    placeVerticalLinkSpan,
    pushHistory,
    rebuildTopology,
    redo,
    removeElement,
    removeVerticalLink,
    resizeHorizontalRun,
    setGridConfig,
    toggleVerticalEdge,
    undo,
    updateComment,
    updateElement,
    updateRungLabel,
  ]);
}
