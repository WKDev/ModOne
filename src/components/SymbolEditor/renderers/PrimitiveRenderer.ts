/**
 * PrimitiveRenderer — GraphicPrimitive[] → Pixi.js Graphics
 *
 * Renders symbol graphic primitives (rect, circle, polyline, arc, text)
 * onto a Pixi.js Container. Re-renders the entire set on each call.
 *
 * Uses Pixi.js v8 Graphics API with `pixelLine: true` for crisp lines.
 *
 * Primitives with a `rotation` value — or whose id is listed as an animation
 * target — are rendered inside individual Containers so that per-primitive
 * rotation transforms can be applied (static rotation or live ticker spin).
 */

import { Container, Graphics, Text as PixiText, type TextStyleOptions } from 'pixi.js';
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

/** Compute the visual center of a primitive for rotation pivot. */
function getPrimitiveCenter(prim: GraphicPrimitive): { x: number; y: number } {
  switch (prim.kind) {
    case 'rect':
      return { x: prim.x + prim.width / 2, y: prim.y + prim.height / 2 };
    case 'circle':
      return { x: prim.cx, y: prim.cy };
    case 'arc':
      return { x: prim.cx, y: prim.cy };
    case 'polyline': {
      if (prim.points.length === 0) return { x: 0, y: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of prim.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    }
    case 'text':
      return { x: prim.x, y: prim.y };
  }
}

export class PrimitiveRenderer {
  private _layer: Container;
  /** Shared Graphics object for non-rotated shape primitives */
  private _graphics: Graphics;
  private _textObjects: PixiText[] = [];
  /** Individual containers for rotated primitives */
  private _rotatedContainers: Container[] = [];
  /** Animation targets addressable by primitive id (for live ticker spin). */
  private _animationTargets = new Map<string, { container: Container; baseRotation: number }>();
  private _destroyed = false;

  constructor(options: PrimitiveRendererOptions) {
    this._layer = options.layer;
    this._graphics = new Graphics();
    this._graphics.label = 'symbol-primitives';
    this._layer.addChild(this._graphics);
  }

  /**
   * Render all graphic primitives. Clears previous output.
   *
   * @param animatedIds primitive ids that should be wrapped in their own
   *   container (in addition to any with a static `rotation`) so a ticker can
   *   spin them. Retrieve the container via {@link getAnimationTarget}.
   */
  renderAll(primitives: GraphicPrimitive[], animatedIds?: ReadonlySet<string>): void {
    if (this._destroyed) return;

    // Clear previous render
    this._graphics.clear();
    for (const txt of this._textObjects) {
      txt.destroy();
    }
    this._textObjects = [];
    for (const c of this._rotatedContainers) {
      c.destroy({ children: true });
    }
    this._rotatedContainers = [];
    this._animationTargets.clear();

    for (const prim of primitives) {
      const animated = !!prim.id && !!animatedIds?.has(prim.id);
      if (prim.rotation || animated) {
        this._renderRotatedPrimitive(prim, animated);
      } else {
        this._renderPrimitive(prim, this._graphics);
      }
    }
  }

  /**
   * Get the container + base rotation for an animation target by primitive id.
   * Returns undefined if the id was not rendered as an animatable container.
   */
  getAnimationTarget(id: string): { container: Container; baseRotation: number } | undefined {
    return this._animationTargets.get(id);
  }

  /**
   * Render a primitive with rotation applied via a wrapping Container.
   * The primitive is drawn at the origin of a local Graphics, and the
   * container is positioned + rotated around the primitive's visual center.
   */
  private _renderRotatedPrimitive(prim: GraphicPrimitive, register: boolean): void {
    const center = getPrimitiveCenter(prim);
    const container = new Container();
    container.label = 'rotated-primitive';
    container.position.set(center.x, center.y);
    const baseRotation = ((prim.rotation ?? 0) * Math.PI) / 180;
    container.rotation = baseRotation;

    if (prim.kind === 'text') {
      // Text is a separate Pixi object; offset by -center so it rotates around center
      const textObj = this._createTextObject(prim);
      textObj.x = prim.x - center.x;
      textObj.y = prim.y - center.y;
      container.addChild(textObj);
      // Track for later cleanup (handled via container.destroy({children:true}))
    } else {
      const g = new Graphics();
      // Render the shape offset by -center so rotation pivots correctly
      this._renderPrimitiveOffset(prim, g, -center.x, -center.y);
      container.addChild(g);
    }

    this._layer.addChild(container);
    this._rotatedContainers.push(container);
    if (register && prim.id) {
      this._animationTargets.set(prim.id, { container, baseRotation });
    }
  }

  /**
   * Render a single primitive into the given Graphics object (no rotation).
   */
  private _renderPrimitive(prim: GraphicPrimitive, g: Graphics): void {
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
        if (prim.closed) {
          g.closePath();
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
        const textObj = this._createTextObject(prim);
        this._layer.addChild(textObj);
        this._textObjects.push(textObj);
        break;
      }
    }
  }

  /**
   * Render a non-text primitive into a Graphics object with an (ox, oy) offset.
   * Used for rotated primitives so they are centered at the container origin.
   */
  private _renderPrimitiveOffset(
    prim: GraphicPrimitive,
    g: Graphics,
    ox: number,
    oy: number,
  ): void {
    switch (prim.kind) {
      case 'rect': {
        g.rect(prim.x + ox, prim.y + oy, prim.width, prim.height);
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
        g.circle(prim.cx + ox, prim.cy + oy, prim.r);
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
        g.moveTo(prim.points[0].x + ox, prim.points[0].y + oy);
        for (let i = 1; i < prim.points.length; i++) {
          g.lineTo(prim.points[i].x + ox, prim.points[i].y + oy);
        }
        if (prim.closed) {
          g.closePath();
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
        g.arc(prim.cx + ox, prim.cy + oy, prim.r, startRad, endRad);
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

      // text handled separately in _renderRotatedPrimitive
      case 'text':
        break;
    }
  }

  /** Create a PixiText object from a text primitive. */
  private _createTextObject(prim: Extract<GraphicPrimitive, { kind: 'text' }>): PixiText {
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
    return textObj;
  }

  /** Clean up all resources */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const txt of this._textObjects) {
      txt.destroy();
    }
    this._textObjects = [];
    for (const c of this._rotatedContainers) {
      c.destroy({ children: true });
    }
    this._rotatedContainers = [];
    this._animationTargets.clear();
    this._graphics.destroy();
  }
}
