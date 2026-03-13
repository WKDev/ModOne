import { describe, expect, it } from 'vitest';

import {
  getGridStepMm,
  normalizeSerializableCircuitState,
} from '../canvasUnits';
import type { SerializableCircuitState } from '../types';

describe('canvasUnits', () => {
  it('converts grid units into canonical mm spacing', () => {
    expect(getGridStepMm(5, 'mm')).toBe(5);
    expect(getGridStepMm(100, 'mil')).toBeCloseTo(2.54, 4);
    expect(getGridStepMm(20, 'px')).toBe(5);
  });

  it('migrates legacy px-based circuit geometry into v2 mm world coordinates', () => {
    const legacy: SerializableCircuitState = {
      components: {
        led1: {
          id: 'led1',
          type: 'led',
          position: { x: 40, y: 20 },
          size: { width: 40, height: 60 },
          ports: [
            {
              id: 'anode',
              type: 'input',
              label: '+',
              position: 'top',
              absolutePosition: { x: 20, y: 0 },
            },
            {
              id: 'cathode',
              type: 'output',
              label: '-',
              position: 'bottom',
              absolutePosition: { x: 20, y: 60 },
            },
          ],
          color: 'red',
          forwardVoltage: 2,
        },
      },
      junctions: {
        j1: {
          id: 'j1',
          position: { x: 80, y: 40 },
        },
      },
      wires: [
        {
          id: 'w1',
          from: { position: { x: 20, y: 20 } },
          to: { junctionId: 'j1' },
          handles: [
            {
              position: { x: 60, y: 40 },
              constraint: 'horizontal',
              source: 'user',
            },
          ],
        },
      ],
      metadata: {
        name: 'Legacy Circuit',
        description: '',
        tags: [],
      },
      viewport: {
        zoom: 1,
        panX: 20,
        panY: 40,
      },
      gridSize: 20,
      showGrid: true,
      gridStyle: 'dots',
      gridUnit: 'px',
    };

    const migrated = normalizeSerializableCircuitState(legacy);

    expect(migrated.version).toBe('2.0');
    expect(migrated.gridUnit).toBe('mm');
    expect(migrated.gridSize).toBe(5);
    expect(migrated.components.led1.position).toEqual({ x: 10, y: 5 });
    expect(migrated.components.led1.size).toEqual({ width: 10, height: 15 });
    expect(migrated.components.led1.ports[0].absolutePosition).toEqual({ x: 5, y: 0 });
    expect(migrated.junctions?.j1.position).toEqual({ x: 20, y: 10 });
    expect(migrated.wires[0].from).toEqual({ position: { x: 5, y: 5 } });
    expect(migrated.wires[0].handles?.[0].position).toEqual({ x: 15, y: 10 });
    expect(migrated.viewport).toEqual({ zoom: 1, panX: 5, panY: 10 });
  });
});
