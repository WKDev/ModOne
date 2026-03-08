/**
 * PrimitiveRenderer — GraphicPrimitive[] → Pixi.js Graphics
 *
 * Renders symbol graphic primitives (rect, circle, polyline, arc, text)
 * onto a Pixi.js Container. Re-renders the entire set on each call.
 *
 * Uses Pixi.js v8 Graphics API with `pixelLine: true` for crisp lines.
 */

import { Graphics, Text as PixiText, type Container, type TextStyleOptions } from 'pixi.js';
import type { GraphicPrimitive } from '@/types/symbol';

export interface PrimitiveRendererOptions {
  /** The layer container to add primitives to */
  layer: Container;
}

/**
 * Parse a CSS hex color string to a numeric value.
 * Handles both '#rrggbb' and 'none'.
 */
function parseColor(color: string): number {
  if (!color || color === 'none' || color === 'transparent') return 0x000000;
  return parseInt(color.replace('#', ''), 16);
}

function hasFill(color: string): boolean {
  return !!color && color !== 'none' && color !== 'transparent';
}

export class PrimitiveRenderer {
  private _layer: Container;
  private _graphics: Graphics;
  private _textObjects: PixiText[] = [];
  private _destroyed = false;

  constructor(options: PrimitiveRendererOptions) {
    this._layer = options.layer;
    this._graphics = new Graphics();
    this._graphics.label = 'symbol-primitives';
    this._layer.addChild(this._graphics);
  }

  /**
   * Render all graphic primitives. Clears previous output.
   */
  renderAll(primitives: GraphicPrimitive[]): void {
    if (this._destroyed) return;

    // Clear previous render
    this._graphics.clear();
    for (const txt of this._textObjects) {
      txt.destroy();
    }
    this._textObjects = [];

    for (const prim of primitives) {
      this._renderPrimitive(prim);
    }
  }

  private _renderPrimitive(prim: GraphicPrimitive): void {
    const g = this._graphics;

    switch (prim.kind) {
      case 'rect': {
        g.rect(prim.x, prim.y, prim.width, prim.height);
        if (hasFill(prim.fill)) {
          g.fill({ color: parseColor(prim.fill) });
        }
        g.stroke({
          color: parseColor(prim.stroke),
          width: prim.strokeWidth,
          pixelLine: true,
        });
        break;
      }

      case 'circle': {
        g.circle(prim.cx, prim.cy, prim.r);
        if (hasFill(prim.fill)) {
          g.fill({ color: parseColor(prim.fill) });
        }
        g.stroke({
          color: parseColor(prim.stroke),
          width: prim.strokeWidth,
          pixelLine: true,
        });
        break;
      }

      case 'polyline': {
        if (prim.points.length < 2) break;
        g.moveTo(prim.points[0].x, prim.points[0].y);
        for (let i = 1; i < prim.points.length; i++) {
          g.lineTo(prim.points[i].x, prim.points[i].y);
        }
        if (hasFill(prim.fill)) {
          g.fill({ color: parseColor(prim.fill) });
        }
        g.stroke({
          color: parseColor(prim.stroke),
          width: prim.strokeWidth,
          pixelLine: true,
        });
        break;
      }

      case 'arc': {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const startRad = toRad(prim.startAngle);
        const endRad = toRad(prim.endAngle);
        g.arc(prim.cx, prim.cy, prim.r, startRad, endRad);
        if (hasFill(prim.fill)) {
          g.fill({ color: parseColor(prim.fill) });
        }
        g.stroke({
          color: parseColor(prim.stroke),
          width: prim.strokeWidth,
          pixelLine: true,
        });
        break;
      }

      case 'text': {
        const style: TextStyleOptions = {
          fontSize: prim.fontSize,
          fontFamily: prim.fontFamily,
          fill: parseColor(prim.fill),
        };
        const textObj = new PixiText({ text: prim.text, style });
        textObj.x = prim.x;
        textObj.y = prim.y;
        // Map SVG text-anchor to Pixi anchor
        switch (prim.anchor) {
          case 'middle':
            textObj.anchor.set(0.5, 1);
            break;
          case 'end':
            textObj.anchor.set(1, 1);
            break;
          default: // 'start'
            textObj.anchor.set(0, 1);
            break;
        }
        this._layer.addChild(textObj);
        this._textObjects.push(textObj);
        break;
      }
    }
  }

  /** Clean up all resources */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const txt of this._textObjects) {
      txt.destroy();
    }
    this._textObjects = [];
    this._graphics.destroy();
  }
}
