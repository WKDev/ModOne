import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useCanvasFacade } from '../../hooks/useCanvasFacade';
import type { CanvasFacadeReturn } from '../../types/canvasFacade';
import type { Block, SerializableCircuitState, WireEndpoint } from '../../components/OneCanvas/types';
import { useDocumentRegistry } from '../documentRegistry';

function makeBlock(id: string, x: number, y: number, w: number, h: number): Block {
  return {
    id,
    type: 'led',
    position: { x, y },
    size: { width: w, height: h },
    ports: [],
    color: 'red',
    forwardVoltage: 2,
  };
}

function emptyCircuit(components: Record<string, Block> = {}): SerializableCircuitState {
  return {
    components,
    wires: [],
    metadata: {
      name: 'Contract Test',
      description: '',
      tags: [],
    },
    viewport: {
      zoom: 1,
      panX: 0,
      panY: 0,
    },
  };
}

function sortedIds(selectedIds: Set<string>): string[] {
  return Array.from(selectedIds).sort();
}

function connectableEndpoints(
  facade: CanvasFacadeReturn,
  sourceComponentId: string,
  targetComponentId: string
): { from: WireEndpoint; to: WireEndpoint } {
  const source = facade.components.get(sourceComponentId);
  const target = facade.components.get(targetComponentId);

  if (!source || !target) {
    throw new Error('Missing source or target component');
  }

  const fromPort = source.ports.find((port) => port.type !== 'input') ?? source.ports[0];
  const toPort = target.ports.find((port) => port.type !== 'output') ?? target.ports[0];

  if (!fromPort || !toPort) {
    throw new Error('Could not find connectable ports');
  }

  return {
    from: { componentId: sourceComponentId, portId: fromPort.id },
    to: { componentId: targetComponentId, portId: toPort.id },
  };
}

beforeEach(() => {
  useDocumentRegistry.getState().reset();
});

const adapters: ReadonlyArray<readonly [string, () => string | null]> = [
  ['DocumentAdapter', (): string => useDocumentRegistry.getState().createDocument('canvas')],
  ['GlobalAdapter', (): null => null],
] as const;

describe.each(adapters)('CanvasFacade (%s)', (_adapterName, setupFn) => {
  it('addComponent adds a component with snapped position', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));

    act(() => {
      result.current.loadCircuit(emptyCircuit());
    });

    let componentId = '';
    act(() => {
      componentId = result.current.addComponent('led', { x: 13, y: 17 });
    });

    const created = result.current.components.get(componentId);
    expect(created).toBeDefined();
    expect(created?.position).toEqual({ x: 20, y: 20 });
    expect(result.current.components.size).toBe(1);
  });

  it('moveComponent updates component position', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));

    const seed = emptyCircuit({ a: makeBlock('a', 10, 10, 10, 10) });
    act(() => {
      result.current.loadCircuit(seed);
      result.current.moveComponent('a', { x: 80, y: 40 });
    });

    expect(result.current.components.get('a')?.position).toEqual({ x: 80, y: 40 });
  });

  it('updateComponent updates properties while preserving shape', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));

    const seed = emptyCircuit({ a: makeBlock('a', 0, 0, 10, 10) });
    act(() => {
      result.current.loadCircuit(seed);
      result.current.updateComponent('a', { label: 'L1' });
    });

    expect(result.current.components.get('a')?.label).toBe('L1');
    expect(result.current.components.get('a')?.position).toEqual({ x: 0, y: 0 });
  });

  it('addWire creates a wire between two component ports', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));

    act(() => {
      result.current.loadCircuit(emptyCircuit());
    });

    let fromId = '';
    let toId = '';
    act(() => {
      fromId = result.current.addComponent('powersource', { x: 20, y: 20 });
      toId = result.current.addComponent('led', { x: 140, y: 20 });
    });

    let wireId: string | null = null;
    act(() => {
      const endpoints = connectableEndpoints(result.current, fromId, toId);
      wireId = result.current.addWire(endpoints.from, endpoints.to);
    });

    expect(wireId).toBeTruthy();
    expect(result.current.wires).toHaveLength(1);
    expect(result.current.wires[0].id).toBe(wireId);
  });

  it('removeWire removes an existing wire', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));

    act(() => {
      result.current.loadCircuit(emptyCircuit());
    });

    let leftId = '';
    let rightId = '';
    act(() => {
      leftId = result.current.addComponent('powersource', { x: 20, y: 20 });
      rightId = result.current.addComponent('led', { x: 140, y: 20 });
    });

    let wireId: string | null = null;
    act(() => {
      const endpoints = connectableEndpoints(result.current, leftId, rightId);
      wireId = result.current.addWire(endpoints.from, endpoints.to);
    });

    expect(result.current.wires).toHaveLength(1);

    act(() => {
      if (wireId) {
        result.current.removeWire(wireId);
      }
    });

    expect(result.current.wires).toHaveLength(0);
  });

  it('setSelection/addToSelection/toggleSelection/clearSelection behave consistently', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));

    const seed = emptyCircuit({
      a: makeBlock('a', 10, 10, 10, 10),
      b: makeBlock('b', 40, 10, 10, 10),
      c: makeBlock('c', 70, 10, 10, 10),
    });

    act(() => {
      result.current.loadCircuit(seed);
      result.current.setSelection(['a']);
    });
    expect(sortedIds(result.current.selectedIds)).toEqual(['a']);

    act(() => {
      result.current.addToSelection('b');
    });
    expect(sortedIds(result.current.selectedIds)).toEqual(['a', 'b']);

    act(() => {
      result.current.toggleSelection('b');
    });
    expect(sortedIds(result.current.selectedIds)).toEqual(['a']);

    act(() => {
      result.current.toggleSelection('c');
    });
    expect(sortedIds(result.current.selectedIds)).toEqual(['a', 'c']);

    act(() => {
      result.current.clearSelection();
    });
    expect(sortedIds(result.current.selectedIds)).toEqual([]);
  });

  it('alignSelected aligns selected blocks to left edge', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));

    const seed = emptyCircuit({
      a: makeBlock('a', 100, 0, 10, 10),
      b: makeBlock('b', 40, 10, 20, 10),
      c: makeBlock('c', 70, 20, 30, 10),
    });

    act(() => {
      result.current.loadCircuit(seed);
      result.current.setSelection(['a', 'b', 'c']);
    });

    act(() => {
      result.current.alignSelected('left');
    });

    expect(result.current.components.get('a')?.position.x).toBe(40);
    expect(result.current.components.get('b')?.position.x).toBe(40);
    expect(result.current.components.get('c')?.position.x).toBe(40);
  });

  it('distributeSelected horizontally creates even spacing', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));

    const seed = emptyCircuit({
      a: makeBlock('a', 0, 0, 20, 10),
      b: makeBlock('b', 40, 0, 20, 10),
      c: makeBlock('c', 100, 0, 20, 10),
    });

    act(() => {
      result.current.loadCircuit(seed);
      result.current.setSelection(['a', 'b', 'c']);
    });

    act(() => {
      result.current.distributeSelected('horizontal');
    });

    expect(result.current.components.get('a')?.position.x).toBe(0);
    expect(result.current.components.get('b')?.position.x).toBe(50);
    expect(result.current.components.get('c')?.position.x).toBe(100);
  });

  it('flipSelected horizontally mirrors selected blocks around center', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));

    const seed = emptyCircuit({
      a: makeBlock('a', 0, 0, 20, 10),
      b: makeBlock('b', 30, 0, 10, 10),
      c: makeBlock('c', 50, 0, 30, 10),
    });

    act(() => {
      result.current.loadCircuit(seed);
      result.current.setSelection(['a', 'b', 'c']);
    });

    act(() => {
      result.current.flipSelected('horizontal');
    });

    expect(result.current.components.get('a')?.position.x).toBe(60);
    expect(result.current.components.get('b')?.position.x).toBe(40);
    expect(result.current.components.get('c')?.position.x).toBe(0);
  });

  it('undo/redo restores and reapplies canvas changes', () => {
    const documentId = setupFn();
    const { result } = renderHook(() => useCanvasFacade(documentId));

    const seed = emptyCircuit({ a: makeBlock('a', 10, 10, 10, 10) });
    act(() => {
      result.current.loadCircuit(seed);
      result.current.moveComponent('a', { x: 90, y: 30 });
    });

    expect(result.current.components.get('a')?.position).toEqual({ x: 100, y: 40 });
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.components.get('a')?.position).toEqual({ x: 10, y: 10 });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });

    expect(result.current.components.get('a')?.position).toEqual({ x: 100, y: 40 });
  });
});
