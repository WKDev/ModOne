/**
 * normalizePointer — the single coordinate-normalization primitive for the engine.
 *
 * Converts a PIXI federated pointer event into the canonical {@link CanvasPointerInput}
 * (world + grid-snapped + canvas-screen + window-client coords + modifiers). This is
 * the one place federated→world math lives, so every input binder (ToolInputBinding,
 * OneCanvas's EventBridge) shares it — the historical source of cursor-offset bugs has
 * a single, tested implementation.
 */

import type { Viewport } from 'pixi-viewport';
import type { FederatedPointerEvent } from 'pixi.js';
import type { CoordinateSystem } from '../../components/OneCanvas/core/CoordinateSystem';
import type { CanvasPointerInput } from './Tool';

export function normalizePointer(
  viewport: Viewport,
  coordSys: CoordinateSystem | null,
  e: FederatedPointerEvent,
): CanvasPointerInput {
  // `e.global` is canvas-relative (what toWorld expects); `e.client` is
  // window-relative (for DOM overlays). No getBoundingClientRect math needed.
  const world = viewport.toWorld(e.global.x, e.global.y);
  const snapped = coordSys
    ? coordSys.snapToGrid({ x: world.x, y: world.y })
    : { x: world.x, y: world.y };
  return {
    world: { x: world.x, y: world.y },
    snapped: { x: snapped.x, y: snapped.y },
    screen: { x: e.global.x, y: e.global.y },
    client: { x: e.client.x, y: e.client.y },
    button: e.button,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
  };
}
