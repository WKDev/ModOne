/**
 * CanvasTool — the domain-agnostic tool/input contract for the shared canvas engine.
 *
 * Every editor (Symbol, Schematic, Sheet) drives its interactions through tools
 * that receive ONE normalized pointer event, regardless of how the raw event was
 * produced. `ToolInputBinding` is the single source that converts PIXI federated
 * events into `CanvasPointerInput` and dispatches them — so all editors share one
 * coordinate/snap/pan pipeline.
 *
 * This is intentionally minimal: editor-specific state (selection, the document
 * model, undo, ghost previews) stays in the editor. A tool either implements
 * `CanvasTool` directly or an editor adapts its own tool model behind
 * `PointerInputHandlers`.
 */

/** A pointer event normalized into the canvas's coordinate spaces. */
export interface CanvasPointerInput {
  /** Unsnapped world coordinates (viewport.toWorld of the canvas-relative point). */
  world: { x: number; y: number };
  /** World coordinates snapped to the active grid (equals `world` when snap is off). */
  snapped: { x: number; y: number };
  /**
   * Window-relative client coordinates (the underlying DOM clientX/clientY).
   * Use these — never `world`/`snapped` — to position DOM overlays such as
   * popovers or inline editors that live outside the canvas coordinate space.
   */
  client: { x: number; y: number };
  /** Pointer button (0 = primary/left). */
  button: number;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Handler surface that `ToolInputBinding` dispatches to. Only the primary
 * (left) button reaches these; middle/right is reserved for native pan.
 */
export interface PointerInputHandlers {
  onPointerDown?(input: CanvasPointerInput): void;
  onPointerMove?(input: CanvasPointerInput): void;
  onPointerUp?(input: CanvasPointerInput): void;
}

/**
 * The target tool interface the engine is organized around. Editors are
 * migrating toward implementing this directly; until then they adapt their
 * existing tool model behind `PointerInputHandlers`.
 */
export interface CanvasTool {
  onPointerDown(input: CanvasPointerInput): void;
  onPointerMove(input: CanvasPointerInput): void;
  onPointerUp(input: CanvasPointerInput): void;
  /** Cancel any in-progress operation (e.g. on tool switch or Escape). */
  cancel?(): void;
  /**
   * Whether the tool is mid multi-step operation (e.g. polyline placement), so
   * the host can keep a preview alive between clicks.
   */
  isDrawing?(): boolean;
}
