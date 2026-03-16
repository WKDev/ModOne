import { Graphics, type Container } from 'pixi.js';
import type { Rect } from '../types';

export interface PageGuideRendererConfig {
  layer: Container;
  canvasBounds: Rect;
  pdfOutputBounds: Rect;
}

const CANVAS_FILL = 0xf8fafc;
const CANVAS_STROKE = 0x94a3b8;
const PDF_FILL = 0x3b82f6;
const PDF_STROKE = 0x2563eb;
const DASH_LENGTH = 18;
const DASH_GAP = 10;

function drawDashedLine(
  graphics: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dashLength: number,
  dashGap: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return;

  const ux = dx / distance;
  const uy = dy / distance;
  const step = dashLength + dashGap;

  for (let offset = 0; offset < distance; offset += step) {
    const start = offset;
    const end = Math.min(offset + dashLength, distance);
    graphics.moveTo(x1 + ux * start, y1 + uy * start);
    graphics.lineTo(x1 + ux * end, y1 + uy * end);
  }
}

function drawDashedRect(
  graphics: Graphics,
  bounds: Rect,
  dashLength: number,
  dashGap: number,
): void {
  const { x, y, width, height } = bounds;

  drawDashedLine(graphics, x, y, x + width, y, dashLength, dashGap);
  drawDashedLine(graphics, x + width, y, x + width, y + height, dashLength, dashGap);
  drawDashedLine(graphics, x + width, y + height, x, y + height, dashLength, dashGap);
  drawDashedLine(graphics, x, y + height, x, y, dashLength, dashGap);
}

export class PageGuideRenderer {
  private _graphics: Graphics | null = null;
  private _destroyed = false;

  init(config: PageGuideRendererConfig): void {
    if (this._graphics) {
      throw new Error('PageGuideRenderer already initialized');
    }

    const graphics = new Graphics();
    graphics.label = 'page-guide';
    graphics.eventMode = 'none';
    graphics.cullable = true;
    graphics.zIndex = 5;

    graphics
      .rect(config.canvasBounds.x, config.canvasBounds.y, config.canvasBounds.width, config.canvasBounds.height)
      .fill({ color: CANVAS_FILL, alpha: 0.12 })
      .stroke({ color: CANVAS_STROKE, alpha: 0.75, width: 1, pixelLine: true });

    graphics
      .rect(
        config.pdfOutputBounds.x,
        config.pdfOutputBounds.y,
        config.pdfOutputBounds.width,
        config.pdfOutputBounds.height,
      )
      .fill({ color: PDF_FILL, alpha: 0.04 });

    drawDashedRect(graphics, config.pdfOutputBounds, DASH_LENGTH, DASH_GAP);
    graphics.stroke({ color: PDF_STROKE, alpha: 0.9, width: 1, pixelLine: true });

    config.layer.addChild(graphics);
    this._graphics = graphics;
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._graphics?.destroy();
    this._graphics = null;
  }
}
