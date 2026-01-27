/**
 * Built-in Layout Presets
 *
 * Pre-configured layout arrangements for common use cases.
 * These presets cannot be deleted or overwritten by users.
 */

import type { LayoutConfig } from '../types/layout';
import { BUILT_IN_LAYOUT_NAMES } from '../types/layout';

/**
 * Default Layout: 2x2 grid with main panels
 * - Top-left: Ladder Editor
 * - Top-right: Memory Visualizer
 * - Bottom-left: One Canvas
 * - Bottom-right: Console
 */
export const DEFAULT_LAYOUT: LayoutConfig = {
  name: BUILT_IN_LAYOUT_NAMES.DEFAULT,
  description: 'Standard 2x2 grid layout with all main panels',
  grid: {
    columns: ['1fr', '1fr'],
    rows: ['1fr', '1fr'],
  },
  panels: [
    {
      id: 'panel-ladder',
      type: 'ladder-editor',
      gridArea: '1 / 1 / 2 / 2',
    },
    {
      id: 'panel-memory',
      type: 'memory-visualizer',
      gridArea: '1 / 2 / 2 / 3',
    },
    {
      id: 'panel-canvas',
      type: 'one-canvas',
      gridArea: '2 / 1 / 3 / 2',
    },
    {
      id: 'panel-console',
      type: 'console',
      gridArea: '2 / 2 / 3 / 3',
    },
  ],
  sidebar: {
    visible: true,
    width: 250,
    activePanel: 'explorer',
  },
  isBuiltIn: true,
};

/**
 * Compact Layout: Single panel area with all panels as tabs
 * Useful for smaller screens or when focusing on one task at a time
 */
export const COMPACT_LAYOUT: LayoutConfig = {
  name: BUILT_IN_LAYOUT_NAMES.COMPACT,
  description: 'Single panel with all content as tabs',
  grid: {
    columns: ['1fr'],
    rows: ['1fr'],
  },
  panels: [
    {
      id: 'panel-main',
      type: 'ladder-editor',
      gridArea: '1 / 1 / 2 / 2',
      tabs: [
        { type: 'ladder-editor', title: 'Ladder Editor' },
        { type: 'memory-visualizer', title: 'Memory Visualizer' },
        { type: 'one-canvas', title: 'One Canvas' },
        { type: 'console', title: 'Console' },
      ],
      activeTabId: 'tab-1',
    },
  ],
  sidebar: {
    visible: true,
    width: 250,
    activePanel: 'explorer',
  },
  isBuiltIn: true,
};

/**
 * Debug Layout: 2-row split with main panels on top and console expanded at bottom
 * Useful for debugging with more console output visibility
 */
export const DEBUG_LAYOUT: LayoutConfig = {
  name: BUILT_IN_LAYOUT_NAMES.DEBUG,
  description: 'Two-row layout with expanded console at bottom (70/30 split)',
  grid: {
    columns: ['1fr', '1fr'],
    rows: ['70fr', '30fr'],
  },
  panels: [
    {
      id: 'panel-ladder',
      type: 'ladder-editor',
      gridArea: '1 / 1 / 2 / 2',
    },
    {
      id: 'panel-memory',
      type: 'memory-visualizer',
      gridArea: '1 / 2 / 2 / 3',
    },
    {
      id: 'panel-console',
      type: 'console',
      gridArea: '2 / 1 / 3 / 3', // Spans both columns
    },
  ],
  sidebar: {
    visible: true,
    width: 250,
    activePanel: 'explorer',
  },
  isBuiltIn: true,
};

/**
 * Memory Focus Layout: Large Memory Visualizer with Properties panel
 * Useful for monitoring and editing memory values
 */
export const MEMORY_FOCUS_LAYOUT: LayoutConfig = {
  name: BUILT_IN_LAYOUT_NAMES.MEMORY_FOCUS,
  description: 'Large memory visualizer (80%) with properties panel',
  grid: {
    columns: ['80fr', '20fr'],
    rows: ['1fr'],
  },
  panels: [
    {
      id: 'panel-memory',
      type: 'memory-visualizer',
      gridArea: '1 / 1 / 2 / 2',
    },
    {
      id: 'panel-properties',
      type: 'properties',
      gridArea: '1 / 2 / 2 / 3',
    },
  ],
  sidebar: {
    visible: true,
    width: 200,
    activePanel: 'modbus',
  },
  isBuiltIn: true,
};

/**
 * Array of all built-in layout presets
 */
export const BUILT_IN_LAYOUTS: LayoutConfig[] = [
  DEFAULT_LAYOUT,
  COMPACT_LAYOUT,
  DEBUG_LAYOUT,
  MEMORY_FOCUS_LAYOUT,
];

/**
 * Get a built-in preset by name
 * @param name - The preset name
 * @returns The preset configuration or undefined if not found
 */
export function getPresetByName(name: string): LayoutConfig | undefined {
  return BUILT_IN_LAYOUTS.find((layout) => layout.name === name);
}

/**
 * Check if a layout name is a built-in preset
 * @param name - The layout name to check
 * @returns True if the name is a built-in preset
 */
export function isBuiltInPreset(name: string): boolean {
  return BUILT_IN_LAYOUTS.some((layout) => layout.name === name);
}

/**
 * Get the default layout preset
 * @returns The default layout configuration
 */
export function getDefaultLayout(): LayoutConfig {
  return DEFAULT_LAYOUT;
}
