/**
 * LadderWireRenderer
 *
 * Renders wire connections between ladder elements using Pixi.js Graphics.
 *
 * Layout convention (like XG5000 / GX Works 3):
 *   - Horizontal wires run through the vertical center: y = midY
 *   - Vertical wires are at the LEFT boundary of the cell: x = 0
 *   - Junction/corner knees meet at (0, midY) — the left-midpoint
 *
 *   wire_h    ────────  (0, midY) → (w, midY)
 *   wire_v    │         (0, 0) → (0, h)  — left edge
 *   corner_tl ┌──       from (0, h) up to (0, midY) then right to (w, midY)
 *   corner_tr ──┐       from (0, midY) right to (w, midY) then down to (w, h)
 *   corner_bl └──       from (0, 0) down to (0, midY) then right to (w, midY)
 *   corner_br ──┘       from (0, midY) right to (w, midY) then up to (w, 0)
 *   junction_t ├──      full wire_v at x=0 + right half of wire_h
 *   junction_b ──┤      full wire_v at x=w + left half of wire_h
 *   junction_l ┬        full wire_h + lower half of wire_v at x=0
 *   junction_r ┴        full wire_h + upper half of wire_v at x=0
 *   cross      ╋        full wire_h + full wire_v at x=0
 */

import { Container, Graphics } from 'pixi.js';
import type { WireElement } from '../../../../types/ladder';
import type { WireProperties } from '../../../../types/ladder';

const WIRE_COLOR = 0x6b7280;   // neutral-500
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

  private drawWire(
    gfx: Graphics,
    element: WireElement,
    w: number,
    h: number,
  ): void {
    const midY = h / 2;
    const stroke = { width: WIRE_WIDTH, color: WIRE_COLOR };
    const props = element.properties as WireProperties | undefined;
    const dir = props?.direction;

    switch (element.type) {
      // ── Straight ──────────────────────────────────────────────────────────

      case 'wire_h':
        // ─────────────  horizontal center line, full cell width
        gfx.moveTo(0, midY).lineTo(w, midY).stroke(stroke);
        break;

      case 'wire_v':
        // │  vertical at left boundary, full cell height
        gfx.moveTo(0, 0).lineTo(0, h).stroke(stroke);
        break;

      // ── Corners ───────────────────────────────────────────────────────────

      case 'wire_corner': {
        switch (dir) {
          case 'corner_tl': // ┌──  from bottom-left → midY, then right
            gfx.moveTo(0, h).lineTo(0, midY).lineTo(w, midY).stroke(stroke);
            break;
          case 'corner_tr': // ──┐  from left → midY at right edge, then down
            gfx.moveTo(0, midY).lineTo(w, midY).lineTo(w, h).stroke(stroke);
            break;
          case 'corner_bl': // └──  from top-left → midY, then right
            gfx.moveTo(0, 0).lineTo(0, midY).lineTo(w, midY).stroke(stroke);
            break;
          case 'corner_br': // ──┘  from left → midY at right edge, then up
            gfx.moveTo(0, midY).lineTo(w, midY).lineTo(w, 0).stroke(stroke);
            break;
          default:          // fallback: corner_tl
            gfx.moveTo(0, h).lineTo(0, midY).lineTo(w, midY).stroke(stroke);
            break;
        }
        break;
      }

      // ── Junctions ─────────────────────────────────────────────────────────

      case 'wire_junction': {
        switch (dir) {
          case 'junction_t': // ├──  full vertical at left + right half of horizontal
            gfx.moveTo(0, 0).lineTo(0, h).stroke(stroke);
            gfx.moveTo(0, midY).lineTo(w, midY).stroke(stroke);
            break;
          case 'junction_b': // ──┤  full vertical at right edge + left half of horizontal
            gfx.moveTo(w, 0).lineTo(w, h).stroke(stroke);
            gfx.moveTo(0, midY).lineTo(w, midY).stroke(stroke);
            break;
          case 'junction_l': // ┬   full horizontal + lower half of left vertical
            gfx.moveTo(0, midY).lineTo(w, midY).stroke(stroke);
            gfx.moveTo(0, midY).lineTo(0, h).stroke(stroke);
            break;
          case 'junction_r': // ┴   full horizontal + upper half of left vertical
            gfx.moveTo(0, midY).lineTo(w, midY).stroke(stroke);
            gfx.moveTo(0, 0).lineTo(0, midY).stroke(stroke);
            break;
          case 'cross':      // ╋   full horizontal + full left vertical
            gfx.moveTo(0, midY).lineTo(w, midY).stroke(stroke);
            gfx.moveTo(0, 0).lineTo(0, h).stroke(stroke);
            break;
          default:           // fallback: junction_t
            gfx.moveTo(0, 0).lineTo(0, h).stroke(stroke);
            gfx.moveTo(0, midY).lineTo(w, midY).stroke(stroke);
            break;
        }
        break;
      }

      default:
        gfx.moveTo(0, midY).lineTo(w, midY).stroke(stroke);
        break;
    }
  }
}
