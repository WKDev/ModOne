import { beforeEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';

import { useCanvasStore } from '../canvasStore';
import type { Block, SerializableCircuitState } from '../../components/OneCanvas/types';

function makeBlock(id: string, x: number, y: number): Block {
  return {
    id,
    type: 'led',
    position: { x, y },
    size: { width: 10, height: 10 },
    ports: [],
    color: 'red',
    forwardVoltage: 2,
  };
}

function seedCircuit(): SerializableCircuitState {
  return {
    components: { a: makeBlock('a', 0, 0) },
    wires: [],
    metadata: {
      name: 'Redo Regression',
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

describe('canvasStore redo regression', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  it('reaches the final history entry after undoing to the beginning', () => {
    act(() => {
      const store = useCanvasStore.getState();
      store.loadCircuit(seedCircuit());
      store.moveComponent('a', { x: 20, y: 0 });
      store.moveComponent('a', { x: 40, y: 0 });
      store.moveComponent('a', { x: 60, y: 0 });
    });

    act(() => {
      const store = useCanvasStore.getState();
      store.undo();
      store.undo();
      store.undo();
    });

    expect(useCanvasStore.getState().components.get('a')?.position).toEqual({ x: 0, y: 0 });

    act(() => {
      const store = useCanvasStore.getState();
      store.redo();
      store.redo();
      store.redo();
    });

    expect(useCanvasStore.getState().components.get('a')?.position).toEqual({ x: 60, y: 0 });
  });
});
