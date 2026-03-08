/**
 * CoordinateSystem — Coordinate Space Transformations
 *
 * Handles conversions between screen (pixel), viewport (camera),
 * and world (canvas) coordinate spaces. Also provides grid snapping.
 *
 * Coordinate spaces:
 *   Screen → raw pixel coordinates from mouse/touch events
 *   World  → canvas coordinates (the "infinite" schematic space)
 *   Grid   → world coordinates snapped to the nearest grid point
 */

import type { Viewport } from 'pixi-viewport';
import type { Position } from '../types';

export class CoordinateSystem {
  private _viewport: Viewport | null = null;
  private _gridSize: number = 20;
  private _snapEnabled: boolean = true;

  /** Current grid size in world units */
  get gridSize(): number {
    return this._gridSize;
  }

  set gridSize(size: number) {
    this._gridSize = Math.max(1, size);
  }

  /** Whether snap-to-grid is enabled */
  get snapEnabled(): boolean {
    return this._snapEnabled;
  }

  set snapEnabled(enabled: boolean) {
    this._snapEnabled = enabled;
  }

  /**
   * Initialize with a viewport reference.
   */
  init(viewport: Viewport): void {
    this._viewport = viewport;
  }

  /**
   * Convert screen coordinates to world coordinates.
   * Accounts for viewport pan and zoom.
   */
  screenToWorld(screenX: number, screenY: number): Position {
    if (!this._viewport) {
      return { x: screenX, y: screenY };
    }

    const worldPos = this._viewport.toWorld(screenX, screenY);
    return { x: worldPos.x, y: worldPos.y };
  }

  /**
   * Convert world coordinates to screen coordinates.
   */
  worldToScreen(worldX: number, worldY: number): Position {
    if (!this._viewport) {
      return { x: worldX, y: worldY };
    }

    const screenPos = this._viewport.toScreen(worldX, worldY);
    return { x: screenPos.x, y: screenPos.y };
  }

  /**
   * Snap a world position to the nearest grid point.
   */
  snapToGrid(pos: Position): Position {
    if (!this._snapEnabled) return pos;
    return {
      x: Math.round(pos.x / this._gridSize) * this._gridSize,
      y: Math.round(pos.y / this._gridSize) * this._gridSize,
    };
  }

  /**
   * Convert screen coordinates to world, optionally snapped to grid.
   */
  screenToWorldSnapped(screenX: number, screenY: number): Position {
    const world = this.screenToWorld(screenX, screenY);
    return this._snapEnabled ? this.snapToGrid(world) : world;
  }

  /**
   * Get the current zoom level from the viewport.
   */
  getZoom(): number {
    return this._viewport?.scale.x ?? 1;
  }

  /**
   * Get a world-space distance that corresponds to the given
   * screen-space pixel distance at the current zoom level.
   * Useful for hit testing thresholds.
   */
  screenDistanceToWorld(screenPixels: number): number {
    const zoom = this.getZoom();
    return zoom > 0 ? screenPixels / zoom : screenPixels;
  }

  destroy(): void {
    this._viewport = null;
  }
}
