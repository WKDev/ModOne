// 전압 오버레이 레이아웃/포맷 순수 로직 검증
import { describe, it, expect } from 'vitest';
import { computeVoltageLabels, formatVoltage, VOLTAGE_LABEL_EPSILON } from '../voltageOverlayLayout';

describe('formatVoltage', () => {
  it('shows V with one decimal at/above 1 V', () => {
    expect(formatVoltage(24)).toBe('24.0 V');
    expect(formatVoltage(11.97)).toBe('12.0 V');
  });
  it('shows mV below 1 V', () => {
    expect(formatVoltage(0.5)).toBe('500 mV');
    expect(formatVoltage(0.12)).toBe('120 mV');
  });
});

describe('computeVoltageLabels', () => {
  it('centers labels above blocks and formats voltage', () => {
    const specs = computeVoltageLabels([{ id: 'a', voltage: 24, x: 100, y: 50, width: 40 }]);
    expect(specs).toEqual([{ id: 'a', text: '24.0 V', x: 120, y: 44 }]);
  });

  it('skips ~0 V blocks to avoid clutter', () => {
    const specs = computeVoltageLabels([
      { id: 'live', voltage: 12, x: 0, y: 0, width: 20 },
      { id: 'gnd', voltage: 0, x: 0, y: 0, width: 20 },
      { id: 'tiny', voltage: VOLTAGE_LABEL_EPSILON / 2, x: 0, y: 0, width: 20 },
    ]);
    expect(specs.map((s) => s.id)).toEqual(['live']);
  });

  it('honors a custom y offset', () => {
    const [s] = computeVoltageLabels([{ id: 'a', voltage: 5, x: 0, y: 100, width: 10 }], 12);
    expect(s.y).toBe(88);
  });
});
