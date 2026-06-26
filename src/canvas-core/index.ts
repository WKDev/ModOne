/**
 * CanvasEditorCore — the shared, domain-agnostic canvas editor engine.
 *
 * These modules were proven generic in the OneCanvas (schematic) editor and are
 * the foundation that the Symbol, Schematic and Sheet editors all build on, so
 * they share one rendering/interaction/coordinate stack (consistent pan/zoom/
 * grid/snap/selection/cursor across every editor).
 *
 * Phase 0: this barrel re-exports the modules from their current OneCanvas
 * location to establish a stable import surface (`@/canvas-core`). The files
 * will physically move here in a later step; importers should target this
 * barrel, not the OneCanvas paths.
 *
 * Domain-specific pieces (Block/Wire/Port/Junction renderers, the schematic
 * InteractionController, SpatialIndex/HitTester which still reference the
 * schematic model) intentionally stay out of the core until they are
 * generalized behind a `HitTestable` / `Tool` abstraction.
 */

// --- Application + viewport + coordinates ---
export { PixiApplication, type PixiApplicationOptions } from '../components/OneCanvas/core/PixiApplication';
export { PixiViewport, type PixiViewportOptions } from '../components/OneCanvas/core/PixiViewport';
export { CoordinateSystem } from '../components/OneCanvas/core/CoordinateSystem';
export { LayerManager } from '../components/OneCanvas/core/LayerManager';

// --- Generic renderers (no domain model) ---
export { GridRenderer, type GridRendererOptions } from '../components/OneCanvas/renderers/GridRenderer';
export {
  SelectionRenderer,
  type SelectionStyle,
  type SelectionRendererOptions,
} from '../components/OneCanvas/renderers/SelectionRenderer';
export {
  PageGuideRenderer,
  type PageGuideRendererConfig,
} from '../components/OneCanvas/renderers/PageGuideRenderer';

// --- Input pipeline ---
// The unified tool/input contract — the first module that physically lives in
// canvas-core (not a re-export). Editors drive interactions through this.
export type { CanvasPointerInput, PointerInputHandlers } from './input/Tool';
export { ToolInputBinding, type ToolInputBindingOptions } from './input/ToolInputBinding';
export { normalizePointer } from './input/normalizePointer';
export { isEditableTarget } from './input/isEditableTarget';

export { EventBridge, type EventBridgeOptions } from '../components/OneCanvas/interaction/EventBridge';
export {
  KeyboardShortcuts,
  type ShortcutCallbacks,
  type KeyboardShortcutsOptions,
} from '../components/OneCanvas/interaction/KeyboardShortcuts';

// --- Units (mm-based world; the canonical coordinate scale) ---
export {
  GRID_MODULE_MM,
  GRID_VERSION,
  SCREEN_PX_PER_MM,
  SYMBOL_PX_TO_MM,
  ensureRuntimeGridUnit,
} from '../components/OneCanvas/canvasUnits';
