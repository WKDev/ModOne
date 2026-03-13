/**
 * LadderSelectionRenderer
 *
 * Renders Excel/XG5000-style selection highlights in the selectionLayer:
 * - Cursor cell: thick blue border only (no fill) — the "active cell"
 * - Single cell selection: same as cursor cell
 * - Multi-cell range fill: subtle blue fill for all cells, outer-perimeter border only
 */

import { Container, Graphics } from 'pixi.js';
import {
  getHorizontalWireHighlightHeight,
  getHorizontalWireMidline,
  getVerticalWireHighlightWidth,
  getVerticalWireMidline,
} from '../verticalWireInteraction';

// Excel-style blue palette
const SELECTION_FILL_COLOR = 0x4f8de8;    // Slightly vivid blue fill
const SELECTION_FILL_ALPHA = 0.18;
const CURSOR_BORDER_COLOR = 0x2563eb;     // blue-600 — active cell border
const RANGE_BORDER_COLOR = 0x3b82f6;      // blue-500 — range outer border
const CURSOR_STROKE_WIDTH = 2.5;
const RANGE_STROKE_WIDTH = 1.5;
const VERTICAL_SELECTION_BORDER_COLOR = CURSOR_BORDER_COLOR;
const VERTICAL_SELECTION_STROKE_WIDTH = 2;

// Rubber-band (drag-select preview)
const RUBBER_BAND_FILL_ALPHA = 0.08;
const RUBBER_BAND_STROKE_COLOR = 0x60a5fa; // blue-400

export class LadderSelectionRenderer {
  private layer: Container;
  private rangeFill: Graphics;
  private horizontalSelection: Graphics;
  private verticalSelection: Graphics;
  private cursorBorder: Graphics;
  private rubberBand: Graphics;

  constructor(layer: Container) {
    this.layer = layer;

    // Range fill behind cursor
    this.rangeFill = new Graphics();
    this.rangeFill.label = 'selectionRangeFill';
    this.layer.addChild(this.rangeFill);

    this.horizontalSelection = new Graphics();
    this.horizontalSelection.label = 'horizontalSelection';
    this.layer.addChild(this.horizontalSelection);

    // Vertical selection
    this.verticalSelection = new Graphics();
    this.verticalSelection.label = 'verticalSelection';
    this.layer.addChild(this.verticalSelection);

    // Cursor cell on top (thick border, no fill)
    this.cursorBorder = new Graphics();
    this.cursorBorder.label = 'selectionCursorBorder';
    this.layer.addChild(this.cursorBorder);

    // Rubber-band on top
    this.rubberBand = new Graphics();
    this.rubberBand.label = 'rubberBand';
    this.rubberBand.visible = false;
    this.layer.addChild(this.rubberBand);
  }

  /**
   * Render selection: all selected cells as a highlighted range, plus the cursor cell.
   *
   * @param selectedCells - All selected grid cells (may form a rectangular range)
   * @param horizontalEdges - Selected horizontal edge runs
   * @param verticalCells - Cells with selected vertical wires
   * @param cursorCell    - The active cursor cell (null = no cursor)
   * @param cellWidth     - Cell width in pixels
   * @param cellHeight    - Cell height in pixels
   */
  renderSelection(
    selectedCells: Array<{ row: number; col: number }>,
    horizontalEdges: Array<{ row: number; startBoundaryCol: number; endBoundaryCol: number }>,
    verticalCells: Array<{ row: number; col: number }>,
    cursorCell: { row: number; col: number } | null,
    cellWidth: number,
    cellHeight: number,
  ): void {
    this.rangeFill.clear();
    this.horizontalSelection.clear();
    this.verticalSelection.clear();
    this.cursorBorder.clear();

    if (selectedCells.length === 0 && horizontalEdges.length === 0 && verticalCells.length === 0 && !cursorCell) return;

    for (const edge of horizontalEdges) {
      this.drawHorizontalHighlight(edge.row, edge.startBoundaryCol, edge.endBoundaryCol, cellWidth, cellHeight);
    }

    // ---------- Vertical wire selection highlights ----------
    for (const { row, col } of verticalCells) {
      this.drawVerticalHighlight(row, col, cellWidth, cellHeight);
    }

    // ---------- Range fill for all selected cells ----------
    if (selectedCells.length > 0) {
      // Fill every selected cell
      for (const { row, col } of selectedCells) {
        const x = col * cellWidth;
        const y = row * cellHeight;
        this.rangeFill
          .rect(x, y, cellWidth, cellHeight)
          .fill({ color: SELECTION_FILL_COLOR, alpha: SELECTION_FILL_ALPHA });
      }

      // Draw outer perimeter border of the selection range
      this.drawRangeOutline(selectedCells, cellWidth, cellHeight);
    }

    // ---------- Cursor cell (active cell, Excel-style) ----------
    const cursor = cursorCell ?? (selectedCells.length === 1 && verticalCells.length === 0 ? selectedCells[0] : null);
    if (cursor) {
      this.drawCursorCell(cursor.row, cursor.col, cellWidth, cellHeight);
    }
  }

  /**
   * Draw only the cursor cell (no range selection).
   */
  renderCursorCell(
    row: number,
    col: number,
    cellWidth: number,
    cellHeight: number,
  ): void {
    this.rangeFill.clear();
    this.horizontalSelection.clear();
    this.verticalSelection.clear();
    this.cursorBorder.clear();
    this.drawCursorCell(row, col, cellWidth, cellHeight);
  }

  /**
   * Show rubber-band selection rectangle (during drag-select).
   */
  showRubberBand(x: number, y: number, width: number, height: number): void {
    this.rubberBand.clear();
    this.rubberBand
      .rect(x, y, width, height)
      .fill({ color: SELECTION_FILL_COLOR, alpha: RUBBER_BAND_FILL_ALPHA });
    this.rubberBand
      .rect(x, y, width, height)
      .stroke({ width: 1, color: RUBBER_BAND_STROKE_COLOR });
    this.rubberBand.visible = true;
  }

  /** Hide rubber-band. */
  hideRubberBand(): void {
    this.rubberBand.clear();
    this.rubberBand.visible = false;
  }

  /** Clear all selection visuals. */
  clear(): void {
    this.rangeFill.clear();
    this.horizontalSelection.clear();
    this.verticalSelection.clear();
    this.cursorBorder.clear();
    this.hideRubberBand();
  }

  destroy(): void {
    this.rangeFill.destroy();
    this.horizontalSelection.destroy();
    this.verticalSelection.destroy();
    this.cursorBorder.destroy();
    this.rubberBand.destroy();
  }


  // ===========================================================================
  // Internal helpers
  // ===========================================================================

  private drawHorizontalHighlight(
    row: number,
    startBoundaryCol: number,
    endBoundaryCol: number,
    cellWidth: number,
    cellHeight: number,
  ): void {
    const highlightHeight = getHorizontalWireHighlightHeight();
    const halfHeight = highlightHeight / 2;
    const x = startBoundaryCol * cellWidth;
    const y = row * cellHeight + getHorizontalWireMidline(cellHeight) - halfHeight;
    const width = (endBoundaryCol - startBoundaryCol) * cellWidth;

    this.horizontalSelection
      .rect(x, y, width, highlightHeight)
      .fill({ color: SELECTION_FILL_COLOR, alpha: SELECTION_FILL_ALPHA * 2.2 });

    this.horizontalSelection
      .rect(x, y, width, highlightHeight)
      .stroke({ width: VERTICAL_SELECTION_STROKE_WIDTH, color: VERTICAL_SELECTION_BORDER_COLOR });
  }

  /**
   * Draw a narrow vertical highlight at the left edge of the cell,
   * spanning from this row's midline to the next row's midline.
   */
  private drawVerticalHighlight(
    row: number,
    col: number,
    cellWidth: number,
    cellHeight: number,
  ): void {
    const midY = getVerticalWireMidline(cellHeight);
    const x = col * cellWidth;
    const y = row * cellHeight + midY;

    const highlightWidth = getVerticalWireHighlightWidth();
    const halfWidth = highlightWidth / 2;

    this.verticalSelection
      .rect(x - halfWidth, y, highlightWidth, cellHeight)
      .fill({ color: SELECTION_FILL_COLOR, alpha: SELECTION_FILL_ALPHA * 2.5 }); // More visible for narrow lines

    this.verticalSelection
      .rect(x - halfWidth, y, highlightWidth, cellHeight)
      .stroke({ width: VERTICAL_SELECTION_STROKE_WIDTH, color: VERTICAL_SELECTION_BORDER_COLOR });
  }

  /**
   * Draw thick blue border (no fill) for the active cursor cell, Excel-style.

   * Inset by half stroke-width so it doesn't bleed outside the cell.
   */
  private drawCursorCell(
    row: number,
    col: number,
    cellWidth: number,
    cellHeight: number,
  ): void {
    const hw = CURSOR_STROKE_WIDTH / 2;
    const x = col * cellWidth + hw;
    const y = row * cellHeight + hw;
    const w = cellWidth - CURSOR_STROKE_WIDTH;
    const h = cellHeight - CURSOR_STROKE_WIDTH;

    this.cursorBorder
      .rect(x, y, w, h)
      .stroke({ width: CURSOR_STROKE_WIDTH, color: CURSOR_BORDER_COLOR });
  }

  /**
   * Draw the outer perimeter of the selection range using polyline paths.
   * This gives the Excel look where internal cell grid lines are visible
   * but only the outer edge of the selection has a solid border.
   */
  private drawRangeOutline(
    cells: Array<{ row: number; col: number }>,
    cellWidth: number,
    cellHeight: number,
  ): void {
    if (cells.length === 0) return;

    // Build a Set for O(1) membership checks
    const cellSet = new Set(cells.map((c) => `${c.row},${c.col}`));

    const hw = RANGE_STROKE_WIDTH / 2;

    for (const { row, col } of cells) {
      const x = col * cellWidth;
      const y = row * cellHeight;

      // For each of the 4 edges: draw if the neighbouring cell is NOT selected
      // Top edge
      if (!cellSet.has(`${row - 1},${col}`)) {
        this.rangeFill
          .moveTo(x - hw, y)
          .lineTo(x + cellWidth + hw, y)
          .stroke({ width: RANGE_STROKE_WIDTH, color: RANGE_BORDER_COLOR });
      }
      // Bottom edge
      if (!cellSet.has(`${row + 1},${col}`)) {
        this.rangeFill
          .moveTo(x - hw, y + cellHeight)
          .lineTo(x + cellWidth + hw, y + cellHeight)
          .stroke({ width: RANGE_STROKE_WIDTH, color: RANGE_BORDER_COLOR });
      }
      // Left edge
      if (!cellSet.has(`${row},${col - 1}`)) {
        this.rangeFill
          .moveTo(x, y - hw)
          .lineTo(x, y + cellHeight + hw)
          .stroke({ width: RANGE_STROKE_WIDTH, color: RANGE_BORDER_COLOR });
      }
      // Right edge
      if (!cellSet.has(`${row},${col + 1}`)) {
        this.rangeFill
          .moveTo(x + cellWidth, y - hw)
          .lineTo(x + cellWidth, y + cellHeight + hw)
          .stroke({ width: RANGE_STROKE_WIDTH, color: RANGE_BORDER_COLOR });
      }
    }
  }
}
