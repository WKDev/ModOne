import type { EditorAction } from '../SymbolEditor';
import type { GraphicPrimitive, SymbolDefinition } from '../../../types/symbol';
import type { GhostShape } from '../types';

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface ToolCallbacks {
  symbol: SymbolDefinition | null;
  onAddPrimitive: (prim: GraphicPrimitive) => void;
  dispatch: React.Dispatch<EditorAction>;
}

export abstract class BaseTool {
  abstract onMouseDown(pt: CanvasPoint, callbacks: ToolCallbacks): void;
  abstract onMouseMove(pt: CanvasPoint, callbacks: ToolCallbacks): GhostShape | null;
  abstract onMouseUp(pt: CanvasPoint, callbacks: ToolCallbacks): void;
  
  // Optional handlers
  onKeyDown?(e: KeyboardEvent, callbacks: ToolCallbacks): void;
  onDoubleClick?(pt: CanvasPoint, callbacks: ToolCallbacks): void;

  // Optional cleanup or cancel operation
  cancel(): void {}
}
