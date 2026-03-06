import type { Viewport } from 'pixi-viewport';
import type { FederatedPointerEvent } from 'pixi.js';
import type { CanvasEvent, Modifiers } from '../machines/interactionMachine';
import { resolvePointerTargetFromPixi } from './resolvePointerTargetFromPixi';

export type CanvasEventCallback = (event: CanvasEvent) => void;

export class PixiEventBridge {
  private callback: CanvasEventCallback | null = null;

  public constructor(private viewport: Viewport) {}

  public setCallback(cb: CanvasEventCallback): void {
    this.callback = cb;
  }

  public attach(): void {
    this.viewport.on('pointerdown', this.onPointerDown);
    this.viewport.on('pointermove', this.onPointerMove);
    this.viewport.on('pointerup', this.onPointerUp);
    this.viewport.on('pointerupoutside', this.onPointerUp);
  }

  public detach(): void {
    this.viewport.off('pointerdown', this.onPointerDown);
    this.viewport.off('pointermove', this.onPointerMove);
    this.viewport.off('pointerup', this.onPointerUp);
    this.viewport.off('pointerupoutside', this.onPointerUp);
  }

  public destroy(): void {
    this.detach();
    this.callback = null;
  }

  private onPointerDown = (event: FederatedPointerEvent): void => {
    if (event.button === 1) {
      return;
    }

    const worldPos = this.viewport.toWorld(event.global.x, event.global.y);
    const target = resolvePointerTargetFromPixi(event);
    const modifiers = extractPixiModifiers(event);

    this.callback?.({
      type: 'POINTER_DOWN',
      position: { x: event.global.x, y: event.global.y },
      canvasPosition: { x: worldPos.x, y: worldPos.y },
      button: event.button,
      target,
      modifiers,
    });
  };

  private onPointerMove = (event: FederatedPointerEvent): void => {
    const worldPos = this.viewport.toWorld(event.global.x, event.global.y);
    const modifiers = extractPixiModifiers(event);

    this.callback?.({
      type: 'POINTER_MOVE',
      position: { x: event.global.x, y: event.global.y },
      canvasPosition: { x: worldPos.x, y: worldPos.y },
      modifiers,
    });
  };

  private onPointerUp = (event: FederatedPointerEvent): void => {
    if (event.button === 1) {
      return;
    }

    const worldPos = this.viewport.toWorld(event.global.x, event.global.y);
    const modifiers = extractPixiModifiers(event);

    this.callback?.({
      type: 'POINTER_UP',
      position: { x: event.global.x, y: event.global.y },
      canvasPosition: { x: worldPos.x, y: worldPos.y },
      button: event.button,
      modifiers,
    });
  };
}

function extractPixiModifiers(event: FederatedPointerEvent): Modifiers {
  return {
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
    meta: event.metaKey,
  };
}
