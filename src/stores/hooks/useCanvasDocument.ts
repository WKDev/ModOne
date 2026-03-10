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
import { isPortEndpoint, isFloatingEndpoint, isJunctionEndpoint } from '../../components/OneCanvas/types';
import {
  getBlockSize,
  getDefaultPorts as getDefaultPortsFromDefs,
  getDefaultBlockProps as getDefaultBlockPropsFromDefs,
  getPowerSourcePorts,
} from '../../components/OneCanvas/blockDefinitions';
import {
  generateId,
  snapToGridPosition,
  endpointKey,
  wireExists,
  findHandleInsertIndex,
  computeWireBendPoints,
  getWiresConnectedToComponent,
  getWiresConnectedToJunction,
  recalculateAutoHandles,
  detectPortAtPosition,
} from '../../components/OneCanvas/utils/canvasHelpers';
import { polylineToHandles, simplifyWireHandles, enforceOrthogonalPolyline } from '../../components/OneCanvas/utils/wireSimplifier';
import { getPortAbsolutePosition } from '../../components/OneCanvas/utils/wirePathCalculator';

// ============================================================================
// Helpers
// ============================================================================

function resolveEndpointPos(
  endpoint: WireEndpoint,
  components: Map<string, Block>,
  junctions: Map<string, Junction>,
): Position | null {
  if (isPortEndpoint(endpoint)) {
    const block = components.get(endpoint.componentId);
    if (!block) return null;
    return getPortAbsolutePosition(block, endpoint.portId);
  }
  if (isJunctionEndpoint(endpoint)) {
    const junction = junctions.get(endpoint.junctionId);
    return junction ? { x: junction.position.x, y: junction.position.y } : null;
  }
  if (isFloatingEndpoint(endpoint)) {
    return { x: endpoint.position.x, y: endpoint.position.y };
  }
  return null;
}

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
  moveComponent: (id: string, position: Position, skipHistory?: boolean, skipWireRecalc?: boolean) => void;

  // Junction operations
  moveJunction: (id: string, position: Position, skipHistory?: boolean, skipWireRecalc?: boolean) => void;

  // Wire operations
  addWire: (from: WireEndpoint, to: WireEndpoint, options?: { fromExitDirection?: PortPosition; toExitDirection?: PortPosition }) => string | null;
  removeWire: (id: string) => void;
  createJunctionOnWire: (wireId: string, position: Position) => string | null;
  addWireHandle: (wireId: string, position: Position) => void;
  updateWireHandle: (wireId: string, handleIndex: number, position: Position) => void;
  recalculateWireHandles: (wireId: string) => void;
  removeWireHandle: (wireId: string, handleIndex: number) => void;
  moveWireSegment: (wireId: string, handleIndexA: number, handleIndexB: number, delta: Position, isFirstMove?: boolean) => void;
  dragWireSegment: (wireId: string, polySegIndex: number, delta: Position, isFirstMove: boolean) => { handleA: number; handleB: number; orientation: 'horizontal' | 'vertical' | null } | null;
  insertEndpointHandle: (wireId: string, end: 'from' | 'to', newHandles: Array<{position: Position, constraint: HandleConstraint}>) => void;
  cleanupOverlappingHandles: (wireId: string) => void;
  commitWirePolyline: (wireId: string, poly: readonly Position[], routingMode: 'auto' | 'manual', skipHistory?: boolean) => void;

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

      // For powersource, override ports based on polarity
      let ports = getDefaultPorts(type);
      if (type === 'powersource') {
        const polarity = (props as Record<string, unknown>).polarity as string | undefined;
        if (polarity === 'ground' || polarity === 'negative' || polarity === 'positive') {
          ports = getPowerSourcePorts(polarity);
        }
      }

      const newBlock: Block = {
        id,
        type,
        position: finalPosition,
        size: getBlockSize(type),
        ports,
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
    (id: string, position: Position, skipHistory?: boolean, skipWireRecalc?: boolean) => {
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

          if (!skipWireRecalc) {
            // Recalculate auto handles on connected wires and simplify handles
            const connectedWires = getWiresConnectedToComponent(docData.wires, id);
            for (const wire of connectedWires) {
              const target = docData.wires.find((w) => w.id === wire.id);
              if (target) {
                target.handles = recalculateAutoHandles(target, docData.components, docData.junctions);
                const geom = { components: docData.components, junctions: docData.junctions };
                const simplified = simplifyWireHandles(target, geom);
                if (simplified !== target.handles) {
                  target.handles = simplified;
                }
              }
            }
          }
        }
      });
    },
    [documentId, data, pushHistory, updateCanvasData]
  );

  const moveJunction = useCallback(
    (id: string, position: Position, skipHistory?: boolean, skipWireRecalc?: boolean) => {
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

          if (!skipWireRecalc) {
            // Recalculate auto handles on connected wires and simplify handles
            const connectedWires = getWiresConnectedToJunction(docData.wires, id);
            for (const wire of connectedWires) {
              const target = docData.wires.find((w) => w.id === wire.id);
              if (target) {
                target.handles = recalculateAutoHandles(target, docData.components, docData.junctions);
                const geom = { components: docData.components, junctions: docData.junctions };
                const simplified = simplifyWireHandles(target, geom);
                if (simplified !== target.handles) {
                  target.handles = simplified;
                }
              }
            }
          }
        }
      });
    },
    [documentId, data, pushHistory, updateCanvasData]
  );

  // Wire operations
  const addWire = useCallback(
    (from: WireEndpoint, to: WireEndpoint, options?: { fromExitDirection?: PortPosition; toExitDirection?: PortPosition; handles?: WireHandle[] }): string | null => {
      if (!documentId || !data) return null;

      // Auto-promote FloatingEndpoint → PortEndpoint if on a port
      const promotedFrom = isFloatingEndpoint(from)
        ? (() => {
            const detected = detectPortAtPosition(from.position, data.components);
            if (detected) return { type: 'port' as const, componentId: detected.componentId, portId: detected.portId };
            return from;
          })()
        : from;
      const promotedTo = isFloatingEndpoint(to)
        ? (() => {
            const detected = detectPortAtPosition(to.position, data.components);
            if (detected) return { type: 'port' as const, componentId: detected.componentId, portId: detected.portId };
            return to;
          })()
        : to;

      // Block self-connection and duplicates
      if (endpointKey(promotedFrom) === endpointKey(promotedTo)) return null;
      if (wireExists(data.wires, promotedFrom, promotedTo)) return null;

      // Advisory validation — warn but don't block
      if (
        isPortEndpoint(promotedFrom) &&
        isPortEndpoint(promotedTo) &&
        promotedFrom.componentId === promotedTo.componentId
      ) {
        console.warn('[addWire] Self-connection detected, wire will still be created');
      }

      const id = generateId('wire');

      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        const newWire: Wire = { id, from: promotedFrom, to: promotedTo };
        if (options?.fromExitDirection) {
          newWire.fromExitDirection = options.fromExitDirection;
        }
        if (options?.toExitDirection) {
          newWire.toExitDirection = options.toExitDirection;
        }

        // Use user-provided handles if available; otherwise auto-compute
        if (options?.handles && options.handles.length > 0) {
          newWire.handles = options.handles;
        } else {
          const handles = computeWireBendPoints(
            promotedFrom, promotedTo, docData.components,
            options?.fromExitDirection, options?.toExitDirection,
            docData.junctions
          );
          if (handles) {
            newWire.handles = handles;
          }
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
    (wireId: string, handleIndex: number, position: Position, isFirstMove?: boolean) => {
      if (!documentId) return;

      // Push history on first move of a drag so Undo reverts the whole drag
      if (isFirstMove) {
        pushHistory(documentId);
      }

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
    [documentId, pushHistory, updateCanvasData]
  );

  const recalculateWireHandles = useCallback(
    (wireId: string) => {
      if (!documentId) return;

      updateCanvasData(documentId, (docData) => {
        const wire = docData.wires.find((w) => w.id === wireId);
        if (!wire) return;

        wire.handles = recalculateAutoHandles(wire, docData.components, docData.junctions);
        const geom = { components: docData.components, junctions: docData.junctions };
        const simplified = simplifyWireHandles(wire, geom, 'auto');
        if (simplified !== wire.handles) {
          wire.handles = simplified;
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

  const dragWireSegment = useCallback(
    (wireId: string, polySegIndex: number, delta: Position, isFirstMove: boolean): { handleA: number; handleB: number; orientation: 'horizontal' | 'vertical' | null } | null => {
      if (!documentId) return null;

      if (isFirstMove) {
        pushHistory(documentId);
      }

      let result: { handleA: number; handleB: number; orientation: 'horizontal' | 'vertical' | null } | null = null;

      updateCanvasData(documentId, (docData) => {
        const wire = docData.wires.find((w: Wire) => w.id === wireId);
        if (!wire) return;

        const handleCount = wire.handles?.length ?? 0;
        const isFromSegment = polySegIndex === 0;
        const isToSegment = polySegIndex === handleCount;

        // --- Resolve endpoint positions and insert stub handles ---
        if (isFromSegment) {
          const fromPos = resolveEndpointPos(wire.from, docData.components, docData.junctions);
          if (fromPos) {
            wire.handles = wire.handles || [];
            wire.handles.unshift({ position: { ...fromPos }, constraint: 'free' as HandleConstraint, source: 'user' as const });
          }
        }

        if (isToSegment) {
          const toPos = resolveEndpointPos(wire.to, docData.components, docData.junctions);
          if (toPos) {
            wire.handles = wire.handles || [];
            wire.handles.push({ position: { ...toPos }, constraint: 'free' as HandleConstraint, source: 'user' as const });
          }
        }

        // --- Determine handle indices ---
        const newHandleCount = wire.handles?.length ?? 0;
        let hA: number, hB: number;

        if (isFromSegment && isToSegment) {
          hA = 0;
          hB = Math.min(1, newHandleCount - 1);
        } else if (isFromSegment) {
          hA = 0;
          hB = 1;
        } else if (isToSegment) {
          hA = Math.max(0, newHandleCount - 2);
          hB = newHandleCount - 1;
        } else {
          hA = polySegIndex - 1;
          hB = polySegIndex;
        }

        // --- Infer orientation ---
        let orientation: 'horizontal' | 'vertical' | null = null;
        const handles = wire.handles;
        if (handles && hA >= 0 && hB < handles.length) {
          const a = handles[hA].position;
          const b = handles[hB].position;
          const dx = Math.abs(b.x - a.x);
          const dy = Math.abs(b.y - a.y);
          const EPS = 1;
          if (dy <= EPS && dx > EPS) orientation = 'horizontal';
          else if (dx <= EPS && dy > EPS) orientation = 'vertical';
          else if (dx > dy) orientation = 'horizontal';
          else if (dy > dx) orientation = 'vertical';
        }

        // --- Apply delta ---
        if (handles && handles[hA] && handles[hB]) {
          handles[hA].position = { x: handles[hA].position.x + delta.x, y: handles[hA].position.y + delta.y };
          handles[hB].position = { x: handles[hB].position.x + delta.x, y: handles[hB].position.y + delta.y };
          handles[hA].source = 'user';
          handles[hB].source = 'user';
        }

        result = { handleA: hA, handleB: hB, orientation };
      });

      return result;
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
        if (!wire) return;

        const geom = { components: docData.components, junctions: docData.junctions };
        const simplified = simplifyWireHandles(wire, geom);
        if (simplified !== wire.handles) {
          wire.handles = simplified;
        }
      });
    },
    [documentId, updateCanvasData]
  );

  const commitWirePolyline = useCallback(
    (wireId: string, poly: readonly Position[], routingMode: 'auto' | 'manual', skipHistory?: boolean) => {
      if (!documentId) return;

      if (!skipHistory) {
        pushHistory(documentId);
      }
      updateCanvasData(documentId, (docData) => {
        const wire = docData.wires.find((w) => w.id === wireId);
        if (!wire) return;
        const enforcedPoly = enforceOrthogonalPolyline([...poly]);
        const handles = polylineToHandles(enforcedPoly, wire.handles, 'user');
        wire.handles = handles.length > 0 ? handles : undefined;
        wire.routingMode = routingMode;
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
      recalculateWireHandles,
      removeWireHandle,
      moveWireSegment,
      dragWireSegment,
      insertEndpointHandle,
      cleanupOverlappingHandles,
      commitWirePolyline,

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
    recalculateWireHandles,
    removeWireHandle,
    moveWireSegment,
    dragWireSegment,
    insertEndpointHandle,
    cleanupOverlappingHandles,
    commitWirePolyline,
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
