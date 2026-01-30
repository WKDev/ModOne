/**
 * Layout Configuration Types
 *
 * Types for serializing and persisting layout configurations,
 * including panels, grid arrangement, and sidebar state.
 */

import type { PanelType, GridConfig } from './panel';
import type { SidebarPanel } from '../stores/sidebarStore';
import type { Bounds } from './window';

/**
 * Configuration for a single tab within a panel (serialized form)
 */
export interface TabLayoutConfig {
  /** Type of panel content this tab displays */
  type: PanelType;
  /** Display title for the tab */
  title: string;
}

/**
 * Configuration for a single panel (serialized form)
 */
export interface PanelLayoutConfig {
  /** Unique identifier for the panel */
  id: string;
  /** Type of panel content */
  type: PanelType;
  /** CSS grid-area value, e.g., '1 / 1 / 2 / 2' */
  gridArea: string;
  /** Optional array of tabs within this panel */
  tabs?: TabLayoutConfig[];
  /** ID of the active tab (if tabs exist) */
  activeTabId?: string;
}

/**
 * Configuration for a floating window (serialized form)
 */
export interface FloatingWindowLayoutConfig {
  /** ID of the panel in the floating window */
  panelId: string;
  /** Type of panel content */
  panelType: PanelType;
  /** Window position and size */
  bounds: Bounds;
  /** Window title (optional, defaults to panel title) */
  title?: string;
}

/**
 * Configuration for sidebar state
 */
export interface SidebarLayoutConfig {
  /** Whether sidebar is visible */
  visible: boolean;
  /** Sidebar width in pixels */
  width: number;
  /** Currently active sidebar panel */
  activePanel: SidebarPanel;
}

/**
 * Configuration for editor area (VSCode-style layout)
 */
export interface EditorAreaLayoutConfig {
  /** Array of tabs in the editor area */
  tabs: TabLayoutConfig[];
  /** ID of the active tab */
  activeTabId?: string;
}

/**
 * Configuration for tool panel (VSCode-style layout)
 */
export interface ToolPanelLayoutConfig {
  /** Whether the tool panel is visible */
  isVisible: boolean;
  /** Height of the tool panel in pixels */
  height: number;
  /** Array of tool tabs */
  tabs: TabLayoutConfig[];
  /** ID of the active tab */
  activeTabId?: string;
}

/**
 * Complete layout configuration for save/restore
 * Supports both legacy grid layout and VSCode-style layout
 */
export interface LayoutConfig {
  /** Name of the layout preset */
  name: string;
  /** Grid configuration (columns and rows) - legacy */
  grid: GridConfig;
  /** Array of panel configurations - legacy */
  panels: PanelLayoutConfig[];
  /** Sidebar configuration */
  sidebar: SidebarLayoutConfig;
  /** Array of floating window configurations */
  floatingWindows?: FloatingWindowLayoutConfig[];
  /** Whether this is a built-in preset (cannot be deleted) */
  isBuiltIn?: boolean;
  /** Optional description of the layout */
  description?: string;
  /** Creation timestamp (ISO string) */
  createdAt?: string;
  /** Last modified timestamp (ISO string) */
  updatedAt?: string;
  /** Editor area configuration (VSCode-style) */
  editorArea?: EditorAreaLayoutConfig;
  /** Tool panel configuration (VSCode-style) */
  toolPanel?: ToolPanelLayoutConfig;
}

/**
 * Layout preset metadata (for listing without full config)
 */
export interface LayoutPresetInfo {
  /** Name of the layout preset */
  name: string;
  /** Whether this is a built-in preset */
  isBuiltIn: boolean;
  /** Optional description */
  description?: string;
  /** Last modified timestamp */
  updatedAt?: string;
}

/**
 * Result of layout operations
 */
export interface LayoutOperationResult {
  success: boolean;
  error?: string;
}

/**
 * Layout storage format (for persisting multiple layouts)
 */
export interface LayoutStorage {
  /** Version of the layout storage format */
  version: string;
  /** Array of saved layout configurations */
  layouts: LayoutConfig[];
  /** Name of the last active layout */
  lastActiveLayout?: string;
  /** Whether to restore last session on startup */
  restoreLastSession?: boolean;
}

/**
 * Default layout storage version
 */
export const LAYOUT_STORAGE_VERSION = '1.0';

/**
 * Special layout names
 */
export const SPECIAL_LAYOUT_NAMES = {
  /** Auto-saved layout on app close */
  LAST_SESSION: '_lastSession',
} as const;

/**
 * Built-in layout preset names
 */
export const BUILT_IN_LAYOUT_NAMES = {
  DEFAULT: 'Default',
  COMPACT: 'Compact',
  DEBUG: 'Debug',
  MEMORY_FOCUS: 'Memory Focus',
} as const;

/**
 * Type guard to check if a layout is built-in
 */
export function isBuiltInLayout(name: string): boolean {
  return Object.values(BUILT_IN_LAYOUT_NAMES).includes(name as typeof BUILT_IN_LAYOUT_NAMES[keyof typeof BUILT_IN_LAYOUT_NAMES]);
}

/**
 * Type guard to check if a layout name is reserved
 */
export function isReservedLayoutName(name: string): boolean {
  return name.startsWith('_') || isBuiltInLayout(name);
}
