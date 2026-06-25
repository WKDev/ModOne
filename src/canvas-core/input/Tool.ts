/**
 * The domain-agnostic pointer-input contract for the shared canvas engine.
 *
 * `ToolInputBinding` is the single source that converts PIXI federated events into
 * one normalized `CanvasPointerInput` and dispatches it to an editor's
 * `PointerInputHandlers`, so every editor shares one coordinate/snap/pan pipeline.
 * Editor-specific state (selection, the document model, undo, ghost previews) and
 * the editor's own tool objects stay in the editor.
 */

/**
 * A pointer event normalized into the canvas's coordinate spaces. This is the
 * canonical event produced by the shared `normalizePointer` primitive and is rich
 * enough to serve every editor: a tool model reads `snapped`/`client`, while an
 * FSM-style controller reads `world`/`screen` and the full modifier set.
 */
export interface CanvasPointerInput {
  /** Unsnapped world coordinates (viewport.toWorld of the canvas-relative point). */
  world: { x: number; y: number };
  /** World coordinates snapped to the active grid (equals `world` when snap is off). */
  snapped: { x: number; y: number };
  /**
   * Canvas-relative screen pixels (the PIXI federated `global` point). Use for
   * screen-space hit-testing inside the canvas.
   */
  screen: { x: number; y: number };
  /**
   * Window-relative client coordinates (the underlying DOM clientX/clientY).
   * Use these — never `world`/`snapped`/`screen` — to position DOM overlays such
   * as popovers or inline editors that live outside the canvas coordinate space.
   */
  client: { x: number; y: number };
  /** Pointer button (0 = primary/left). */
  button: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
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
