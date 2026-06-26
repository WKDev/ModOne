// 블록 회전(0,0 원점 기준) 좌표 변환 유틸 — 히트테스트/포트/선택박스 공용
//
// 렌더러(BlockRenderer._applyTransform)와 동일한 변환을 수학적으로 재현한다:
// 블록 로컬 원점(= block.position, 좌상단)을 중심으로 회전하며, Pixi의 양수 회전
// (화면 y-down 기준 시계방향)과 부호가 일치한다. 90/180/270도는 정확값을 쓰므로
// 4×90° 회전 시 rotation 값이 0으로 정규화되어 좌표가 초기와 완전히 동일해진다.

import type { Position, Block } from '../types';

/** -0을 +0으로 정규화 (좌표 동등 비교/직렬화 안정성). */
function nz(v: number): number {
  return v === 0 ? 0 : v;
}

/** (x,y)를 원점 기준으로 degrees 만큼 회전. Pixi와 동일한 양수=시계방향. */
export function rotatePointAroundOrigin(p: Position, degrees: number): Position {
  const n = ((degrees % 360) + 360) % 360;
  if (n === 0) return { x: p.x, y: p.y };
  if (n === 90) return { x: nz(-p.y), y: nz(p.x) };
  if (n === 180) return { x: nz(-p.x), y: nz(-p.y) };
  if (n === 270) return { x: nz(p.y), y: nz(-p.x) };
  const r = (n * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/** 회전이 반영된 블록의 4개 모서리 월드 좌표 [TL, TR, BR, BL]. */
export function getRotatedBlockCorners(
  block: Block
): [Position, Position, Position, Position] {
  const { x, y } = block.position;
  const { width: w, height: h } = block.size;
  const rot = block.rotation ?? 0;
  const locals: Position[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  return locals.map((l) => {
    const r = rotatePointAroundOrigin(l, rot);
    return { x: x + r.x, y: y + r.y };
  }) as [Position, Position, Position, Position];
}

/** 회전된 블록을 감싸는 축정렬 경계상자(브로드페이즈/스파셜인덱스용). */
export function getRotatedBlockAABB(
  block: Block
): { minX: number; minY: number; maxX: number; maxY: number } {
  const corners = getRotatedBlockCorners(block);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  return { minX, minY, maxX, maxY };
}

/** 월드 좌표 점이 회전된 블록 내부에 있는지(OBB 정밀 판정). */
export function isPointInRotatedBlock(point: Position, block: Block): boolean {
  const rot = block.rotation ?? 0;
  // 클릭점을 블록 로컬 좌표계로 역회전시켜 축정렬 사각형과 비교
  const local = rotatePointAroundOrigin(
    { x: point.x - block.position.x, y: point.y - block.position.y },
    -rot
  );
  return (
    local.x >= 0 &&
    local.x <= block.size.width &&
    local.y >= 0 &&
    local.y <= block.size.height
  );
}
