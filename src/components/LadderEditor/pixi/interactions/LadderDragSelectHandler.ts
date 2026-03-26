/**
 * LadderDragSelectHandler
 *
 * Handles rubber-band (marquee) drag selection on the Pixi canvas.
 * Activates when the user starts dragging on an empty cell (no element)
 * with no active tool. Shows a rubber-band rectangle and selects all
 * elements whose grid cells fall within the rectangle.
 */

import type { LadderPointerEvent } from '../LadderEventBridge';
import type { LadderSyncEngine } from '../LadderSyncEngine';
import type { UseLadderDocumentReturn } from '../../../../stores/hooks/useLadderDocument';
import type { LadderGridConfig } from '../../../../types/ladder';
import { useLadderUIStore } from '../../../../stores/ladderUIStore';

const DRAG_ACTIVATION_DISTANCE = 8; // pixels before drag activates

export class LadderDragSelectHandler {
  private anchorWorldX = 0;
  private anchorWorldY = 0;
  private anchorGridRow = 0;
  private anchorGridCol = 0;
  private isDragActive = false;
  private isPending = false;
  private isCtrlHeld = false;
  private previousSelection: Set<string> = new Set();

  constructor(private syncEngine: LadderSyncEngine) {}

  /**
   * Handle pointer down — record anchor if clicking on empty cell.
   * Returns true if this handler claims the event (pending drag-select).
   */
  onPointerDown(
    event: LadderPointerEvent,
    _doc: UseLadderDocumentReturn,
    _config: LadderGridConfig,
  ): boolean {
    if (event.button !== 0) return false;

    this.anchorWorldX = event.worldX;
    this.anchorWorldY = event.worldY;
    this.anchorGridRow = event.gridRow;
    this.anchorGridCol = event.gridCol;
    this.isPending = true;
    this.isDragActive = false;
    this.isCtrlHeld = event.ctrlKey;

    // Snapshot current selection for Ctrl+Drag additive mode
    if (this.isCtrlHeld) {
      this.previousSelection = new Set(useLadderUIStore.getState().selectedElementIds);
    } else {
      this.previousSelection = new Set();
    }

    return true;
  }

  /**
   * Handle pointer move — activate drag if threshold met, update rubber band.
   */
  onPointerMove(
    event: LadderPointerEvent,
    doc: UseLadderDocumentReturn,
    config: LadderGridConfig,
  ): boolean {
    if (!this.isPending) return false;

    if (!this.isDragActive) {
      const dx = event.worldX - this.anchorWorldX;
      const dy = event.worldY - this.anchorWorldY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < DRAG_ACTIVATION_DISTANCE) {
        return false;
      }

      this.isDragActive = true;
    }

    // Calculate rubber band rectangle in world coordinates
    const x = Math.min(this.anchorWorldX, event.worldX);
    const y = Math.min(this.anchorWorldY, event.worldY);
    const w = Math.abs(event.worldX - this.anchorWorldX);
    const h = Math.abs(event.worldY - this.anchorWorldY);

    // Show rubber band visual
    this.syncEngine.selection.showRubberBand(x, y, w, h);

    // Calculate grid range covered by the rubber band
    const { cellWidth, cellHeight } = config;
    const minRow = Math.max(0, Math.floor(y / cellHeight));
    const maxRow = Math.floor((y + h) / cellHeight);
    const minCol = Math.max(0, Math.floor(x / cellWidth));
    const maxCol = Math.floor((x + w) / cellWidth);

    // Collect element IDs within the range
    const rangeIds: string[] = [];
    for (const el of doc.elements.values()) {
      if (
        el.position.row >= minRow && el.position.row <= maxRow &&
        el.position.col >= minCol && el.position.col <= maxCol
      ) {
        rangeIds.push(el.id);
      }
    }

    // Merge with previous selection in Ctrl+Drag mode
    const uiStore = useLadderUIStore.getState();
    if (this.isCtrlHeld) {
      const merged = new Set(this.previousSelection);
      for (const id of rangeIds) {
        merged.add(id);
      }
      uiStore.setSelection(merged);
    } else {
      uiStore.setSelection(rangeIds);
    }

    return true;
  }

  /**
   * Handle pointer up — commit selection, hide rubber band.
   */
  onPointerUp(): boolean {
    if (!this.isPending && !this.isDragActive) {
      return false;
    }

    if (!this.isDragActive) {
      // Click without drag — just clean up pending state
      this.cleanup();
      return false;
    }

    // Hide rubber band
    this.syncEngine.selection.hideRubberBand();

    // Set cursor and anchor to the drag start cell
    const uiStore = useLadderUIStore.getState();
    uiStore.setCursorCell({ row: this.anchorGridRow, col: this.anchorGridCol });
    uiStore.setSelectionAnchor({ row: this.anchorGridRow, col: this.anchorGridCol });

    this.cleanup();
    return true;
  }

  /** Whether a drag-select is currently active. */
  get isActive(): boolean {
    return this.isDragActive;
  }

  /** Cancel any in-progress drag-select. */
  cancel(): void {
    if (this.isDragActive) {
      this.syncEngine.selection.hideRubberBand();
    }
    this.cleanup();
  }

  destroy(): void {
    this.cancel();
  }

  private cleanup(): void {
    this.isDragActive = false;
    this.isPending = false;
    this.previousSelection = new Set();
  }
}
