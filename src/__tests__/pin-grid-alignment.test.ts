import { describe, expect, it } from 'vitest';
import { BUILTIN_SYMBOLS } from '../assets/builtin-symbols';
import type { SymbolDefinition, SymbolPin } from '../types/symbol';

const GRID_SIZE = 20;
const SUB_GRID_STEP = 0.5;

function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  const snapped = Math.round(value / gridSize) * gridSize;
  return Object.is(snapped, -0) ? 0 : snapped;
}

function collectAllPins(symbol: SymbolDefinition): SymbolPin[] {
  const allPins = [...symbol.pins, ...(symbol.units?.flatMap((unit) => unit.pins) ?? [])];
  const uniquePins = new Map<string, SymbolPin>();

  for (const pin of allPins) {
    const key = `${pin.id}:${pin.position.x}:${pin.position.y}:${pin.orientation}`;
    if (!uniquePins.has(key)) {
      uniquePins.set(key, pin);
    }
  }

  return Array.from(uniquePins.values());
}

function isOnSubGrid(value: number, step: number = SUB_GRID_STEP): boolean {
  const scaled = value / step;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

describe('pin grid alignment', () => {
  it('snaps values to nearest 20px grid point', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(10)).toBe(20);
    expect(snapToGrid(9)).toBe(0);
    expect(snapToGrid(20)).toBe(20);
    expect(snapToGrid(30)).toBe(40);
    expect(snapToGrid(31)).toBe(40);
    expect(snapToGrid(-10)).toBe(0);
    expect(snapToGrid(-11)).toBe(-20);
  });

  it('verifies builtin symbol pin positions are grid-friendly and bounded', () => {
    for (const [, symbol] of BUILTIN_SYMBOLS) {
      const pins = collectAllPins(symbol);
      if (pins.length === 0) {
        continue;
      }

      for (const pin of pins) {
        const snappedX = snapToGrid(pin.position.x);
        const snappedY = snapToGrid(pin.position.y);

        expect(pin.position.x).toBeGreaterThanOrEqual(0);
        expect(pin.position.x).toBeLessThanOrEqual(symbol.width);
        expect(pin.position.y).toBeGreaterThanOrEqual(0);
        expect(pin.position.y).toBeLessThanOrEqual(symbol.height);

        expect(Math.abs(pin.position.x - snappedX)).toBeLessThanOrEqual(GRID_SIZE / 2);
        expect(Math.abs(pin.position.y - snappedY)).toBeLessThanOrEqual(GRID_SIZE / 2);
        expect(isOnSubGrid(pin.position.x)).toBe(true);
        expect(isOnSubGrid(pin.position.y)).toBe(true);
      }
    }
  });

  it('verifies block sizes accommodate practical pin spacing', () => {
    for (const [, symbol] of BUILTIN_SYMBOLS) {
      const pins = collectAllPins(symbol);
      const axisGroups = new Map<string, number[]>();

      for (const pin of pins) {
        const side = pin.orientation;
        const varyingAxisValue = side === 'left' || side === 'right' ? pin.position.y : pin.position.x;

        const existing = axisGroups.get(side) ?? [];
        existing.push(varyingAxisValue);
        axisGroups.set(side, existing);
      }

      for (const [, values] of axisGroups) {
        if (values.length < 2) {
          continue;
        }

        const sorted = [...values].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i += 1) {
          expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(GRID_SIZE / 2);
        }
      }
    }
  });
});
