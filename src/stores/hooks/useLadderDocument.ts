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
  LadderNetwork,
  LadderGridConfig,
  GridPosition,
  ElementProperties,
  ContactProperties,
  CoilProperties,
  TimerProperties,
  CounterProperties,
  CompareProperties,
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
  networks: Map<string, LadderNetwork>;
  currentNetworkId: string | null;
  currentNetwork: LadderNetwork | null;
  gridConfig: LadderGridConfig;
  isDirty: boolean;

  // Network operations
  addNetwork: (label?: string) => string;
  removeNetwork: (id: string) => void;
  selectNetwork: (id: string) => void;
  updateNetwork: (id: string, updates: Partial<Pick<LadderNetwork, 'label' | 'comment' | 'enabled'>>) => void;

  // Element operations
  addElement: (type: LadderElementType, position: GridPosition, props?: Partial<LadderElement>) => string | null;
  removeElement: (id: string) => void;
  moveElement: (id: string, position: GridPosition) => void;
  updateElement: (id: string, updates: Partial<LadderElement>) => void;

  // Grid configuration
  setGridConfig: (config: Partial<LadderGridConfig>) => void;

  // History operations
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

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

/** Create an empty network */
function createEmptyNetwork(id: string, label?: string): LadderNetwork {
  return {
    id,
    label: label || `Network ${id.slice(-4)}`,
    elements: new Map(),
    wires: [],
    enabled: true,
  };
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
  network: LadderNetwork,
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

  for (const [id, element] of network.elements) {
    if (excludeId && id === excludeId) continue;
    if (element.position.row === position.row && element.position.col === position.col) {
      return false;
    }
  }

  return true;
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
  const pushHistory = useDocumentRegistry((state) => state.pushHistory);
  const undoAction = useDocumentRegistry((state) => state.undo);
  const redoAction = useDocumentRegistry((state) => state.redo);
  const canUndoCheck = useDocumentRegistry((state) => state.canUndo);
  const canRedoCheck = useDocumentRegistry((state) => state.canRedo);
  const markClean = useDocumentRegistry((state) => state.markClean);

  // Early return if no document or wrong type
  const ladderDoc = document && isLadderDocument(document) ? document : null;
  const data = ladderDoc?.data;

  // Network operations
  const addNetwork = useCallback(
    (label?: string): string => {
      if (!documentId) return '';

      const id = generateId('network');
      const newNetwork = createEmptyNetwork(id, label);

      pushHistory(documentId);
      updateLadderData(documentId, (docData) => {
        docData.networks.set(id, newNetwork);
        docData.currentNetworkId = id;
      });

      return id;
    },
    [documentId, pushHistory, updateLadderData]
  );

  const removeNetwork = useCallback(
    (id: string) => {
      if (!documentId || !data) return;
      if (data.networks.size <= 1) return; // Keep at least one

      pushHistory(documentId);
      updateLadderData(documentId, (docData) => {
        docData.networks.delete(id);

        if (docData.currentNetworkId === id) {
          const remainingIds = Array.from(docData.networks.keys());
          docData.currentNetworkId = remainingIds[0] ?? null;
        }
      });
    },
    [documentId, data, pushHistory, updateLadderData]
  );

  const selectNetwork = useCallback(
    (id: string) => {
      if (!documentId || !data) return;
      if (!data.networks.has(id)) return;

      updateLadderData(documentId, (docData) => {
        docData.currentNetworkId = id;
      });
    },
    [documentId, data, updateLadderData]
  );

  const updateNetwork = useCallback(
    (id: string, updates: Partial<Pick<LadderNetwork, 'label' | 'comment' | 'enabled'>>) => {
      if (!documentId || !data) return;

      pushHistory(documentId);
      updateLadderData(documentId, (docData) => {
        const network = docData.networks.get(id);
        if (network) {
          if (updates.label !== undefined) network.label = updates.label;
          if (updates.comment !== undefined) network.comment = updates.comment;
          if (updates.enabled !== undefined) network.enabled = updates.enabled;
        }
      });
    },
    [documentId, data, pushHistory, updateLadderData]
  );

  // Element operations
  const addElement = useCallback(
    (type: LadderElementType, position: GridPosition, props: Partial<LadderElement> = {}): string | null => {
      if (!documentId || !data || !data.currentNetworkId) return null;

      const network = data.networks.get(data.currentNetworkId);
      if (!network) return null;

      if (!isValidPosition(network, position, data.gridConfig)) {
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

      pushHistory(documentId);
      updateLadderData(documentId, (docData) => {
        const currentNetwork = docData.networks.get(docData.currentNetworkId!);
        if (currentNetwork) {
          currentNetwork.elements.set(id, newElement);
        }
      });

      return id;
    },
    [documentId, data, pushHistory, updateLadderData]
  );

  const removeElement = useCallback(
    (id: string) => {
      if (!documentId || !data || !data.currentNetworkId) return;

      pushHistory(documentId);
      updateLadderData(documentId, (docData) => {
        const network = docData.networks.get(docData.currentNetworkId!);
        if (network) {
          network.elements.delete(id);
          // Remove connected wires
          network.wires = network.wires.filter(
            (wire) => wire.from.elementId !== id && wire.to.elementId !== id
          );
        }
      });
    },
    [documentId, data, pushHistory, updateLadderData]
  );

  const moveElement = useCallback(
    (id: string, position: GridPosition) => {
      if (!documentId || !data || !data.currentNetworkId) return;

      const network = data.networks.get(data.currentNetworkId);
      if (!network) return;

      if (!isValidPosition(network, position, data.gridConfig, id)) {
        return;
      }

      pushHistory(documentId);
      updateLadderData(documentId, (docData) => {
        const currentNetwork = docData.networks.get(docData.currentNetworkId!);
        const element = currentNetwork?.elements.get(id);
        if (element) {
          element.position = { ...position };
        }
      });
    },
    [documentId, data, pushHistory, updateLadderData]
  );

  const updateElement = useCallback(
    (id: string, updates: Partial<LadderElement>) => {
      if (!documentId || !data || !data.currentNetworkId) return;

      pushHistory(documentId);
      updateLadderData(documentId, (docData) => {
        const network = docData.networks.get(docData.currentNetworkId!);
        const element = network?.elements.get(id);
        if (element) {
          Object.assign(element, updates);
        }
      });
    },
    [documentId, data, pushHistory, updateLadderData]
  );

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

    pushHistory(documentId);
    updateLadderData(documentId, (docData) => {
      const newNetwork = createEmptyNetwork(generateId('network'), 'Network 1');
      docData.networks = new Map([[newNetwork.id, newNetwork]]);
      docData.currentNetworkId = newNetwork.id;
    });
  }, [documentId, pushHistory, updateLadderData]);

  const markSavedCallback = useCallback(() => {
    if (documentId) markClean(documentId);
  }, [documentId, markClean]);

  // Compute current network
  const currentNetwork = useMemo(() => {
    if (!data || !data.currentNetworkId) return null;
    return data.networks.get(data.currentNetworkId) ?? null;
  }, [data]);

  // Return memoized result
  return useMemo(() => {
    if (!ladderDoc || !data) return null;

    return {
      // Data
      networks: data.networks,
      currentNetworkId: data.currentNetworkId,
      currentNetwork,
      gridConfig: data.gridConfig,
      isDirty: ladderDoc.isDirty,

      // Network operations
      addNetwork,
      removeNetwork,
      selectNetwork,
      updateNetwork,

      // Element operations
      addElement,
      removeElement,
      moveElement,
      updateElement,

      // Grid configuration
      setGridConfig,

      // History operations
      undo,
      redo,
      canUndo,
      canRedo,

      // Utility
      clearAll,
      markSaved: markSavedCallback,
    };
  }, [
    ladderDoc,
    data,
    currentNetwork,
    addNetwork,
    removeNetwork,
    selectNetwork,
    updateNetwork,
    addElement,
    removeElement,
    moveElement,
    updateElement,
    setGridConfig,
    undo,
    redo,
    canUndo,
    canRedo,
    clearAll,
    markSavedCallback,
  ]);
}

export default useLadderDocument;
