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
  Junction,
  Position,
  PortPosition,
  HandleConstraint,
  CircuitMetadata,
} from '../../components/OneCanvas/types';
import { isPortEndpoint } from '../../components/OneCanvas/types';
import {
  getBlockSize,
  getDefaultPorts as getDefaultPortsFromDefs,
  getDefaultBlockProps as getDefaultBlockPropsFromDefs,
} from '../../components/OneCanvas/blockDefinitions';
import {
  generateId,
  snapToGridPosition,
  endpointKey,
  isValidEndpoint,
  wireExists,
  findHandleInsertIndex,
  computeWireBendPoints,
  getWiresConnectedToComponent,
  getWiresConnectedToJunction,
  recalculateAutoHandles,
} from '../../components/OneCanvas/utils/canvasHelpers';

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
  junctions: Map<string, Junction>;
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
  moveComponent: (id: string, position: Position, skipHistory?: boolean) => void;

  // Junction operations
  moveJunction: (id: string, position: Position, skipHistory?: boolean) => void;

  // Wire operations
  addWire: (from: WireEndpoint, to: WireEndpoint, options?: { fromExitDirection?: PortPosition; toExitDirection?: PortPosition }) => string | null;
  removeWire: (id: string) => void;
  createJunctionOnWire: (wireId: string, position: Position) => string | null;
  addWireHandle: (wireId: string, position: Position) => void;
  updateWireHandle: (wireId: string, handleIndex: number, position: Position) => void;
  removeWireHandle: (wireId: string, handleIndex: number) => void;
  moveWireSegment: (wireId: string, handleIndexA: number, handleIndexB: number, delta: Position, isFirstMove?: boolean) => void;
  insertEndpointHandle: (wireId: string, end: 'from' | 'to', newHandles: Array<{position: Position, constraint: HandleConstraint}>) => void;
  cleanupOverlappingHandles: (wireId: string) => void;

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
// Helper Functions (delegating to shared modules)
// ============================================================================

/** Get default ports for a block type (delegates to blockDefinitions) */
function getDefaultPorts(type: BlockType): Block['ports'] {
  return getDefaultPortsFromDefs(type);
}

/** Get default properties for a block type (delegates to blockDefinitions) */
function getDefaultBlockProps(type: BlockType): Partial<Block> {
  return getDefaultBlockPropsFromDefs(type) as Partial<Block>;
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
    (id: string, position: Position, skipHistory?: boolean) => {
      if (!documentId || !data) return;

      const finalPosition = data.snapToGrid
        ? snapToGridPosition(position, data.gridSize)
        : position;

      if (!skipHistory) {
        pushHistory(documentId);
      }
      updateCanvasData(documentId, (docData) => {
        const component = docData.components.get(id);
        if (component) {
          docData.components.set(id, { ...component, position: finalPosition } as Block);

          // Recalculate auto handles on connected wires
          const connectedWires = getWiresConnectedToComponent(docData.wires, id);
          for (const wire of connectedWires) {
            const target = docData.wires.find((w) => w.id === wire.id);
            if (target) {
              target.handles = recalculateAutoHandles(target, docData.components, docData.junctions);
            }
          }
        }
      });
    },
    [documentId, data, pushHistory, updateCanvasData]
  );

  const moveJunction = useCallback(
    (id: string, position: Position, skipHistory?: boolean) => {
      if (!documentId || !data) return;

      const finalPosition = data.snapToGrid
        ? snapToGridPosition(position, data.gridSize)
        : position;

      if (!skipHistory) {
        pushHistory(documentId);
      }
      updateCanvasData(documentId, (docData) => {
        const junction = docData.junctions.get(id);
        if (junction) {
          docData.junctions.set(id, { ...junction, position: finalPosition });

          // Recalculate auto handles on connected wires
          const connectedWires = getWiresConnectedToJunction(docData.wires, id);
          for (const wire of connectedWires) {
            const target = docData.wires.find((w) => w.id === wire.id);
            if (target) {
              target.handles = recalculateAutoHandles(target, docData.components, docData.junctions);
            }
          }
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
          options?.fromExitDirection, options?.toExitDirection,
          docData.junctions
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

        // Add junction to junctions map
        docData.junctions.set(junctionId, {
          id: junctionId,
          position: { ..._position },
        });

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

        const insertIndex = findHandleInsertIndex(targetWire, position, docData.components);
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

        // Mark as user handle so recalculateAutoHandles won't overwrite
        handle.source = 'user';
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

  const moveWireSegment = useCallback(
    (wireId: string, handleIndexA: number, handleIndexB: number, delta: Position, isFirstMove?: boolean) => {
      if (!documentId) return;

      if (isFirstMove) {
        pushHistory(documentId);
      }
      updateCanvasData(documentId, (docData) => {
        const wire = docData.wires.find((w) => w.id === wireId);
        if (!wire?.handles?.[handleIndexA] || !wire?.handles?.[handleIndexB]) return;

        const handleA = wire.handles[handleIndexA];
        const handleB = wire.handles[handleIndexB];

        handleA.position = {
          x: handleA.position.x + delta.x,
          y: handleA.position.y + delta.y,
        };
        handleB.position = {
          x: handleB.position.x + delta.x,
          y: handleB.position.y + delta.y,
        };

        // Mark as user handles so recalculateAutoHandles won't overwrite
        handleA.source = 'user';
        handleB.source = 'user';
      });
    },
    [documentId, pushHistory, updateCanvasData]
  );

  const insertEndpointHandle = useCallback(
    (wireId: string, end: 'from' | 'to', newHandles: Array<{position: Position, constraint: HandleConstraint}>) => {
      if (!documentId) return;

      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        const wire = docData.wires.find((w) => w.id === wireId);
        if (!wire) return;

        wire.handles = wire.handles || [];
        const handles = newHandles.map((h) => ({
          position: h.position,
          constraint: h.constraint,
          source: 'user' as const,
        }));

        if (end === 'from') {
          wire.handles.unshift(...handles);
        } else {
          wire.handles.push(...handles);
        }
      });
    },
    [documentId, pushHistory, updateCanvasData]
  );

  const cleanupOverlappingHandles = useCallback(
    (wireId: string) => {
      if (!documentId) return;

      // No history push — this is a post-drag cleanup within the same undo unit
      updateCanvasData(documentId, (docData) => {
        const wire = docData.wires.find((w) => w.id === wireId);
        if (!wire?.handles || wire.handles.length < 2) return;

        const THRESHOLD = 1;
        const cleaned: typeof wire.handles = [wire.handles[0]];

        for (let i = 1; i < wire.handles.length; i++) {
          const prev = cleaned[cleaned.length - 1];
          const curr = wire.handles[i];
          if (
            Math.abs(prev.position.x - curr.position.x) <= THRESHOLD &&
            Math.abs(prev.position.y - curr.position.y) <= THRESHOLD
          ) {
            if (prev.source === 'auto' && curr.source !== 'auto') {
              cleaned[cleaned.length - 1] = curr;
            }
          } else {
            cleaned.push(curr);
          }
        }

        if (cleaned.length !== wire.handles.length) {
          wire.handles = cleaned;
        }
      });
    },
    [documentId, updateCanvasData]
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
      docData.junctions = new Map();
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
      junctions: data.junctions,
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

      // Junction operations
      moveJunction,

      // Wire operations
      addWire,
      removeWire,
      createJunctionOnWire,
      addWireHandle,
      updateWireHandle,
      removeWireHandle,
      moveWireSegment,
      insertEndpointHandle,
      cleanupOverlappingHandles,

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
    moveJunction,
    addWire,
    removeWire,
    createJunctionOnWire,
    addWireHandle,
    updateWireHandle,
    removeWireHandle,
    moveWireSegment,
    insertEndpointHandle,
    cleanupOverlappingHandles,
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
