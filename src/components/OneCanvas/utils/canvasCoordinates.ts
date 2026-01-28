/**
 * Canvas Coordinate Utilities
 *
 * Functions for converting between screen and canvas coordinates,
 * and for snapping positions to grid.
 */

import type { Position } from '../types';

// ============================================================================
// Coordinate Transformations
// ============================================================================

/**
 * Convert screen coordinates to canvas coordinates
 *
 * @param screenPos - Position in screen/viewport space
 * @param pan - Current pan offset
 * @param zoom - Current zoom level
 * @returns Position in canvas space
 */
export function screenToCanvas(
  screenPos: Position,
  pan: Position,
  zoom: number
): Position {
  return {
    x: (screenPos.x - pan.x) / zoom,
    y: (screenPos.y - pan.y) / zoom,
  };
}

/**
 * Convert canvas coordinates to screen coordinates
 *
 * @param canvasPos - Position in canvas space
 * @param pan - Current pan offset
 * @param zoom - Current zoom level
 * @returns Position in screen/viewport space
 */
export function canvasToScreen(
  canvasPos: Position,
  pan: Position,
  zoom: number
): Position {
  return {
    x: canvasPos.x * zoom + pan.x,
    y: canvasPos.y * zoom + pan.y,
  };
}

/**
 * Snap a position to the nearest grid point
 *
 * @param position - Position to snap
 * @param gridSize - Grid cell size in pixels
 * @returns Snapped position
 */
export function snapToGrid(position: Position, gridSize: number): Position {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate the new pan needed to zoom towards a specific point
 *
 * @param currentPan - Current pan offset
 * @param currentZoom - Current zoom level
 * @param newZoom - New zoom level
 * @param pivotScreen - Point in screen coordinates to zoom towards
 * @returns New pan offset
 */
export function calculateZoomPan(
  currentPan: Position,
  currentZoom: number,
  newZoom: number,
  pivotScreen: Position
): Position {
  // Get the canvas point under the cursor before zoom
  const canvasPoint = screenToCanvas(pivotScreen, currentPan, currentZoom);

  // Calculate where this point would be on screen after zoom change
  const newScreenX = canvasPoint.x * newZoom + currentPan.x;
  const newScreenY = canvasPoint.y * newZoom + currentPan.y;

  // Adjust pan to keep the canvas point under the cursor
  return {
    x: currentPan.x - (newScreenX - pivotScreen.x),
    y: currentPan.y - (newScreenY - pivotScreen.y),
  };
}

/**
 * Get mouse position relative to an element
 */
export function getRelativeMousePosition(
  event: MouseEvent | React.MouseEvent,
  element: HTMLElement
): Position {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Position, p2: Position): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the center point between two positions
 */
export function midpoint(p1: Position, p2: Position): Position {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}
