/**
 * PrimitiveRenderer — PixiJS Graphics Rendering Tests (Sub-AC 2)
 *
 * Verifies that each GraphicPrimitive kind (rect, circle, polyline, arc, text)
 * is correctly translated into PixiJS Graphics draw calls and added to the
 * Stage layer.
 *
 * Strategy: vi.mock('pixi.js') with vi.hoisted() replaces the real PixiJS
 * with lightweight stub objects that record calls, allowing us to assert the
 * correct API is called without a real WebGL context.
 */

import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// Hoist mock factories so they can be referenced inside vi.mock()
// ============================================================================

const { MockGraphics, MockText, MockContainer } = vi.hoisted(() => {
  /**
   * Lightweight Graphics stub — records all draw/fill/stroke calls.
   */
  class MockGraphics {
    label = '';
    visible = true;
    _calls: Array<{ method: string; args: unknown[] }> = [];

    private _record(method: string, ...args: unknown[]) {
      this._calls.push({ method, args });
    }

    clear() { this._record('clear'); return this; }
    rect(...args: unknown[]) { this._record('rect', ...args); return this; }
    circle(...args: unknown[]) { this._record('circle', ...args); return this; }
    moveTo(...args: unknown[]) { this._record('moveTo', ...args); return this; }
    lineTo(...args: unknown[]) { this._record('lineTo', ...args); return this; }
    arc(...args: unknown[]) { this._record('arc', ...args); return this; }
    fill(...args: unknown[]) { this._record('fill', ...args); return this; }
    stroke(...args: unknown[]) { this._record('stroke', ...args); return this; }
    destroy() { this._record('destroy'); }

    /** Helper: find all calls for a specific method */
    callsFor(method: string) {
      return this._calls.filter((c) => c.method === method);
    }

    /** Helper: check if a specific method was called */
    wasCalled(method: string) {
      return this._calls.some((c) => c.method === method);
    }
  }

  /**
   * Lightweight Text stub.
   */
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

  /**
   * Lightweight Container stub — tracks children.
   */
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

// ============================================================================
// Mock pixi.js module
// ============================================================================

vi.mock('pixi.js', () => ({
  Graphics: MockGraphics,
  Text: MockText,
  Container: MockContainer,
}));

// ============================================================================
// Import the module under test AFTER the mock is set up
// ============================================================================

import { PrimitiveRenderer } from '../renderers/PrimitiveRenderer';
import type { GraphicPrimitive } from '../../../types/symbol';

// ============================================================================
// Test helpers
// ============================================================================

function makeContainer() {
  return new MockContainer();
}

function makeRenderer(container?: InstanceType<typeof MockContainer>) {
  const layer = (container ?? makeContainer()) as unknown as import('pixi.js').Container;
  return new PrimitiveRenderer({ layer });
}

// ============================================================================
// Tests
// ============================================================================

describe('PrimitiveRenderer — PixiJS rendering verification', () => {

  // ── Initialization ──────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('creates a Graphics object labeled "symbol-primitives" and adds it to the layer', () => {
      const layer = makeContainer();
      makeRenderer(layer as unknown as import('pixi.js').Container);

      expect(layer.children).toHaveLength(1);
      const g = layer.children[0] as InstanceType<typeof MockGraphics>;
      expect(g).toBeInstanceOf(MockGraphics);
      expect(g.label).toBe('symbol-primitives');
    });
  });

  // ── renderAll: empty array ──────────────────────────────────────────────────

  describe('renderAll([]) — empty primitives', () => {
    it('calls clear() to reset the graphics object', () => {
      const renderer = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([]);

      expect(g.wasCalled('clear')).toBe(true);
    });

    it('does not call any shape-drawing methods when primitives list is empty', () => {
      const renderer = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([]);

      const shapeMethods = ['rect', 'circle', 'moveTo', 'lineTo', 'arc'];
      for (const method of shapeMethods) {
        expect(g.wasCalled(method)).toBe(false);
      }
    });
  });

  // ── RectPrimitive ───────────────────────────────────────────────────────────

  describe('rect primitive', () => {
    const rectPrim: GraphicPrimitive = {
      kind: 'rect',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      stroke: '#cccccc',
      fill: 'none',
      strokeWidth: 1,
    };

    it('calls g.rect() with correct coordinates', () => {
      const renderer = makeRenderer();
      renderer.renderAll([rectPrim]);

      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      const rectCalls = g.callsFor('rect');
      expect(rectCalls.length).toBeGreaterThan(0);
      expect(rectCalls[0].args).toEqual([10, 20, 100, 50]);
    });

    it('calls g.stroke() with the correct color', () => {
      const renderer = makeRenderer();
      renderer.renderAll([rectPrim]);

      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      expect(g.wasCalled('stroke')).toBe(true);
      const strokeCall = g.callsFor('stroke')[0];
      expect((strokeCall.args[0] as Record<string, unknown>).color).toBe(0xcccccc);
    });

    it('does NOT call g.fill() when fill is "none"', () => {
      const renderer = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([rectPrim]);

      expect(g.wasCalled('fill')).toBe(false);
    });

    it('calls g.fill() when fill is a valid color', () => {
      const filledRect: GraphicPrimitive = { ...rectPrim, fill: '#ff0000' };
      const renderer = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([filledRect]);

      expect(g.wasCalled('fill')).toBe(true);
      const fillCall = g.callsFor('fill')[0];
      expect((fillCall.args[0] as Record<string, unknown>).color).toBe(0xff0000);
    });

    it('uses pixelLine: true for crisp lines', () => {
      const renderer = makeRenderer();
      renderer.renderAll([rectPrim]);

      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      const strokeCall = g.callsFor('stroke')[0];
      expect((strokeCall.args[0] as Record<string, unknown>).pixelLine).toBe(true);
    });
  });

  // ── CirclePrimitive ─────────────────────────────────────────────────────────

  describe('circle primitive', () => {
    const circlePrim: GraphicPrimitive = {
      kind: 'circle',
      cx: 50,
      cy: 60,
      r: 30,
      stroke: '#aaaaaa',
      fill: 'none',
      strokeWidth: 2,
    };

    it('calls g.circle() with correct cx, cy, r', () => {
      const renderer = makeRenderer();
      renderer.renderAll([circlePrim]);

      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      const circleCalls = g.callsFor('circle');
      expect(circleCalls.length).toBeGreaterThan(0);
      expect(circleCalls[0].args).toEqual([50, 60, 30]);
    });

    it('calls g.stroke() after g.circle()', () => {
      const renderer = makeRenderer();
      renderer.renderAll([circlePrim]);

      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      const circleIdx = g._calls.findIndex((c) => c.method === 'circle');
      const strokeIdx = g._calls.findIndex((c) => c.method === 'stroke');
      expect(circleIdx).toBeGreaterThanOrEqual(0);
      expect(strokeIdx).toBeGreaterThan(circleIdx);
    });

    it('calls g.fill() when fill is a valid color', () => {
      const filledCircle: GraphicPrimitive = { ...circlePrim, fill: '#00ff00' };
      const renderer = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([filledCircle]);

      expect(g.wasCalled('fill')).toBe(true);
    });
  });

  // ── PolylinePrimitive ───────────────────────────────────────────────────────

  describe('polyline primitive', () => {
    const polylinePrim: GraphicPrimitive = {
      kind: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 30 },
      ],
      stroke: '#888888',
      fill: 'none',
      strokeWidth: 1,
    };

    it('calls g.moveTo() with the first point', () => {
      const renderer = makeRenderer();
      renderer.renderAll([polylinePrim]);

      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      const moveCalls = g.callsFor('moveTo');
      expect(moveCalls.length).toBeGreaterThan(0);
      expect(moveCalls[0].args).toEqual([0, 0]);
    });

    it('calls g.lineTo() for each subsequent point', () => {
      const renderer = makeRenderer();
      renderer.renderAll([polylinePrim]);

      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      const lineCalls = g.callsFor('lineTo');
      // 2 lineTo calls for 3 points (index 1 and 2)
      expect(lineCalls).toHaveLength(2);
      expect(lineCalls[0].args).toEqual([40, 0]);
      expect(lineCalls[1].args).toEqual([40, 30]);
    });

    it('does NOT draw a polyline with fewer than 2 points', () => {
      const shortPrim: GraphicPrimitive = {
        kind: 'polyline',
        points: [{ x: 0, y: 0 }],
        stroke: '#888888',
        fill: 'none',
        strokeWidth: 1,
      };
      const renderer = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([shortPrim]);

      expect(g.wasCalled('moveTo')).toBe(false);
      expect(g.wasCalled('lineTo')).toBe(false);
    });

    it('calls g.stroke() after the polyline path', () => {
      const renderer = makeRenderer();
      renderer.renderAll([polylinePrim]);

      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      expect(g.wasCalled('stroke')).toBe(true);
    });
  });

  // ── ArcPrimitive ────────────────────────────────────────────────────────────

  describe('arc primitive', () => {
    const arcPrim: GraphicPrimitive = {
      kind: 'arc',
      cx: 100,
      cy: 100,
      r: 50,
      startAngle: 0,
      endAngle: 90,
      stroke: '#ffffff',
      fill: 'none',
      strokeWidth: 1,
    };

    it('calls g.arc() with correct parameters (angles converted to radians)', () => {
      const renderer = makeRenderer();
      renderer.renderAll([arcPrim]);

      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      const arcCalls = g.callsFor('arc');
      expect(arcCalls.length).toBeGreaterThan(0);

      const [cx, cy, r, startRad, endRad] = arcCalls[0].args as number[];
      expect(cx).toBe(100);
      expect(cy).toBe(100);
      expect(r).toBe(50);
      // 0 degrees → 0 radians
      expect(startRad).toBeCloseTo(0, 5);
      // 90 degrees → π/2 radians
      expect(endRad).toBeCloseTo(Math.PI / 2, 5);
    });

    it('calls g.stroke() after the arc', () => {
      const renderer = makeRenderer();
      renderer.renderAll([arcPrim]);

      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      expect(g.wasCalled('stroke')).toBe(true);
    });
  });

  // ── TextPrimitive ───────────────────────────────────────────────────────────

  describe('text primitive', () => {
    const textPrim: GraphicPrimitive = {
      kind: 'text',
      x: 10,
      y: 20,
      text: 'Hello',
      fontSize: 14,
      fontFamily: 'monospace',
      fill: '#ffffff',
      anchor: 'start',
    };

    it('creates a PixiText object and adds it to the layer', () => {
      const layer = makeContainer();
      const renderer = makeRenderer(layer as unknown as import('pixi.js').Container);
      renderer.renderAll([textPrim]);

      // Layer should have: 1 Graphics + 1 Text
      expect(layer.children).toHaveLength(2);
      const textObj = layer.children[1] as InstanceType<typeof MockText>;
      expect(textObj).toBeInstanceOf(MockText);
      expect(textObj.text).toBe('Hello');
    });

    it('positions the text at (x, y)', () => {
      const layer = makeContainer();
      const renderer = makeRenderer(layer as unknown as import('pixi.js').Container);
      renderer.renderAll([textPrim]);

      const textObj = layer.children[1] as InstanceType<typeof MockText>;
      expect(textObj.x).toBe(10);
      expect(textObj.y).toBe(20);
    });

    it('sets anchor (0, 1) for anchor="start"', () => {
      const layer = makeContainer();
      const renderer = makeRenderer(layer as unknown as import('pixi.js').Container);
      renderer.renderAll([textPrim]);

      const textObj = layer.children[1] as InstanceType<typeof MockText>;
      expect(textObj.anchor.set).toHaveBeenCalledWith(0, 1);
    });

    it('sets anchor (0.5, 1) for anchor="middle"', () => {
      const layer = makeContainer();
      const renderer = makeRenderer(layer as unknown as import('pixi.js').Container);
      renderer.renderAll([{ ...textPrim, anchor: 'middle' }]);

      const textObj = layer.children[1] as InstanceType<typeof MockText>;
      expect(textObj.anchor.set).toHaveBeenCalledWith(0.5, 1);
    });

    it('sets anchor (1, 1) for anchor="end"', () => {
      const layer = makeContainer();
      const renderer = makeRenderer(layer as unknown as import('pixi.js').Container);
      renderer.renderAll([{ ...textPrim, anchor: 'end' }]);

      const textObj = layer.children[1] as InstanceType<typeof MockText>;
      expect(textObj.anchor.set).toHaveBeenCalledWith(1, 1);
    });

    it('does NOT call Graphics draw methods for text primitives', () => {
      const renderer = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([textPrim]);

      const shapeMethods = ['rect', 'circle', 'moveTo', 'lineTo', 'arc'];
      for (const method of shapeMethods) {
        expect(g.wasCalled(method)).toBe(false);
      }
    });
  });

  // ── Multiple primitives ─────────────────────────────────────────────────────

  describe('multiple primitives', () => {
    it('renders multiple primitives in sequence on the same Graphics object', () => {
      const primitives: GraphicPrimitive[] = [
        {
          kind: 'rect',
          x: 0, y: 0, width: 10, height: 10,
          stroke: '#ffffff', fill: 'none', strokeWidth: 1,
        },
        {
          kind: 'circle',
          cx: 20, cy: 20, r: 5,
          stroke: '#ffffff', fill: 'none', strokeWidth: 1,
        },
        {
          kind: 'polyline',
          points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
          stroke: '#ffffff', fill: 'none', strokeWidth: 1,
        },
      ];

      const renderer = makeRenderer();
      renderer.renderAll(primitives);

      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      expect(g.wasCalled('rect')).toBe(true);
      expect(g.wasCalled('circle')).toBe(true);
      expect(g.wasCalled('moveTo')).toBe(true);
      expect(g.wasCalled('lineTo')).toBe(true);
      // stroke called at least 3 times (once per primitive)
      expect(g.callsFor('stroke').length).toBeGreaterThanOrEqual(3);
    });

    it('adds multiple text objects to the layer', () => {
      const layer = makeContainer();
      const renderer = makeRenderer(layer as unknown as import('pixi.js').Container);

      const texts: GraphicPrimitive[] = [
        { kind: 'text', x: 0, y: 0, text: 'A', fontSize: 12, fontFamily: 'sans-serif', fill: '#fff' },
        { kind: 'text', x: 10, y: 10, text: 'B', fontSize: 12, fontFamily: 'sans-serif', fill: '#fff' },
      ];

      renderer.renderAll(texts);

      // 1 Graphics + 2 Text objects
      expect(layer.children).toHaveLength(3);
    });
  });

  // ── Re-render (clear and redraw) ────────────────────────────────────────────

  describe('re-render (clear + redraw)', () => {
    it('calls clear() at the start of each renderAll() call', () => {
      const renderer = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;

      // First render
      renderer.renderAll([]);
      const clearCountAfterFirst = g.callsFor('clear').length;
      expect(clearCountAfterFirst).toBe(1);

      // Second render
      renderer.renderAll([]);
      const clearCountAfterSecond = g.callsFor('clear').length;
      expect(clearCountAfterSecond).toBe(2);
    });

    it('destroys old Text objects before re-rendering', () => {
      const layer = makeContainer();
      const renderer = makeRenderer(layer as unknown as import('pixi.js').Container);

      const textPrimA: GraphicPrimitive = {
        kind: 'text', x: 0, y: 0, text: 'A', fontSize: 12, fontFamily: 'sans-serif', fill: '#fff',
      };

      // First render: creates TextA
      renderer.renderAll([textPrimA]);
      const textA = layer.children[1] as InstanceType<typeof MockText>;
      expect(textA._destroyCalled).toBe(false);

      // Second render: should destroy TextA first
      renderer.renderAll([]);
      expect(textA._destroyCalled).toBe(true);
    });
  });

  // ── Destroy ─────────────────────────────────────────────────────────────────

  describe('destroy()', () => {
    it('calls graphics.destroy()', () => {
      const renderer = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;

      renderer.destroy();

      expect(g.wasCalled('destroy')).toBe(true);
    });

    it('does not crash if destroy() is called multiple times', () => {
      const renderer = makeRenderer();
      renderer.destroy();
      expect(() => renderer.destroy()).not.toThrow();
    });

    it('ignores renderAll() calls after destroy()', () => {
      const renderer = makeRenderer();
      renderer.destroy();

      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      const callsBeforeRender = g._calls.length;

      renderer.renderAll([{
        kind: 'rect', x: 0, y: 0, width: 10, height: 10,
        stroke: '#fff', fill: 'none', strokeWidth: 1,
      }]);

      // No new calls should have been made after destroy
      expect(g._calls.length).toBe(callsBeforeRender);
    });
  });

  // ── Color parsing ───────────────────────────────────────────────────────────

  describe('color parsing', () => {
    it('correctly parses #rrggbb hex colors to numeric values', () => {
      const renderer = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([{
        kind: 'rect', x: 0, y: 0, width: 10, height: 10,
        stroke: '#ff0000', fill: '#00ff00', strokeWidth: 1,
      }]);

      const fillCall = g.callsFor('fill')[0];
      const strokeCall = g.callsFor('stroke')[0];

      expect((fillCall.args[0] as Record<string, unknown>).color).toBe(0x00ff00);
      expect((strokeCall.args[0] as Record<string, unknown>).color).toBe(0xff0000);
    });

    it('falls back to black (0x000000) for "none" stroke color', () => {
      const renderer = makeRenderer();
      const g = (renderer as unknown as { _graphics: InstanceType<typeof MockGraphics> })._graphics;
      g._calls = [];

      renderer.renderAll([{
        kind: 'rect', x: 0, y: 0, width: 10, height: 10,
        stroke: 'none', fill: 'none', strokeWidth: 1,
      }]);

      const strokeCall = g.callsFor('stroke')[0];
      expect((strokeCall.args[0] as Record<string, unknown>).color).toBe(0x000000);
    });
  });
});
