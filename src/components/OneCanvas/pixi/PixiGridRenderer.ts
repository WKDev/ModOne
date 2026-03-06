import { Container, Graphics } from 'pixi.js';

const DEFAULT_GRID_SIZE = 20;
const MAJOR_LINE_INTERVAL = 5;
const MIN_ZOOM_FOR_MINOR_LINES = 0.5;
const MINOR_LINE_COLOR = 0x2a2a2a;
const MAJOR_LINE_COLOR = 0x3a3a3a;
const VIEWPORT_PADDING_CELLS = 1;

interface VisibleBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class PixiGridRenderer {
  private readonly gridLayer: Container;

  private readonly minorGraphics: Graphics;

  private readonly majorGraphics: Graphics;

  private readonly gridSize: number;

  public constructor(gridLayer: Container, gridSize?: number) {
    this.gridLayer = gridLayer;
    this.gridSize = gridSize ?? DEFAULT_GRID_SIZE;
    this.minorGraphics = new Graphics();
    this.majorGraphics = new Graphics();

    this.minorGraphics.label = 'minorGridLines';
    this.majorGraphics.label = 'majorGridLines';

    this.gridLayer.addChild(this.minorGraphics);
    this.gridLayer.addChild(this.majorGraphics);
  }

  public update(zoom: number, visibleBounds: VisibleBounds): void {
    const safeZoom = Math.max(zoom, 0.0001);
    const paddedBounds = this.getPaddedBounds(visibleBounds);

    this.minorGraphics.clear();
    this.majorGraphics.clear();

    this.drawMajorLines(safeZoom, paddedBounds);

    const showMinorLines = safeZoom >= MIN_ZOOM_FOR_MINOR_LINES;
    this.minorGraphics.visible = showMinorLines;
    if (showMinorLines) {
      this.drawMinorLines(safeZoom, paddedBounds);
    }
  }

  public setVisible(visible: boolean): void {
    this.gridLayer.visible = visible;
  }

  public destroy(): void {
    this.minorGraphics.destroy();
    this.majorGraphics.destroy();
  }

  private drawMinorLines(zoom: number, visibleBounds: VisibleBounds): void {
    const minorStrokeWidth = Math.max(0.5, 1 / zoom);
    const startX = this.snapStart(visibleBounds.minX, this.gridSize);
    const endX = this.snapEnd(visibleBounds.maxX, this.gridSize);
    const startY = this.snapStart(visibleBounds.minY, this.gridSize);
    const endY = this.snapEnd(visibleBounds.maxY, this.gridSize);

    for (let x = startX; x <= endX; x += this.gridSize) {
      if (this.isMajorLine(x)) {
        continue;
      }

      this.minorGraphics.moveTo(x, startY).lineTo(x, endY);
    }

    for (let y = startY; y <= endY; y += this.gridSize) {
      if (this.isMajorLine(y)) {
        continue;
      }

      this.minorGraphics.moveTo(startX, y).lineTo(endX, y);
    }

    this.minorGraphics.stroke({ width: minorStrokeWidth, color: MINOR_LINE_COLOR });
  }

  private drawMajorLines(zoom: number, visibleBounds: VisibleBounds): void {
    const majorStrokeWidth = Math.max(1, 1.5 / zoom);
    const majorStep = this.gridSize * MAJOR_LINE_INTERVAL;
    const startX = this.snapStart(visibleBounds.minX, majorStep);
    const endX = this.snapEnd(visibleBounds.maxX, majorStep);
    const startY = this.snapStart(visibleBounds.minY, majorStep);
    const endY = this.snapEnd(visibleBounds.maxY, majorStep);

    for (let x = startX; x <= endX; x += majorStep) {
      this.majorGraphics.moveTo(x, startY).lineTo(x, endY);
    }

    for (let y = startY; y <= endY; y += majorStep) {
      this.majorGraphics.moveTo(startX, y).lineTo(endX, y);
    }

    this.majorGraphics.stroke({ width: majorStrokeWidth, color: MAJOR_LINE_COLOR });
  }

  private getPaddedBounds(visibleBounds: VisibleBounds): VisibleBounds {
    const padding = this.gridSize * VIEWPORT_PADDING_CELLS;

    return {
      minX: visibleBounds.minX - padding,
      minY: visibleBounds.minY - padding,
      maxX: visibleBounds.maxX + padding,
      maxY: visibleBounds.maxY + padding,
    };
  }

  private snapStart(value: number, interval: number): number {
    return Math.floor(value / interval) * interval;
  }

  private snapEnd(value: number, interval: number): number {
    return Math.ceil(value / interval) * interval;
  }

  private isMajorLine(value: number): boolean {
    const cell = Math.round(value / this.gridSize);
    return cell % MAJOR_LINE_INTERVAL === 0;
  }
}
