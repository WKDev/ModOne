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
  WireHandle,
  WireEndpoint,
  Position,
  PortPosition,
  CircuitMetadata,
} from '../../components/OneCanvas/types';
import { isPortEndpoint } from '../../components/OneCanvas/types';
import {
  getPortRelativePosition,
  calculateWireBendPoints,
} from '../../components/OneCanvas/utils/wirePathCalculator';
import {
  getBlockSize,
} from '../../components/OneCanvas/blockDefinitions';

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
  addWire: (from: WireEndpoint, to: WireEndpoint, options?: { fromExitDirection?: PortPosition; toExitDirection?: PortPosition }) => string | null;
  removeWire: (id: string) => void;
  createJunctionOnWire: (wireId: string, position: Position) => string | null;
  addWireHandle: (wireId: string, position: Position) => void;
  updateWireHandle: (wireId: string, handleIndex: number, position: Position) => void;
  removeWireHandle: (wireId: string, handleIndex: number) => void;

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
  if (isPortEndpoint(endpoint)) {
    const component = components.get(endpoint.componentId);
    if (!component) return false;
    return component.ports.some((port) => port.id === endpoint.portId);
  }
  // Junction endpoints validated elsewhere
  return false;
}

/** Get a unique key for a wire endpoint for comparison */
function endpointKey(ep: WireEndpoint): string {
  if (isPortEndpoint(ep)) {
    return `port:${ep.componentId}:${ep.portId}`;
  }
  return `junction:${ep.junctionId}`;
}

/** Check if wire already exists */
function wireExists(wires: Wire[], from: WireEndpoint, to: WireEndpoint): boolean {
  const fromKey = endpointKey(from);
  const toKey = endpointKey(to);
  return wires.some(
    (wire) =>
      (endpointKey(wire.from) === fromKey && endpointKey(wire.to) === toKey) ||
      (endpointKey(wire.from) === toKey && endpointKey(wire.to) === fromKey)
  );
}

/** Find where to insert a new handle */
function findHandleInsertIndex(wire: Wire, position: Position): number {
  if (!wire.handles || wire.handles.length === 0) {
    return 0;
  }
  let closestIndex = 0;
  let closestDistance = Infinity;
  for (let i = 0; i < wire.handles.length; i++) {
    const hp = wire.handles[i].position;
    const distance = Math.sqrt(
      Math.pow(hp.x - position.x, 2) + Math.pow(hp.y - position.y, 2)
    );
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }
  return closestIndex + 1;
}

/**
 * Compute auto-generated bend points for a wire based on port directions.
 */
function computeWireBendPoints(
  from: WireEndpoint,
  to: WireEndpoint,
  components: Map<string, Block>,
  fromExitDirection?: PortPosition,
  toExitDirection?: PortPosition
): WireHandle[] | undefined {
  // Only compute bend points for port-to-port wires
  if (!isPortEndpoint(from) || !isPortEndpoint(to)) return undefined;

  const fromBlock = components.get(from.componentId);
  const toBlock = components.get(to.componentId);
  if (!fromBlock || !toBlock) return undefined;

  const fromPort = fromBlock.ports.find((p) => p.id === from.portId);
  const toPort = toBlock.ports.find((p) => p.id === to.portId);
  if (!fromPort || !toPort) return undefined;

  const fromSize = fromBlock.size || getBlockSize(fromBlock.type);
  const toSize = toBlock.size || getBlockSize(toBlock.type);

  const fromRelPos = getPortRelativePosition(fromPort.position, fromPort.offset ?? 0.5, fromSize);
  const toRelPos = getPortRelativePosition(toPort.position, toPort.offset ?? 0.5, toSize);

  const fromPos = { x: fromBlock.position.x + fromRelPos.x, y: fromBlock.position.y + fromRelPos.y };
  const toPos = { x: toBlock.position.x + toRelPos.x, y: toBlock.position.y + toRelPos.y };

  const fromDir = fromExitDirection || fromPort.position;
  const toDir = toExitDirection || toPort.position;

  const result = calculateWireBendPoints(fromPos, toPos, fromDir, toDir);
  if (result.points.length === 0) return undefined;

  return result.points.map((p, i) => ({
    position: p,
    constraint: result.constraints[i],
    source: 'auto' as const,
  }));
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
        size: getBlockSize(type),
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
          (wire) =>
            !(isPortEndpoint(wire.from) && wire.from.componentId === id) &&
            !(isPortEndpoint(wire.to) && wire.to.componentId === id)
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
    (from: WireEndpoint, to: WireEndpoint, options?: { fromExitDirection?: PortPosition; toExitDirection?: PortPosition }): string | null => {
      if (!documentId || !data) return null;

      // Validate endpoints
      if (!isValidEndpoint(from, data.components)) return null;
      if (!isValidEndpoint(to, data.components)) return null;

      // Prevent self-connection
      if (isPortEndpoint(from) && isPortEndpoint(to) && from.componentId === to.componentId) return null;
      if (endpointKey(from) === endpointKey(to)) return null;

      // Prevent duplicate wires
      if (wireExists(data.wires, from, to)) return null;

      const id = generateId('wire');

      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        const newWire: Wire = { id, from, to };
        if (options?.fromExitDirection) {
          newWire.fromExitDirection = options.fromExitDirection;
        }
        if (options?.toExitDirection) {
          newWire.toExitDirection = options.toExitDirection;
        }

        // Auto-generate bend points
        const handles = computeWireBendPoints(
          from, to, docData.components,
          options?.fromExitDirection, options?.toExitDirection
        );
        if (handles) {
          newWire.handles = handles;
        }

        docData.wires.push(newWire);
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

  const createJunctionOnWire = useCallback(
    (wireId: string, _position: Position): string | null => {
      if (!documentId || !data) return null;

      const wire = data.wires.find((w) => w.id === wireId);
      if (!wire) {
        console.warn('Wire not found:', wireId);
        return null;
      }

      // Create junction (wire-level concept, not a block)
      const junctionId = generateId('junction');

      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        // Find and remove original wire
        const wireIndex = docData.wires.findIndex((w) => w.id === wireId);
        if (wireIndex === -1) return;
        const originalWire = docData.wires[wireIndex];
        docData.wires.splice(wireIndex, 1);

        // Add junction to junctions map (if available)
        // Note: document mode junction support is limited — junctions stored in components for now
        // TODO: Add junctions map to document data model

        // Create two new wires using JunctionEndpoint
        const wire1Id = generateId('wire');
        const wire2Id = generateId('wire');

        const wire1: Wire = {
          id: wire1Id,
          from: { ...originalWire.from },
          to: { junctionId },
        };
        if (originalWire.fromExitDirection) {
          wire1.fromExitDirection = originalWire.fromExitDirection;
        }

        const wire2: Wire = {
          id: wire2Id,
          from: { junctionId },
          to: { ...originalWire.to },
        };
        if (originalWire.toExitDirection) {
          wire2.toExitDirection = originalWire.toExitDirection;
        }

        docData.wires.push(wire1);
        docData.wires.push(wire2);
      });

      return junctionId;
    },
    [documentId, data, pushHistory, updateCanvasData]
  );

  const addWireHandle = useCallback(
    (wireId: string, position: Position) => {
      if (!documentId || !data) return;

      const wire = data.wires.find((w) => w.id === wireId);
      if (!wire) return;

      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        const targetWire = docData.wires.find((w) => w.id === wireId);
        if (!targetWire) return;

        targetWire.handles = targetWire.handles || [];

        const insertIndex = findHandleInsertIndex(targetWire, position);
        const newHandle: WireHandle = {
          position,
          constraint: 'free',
          source: 'user',
        };
        targetWire.handles.splice(insertIndex, 0, newHandle);
      });
    },
    [documentId, data, pushHistory, updateCanvasData]
  );

  const updateWireHandle = useCallback(
    (wireId: string, handleIndex: number, position: Position) => {
      if (!documentId) return;

      updateCanvasData(documentId, (docData) => {
        const wire = docData.wires.find((w) => w.id === wireId);
        if (!wire?.handles?.[handleIndex]) return;

        const handle = wire.handles[handleIndex];
        const constraint = handle.constraint;
        const original = handle.position;

        if (constraint === 'free') {
          handle.position = { x: position.x, y: position.y };
        } else {
          handle.position = constraint === 'horizontal'
            ? { x: position.x, y: original.y }
            : { x: original.x, y: position.y };
        }
      });
    },
    [documentId, updateCanvasData]
  );

  const removeWireHandle = useCallback(
    (wireId: string, handleIndex: number) => {
      if (!documentId) return;

      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        const wire = docData.wires.find((w) => w.id === wireId);
        if (!wire?.handles?.[handleIndex]) return;

        wire.handles.splice(handleIndex, 1);
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
      createJunctionOnWire,
      addWireHandle,
      updateWireHandle,
      removeWireHandle,

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
    createJunctionOnWire,
    addWireHandle,
    updateWireHandle,
    removeWireHandle,
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
