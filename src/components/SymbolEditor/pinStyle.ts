// 핀 전기 타입/모양에 대한 공유 스타일(색·라벨) 정의 — 렌더러와 패널이 함께 사용
import type { PinElectricalType, PinShape } from '../../types/symbol';

/** Electrical type → Pixi fill color (hex). Mirrors KiCad's type-color convention. */
export const PIN_TYPE_COLOR: Record<PinElectricalType, number> = {
  input: 0x22c55e, // green
  output: 0xef4444, // red
  bidirectional: 0x60a5fa, // blue
  power: 0xf59e0b, // amber
  passive: 0x9ca3af, // neutral
};

/** Fallback when a pin has no recognised electrical type. */
export const PIN_DEFAULT_COLOR = 0xff8844;

export function colorForPinType(type: PinElectricalType | undefined): number {
  if (!type) return PIN_DEFAULT_COLOR;
  return PIN_TYPE_COLOR[type] ?? PIN_DEFAULT_COLOR;
}

/** Human-readable labels for the v1 electrical types (Pin Inspector dropdown). */
export const PIN_TYPE_LABEL: Record<PinElectricalType, string> = {
  input: 'Input',
  output: 'Output',
  bidirectional: 'Bidirectional',
  power: 'Power',
  passive: 'Passive',
};

/** Visual pin shapes the editor renders (KiCad-style). */
export const PIN_SHAPE_LABEL: Record<PinShape, string> = {
  line: 'Line',
  inverted: 'Inverted ○',
  clock: 'Clock ▷',
};

export const PIN_SHAPES: PinShape[] = ['line', 'inverted', 'clock'];
export const PIN_TYPES: PinElectricalType[] = [
  'input',
  'output',
  'bidirectional',
  'power',
  'passive',
];
