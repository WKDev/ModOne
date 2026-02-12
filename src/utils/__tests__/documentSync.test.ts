import { describe, expect, it } from 'vitest';

import type { Block, SerializableCircuitState } from '../../components/OneCanvas/types';
import {
  mergeCanvasData,
  mergeCanvasDocumentData,
  shouldAcceptRemoteUpdate,
} from '../documentSync';

function makeLed(id: string, label: string): Block {
  return {
    id,
    type: 'led',
    position: { x: 0, y: 0 },
    size: { width: 40, height: 30 },
    ports: [],
    color: 'red',
    forwardVoltage: 2,
    label,
  };
}

function makeCircuit(overrides: Partial<SerializableCircuitState> = {}): SerializableCircuitState {
  return {
    components: {},
    junctions: {},
    wires: [],
    metadata: {
      name: 'Test Circuit',
      description: '',
      tags: [],
    },
    viewport: {
      zoom: 1,
      panX: 0,
      panY: 0,
    },
    ...overrides,
  };
}

describe('shouldAcceptRemoteUpdate', () => {
  it('accepts remote update when remote revision is higher', () => {
    expect(shouldAcceptRemoteUpdate(3, 100, 4, 90)).toBe(true);
  });

  it('rejects remote update when remote revision is lower', () => {
    expect(shouldAcceptRemoteUpdate(4, 100, 3, 999)).toBe(false);
  });

  it('accepts higher timestamp when revisions are equal', () => {
    expect(shouldAcceptRemoteUpdate(2, 100, 2, 101)).toBe(true);
  });

  it('rejects lower timestamp when revisions are equal', () => {
    expect(shouldAcceptRemoteUpdate(2, 100, 2, 99)).toBe(false);
  });

  it('rejects equal timestamp when revisions are equal', () => {
    expect(shouldAcceptRemoteUpdate(2, 100, 2, 100)).toBe(false);
  });
});

describe('mergeCanvasData', () => {
  it('remote component overwrites local component with same id', () => {
    const local = makeCircuit({
      components: { a: makeLed('a', 'local') },
    });
    const remote = makeCircuit({
      components: { a: makeLed('a', 'remote') },
    });

    const merged = mergeCanvasData(local, remote);

    expect(merged.components.a.label).toBe('remote');
  });

  it('preserves local-only components while adding remote-only components', () => {
    const local = makeCircuit({
      components: { localOnly: makeLed('localOnly', 'L') },
    });
    const remote = makeCircuit({
      components: { remoteOnly: makeLed('remoteOnly', 'R') },
    });

    const merged = mergeCanvasData(local, remote);

    expect(Object.keys(merged.components).sort()).toEqual(['localOnly', 'remoteOnly']);
  });

  it('uses remote wires array entirely', () => {
    const local = makeCircuit({
      wires: [{ id: 'local-wire', from: { componentId: 'a', portId: 'p1' }, to: { componentId: 'b', portId: 'p2' } }],
    });
    const remote = makeCircuit({
      wires: [{ id: 'remote-wire', from: { componentId: 'c', portId: 'p3' }, to: { componentId: 'd', portId: 'p4' } }],
    });

    const merged = mergeCanvasData(local, remote);

    expect(merged.wires).toEqual(remote.wires);
    expect(merged.wires).not.toEqual(local.wires);
  });

  it('merges junction records with remote overwrite semantics', () => {
    const local = makeCircuit({
      junctions: {
        keep: { id: 'keep', position: { x: 1, y: 1 } },
        shared: { id: 'shared', position: { x: 2, y: 2 } },
      },
    });
    const remote = makeCircuit({
      junctions: {
        shared: { id: 'shared', position: { x: 9, y: 9 } },
      },
    });

    const merged = mergeCanvasData(local, remote);

    expect(merged.junctions).toEqual({
      keep: { id: 'keep', position: { x: 1, y: 1 } },
      shared: { id: 'shared', position: { x: 9, y: 9 } },
    });
  });

  it('falls back to local viewport when remote viewport is undefined', () => {
    const local = makeCircuit({ viewport: { zoom: 2, panX: 10, panY: 20 } });
    const remote = makeCircuit({ viewport: undefined });

    const merged = mergeCanvasDocumentData(local, remote);

    expect(merged.viewport).toEqual({ zoom: 2, panX: 10, panY: 20 });
  });
});
