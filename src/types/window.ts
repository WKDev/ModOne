/**
 * Floating Window Types
 *
 * Types for managing floating windows that can be detached from the main window.
 */

import type { PanelType } from './panel';

/**
 * Window bounds (position and size)
 */
export interface Bounds {
  /** X position in screen coordinates */
  x: number;
  /** Y position in screen coordinates */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * State of a floating window
 */
export interface FloatingWindowState {
  /** Unique window identifier (Tauri window label) */
  windowId: string;
  /** ID of the panel displayed in this window */
  panelId: string;
  /** Window position and size */
  bounds: Bounds;
  /** Whether the window is minimized */
  isMinimized: boolean;
  /** Whether the window is maximized */
  isMaximized: boolean;
  /** Z-index for stacking order */
  zIndex: number;
}

/**
 * Information about a floating window (from Tauri backend)
 */
export interface FloatingWindowInfo {
  /** Unique window identifier */
  windowId: string;
  /** ID of the panel displayed in this window */
  panelId: string;
  /** Window position and size */
  bounds: Bounds;
}

/**
 * Registry state for tracking all floating windows.
 * Used by windowStore and components that need to track floating window state.
 */
export interface WindowRegistryState {
  /** Map of window ID to floating window state */
  floatingWindows: Map<string, FloatingWindowState>;
  /** Currently focused floating window ID */
  focusedWindowId: string | null;
}

/**
 * Window bounds for Tauri commands (matches Rust struct)
 */
export interface WindowBounds {
  /** X position in screen coordinates */
  x: number;
  /** Y position in screen coordinates */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * Options for creating a floating window
 */
export interface CreateFloatingWindowOptions {
  /** ID of the panel to display in the window */
  panelId: string;
  /** Type of panel content */
  panelType: PanelType;
  /** Initial window position and size */
  bounds: Bounds;
  /** Window title (defaults to panel title if not specified) */
  title?: string;
}

/**
 * Event payload when a floating window is created
 */
export interface WindowCreatedEvent {
  /** ID of the created window */
  windowId: string;
  /** ID of the panel in the window */
  panelId: string;
  /** Initial window bounds */
  bounds: Bounds;
}

/**
 * Event payload when a floating window is closed
 */
export interface WindowClosedEvent {
  /** ID of the closed window */
  windowId: string;
}

/**
 * Event payload when a floating window is moved
 */
export interface WindowMovedEvent {
  /** ID of the moved window */
  windowId: string;
  /** New window bounds after move */
  bounds: Bounds;
}

/**
 * Event payload when a floating window is resized
 */
export interface WindowResizedEvent {
  /** ID of the resized window */
  windowId: string;
  /** New window bounds after resize */
  bounds: Bounds;
}

/**
 * Event payload when a floating window receives focus
 */
export interface WindowFocusedEvent {
  /** ID of the focused window */
  windowId: string;
}

/**
 * Default floating window dimensions
 */
export const DEFAULT_FLOATING_WINDOW_SIZE = {
  width: 600,
  height: 400,
} as const;

/**
 * Minimum floating window dimensions
 */
export const MIN_FLOATING_WINDOW_SIZE = {
  width: 300,
  height: 200,
} as const;

/**
 * Offset for cascading new floating windows
 */
export const FLOATING_WINDOW_CASCADE_OFFSET = 30;
