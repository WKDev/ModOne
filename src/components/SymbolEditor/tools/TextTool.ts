// 텍스트 배치 도구 — 클릭 시 인앱 팝오버를 열어 텍스트 내용을 입력받는다
import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { GhostShape } from '../types';

export interface TextToolCallbacks extends ToolCallbacks {
  onOpenTextPopover: (screenX: number, screenY: number, canvasX: number, canvasY: number) => void;
}

export class TextTool extends BaseTool {
  private _lastScreen: { x: number; y: number } = { x: 0, y: 0 };

  setLastScreen(x: number, y: number): void {
    this._lastScreen = { x, y };
  }

  onMouseDown(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    const textCallbacks = callbacks as TextToolCallbacks;
    textCallbacks.onOpenTextPopover(
      this._lastScreen.x,
      this._lastScreen.y,
      pt.x,
      pt.y,
    );
  }

  onMouseMove(_pt: CanvasPoint, _callbacks: ToolCallbacks): GhostShape | null {
    // No preview for text tool currently
    return null;
  }

  onMouseUp(_pt: CanvasPoint, _callbacks: ToolCallbacks): void {
    // No-op
  }

  cancel(): void {}
}
