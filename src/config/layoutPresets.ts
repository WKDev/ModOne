/**
 * Built-in Layout Presets
 *
 * Pre-configured layout arrangements for common use cases.
 * These presets cannot be deleted or overwritten by users.
 *
 * NOTE: Using VSCode-style layout with EditorArea and ToolPanel
 */

import type { LayoutConfig } from '../types/layout';
import { BUILT_IN_LAYOUT_NAMES } from '../types/layout';

/**
 * Default Layout: VSCode-style with editor area and tool panel
 * - Editor area: Empty (files open as tabs)
 * - Tool panel: Console, Memory Visualizer, Properties
 */
export const DEFAULT_LAYOUT: LayoutConfig = {
  name: BUILT_IN_LAYOUT_NAMES.DEFAULT,
  description: 'VSCode-style layout with editor tabs and bottom tool panel',
  // Legacy grid config (kept for backwards compatibility)
  grid: {
    columns: ['1fr'],
    rows: ['1fr'],
  },
  panels: [],
  sidebar: {
    visible: true,
    width: 250,
    activePanel: 'explorer',
  },
  // VSCode-style layout
  editorArea: {
    tabs: [],
    activeTabId: undefined,
  },
  toolPanel: {
    isVisible: true,
    height: 200,
    tabs: [
      { type: 'console', title: 'Console' },
      { type: 'memory-visualizer', title: 'Memory Visualizer' },
      { type: 'properties', title: 'Properties' },
    ],
    activeTabId: undefined,
  },
  isBuiltIn: true,
};

/**
 * Compact Layout: VSCode-style with hidden tool panel
 * Useful for smaller screens or when focusing on one task at a time
 */
export const COMPACT_LAYOUT: LayoutConfig = {
  name: BUILT_IN_LAYOUT_NAMES.COMPACT,
  description: 'Maximized editor area with collapsed tool panel',
  grid: {
    columns: ['1fr'],
    rows: ['1fr'],
  },
  panels: [],
  sidebar: {
    visible: true,
    width: 200,
    activePanel: 'explorer',
  },
  editorArea: {
    tabs: [],
    activeTabId: undefined,
  },
  toolPanel: {
    isVisible: false,
    height: 150,
    tabs: [
      { type: 'console', title: 'Console' },
      { type: 'properties', title: 'Properties' },
    ],
    activeTabId: undefined,
  },
  isBuiltIn: true,
};

/**
 * Debug Layout: VSCode-style with expanded console
 * Useful for debugging with more console output visibility
 */
export const DEBUG_LAYOUT: LayoutConfig = {
  name: BUILT_IN_LAYOUT_NAMES.DEBUG,
  description: 'Expanded tool panel (40% height) for debugging',
  grid: {
    columns: ['1fr'],
    rows: ['1fr'],
  },
  panels: [],
  sidebar: {
    visible: true,
    width: 250,
    activePanel: 'explorer',
  },
  editorArea: {
    tabs: [],
    activeTabId: undefined,
  },
  toolPanel: {
    isVisible: true,
    height: 350,
    tabs: [
      { type: 'console', title: 'Console' },
      { type: 'memory-visualizer', title: 'Memory Visualizer' },
      { type: 'properties', title: 'Properties' },
    ],
    activeTabId: undefined,
  },
  isBuiltIn: true,
};

/**
 * Memory Focus Layout: Memory Visualizer focused tool panel
 * Useful for monitoring and editing memory values
 */
export const MEMORY_FOCUS_LAYOUT: LayoutConfig = {
  name: BUILT_IN_LAYOUT_NAMES.MEMORY_FOCUS,
  description: 'Large tool panel with Memory Visualizer active',
  grid: {
    columns: ['1fr'],
    rows: ['1fr'],
  },
  panels: [],
  sidebar: {
    visible: true,
    width: 200,
    activePanel: 'modbus',
  },
  editorArea: {
    tabs: [],
    activeTabId: undefined,
  },
  toolPanel: {
    isVisible: true,
    height: 400,
    tabs: [
      { type: 'memory-visualizer', title: 'Memory Visualizer' },
      { type: 'console', title: 'Console' },
      { type: 'properties', title: 'Properties' },
    ],
    activeTabId: undefined, // Will default to first tab (Memory Visualizer)
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
