import type { Viewport } from 'pixi-viewport';
import { Point } from 'pixi.js';

/**
 * Convert screen pixel coordinates to world (canvas) coordinates.
 * Screen coordinates are relative to the viewport display area.
 * World coordinates are in the canvas/world space.
 */
export function screenToWorld(
  viewport: Viewport,
  screenX: number,
  screenY: number
): { x: number; y: number } {
  const worldPoint = viewport.toWorld(new Point(screenX, screenY));
  return { x: worldPoint.x, y: worldPoint.y };
}

/**
 * Convert world (canvas) coordinates to screen pixel coordinates.
 * World coordinates are in the canvas/world space.
 * Screen coordinates are relative to the viewport display area.
 */
export function worldToScreen(
  viewport: Viewport,
  worldX: number,
  worldY: number
): { x: number; y: number } {
  const screenPoint = viewport.toScreen(new Point(worldX, worldY));
  return { x: screenPoint.x, y: screenPoint.y };
}

/**
 * Get the current zoom level from the viewport.
 * Returns the uniform scale factor (viewport.scale.x).
 */
export function getZoom(viewport: Viewport): number {
  return viewport.scale.x;
}

/**
 * Get the current pan offset (viewport's position in world space).
 * Returns the world position of the viewport's top-left corner.
 */
export function getPan(viewport: Viewport): { x: number; y: number } {
  return { x: viewport.x, y: viewport.y };
}

/**
 * Set viewport position and zoom programmatically.
 * Moves the viewport center to the specified world coordinates and sets zoom level.
 */
export function setViewport(
  viewport: Viewport,
  worldX: number,
  worldY: number,
  zoom: number
): void {
  viewport.setZoom(zoom);
  viewport.moveCenter(worldX, worldY);
}

/**
 * Get the visible world bounds (what area of the world is currently visible).
 * Returns the min/max coordinates of the visible region in world space.
 */
export function getVisibleBounds(viewport: Viewport): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const topLeft = viewport.toWorld(new Point(0, 0));
  const bottomRight = viewport.toWorld(
    new Point(viewport.screenWidth, viewport.screenHeight)
  );

  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y,
  };
}
