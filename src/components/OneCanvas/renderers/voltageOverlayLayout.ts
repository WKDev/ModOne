// 전압 오버레이의 순수 레이아웃/포맷 로직 — 컴포넌트 전압 → 라벨 스펙(렌더와 분리, 테스트 가능)

export interface BlockVoltageInput {
  id: string;
  /** Highest solved voltage across the block's ports. */
  voltage: number;
  /** Block top-left in world coordinates. */
  x: number;
  y: number;
  /** Block width (for horizontal centering). */
  width: number;
}

export interface VoltageLabelSpec {
  id: string;
  text: string;
  /** Label anchor in world coordinates (horizontally centered above the block). */
  x: number;
  y: number;
}

/** Voltages with magnitude below this are treated as 0 (no label). */
export const VOLTAGE_LABEL_EPSILON = 0.05;

/** Format a voltage for display: mV under 1 V, else 1-decimal V. */
export function formatVoltage(v: number): string {
  const a = Math.abs(v);
  if (a < 1) return `${Math.round(v * 1000)} mV`;
  return `${v.toFixed(1)} V`;
}

/**
 * Turn per-block voltages into label specs. Blocks at ~0 V are skipped so the
 * canvas isn't cluttered with 0 V labels. Labels are centered above the block.
 */
export function computeVoltageLabels(
  blocks: Iterable<BlockVoltageInput>,
  yOffset = 6,
): VoltageLabelSpec[] {
  const out: VoltageLabelSpec[] = [];
  for (const b of blocks) {
    if (Math.abs(b.voltage) < VOLTAGE_LABEL_EPSILON) continue;
    out.push({
      id: b.id,
      text: formatVoltage(b.voltage),
      x: b.x + b.width / 2,
      y: b.y - yOffset,
    });
  }
  return out;
}
