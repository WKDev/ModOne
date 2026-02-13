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
  isWireType,
} from '../../types/ladder';
import {
  resolveWireElementType,
  updateAdjacentWires,
  recalculateWireType,
  applyWireTypeUpdate,
  recalculateAllWireTypes,
  mergeWireDirections,
} from '../../components/LadderEditor/utils/wireGenerator';
import type { WireProperties } from '../../types/ladder';

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

  // Wire-specific operations
  mergeWireElement: (existingId: string, newWireType: 'wire_h' | 'wire_v') => void;
  placeVerticalWireSpan: (col: number, startRow: number, endRow: number) => void;

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

      // Phase 1.7: Auto-resolve wire type based on neighbors
      let resolvedType = type;
      let wireDirection: string | undefined;
      if (type === 'wire_h' || type === 'wire_v') {
        const resolved = resolveWireElementType(position, type, data.elements, data.gridConfig);
        resolvedType = resolved.type;
        wireDirection = resolved.direction;
      }

      const id = generateId(resolvedType);
      const defaultProps = getDefaultProperties(resolvedType);
      const finalProperties = wireDirection
        ? { ...defaultProps, direction: wireDirection } as WireProperties
        : defaultProps;

      const newElement: LadderElement = {
        id,
        type: resolvedType,
        position: { ...position },
        properties: finalProperties,
        ...props,
      } as LadderElement;

      pushHistoryAction(documentId);
      updateLadderData(documentId, (docData) => {
        // Add the new element
        docData.elements.set(id, newElement);

        // Auto-update adjacent wire elements
        const adjacentUpdates = updateAdjacentWires(position, docData.elements, docData.gridConfig);
        for (const update of adjacentUpdates) {
          const adjElement = docData.elements.get(update.elementId);
          if (adjElement && isWireType(adjElement.type)) {
            applyWireTypeUpdate(adjElement, update);
          }
        }
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

        // Recalculate the duplicated element's own wire type at its new position
        const selfUpdate = recalculateWireType(newElement, docData.elements, docData.gridConfig);
        if (selfUpdate) {
          applyWireTypeUpdate(newElement, selfUpdate);
        }

        // Auto-update adjacent wire elements after duplication
        const adjacentUpdates = updateAdjacentWires(availablePosition, docData.elements, docData.gridConfig);
        for (const update of adjacentUpdates) {
          const adjElement = docData.elements.get(update.elementId);
          if (adjElement && isWireType(adjElement.type)) {
            applyWireTypeUpdate(adjElement, update);
          }
        }
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

      // Phase 1.8: Record position before deletion for adjacent wire updates
      const elementToRemove = data.elements.get(id);
      const removedPosition = elementToRemove ? { ...elementToRemove.position } : null;

      pushHistoryAction(documentId);
      updateLadderData(documentId, (docData) => {
        docData.elements.delete(id);
        // Remove connected wires
        docData.wires = docData.wires.filter(
          (wire) => wire.from.elementId !== id && wire.to.elementId !== id
        );

        // Auto-update adjacent wire elements after deletion
        if (removedPosition) {
          const adjacentUpdates = updateAdjacentWires(removedPosition, docData.elements, docData.gridConfig);
          for (const update of adjacentUpdates) {
            const adjElement = docData.elements.get(update.elementId);
            if (adjElement && isWireType(adjElement.type)) {
              applyWireTypeUpdate(adjElement, update);
            }
          }
        }
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

      // Record the old position before moving for adjacent wire updates
      const elementToMove = data.elements.get(id);
      const oldPosition = elementToMove ? { ...elementToMove.position } : null;

      pushHistoryAction(documentId);
      updateLadderData(documentId, (docData) => {
        const element = docData.elements.get(id);
        if (element) {
          element.position = { ...position };

          // Recalculate the moved element's own wire type at its new position
          const selfUpdate = recalculateWireType(element, docData.elements, docData.gridConfig);
          if (selfUpdate) {
            applyWireTypeUpdate(element, selfUpdate);
          }

          // Update adjacent wires around the OLD position (now vacated)
          if (oldPosition) {
            const oldUpdates = updateAdjacentWires(oldPosition, docData.elements, docData.gridConfig);
            for (const update of oldUpdates) {
              const adjElement = docData.elements.get(update.elementId);
              if (adjElement && isWireType(adjElement.type)) {
                applyWireTypeUpdate(adjElement, update);
              }
            }
          }

          // Update adjacent wires around the NEW position (now occupied)
          const newUpdates = updateAdjacentWires(position, docData.elements, docData.gridConfig);
          for (const update of newUpdates) {
            const adjElement = docData.elements.get(update.elementId);
            if (adjElement && isWireType(adjElement.type)) {
              applyWireTypeUpdate(adjElement, update);
            }
          }
        }
      });
    },
    [documentId, data, pushHistoryAction, updateLadderData]
  );

  const updateElement = useCallback(
    (id: string, updates: Partial<LadderElement>) => {
      if (!documentId || !data) return;

      // Record old position before update for wire recalculation
      const currentElement = data.elements.get(id);
      const oldPosition = currentElement?.position ? { ...currentElement.position } : null;

      pushHistoryAction(documentId);
      updateLadderData(documentId, (docData) => {
        const element = docData.elements.get(id);
        if (element) {
          const oldType = element.type;
          Object.assign(element, updates);

          const typeChanged = updates.type && updates.type !== oldType;
          const positionChanged = updates.position && oldPosition &&
            (updates.position.row !== oldPosition.row || updates.position.col !== oldPosition.col);

          // If element type or position changed, recalculate adjacent wires
          if (typeChanged || positionChanged) {
            // Update wires around old position if position changed
            if (positionChanged && oldPosition) {
              const oldUpdates = updateAdjacentWires(oldPosition, docData.elements, docData.gridConfig);
              for (const update of oldUpdates) {
                const adjElement = docData.elements.get(update.elementId);
                if (adjElement && isWireType(adjElement.type)) {
                  applyWireTypeUpdate(adjElement, update);
                }
              }
            }

            // Update wires around current position
            const adjacentUpdates = updateAdjacentWires(element.position, docData.elements, docData.gridConfig);
            for (const update of adjacentUpdates) {
              const adjElement = docData.elements.get(update.elementId);
              if (adjElement && isWireType(adjElement.type)) {
                applyWireTypeUpdate(adjElement, update);
              }
            }

            // Recalculate the element's own wire type if it's a wire
            const selfUpdate = recalculateWireType(element, docData.elements, docData.gridConfig);
            if (selfUpdate) {
              applyWireTypeUpdate(element, selfUpdate);
            }
          }
        }
      });
    },
    [documentId, data, pushHistoryAction, updateLadderData]
  );

  // Wire-specific operations

  /**
   * Merge a new wire type onto an existing wire element.
   * When placing wire_v on wire_h → creates junction/cross.
   */
  const mergeWireElement = useCallback(
    (existingId: string, newWireType: 'wire_h' | 'wire_v') => {
      if (!documentId || !data) return;

      const existing = data.elements.get(existingId);
      if (!existing || !isWireType(existing.type)) return;

      pushHistoryAction(documentId, `Merge ${newWireType} onto ${existing.type}`);
      updateLadderData(documentId, (docData) => {
        const el = docData.elements.get(existingId);
        if (!el) return;

        // Merge directions: existing + new tool + neighbors
        const mergeUpdate = mergeWireDirections(el, newWireType, docData.elements, docData.gridConfig);
        if (mergeUpdate) {
          applyWireTypeUpdate(el, mergeUpdate);
        }

        // Update adjacent wires after merge
        const adjacentUpdates = updateAdjacentWires(el.position, docData.elements, docData.gridConfig);
        for (const update of adjacentUpdates) {
          const adjElement = docData.elements.get(update.elementId);
          if (adjElement && isWireType(adjElement.type)) {
            applyWireTypeUpdate(adjElement, update);
          }
        }
      });
    },
    [documentId, data, pushHistoryAction, updateLadderData]
  );

  /**
   * Place vertical wire spanning multiple rows.
   * Auto-merges with existing wire elements at each cell.
   * Creates junctions at endpoints where vertical meets horizontal.
   */
  const placeVerticalWireSpan = useCallback(
    (col: number, startRow: number, endRow: number) => {
      if (!documentId || !data) return;

      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      if (minRow === maxRow) return; // Need at least 2 rows

      pushHistoryAction(documentId, `Place vertical wire span row ${minRow}-${maxRow} col ${col}`);
      updateLadderData(documentId, (docData) => {
        const placedPositions: GridPosition[] = [];

        for (let row = minRow; row <= maxRow; row++) {
          const position: GridPosition = { row, col };

          // Check if cell is occupied
          let existingElement: LadderElement | undefined;
          for (const el of docData.elements.values()) {
            if (el.position.row === row && el.position.col === col) {
              existingElement = el;
              break;
            }
          }

          if (existingElement) {
            if (isWireType(existingElement.type)) {
              // Merge wire_v onto existing wire element (auto-junction)
              const mergeUpdate = mergeWireDirections(
                existingElement, 'wire_v', docData.elements, docData.gridConfig
              );
              if (mergeUpdate) {
                applyWireTypeUpdate(existingElement, mergeUpdate);
              }
              placedPositions.push(position);
            }
            // Non-wire element: skip (can't overwrite contacts/coils)
          } else {
            // Empty cell: place wire_v
            if (col >= 0 && col < docData.gridConfig.columns && row >= 0) {
              const resolved = resolveWireElementType(
                position, 'wire_v', docData.elements, docData.gridConfig
              );
              const id = generateId(resolved.type);
              const props = resolved.direction
                ? { direction: resolved.direction } as WireProperties
                : {} as WireProperties;

              const newElement: LadderElement = {
                id,
                type: resolved.type,
                position: { ...position },
                properties: props,
              } as LadderElement;

              docData.elements.set(id, newElement);
              placedPositions.push(position);
            }
          }
        }

        // After all elements placed/merged, recalculate all affected wires
        for (const pos of placedPositions) {
          // Recalculate self
          for (const el of docData.elements.values()) {
            if (el.position.row === pos.row && el.position.col === pos.col && isWireType(el.type)) {
              const selfUpdate = recalculateWireType(el, docData.elements, docData.gridConfig);
              if (selfUpdate) {
                applyWireTypeUpdate(el, selfUpdate);
              }
              break;
            }
          }
          // Update adjacent wires
          const adjacentUpdates = updateAdjacentWires(pos, docData.elements, docData.gridConfig);
          for (const update of adjacentUpdates) {
            const adjElement = docData.elements.get(update.elementId);
            if (adjElement && isWireType(adjElement.type)) {
              applyWireTypeUpdate(adjElement, update);
            }
          }
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

        // Recalculate all wire types based on neighbors after bulk load
        recalculateAllWireTypes(docData.elements, docData.gridConfig);
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
        const oldColumns = docData.gridConfig.columns;
        docData.gridConfig = { ...docData.gridConfig, ...config };
        const newColumns = docData.gridConfig.columns;

        // If columns shrunk, remove elements beyond new boundary and recalculate wires
        if (newColumns < oldColumns) {
          const toRemove: string[] = [];
          for (const [elId, el] of docData.elements) {
            if (el.position.col >= newColumns) {
              toRemove.push(elId);
            }
          }
          if (toRemove.length > 0) {
            for (const elId of toRemove) {
              docData.elements.delete(elId);
            }
            // Recalculate wire types for elements near the new boundary
            recalculateAllWireTypes(docData.elements, docData.gridConfig);
          }
        }
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

      // Wire-specific operations
      mergeWireElement,
      placeVerticalWireSpan,

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
    mergeWireElement,
    placeVerticalWireSpan,
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
