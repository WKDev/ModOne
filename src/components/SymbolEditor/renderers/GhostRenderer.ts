/**
 * GhostRenderer — Tool Preview Shapes → Pixi.js Graphics
 *
 * Renders ghost preview shapes from tool operations onto the ghost layer.
 * All ghosts use dashed lines (#cccccc, strokeDasharray equivalent).
 *
 * Pixi.js v8 does not support native dash patterns on stroke, so we
 * manually draw dashed segments for a professional look.
 */

import { Graphics, type Container } from 'pixi.js';
import type { GhostShape } from '../types';

export interface GhostRendererOptions {
  /** The ghost layer container */
  layer: Container;
}

const GHOST_COLOR = 0xcccccc;
const GHOST_WIDTH = 1;
const GHOST_ALPHA = 0.8;
const MARQUEE_STROKE = 0x0066ff;
const MARQUEE_FILL = 0x0066ff;
const MARQUEE_FILL_ALPHA = 0.1;
const DASH_LENGTH = 4;
const GAP_LENGTH = 4;

export class GhostRenderer {
  private _layer: Container;
  private _graphics: Graphics;
  private _destroyed = false;

  constructor(options: GhostRendererOptions) {
    this._layer = options.layer;
    this._graphics = new Graphics();
    this._graphics.label = 'symbol-ghost';
    this._layer.addChild(this._graphics);
  }

  /**
   * Render a ghost shape. Clears previous ghost.
   * Pass null to clear.
   */
  render(shape: GhostShape | null): void {
    if (this._destroyed) return;

    this._graphics.clear();
    if (!shape) {
      this._graphics.visible = false;
      return;
    }

    this._graphics.visible = true;

    switch (shape.kind) {
      case 'rect':
        this._drawDashedRect(shape.x, shape.y, shape.width, shape.height);
        this._graphics.stroke({
          color: GHOST_COLOR,
          width: GHOST_WIDTH,
          pixelLine: true,
          alpha: GHOST_ALPHA,
        });
        break;

      case 'circle':
        // Approximate dashed circle with solid for simplicity
        // (dashed circle is extremely complex to implement manually)
        this._graphics.circle(shape.cx, shape.cy, shape.r);
        this._graphics.stroke({
          color: GHOST_COLOR,
          width: GHOST_WIDTH,
          pixelLine: true,
          alpha: GHOST_ALPHA,
        });
        break;

      case 'line':
        this._drawDashedLine(shape.x1, shape.y1, shape.x2, shape.y2);
        this._graphics.stroke({
          color: GHOST_COLOR,
          width: GHOST_WIDTH,
          pixelLine: true,
          alpha: GHOST_ALPHA,
        });
        break;

      case 'arc': {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        this._graphics.arc(shape.cx, shape.cy, shape.r, toRad(shape.startAngle), toRad(shape.endAngle));
        this._graphics.stroke({
          color: GHOST_COLOR,
          width: GHOST_WIDTH,
          pixelLine: true,
          alpha: GHOST_ALPHA,
        });
        break;
      }

      case 'polyline': {
        if (shape.points.length < 2) break;
        const pts = shape.points;
        // Draw dashed polyline segments
        for (let i = 0; i < pts.length - 1; i++) {
          this._drawDashedLine(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        }
        this._graphics.stroke({
          color: GHOST_COLOR,
          width: GHOST_WIDTH,
          pixelLine: true,
          alpha: GHOST_ALPHA,
        });
        break;
      }

      case 'marquee':
        this._graphics.rect(shape.x, shape.y, shape.width, shape.height);
        this._graphics.fill({ color: MARQUEE_FILL, alpha: MARQUEE_FILL_ALPHA });
        this._graphics.stroke({
          color: MARQUEE_STROKE,
          width: GHOST_WIDTH,
          pixelLine: true,
        });
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Dashed drawing helpers
  // --------------------------------------------------------------------------

  private _drawDashedRect(x: number, y: number, w: number, h: number): void {
    this._drawDashedLine(x, y, x + w, y);
    this._drawDashedLine(x + w, y, x + w, y + h);
    this._drawDashedLine(x + w, y + h, x, y + h);
    this._drawDashedLine(x, y + h, x, y);
  }

  private _drawDashedLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;

    const nx = dx / length;
    const ny = dy / length;
    let pos = 0;
    let drawing = true;

    while (pos < length) {
      const segLen = drawing ? DASH_LENGTH : GAP_LENGTH;
      const end = Math.min(pos + segLen, length);

      if (drawing) {
        this._graphics.moveTo(x1 + nx * pos, y1 + ny * pos);
        this._graphics.lineTo(x1 + nx * end, y1 + ny * end);
      }

      pos = end;
      drawing = !drawing;
    }
  }

  /** Clean up resources */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._graphics.destroy();
  }
}
