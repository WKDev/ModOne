import { describe, expect, it } from 'vitest';

import type { Block, GeomApi, Junction, Position, Wire, WireHandle } from '../../types';
import {
  buildCanonicalWirePolyline,
  enforceOrthogonalPolyline,
  polylineToHandles,
} from '../wireSimplifier';

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
    components: new Map(blocks.map((b) => [b.id, b])),
    junctions: new Map(junctions.map((j) => [j.id, j])),
  };
}

function makeHandle(id: string, x: number, y: number): WireHandle {
  return { id, position: { x, y }, constraint: 'free', source: 'user' };
}

function assertOrthogonal(poly: Position[]) {
  for (let i = 0; i < poly.length - 1; i++) {
    const dx = Math.abs(poly[i].x - poly[i + 1].x);
    const dy = Math.abs(poly[i].y - poly[i + 1].y);
    expect(dx < 1 || dy < 1, `segment ${i} is diagonal: dx=${dx} dy=${dy}`).toBe(true);
  }
}

/**
 * Replicates the private stripCanonicalExitPoints function from interactionMachine.ts.
 * NOT exported — tested inline here.
 * [fromPos, fromExit, ...handles, toExit, toPos] → [fromPos, ...handles, toPos]
 */
function stripCanonicalExitPoints(poly: readonly Position[]): Position[] {
  const interior = poly.slice(2, -2).map((p) => ({ ...p }));
  return [{ ...poly[0] }, ...interior, { ...poly[poly.length - 1] }];
}

describe('wire geometry round-trip integration', () => {
  it('round-trip: buildCanonicalWirePolyline -> stripExits -> polylineToHandles -> rebuild preserves geometry', () => {
    const geom = makeGeom([
      makeBlock('a', 0, 0, [{ id: 'out', position: 'right' }]),
      makeBlock('b', 300, 80, [{ id: 'in', position: 'left' }]),
    ]);

    const wire: Wire = {
      id: 'w1',
      from: { componentId: 'a', portId: 'out' },
      to: { componentId: 'b', portId: 'in' },
      routingMode: 'manual',
    };

    const poly1 = buildCanonicalWirePolyline(wire, geom);
    expect(poly1).not.toBeNull();
    assertOrthogonal(poly1!);

    const stripped = stripCanonicalExitPoints(poly1!);
    const newHandles = polylineToHandles(stripped, [], 'auto');
    const wire2: Wire = { ...wire, handles: newHandles };
    const poly2 = buildCanonicalWirePolyline(wire2, geom);
    expect(poly2).not.toBeNull();
    assertOrthogonal(poly2!);

    expect(Math.abs(poly2![0].x - poly1![0].x)).toBeLessThan(1);
    expect(Math.abs(poly2![0].y - poly1![0].y)).toBeLessThan(1);
    expect(Math.abs(poly2![poly2!.length - 1].x - poly1![poly1!.length - 1].x)).toBeLessThan(1);
    expect(Math.abs(poly2![poly2!.length - 1].y - poly1![poly1!.length - 1].y)).toBeLessThan(1);
  });

  it('enforceOrthogonalPolyline inserts bridge points for diagonal input', () => {
    const diagonalPoly: Position[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ];

    const result = enforceOrthogonalPolyline(diagonalPoly);

    assertOrthogonal(result);
    expect(result.length).toBeGreaterThan(diagonalPoly.length);
    expect(result[0]).toMatchObject({ x: 0, y: 0 });
    expect(result[result.length - 1]).toMatchObject({ x: 200, y: 100 });
  });

  it('enforceOrthogonalPolyline leaves an already-orthogonal polyline unchanged', () => {
    const orthoPoly: Position[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
      { x: 200, y: 80 },
    ];

    const result = enforceOrthogonalPolyline(orthoPoly);

    assertOrthogonal(result);
    expect(result[0]).toMatchObject({ x: 0, y: 0 });
    expect(result[result.length - 1]).toMatchObject({ x: 200, y: 80 });
    expect(result.length).toBe(orthoPoly.length);
  });

  it('stripCanonicalExitPoints removes fromExit (index 1) and toExit (index -2)', () => {
    const fromPos: Position = { x: 0, y: 50 };
    const fromExit: Position = { x: 20, y: 50 };
    const handle: Position = { x: 100, y: 50 };
    const toExit: Position = { x: 180, y: 50 };
    const toPos: Position = { x: 200, y: 50 };

    const stripped = stripCanonicalExitPoints([fromPos, fromExit, handle, toExit, toPos]);

    expect(stripped.length).toBe(3);
    expect(stripped[0]).toMatchObject(fromPos);
    expect(stripped[1]).toMatchObject(handle);
    expect(stripped[2]).toMatchObject(toPos);

    const hasFromExit = stripped.some(
      (p) => Math.abs(p.x - fromExit.x) < 1 && Math.abs(p.y - fromExit.y) < 1
    );
    const hasToExit = stripped.some(
      (p) => Math.abs(p.x - toExit.x) < 1 && Math.abs(p.y - toExit.y) < 1
    );
    expect(hasFromExit).toBe(false);
    expect(hasToExit).toBe(false);
  });

  it('handles from polylineToHandles(stripped canonical poly) do not contain exit points', () => {
    const geom = makeGeom([
      makeBlock('a', 0, 0, [{ id: 'out', position: 'right' }]),
      makeBlock('b', 300, 80, [{ id: 'in', position: 'left' }]),
    ]);

    const wire: Wire = {
      id: 'w2',
      from: { componentId: 'a', portId: 'out' },
      to: { componentId: 'b', portId: 'in' },
      routingMode: 'manual',
    };

    const canonicalPoly = buildCanonicalWirePolyline(wire, geom)!;
    expect(canonicalPoly.length).toBeGreaterThanOrEqual(4);

    const fromExit = canonicalPoly[1];
    const toExit = canonicalPoly[canonicalPoly.length - 2];

    const stripped = stripCanonicalExitPoints(canonicalPoly);
    const handles = polylineToHandles(stripped, [], 'auto');

    for (const h of handles) {
      const isFromExit =
        Math.abs(h.position.x - fromExit.x) < 1 && Math.abs(h.position.y - fromExit.y) < 1;
      const isToExit =
        Math.abs(h.position.x - toExit.x) < 1 && Math.abs(h.position.y - toExit.y) < 1;
      expect(isFromExit).toBe(false);
      expect(isToExit).toBe(false);
    }
  });

  it('canonical poly for a short wire (<40 px) has clamped exit distance', () => {
    const geom = makeGeom([
      makeBlock('a', 0, 0, [{ id: 'out', position: 'right' }], 20, 20),
      makeBlock('b', 30, 0, [{ id: 'in', position: 'left' }], 20, 20),
    ]);

    const wire: Wire = {
      id: 'w3',
      from: { componentId: 'a', portId: 'out' },
      to: { componentId: 'b', portId: 'in' },
      routingMode: 'manual',
    };

    const poly = buildCanonicalWirePolyline(wire, geom)!;
    expect(poly).not.toBeNull();
    assertOrthogonal(poly);

    const fromPos = poly[0];
    const fromExit = poly[1];
    const exitDist = Math.hypot(fromExit.x - fromPos.x, fromExit.y - fromPos.y);
    expect(exitDist).toBeLessThan(20);
    expect(fromExit.x).toBeLessThan(poly[poly.length - 1].x);
  });

  it('all output segments are orthogonal for diverse port-direction combinations', () => {
    const configs: Array<{
      aDir: 'top' | 'bottom' | 'left' | 'right';
      bDir: 'top' | 'bottom' | 'left' | 'right';
      bX: number;
      bY: number;
    }> = [
      { aDir: 'right',  bDir: 'left',   bX: 300,  bY: 0   },
      { aDir: 'right',  bDir: 'bottom', bX: 300,  bY: 180 },
      { aDir: 'bottom', bDir: 'top',    bX: 0,    bY: 300 },
      { aDir: 'top',    bDir: 'right',  bX: 200,  bY: -200 },
      { aDir: 'left',   bDir: 'right',  bX: -300, bY: 50  },
    ];

    for (const { aDir, bDir, bX, bY } of configs) {
      const geom = makeGeom([
        makeBlock('a', 0, 0, [{ id: 'out', position: aDir }]),
        makeBlock('b', bX, bY, [{ id: 'in', position: bDir }]),
      ]);
      const wire: Wire = {
        id: 'wtest',
        from: { componentId: 'a', portId: 'out' },
        to: { componentId: 'b', portId: 'in' },
        routingMode: 'manual',
      };

      const poly = buildCanonicalWirePolyline(wire, geom);
      expect(poly).not.toBeNull();
      assertOrthogonal(poly!);
    }
  });

  it('round-trip with user-placed handles also produces stable geometry', () => {
    const geom = makeGeom([
      makeBlock('a', 0, 0, [{ id: 'out', position: 'right' }]),
      makeBlock('b', 320, 160, [{ id: 'in', position: 'left' }]),
    ]);

    const wire: Wire = {
      id: 'w4',
      from: { componentId: 'a', portId: 'out' },
      to: { componentId: 'b', portId: 'in' },
      handles: [makeHandle('h1', 200, 50), makeHandle('h2', 200, 210)],
      routingMode: 'manual',
    };

    const poly1 = buildCanonicalWirePolyline(wire, geom)!;
    expect(poly1).not.toBeNull();
    assertOrthogonal(poly1);

    const stripped = stripCanonicalExitPoints(poly1);
    const newHandles = polylineToHandles(stripped, wire.handles, 'user');
    const wire2: Wire = { ...wire, handles: newHandles };

    const poly2 = buildCanonicalWirePolyline(wire2, geom)!;
    expect(poly2).not.toBeNull();
    assertOrthogonal(poly2);

    expect(Math.abs(poly2[0].x - poly1[0].x)).toBeLessThan(1);
    expect(Math.abs(poly2[0].y - poly1[0].y)).toBeLessThan(1);
    expect(Math.abs(poly2[poly2.length - 1].x - poly1[poly1.length - 1].x)).toBeLessThan(1);
    expect(Math.abs(poly2[poly2.length - 1].y - poly1[poly1.length - 1].y)).toBeLessThan(1);
  });
});
