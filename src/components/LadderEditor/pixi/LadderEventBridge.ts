import type { Viewport } from 'pixi-viewport';
import type { FederatedPointerEvent } from 'pixi.js';

/**
 * Represents a pointer event with grid coordinates and modifiers.
 */
export interface LadderPointerEvent {
  worldX: number;
  worldY: number;
  gridRow: number;
  gridCol: number;
  button: number; // 0=left, 1=middle, 2=right
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  originalEvent: FederatedPointerEvent;
}

/**
 * Callback interface for ladder-specific pointer events.
 */
export interface LadderEventCallbacks {
  onCellClick?: (event: LadderPointerEvent) => void;
  onCellRightClick?: (event: LadderPointerEvent) => void;
  onPointerMove?: (event: LadderPointerEvent) => void;
  onPointerDown?: (event: LadderPointerEvent) => void;
  onPointerUp?: (event: LadderPointerEvent) => void;
}

/**
 * Bridges Pixi.js pointer events to ladder grid coordinates and actions.
 * Converts world coordinates to grid positions and emits typed callbacks.
 */
export class LadderEventBridge {
  private callbacks: LadderEventCallbacks = {};
  private cellWidth: number = 80;
  private cellHeight: number = 60;

  public constructor(private viewport: Viewport) {}

  /**
   * Convert world coordinates to grid position.
   * Clamps to valid range (col >= 0, row >= 0).
   */
  public worldToGrid(
    worldX: number,
    worldY: number,
    cellWidth?: number,
    cellHeight?: number
  ): { row: number; col: number } {
    const w = cellWidth ?? this.cellWidth;
    const h = cellHeight ?? this.cellHeight;

    const col = Math.max(0, Math.floor(worldX / w));
    const row = Math.max(0, Math.floor(worldY / h));

    return { row, col };
  }

  /**
   * Convert grid position to world coordinates (top-left corner of cell).
   */
  public gridToWorld(
    row: number,
    col: number,
    cellWidth?: number,
    cellHeight?: number
  ): { x: number; y: number } {
    const w = cellWidth ?? this.cellWidth;
    const h = cellHeight ?? this.cellHeight;

    return {
      x: col * w,
      y: row * h,
    };
  }

  /**
   * Set grid cell dimensions for coordinate conversions.
   */
  public setGridConfig(cellWidth: number, cellHeight: number): void {
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
  }

  /**
   * Set event callbacks.
   */
  public setCallbacks(callbacks: LadderEventCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Attach pointer event listeners to viewport.
   */
  public attach(): void {
    this.viewport.on('pointerdown', this.onPointerDown);
    this.viewport.on('pointermove', this.onPointerMove);
    this.viewport.on('pointerup', this.onPointerUp);
    this.viewport.on('pointerupoutside', this.onPointerUp);
  }

  /**
   * Remove pointer event listeners from viewport.
   */
  public detach(): void {
    this.viewport.off('pointerdown', this.onPointerDown);
    this.viewport.off('pointermove', this.onPointerMove);
    this.viewport.off('pointerup', this.onPointerUp);
    this.viewport.off('pointerupoutside', this.onPointerUp);
  }

  /**
   * Clean up: detach listeners and null references.
   */
  public destroy(): void {
    this.detach();
    this.callbacks = {};
  }

  private onPointerDown = (event: FederatedPointerEvent): void => {
    // Middle mouse button (button=1) is reserved for viewport panning
    if (event.button === 1) {
      return;
    }

    const worldPos = this.viewport.toWorld(event.global.x, event.global.y);
    const gridPos = this.worldToGrid(worldPos.x, worldPos.y);

    const ladderEvent: LadderPointerEvent = {
      worldX: worldPos.x,
      worldY: worldPos.y,
      gridRow: gridPos.row,
      gridCol: gridPos.col,
      button: event.button,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      originalEvent: event,
    };

    this.callbacks.onPointerDown?.(ladderEvent);
  };

  private onPointerMove = (event: FederatedPointerEvent): void => {
    const worldPos = this.viewport.toWorld(event.global.x, event.global.y);
    const gridPos = this.worldToGrid(worldPos.x, worldPos.y);

    const ladderEvent: LadderPointerEvent = {
      worldX: worldPos.x,
      worldY: worldPos.y,
      gridRow: gridPos.row,
      gridCol: gridPos.col,
      button: event.button,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      originalEvent: event,
    };

    this.callbacks.onPointerMove?.(ladderEvent);
  };

  private onPointerUp = (event: FederatedPointerEvent): void => {
    // Middle mouse button (button=1) is reserved for viewport panning
    if (event.button === 1) {
      return;
    }

    const worldPos = this.viewport.toWorld(event.global.x, event.global.y);
    const gridPos = this.worldToGrid(worldPos.x, worldPos.y);

    const ladderEvent: LadderPointerEvent = {
      worldX: worldPos.x,
      worldY: worldPos.y,
      gridRow: gridPos.row,
      gridCol: gridPos.col,
      button: event.button,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      originalEvent: event,
    };

    // Emit right-click callback for button=2
    if (event.button === 2) {
      this.callbacks.onCellRightClick?.(ladderEvent);
    }

    // Emit left-click callback for button=0
    if (event.button === 0) {
      this.callbacks.onCellClick?.(ladderEvent);
    }

    this.callbacks.onPointerUp?.(ladderEvent);
  };
}
