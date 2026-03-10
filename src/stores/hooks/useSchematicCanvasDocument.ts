import { useCallback, useMemo } from 'react';

import { useDocumentRegistry } from '../documentRegistry';
import { isSchematicDocument } from '../../types/document';
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
  SerializableCircuitState,
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
import {
  polylineToHandles,
  simplifyWireHandles,
  enforceOrthogonalPolyline,
} from '../../components/OneCanvas/utils/wireSimplifier';
import { getPortAbsolutePosition } from '../../components/OneCanvas/utils/wirePathCalculator';

import type { UseCanvasDocumentReturn } from './useCanvasDocument';

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

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
const MIN_GRID_SIZE = 5;
const DEFAULT_GRID_SIZE = 20;

interface WorkingCircuitData {
  components: Map<string, Block>;
  junctions: Map<string, Junction>;
  wires: Wire[];
  metadata: CircuitMetadata;
  zoom: number;
  pan: Position;
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;
}

function getDefaultPorts(type: BlockType): Block['ports'] {
  return getDefaultPortsFromDefs(type);
}

function getDefaultBlockProps(type: BlockType): Partial<Block> {
  return getDefaultBlockPropsFromDefs(type) as Partial<Block>;
}

function circuitToWorkingData(circuit: SerializableCircuitState): WorkingCircuitData {
  return {
    components: new Map(Object.entries(circuit.components)) as Map<string, Block>,
    junctions: circuit.junctions
      ? (new Map(Object.entries(circuit.junctions)) as Map<string, Junction>)
      : new Map<string, Junction>(),
    wires: circuit.wires.map((wire) => ({
      ...wire,
      from: { ...wire.from },
      to: { ...wire.to },
      handles: wire.handles
        ? wire.handles.map((handle) => ({
            ...handle,
            position: { ...handle.position },
          }))
        : undefined,
    })),
    metadata: { ...circuit.metadata },
    zoom: circuit.viewport?.zoom ?? 1,
    pan: {
      x: circuit.viewport?.panX ?? 0,
      y: circuit.viewport?.panY ?? 0,
    },
    gridSize: DEFAULT_GRID_SIZE,
    snapToGrid: true,
    showGrid: true,
  };
}

function workingDataToCircuit(data: WorkingCircuitData): SerializableCircuitState {
  return {
    components: Object.fromEntries(data.components),
    junctions: data.junctions.size > 0 ? Object.fromEntries(data.junctions) : undefined,
    wires: data.wires.map((wire) => ({
      ...wire,
      from: { ...wire.from },
      to: { ...wire.to },
      handles: wire.handles
        ? wire.handles.map((handle) => ({
            ...handle,
            position: { ...handle.position },
          }))
        : undefined,
    })),
    metadata: { ...data.metadata },
    viewport: {
      zoom: data.zoom,
      panX: data.pan.x,
      panY: data.pan.y,
    },
  };
}

export function useSchematicCanvasDocument(
  documentId: string | null
): UseCanvasDocumentReturn | null {
  const document = useDocumentRegistry((state) =>
    documentId ? state.documents.get(documentId) : undefined
  );
  const updateSchematicData = useDocumentRegistry((state) => state.updateSchematicData);
  const pushHistory = useDocumentRegistry((state) => state.pushHistory);
  const undoAction = useDocumentRegistry((state) => state.undo);
  const redoAction = useDocumentRegistry((state) => state.redo);
  const canUndoCheck = useDocumentRegistry((state) => state.canUndo);
  const canRedoCheck = useDocumentRegistry((state) => state.canRedo);
  const markClean = useDocumentRegistry((state) => state.markClean);

  const schematicDoc = document && isSchematicDocument(document) ? document : null;
  const schematic = schematicDoc?.data.schematic;
  const activePage = useMemo(() => {
    if (!schematic) return null;
    return schematic.pages.find((page) => page.id === schematic.activePageId) ?? null;
  }, [schematic]);
  const data = useMemo(
    () => (activePage ? circuitToWorkingData(activePage.circuit) : null),
    [activePage]
  );

  const updateActivePageCircuit = useCallback(
    (updater: (working: WorkingCircuitData) => void) => {
      if (!documentId) return;

      updateSchematicData(documentId, (docData) => {
        const page =
          docData.schematic.pages.find(
            (candidate) => candidate.id === docData.schematic.activePageId
          ) ?? null;
        if (!page) return;

        const working = circuitToWorkingData(page.circuit);
        updater(working);
        page.circuit = workingDataToCircuit(working);
        page.updatedAt = new Date().toISOString();
        docData.schematic.updatedAt = new Date().toISOString();
      });
    },
    [documentId, updateSchematicData]
  );

  const addComponent = useCallback(
    (type: BlockType, position: Position, props: Partial<Block> = {}): string => {
      if (!documentId || !data) return '';

      const id = generateId(type);
      const finalPosition = data.snapToGrid
        ? snapToGridPosition(position, data.gridSize)
        : position;

      let ports = getDefaultPorts(type);
      if (type === 'powersource') {
        const polarity = (props as Record<string, unknown>).polarity as
          | string
          | undefined;
        if (
          polarity === 'ground' ||
          polarity === 'negative' ||
          polarity === 'positive'
        ) {
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
      updateActivePageCircuit((working) => {
        working.components.set(id, newBlock);
      });

      return id;
    },
    [documentId, data, pushHistory, updateActivePageCircuit]
  );

  const removeComponent = useCallback(
    (id: string) => {
      if (!documentId || !data) return;

      pushHistory(documentId);
      updateActivePageCircuit((working) => {
        working.components.delete(id);
        working.wires = working.wires.filter(
          (wire) =>
            !(isPortEndpoint(wire.from) && wire.from.componentId === id) &&
            !(isPortEndpoint(wire.to) && wire.to.componentId === id)
        );
      });
    },
    [documentId, data, pushHistory, updateActivePageCircuit]
  );

  const updateComponent = useCallback(
    (id: string, updates: Partial<Block>) => {
      if (!documentId || !data) return;

      pushHistory(documentId);
      updateActivePageCircuit((working) => {
        const component = working.components.get(id);
        if (component) {
          working.components.set(id, { ...component, ...updates } as Block);
        }
      });
    },
    [documentId, data, pushHistory, updateActivePageCircuit]
  );

  const moveComponent = useCallback(
    (
      id: string,
      position: Position,
      skipHistory?: boolean,
      skipWireRecalc?: boolean
    ) => {
      if (!documentId || !data) return;

      const finalPosition = data.snapToGrid
        ? snapToGridPosition(position, data.gridSize)
        : position;

      if (!skipHistory) {
        pushHistory(documentId);
      }

      updateActivePageCircuit((working) => {
        const component = working.components.get(id);
        if (!component) return;

        working.components.set(id, { ...component, position: finalPosition } as Block);

        if (!skipWireRecalc) {
          const connectedWires = getWiresConnectedToComponent(working.wires, id);
          for (const wire of connectedWires) {
            const target = working.wires.find((candidate) => candidate.id === wire.id);
            if (!target) continue;
            target.handles = recalculateAutoHandles(
              target,
              working.components,
              working.junctions
            );
            const geom = {
              components: working.components,
              junctions: working.junctions,
            };
            const simplified = simplifyWireHandles(target, geom);
            if (simplified !== target.handles) {
              target.handles = simplified;
            }
          }
        }
      });
    },
    [documentId, data, pushHistory, updateActivePageCircuit]
  );

  const moveJunction = useCallback(
    (
      id: string,
      position: Position,
      skipHistory?: boolean,
      skipWireRecalc?: boolean
    ) => {
      if (!documentId || !data) return;

      const finalPosition = data.snapToGrid
        ? snapToGridPosition(position, data.gridSize)
        : position;

      if (!skipHistory) {
        pushHistory(documentId);
      }

      updateActivePageCircuit((working) => {
        const junction = working.junctions.get(id);
        if (!junction) return;

        working.junctions.set(id, { ...junction, position: finalPosition });

        if (!skipWireRecalc) {
          const connectedWires = getWiresConnectedToJunction(working.wires, id);
          for (const wire of connectedWires) {
            const target = working.wires.find((candidate) => candidate.id === wire.id);
            if (!target) continue;
            target.handles = recalculateAutoHandles(
              target,
              working.components,
              working.junctions
            );
            const geom = {
              components: working.components,
              junctions: working.junctions,
            };
            const simplified = simplifyWireHandles(target, geom);
            if (simplified !== target.handles) {
              target.handles = simplified;
            }
          }
        }
      });
    },
    [documentId, data, pushHistory, updateActivePageCircuit]
  );

  const addWire = useCallback(
    (
      from: WireEndpoint,
      to: WireEndpoint,
      options?: {
        fromExitDirection?: PortPosition;
        toExitDirection?: PortPosition;
        handles?: WireHandle[];
      }
    ): string | null => {
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
      updateActivePageCircuit((working) => {
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
            promotedFrom,
            promotedTo,
            working.components,
            options?.fromExitDirection,
            options?.toExitDirection,
            working.junctions
          );
          if (handles) {
            newWire.handles = handles;
          }
        }

        working.wires.push(newWire);
      });

      return id;
    },
    [documentId, data, pushHistory, updateActivePageCircuit]
  );

  const removeWire = useCallback(
    (id: string) => {
      if (!documentId) return;

      pushHistory(documentId);
      updateActivePageCircuit((working) => {
        working.wires = working.wires.filter((wire) => wire.id !== id);
      });
    },
    [documentId, pushHistory, updateActivePageCircuit]
  );

  const createJunctionOnWire = useCallback(
    (wireId: string, position: Position): string | null => {
      if (!documentId || !data) return null;

      const wire = data.wires.find((candidate) => candidate.id === wireId);
      if (!wire) return null;

      const junctionId = generateId('junction');

      pushHistory(documentId);
      updateActivePageCircuit((working) => {
        const wireIndex = working.wires.findIndex((candidate) => candidate.id === wireId);
        if (wireIndex === -1) return;

        const originalWire = working.wires[wireIndex];
        working.wires.splice(wireIndex, 1);
        working.junctions.set(junctionId, {
          id: junctionId,
          position: { ...position },
        });

        const wire1: Wire = {
          id: generateId('wire'),
          from: { ...originalWire.from },
          to: { junctionId },
        };
        if (originalWire.fromExitDirection) {
          wire1.fromExitDirection = originalWire.fromExitDirection;
        }

        const wire2: Wire = {
          id: generateId('wire'),
          from: { junctionId },
          to: { ...originalWire.to },
        };
        if (originalWire.toExitDirection) {
          wire2.toExitDirection = originalWire.toExitDirection;
        }

        working.wires.push(wire1, wire2);
      });

      return junctionId;
    },
    [documentId, data, pushHistory, updateActivePageCircuit]
  );

  const addWireHandle = useCallback(
    (wireId: string, position: Position) => {
      if (!documentId || !data) return;

      const wire = data.wires.find((candidate) => candidate.id === wireId);
      if (!wire) return;

      pushHistory(documentId);
      updateActivePageCircuit((working) => {
        const targetWire = working.wires.find((candidate) => candidate.id === wireId);
        if (!targetWire) return;

        targetWire.handles = targetWire.handles || [];
        const insertIndex = findHandleInsertIndex(
          targetWire,
          position,
          working.components
        );
        const newHandle: WireHandle = {
          position,
          constraint: 'free',
          source: 'user',
        };
        targetWire.handles.splice(insertIndex, 0, newHandle);
      });
    },
    [documentId, data, pushHistory, updateActivePageCircuit]
  );

  const updateWireHandle = useCallback(
    (
      wireId: string,
      handleIndex: number,
      position: Position,
      isFirstMove?: boolean
    ) => {
      if (!documentId) return;

      if (isFirstMove) {
        pushHistory(documentId);
      }

      updateActivePageCircuit((working) => {
        const wire = working.wires.find((candidate) => candidate.id === wireId);
        if (!wire?.handles?.[handleIndex]) return;

        const handle = wire.handles[handleIndex];
        const constraint = handle.constraint;
        const original = handle.position;

        if (constraint === 'free') {
          handle.position = { x: position.x, y: position.y };
        } else {
          handle.position =
            constraint === 'horizontal'
              ? { x: position.x, y: original.y }
              : { x: original.x, y: position.y };
        }

        handle.source = 'user';
      });
    },
    [documentId, pushHistory, updateActivePageCircuit]
  );

  const recalculateWireHandles = useCallback(
    (wireId: string) => {
      if (!documentId) return;

      updateActivePageCircuit((working) => {
        const wire = working.wires.find((candidate) => candidate.id === wireId);
        if (!wire) return;

        wire.handles = recalculateAutoHandles(
          wire,
          working.components,
          working.junctions
        );
        const geom = {
          components: working.components,
          junctions: working.junctions,
        };
        const simplified = simplifyWireHandles(wire, geom, 'auto');
        if (simplified !== wire.handles) {
          wire.handles = simplified;
        }
      });
    },
    [documentId, updateActivePageCircuit]
  );

  const removeWireHandle = useCallback(
    (wireId: string, handleIndex: number) => {
      if (!documentId) return;

      pushHistory(documentId);
      updateActivePageCircuit((working) => {
        const wire = working.wires.find((candidate) => candidate.id === wireId);
        if (!wire?.handles?.[handleIndex]) return;
        wire.handles.splice(handleIndex, 1);
      });
    },
    [documentId, pushHistory, updateActivePageCircuit]
  );

  const moveWireSegment = useCallback(
    (
      wireId: string,
      handleIndexA: number,
      handleIndexB: number,
      delta: Position,
      isFirstMove?: boolean
    ) => {
      if (!documentId) return;

      if (isFirstMove) {
        pushHistory(documentId);
      }

      updateActivePageCircuit((working) => {
        const wire = working.wires.find((candidate) => candidate.id === wireId);
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
        handleA.source = 'user';
        handleB.source = 'user';
      });
    },
    [documentId, pushHistory, updateActivePageCircuit]
  );

  const dragWireSegment = useCallback(
    (wireId: string, polySegIndex: number, delta: Position, isFirstMove: boolean): { handleA: number; handleB: number; orientation: 'horizontal' | 'vertical' | null } | null => {
      if (!documentId) return null;

      if (isFirstMove) {
        pushHistory(documentId);
      }

      let result: { handleA: number; handleB: number; orientation: 'horizontal' | 'vertical' | null } | null = null;

      updateActivePageCircuit((working) => {
        const wire = working.wires.find((w: Wire) => w.id === wireId);
        if (!wire) return;

        const handleCount = wire.handles?.length ?? 0;
        const isFromSegment = polySegIndex === 0;
        const isToSegment = polySegIndex === handleCount;

        if (isFromSegment) {
          const fromPos = resolveEndpointPos(wire.from, working.components, working.junctions);
          if (fromPos) {
            wire.handles = wire.handles || [];
            wire.handles.unshift({ position: { ...fromPos }, constraint: 'free' as HandleConstraint, source: 'user' as const });
          }
        }

        if (isToSegment) {
          const toPos = resolveEndpointPos(wire.to, working.components, working.junctions);
          if (toPos) {
            wire.handles = wire.handles || [];
            wire.handles.push({ position: { ...toPos }, constraint: 'free' as HandleConstraint, source: 'user' as const });
          }
        }

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
    [documentId, pushHistory, updateActivePageCircuit]
  );

  const insertEndpointHandle = useCallback(
    (
      wireId: string,
      end: 'from' | 'to',
      newHandles: Array<{ position: Position; constraint: HandleConstraint }>
    ) => {
      if (!documentId) return;

      pushHistory(documentId);
      updateActivePageCircuit((working) => {
        const wire = working.wires.find((candidate) => candidate.id === wireId);
        if (!wire) return;

        wire.handles = wire.handles || [];
        const handles = newHandles.map((handle) => ({
          position: handle.position,
          constraint: handle.constraint,
          source: 'user' as const,
        }));

        if (end === 'from') {
          wire.handles.unshift(...handles);
        } else {
          wire.handles.push(...handles);
        }
      });
    },
    [documentId, pushHistory, updateActivePageCircuit]
  );

  const cleanupOverlappingHandles = useCallback(
    (wireId: string) => {
      if (!documentId) return;

      updateActivePageCircuit((working) => {
        const wire = working.wires.find((candidate) => candidate.id === wireId);
        if (!wire) return;

        const geom = {
          components: working.components,
          junctions: working.junctions,
        };
        const simplified = simplifyWireHandles(wire, geom);
        if (simplified !== wire.handles) {
          wire.handles = simplified;
        }
      });
    },
    [documentId, updateActivePageCircuit]
  );

  const commitWirePolyline = useCallback(
    (
      wireId: string,
      poly: readonly Position[],
      routingMode: 'auto' | 'manual',
      skipHistory?: boolean
    ) => {
      if (!documentId) return;

      if (!skipHistory) {
        pushHistory(documentId);
      }

      updateActivePageCircuit((working) => {
        const wire = working.wires.find((candidate) => candidate.id === wireId);
        if (!wire) return;
        const enforcedPoly = enforceOrthogonalPolyline([...poly]);
        const handles = polylineToHandles(enforcedPoly, wire.handles, 'user');
        wire.handles = handles.length > 0 ? handles : undefined;
        wire.routingMode = routingMode;
      });
    },
    [documentId, pushHistory, updateActivePageCircuit]
  );

  const setZoom = useCallback(
    (zoom: number) => {
      if (!documentId) return;

      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      updateActivePageCircuit((working) => {
        working.zoom = clampedZoom;
      });
    },
    [documentId, updateActivePageCircuit]
  );

  const setPan = useCallback(
    (pan: Position) => {
      if (!documentId) return;

      updateActivePageCircuit((working) => {
        working.pan = pan;
      });
    },
    [documentId, updateActivePageCircuit]
  );

  const resetViewport = useCallback(() => {
    if (!documentId) return;

    updateActivePageCircuit((working) => {
      working.zoom = 1;
      working.pan = { x: 0, y: 0 };
    });
  }, [documentId, updateActivePageCircuit]);

  const toggleGrid = useCallback(() => {
    if (!documentId) return;

    updateActivePageCircuit((working) => {
      working.showGrid = !working.showGrid;
    });
  }, [documentId, updateActivePageCircuit]);

  const toggleSnap = useCallback(() => {
    if (!documentId) return;

    updateActivePageCircuit((working) => {
      working.snapToGrid = !working.snapToGrid;
    });
  }, [documentId, updateActivePageCircuit]);

  const setGridSize = useCallback(
    (size: number) => {
      if (!documentId) return;

      const clampedSize = Math.max(MIN_GRID_SIZE, size);
      updateActivePageCircuit((working) => {
        working.gridSize = clampedSize;
      });
    },
    [documentId, updateActivePageCircuit]
  );

  const undo = useCallback(() => {
    if (documentId) undoAction(documentId);
  }, [documentId, undoAction]);

  const redo = useCallback(() => {
    if (documentId) redoAction(documentId);
  }, [documentId, redoAction]);

  const canUndo = documentId ? canUndoCheck(documentId) : false;
  const canRedo = documentId ? canRedoCheck(documentId) : false;

  const clearCanvas = useCallback(() => {
    if (!documentId) return;

    pushHistory(documentId);
    updateActivePageCircuit((working) => {
      working.components = new Map();
      working.junctions = new Map();
      working.wires = [];
      working.metadata = {
        name: 'Untitled Circuit',
        description: '',
        tags: [],
      };
    });
  }, [documentId, pushHistory, updateActivePageCircuit]);

  const updateMetadata = useCallback(
    (updates: Partial<CircuitMetadata>) => {
      if (!documentId) return;

      updateActivePageCircuit((working) => {
        working.metadata = { ...working.metadata, ...updates };
      });
    },
    [documentId, updateActivePageCircuit]
  );

  const markSavedCallback = useCallback(() => {
    if (documentId) markClean(documentId);
  }, [documentId, markClean]);

  return useMemo(() => {
    if (!schematicDoc || !data) return null;

    return {
      components: data.components,
      junctions: data.junctions,
      wires: data.wires,
      metadata: data.metadata,
      zoom: data.zoom,
      pan: data.pan,
      gridSize: data.gridSize,
      snapToGrid: data.snapToGrid,
      showGrid: data.showGrid,
      isDirty: schematicDoc.isDirty,
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
      markSaved: markSavedCallback,
    };
  }, [
    schematicDoc,
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

export default useSchematicCanvasDocument;
