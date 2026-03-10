import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { GhostShape } from '../types';

export interface PinToolCallbacks extends ToolCallbacks {
  onOpenPinPopover: (screenX: number, screenY: number, canvasX: number, canvasY: number) => void;
}

export class PinTool extends BaseTool {
  private _lastScreen: { x: number; y: number } = { x: 0, y: 0 };

  setLastScreen(x: number, y: number): void {
    this._lastScreen = { x, y };
  }

  onMouseDown(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    const pinCallbacks = callbacks as PinToolCallbacks;
    pinCallbacks.onOpenPinPopover(
      this._lastScreen.x,
      this._lastScreen.y,
      pt.x,
      pt.y,
    );
  }

  onMouseMove(_pt: CanvasPoint, _callbacks: ToolCallbacks): GhostShape | null {
    return null;
  }

  onMouseUp(_pt: CanvasPoint, _callbacks: ToolCallbacks): void {}

  cancel(): void {}
}
