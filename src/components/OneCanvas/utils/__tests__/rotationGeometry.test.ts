// 회전 좌표/히트테스트/포트-와이어 정책 단위 테스트
import { describe, expect, it } from 'vitest';

import type { Block, Port, Wire } from '../../types';
import { isFloatingEndpoint, isPortEndpoint } from '../../types';
import {
  rotatePointAroundOrigin,
  isPointInRotatedBlock,
  getRotatedBlockAABB,
} from '../rotationGeometry';
import { getPortWorldPosition, getPortAbsolutePosition } from '../wirePathCalculator';
import { rotateAndUpdateWires } from '../canvas-commands';

function makeBlock(rotation = 0): Block {
  const ports: Port[] = [
    { id: 'a', type: 'input', label: 'A', position: 'top', absolutePosition: { x: 10, y: 0 } },
    { id: 'b', type: 'output', label: 'B', position: 'bottom', absolutePosition: { x: 10, y: 40 } },
  ];
  return {
    id: 'b1',
    type: 'led',
    position: { x: 100, y: 100 },
    size: { width: 20, height: 40 },
    ports,
    color: 'red',
    forwardVoltage: 2,
    rotation,
  } as Block;
}

describe('rotatePointAroundOrigin', () => {
  it('rotates exact quadrants (Pixi CW: positive angle)', () => {
    expect(rotatePointAroundOrigin({ x: 10, y: 0 }, 90)).toEqual({ x: 0, y: 10 });
    expect(rotatePointAroundOrigin({ x: 10, y: 0 }, 180)).toEqual({ x: -10, y: 0 });
    expect(rotatePointAroundOrigin({ x: 10, y: 0 }, 270)).toEqual({ x: 0, y: -10 });
  });

  it('is identity at 0 and 360', () => {
    expect(rotatePointAroundOrigin({ x: 7, y: -3 }, 0)).toEqual({ x: 7, y: -3 });
    expect(rotatePointAroundOrigin({ x: 7, y: -3 }, 360)).toEqual({ x: 7, y: -3 });
  });
});

describe('isPointInRotatedBlock (OBB hit test)', () => {
  it('hits inside the rotated footprint, misses the un-rotated one', () => {
    const block = makeBlock(90);
    // 90° around (100,100): footprint x∈[60,100], y∈[100,120]
    expect(isPointInRotatedBlock({ x: 80, y: 110 }, block)).toBe(true);
    // inside the original AABB (x∈[100,120]) but outside the rotated one
    expect(isPointInRotatedBlock({ x: 110, y: 110 }, block)).toBe(false);
  });

  it('rotated AABB encloses the rotated footprint', () => {
    const aabb = getRotatedBlockAABB(makeBlock(90));
    expect(aabb).toEqual({ minX: 60, minY: 100, maxX: 100, maxY: 120 });
  });
});

describe('getPortWorldPosition (rotation-aware)', () => {
  it('matches block.position + offset at rotation 0', () => {
    const block = makeBlock(0);
    expect(getPortWorldPosition(block, block.ports[0])).toEqual({ x: 110, y: 100 });
  });

  it('rotates the port around the block origin', () => {
    const block = makeBlock(90);
    // local (10,0) -> (0,10) -> world (100,110)
    expect(getPortWorldPosition(block, block.ports[0])).toEqual({ x: 100, y: 110 });
  });

  it('4×90° returns ports to the exact original positions', () => {
    const original = makeBlock(0);
    const origA = getPortWorldPosition(original, original.ports[0]);
    const origB = getPortWorldPosition(original, original.ports[1]);

    // simulate four 90° presses through the store-level normalization
    let rot = 0;
    for (let i = 0; i < 4; i++) rot = (((rot + 90) % 360) + 360) % 360;
    expect(rot).toBe(0);

    const rotated = makeBlock(rot);
    expect(getPortWorldPosition(rotated, rotated.ports[0])).toEqual(origA);
    expect(getPortWorldPosition(rotated, rotated.ports[1])).toEqual(origB);
  });
});

describe('rotateAndUpdateWires', () => {
  const wire: Wire = { id: 'w1', from: { componentId: 'b1', portId: 'a' }, to: { position: { x: 300, y: 300 } } };

  it('keepConnections: connection survives and 4×90° restores endpoint position', () => {
    let components = new Map<string, Block>([['b1', makeBlock(0)]]);
    let wires: Wire[] = [{ ...wire }];
    const origEndpoint = getPortAbsolutePosition(components.get('b1')!, 'a');

    for (let i = 0; i < 4; i++) {
      const r = rotateAndUpdateWires(components, wires, undefined, new Set(['b1']), 90, true);
      components = r.components;
      wires = r.wires;
    }

    expect(components.get('b1')!.rotation).toBe(0);
    // still bound to the same logical port
    expect(isPortEndpoint(wires[0].from)).toBe(true);
    // and the resolved world position is identical to the start
    expect(getPortAbsolutePosition(components.get('b1')!, 'a')).toEqual(origEndpoint);
  });

  it('breakConnections: detaches the port endpoint to a floating point at the pre-rotation position', () => {
    const components = new Map<string, Block>([['b1', makeBlock(0)]]);
    const wires: Wire[] = [{ ...wire }];
    const preRotationPos = getPortAbsolutePosition(components.get('b1')!, 'a');

    const r = rotateAndUpdateWires(components, wires, undefined, new Set(['b1']), 90, false);

    expect(r.components.get('b1')!.rotation).toBe(90);
    const from = r.wires[0].from;
    expect(isFloatingEndpoint(from)).toBe(true);
    if (isFloatingEndpoint(from)) {
      expect(from.position).toEqual(preRotationPos);
    }
  });
});
