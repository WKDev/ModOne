/**
 * SymbolEditor Types — Pixi.js Rendering Layer
 *
 * Defines the type system for the Symbol Editor's Pixi.js rendering:
 * - GhostShape: Data-only description of tool preview shapes (replaces React.ReactNode)
 * - SymbolEditorLayerName / SYMBOL_EDITOR_LAYERS: Layer configuration
 * - SymbolEditorHostHandle: Imperative API for the host component
 */

import type { ViewportState } from '@components/OneCanvas/types';

// ============================================================================
// Ghost Shape (Tool Preview Data Objects)
// ============================================================================

/** Rectangle ghost (used by RectTool, SelectTool marquee) */
export interface GhostRect {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Circle ghost (used by CircleTool) */
export interface GhostCircle {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
}

/** Line ghost (used by ArcTool step 1 radius guide) */
export interface GhostLine {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Arc ghost (used by ArcTool step 2) */
export interface GhostArc {
  kind: 'arc';
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
}

/** Polyline ghost (used by PolylineTool) */
export interface GhostPolyline {
  kind: 'polyline';
  points: Array<{ x: number; y: number }>;
}

/** Marquee selection ghost (used by SelectTool) */
export interface GhostMarquee {
  kind: 'marquee';
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pin drag ghost (used by SelectTool when dragging a pin) */
export interface GhostPin {
  kind: 'pin';
  x: number;
  y: number;
  orientation: 'right' | 'left' | 'up' | 'down';
  length: number;
}

/** Union of all ghost shapes — returned by tool.onMouseMove() */
export type GhostShape =
  | GhostRect
  | GhostCircle
  | GhostLine
  | GhostArc
  | GhostPolyline
  | GhostMarquee
  | GhostPin;

// ============================================================================
// Resize Handle
// ============================================================================

/**
 * Identifies one of the 8 edge/corner resize handles or the rotation handle.
 * Used by SelectTool when a resizable primitive (rect, circle, text) is selected.
 *
 * Layout:
 *   nw ── n ── ne
 *   │           │
 *   w           e
 *   │           │
 *   sw ── s ── se
 *
 *   rotate: appears above the top edge (above n), for future rotation support.
 */
export type ResizeHandleKind =
  | 'nw' | 'n' | 'ne'
  | 'w'          | 'e'
  | 'sw' | 's' | 'se'
  | 'rotate';

// ============================================================================
// Layer System
// ============================================================================

export type SymbolEditorLayerName =
  | 'grid'
  | 'primitives'
  | 'pins'
  | 'selection'
  | 'ghost'
  | 'overlay';

export interface SymbolEditorLayerConfig {
  name: SymbolEditorLayerName;
  zIndex: number;
  visible: boolean;
  interactive: boolean;
}

export const SYMBOL_EDITOR_LAYERS: readonly SymbolEditorLayerConfig[] = [
  { name: 'grid', zIndex: 0, visible: true, interactive: false },
  { name: 'primitives', zIndex: 10, visible: true, interactive: false },
  { name: 'pins', zIndex: 20, visible: true, interactive: false },
  { name: 'selection', zIndex: 30, visible: true, interactive: false },
  { name: 'ghost', zIndex: 40, visible: true, interactive: false },
  { name: 'overlay', zIndex: 50, visible: true, interactive: false },
] as const;

// ============================================================================
// Imperative Handle
// ============================================================================

export interface SymbolEditorHostHandle {
  /** Get the current viewport state */
  getViewportState(): ViewportState;

  /** Trigger a full re-render of primitives + pins */
  renderSymbol(): void;

  /** Update ghost preview from tool output */
  setGhostShape(shape: GhostShape | null): void;

  /** Update selection highlights */
  setSelection(selectedIds: Set<string>): void;
}
