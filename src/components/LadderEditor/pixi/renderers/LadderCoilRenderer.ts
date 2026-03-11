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

    const midX = cellWidth / 2;
    const midY = cellHeight * 0.65; // The "Golden Line"

    // 1. Symbol Graphics
    const gfx = new Graphics();
    gfx.label = 'symbol';
    this.drawCoil(gfx, element.type, cellWidth, cellHeight);
    container.addChild(gfx);

    // 2. Inner symbol text (S, R, P, N)
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
      symText.position.set(midX, midY);
      container.addChild(symText);
    }

    // 3. Dual Labels Above
    // Label (Variable Name) - Topmost (Y=3)
    const labelText = new Text({
      text: element.label ?? '',
      style: {
        fontFamily: 'sans-serif',
        fontSize: LABEL_FONT_SIZE,
        fontWeight: 'bold',
        fill: 0xe5e7eb,
      },
    });
    labelText.label = 'labelVariable';
    labelText.anchor.set(0.5, 0);
    labelText.position.set(midX, 3);
    container.addChild(labelText);

    // Address (Register) - Below Variable Label (Y=14)
    const addressText = new Text({
      text: element.address ?? '',
      style: {
        fontFamily: 'monospace',
        fontSize: LABEL_FONT_SIZE - 1,
        fill: TEXT_COLOR,
      },
    });
    addressText.label = 'address';
    addressText.anchor.set(0.5, 0);
    addressText.position.set(midX, 14);
    container.addChild(addressText);

    return container;
  }

  update(container: Container, element: CoilElement): void {
    const gfx = container.getChildByLabel('symbol') as Graphics | null;
    if (gfx) {
      gfx.clear();
      this.drawCoil(gfx, element.type, 80, 60);
    }

    const labelText = container.getChildByLabel('labelVariable') as Text | null;
    if (labelText) labelText.text = element.label ?? '';

    const addressText = container.getChildByLabel('address') as Text | null;
    if (addressText) addressText.text = element.address ?? '';

    const symChar = container.getChildByLabel('symbolChar') as Text | null;
    if (symChar) {
      symChar.position.set(40, 60 * 0.65);
    }
  }

  destroy(): void { }

  private drawCoil(
    gfx: Graphics,
    type: CoilType,
    cellWidth: number,
    cellHeight: number,
  ): void {
    const midX = cellWidth / 2;
    const midY = cellHeight * 0.65; // The "Golden Line"
    const radius = 11;

    // Use 'butt' cap for horizontal lines touching cell edges
    const stroke = { width: STROKE_WIDTH, color: STROKE_COLOR, cap: 'butt' } as const;
    const strokeIcon = { width: STROKE_WIDTH, color: STROKE_COLOR, cap: 'round', join: 'round' } as const;

    // 1. Connection Lines (terminating at circle)
    gfx.moveTo(0, midY).lineTo(midX - radius, midY).stroke(stroke);
    gfx.moveTo(midX + radius, midY).lineTo(cellWidth, midY).stroke(stroke);

    // 2. Main Coil Shape (Circle)
    gfx.circle(midX, midY, radius).stroke(strokeIcon);

    // 3. Inverted Marker
    if (type === 'coil_inverted') {
      const off = radius * 0.6;
      gfx.moveTo(midX - off, midY + off).lineTo(midX + off, midY - off).stroke(strokeIcon);
    }
  }
}
