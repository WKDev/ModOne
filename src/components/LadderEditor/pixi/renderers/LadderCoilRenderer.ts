/**
 * LadderCoilRenderer
 *
 * Renders coil elements using Pixi.js Graphics.
 * 6 variants: output ──( )──, inverted ──(/)──, set ──(S)──,
 *             reset ──(R)──, positive ──(P)──, negative ──(N)──
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { CoilElement, CoilType } from '../../../../types/ladder';

const STROKE_COLOR = 0xa3a3a3;
const TEXT_COLOR = 0xa3a3a3;
const STROKE_WIDTH = 2;
const LABEL_FONT_SIZE = 10;
const SYMBOL_FONT_SIZE = 12;
const RADIUS = 9;

/** Map coil type to its inner symbol character (null = no character) */
function coilSymbolChar(type: CoilType): string | null {
  switch (type) {
    case 'coil': return null;
    case 'coil_inverted': return null; // drawn as slash
    case 'coil_set': return 'S';
    case 'coil_reset': return 'R';
    case 'coil_p': return 'P';
    case 'coil_n': return 'N';
    default: return null;
  }
}

export class LadderCoilRenderer {
  create(element: CoilElement, cellWidth: number, cellHeight: number): Container {
    const container = new Container();
    container.label = element.id;
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.position.set(
      element.position.col * cellWidth,
      element.position.row * cellHeight,
    );

    const gfx = new Graphics();
    gfx.label = 'symbol';
    this.drawCoil(gfx, element.type, cellWidth, cellHeight);
    container.addChild(gfx);

    // Inner symbol text (S, R, P, N)
    const ch = coilSymbolChar(element.type);
    if (ch) {
      const symText = new Text({
        text: ch,
        style: {
          fontFamily: 'sans-serif',
          fontSize: SYMBOL_FONT_SIZE,
          fontWeight: 'bold',
          fill: TEXT_COLOR,
        },
      });
      symText.label = 'symbolChar';
      symText.anchor.set(0.5, 0.5);
      symText.position.set(cellWidth / 2, cellHeight / 2);
      container.addChild(symText);
    }

    // Address label
    const addressText = new Text({
      text: element.address ?? '',
      style: {
        fontFamily: 'monospace',
        fontSize: LABEL_FONT_SIZE,
        fill: TEXT_COLOR,
      },
    });
    addressText.label = 'address';
    addressText.anchor.set(0.5, 1);
    addressText.position.set(cellWidth / 2, cellHeight - 2);
    container.addChild(addressText);

    return container;
  }

  update(container: Container, element: CoilElement): void {
    const gfx = container.getChildByLabel('symbol') as Graphics | null;
    if (gfx) {
      gfx.clear();
      this.drawCoil(gfx, element.type, 80, 60);
    }

    const addressText = container.getChildByLabel('address') as Text | null;
    if (addressText) {
      addressText.text = element.address ?? '';
    }
  }

  destroy(): void {
    // Stateless
  }

  // ---------------------------------------------------------------------------

  private drawCoil(
    gfx: Graphics,
    type: CoilType,
    cellWidth: number,
    cellHeight: number,
  ): void {
    const cx = cellWidth / 2;
    const cy = cellHeight / 2;

    // Left connection line
    gfx.moveTo(0, cy).lineTo(cx - RADIUS, cy).stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });

    // Right connection line
    gfx.moveTo(cx + RADIUS, cy).lineTo(cellWidth, cy).stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });

    // Circle
    gfx.circle(cx, cy, RADIUS).stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });

    // Inverted coil — diagonal slash inside circle
    if (type === 'coil_inverted') {
      const off = RADIUS * 0.6;
      gfx
        .moveTo(cx - off, cy + off)
        .lineTo(cx + off, cy - off)
        .stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });
    }
  }
}
