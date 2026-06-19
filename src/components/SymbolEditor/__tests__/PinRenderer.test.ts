/**
 * PinRenderer — PixiJS Graphics Rendering Tests (Sub-AC 2)
 *
 * Verifies that SymbolPin[] is correctly translated into PixiJS Graphics
 * draw calls (circle dot + direction line) and Text labels added to the Stage.
 */

import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// Hoist mock factories
// ============================================================================

const { MockGraphics, MockText, MockContainer } = vi.hoisted(() => {
  class MockGraphics {
    label = '';
    _calls: Array<{ method: string; args: unknown[] }> = [];

    private _record(method: string, ...args: unknown[]) {
      this._calls.push({ method, args });
    }

    clear() { this._record('clear'); return this; }
    rect(...args: unknown[]) { this._record('rect', ...args); return this; }
    circle(...args: unknown[]) { this._record('circle', ...args); return this; }
    moveTo(...args: unknown[]) { this._record('moveTo', ...args); return this; }
    lineTo(...args: unknown[]) { this._record('lineTo', ...args); return this; }
    fill(...args: unknown[]) { this._record('fill', ...args); return this; }
    stroke(...args: unknown[]) { this._record('stroke', ...args); return this; }
    destroy() { this._record('destroy'); }

    callsFor(method: string) {
      return this._calls.filter((c) => c.method === method);
    }
    wasCalled(method: string) {
      return this._calls.some((c) => c.method === method);
    }
  }

  class MockText {
    text: string;
    style: unknown;
    x = 0;
    y = 0;
    anchor = { set: vi.fn() };
    _destroyCalled = false;

    constructor({ text, style }: { text: string; style: unknown }) {
      this.text = text;
      this.style = style;
    }

    destroy() { this._destroyCalled = true; }
  }

  class MockContainer {
    label = '';
    children: unknown[] = [];

    addChild(child: unknown) {
      this.children.push(child);
      return child;
    }
  }

  return { MockGraphics, MockText, MockContainer };
});

vi.mock('pixi.js', () => ({
  Graphics: MockGraphics,
  Text: MockText,
  Container: MockContainer,
}));

import { PinRenderer } from '../renderers/PinRenderer';
import type { SymbolPin } from '../../../types/symbol';

// ============================================================================
// Helpers
// ============================================================================

function makeRenderer(layer?: InstanceType<typeof MockContainer>) {
  const l = (layer ?? new MockContainer()) as unknown as import('pixi.js').Container;
  return { renderer: new PinRenderer({ layer: l }), layer: l as unknown as InstanceType<typeof MockContainer> };
}

const basePin: SymbolPin = {
  id: 'pin-1',
  name: 'IN',
  number: '1',
  type: 'input',
  shape: 'line',
  position: { x: 50, y: 50 },
  orientation: 'right',
  length: 20,
};

// ============================================================================
// Tests
// ============================================================================

describe('PinRenderer — PixiJS rendering verification', () => {

  // ── Initialization ──────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('creates a Graphics object labeled "symbol-pins" in the layer', () => {
      const { layer } = makeRenderer();
      expect(layer.children).toHaveLength(1);
      const g = layer.children[0] as InstanceType<typeof MockGraphics>;
      expect(g).toBeInstanceOf(MockGraphics);
      expect(g.label).toBe('symbol-pins');
    });
  });

  // ── renderAll with one pin ──────────────────────────────────────────────────

  describe('renderAll — single pin', () => {
    it('calls g.circle() for the pin dot at the pin position', () => {
      const { renderer } = makeRenderer();
      renderer.renderAll([basePin]);

      const { renderer: r } = makeRenderer();
      r.renderAll([basePin]);
      const g = (r as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      const circleCalls = g.callsFor('circle');
      expect(circleCalls.length).toBeGreaterThan(0);
      expect(circleCalls[0].args[0]).toBe(50); // x
      expect(circleCalls[0].args[1]).toBe(50); // y
    });

    it('calls g.moveTo() and g.lineTo() for the direction line', () => {
      const { renderer } = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([basePin]);

      expect(g.wasCalled('moveTo')).toBe(true);
      expect(g.wasCalled('lineTo')).toBe(true);
    });

    it('calls g.fill() to color the dot', () => {
      const { renderer } = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([basePin]);

      expect(g.wasCalled('fill')).toBe(true);
    });

    it('calls g.stroke() for the direction line', () => {
      const { renderer } = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([basePin]);

      expect(g.wasCalled('stroke')).toBe(true);
    });

    it('adds a pin number Text label to the layer', () => {
      const { renderer, layer } = makeRenderer();
      renderer.renderAll([basePin]);

      // Layer: 1 Graphics + 1 label Text
      expect(layer.children).toHaveLength(2);
      const label = layer.children[1] as InstanceType<typeof MockText>;
      expect(label).toBeInstanceOf(MockText);
      expect(label.text).toBe('1');
    });
  });

  // ── Hidden pin ─────────────────────────────────────────────────────────────

  describe('hidden pin', () => {
    it('skips rendering a hidden pin', () => {
      const hiddenPin: SymbolPin = { ...basePin, hidden: true };
      const { renderer } = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([hiddenPin]);

      // Only clear() should be called, no drawing
      expect(g.callsFor('circle')).toHaveLength(0);
      expect(g.callsFor('moveTo')).toHaveLength(0);
    });
  });

  // ── Pin direction lines ─────────────────────────────────────────────────────

  describe('pin orientation', () => {
    it('right orientation: lineTo moves in +x direction', () => {
      const pin: SymbolPin = { ...basePin, orientation: 'right', position: { x: 0, y: 0 } };
      const { renderer } = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([pin]);

      const lineToCall = g.callsFor('lineTo')[0];
      expect(lineToCall.args[0] as number).toBeGreaterThan(0); // dx > 0
      expect(lineToCall.args[1]).toBe(0); // dy = 0
    });

    it('left orientation: lineTo moves in -x direction', () => {
      const pin: SymbolPin = { ...basePin, orientation: 'left', position: { x: 0, y: 0 } };
      const { renderer } = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([pin]);

      const lineToCall = g.callsFor('lineTo')[0];
      expect(lineToCall.args[0] as number).toBeLessThan(0); // dx < 0
      expect(lineToCall.args[1]).toBe(0); // dy = 0
    });

    it('up orientation: lineTo moves in -y direction', () => {
      const pin: SymbolPin = { ...basePin, orientation: 'up', position: { x: 0, y: 0 } };
      const { renderer } = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([pin]);

      const lineToCall = g.callsFor('lineTo')[0];
      expect(lineToCall.args[0]).toBe(0); // dx = 0
      expect(lineToCall.args[1] as number).toBeLessThan(0); // dy < 0
    });

    it('down orientation: lineTo moves in +y direction', () => {
      const pin: SymbolPin = { ...basePin, orientation: 'down', position: { x: 0, y: 0 } };
      const { renderer } = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([pin]);

      const lineToCall = g.callsFor('lineTo')[0];
      expect(lineToCall.args[0]).toBe(0); // dx = 0
      expect(lineToCall.args[1] as number).toBeGreaterThan(0); // dy > 0
    });
  });

  // ── Pin color override ──────────────────────────────────────────────────────

  describe('pin color override', () => {
    it('uses pin.color when provided instead of default orange', () => {
      const coloredPin: SymbolPin = { ...basePin, color: '#00aaff' };
      const { renderer } = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([coloredPin]);

      const fillCall = g.callsFor('fill')[0];
      expect(fillCall.args[0]).toBe('#00aaff');
    });
  });

  // ── Re-render / destroy ─────────────────────────────────────────────────────

  describe('re-render and destroy', () => {
    it('calls clear() on each renderAll()', () => {
      const { renderer } = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;

      renderer.renderAll([]);
      renderer.renderAll([]);

      expect(g.callsFor('clear')).toHaveLength(2);
    });

    it('destroys old text labels before re-rendering', () => {
      const { renderer, layer } = makeRenderer();

      renderer.renderAll([basePin]);
      const label = layer.children[1] as InstanceType<typeof MockText>;
      expect(label._destroyCalled).toBe(false);

      renderer.renderAll([]);
      expect(label._destroyCalled).toBe(true);
    });

    it('calls graphics.destroy() on destroy()', () => {
      const { renderer } = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;

      renderer.destroy();
      expect(g.wasCalled('destroy')).toBe(true);
    });
  });
});
