/**
 * PinRenderer — SymbolPin[] → Pixi.js Graphics
 *
 * Renders symbol pins as circles with orientation lines.
 * Matches the SVG rendering from EditorCanvas.tsx:
 * - Circle at pin position (r=4, fill=#ff8844)
 * - Direction line from position toward orientation
 */

import { Graphics, Text as PixiText, type Container, type TextStyleOptions } from 'pixi.js';
import type { SymbolPin } from '@/types/symbol';

export interface PinRendererOptions {
  /** The layer container to add pins to */
  layer: Container;
}

const PIN_COLOR = 0xff8844;
const PIN_RADIUS = 4;
const PIN_LINE_WIDTH = 1.5;
const PIN_LABEL_SIZE = 9;
const PIN_LABEL_COLOR = 0xbbbbbb;

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
   */
  renderAll(pins: SymbolPin[]): void {
    if (this._destroyed) return;

    this._graphics.clear();
    for (const label of this._labels) {
      label.destroy();
    }
    this._labels = [];

    for (const pin of pins) {
      if (pin.hidden) continue;
      this._renderPin(pin);
    }
  }

  private _renderPin(pin: SymbolPin): void {
    const g = this._graphics;
    const { x, y } = pin.position;
    const markerLength = pin.length > 0 ? Math.min(pin.length, 12) : 12;

    let dx = 0;
    let dy = 0;
    if (pin.orientation === 'right') dx = markerLength;
    if (pin.orientation === 'left') dx = -markerLength;
    if (pin.orientation === 'up') dy = -markerLength;
    if (pin.orientation === 'down') dy = markerLength;

    // Pin dot
    g.circle(x, y, PIN_RADIUS);
    g.fill(PIN_COLOR);

    // Direction line
    g.moveTo(x, y);
    g.lineTo(x + dx, y + dy);
    g.stroke({ color: PIN_COLOR, width: PIN_LINE_WIDTH, pixelLine: true });

    // Pin number label
    if (pin.number) {
      const style: TextStyleOptions = {
        fontSize: PIN_LABEL_SIZE,
        fontFamily: 'monospace',
        fill: PIN_LABEL_COLOR,
      };
      const label = new PixiText({ text: pin.number, style });

      // Position label slightly offset from the pin end
      const labelOffset = 3;
      if (pin.orientation === 'right') {
        label.x = x + dx + labelOffset;
        label.y = y;
        label.anchor.set(0, 0.5);
      } else if (pin.orientation === 'left') {
        label.x = x + dx - labelOffset;
        label.y = y;
        label.anchor.set(1, 0.5);
      } else if (pin.orientation === 'up') {
        label.x = x;
        label.y = y + dy - labelOffset;
        label.anchor.set(0.5, 1);
      } else {
        label.x = x;
        label.y = y + dy + labelOffset;
        label.anchor.set(0.5, 0);
      }

      this._layer.addChild(label);
      this._labels.push(label);
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
