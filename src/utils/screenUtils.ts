/**
 * Screen Utilities
 *
 * Utilities for multi-monitor support and screen boundary detection.
 * Used for ensuring floating windows are always visible on at least one screen.
 */

import { availableMonitors } from '@tauri-apps/api/window';
import type { Bounds } from '../types/window';

// ============================================================================
// Constants
// ============================================================================

/** Minimum visible area required (pixels) */
const MIN_VISIBLE_AREA = 50;

/** Margin from screen edge when repositioning */
const SCREEN_MARGIN = 100;

// ============================================================================
// Screen Bounds Functions
// ============================================================================

/**
 * Get bounds for all available monitors.
 *
 * @returns Array of screen bounds, empty array if unavailable
 */
export async function getAvailableScreenBounds(): Promise<Bounds[]> {
  try {
    const monitors = await availableMonitors();
    return monitors.map((m) => ({
      x: m.position.x,
      y: m.position.y,
      width: m.size.width,
      height: m.size.height,
    }));
  } catch (error) {
    // Tauri API unavailable (e.g., running in browser)
    console.debug('Failed to get available monitors:', error);
    return [];
  }
}

/**
 * Check if a point is within any available screen bounds.
 *
 * @param x - X coordinate in screen space
 * @param y - Y coordinate in screen space
 * @returns True if point is on any screen
 */
export async function isPositionOnScreen(
  x: number,
  y: number
): Promise<boolean> {
  const screens = await getAvailableScreenBounds();

  if (screens.length === 0) {
    // No screen info available, assume position is valid
    return true;
  }

  return screens.some(
    (screen) =>
      x >= screen.x &&
      x < screen.x + screen.width &&
      y >= screen.y &&
      y < screen.y + screen.height
  );
}

/**
 * Check if window has minimum visible area on any screen.
 *
 * @param windowBounds - Window bounds to check
 * @param screens - Available screen bounds
 * @param minArea - Minimum visible width/height in pixels
 * @returns True if window has sufficient visible area
 */
function hasMinimumVisibility(
  windowBounds: Bounds,
  screens: Bounds[],
  minArea: number = MIN_VISIBLE_AREA
): boolean {
  return screens.some((screen) => {
    // Calculate intersection dimensions
    const left = Math.max(windowBounds.x, screen.x);
    const top = Math.max(windowBounds.y, screen.y);
    const right = Math.min(
      windowBounds.x + windowBounds.width,
      screen.x + screen.width
    );
    const bottom = Math.min(
      windowBounds.y + windowBounds.height,
      screen.y + screen.height
    );

    const visibleWidth = right - left;
    const visibleHeight = bottom - top;

    // Require minimum visible dimensions (not just area)
    return visibleWidth >= minArea && visibleHeight >= minArea;
  });
}

/**
 * Correct window position to ensure it's visible on at least one screen.
 *
 * If the window is not sufficiently visible on any screen (less than 50x50 pixels),
 * it will be moved to the primary screen with appropriate margins.
 *
 * @param bounds - Original window bounds
 * @returns Corrected bounds (may be unchanged if already visible)
 */
export async function correctWindowPosition(bounds: Bounds): Promise<Bounds> {
  const screens = await getAvailableScreenBounds();

  // No screen info available, return original bounds
  if (screens.length === 0) {
    return bounds;
  }

  // Check if window has minimum visibility
  if (hasMinimumVisibility(bounds, screens)) {
    return bounds;
  }

  // Window is not visible enough, move to primary screen
  const primary = screens[0];

  // Calculate new position with margin from top-left
  const newX = primary.x + SCREEN_MARGIN;
  const newY = primary.y + SCREEN_MARGIN;

  // Constrain dimensions to fit within screen (with margin on both sides)
  const maxWidth = primary.width - SCREEN_MARGIN * 2;
  const maxHeight = primary.height - SCREEN_MARGIN * 2;
  const newWidth = Math.min(bounds.width, maxWidth);
  const newHeight = Math.min(bounds.height, maxHeight);

  console.debug(
    `Correcting window position from (${bounds.x}, ${bounds.y}) to (${newX}, ${newY})`
  );

  return {
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
  };
}

/**
 * Find the best screen to place a window based on desired position.
 *
 * @param x - Desired X position
 * @param y - Desired Y position
 * @returns Screen bounds for the best matching screen, or primary screen
 */
export async function findBestScreen(x: number, y: number): Promise<Bounds> {
  const screens = await getAvailableScreenBounds();

  if (screens.length === 0) {
    // Return a reasonable default if no screen info
    return { x: 0, y: 0, width: 1920, height: 1080 };
  }

  // Find screen containing the point
  const containingScreen = screens.find(
    (screen) =>
      x >= screen.x &&
      x < screen.x + screen.width &&
      y >= screen.y &&
      y < screen.y + screen.height
  );

  if (containingScreen) {
    return containingScreen;
  }

  // Point is not on any screen, find nearest screen
  let nearestScreen = screens[0];
  let nearestDistance = Infinity;

  for (const screen of screens) {
    // Calculate distance to screen center
    const screenCenterX = screen.x + screen.width / 2;
    const screenCenterY = screen.y + screen.height / 2;
    const distance = Math.sqrt(
      Math.pow(x - screenCenterX, 2) + Math.pow(y - screenCenterY, 2)
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestScreen = screen;
    }
  }

  return nearestScreen;
}
