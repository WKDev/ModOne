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
  x: number;
  y: number;
  width: number;
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
 * Window bounds for Tauri commands (matches Rust struct)
 */
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Options for creating a floating window
 */
export interface CreateFloatingWindowOptions {
  panelId: string;
  panelType: PanelType;
  bounds: Bounds;
  title?: string;
}

/**
 * Event payloads for window events
 */
export interface WindowCreatedEvent {
  windowId: string;
  panelId: string;
  bounds: Bounds;
}

export interface WindowClosedEvent {
  windowId: string;
}

export interface WindowMovedEvent {
  windowId: string;
  bounds: Bounds;
}

export interface WindowResizedEvent {
  windowId: string;
  bounds: Bounds;
}

export interface WindowFocusedEvent {
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
