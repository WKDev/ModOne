import { Container, Graphics } from 'pixi.js';
import type { LadderGridConfig } from '@/types/ladder';

const RUNG_SEPARATOR_COLOR = 0x525252;
const COLUMN_LINE_COLOR = 0x404040;
const CELL_BOUNDARY_COLOR = 0x2a2a2a;

export class LadderGridRenderer {
  private readonly layer: Container;
  private readonly graphics: Graphics;

  public constructor(layer: Container) {
    this.layer = layer;
    this.graphics = new Graphics();
    this.graphics.label = 'ladderGrid';
    this.layer.addChild(this.graphics);
  }

  public render(config: LadderGridConfig, rowCount: number = 20): void {
    this.graphics.clear();

    if (config.showGridLines === false) {
      return;
    }

    const safeRowCount = Math.max(rowCount, 20);
    const { columns, cellWidth, cellHeight } = config;
    
    const gridWidth = columns * cellWidth;
    const gridHeight = safeRowCount * cellHeight;

    // 1. Draw cell boundary outlines (very subtle base grid)
    for (let row = 0; row <= safeRowCount; row++) {
      const y = row * cellHeight;
      this.graphics.moveTo(0, y).lineTo(gridWidth, y);
    }
    for (let col = 0; col <= columns; col++) {
      const x = col * cellWidth;
      this.graphics.moveTo(x, 0).lineTo(x, gridHeight);
    }
    this.graphics.stroke({ width: 1, color: CELL_BOUNDARY_COLOR });

    // 2. Draw vertical column lines dividing cells (thinner)
    for (let col = 1; col < columns; col++) {
      const x = col * cellWidth;
      this.graphics.moveTo(x, 0).lineTo(x, gridHeight);
    }
    this.graphics.stroke({ width: 1, color: COLUMN_LINE_COLOR });

    // 3. Draw horizontal rung separator lines between rows (full width)
    for (let row = 1; row <= safeRowCount; row++) {
      const y = row * cellHeight;
      this.graphics.moveTo(0, y).lineTo(gridWidth, y);
    }
    this.graphics.stroke({ width: 2, color: RUNG_SEPARATOR_COLOR });
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
