/**
 * OverlayRenderer — Origin Crosshair & Selection Highlights + Resize/Rotate Handles
 *
 * Renders:
 * 1. Origin crosshair at (0,0) — always visible
 * 2. Selection highlight outlines around selected primitives/pins
 * 3. Resize handles (8) and rotation handle when a single resizable primitive is selected
 */

import { Graphics, type Container } from 'pixi.js';
import type { GraphicPrimitive, SymbolPin, PolylinePrimitive } from '@/types/symbol';

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

// Handle visual constants
const HANDLE_SIZE = 6;
const HANDLE_HALF = HANDLE_SIZE / 2;
// Handle palette matches OneCanvas's SelectionRenderer convention so the two
// editors share one selection look: blue square handles with a white border.
const HANDLE_FILL = 0x4dabf7;
const HANDLE_STROKE = 0xffffff;
const HANDLE_STROKE_WIDTH = 1.5;
const HANDLE_HIT_RADIUS = 8;
const ROTATION_HANDLE_DISTANCE = 20;
const ROTATION_HANDLE_RADIUS = 4;

// Point-edit handle visual constants
const POINT_HANDLE_RADIUS = 4;
const POINT_HANDLE_FILL = 0xffffff;
const POINT_HANDLE_STROKE = 0xff6600;
const POINT_HANDLE_STROKE_WIDTH = 1.5;
const POINT_SEGMENT_COLOR = 0xff6600;
const POINT_SEGMENT_ALPHA = 0.4;

/** Types of resize handles */
export type HandleType =
  | 'nw' | 'n' | 'ne'
  | 'e'  | 'se' | 's'
  | 'sw' | 'w'
  | 'rotate';

/** Handle position data for hit-testing */
interface HandlePosition {
  type: HandleType;
  x: number;
  y: number;
}

/**
 * Resizable primitive kinds — only rect, circle, text get resize handles.
 * Polyline uses point editing, arc has no resize UI, pins use move-only.
 */
const RESIZABLE_KINDS = new Set(['rect', 'circle', 'text']);

export class OverlayRenderer {
  private _selectionLayer: Container;
  private _overlayLayer: Container;
  private _originGraphics: Graphics;
  private _selectionGraphics: Graphics;
  private _handleGraphics: Graphics;
  private _pointEditGraphics: Graphics;
  private _destroyed = false;

  /** Stored handle positions for hit-testing — updated each renderSelection call */
  private _handlePositions: HandlePosition[] = [];

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

    // Resize/rotate handles on selection layer (above highlights)
    this._handleGraphics = new Graphics();
    this._handleGraphics.label = 'resize-handles';
    this._selectionLayer.addChild(this._handleGraphics);

    // Point-edit handles on selection layer (above resize handles)
    this._pointEditGraphics = new Graphics();
    this._pointEditGraphics.label = 'point-edit-handles';
    this._selectionLayer.addChild(this._pointEditGraphics);

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
   * Check if a world-space point hits a resize/rotate handle.
   * Returns the handle type or null.
   */
  getHandleAt(x: number, y: number): HandleType | null {
    for (const hp of this._handlePositions) {
      const dx = x - hp.x;
      const dy = y - hp.y;
      if (dx * dx + dy * dy <= HANDLE_HIT_RADIUS * HANDLE_HIT_RADIUS) {
        return hp.type;
      }
    }
    return null;
  }

  /**
   * Get the bounding box of the single selected resizable primitive.
   * Returns null if conditions are not met (not exactly 1 resizable prim selected).
   */
  getSelectedResizableBounds(
    selectedIds: Set<string>,
    graphics: GraphicPrimitive[],
  ): { x: number; y: number; width: number; height: number } | null {
    // Only show handles for single graphic primitive selection
    const graphicIds = Array.from(selectedIds).filter(id => id.startsWith('g-'));
    if (graphicIds.length !== 1) return null;

    const idx = parseInt(graphicIds[0].slice(2), 10);
    const prim = graphics[idx];
    if (!prim || !RESIZABLE_KINDS.has(prim.kind)) return null;

    return this._getPrimitiveBounds(prim);
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
    this._handleGraphics.clear();
    this._handlePositions = [];

    if (selectedIds.size === 0) {
      g.visible = false;
      this._handleGraphics.visible = false;
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

    // Draw resize/rotate handles when exactly 1 resizable primitive is selected
    const resizableBounds = this.getSelectedResizableBounds(selectedIds, graphics);
    if (resizableBounds) {
      this._drawHandles(resizableBounds);
    }
  }

  /**
   * Draw the 8 resize handles + 1 rotation handle around the given bounds.
   */
  private _drawHandles(bounds: { x: number; y: number; width: number; height: number }): void {
    const h = this._handleGraphics;
    h.visible = true;
    h.clear();

    const { x, y, width: w, height: ht } = bounds;
    const pad = SELECTION_PADDING;

    // Padded bounds (handles sit on the selection box, not the primitive)
    const bx = x - pad;
    const by = y - pad;
    const bw = w + pad * 2;
    const bh = ht + pad * 2;

    // Handle positions: corners + edge midpoints
    const handles: HandlePosition[] = [
      { type: 'nw', x: bx,          y: by },
      { type: 'n',  x: bx + bw / 2, y: by },
      { type: 'ne', x: bx + bw,     y: by },
      { type: 'e',  x: bx + bw,     y: by + bh / 2 },
      { type: 'se', x: bx + bw,     y: by + bh },
      { type: 's',  x: bx + bw / 2, y: by + bh },
      { type: 'sw', x: bx,          y: by + bh },
      { type: 'w',  x: bx,          y: by + bh / 2 },
    ];

    // Rotation handle: above top-center
    const rotateX = bx + bw / 2;
    const rotateY = by - ROTATION_HANDLE_DISTANCE;
    handles.push({ type: 'rotate', x: rotateX, y: rotateY });

    this._handlePositions = handles;

    // Draw connection line from top-center to rotation handle (selection blue,
    // matching the selection outline).
    h.moveTo(bx + bw / 2, by);
    h.lineTo(rotateX, rotateY);
    h.stroke({ color: SELECTION_COLOR, width: 1, pixelLine: true });

    // Draw rotation handle (circle) — blue fill, white border, crisp at any zoom.
    h.circle(rotateX, rotateY, ROTATION_HANDLE_RADIUS);
    h.fill({ color: HANDLE_FILL });
    h.stroke({ color: HANDLE_STROKE, width: HANDLE_STROKE_WIDTH, pixelLine: true });

    // Draw 8 resize handles (squares) — blue fill, white border.
    for (const hp of handles) {
      if (hp.type === 'rotate') continue;
      h.rect(hp.x - HANDLE_HALF, hp.y - HANDLE_HALF, HANDLE_SIZE, HANDLE_SIZE);
      h.fill({ color: HANDLE_FILL });
      h.stroke({ color: HANDLE_STROKE, width: HANDLE_STROKE_WIDTH, pixelLine: true });
    }
  }

  /**
   * Render vertex handles for a polyline in point-edit mode.
   * Shows circles at each vertex and dashed lines for segments.
   * @param polylineIndex - Index of the polyline in the graphics array
   * @param graphics      - The full graphics array
   */
  renderPointEditHandles(
    polylineIndex: number | null,
    graphics: GraphicPrimitive[],
  ): void {
    if (this._destroyed) return;

    const g = this._pointEditGraphics;
    g.clear();

    if (polylineIndex === null || polylineIndex < 0) {
      g.visible = false;
      return;
    }

    const prim = graphics[polylineIndex];
    if (!prim || prim.kind !== 'polyline') {
      g.visible = false;
      return;
    }

    const polyline = prim as PolylinePrimitive;
    if (polyline.points.length === 0) {
      g.visible = false;
      return;
    }

    g.visible = true;

    // Draw segments in highlight color
    g.moveTo(polyline.points[0].x, polyline.points[0].y);
    for (let i = 1; i < polyline.points.length; i++) {
      g.lineTo(polyline.points[i].x, polyline.points[i].y);
    }
    if (polyline.closed && polyline.points.length >= 3) {
      g.closePath();
    }
    g.stroke({
      color: POINT_SEGMENT_COLOR,
      width: 1,
      pixelLine: true,
      alpha: POINT_SEGMENT_ALPHA,
    });

    // Draw vertex handles
    for (const pt of polyline.points) {
      g.circle(pt.x, pt.y, POINT_HANDLE_RADIUS);
      g.fill({ color: POINT_HANDLE_FILL });
      g.stroke({ color: POINT_HANDLE_STROKE, width: POINT_HANDLE_STROKE_WIDTH });
    }
  }

  /** Clear selection highlights */
  clearSelection(): void {
    this._selectionGraphics.clear();
    this._selectionGraphics.visible = false;
    this._handleGraphics.clear();
    this._handleGraphics.visible = false;
    this._pointEditGraphics.clear();
    this._pointEditGraphics.visible = false;
    this._handlePositions = [];
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
    this._handleGraphics.destroy();
    this._pointEditGraphics.destroy();
  }
}
