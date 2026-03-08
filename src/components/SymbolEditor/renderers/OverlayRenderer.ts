/**
 * OverlayRenderer — Origin Crosshair & Selection Highlights
 *
 * Renders:
 * 1. Origin crosshair at (0,0) — always visible
 * 2. Selection highlight outlines around selected primitives/pins
 */

import { Graphics, type Container } from 'pixi.js';
import type { GraphicPrimitive, SymbolPin } from '@/types/symbol';

export interface OverlayRendererOptions {
  /** The selection layer container */
  selectionLayer: Container;
  /** The overlay layer container */
  overlayLayer: Container;
}

const ORIGIN_COLOR = 0x444444;
const ORIGIN_LENGTH = 20;
const ORIGIN_ALPHA = 0.8;

const SELECTION_COLOR = 0x4dabf7;
const SELECTION_WIDTH = 1.5;
const SELECTION_PADDING = 4;
const TOLERANCE = 5;

export class OverlayRenderer {
  private _selectionLayer: Container;
  private _overlayLayer: Container;
  private _originGraphics: Graphics;
  private _selectionGraphics: Graphics;
  private _destroyed = false;

  constructor(options: OverlayRendererOptions) {
    this._selectionLayer = options.selectionLayer;
    this._overlayLayer = options.overlayLayer;

    // Origin crosshair on overlay layer
    this._originGraphics = new Graphics();
    this._originGraphics.label = 'origin-crosshair';
    this._overlayLayer.addChild(this._originGraphics);

    // Selection highlights on selection layer
    this._selectionGraphics = new Graphics();
    this._selectionGraphics.label = 'selection-highlights';
    this._selectionLayer.addChild(this._selectionGraphics);

    // Draw origin crosshair once (static)
    this._drawOrigin();
  }

  private _drawOrigin(): void {
    const g = this._originGraphics;
    g.moveTo(-ORIGIN_LENGTH, 0);
    g.lineTo(ORIGIN_LENGTH, 0);
    g.moveTo(0, -ORIGIN_LENGTH);
    g.lineTo(0, ORIGIN_LENGTH);
    g.stroke({ color: ORIGIN_COLOR, width: 1, pixelLine: true, alpha: ORIGIN_ALPHA });
  }

  /**
   * Render selection highlights around selected primitives and pins.
   */
  renderSelection(
    selectedIds: Set<string>,
    graphics: GraphicPrimitive[],
    pins: SymbolPin[],
  ): void {
    if (this._destroyed) return;

    const g = this._selectionGraphics;
    g.clear();

    if (selectedIds.size === 0) {
      g.visible = false;
      return;
    }

    g.visible = true;
    const pad = SELECTION_PADDING;

    for (const id of selectedIds) {
      if (id.startsWith('g-')) {
        const idx = parseInt(id.slice(2), 10);
        const prim = graphics[idx];
        if (!prim) continue;

        const bounds = this._getPrimitiveBounds(prim);
        if (bounds) {
          g.rect(
            bounds.x - pad,
            bounds.y - pad,
            bounds.width + pad * 2,
            bounds.height + pad * 2,
          );
        }
      } else {
        // Pin selection
        const pin = pins.find((p) => p.id === id);
        if (!pin) continue;

        g.rect(
          pin.position.x - TOLERANCE - pad,
          pin.position.y - TOLERANCE - pad,
          TOLERANCE * 2 + pad * 2,
          TOLERANCE * 2 + pad * 2,
        );
      }
    }

    g.stroke({
      color: SELECTION_COLOR,
      width: SELECTION_WIDTH,
      pixelLine: true,
    });
  }

  /** Clear selection highlights */
  clearSelection(): void {
    this._selectionGraphics.clear();
    this._selectionGraphics.visible = false;
  }

  private _getPrimitiveBounds(
    prim: GraphicPrimitive,
  ): { x: number; y: number; width: number; height: number } | null {
    switch (prim.kind) {
      case 'rect':
        return { x: prim.x, y: prim.y, width: prim.width, height: prim.height };

      case 'circle':
        return {
          x: prim.cx - prim.r,
          y: prim.cy - prim.r,
          width: prim.r * 2,
          height: prim.r * 2,
        };

      case 'polyline': {
        if (prim.points.length === 0) return null;
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const p of prim.points) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }

      case 'arc':
        return {
          x: prim.cx - prim.r,
          y: prim.cy - prim.r,
          width: prim.r * 2,
          height: prim.r * 2,
        };

      case 'text':
        // Approximate text bounds
        return {
          x: prim.x,
          y: prim.y - prim.fontSize,
          width: prim.text.length * prim.fontSize * 0.6,
          height: prim.fontSize * 1.2,
        };

      default:
        return null;
    }
  }

  /** Clean up resources */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._originGraphics.destroy();
    this._selectionGraphics.destroy();
  }
}
