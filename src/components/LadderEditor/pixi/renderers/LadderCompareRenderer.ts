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

    const gfx = new Graphics();
    gfx.label = 'symbol';
    this.drawBox(gfx, cellWidth, cellHeight);
    container.addChild(gfx);

    // Connection lines
    const lines = new Graphics();
    lines.label = 'lines';
    const midY = cellHeight / 2;
    const boxX = 10;
    const boxW = cellWidth - 20;
    lines.moveTo(0, midY).lineTo(boxX, midY).stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });
    lines.moveTo(boxX + boxW, midY).lineTo(cellWidth, midY).stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });
    container.addChildAt(lines, 0);

    // Operator symbol
    const opText = new Text({
      text: compareOperatorDisplay(element.type),
      style: { fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', fill: TEXT_COLOR },
    });
    opText.label = 'operator';
    opText.anchor.set(0.5, 0);
    opText.position.set(cellWidth / 2, 5);
    container.addChild(opText);

    // Address
    const addrText = new Text({
      text: element.address ?? '',
      style: { fontFamily: 'monospace', fontSize: 10, fill: TEXT_COLOR },
    });
    addrText.label = 'address';
    addrText.anchor.set(0.5, 0.5);
    addrText.position.set(cellWidth / 2, cellHeight / 2);
    container.addChild(addrText);

    // Compare value
    const cv = element.properties?.compareValue ?? '';
    const compareText = new Text({
      text: `vs ${cv}`,
      style: { fontFamily: 'monospace', fontSize: 8, fill: TEXT_COLOR },
    });
    compareText.label = 'compareValue';
    compareText.anchor.set(0.5, 1);
    compareText.position.set(cellWidth / 2, cellHeight - 4);
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
      compareText.text = `vs ${cv}`;
    }
  }

  destroy(): void {}

  private drawBox(gfx: Graphics, cellWidth: number, cellHeight: number): void {
    const boxX = 10;
    const boxY = 3;
    const boxW = cellWidth - 20;
    const boxH = cellHeight - 6;
    gfx.roundRect(boxX, boxY, boxW, boxH, CORNER_RADIUS)
      .stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });
  }
}
