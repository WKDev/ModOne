import { Graphics, Container } from 'pixi.js';

/**
 * LadderRailRenderer
 * Renders the power rail (left) and neutral rail (right) vertical lines for the ladder diagram.
 */
export class LadderRailRenderer {
  private graphics: Graphics;
  private layer: Container;

  constructor(layer: Container) {
    this.layer = layer;
    this.graphics = new Graphics();
    this.layer.addChild(this.graphics);
  }

  /**
   * Render the power and neutral rails
   * @param columns - Number of columns in the grid
   * @param cellWidth - Width of each cell in pixels
   * @param cellHeight - Height of each cell in pixels
   * @param rowCount - Number of rows in the grid
   */
  render(
    columns: number,
    cellWidth: number,
    cellHeight: number,
    rowCount: number
  ): void {
    this.graphics.clear();

    const railColor = 0xa3a3a3; // neutral-400
    const railStrokeWidth = 3;
    const totalHeight = rowCount * cellHeight;
    const rightRailX = columns * cellWidth;

    // Power rail (left)
    this.graphics.lineStyle(railStrokeWidth, railColor);
    this.graphics.moveTo(0, 0);
    this.graphics.lineTo(0, totalHeight);

    // Neutral rail (right)
    this.graphics.moveTo(rightRailX, 0);
    this.graphics.lineTo(rightRailX, totalHeight);
  }

  /**
   * Destroy the renderer and clean up resources
   */
  destroy(): void {
    this.graphics.destroy();
  }
}
