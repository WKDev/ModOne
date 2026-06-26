// InteractionController가 쓰는 순수 기하 헬퍼와 관련 상수 — 인스턴스 상태 의존 없음
import type { HitTestResult, Position, PortPosition } from '../types';

/** Default grid snap step in world-space mm (matches DEFAULT_GRID.size). */
export const DEFAULT_GRID_SNAP = 5;

export const PORT_DIRECTIONS: readonly PortPosition[] = [
  'top',
  'right',
  'bottom',
  'left',
];

export function getDistance(a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function subtract(a: Position, b: Position): Position {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a: Position, b: Position): Position {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function snapDelta(delta: Position, step: number = DEFAULT_GRID_SNAP): Position {
  return {
    x: Math.round(delta.x / step) * step,
    y: Math.round(delta.y / step) * step,
  };
}

export function snapToGrid(pos: Position, step: number = DEFAULT_GRID_SNAP): Position {
  return {
    x: Math.round(pos.x / step) * step,
    y: Math.round(pos.y / step) * step,
  };
}

export function constrainSegmentDelta(
  delta: Position,
  orientation: 'horizontal' | 'vertical' | null
): Position {
  if (orientation === 'horizontal') return { x: 0, y: delta.y };
  if (orientation === 'vertical') return { x: delta.x, y: 0 };
  return delta;
}

export function getPortDirection(target: HitTestResult): PortPosition | null {
  if (typeof target.subIndex !== 'number') return null;
  return PORT_DIRECTIONS[target.subIndex] ?? null;
}

export function rectFromTwoPoints(a: Position, b: Position) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
