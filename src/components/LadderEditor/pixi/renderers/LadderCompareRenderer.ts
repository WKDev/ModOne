/**
 * LadderCompareRenderer
 *
 * Renders comparison block elements (EQ, GT, LT, GE, LE, NE) using Pixi.js Graphics.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { CompareElement } from '../../../../types/ladder';

const STROKE_COLOR = 0xa3a3a3;
const TEXT_COLOR = 0xa3a3a3;
const STROKE_WIDTH = 2;
const CORNER_RADIUS = 3;

/** Map compare type to operator display string */
function compareOperatorDisplay(type: CompareElement['type']): string {
  switch (type) {
    case 'compare_eq': return '=';
    case 'compare_gt': return '>';
    case 'compare_lt': return '<';
    case 'compare_ge': return '≥';
    case 'compare_le': return '≤';
    case 'compare_ne': return '≠';
    default: return '=';
  }
}

export class LadderCompareRenderer {
  create(element: CompareElement, cellWidth: number, cellHeight: number): Container {
    const container = new Container();
    container.label = element.id;
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.position.set(
      element.position.col * cellWidth,
      element.position.row * cellHeight,
    );

    const midX = cellWidth / 2;
    const midY = cellHeight * 0.65; // New wire level

    // 1. Connection lines
    const lines = new Graphics();
    lines.label = 'lines';
    const boxX = 12;
    const boxW = cellWidth - 24;
    // Use 'butt' cap for seamless joining
    const stroke = { width: STROKE_WIDTH, color: STROKE_COLOR, cap: 'butt' } as const;
    lines.moveTo(0, midY).lineTo(boxX, midY).stroke(stroke);
    lines.moveTo(boxX + boxW, midY).lineTo(cellWidth, midY).stroke(stroke);
    container.addChild(lines);

    // 2. Block graphics
    const gfx = new Graphics();
    gfx.label = 'symbol';
    this.drawBox(gfx, cellWidth, cellHeight);
    container.addChild(gfx);

    // 3. Labels
    // Operator (Header)
    const opText = new Text({
      text: compareOperatorDisplay(element.type),
      style: { fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'bold', fill: TEXT_COLOR },
    });
    opText.label = 'operator';
    opText.anchor.set(0.5, 0);
    opText.position.set(midX, 20); // Down for boxY shift
    container.addChild(opText);

    // Address (Center-ish)
    const addrText = new Text({
      text: element.address ?? '',
      style: { fontFamily: 'monospace', fontSize: 10, fill: TEXT_COLOR },
    });
    addrText.label = 'address';
    addrText.anchor.set(0.5, 0.5);
    addrText.position.set(midX, midY - 2);
    container.addChild(addrText);

    // Compare Value (Bottom)
    const cv = element.properties?.compareValue ?? '';
    const compareText = new Text({
      text: `${cv}`,
      style: { fontFamily: 'monospace', fontSize: 8, fill: TEXT_COLOR },
    });
    compareText.label = 'compareValue';
    compareText.anchor.set(0.5, 1);
    compareText.position.set(midX, cellHeight - 14);
    container.addChild(compareText);

    return container;
  }

  update(container: Container, element: CompareElement): void {
    const opText = container.getChildByLabel('operator') as Text | null;
    if (opText) opText.text = compareOperatorDisplay(element.type);

    const addrText = container.getChildByLabel('address') as Text | null;
    if (addrText) addrText.text = element.address ?? '';

    const compareText = container.getChildByLabel('compareValue') as Text | null;
    if (compareText) {
      const cv = element.properties?.compareValue ?? '';
      compareText.text = `${cv}`;
    }
  }

  destroy(): void { }

  private drawBox(gfx: Graphics, cellWidth: number, cellHeight: number): void {
    const boxX = 12;
    const boxY = 18;
    const boxW = cellWidth - 24;
    const boxH = cellHeight - 28;
    const headerH = 12;

    // Body
    gfx.roundRect(boxX, boxY, boxW, boxH, CORNER_RADIUS)
      .fill({ color: 0x1e293b, alpha: 0.5 })
      .stroke({ width: STROKE_WIDTH, color: STROKE_COLOR, alpha: 0.8 });

    // Header divider
    gfx.moveTo(boxX, boxY + headerH).lineTo(boxX + boxW, boxY + headerH).stroke({ width: 1, color: STROKE_COLOR, alpha: 0.4 });
  }
}
