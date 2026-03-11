/**
 * LadderCounterRenderer
 *
 * Renders counter block elements (CTU, CTD, CTUD) using Pixi.js Graphics.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { CounterElement } from '../../../../types/ladder';

const STROKE_COLOR = 0xa3a3a3;
const TEXT_COLOR = 0xa3a3a3;
const STROKE_WIDTH = 2;
const CORNER_RADIUS = 3;

function counterDisplayName(type: CounterElement['type']): string {
  switch (type) {
    case 'counter_ctu': return 'CTU';
    case 'counter_ctd': return 'CTD';
    case 'counter_ctud': return 'CTUD';
    default: return 'CTU';
  }
}

export class LadderCounterRenderer {
  create(element: CounterElement, cellWidth: number, cellHeight: number): Container {
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
    const boxX = 8;
    const boxW = cellWidth - 16;
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
    // Type label (Header)
    const typeText = new Text({
      text: counterDisplayName(element.type),
      style: { fontFamily: 'sans-serif', fontSize: 9, fontWeight: 'bold', fill: TEXT_COLOR },
    });
    typeText.label = 'typeLabel';
    typeText.anchor.set(0.5, 0);
    typeText.position.set(midX, 18);
    container.addChild(typeText);

    // Address (Center-ish)
    const addrText = new Text({
      text: element.address ?? '',
      style: { fontFamily: 'monospace', fontSize: 10, fill: TEXT_COLOR },
    });
    addrText.label = 'address';
    addrText.anchor.set(0.5, 0.5);
    addrText.position.set(midX, midY - 2);
    container.addChild(addrText);

    // Preset (Bottom)
    const pv = element.properties?.presetValue ?? 0;
    const presetText = new Text({
      text: `PV: ${pv}`,
      style: { fontFamily: 'monospace', fontSize: 8, fill: TEXT_COLOR },
    });
    presetText.label = 'preset';
    presetText.anchor.set(0.5, 1);
    presetText.position.set(midX, cellHeight - 12);
    container.addChild(presetText);

    return container;
  }

  update(container: Container, element: CounterElement): void {
    const typeText = container.getChildByLabel('typeLabel') as Text | null;
    if (typeText) typeText.text = counterDisplayName(element.type);

    const addrText = container.getChildByLabel('address') as Text | null;
    if (addrText) addrText.text = element.address ?? '';

    const presetText = container.getChildByLabel('preset') as Text | null;
    if (presetText) {
      const pv = element.properties?.presetValue ?? 0;
      presetText.text = `PV: ${pv}`;
    }
  }

  destroy(): void { }

  private drawBox(gfx: Graphics, cellWidth: number, cellHeight: number): void {
    const boxX = 8;
    const boxY = 16;
    const boxW = cellWidth - 16;
    const boxH = cellHeight - 24;
    const headerH = 12;

    // Body
    gfx.roundRect(boxX, boxY, boxW, boxH, CORNER_RADIUS)
      .fill({ color: 0x1e293b, alpha: 0.5 })
      .stroke({ width: STROKE_WIDTH, color: STROKE_COLOR, alpha: 0.8 });

    // Header divider
    gfx.moveTo(boxX, boxY + headerH).lineTo(boxX + boxW, boxY + headerH).stroke({ width: 1, color: STROKE_COLOR, alpha: 0.4 });
  }
}
