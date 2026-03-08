/**
 * LadderTimerRenderer
 *
 * Renders timer block elements (TON, TOF, TMR) using Pixi.js Graphics.
 * Visual: rectangular box with type name, address, and preset value.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { TimerElement } from '../../../../types/ladder';

const STROKE_COLOR = 0xa3a3a3;
const TEXT_COLOR = 0xa3a3a3;
const STROKE_WIDTH = 2;
const CORNER_RADIUS = 3;

/** Map timer type to display name */
function timerDisplayName(type: TimerElement['type']): string {
  switch (type) {
    case 'timer_ton': return 'TON';
    case 'timer_tof': return 'TOF';
    case 'timer_tmr': return 'TMR';
    default: return 'TMR';
  }
}

export class LadderTimerRenderer {
  create(element: TimerElement, cellWidth: number, cellHeight: number): Container {
    const container = new Container();
    container.label = element.id;
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.position.set(
      element.position.col * cellWidth,
      element.position.row * cellHeight,
    );

    // Box graphics
    const gfx = new Graphics();
    gfx.label = 'symbol';
    this.drawBox(gfx, cellWidth, cellHeight);
    container.addChild(gfx);

    // Connection lines (separate so they sit behind box visually)
    const lines = new Graphics();
    lines.label = 'lines';
    const midY = cellHeight / 2;
    const boxX = 10;
    const boxW = cellWidth - 20;
    lines.moveTo(0, midY).lineTo(boxX, midY).stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });
    lines.moveTo(boxX + boxW, midY).lineTo(cellWidth, midY).stroke({ width: STROKE_WIDTH, color: STROKE_COLOR });
    container.addChildAt(lines, 0);

    // Type label (e.g., "TON")
    const typeText = new Text({
      text: timerDisplayName(element.type),
      style: { fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', fill: TEXT_COLOR },
    });
    typeText.label = 'typeLabel';
    typeText.anchor.set(0.5, 0);
    typeText.position.set(cellWidth / 2, 6);
    container.addChild(typeText);

    // Address
    const addrText = new Text({
      text: element.address ?? '',
      style: { fontFamily: 'monospace', fontSize: 10, fill: TEXT_COLOR },
    });
    addrText.label = 'address';
    addrText.anchor.set(0.5, 0.5);
    addrText.position.set(cellWidth / 2, cellHeight / 2);
    container.addChild(addrText);

    // Preset
    const presetVal = element.properties?.presetTime ?? 0;
    const tb = element.properties?.timeBase ?? 'ms';
    const presetText = new Text({
      text: `PT:${presetVal}${tb}`,
      style: { fontFamily: 'monospace', fontSize: 8, fill: TEXT_COLOR },
    });
    presetText.label = 'preset';
    presetText.anchor.set(0.5, 1);
    presetText.position.set(cellWidth / 2, cellHeight - 4);
    container.addChild(presetText);

    return container;
  }

  update(container: Container, element: TimerElement): void {
    const typeText = container.getChildByLabel('typeLabel') as Text | null;
    if (typeText) typeText.text = timerDisplayName(element.type);

    const addrText = container.getChildByLabel('address') as Text | null;
    if (addrText) addrText.text = element.address ?? '';

    const presetText = container.getChildByLabel('preset') as Text | null;
    if (presetText) {
      const presetVal = element.properties?.presetTime ?? 0;
      const tb = element.properties?.timeBase ?? 'ms';
      presetText.text = `PT:${presetVal}${tb}`;
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
