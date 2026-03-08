/**
 * LadderDragHandler
 *
 * Handles pointer-based dragging of ladder elements within the Pixi canvas.
 * Provides visual feedback during drag and commits the move on drop.
 *
 * Usage:
 *   Integrate via LadderEventBridge callbacks (onPointerDown/Move/Up).
 *   When no activeTool is set, pointer-down on an element starts drag mode.
 */

import { Graphics, Container } from 'pixi.js';
import type { LadderPointerEvent } from '../LadderEventBridge';
import type { LadderSyncEngine } from '../LadderSyncEngine';
import type { UseLadderDocumentReturn } from '../../../../stores/hooks/useLadderDocument';
import type { LadderGridConfig } from '../../../../types/ladder';

// ============================================================================
// Types
// ============================================================================

interface DragState {
  /** ID of the element being dragged */
  elementId: string;
  /** Starting grid position */
  startRow: number;
  startCol: number;
  /** Current preview grid position */
  currentRow: number;
  currentCol: number;
}

// ============================================================================
// Constants
// ============================================================================

const DRAG_GHOST_ALPHA = 0.4;
const DRAG_GHOST_COLOR = 0x3b82f6; // blue-500
const DRAG_ACTIVATION_DISTANCE = 8; // pixels before drag starts

// ============================================================================
// Handler
// ============================================================================

export class LadderDragHandler {
  private dragState: DragState | null = null;
  private ghostGraphics: Graphics | null = null;
  private isDragActive = false;
  private pointerDownWorldX = 0;
  private pointerDownWorldY = 0;
  private pendingElementId: string | null = null;

  constructor(
    _syncEngine: LadderSyncEngine,
    private overlayContainer: Container,
  ) {}

  // ===========================================================================
  // Public API (called from useLadderPixiRenderer callbacks)
  // ===========================================================================

  /**
   * Handle pointer down — initiate potential drag.
   * Only starts drag if clicking on an existing element with no active tool.
   */
  onPointerDown(
    event: LadderPointerEvent,
    doc: UseLadderDocumentReturn,
    _config: LadderGridConfig,
  ): boolean {
    // Only left-click starts drag
    if (event.button !== 0) return false;

    const element = doc.getElementAt(event.gridRow, event.gridCol);
    if (!element) return false;

    // Record potential drag start
    this.pendingElementId = element.id;
    this.pointerDownWorldX = event.worldX;
    this.pointerDownWorldY = event.worldY;
    this.isDragActive = false;

    return false; // Don't consume — let click handler also evaluate
  }

  /**
   * Handle pointer move — activate drag if threshold met, update ghost position.
   */
  onPointerMove(
    event: LadderPointerEvent,
    doc: UseLadderDocumentReturn,
    config: LadderGridConfig,
  ): boolean {
    if (!this.pendingElementId) return false;

    // Check activation threshold
    if (!this.isDragActive) {
      const dx = event.worldX - this.pointerDownWorldX;
      const dy = event.worldY - this.pointerDownWorldY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < DRAG_ACTIVATION_DISTANCE) {
        return false; // Not yet dragging
      }

      // Activate drag
      const element = doc.elements.get(this.pendingElementId);
      if (!element) {
        this.cancel();
        return false;
      }

      this.isDragActive = true;
      this.dragState = {
        elementId: this.pendingElementId,
        startRow: element.position.row,
        startCol: element.position.col,
        currentRow: element.position.row,
        currentCol: element.position.col,
      };

      this.createGhost(config);
    }

    // Update ghost position
    if (this.isDragActive && this.dragState && this.ghostGraphics) {
      this.dragState.currentRow = event.gridRow;
      this.dragState.currentCol = event.gridCol;

      this.ghostGraphics.position.set(
        event.gridCol * config.cellWidth,
        event.gridRow * config.cellHeight,
      );
    }

    return true; // Consume during active drag
  }

  /**
   * Handle pointer up — commit move or cancel.
   */
  onPointerUp(
    _event: LadderPointerEvent,
    doc: UseLadderDocumentReturn,
    _config: LadderGridConfig,
  ): boolean {
    if (!this.isDragActive || !this.dragState) {
      this.cancel();
      return false;
    }

    const { elementId, startRow, startCol, currentRow, currentCol } = this.dragState;

    // Only move if position actually changed
    if (currentRow !== startRow || currentCol !== startCol) {
      doc.moveElement(elementId, { row: currentRow, col: currentCol });
    }

    this.cleanup();
    return true; // Consume — don't trigger click
  }

  /**
   * Cancel any in-progress drag.
   */
  cancel(): void {
    this.cleanup();
  }

  /**
   * Whether a drag is currently active (for preventing click passthrough).
   */
  get isActive(): boolean {
    return this.isDragActive;
  }

  /**
   * Destroy and clean up resources.
   */
  destroy(): void {
    this.cleanup();
  }

  // ===========================================================================
  // Internal
  // ===========================================================================

  private createGhost(config: LadderGridConfig): void {
    if (this.ghostGraphics) {
      this.ghostGraphics.destroy();
    }

    const ghost = new Graphics();
    const w = config.cellWidth;
    const h = config.cellHeight;
    const padding = 2;

    ghost.rect(padding, padding, w - padding * 2, h - padding * 2);
    ghost.fill({ color: DRAG_GHOST_COLOR, alpha: DRAG_GHOST_ALPHA });
    ghost.stroke({ color: DRAG_GHOST_COLOR, width: 1, alpha: 0.8 });

    if (this.dragState) {
      ghost.position.set(
        this.dragState.currentCol * config.cellWidth,
        this.dragState.currentRow * config.cellHeight,
      );
    }

    this.overlayContainer.addChild(ghost);
    this.ghostGraphics = ghost;
  }

  private cleanup(): void {
    if (this.ghostGraphics) {
      this.ghostGraphics.destroy();
      this.ghostGraphics = null;
    }
    this.dragState = null;
    this.isDragActive = false;
    this.pendingElementId = null;
  }
}
