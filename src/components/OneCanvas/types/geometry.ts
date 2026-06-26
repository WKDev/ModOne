// ============================================================================
// Block Types
// ============================================================================

/** Legacy block types (for migration) */
export type LegacyBlockType = 'power_24v' | 'power_12v' | 'gnd';

/** Polarity for power source blocks */
export type PowerPolarity = 'positive' | 'negative' | 'ground';

/** Position in canvas coordinates */
export interface Position {
  x: number;
  y: number;
}

/**
 * Screen Space Position (viewport/screen pixel coordinates)
 * - Direct mouse event coordinates
 * - Affected by zoom/pan
 */
export interface ScreenPosition {
  readonly _brand: 'ScreenPosition';
  x: number;
  y: number;
}

/**
 * Container Space Position (컨테이너 기준 상대 좌표)
 * - getBoundingClientRect 기준
 * - zoom/pan 영향 없음
 */
export interface ContainerPosition {
  readonly _brand: 'ContainerPosition';
  x: number;
  y: number;
}

/**
 * Canvas Space Position (논리적 캔버스 좌표)
 * - Block, Wire 등의 실제 위치
 * - zoom/pan 독립적
 */
export interface CanvasPosition {
  readonly _brand: 'CanvasPosition';
  x: number;
  y: number;
}

// Helper functions for type conversion
export function toScreenPos(pos: Position): ScreenPosition {
  return { ...pos, _brand: 'ScreenPosition' as const };
}

export function toContainerPos(pos: Position): ContainerPosition {
  return { ...pos, _brand: 'ContainerPosition' as const };
}

export function toCanvasPos(pos: Position): CanvasPosition {
  return { ...pos, _brand: 'CanvasPosition' as const };
}

/** Size of a block */
export interface Size {
  width: number;
  height: number;
}

