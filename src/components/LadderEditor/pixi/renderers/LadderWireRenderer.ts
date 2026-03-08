/**
 * LadderWireRenderer
 *
 * Renders wire connections between ladder elements using Pixi.js Graphics.
 * Supports: horizontal, vertical, corner (4 variants), junction (4 variants), cross.
 * Tracks wire origin (manual vs auto) per XG5000 FF 01 / FF 02 distinction.
 */

import { Container, Graphics } from 'pixi.js';
import type { WireElement, WireType } from '../../../../types/ladder';

const WIRE_COLOR = 0x6b7280;       // neutral-500
const WIRE_WIDTH = 2;

export class LadderWireRenderer {
  create(element: WireElement, cellWidth: number, cellHeight: number): Container {
    const container = new Container();
    container.label = element.id;
    // Wires are NOT interactive (click-through to the cell behind)
    container.eventMode = 'none';
    container.position.set(
      element.position.col * cellWidth,
      element.position.row * cellHeight,
    );

    const gfx = new Graphics();
    gfx.label = 'wire';
    this.drawWire(gfx, element.type, cellWidth, cellHeight);
    container.addChild(gfx);

    return container;
  }

  update(container: Container, element: WireElement): void {
    const gfx = container.getChildByLabel('wire') as Graphics | null;
    if (gfx) {
      gfx.clear();
      this.drawWire(gfx, element.type, 80, 60);
    }
  }

  destroy(): void {}

  // ---------------------------------------------------------------------------

  private drawWire(
    gfx: Graphics,
    type: WireType,
    w: number,
    h: number,
  ): void {
    const midY = h / 2;
    const leftX = 1; // vertical wires on left side of cell for stroke visibility

    const stroke = { width: WIRE_WIDTH, color: WIRE_COLOR };

    switch (type) {
      case 'wire_h':
        // Horizontal: ────────
        gfx.moveTo(0, midY).lineTo(w, midY).stroke(stroke);
        break;

      case 'wire_v':
        // Vertical: │ (left-aligned)
        gfx.moveTo(leftX, 0).lineTo(leftX, h).stroke(stroke);
        break;

      case 'wire_corner':
        // Corner variants are determined by WireProperties.direction
        // Default: top-left ┌── (vertical bottom→center, then horizontal right)
        this.drawCorner(gfx, 'corner_tl', w, h, leftX, midY, stroke);
        break;

      case 'wire_junction':
        // Junction: default T-shape
        this.drawJunction(gfx, 'junction_t', w, h, leftX, midY, stroke);
        break;

      default:
        // Fallback — horizontal line
        gfx.moveTo(0, midY).lineTo(w, midY).stroke(stroke);
        break;
    }
  }

  /**
   * Draw a corner wire variant.
   */
  private drawCorner(
    gfx: Graphics,
    variant: string,
    w: number,
    h: number,
    leftX: number,
    midY: number,
    stroke: { width: number; color: number },
  ): void {
    switch (variant) {
      case 'corner_tl': // ┌──
        gfx.moveTo(leftX, h).lineTo(leftX, midY).lineTo(w, midY).stroke(stroke);
        break;
      case 'corner_tr': // ──┐
        gfx.moveTo(0, midY).lineTo(w - 1, midY).lineTo(w - 1, h).stroke(stroke);
        break;
      case 'corner_bl': // └──
        gfx.moveTo(leftX, 0).lineTo(leftX, midY).lineTo(w, midY).stroke(stroke);
        break;
      case 'corner_br': // ──┘
        gfx.moveTo(0, midY).lineTo(w - 1, midY).lineTo(w - 1, 0).stroke(stroke);
        break;
    }
  }

  /**
   * Draw a junction wire variant (T-shape).
   */
  private drawJunction(
    gfx: Graphics,
    variant: string,
    w: number,
    h: number,
    leftX: number,
    midY: number,
    stroke: { width: number; color: number },
  ): void {
    switch (variant) {
      case 'junction_t': // ├── (vertical full + horizontal right)
        gfx.moveTo(leftX, 0).lineTo(leftX, h).stroke(stroke);
        gfx.moveTo(leftX, midY).lineTo(w, midY).stroke(stroke);
        break;
      case 'junction_b': // ──┤ (vertical full + horizontal left)
        gfx.moveTo(w - 1, 0).lineTo(w - 1, h).stroke(stroke);
        gfx.moveTo(0, midY).lineTo(w - 1, midY).stroke(stroke);
        break;
      case 'junction_l': // ┬ (horizontal full + vertical down)
        gfx.moveTo(0, midY).lineTo(w, midY).stroke(stroke);
        gfx.moveTo(leftX, midY).lineTo(leftX, h).stroke(stroke);
        break;
      case 'junction_r': // ┴ (horizontal full + vertical up)
        gfx.moveTo(0, midY).lineTo(w, midY).stroke(stroke);
        gfx.moveTo(leftX, 0).lineTo(leftX, midY).stroke(stroke);
        break;
    }
  }
}
