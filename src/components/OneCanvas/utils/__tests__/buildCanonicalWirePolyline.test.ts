import { describe, expect, it } from 'vitest';

import type { Block, GeomApi, Junction, Position, Wire, WireHandle } from '../../types';
import { buildCanonicalWirePolyline } from '../wireSimplifier';

function makeBlock(
  id: string,
  x: number,
  y: number,
  ports: Array<{ id: string; position: 'top' | 'bottom' | 'left' | 'right'; offset?: number }>,
  w: number = 100,
  h: number = 100
): Block {
  return {
    id,
    type: 'led',
    position: { x, y },
    size: { width: w, height: h },
    ports: ports.map((port) => ({
      id: port.id,
      type: 'bidirectional',
      label: port.id,
      position: port.position,
      offset: port.offset,
    })),
    color: 'red',
    forwardVoltage: 2,
  };
}

function makeGeom(blocks: Block[], junctions: Junction[] = []): GeomApi {
  return {
    components: new Map(blocks.map((block) => [block.id, block])),
    junctions: new Map(junctions.map((junction) => [junction.id, junction])),
  };
}

function makeHandle(id: string, x: number, y: number): WireHandle {
  return {
    id,
    position: { x, y },
    constraint: 'free',
    source: 'user',
  };
}

function assertOrthogonal(poly: Position[]) {
  for (let i = 0; i < poly.length - 1; i++) {
    const dx = Math.abs(poly[i].x - poly[i + 1].x);
    const dy = Math.abs(poly[i].y - poly[i + 1].y);
    expect(dx < 1 || dy < 1).toBe(true);
  }
}

describe('buildCanonicalWirePolyline', () => {
  it('builds orthogonal polyline for same-axis port-to-port (right -> left)', () => {
    const geom = makeGeom([
      makeBlock('a', 0, 0, [{ id: 'out', position: 'right' }]),
      makeBlock('b', 300, 0, [{ id: 'in', position: 'left' }]),
    ]);

    const wire: Wire = {
      id: 'w1',
      from: { componentId: 'a', portId: 'out' },
      to: { componentId: 'b', portId: 'in' },
      routingMode: 'manual',
    };

    const poly = buildCanonicalWirePolyline(wire, geom);
    expect(poly).not.toBeNull();
    expect(poly?.length).toBe(4);
    assertOrthogonal(poly!);
  });

  it('builds orthogonal polyline for different directions (right -> bottom)', () => {
    const geom = makeGeom([
      makeBlock('a', 0, 0, [{ id: 'out', position: 'right' }]),
      makeBlock('b', 300, 180, [{ id: 'in', position: 'bottom' }]),
    ]);

    const wire: Wire = {
      id: 'w2',
      from: { componentId: 'a', portId: 'out' },
      to: { componentId: 'b', portId: 'in' },
      routingMode: 'manual',
    };

    const poly = buildCanonicalWirePolyline(wire, geom);
    expect(poly).not.toBeNull();
    assertOrthogonal(poly!);
  });

  it('preserves exit -> handles -> exit ordering when handles exist', () => {
    const geom = makeGeom([
      makeBlock('a', 0, 0, [{ id: 'out', position: 'right' }]),
      makeBlock('b', 320, 80, [{ id: 'in', position: 'left' }]),
    ]);

    const handles = [
      makeHandle('h1', 160, 70),
      makeHandle('h2', 190, 70),
      makeHandle('h3', 190, 110),
    ];

    const wire: Wire = {
      id: 'w3',
      from: { componentId: 'a', portId: 'out' },
      to: { componentId: 'b', portId: 'in' },
      handles,
      routingMode: 'manual',
    };

    const poly = buildCanonicalWirePolyline(wire, geom)!;
    const fromExit = { x: 120, y: 50 };
    const toExit = { x: 300, y: 130 };
    const fromExitIndex = poly.findIndex((p) => Math.abs(p.x - fromExit.x) < 1 && Math.abs(p.y - fromExit.y) < 1);
    const toExitIndex = poly.findIndex((p) => Math.abs(p.x - toExit.x) < 1 && Math.abs(p.y - toExit.y) < 1);
    const handleIndices = handles.map((h) =>
      poly.findIndex((p) => Math.abs(p.x - h.position.x) < 1 && Math.abs(p.y - h.position.y) < 1)
    );

    expect(fromExitIndex).toBeGreaterThan(0);
    expect(handleIndices.every((idx) => idx > fromExitIndex)).toBe(true);
    expect(handleIndices.every((idx) => idx < toExitIndex)).toBe(true);
    assertOrthogonal(poly);
  });

  it('returns four points for direct wire without handles', () => {
    const geom = makeGeom([
      makeBlock('a', 0, 0, [{ id: 'out', position: 'right' }]),
      makeBlock('b', 300, 0, [{ id: 'in', position: 'left' }]),
    ]);

    const wire: Wire = {
      id: 'w4',
      from: { componentId: 'a', portId: 'out' },
      to: { componentId: 'b', portId: 'in' },
      handles: [],
      routingMode: 'manual',
    };

    const poly = buildCanonicalWirePolyline(wire, geom);
    expect(poly).not.toBeNull();
    expect(poly?.length).toBe(4);
    assertOrthogonal(poly!);
  });

  it('clamps exit distance for short wires (<40px)', () => {
    const geom = makeGeom([
      makeBlock('a', 0, 0, [{ id: 'out', position: 'right' }], 20, 20),
      makeBlock('b', 30, 0, [{ id: 'in', position: 'left' }], 20, 20),
    ]);

    const wire: Wire = {
      id: 'w5',
      from: { componentId: 'a', portId: 'out' },
      to: { componentId: 'b', portId: 'in' },
      routingMode: 'manual',
    };

    const poly = buildCanonicalWirePolyline(wire, geom)!;
    const fromPos = poly[0];
    const fromExit = poly[1];
    const toExit = poly[poly.length - 2];
    const toPos = poly[poly.length - 1];

    expect(fromExit.x - fromPos.x).toBeLessThanOrEqual(10);
    expect(toPos.x - toExit.x).toBeLessThanOrEqual(10);
    expect(fromExit.x).toBeLessThan(toPos.x);
    expect(toExit.x).toBeGreaterThan(fromPos.x);
    assertOrthogonal(poly);
  });

  it('uses junction position for junction endpoints', () => {
    const geom = makeGeom(
      [makeBlock('b', 300, 0, [{ id: 'in', position: 'left' }])],
      [{ id: 'j1', position: { x: 90, y: 60 } }]
    );

    const wire: Wire = {
      id: 'w6',
      from: { junctionId: 'j1' },
      to: { componentId: 'b', portId: 'in' },
      routingMode: 'manual',
    };

    const poly = buildCanonicalWirePolyline(wire, geom)!;
    expect(poly[0]).toEqual({ x: 90, y: 60 });
    assertOrthogonal(poly);
  });

  it('ensures every consecutive segment is orthogonal', () => {
    const geom = makeGeom([
      makeBlock('a', 0, 0, [{ id: 'out', position: 'right' }]),
      makeBlock('b', 320, 180, [{ id: 'in', position: 'left' }]),
    ]);

    const wire: Wire = {
      id: 'w7',
      from: { componentId: 'a', portId: 'out' },
      to: { componentId: 'b', portId: 'in' },
      handles: [makeHandle('h1', 140, 120), makeHandle('h2', 240, 90)],
      routingMode: 'manual',
    };

    const poly = buildCanonicalWirePolyline(wire, geom)!;
    assertOrthogonal(poly);
  });

  it('applies simplifyOrthogonal so no collinear middle points remain', () => {
    const geom = makeGeom([
      makeBlock('a', 0, 0, [{ id: 'out', position: 'right' }]),
      makeBlock('b', 300, 80, [{ id: 'in', position: 'left' }]),
    ]);

    const wire: Wire = {
      id: 'w8',
      from: { componentId: 'a', portId: 'out' },
      to: { componentId: 'b', portId: 'in' },
      handles: [makeHandle('h1', 140, 50), makeHandle('h2', 160, 50), makeHandle('h3', 180, 50)],
      routingMode: 'manual',
    };

    const poly = buildCanonicalWirePolyline(wire, geom)!;
    assertOrthogonal(poly);
    const retainedCollinearHandles = wire.handles!.filter((handle) =>
      poly.some((point) => Math.abs(point.x - handle.position.x) < 1 && Math.abs(point.y - handle.position.y) < 1)
    ).length;
    expect(retainedCollinearHandles).toBeLessThan(3);
  });
});
