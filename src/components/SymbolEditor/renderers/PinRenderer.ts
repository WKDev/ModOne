/**
 * PinRenderer — SymbolPin[] → Pixi.js Graphics
 *
 * Renders symbol pins as circles with orientation lines.
 * Matches the SVG rendering from EditorCanvas.tsx:
 * - Circle at pin position (r=4, fill=#ff8844)
 * - Direction line from position toward orientation
 */

import { Graphics, Text as PixiText, type Container, type TextStyleOptions } from 'pixi.js';
import type { SymbolPin, PinOrientation } from '@/types/symbol';
import { colorForPinType } from '../pinStyle';

export interface PinRendererOptions {
  /** The layer container to add pins to */
  layer: Container;
}

const PIN_RADIUS = 4;
const PIN_LINE_WIDTH = 1.5;
const PIN_LABEL_SIZE = 9;
const PIN_LABEL_COLOR = 0x555555;
const PIN_NAME_COLOR = 0x334155;
/** Radius of the active-low bubble for `shape: 'inverted'`. */
const PIN_BUBBLE_RADIUS = 3;

/** Unit vector pointing outward along the pin's orientation. */
function orientationVector(orientation: PinOrientation): { ux: number; uy: number } {
  switch (orientation) {
    case 'right': return { ux: 1, uy: 0 };
    case 'left': return { ux: -1, uy: 0 };
    case 'up': return { ux: 0, uy: -1 };
    case 'down': return { ux: 0, uy: 1 };
  }
}

export class PinRenderer {
  private _layer: Container;
  private _graphics: Graphics;
  private _labels: PixiText[] = [];
  private _destroyed = false;

  constructor(options: PinRendererOptions) {
    this._layer = options.layer;
    this._graphics = new Graphics();
    this._graphics.label = 'symbol-pins';
    this._layer.addChild(this._graphics);
  }

  /**
   * Render all pins. Clears previous output.
   *
   * `poweredPins` (optional) draws a green glow ring on the given pin ids —
   * used by the editor's interactive preview to show energised connection points.
   */
  renderAll(pins: SymbolPin[], poweredPins?: ReadonlySet<string>): void {
    if (this._destroyed) return;

    this._graphics.clear();
    for (const label of this._labels) {
      label.destroy();
    }
    this._labels = [];

    for (const pin of pins) {
      if (pin.hidden) continue;
      this._renderPin(pin, poweredPins?.has(pin.id) ?? false);
    }
  }

  private _renderPin(pin: SymbolPin, powered: boolean): void {
    const g = this._graphics;
    const { x, y } = pin.position;
    const markerLength = pin.length > 0 ? Math.min(pin.length, 12) : 12;

    // Powered glow (preview) — drawn first so it sits behind the dot.
    if (powered) {
      g.circle(x, y, PIN_RADIUS + 4);
      g.fill({ color: 0x22c55e, alpha: 0.35 });
    }
    const { ux, uy } = orientationVector(pin.orientation);
    const dx = ux * markerLength;
    const dy = uy * markerLength;

    // Color reflects the electrical type (KiCad-style), with an explicit
    // per-pin `color` override (CSS string) taking precedence. Pixi accepts
    // both a numeric hex and a CSS color string for fills/strokes.
    const pinColor: number | string = pin.color ?? colorForPinType(pin.type);

    // Pin dot
    g.circle(x, y, PIN_RADIUS);
    g.fill(pinColor);

    // Direction line. For an inverted pin we stop short so the bubble sits at
    // the tip; for clock we draw a small inward triangle.
    const shape = pin.shape ?? 'line';
    const lineEndX = shape === 'inverted' ? x + dx - ux * PIN_BUBBLE_RADIUS * 2 : x + dx;
    const lineEndY = shape === 'inverted' ? y + dy - uy * PIN_BUBBLE_RADIUS * 2 : y + dy;
    g.moveTo(x, y);
    g.lineTo(lineEndX, lineEndY);
    g.stroke({ color: pinColor, width: PIN_LINE_WIDTH, pixelLine: true });

    if (shape === 'inverted') {
      // Active-low bubble at the tip.
      g.circle(x + dx - ux * PIN_BUBBLE_RADIUS, y + dy - uy * PIN_BUBBLE_RADIUS, PIN_BUBBLE_RADIUS);
      g.stroke({ color: pinColor, width: PIN_LINE_WIDTH, pixelLine: true });
    } else if (shape === 'clock') {
      // Clock triangle at the connection point, pointing outward.
      const px = -uy; // perpendicular
      const py = ux;
      const base = 4;
      const tip = 5;
      g.moveTo(x + px * base, y + py * base);
      g.lineTo(x + ux * tip, y + uy * tip);
      g.lineTo(x - px * base, y - py * base);
      g.stroke({ color: pinColor, width: PIN_LINE_WIDTH, pixelLine: true });
    }

    // AC 8: Lock indicator for locked pins
    if (pin.locked) {
      g.rect(x - 2.5, y - 2.5, 5, 5);
      g.stroke({ color: 0xf59e0b, width: 1, pixelLine: true });
    }

    const off = pin.labelOffset ?? { x: 0, y: 0 };

    // Pin number label — at the tip (outward), respects numberVisible.
    if (pin.number && pin.numberVisible !== false) {
      const style: TextStyleOptions = {
        fontSize: PIN_LABEL_SIZE,
        fontFamily: 'monospace',
        fill: PIN_LABEL_COLOR,
      };
      const label = new PixiText({ text: pin.number, style });

      const labelOffset = 3;
      if (pin.orientation === 'right') {
        label.x = x + dx + labelOffset + off.x;
        label.y = y + off.y;
        label.anchor.set(0, 0.5);
      } else if (pin.orientation === 'left') {
        label.x = x + dx - labelOffset + off.x;
        label.y = y + off.y;
        label.anchor.set(1, 0.5);
      } else if (pin.orientation === 'up') {
        label.x = x + off.x;
        label.y = y + dy - labelOffset + off.y;
        label.anchor.set(0.5, 1);
      } else {
        label.x = x + off.x;
        label.y = y + dy + labelOffset + off.y;
        label.anchor.set(0.5, 0);
      }

      this._layer.addChild(label);
      this._labels.push(label);
    }

    // Pin name label — on the body side (opposite orientation), respects nameVisible.
    if (pin.name && pin.nameVisible !== false) {
      const style: TextStyleOptions = {
        fontSize: PIN_LABEL_SIZE,
        fontFamily: 'sans-serif',
        fill: PIN_NAME_COLOR,
      };
      const nameLabel = new PixiText({ text: pin.name, style });
      const nameGap = 4;
      // Place just inside the body relative to the connection point.
      nameLabel.x = x - ux * nameGap + off.x;
      nameLabel.y = y - uy * nameGap + off.y;
      if (pin.orientation === 'right') nameLabel.anchor.set(1, 0.5);
      else if (pin.orientation === 'left') nameLabel.anchor.set(0, 0.5);
      else if (pin.orientation === 'up') nameLabel.anchor.set(0.5, 0);
      else nameLabel.anchor.set(0.5, 1);

      this._layer.addChild(nameLabel);
      this._labels.push(nameLabel);
    }

    // AC 11: Group label
    if (pin.group) {
      const groupStyle: TextStyleOptions = {
        fontSize: PIN_LABEL_SIZE * 0.75,
        fontFamily: 'sans-serif',
        fontStyle: 'italic',
        fill: 0x94a3b8,
      };
      const groupLabel = new PixiText({ text: `[${pin.group}]`, style: groupStyle });
      groupLabel.x = x;
      groupLabel.y = y - PIN_RADIUS - 6;
      groupLabel.anchor.set(0.5, 1);
      this._layer.addChild(groupLabel);
      this._labels.push(groupLabel);
    }
  }

  /** Clean up all resources */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const label of this._labels) {
      label.destroy();
    }
    this._labels = [];
    this._graphics.destroy();
  }
}
