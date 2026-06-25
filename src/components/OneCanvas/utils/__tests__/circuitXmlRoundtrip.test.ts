import { describe, it, expect } from 'vitest';
import { circuitToXml, xmlToCircuit, createDefaultCircuitXml } from '../serialization';
import { createDefaultCircuit } from '../serialization';
import type { Block, Wire } from '../../types';
import type { CircuitState } from '../../types';

function buildCircuit(): CircuitState {
  const state = createDefaultCircuit('RoundTrip');
  state.metadata.description = 'desc & <special>';
  state.metadata.tags = ['a', 'b'];

  const block = {
    id: 'c1',
    type: 'powersource',
    position: { x: 15, y: 25 },
    size: { width: 40, height: 40 },
    label: 'P1',
    ports: [
      {
        id: 'p1',
        type: 'output',
        label: 'V+',
        position: 'right',
        offset: 5,
        absolutePosition: { x: 55, y: 25 },
      },
    ],
    // arbitrary properties of mixed types
    voltage: 24,
    polarity: 'positive',
    enabled: true,
    config: { mode: 'dc', nested: [1, 2] },
  } as unknown as Block;
  state.components.set(block.id, block);

  const wire = {
    id: 'w1',
    from: { kind: 'port', componentId: 'c1', portId: 'p1' },
    to: { kind: 'floating', position: { x: 100, y: 25 } },
    color: '#ff0000',
  } as unknown as Wire;
  state.wires.push(wire);

  return state;
}

describe('circuit XML serialization', () => {
  it('round-trips a circuit through XML', () => {
    const original = buildCircuit();
    const xml = circuitToXml(original);
    expect(xml).toContain('<circuit version=');
    expect(xml).toContain('<component id="c1"');

    const restored = xmlToCircuit(xml);

    // metadata
    expect(restored.metadata.name).toBe('RoundTrip');
    expect(restored.metadata.description).toBe('desc & <special>');
    expect(restored.metadata.tags).toEqual(['a', 'b']);

    // component + properties of mixed types
    const c1 = restored.components.get('c1') as unknown as Record<string, unknown>;
    expect(c1).toBeTruthy();
    expect(c1.type).toBe('powersource');
    expect(c1.position).toEqual({ x: 15, y: 25 });
    expect(c1.label).toBe('P1');
    expect(c1.voltage).toBe(24);
    expect(c1.polarity).toBe('positive');
    expect(c1.enabled).toBe(true);
    expect(c1.config).toEqual({ mode: 'dc', nested: [1, 2] });

    // port offset + absolutePosition survive
    const ports = c1.ports as Array<Record<string, unknown>>;
    const p1 = ports.find((p) => p.id === 'p1')!;
    expect(p1.position).toBe('right');
    expect(p1.offset).toBe(5);
    expect(p1.absolutePosition).toEqual({ x: 55, y: 25 });

    // wire endpoints (port + floating) and color
    const w1 = restored.wires.find((w) => w.id === 'w1')!;
    expect(w1.color).toBe('#ff0000');
    expect(w1.from).toMatchObject({ componentId: 'c1', portId: 'p1' });
    expect(w1.to).toMatchObject({ position: { x: 100, y: 25 } });
  });

  it('creates a valid default circuit XML', () => {
    const xml = createDefaultCircuitXml('Empty');
    const restored = xmlToCircuit(xml);
    expect(restored.metadata.name).toBe('Empty');
    expect(restored.components.size).toBe(0);
    expect(restored.wires).toHaveLength(0);
  });
});
