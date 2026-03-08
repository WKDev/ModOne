/**
 * SelectionRenderer — Rubber Band & Selection Highlights
 *
 * Renders:
 * 1. Marquee selection rectangle (rubber band)
 * 2. Selection highlight outlines around selected blocks
 * 3. Selection handles (resize corners) for single-block selection
 *
 * Drawn on the 'selection' layer which is non-interactive (overlay only).
 */

import { Graphics, type Container } from 'pixi.js';
import type {
  Position,
  Rect,
  Block,
} from '../types';

// ============================================================================
// Configuration
// ============================================================================

export interface SelectionStyle {
  /** Marquee rectangle stroke color */
  marqueeStroke: number;
  /** Marquee rectangle fill color */
  marqueeFill: number;
  /** Marquee fill alpha */
  marqueeFillAlpha: number;
  /** Marquee stroke width */
  marqueeStrokeWidth: number;
  /** Selection highlight color */
  highlightColor: number;
  /** Selection highlight stroke width */
  highlightWidth: number;
  /** Handle size (square) */
  handleSize: number;
  /** Handle fill color */
  handleFill: number;
  /** Padding around selected element */
  highlightPadding: number;
}

const DEFAULT_SELECTION_STYLE: SelectionStyle = {
  marqueeStroke: 0x4dabf7,
  marqueeFill: 0x4dabf7,
  marqueeFillAlpha: 0.1,
  marqueeStrokeWidth: 1,
  highlightColor: 0x4dabf7,
  highlightWidth: 1.5,
  handleSize: 6,
  handleFill: 0x4dabf7,
  highlightPadding: 4,
};

export interface SelectionRendererOptions {
  /** The selection layer container */
  layer: Container;
  /** Selection visual style */
  style?: Partial<SelectionStyle>;
}

// ============================================================================
// SelectionRenderer
// ============================================================================

export class SelectionRenderer {
  private _layer: Container;
  private _style: SelectionStyle;
  private _marqueeGraphics: Graphics;
  private _highlightGraphics: Graphics;
  private _handlesGraphics: Graphics;
  private _destroyed = false;

  constructor(options: SelectionRendererOptions) {
    this._layer = options.layer;
    this._style = { ...DEFAULT_SELECTION_STYLE, ...options.style };

    this._marqueeGraphics = new Graphics();
    this._marqueeGraphics.label = 'selection-marquee';
    this._layer.addChild(this._marqueeGraphics);

    this._highlightGraphics = new Graphics();
    this._highlightGraphics.label = 'selection-highlights';
    this._layer.addChild(this._highlightGraphics);

    this._handlesGraphics = new Graphics();
    this._handlesGraphics.label = 'selection-handles';
    this._layer.addChild(this._handlesGraphics);
  }

  // --------------------------------------------------------------------------
  // Marquee Selection (rubber band)
  // --------------------------------------------------------------------------

  /**
   * Show the marquee selection rectangle.
   * startPos and currentPos are in world coordinates.
   */
  renderMarquee(startPos: Position, currentPos: Position): void {
    if (this._destroyed) return;

    const g = this._marqueeGraphics;
    g.clear();
    g.visible = true;

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(currentPos.x - startPos.x);
    const h = Math.abs(currentPos.y - startPos.y);

    if (w < 1 && h < 1) return;

    g.rect(x, y, w, h);
    g.fill({ color: this._style.marqueeFill, alpha: this._style.marqueeFillAlpha });
    g.stroke({
      color: this._style.marqueeStroke,
      width: this._style.marqueeStrokeWidth,
      pixelLine: true,
    });
  }

  /**
   * Hide the marquee rectangle.
   */
  clearMarquee(): void {
    this._marqueeGraphics.clear();
    this._marqueeGraphics.visible = false;
  }

  // --------------------------------------------------------------------------
  // Selection Highlights
  // --------------------------------------------------------------------------

  /**
   * Render selection highlights around selected blocks.
   */
  renderHighlights(
    selectedBlocks: Block[],
    selectedBounds?: Rect
  ): void {
    if (this._destroyed) return;

    const hg = this._highlightGraphics;
    const handles = this._handlesGraphics;
    hg.clear();
    handles.clear();

    if (selectedBlocks.length === 0) {
      hg.visible = false;
      handles.visible = false;
      return;
    }

    hg.visible = true;
    handles.visible = true;

    const pad = this._style.highlightPadding;

    // Individual block highlights
    for (const block of selectedBlocks) {
      const x = block.position.x - pad;
      const y = block.position.y - pad;
      const w = block.size.width + pad * 2;
      const h = block.size.height + pad * 2;

      hg.rect(x, y, w, h);
    }

    hg.stroke({
      color: this._style.highlightColor,
      width: this._style.highlightWidth,
      pixelLine: true,
    });

    // Group bounding box for multi-selection
    if (selectedBlocks.length > 1 && selectedBounds) {
      const bx = selectedBounds.x - pad * 2;
      const by = selectedBounds.y - pad * 2;
      const bw = selectedBounds.width + pad * 4;
      const bh = selectedBounds.height + pad * 4;

      // Dashed group outline (manual dash pattern)
      this._drawDashedRect(hg, bx, by, bw, bh, 6, 4);
      hg.stroke({
        color: this._style.highlightColor,
        width: 1,
        pixelLine: true,
        alpha: 0.5,
      });
    }

    // Resize handles for single selection
    if (selectedBlocks.length === 1) {
      const block = selectedBlocks[0];
      const hSize = this._style.handleSize;
      const hHalf = hSize / 2;
      const bx = block.position.x - pad;
      const by = block.position.y - pad;
      const bw = block.size.width + pad * 2;
      const bh = block.size.height + pad * 2;

      // Corner handles
      const corners = [
        { x: bx - hHalf, y: by - hHalf },
        { x: bx + bw - hHalf, y: by - hHalf },
        { x: bx - hHalf, y: by + bh - hHalf },
        { x: bx + bw - hHalf, y: by + bh - hHalf },
      ];

      for (const c of corners) {
        handles.rect(c.x, c.y, hSize, hSize);
      }

      handles.fill(this._style.handleFill);
      handles.stroke({ color: 0xffffff, width: 1, pixelLine: true });
    }
  }

  /**
   * Clear all selection highlights.
   */
  clearHighlights(): void {
    this._highlightGraphics.clear();
    this._highlightGraphics.visible = false;
    this._handlesGraphics.clear();
    this._handlesGraphics.visible = false;
  }

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  /**
   * Draw a dashed rectangle (no native dash support in Pixi.js v8).
   */
  private _drawDashedRect(
    g: Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    dashLen: number,
    gapLen: number
  ): void {
    // Top edge
    this._drawDashedLine(g, x, y, x + w, y, dashLen, gapLen);
    // Right edge
    this._drawDashedLine(g, x + w, y, x + w, y + h, dashLen, gapLen);
    // Bottom edge
    this._drawDashedLine(g, x + w, y + h, x, y + h, dashLen, gapLen);
    // Left edge
    this._drawDashedLine(g, x, y + h, x, y, dashLen, gapLen);
  }

  private _drawDashedLine(
    g: Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLen: number,
    gapLen: number
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
      const segLen = drawing ? dashLen : gapLen;
      const end = Math.min(pos + segLen, length);

      if (drawing) {
        g.moveTo(x1 + nx * pos, y1 + ny * pos);
        g.lineTo(x1 + nx * end, y1 + ny * end);
      }

      pos = end;
      drawing = !drawing;
    }
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._marqueeGraphics.destroy();
    this._highlightGraphics.destroy();
    this._handlesGraphics.destroy();
  }
}
