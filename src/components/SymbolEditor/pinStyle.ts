// 핀 전기 타입/모양에 대한 공유 스타일(색·라벨) 정의 — 렌더러와 패널이 함께 사용
import type {
  PinElectricalType,
  PinElectricalTypeV2,
  PinFunctionalRole,
  PinShape,
} from '../../types/symbol';

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

// ── v2: KiCad-compatible detailed electrical type (전원/접지 시맨틱 저작용) ──

/** Detailed electrical types — needed to author power_in/power_out for sources & ground. */
export const PIN_ELECTRICAL_TYPES_V2: PinElectricalTypeV2[] = [
  'input', 'output', 'bidirectional', 'tri_state', 'passive',
  'power_in', 'power_out', 'open_collector', 'open_emitter',
  'free', 'unspecified', 'no_connect',
];

export const PIN_ELECTRICAL_TYPE_V2_LABEL: Record<PinElectricalTypeV2, string> = {
  input: 'Input',
  output: 'Output',
  bidirectional: 'Bidirectional',
  tri_state: 'Tri-state',
  passive: 'Passive',
  power_in: 'Power Input',
  power_out: 'Power Output',
  open_collector: 'Open Collector',
  open_emitter: 'Open Emitter',
  free: 'Free',
  unspecified: 'Unspecified',
  no_connect: 'No Connect',
};

/** Map a detailed v2 type down to its coarse v1 category (drives pin color + simple type). */
export const V2_TO_V1_CATEGORY: Record<PinElectricalTypeV2, PinElectricalType> = {
  input: 'input',
  output: 'output',
  bidirectional: 'bidirectional',
  tri_state: 'output',
  passive: 'passive',
  power_in: 'power',
  power_out: 'power',
  open_collector: 'output',
  open_emitter: 'output',
  free: 'passive',
  unspecified: 'passive',
  no_connect: 'passive',
};

export const PIN_FUNCTIONAL_ROLES: PinFunctionalRole[] = [
  'general', 'plc_input', 'plc_output', 'communication',
];

export const PIN_FUNCTIONAL_ROLE_LABEL: Record<PinFunctionalRole, string> = {
  general: 'General',
  plc_input: 'PLC Input',
  plc_output: 'PLC Output',
  communication: 'Communication',
};
