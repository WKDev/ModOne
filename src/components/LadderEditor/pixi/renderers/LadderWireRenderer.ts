import { Container, Graphics } from 'pixi.js';
import type { HorizontalEdgeEntity, VerticalEdgeEntity } from '../../../../types/ladder';
import { getHorizontalWireMidline, getVerticalWireMidline } from '../verticalWireInteraction';

const WIRE_COLOR = 0x6b7280;
const WIRE_WIDTH = 2;

export class LadderWireRenderer {
  createHorizontal(edge: HorizontalEdgeEntity, cellWidth: number, cellHeight: number): Container {
    const container = new Container();
    container.label = edge.id;
    container.eventMode = 'none';
    container.position.set(0, 0);
    const gfx = new Graphics();
    gfx.label = 'wire';
    this.drawHorizontal(gfx, edge, cellWidth, cellHeight);
    container.addChild(gfx);
    return container;
  }

  createVertical(edge: VerticalEdgeEntity, cellWidth: number, cellHeight: number): Container {
    const container = new Container();
    container.label = edge.id;
    container.eventMode = 'none';
    container.position.set(0, 0);
    const gfx = new Graphics();
    gfx.label = 'wire';
    this.drawVertical(gfx, edge, cellWidth, cellHeight);
    container.addChild(gfx);
    return container;
  }

  updateHorizontal(container: Container, edge: HorizontalEdgeEntity, cellWidth = 80, cellHeight = 60): void {
    const gfx = container.getChildByLabel('wire') as Graphics | null;
    if (!gfx) return;
    gfx.clear();
    this.drawHorizontal(gfx, edge, cellWidth, cellHeight);
  }

  updateVertical(container: Container, edge: VerticalEdgeEntity, cellWidth = 80, cellHeight = 60): void {
    const gfx = container.getChildByLabel('wire') as Graphics | null;
    if (!gfx) return;
    gfx.clear();
    this.drawVertical(gfx, edge, cellWidth, cellHeight);
  }

  destroy(): void {}

  private drawHorizontal(gfx: Graphics, edge: HorizontalEdgeEntity, cellWidth: number, cellHeight: number): void {
    const y = edge.position.row * cellHeight + getHorizontalWireMidline(cellHeight);
    const x1 = edge.position.startBoundaryCol * cellWidth;
    const x2 = edge.position.endBoundaryCol * cellWidth;
    gfx.moveTo(x1, y).lineTo(x2, y).stroke({ width: WIRE_WIDTH, color: WIRE_COLOR, cap: 'butt' });
  }

  private drawVertical(gfx: Graphics, edge: VerticalEdgeEntity, cellWidth: number, cellHeight: number): void {
    const x = edge.position.col * cellWidth;
    const y1 = edge.position.row * cellHeight + getVerticalWireMidline(cellHeight);
    const y2 = (edge.position.row + 1) * cellHeight + getVerticalWireMidline(cellHeight);
    gfx.moveTo(x, y1).lineTo(x, y2).stroke({ width: WIRE_WIDTH, color: WIRE_COLOR, cap: 'round' });
  }
}
