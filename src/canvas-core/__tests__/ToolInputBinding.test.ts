import { describe, it, expect } from 'vitest';
import type { Viewport } from 'pixi-viewport';
import type { FederatedPointerEvent } from 'pixi.js';
import { ToolInputBinding } from '../input/ToolInputBinding';
import type { CanvasPointerInput } from '../input/Tool';
import { CoordinateSystem } from '../../components/OneCanvas/core/CoordinateSystem';

/** Minimal fake of the pixi-viewport surface ToolInputBinding touches. */
function makeFakeViewport() {
  const handlers = new Map<string, Set<(e: unknown) => void>>();
  return {
    on(ev: string, fn: (e: unknown) => void) {
      if (!handlers.has(ev)) handlers.set(ev, new Set());
      handlers.get(ev)!.add(fn);
    },
    off(ev: string, fn: (e: unknown) => void) {
      handlers.get(ev)?.delete(fn);
    },
    // Scale by 2 so world coords are distinguishable from raw global coords.
    toWorld(x: number, y: number) {
      return { x: x * 2, y: y * 2 };
    },
    emit(ev: string, e: unknown) {
      handlers.get(ev)?.forEach((fn) => fn(e));
    },
    listenerCount(ev: string) {
      return handlers.get(ev)?.size ?? 0;
    },
  };
}

function fed(o: {
  gx: number;
  gy: number;
  cx?: number;
  cy?: number;
  button?: number;
  shift?: boolean;
  alt?: boolean;
}): FederatedPointerEvent {
  return {
    global: { x: o.gx, y: o.gy },
    client: { x: o.cx ?? 0, y: o.cy ?? 0 },
    button: o.button ?? 0,
    shiftKey: !!o.shift,
    altKey: !!o.alt,
    ctrlKey: false,
    metaKey: false,
  } as unknown as FederatedPointerEvent;
}

function setup() {
  const vp = makeFakeViewport();
  const coordSys = new CoordinateSystem();
  coordSys.gridSize = 10; // snap to multiples of 10
  const events: Array<{ type: string; input: CanvasPointerInput }> = [];
  const binding = new ToolInputBinding();
  binding.init({
    viewport: vp as unknown as Viewport,
    coordSys,
    handlers: {
      onPointerDown: (input) => events.push({ type: 'down', input }),
      onPointerMove: (input) => events.push({ type: 'move', input }),
      onPointerUp: (input) => events.push({ type: 'up', input }),
    },
  });
  return { vp, binding, events };
}

describe('ToolInputBinding', () => {
  it('normalizes world, snapped and client coords for the primary button', () => {
    const { vp, events } = setup();
    // global (8,8) → world (16,16); snap to grid 10 → (20,20).
    vp.emit('pointerdown', fed({ gx: 8, gy: 8, cx: 100, cy: 200, shift: true }));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('down');
    const { input } = events[0];
    expect(input.world).toEqual({ x: 16, y: 16 });
    expect(input.snapped).toEqual({ x: 20, y: 20 });
    expect(input.screen).toEqual({ x: 8, y: 8 }); // canvas-relative (e.global)
    expect(input.client).toEqual({ x: 100, y: 200 }); // window coords, not toWorld'd
    expect(input.shiftKey).toBe(true);
    expect(input.button).toBe(0);
  });

  it('suppresses tool dispatch during a middle/right-button pan', () => {
    const { vp, events } = setup();
    // Middle button down starts a pan: no down event, and moves are swallowed.
    vp.emit('pointerdown', fed({ gx: 5, gy: 5, button: 1 }));
    vp.emit('pointermove', fed({ gx: 6, gy: 6 }));
    expect(events).toHaveLength(0);

    // Releasing the non-primary button ends the pan; moves resume.
    vp.emit('pointerup', fed({ gx: 6, gy: 6, button: 1 }));
    vp.emit('pointermove', fed({ gx: 7, gy: 7 }));
    expect(events.map((e) => e.type)).toEqual(['move']);
  });

  it('routes pointerupoutside through the up handler', () => {
    const { vp, events } = setup();
    vp.emit('pointerupoutside', fed({ gx: 1, gy: 1 }));
    expect(events.map((e) => e.type)).toEqual(['up']);
  });

  it('detaches exactly its own listeners on destroy', () => {
    const { vp, binding, events } = setup();
    expect(vp.listenerCount('pointerdown')).toBe(1);
    expect(vp.listenerCount('pointerupoutside')).toBe(1);

    binding.destroy();
    expect(vp.listenerCount('pointerdown')).toBe(0);
    expect(vp.listenerCount('pointermove')).toBe(0);
    expect(vp.listenerCount('pointerup')).toBe(0);
    expect(vp.listenerCount('pointerupoutside')).toBe(0);

    // Events after destroy are ignored.
    vp.emit('pointerdown', fed({ gx: 1, gy: 1 }));
    expect(events).toHaveLength(0);
  });
});
