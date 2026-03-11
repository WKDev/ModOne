/**
 * LadderWireRenderer
 *
 * Convention: all wires route through the horizontal midline (midY) of each cell.
 *
 *  - wire_h  : (0, midY) → (w, midY)          — full horizontal
 *  - wire_v  : (0, midY) → (0, h+midY)        — LEFT edge, from this row's midY
 *                                                 to the NEXT row's midY (spans the row boundary)
 *  - Corners / junctions use the same ref points:
 *      TOP direction    → draw (0, 0) → (0, midY)       upper half, left edge
 *      BOTTOM direction → draw (0, midY) → (0, h+midY)  lower half, left edge (extends into next row)
 *      LEFT/RIGHT dir.  → draw (0, midY) → (w, midY)    horizontal
 */

import { Container, Graphics } from 'pixi.js';
import type { WireElement } from '../../../../types/ladder';
import { WireDirection } from '../../../../types/ladder';


const WIRE_COLOR = 0x6b7280;  // neutral-500
const WIRE_WIDTH = 2;

export class LadderWireRenderer {
  create(element: WireElement, cellWidth: number, cellHeight: number): Container {
    const container = new Container();
    container.label = element.id;
    container.eventMode = 'none';
    container.position.set(
      element.position.col * cellWidth,
      element.position.row * cellHeight,
    );
    const gfx = new Graphics();
    gfx.label = 'wire';
    this.drawWire(gfx, element, cellWidth, cellHeight);
    container.addChild(gfx);
    return container;
  }

  update(container: Container, element: WireElement, cellWidth = 80, cellHeight = 60): void {
    const gfx = container.getChildByLabel('wire') as Graphics | null;
    if (gfx) {
      gfx.clear();
      this.drawWire(gfx, element, cellWidth, cellHeight);
    }
  }

  destroy(): void { }

  // ---------------------------------------------------------------------------

  private drawWire(gfx: Graphics, element: WireElement, w: number, h: number): void {
    const midX = w / 2;
    const midY = h * 0.65; // Shifted down for label space

    // Stroke styles: 'butt' for horizontal to join seamlessly, 'round' for vertical/internal
    const strokeH = { width: WIRE_WIDTH, color: WIRE_COLOR, cap: 'butt' } as const;
    const strokeV = { width: WIRE_WIDTH, color: WIRE_COLOR, cap: 'round' } as const;

    const props = element.properties;
    const connected = props.connectedDirections;

    // Shared drawing helpers
    const drawH = () => gfx.moveTo(0, midY).lineTo(w, midY).stroke(strokeH);
    const drawVUp = () => gfx.moveTo(midX, 0).lineTo(midX, midY).stroke(strokeV);
    const drawVDown = () => gfx.moveTo(midX, midY).lineTo(midX, h).stroke(strokeV);
    const drawVFull = () => gfx.moveTo(midX, 0).lineTo(midX, h).stroke(strokeV);

    // A. Use precise connectedDirections if available
    if (connected !== undefined) {
      if (connected & WireDirection.TOP) drawVUp();
      if (connected & WireDirection.BOTTOM) drawVDown();
      if (connected & (WireDirection.LEFT | WireDirection.RIGHT) || element.type === 'wire_h') {
        drawH();
      }
      return;
    }

    // B. Fallback to type-based logic
    switch (element.type) {
      case 'wire_h':
        drawH();
        break;

      case 'wire_v':
        drawVFull();
        break;

      case 'wire_corner': {
        const dir = props.direction;
        switch (dir) {
          case 'corner_tl':
            drawVDown();
            gfx.moveTo(midX, midY).lineTo(w, midY).stroke(strokeH);
            break;
          case 'corner_tr':
            gfx.moveTo(0, midY).lineTo(midX, midY).stroke(strokeH);
            drawVDown();
            break;
          case 'corner_bl':
            drawVUp();
            gfx.moveTo(midX, midY).lineTo(w, midY).stroke(strokeH);
            break;
          case 'corner_br':
            gfx.moveTo(0, midY).lineTo(midX, midY).stroke(strokeH);
            drawVUp();
            break;
          default:
            drawVFull();
            break;
        }
        break;
      }

      case 'wire_junction': {
        const dir = props.direction;
        switch (dir) {
          case 'junction_t':
            drawVFull();
            gfx.moveTo(midX, midY).lineTo(w, midY).stroke(strokeH);
            break;
          case 'junction_b':
            drawVFull();
            gfx.moveTo(0, midY).lineTo(midX, midY).stroke(strokeH);
            break;
          case 'junction_l':
            drawH();
            drawVDown();
            break;
          case 'junction_r':
            drawH();
            drawVUp();
            break;
          case 'cross':
            drawH();
            drawVFull();
            break;
          default:
            drawVFull();
            drawH();
            break;
        }
        break;
      }

      default:
        drawH();
        break;
    }
  }
}


