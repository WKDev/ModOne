import type { EditorAction } from '../SymbolEditor';
import type { GraphicPrimitive, SymbolDefinition } from '../../../types/symbol';
import type { GhostShape } from '../types';

export interface CanvasPoint {
  x: number;
  y: number;
  /**
   * True when the Shift key is held during this pointer event.
   * Used by SelectTool's resize drag handler to activate aspect-ratio lock mode.
   */
  shiftKey?: boolean;
  /**
   * True when the Alt key is held during this pointer event.
   * Used by SelectTool's resize drag handler to activate center-based resize mode.
   */
  altKey?: boolean;
}

export interface ToolCallbacks {
  symbol: SymbolDefinition | null;
  onAddPrimitive: (prim: GraphicPrimitive) => void;
  dispatch: React.Dispatch<EditorAction>;
  /**
   * Current selection set. Provided by SvgSymbolCanvas so SelectTool can
   * distinguish a click on an already-selected item (→ potential move) from
   * a click on an unselected item (→ select first, then move).
   */
  selectedIds?: Set<string>;
  /**
   * Called by SelectTool when the user drags selected graphic primitives.
   * @param indices - Indices into symbol.graphics[] to translate
   * @param dx      - Horizontal delta in symbol-space units
   * @param dy      - Vertical delta in symbol-space units
   */
  onMovePrimitives?: (indices: number[], dx: number, dy: number) => void;
  /**
   * Called by SelectTool when the user drags selected pins.
   * @param pinIds  - Pin IDs to translate
   * @param dx      - Horizontal delta in symbol-space units
   * @param dy      - Vertical delta in symbol-space units
   */
  onMovePins?: (pinIds: string[], dx: number, dy: number) => void;
  /** Legacy single-pin move (kept for backwards compat); prefer onMovePins */
  onMovePin?: (pinId: string, newPosition: { x: number; y: number }) => void;
  /**
   * Called by SelectTool when the user finishes resizing a primitive via handles.
   * @param index     - Index into symbol.graphics[]
   * @param newBounds - New bounding box in symbol-space units
   */
  onResizePrimitive?: (index: number, newBounds: { x: number; y: number; width: number; height: number }) => void;
  /**
   * Called by SelectTool when the user finishes rotating a primitive via the rotation handle.
   * @param index - Index into symbol.graphics[]
   * @param angle - Rotation angle in degrees
   */
  onRotatePrimitive?: (index: number, angle: number) => void;
  /**
   * Called by SelectTool to replace a primitive at a given index with updated data.
   * Used for polyline point editing (move/add/delete points).
   * @param index - Index into symbol.graphics[]
   * @param prim  - The updated primitive
   */
  onUpdatePrimitive?: (index: number, prim: GraphicPrimitive) => void;
  /**
   * Index of the polyline primitive currently in point-edit mode.
   * Set by double-clicking a selected polyline. null = not editing points.
   */
  editingPolylineIndex?: number | null;
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
