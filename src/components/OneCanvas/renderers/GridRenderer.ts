/**
 * GridRenderer — Infinite Grid with Major/Minor Lines
 *
 * Renders a two-level grid that spans the visible viewport area.
 * Uses Pixi.js v8 `pixelLine: true` for always-1px crisp lines
 * regardless of zoom level.
 *
 * Performance strategy:
 * - Only draws lines within the visible viewport bounds
 * - Rebuilds on viewport change (pan/zoom)
 * - Uses a single Graphics object (batched draw calls)
 * - Fades minor grid at low zoom levels
 */

import { Graphics, type Container } from 'pixi.js';
import type { GridConfig, ViewportBounds } from '../types';
import { DEFAULT_GRID } from '../types';

export interface GridRendererOptions {
  /** The layer container to add the grid to */
  layer: Container;
  /** Grid configuration */
  config?: GridConfig;
}

/**
 * Renders minor and major grid lines across the visible viewport area.
 */
export class GridRenderer {
  private _graphics: Graphics;
  private _config: GridConfig;
  private _layer: Container;
  private _lastBounds: ViewportBounds | null = null;
  private _lastZoom = -1;
  private _destroyed = false;

  constructor(options: GridRendererOptions) {
    this._config = options.config ?? DEFAULT_GRID;
    this._layer = options.layer;
    this._graphics = new Graphics();
    this._graphics.label = 'grid-lines';
    this._layer.addChild(this._graphics);
  }

  /** Update grid configuration */
  set config(value: GridConfig) {
    this._config = value;
    this._lastBounds = null; // Force redraw
  }

  get config(): GridConfig {
    return this._config;
  }

  /**
   * Redraw the grid for the current viewport.
   *
   * @param bounds — Visible world-coordinate bounds
   * @param zoom — Current zoom level (for LOD decisions)
   */
  render(bounds: ViewportBounds, zoom: number): void {
    if (this._destroyed || !this._config.visible) {
      this._graphics.visible = false;
      return;
    }
    this._graphics.visible = true;

    // Skip redraw if viewport hasn't meaningfully changed
    if (this._lastBounds && this._lastZoom === zoom) {
      const b = this._lastBounds;
      const threshold = this._config.size;
      if (
        Math.abs(bounds.minX - b.minX) < threshold &&
        Math.abs(bounds.minY - b.minY) < threshold &&
        Math.abs(bounds.maxX - b.maxX) < threshold &&
        Math.abs(bounds.maxY - b.maxY) < threshold
      ) {
        return;
      }
    }

    this._lastBounds = { ...bounds };
    this._lastZoom = zoom;

    const g = this._graphics;
    g.clear();

    const gridSize = this._config.size;
    const subdivisions = this._config.subdivisions ?? 5;
    const majorInterval = gridSize * subdivisions;

    // Extend bounds slightly to prevent edge gaps
    const pad = majorInterval;
    const left = Math.floor((bounds.minX - pad) / gridSize) * gridSize;
    const right = Math.ceil((bounds.maxX + pad) / gridSize) * gridSize;
    const top = Math.floor((bounds.minY - pad) / gridSize) * gridSize;
    const bottom = Math.ceil((bounds.maxY + pad) / gridSize) * gridSize;

    // Compute opacity for minor lines (fade out when zoomed out)
    const minorAlpha = Math.min(1, Math.max(0, (zoom - 0.15) / 0.35));
    const showMinor = minorAlpha > 0.02;

    // Parse colors (hex string → number)
    const minorColor = parseInt((this._config.color ?? '#cccccc').replace('#', ''), 16);
    const majorColor = parseInt((this._config.majorColor ?? '#999999').replace('#', ''), 16);

    // Draw minor vertical lines
    if (showMinor) {
      if (this._config.style === 'dots') {
        g.setStrokeStyle({ width: 0 }); // Use fill instead of stroke for dots
        g.beginPath();
        for (let x = left; x <= right; x += gridSize) {
           if (x % majorInterval === 0) continue;
           for (let y = top; y <= bottom; y += gridSize) {
             if (y % majorInterval === 0) continue;
             g.drawCircle(x, y, 1 / zoom);
           }
        }
        g.fill({ color: minorColor, alpha: minorAlpha * 0.4 });
      } else {
        for (let x = left; x <= right; x += gridSize) {
          // Skip major lines (drawn separately with different style)
          if (x % majorInterval === 0) continue;
          g.moveTo(x, top);
          g.lineTo(x, bottom);
        }
        // Draw minor horizontal lines
        for (let y = top; y <= bottom; y += gridSize) {
          if (y % majorInterval === 0) continue;
          g.moveTo(left, y);
          g.lineTo(right, y);
        }
        g.stroke({ color: minorColor, width: 1, pixelLine: true, alpha: minorAlpha * 0.4 });
      }
    }

    // Draw major vertical lines
    const majorLeft = Math.floor((bounds.minX - pad) / majorInterval) * majorInterval;
    const majorRight = Math.ceil((bounds.maxX + pad) / majorInterval) * majorInterval;
    const majorTop = Math.floor((bounds.minY - pad) / majorInterval) * majorInterval;
    const majorBottom = Math.ceil((bounds.maxY + pad) / majorInterval) * majorInterval;

    if (this._config.style === 'dots') {
      g.setStrokeStyle({ width: 0 });
      g.beginPath();
      for (let x = majorLeft; x <= majorRight; x += majorInterval) {
        for (let y = majorTop; y <= majorBottom; y += majorInterval) {
          g.drawCircle(x, y, 1.5 / zoom);
        }
      }
      g.fill({ color: majorColor, alpha: 0.5 });
    } else {
      for (let x = majorLeft; x <= majorRight; x += majorInterval) {
        g.moveTo(x, majorTop);
        g.lineTo(x, majorBottom);
      }
      for (let y = majorTop; y <= majorBottom; y += majorInterval) {
        g.moveTo(majorLeft, y);
        g.lineTo(majorRight, y);
      }
      g.stroke({ color: majorColor, width: 1, pixelLine: true, alpha: 0.5 });
    }

    // Origin cross-hair (slightly brighter)
    if (left <= 0 && right >= 0 && top <= 0 && bottom >= 0) {
      g.moveTo(0, top);
      g.lineTo(0, bottom);
      g.moveTo(left, 0);
      g.lineTo(right, 0);
      g.stroke({ color: majorColor, width: 1, pixelLine: true, alpha: 0.8 });
    }
  }

  /** Show or hide the grid */
  setVisible(visible: boolean): void {
    this._config = { ...this._config, visible };
    this._graphics.visible = visible;
  }

  /** Clean up */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._graphics.destroy();
    this._lastBounds = null;
  }
}
