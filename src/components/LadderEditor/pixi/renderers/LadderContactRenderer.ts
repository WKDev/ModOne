/**
 * LadderContactRenderer
 *
 * Renders contact elements (NO, NC, P, N) using Pixi.js Graphics.
 * Visual: ──[ ]──  with type-specific symbols inside brackets.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { ContactElement, ContactType } from '../../../../types/ladder';

/** Default colors (dark theme, neutral-400) */
const STROKE_COLOR = 0xa3a3a3;
const TEXT_COLOR = 0xa3a3a3;
const STROKE_WIDTH = 2;
const LABEL_FONT_SIZE = 10;

export class LadderContactRenderer {
  create(element: ContactElement, cellWidth: number, cellHeight: number): Container {
    const container = new Container();
    container.label = element.id;
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.position.set(
      element.position.col * cellWidth,
      element.position.row * cellHeight,
    );

    const midX = cellWidth / 2;

    // 1. Symbol Graphics
    const gfx = new Graphics();
    gfx.label = 'symbol';
    this.drawContact(gfx, element.type, cellWidth, cellHeight);
    container.addChild(gfx);

    // 2. Dual Labels Above
    // Label (Variable Name) - Topmost (Y=3)
    const labelText = new Text({
      text: element.label ?? '',
      style: {
        fontFamily: 'sans-serif',
        fontSize: LABEL_FONT_SIZE,
        fontWeight: 'bold',
        fill: 0xe5e7eb, // gray-200
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

  update(container: Container, element: ContactElement): void {
    const gfx = container.getChildByLabel('symbol') as Graphics | null;
    if (gfx) {
      gfx.clear();
      this.drawContact(gfx, element.type, 80, 60);
    }

    const labelText = container.getChildByLabel('labelVariable') as Text | null;
    if (labelText) labelText.text = element.label ?? '';

    const addressText = container.getChildByLabel('address') as Text | null;
    if (addressText) addressText.text = element.address ?? '';
  }

  destroy(): void { }

  private drawContact(
    gfx: Graphics,
    type: ContactType,
    cellWidth: number,
    cellHeight: number,
  ): void {
    const midX = cellWidth / 2;
    const midY = cellHeight * 0.65; // The "Golden Line"
    const symbolW = 24;
    const symbolH = 20;
    const symbolX = midX - symbolW / 2;
    const symbolY = midY - symbolH / 2;

    // Use 'butt' cap for seamless joining with wires
    const stroke = { width: STROKE_WIDTH, color: STROKE_COLOR, cap: 'butt' } as const;
    const strokeIcon = { width: STROKE_WIDTH, color: STROKE_COLOR, cap: 'round', join: 'round' } as const;

    // 1. Connection Lines (terminating at brackets)
    gfx.moveTo(0, midY).lineTo(symbolX, midY).stroke(stroke);
    gfx.moveTo(symbolX + symbolW, midY).lineTo(cellWidth, midY).stroke(stroke);

    // 2. Modern Brackets
    const bracketSize = 5;
    // Left Bracket [
    gfx.moveTo(symbolX + bracketSize, symbolY).lineTo(symbolX, symbolY).lineTo(symbolX, symbolY + symbolH).lineTo(symbolX + bracketSize, symbolY + symbolH).stroke(strokeIcon);
    // Right Bracket ]
    gfx.moveTo(symbolX + symbolW - bracketSize, symbolY).lineTo(symbolX + symbolW, symbolY).lineTo(symbolX + symbolW, symbolY + symbolH).lineTo(symbolX + symbolW - bracketSize, symbolY + symbolH).stroke(strokeIcon);

    // 3. Type-specific icons
    const cx = midX;
    const cy = midY;

    switch (type) {
      case 'contact_nc':
        gfx.moveTo(cx - 5, cy + 6).lineTo(cx + 5, cy - 6).stroke(strokeIcon);
        break;
      case 'contact_p':
        gfx.moveTo(cx, cy + 5).lineTo(cx, cy - 5).stroke(strokeIcon);
        gfx.moveTo(cx - 3, cy - 2).lineTo(cx, cy - 5).lineTo(cx + 3, cy - 2).stroke(strokeIcon);
        break;
      case 'contact_n':
        gfx.moveTo(cx, cy - 5).lineTo(cx, cy + 5).stroke(strokeIcon);
        gfx.moveTo(cx - 3, cy + 2).lineTo(cx, cy + 5).lineTo(cx + 3, cy + 2).stroke(strokeIcon);
        break;
      default:
        break;
    }
  }
}
