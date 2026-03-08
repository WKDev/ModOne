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
  /**
   * Create a Pixi Container for a contact element.
   */
  create(element: ContactElement, cellWidth: number, cellHeight: number): Container {
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
    this.drawContact(gfx, element.type, cellWidth, cellHeight);
    container.addChild(gfx);

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

  /**
   * Update an existing contact container with new element data.
   */
  update(container: Container, element: ContactElement): void {
    const gfx = container.getChildByLabel('symbol') as Graphics | null;
    if (gfx) {
      gfx.clear();
      // Infer cell size from container parent or use defaults
      this.drawContact(gfx, element.type, 80, 60);
    }

    const addressText = container.getChildByLabel('address') as Text | null;
    if (addressText) {
      addressText.text = element.address ?? '';
    }
  }

  destroy(): void {
    // Stateless renderer — nothing to clean up
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  private drawContact(
    gfx: Graphics,
    type: ContactType,
    cellWidth: number,
    cellHeight: number,
  ): void {
    const midY = cellHeight / 2;
    const symbolW = 20;
    const symbolH = 20;
    const symbolX = (cellWidth - symbolW) / 2;
    const symbolY = midY - symbolH / 2 - 4; // offset up for label space

    // Left connection line
    gfx.moveTo(0, midY).lineTo(symbolX, midY).stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });

    // Right connection line
    gfx.moveTo(symbolX + symbolW, midY).lineTo(cellWidth, midY).stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });

    // Left bracket
    gfx.moveTo(symbolX, symbolY).lineTo(symbolX, symbolY + symbolH).stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });

    // Right bracket
    gfx.moveTo(symbolX + symbolW, symbolY).lineTo(symbolX + symbolW, symbolY + symbolH).stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });

    // Type-specific inner symbol
    const cx = symbolX + symbolW / 2;

    switch (type) {
      case 'contact_no':
        // NO — empty brackets, nothing extra
        break;

      case 'contact_nc':
        // NC — diagonal slash
        gfx
          .moveTo(symbolX + 3, symbolY + symbolH - 3)
          .lineTo(symbolX + symbolW - 3, symbolY + 3)
          .stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });
        break;

      case 'contact_p':
        // Positive edge — up arrow
        gfx
          .moveTo(cx, symbolY + symbolH - 4)
          .lineTo(cx, symbolY + 4)
          .stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });
        gfx
          .moveTo(cx - 4, symbolY + 8)
          .lineTo(cx, symbolY + 4)
          .lineTo(cx + 4, symbolY + 8)
          .stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });
        break;

      case 'contact_n':
        // Negative edge — down arrow
        gfx
          .moveTo(cx, symbolY + 4)
          .lineTo(cx, symbolY + symbolH - 4)
          .stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });
        gfx
          .moveTo(cx - 4, symbolY + symbolH - 8)
          .lineTo(cx, symbolY + symbolH - 4)
          .lineTo(cx + 4, symbolY + symbolH - 8)
          .stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });
        break;
    }
  }
}
