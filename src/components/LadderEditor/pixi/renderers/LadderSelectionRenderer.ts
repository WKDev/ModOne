/**
 * LadderSelectionRenderer
 *
 * Renders selection highlights (cell outlines, rubber-band box) in the selectionLayer.
 */

import { Container, Graphics } from 'pixi.js';

const SELECTION_COLOR = 0x3b82f6;     // blue-500
const SELECTION_ALPHA = 0.25;
const SELECTION_STROKE = 0x60a5fa;    // blue-400
const STROKE_WIDTH = 2;

export class LadderSelectionRenderer {
  private layer: Container;
  private cellHighlights: Graphics;
  private rubberBand: Graphics;

  constructor(layer: Container) {
    this.layer = layer;

    this.cellHighlights = new Graphics();
    this.cellHighlights.label = 'cellHighlights';
    this.layer.addChild(this.cellHighlights);

    this.rubberBand = new Graphics();
    this.rubberBand.label = 'rubberBand';
    this.rubberBand.visible = false;
    this.layer.addChild(this.rubberBand);
  }

  /**
   * Highlight selected cells.
   */
  renderSelection(
    selectedCells: Array<{ row: number; col: number }>,
    cellWidth: number,
    cellHeight: number,
  ): void {
    this.cellHighlights.clear();

    for (const { row, col } of selectedCells) {
      const x = col * cellWidth;
      const y = row * cellHeight;

      // Fill
      this.cellHighlights
        .rect(x, y, cellWidth, cellHeight)
        .fill({ color: SELECTION_COLOR, alpha: SELECTION_ALPHA });

      // Stroke
      this.cellHighlights
        .rect(x, y, cellWidth, cellHeight)
        .stroke({ width: STROKE_WIDTH, color: SELECTION_STROKE });
    }
  }

  /**
   * Show rubber-band selection rectangle (during drag-select).
   */
  showRubberBand(x: number, y: number, width: number, height: number): void {
    this.rubberBand.clear();
    this.rubberBand
      .rect(x, y, width, height)
      .fill({ color: SELECTION_COLOR, alpha: 0.1 });
    this.rubberBand
      .rect(x, y, width, height)
      .stroke({ width: 1, color: SELECTION_STROKE });
    this.rubberBand.visible = true;
  }

  /**
   * Hide rubber-band.
   */
  hideRubberBand(): void {
    this.rubberBand.clear();
    this.rubberBand.visible = false;
  }

  /**
   * Clear all selection visuals.
   */
  clear(): void {
    this.cellHighlights.clear();
    this.hideRubberBand();
  }

  destroy(): void {
    this.cellHighlights.destroy();
    this.rubberBand.destroy();
  }
}
