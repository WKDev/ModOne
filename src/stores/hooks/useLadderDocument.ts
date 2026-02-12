/**
 * useLadderDocument Hook
 *
 * Provides ladder-specific operations for a document in the registry.
 * This hook bridges the documentRegistry with ladder editor UI components.
 */

import { useCallback, useMemo } from 'react';
import { useDocumentRegistry } from '../documentRegistry';
import { isLadderDocument } from '../../types/document';
import type {
  LadderElement,
  LadderElementType,
  LadderGridConfig,
  GridPosition,
  LadderProgramAST,
  LadderNetworkAST,
  LadderNode,
  ElementProperties,
  ContactProperties,
  CoilProperties,
  TimerProperties,
  CounterProperties,
  CompareProperties,
  LadderWire,
} from '../../types/ladder';
import {
  isContactType,
  isCoilType,
  isTimerType,
  isCounterType,
  isCompareType,
} from '../../types/ladder';

// ============================================================================
// Types
// ============================================================================

/** Return type for useLadderDocument hook */
export interface UseLadderDocumentReturn {
  // Data
  elements: Map<string, LadderElement>;
  wires: LadderWire[];
  comment?: string;
  gridConfig: LadderGridConfig;
  isDirty: boolean;

  // Element operations
  addElement: (type: LadderElementType, position: GridPosition, props?: Partial<LadderElement>) => string | null;
  removeElement: (id: string) => void;
  moveElement: (id: string, position: GridPosition) => void;
  updateElement: (id: string, updates: Partial<LadderElement>) => void;
  duplicateElement: (id: string) => string | null;
  getElementAt: (row: number, col: number) => LadderElement | undefined;

  // Comment
  updateComment: (comment: string) => void;

  // Grid configuration
  setGridConfig: (config: Partial<LadderGridConfig>) => void;

  // History operations
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  pushHistory: (description?: string) => void;

  // AST integration
  loadFromAST: (ast: LadderProgramAST) => void;
  exportToAST: () => LadderProgramAST | null;

  // Utility
  clearAll: () => void;
  markSaved: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Generate unique ID */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Deep clone a ladder element */
function cloneElementDeep(element: LadderElement): LadderElement {
  return JSON.parse(JSON.stringify(element)) as LadderElement;
}

/** Get default properties for an element type */
function getDefaultProperties(type: LadderElementType): ElementProperties {
  if (isContactType(type)) {
    return {} as ContactProperties;
  }
  if (isCoilType(type)) {
    return {} as CoilProperties;
  }
  if (isTimerType(type)) {
    return {
      presetTime: 1000,
      timeBase: 'ms',
    } as TimerProperties;
  }
  if (isCounterType(type)) {
    return {
      presetValue: 10,
    } as CounterProperties;
  }
  if (isCompareType(type)) {
    return {
      operator: '=',
      compareValue: 0,
    } as CompareProperties;
  }
  return {};
}

/** Check if a position is valid */
function isValidPosition(
  elements: Map<string, LadderElement>,
  position: GridPosition,
  gridConfig: LadderGridConfig,
  excludeId?: string
): boolean {
  if (position.col < 0 || position.col >= gridConfig.columns) {
    return false;
  }
  if (position.row < 0) {
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

/** Convert AST nodes to ladder elements (stub - full implementation in Task 79) */
function convertASTToElements(_nodes: LadderNode[], _networkId: string): LadderElement[] {
  return [];
}

/** Convert ladder elements to AST (stub - full implementation in Task 80) */
function convertElementsToAST(_elements: Map<string, LadderElement>, _wires: LadderWire[]): LadderNode[] {
  return [];
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for accessing and manipulating ladder document state.
 *
 * @param documentId - The document ID to operate on
 * @returns Ladder document state and operations, or null if document not found
 */
export function useLadderDocument(documentId: string | null): UseLadderDocumentReturn | null {
  const document = useDocumentRegistry((state) =>
    documentId ? state.documents.get(documentId) : undefined
  );
  const updateLadderData = useDocumentRegistry((state) => state.updateLadderData);
  const pushHistoryAction = useDocumentRegistry((state) => state.pushHistory);
  const undoAction = useDocumentRegistry((state) => state.undo);
  const redoAction = useDocumentRegistry((state) => state.redo);
  const canUndoCheck = useDocumentRegistry((state) => state.canUndo);
  const canRedoCheck = useDocumentRegistry((state) => state.canRedo);
  const markClean = useDocumentRegistry((state) => state.markClean);

  // Early return if no document or wrong type
  const ladderDoc = document && isLadderDocument(document) ? document : null;
  const data = ladderDoc?.data;

  // Element operations
  const addElement = useCallback(
    (type: LadderElementType, position: GridPosition, props: Partial<LadderElement> = {}): string | null => {
      if (!documentId || !data) return null;

      if (!isValidPosition(data.elements, position, data.gridConfig)) {
        return null;
      }

      const id = generateId(type);
      const newElement: LadderElement = {
        id,
        type,
        position: { ...position },
        properties: getDefaultProperties(type),
        ...props,
      } as LadderElement;

      pushHistoryAction(documentId);
      updateLadderData(documentId, (docData) => {
        docData.elements.set(id, newElement);
      });

      return id;
    },
    [documentId, data, pushHistoryAction, updateLadderData]
  );

  const duplicateElement = useCallback(
    (id: string): string | null => {
      if (!documentId || !data) return null;

      const element = data.elements.get(id);
      if (!element) return null;

      const candidatePositions: GridPosition[] = [
        { row: element.position.row, col: element.position.col + 1 },
        { row: element.position.row + 1, col: element.position.col },
        { row: element.position.row, col: element.position.col - 1 },
        { row: element.position.row - 1, col: element.position.col },
        { row: element.position.row + 1, col: element.position.col + 1 },
        { row: element.position.row + 1, col: element.position.col - 1 },
        { row: element.position.row - 1, col: element.position.col + 1 },
        { row: element.position.row - 1, col: element.position.col - 1 },
      ];

      const availablePosition = candidatePositions.find((position) =>
        isValidPosition(data.elements, position, data.gridConfig)
      );
      if (!availablePosition) return null;

      const newId = generateId(element.type);
      const newElement = cloneElementDeep(element);
      newElement.id = newId;
      newElement.position = { ...availablePosition };
      newElement.selected = false;

      pushHistoryAction(documentId, `Duplicate ${element.type}`);
      updateLadderData(documentId, (docData) => {
        docData.elements.set(newId, newElement);
      });

      return newId;
    },
    [documentId, data, pushHistoryAction, updateLadderData]
  );

  const getElementAt = useCallback(
    (row: number, col: number): LadderElement | undefined => {
      if (!data) return undefined;

      for (const element of data.elements.values()) {
        if (element.position.row === row && element.position.col === col) {
          return element;
        }
      }

      return undefined;
    },
    [data]
  );

  const removeElement = useCallback(
    (id: string) => {
      if (!documentId || !data) return;

      pushHistoryAction(documentId);
      updateLadderData(documentId, (docData) => {
        docData.elements.delete(id);
        // Remove connected wires
        docData.wires = docData.wires.filter(
          (wire) => wire.from.elementId !== id && wire.to.elementId !== id
        );
      });
    },
    [documentId, data, pushHistoryAction, updateLadderData]
  );

  const moveElement = useCallback(
    (id: string, position: GridPosition) => {
      if (!documentId || !data) return;

      if (!isValidPosition(data.elements, position, data.gridConfig, id)) {
        return;
      }

      pushHistoryAction(documentId);
      updateLadderData(documentId, (docData) => {
        const element = docData.elements.get(id);
        if (element) {
          element.position = { ...position };
        }
      });
    },
    [documentId, data, pushHistoryAction, updateLadderData]
  );

  const updateElement = useCallback(
    (id: string, updates: Partial<LadderElement>) => {
      if (!documentId || !data) return;

      pushHistoryAction(documentId);
      updateLadderData(documentId, (docData) => {
        const element = docData.elements.get(id);
        if (element) {
          Object.assign(element, updates);
        }
      });
    },
    [documentId, data, pushHistoryAction, updateLadderData]
  );

  // Comment
  const updateComment = useCallback(
    (comment: string) => {
      if (!documentId) return;

      pushHistoryAction(documentId);
      updateLadderData(documentId, (docData) => {
        docData.comment = comment;
      });
    },
    [documentId, pushHistoryAction, updateLadderData]
  );

  const pushHistory = useCallback(
    (description?: string) => {
      if (!documentId) return;
      pushHistoryAction(documentId, description);
    },
    [documentId, pushHistoryAction]
  );

  const loadFromAST = useCallback(
    (ast: LadderProgramAST) => {
      if (!documentId) return;

      useDocumentRegistry.setState((state) => {
        const doc = state.documents.get(documentId);
        if (!doc || !isLadderDocument(doc)) return;

        doc.history = [];
        doc.historyIndex = -1;
      });

      updateLadderData(documentId, (docData) => {
        const allElements: LadderElement[] = [];

        ast.networks.forEach((astNetwork) => {
          const elements = convertASTToElements(astNetwork.nodes, astNetwork.id ?? '');
          allElements.push(...elements);
        });

        const newElements = new Map<string, LadderElement>();
        allElements.forEach((element) => {
          newElements.set(element.id, element);
        });

        docData.elements = newElements;
        docData.wires = [];
        docData.comment = ast.networks[0]?.comment;
      });
    },
    [documentId, updateLadderData]
  );

  const exportToAST = useCallback((): LadderProgramAST | null => {
    if (!data || data.elements.size === 0) return null;

    const nodes: LadderNode[] = convertElementsToAST(data.elements, data.wires);
    const networks: LadderNetworkAST[] = [
      {
        id: 'main',
        step: 1,
        nodes,
        comment: data.comment,
      },
    ];

    void networks;

    return null;
  }, [data]);

  // Grid configuration
  const setGridConfig = useCallback(
    (config: Partial<LadderGridConfig>) => {
      if (!documentId) return;

      updateLadderData(documentId, (docData) => {
        docData.gridConfig = { ...docData.gridConfig, ...config };
      });
    },
    [documentId, updateLadderData]
  );

  // History operations
  const undo = useCallback(() => {
    if (documentId) undoAction(documentId);
  }, [documentId, undoAction]);

  const redo = useCallback(() => {
    if (documentId) redoAction(documentId);
  }, [documentId, redoAction]);

  const canUndo = documentId ? canUndoCheck(documentId) : false;
  const canRedo = documentId ? canRedoCheck(documentId) : false;

  // Utility
  const clearAll = useCallback(() => {
    if (!documentId) return;

    pushHistoryAction(documentId);
    updateLadderData(documentId, (docData) => {
      docData.elements = new Map();
      docData.wires = [];
      docData.comment = undefined;
    });
  }, [documentId, pushHistoryAction, updateLadderData]);

  const markSavedCallback = useCallback(() => {
    if (documentId) markClean(documentId);
  }, [documentId, markClean]);

  // Return memoized result
  return useMemo(() => {
    if (!ladderDoc || !data) return null;

    return {
      // Data
      elements: data.elements,
      wires: data.wires,
      comment: data.comment,
      gridConfig: data.gridConfig,
      isDirty: ladderDoc.isDirty,

      // Element operations
      addElement,
      removeElement,
      moveElement,
      updateElement,
      duplicateElement,
      getElementAt,

      // Comment
      updateComment,

      // Grid configuration
      setGridConfig,

      // History operations
      undo,
      redo,
      canUndo,
      canRedo,
      pushHistory,

      // AST integration
      loadFromAST,
      exportToAST,

      // Utility
      clearAll,
      markSaved: markSavedCallback,
    };
  }, [
    ladderDoc,
    data,
    addElement,
    duplicateElement,
    getElementAt,
    removeElement,
    moveElement,
    updateElement,
    updateComment,
    setGridConfig,
    undo,
    redo,
    canUndo,
    canRedo,
    pushHistory,
    loadFromAST,
    exportToAST,
    clearAll,
    markSavedCallback,
  ]);
}

export default useLadderDocument;
