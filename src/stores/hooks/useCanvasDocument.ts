/**
 * useCanvasDocument Hook
 *
 * Provides canvas-specific operations for a document in the registry.
 * This hook bridges the documentRegistry with canvas UI components,
 * exposing the same API as useCanvasStore but operating on document-specific state.
 */

import { useCallback, useMemo } from 'react';
import { useDocumentRegistry } from '../documentRegistry';
import { isCanvasDocument } from '../../types/document';
import type {
  Block,
  BlockType,
  Wire,
  WireEndpoint,
  Position,
  CircuitMetadata,
} from '../../components/OneCanvas/types';

// ============================================================================
// Types
// ============================================================================

/** Wire drawing state */
export interface WireDrawingState {
  from: WireEndpoint;
  tempPosition: Position;
}

/** Canvas tool type */
export type CanvasTool = 'select' | 'wire' | 'pan';

/** Return type for useCanvasDocument hook */
export interface UseCanvasDocumentReturn {
  // Data
  components: Map<string, Block>;
  wires: Wire[];
  metadata: CircuitMetadata;
  zoom: number;
  pan: Position;
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;
  isDirty: boolean;

  // Component operations
  addComponent: (type: BlockType, position: Position, props?: Partial<Block>) => string;
  removeComponent: (id: string) => void;
  updateComponent: (id: string, updates: Partial<Block>) => void;
  moveComponent: (id: string, position: Position) => void;

  // Wire operations
  addWire: (from: WireEndpoint, to: WireEndpoint) => string | null;
  removeWire: (id: string) => void;

  // Viewport operations
  setZoom: (zoom: number) => void;
  setPan: (pan: Position) => void;
  resetViewport: () => void;

  // Grid operations
  toggleGrid: () => void;
  toggleSnap: () => void;
  setGridSize: (size: number) => void;

  // History operations
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Circuit operations
  clearCanvas: () => void;
  updateMetadata: (updates: Partial<CircuitMetadata>) => void;
  markSaved: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
const MIN_GRID_SIZE = 5;

// ============================================================================
// Helper Functions
// ============================================================================

/** Generate unique ID */
function generateId(type: string): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Snap position to grid */
function snapToGridPosition(position: Position, gridSize: number): Position {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}

/** Get default ports for a block type */
function getDefaultPorts(type: BlockType): Block['ports'] {
  switch (type) {
    case 'power_24v':
    case 'power_12v':
      return [{ id: 'out', type: 'output', label: '+', position: 'bottom' }];
    case 'gnd':
      return [{ id: 'in', type: 'input', label: 'GND', position: 'top' }];
    case 'plc_out':
      return [
        { id: 'in', type: 'input', label: 'IN', position: 'left' },
        { id: 'out', type: 'output', label: 'OUT', position: 'right' },
      ];
    case 'plc_in':
      return [
        { id: 'in', type: 'input', label: 'IN', position: 'left' },
        { id: 'out', type: 'output', label: 'OUT', position: 'right' },
      ];
    case 'led':
      return [
        { id: 'anode', type: 'input', label: '+', position: 'top' },
        { id: 'cathode', type: 'output', label: '-', position: 'bottom' },
      ];
    case 'button':
      return [
        { id: 'in', type: 'input', label: 'IN', position: 'left' },
        { id: 'out', type: 'output', label: 'OUT', position: 'right' },
      ];
    case 'scope':
      return [
        { id: 'ch1', type: 'input', label: 'CH1', position: 'left', offset: 0.25 },
        { id: 'ch2', type: 'input', label: 'CH2', position: 'left', offset: 0.5 },
        { id: 'ch3', type: 'input', label: 'CH3', position: 'left', offset: 0.75 },
        { id: 'ch4', type: 'input', label: 'CH4', position: 'left', offset: 1.0 },
      ];
    default:
      return [];
  }
}

/** Get default properties for a block type */
function getDefaultBlockProps(type: BlockType): Partial<Block> {
  switch (type) {
    case 'power_24v':
      return { maxCurrent: 1000 };
    case 'power_12v':
      return { maxCurrent: 1000 };
    case 'gnd':
      return {};
    case 'plc_out':
      return { address: 'C:0x0000', normallyOpen: true, inverted: false };
    case 'plc_in':
      return { address: 'DI:0x0000', thresholdVoltage: 12, inverted: false };
    case 'led':
      return { color: 'red', forwardVoltage: 2.0, lit: false };
    case 'button':
      return { mode: 'momentary', contactConfig: '1a', pressed: false };
    case 'scope':
      return { channels: 1, triggerMode: 'auto', timeBase: 100, voltageScale: 5 };
    default:
      return {};
  }
}

/** Validate wire endpoint exists */
function isValidEndpoint(
  endpoint: WireEndpoint,
  components: Map<string, Block>
): boolean {
  const component = components.get(endpoint.componentId);
  if (!component) return false;
  return component.ports.some((port) => port.id === endpoint.portId);
}

/** Check if wire already exists */
function wireExists(wires: Wire[], from: WireEndpoint, to: WireEndpoint): boolean {
  return wires.some(
    (wire) =>
      (wire.from.componentId === from.componentId &&
        wire.from.portId === from.portId &&
        wire.to.componentId === to.componentId &&
        wire.to.portId === to.portId) ||
      (wire.from.componentId === to.componentId &&
        wire.from.portId === to.portId &&
        wire.to.componentId === from.componentId &&
        wire.to.portId === from.portId)
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for accessing and manipulating canvas document state.
 *
 * @param documentId - The document ID to operate on
 * @returns Canvas document state and operations, or null if document not found
 *
 * @example
 * ```tsx
 * const { documentId } = useDocumentContext();
 * const canvas = useCanvasDocument(documentId);
 *
 * if (canvas) {
 *   canvas.addComponent('led', { x: 100, y: 100 });
 * }
 * ```
 */
export function useCanvasDocument(documentId: string | null): UseCanvasDocumentReturn | null {
  const document = useDocumentRegistry((state) =>
    documentId ? state.documents.get(documentId) : undefined
  );
  const updateCanvasData = useDocumentRegistry((state) => state.updateCanvasData);
  const pushHistory = useDocumentRegistry((state) => state.pushHistory);
  const undoAction = useDocumentRegistry((state) => state.undo);
  const redoAction = useDocumentRegistry((state) => state.redo);
  const canUndoCheck = useDocumentRegistry((state) => state.canUndo);
  const canRedoCheck = useDocumentRegistry((state) => state.canRedo);
  const markClean = useDocumentRegistry((state) => state.markClean);

  // Early return if no document or wrong type
  const canvasDoc = document && isCanvasDocument(document) ? document : null;

  // Memoize data accessors
  const data = canvasDoc?.data;

  // Component operations
  const addComponent = useCallback(
    (type: BlockType, position: Position, props: Partial<Block> = {}): string => {
      if (!documentId || !data) return '';

      const id = generateId(type);
      const finalPosition = data.snapToGrid
        ? snapToGridPosition(position, data.gridSize)
        : position;

      const newBlock: Block = {
        id,
        type,
        position: finalPosition,
        ports: getDefaultPorts(type),
        ...getDefaultBlockProps(type),
        ...props,
      } as Block;

      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        docData.components.set(id, newBlock);
      });

      return id;
    },
    [documentId, data, pushHistory, updateCanvasData]
  );

  const removeComponent = useCallback(
    (id: string) => {
      if (!documentId || !data) return;

      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        docData.components.delete(id);
        // Remove connected wires
        docData.wires = docData.wires.filter(
          (wire) => wire.from.componentId !== id && wire.to.componentId !== id
        );
      });
    },
    [documentId, data, pushHistory, updateCanvasData]
  );

  const updateComponent = useCallback(
    (id: string, updates: Partial<Block>) => {
      if (!documentId || !data) return;

      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        const component = docData.components.get(id);
        if (component) {
          docData.components.set(id, { ...component, ...updates } as Block);
        }
      });
    },
    [documentId, data, pushHistory, updateCanvasData]
  );

  const moveComponent = useCallback(
    (id: string, position: Position) => {
      if (!documentId || !data) return;

      const finalPosition = data.snapToGrid
        ? snapToGridPosition(position, data.gridSize)
        : position;

      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        const component = docData.components.get(id);
        if (component) {
          docData.components.set(id, { ...component, position: finalPosition } as Block);
        }
      });
    },
    [documentId, data, pushHistory, updateCanvasData]
  );

  // Wire operations
  const addWire = useCallback(
    (from: WireEndpoint, to: WireEndpoint): string | null => {
      if (!documentId || !data) return null;

      // Validate endpoints
      if (!isValidEndpoint(from, data.components)) return null;
      if (!isValidEndpoint(to, data.components)) return null;

      // Prevent self-connection
      if (from.componentId === to.componentId) return null;

      // Prevent duplicate wires
      if (wireExists(data.wires, from, to)) return null;

      const id = generateId('wire');

      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        docData.wires.push({ id, from, to });
      });

      return id;
    },
    [documentId, data, pushHistory, updateCanvasData]
  );

  const removeWire = useCallback(
    (id: string) => {
      if (!documentId) return;

      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        docData.wires = docData.wires.filter((wire) => wire.id !== id);
      });
    },
    [documentId, pushHistory, updateCanvasData]
  );

  // Viewport operations
  const setZoom = useCallback(
    (zoom: number) => {
      if (!documentId) return;

      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      updateCanvasData(documentId, (docData) => {
        docData.zoom = clampedZoom;
      });
    },
    [documentId, updateCanvasData]
  );

  const setPan = useCallback(
    (pan: Position) => {
      if (!documentId) return;

      updateCanvasData(documentId, (docData) => {
        docData.pan = pan;
      });
    },
    [documentId, updateCanvasData]
  );

  const resetViewport = useCallback(() => {
    if (!documentId) return;

    updateCanvasData(documentId, (docData) => {
      docData.zoom = 1.0;
      docData.pan = { x: 0, y: 0 };
    });
  }, [documentId, updateCanvasData]);

  // Grid operations
  const toggleGrid = useCallback(() => {
    if (!documentId) return;

    updateCanvasData(documentId, (docData) => {
      docData.showGrid = !docData.showGrid;
    });
  }, [documentId, updateCanvasData]);

  const toggleSnap = useCallback(() => {
    if (!documentId) return;

    updateCanvasData(documentId, (docData) => {
      docData.snapToGrid = !docData.snapToGrid;
    });
  }, [documentId, updateCanvasData]);

  const setGridSize = useCallback(
    (size: number) => {
      if (!documentId) return;

      const clampedSize = Math.max(MIN_GRID_SIZE, size);
      updateCanvasData(documentId, (docData) => {
        docData.gridSize = clampedSize;
      });
    },
    [documentId, updateCanvasData]
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

  // Circuit operations
  const clearCanvas = useCallback(() => {
    if (!documentId) return;

    pushHistory(documentId);
    updateCanvasData(documentId, (docData) => {
      docData.components = new Map();
      docData.wires = [];
      docData.metadata = {
        name: 'Untitled Circuit',
        description: '',
        tags: [],
      };
    });
  }, [documentId, pushHistory, updateCanvasData]);

  const updateMetadata = useCallback(
    (updates: Partial<CircuitMetadata>) => {
      if (!documentId) return;

      updateCanvasData(documentId, (docData) => {
        docData.metadata = { ...docData.metadata, ...updates };
      });
    },
    [documentId, updateCanvasData]
  );

  const markSavedCallback = useCallback(() => {
    if (documentId) markClean(documentId);
  }, [documentId, markClean]);

  // Return memoized result
  return useMemo(() => {
    if (!canvasDoc || !data) return null;

    return {
      // Data
      components: data.components,
      wires: data.wires,
      metadata: data.metadata,
      zoom: data.zoom,
      pan: data.pan,
      gridSize: data.gridSize,
      snapToGrid: data.snapToGrid,
      showGrid: data.showGrid,
      isDirty: canvasDoc.isDirty,

      // Component operations
      addComponent,
      removeComponent,
      updateComponent,
      moveComponent,

      // Wire operations
      addWire,
      removeWire,

      // Viewport operations
      setZoom,
      setPan,
      resetViewport,

      // Grid operations
      toggleGrid,
      toggleSnap,
      setGridSize,

      // History operations
      undo,
      redo,
      canUndo,
      canRedo,

      // Circuit operations
      clearCanvas,
      updateMetadata,
      markSaved: markSavedCallback,
    };
  }, [
    canvasDoc,
    data,
    addComponent,
    removeComponent,
    updateComponent,
    moveComponent,
    addWire,
    removeWire,
    setZoom,
    setPan,
    resetViewport,
    toggleGrid,
    toggleSnap,
    setGridSize,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
    updateMetadata,
    markSavedCallback,
  ]);
}

export default useCanvasDocument;
