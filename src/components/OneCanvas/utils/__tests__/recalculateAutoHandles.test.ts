// 블록 반복 이동 시 wire 관절(handle)이 누적되지 않는지 검증하는 회귀 테스트
import { describe, expect, it } from 'vitest';

import type { Block, Junction, Wire, WireHandle } from '../../types';
import {
  recalculateAutoHandles,
  cleanupRedundantHandles,
  snapToGridPosition,
} from '../canvasHelpers';
import { simplifyWireHandles } from '../wireSimplifier';

function makeBlock(
  id: string,
  x: number,
  y: number,
  ports: Array<{ id: string; position: 'top' | 'bottom' | 'left' | 'right'; offset?: number }>,
  w = 100,
  h = 100
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
  } as unknown as Block;
}

function handle(x: number, y: number): WireHandle {
  return { position: { x, y }, constraint: 'free', source: 'user' };
}

/** moveComponent의 와이어 후처리(재계산 + simplify + grid snap + cleanup)를 그대로 복제 */
function applyMovePostProcessing(
  wire: Wire,
  components: Map<string, Block>,
  junctions: Map<string, Junction>
): void {
  wire.handles = recalculateAutoHandles(wire, components, junctions);
  const geom = { components, junctions };
  const simplified = simplifyWireHandles(wire, geom);
  if (simplified !== wire.handles) {
    wire.handles = simplified;
  }
  if (wire.handles) {
    wire.handles = wire.handles.map((h) => ({ ...h, position: snapToGridPosition(h.position, 5, 'mm') }));
  }
  cleanupRedundantHandles(wire);
}

describe('recalculateAutoHandles — 관절 누적 방지', () => {
  it('블록을 여러 번 대각선으로 드래그해도 user 관절 개수가 늘지 않는다', () => {
    // A.top 포트에서 위로 나간 뒤 가로로 꺾이는 형태.
    // 첫 내부 세그먼트(h0→h1)가 수평이라 FROM-side bridge가 collinear-collapse 되지 않는다.
    const a = makeBlock('a', 100, 100, [{ id: 'p', position: 'top' }]);
    const b = makeBlock('b', 300, 100, [{ id: 'p', position: 'top' }]);
    const components = new Map<string, Block>([
      ['a', a],
      ['b', b],
    ]);
    const junctions = new Map<string, Junction>();

    // A.top=(150,100), B.top=(350,100). h0=(150,40) 위로, h1=(350,40) 가로, 그 뒤 B로.
    const wire: Wire = {
      id: 'w1',
      from: { componentId: 'a', portId: 'p' },
      to: { componentId: 'b', portId: 'p' },
      handles: [handle(150, 40), handle(350, 40)],
    };

    const initialCount = wire.handles!.length;

    // 블록 A를 여러 번 대각선으로 이동 (grid=5 배수 유지) 후 매번 재계산
    const moves = [
      { x: 130, y: 120 },  // off-axis → bridge
      { x: 100, y: 40 },   // port x≈h0.x(150)? no: top=150,y=90 — dy align-ish
      { x: 200, y: 120 },  // port x=250 off → bridge on new x line
      { x: 95, y: 145 },
      { x: 300, y: 95 },   // top.x=350 == h1.x
      { x: 75, y: 160 },
      { x: 220, y: 85 },
      { x: 110, y: 130 },
      { x: 260, y: 200 },
      { x: 40, y: 70 },
    ];

    // 사용자는 드래그 도중의 모든 중간 상태를 본다 → 매 이동마다 불변식 검증.
    for (const pos of moves) {
      components.set('a', { ...a, position: pos } as Block);
      applyMovePostProcessing(wire, components, junctions);

      const count = wire.handles?.length ?? 0;
      // 누적되면 안 됨: 초기 2개 + bridge 1개 정도가 상한 (3 이하)
      expect(count, `too many handles after move ${JSON.stringify(pos)}`).toBeLessThanOrEqual(
        initialCount + 1
      );

      // 모든 관절은 grid(5mm) 위에 있어야 한다 — simplify 평균내기가 off-grid를 만들면 실패.
      for (const h of wire.handles ?? []) {
        expect(h.position.x % 5, `handle x off-grid after ${JSON.stringify(pos)}: ${h.position.x}`).toBe(0);
        expect(h.position.y % 5, `handle y off-grid after ${JSON.stringify(pos)}: ${h.position.y}`).toBe(0);
      }
    }
  });
});
