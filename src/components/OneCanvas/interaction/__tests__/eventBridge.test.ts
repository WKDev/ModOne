import { describe, it, expect } from 'vitest';
import type { Viewport } from 'pixi-viewport';
import type { FederatedPointerEvent } from 'pixi.js';
import { EventBridge } from '../EventBridge';
import type { InteractionController } from '../InteractionController';

/**
 * Guards EventBridge's federated→controller dispatch — the previously untested
 * glue on the schematic hot path. Locks behavior that differs from
 * ToolInputBinding (all buttons forwarded; screen = canvas-relative e.global;
 * full ctrl/shift/alt/meta modifier set) so the shared-normalizer refactor is safe.
 */

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

type Call = { method: string; args: unknown[] };

function makeFakeController() {
  const calls: Call[] = [];
  const rec =
    (method: string) =>
    (...args: unknown[]) =>
      calls.push({ method, args });
  return {
    calls,
    handlePointerDown: rec('handlePointerDown'),
    handlePointerMove: rec('handlePointerMove'),
    handlePointerUp: rec('handlePointerUp'),
    handlePointerOver: rec('handlePointerOver'),
    handlePointerOut: rec('handlePointerOut'),
    handleKeyDown: rec('handleKeyDown'),
    handleKeyUp: rec('handleKeyUp'),
  };
}

function fed(o: {
  gx: number;
  gy: number;
  button?: number;
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
}): FederatedPointerEvent {
  return {
    global: { x: o.gx, y: o.gy },
    client: { x: 0, y: 0 },
    button: o.button ?? 0,
    shiftKey: !!o.shift,
    altKey: !!o.alt,
    ctrlKey: !!o.ctrl,
    metaKey: !!o.meta,
  } as unknown as FederatedPointerEvent;
}

function setup() {
  const vp = makeFakeViewport();
  const controller = makeFakeController();
  const dom = document.createElement('div');
  const bridge = new EventBridge();
  bridge.init({
    viewport: vp as unknown as Viewport,
    domElement: dom,
    controller: controller as unknown as InteractionController,
  });
  return { vp, controller, dom, bridge };
}

describe('EventBridge', () => {
  it('forwards pointerdown with world, canvas-screen coords, button and modifiers', () => {
    const { vp, controller } = setup();
    vp.emit('pointerdown', fed({ gx: 8, gy: 8, shift: true }));

    expect(controller.calls).toHaveLength(1);
    const { method, args } = controller.calls[0];
    expect(method).toBe('handlePointerDown');
    expect(args[0]).toEqual({ x: 16, y: 16 }); // world (toWorld)
    expect(args[1]).toEqual({ x: 8, y: 8 }); // screen = e.global (canvas-relative)
    expect(args[2]).toBe(0); // button
    expect(args[3]).toEqual({ ctrl: false, shift: true, alt: false, meta: false, space: false });
  });

  it('treats meta as ctrl in modifiers', () => {
    const { vp, controller } = setup();
    vp.emit('pointerdown', fed({ gx: 1, gy: 1, meta: true }));
    expect(controller.calls[0].args[3]).toEqual({
      ctrl: true,
      shift: false,
      alt: false,
      meta: true,
      space: false,
    });
  });

  it('forwards ALL buttons to the controller (not primary-only)', () => {
    const { vp, controller } = setup();
    vp.emit('pointerdown', fed({ gx: 2, gy: 2, button: 1 })); // middle
    vp.emit('pointerdown', fed({ gx: 3, gy: 3, button: 2 })); // right
    expect(controller.calls.map((c) => c.args[2])).toEqual([1, 2]);
  });

  it('forwards move (no button arg) and up (with button)', () => {
    const { vp, controller } = setup();
    vp.emit('pointermove', fed({ gx: 4, gy: 4 }));
    vp.emit('pointerup', fed({ gx: 5, gy: 5, button: 0 }));
    vp.emit('pointerupoutside', fed({ gx: 6, gy: 6, button: 0 }));

    const moves = controller.calls.filter((c) => c.method === 'handlePointerMove');
    const ups = controller.calls.filter((c) => c.method === 'handlePointerUp');
    expect(moves).toHaveLength(1);
    expect(moves[0].args).toEqual([{ x: 8, y: 8 }, { x: 4, y: 4 }, { ctrl: false, shift: false, alt: false, meta: false, space: false }]);
    expect(ups).toHaveLength(2); // pointerup + pointerupoutside both route here
    expect(ups[0].args[2]).toBe(0); // button present on up
  });

  it('routes keyboard, marking space, and ignores input-field targets', () => {
    const { controller, dom } = setup();
    dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
    dom.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));

    const keys = controller.calls.filter((c) => c.method === 'handleKeyDown');
    expect(keys).toHaveLength(2);
    expect(keys[0].args[0]).toBe('a');
    expect((keys[0].args[2] as { space: boolean }).space).toBe(false);
    expect((keys[1].args[2] as { space: boolean }).space).toBe(true);

    // A keydown originating from an input field must be ignored.
    const input = document.createElement('input');
    dom.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', bubbles: true }));
    expect(controller.calls.filter((c) => c.method === 'handleKeyDown')).toHaveLength(2);
  });

  it('detaches viewport listeners on destroy', () => {
    const { vp, bridge, controller } = setup();
    expect(vp.listenerCount('pointerdown')).toBe(1);
    bridge.destroy();
    expect(vp.listenerCount('pointerdown')).toBe(0);
    vp.emit('pointerdown', fed({ gx: 1, gy: 1 }));
    expect(controller.calls).toHaveLength(0);
  });
});
