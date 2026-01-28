/**
 * Memory Visualizer Type Definitions
 *
 * Types for Memory Visualizer configuration, view settings, favorites,
 * and component state management.
 */

import type { MemoryType } from '../../types/modbus';

// ============================================================================
// Display Formats
// ============================================================================

/** Display format for register values */
export type DisplayFormat = 'DEC' | 'HEX' | 'BINARY' | 'SIGNED' | 'FLOAT32';

// ============================================================================
// View Configuration
// ============================================================================

/** View configuration for memory table */
export interface MemoryViewConfig {
  /** Type of memory to display */
  memoryType: MemoryType;
  /** Starting address (0-65535) */
  startAddress: number;
  /** Number of addresses to display */
  count: number;
  /** Number of columns in the table (1-16) */
  columns: number;
  /** Display format for values */
  displayFormat: DisplayFormat;
}

/** Default view configuration */
export const DEFAULT_VIEW_CONFIG: MemoryViewConfig = {
  memoryType: 'holding',
  startAddress: 0,
  count: 100,
  columns: 10,
  displayFormat: 'DEC',
};

// ============================================================================
// Favorites
// ============================================================================

/** A favorite memory address for quick access */
export interface FavoriteItem {
  /** Unique identifier */
  id: string;
  /** Type of memory */
  memoryType: MemoryType;
  /** Memory address */
  address: number;
  /** User-defined label */
  label: string;
  /** Optional color (hex color code, e.g., "#FF5733") */
  color?: string;
  /** Display format for this favorite */
  displayFormat: DisplayFormat;
}

// ============================================================================
// UI State
// ============================================================================

/** Position for context menus */
export interface ContextMenuPosition {
  /** X coordinate in pixels */
  x: number;
  /** Y coordinate in pixels */
  y: number;
}

/** Context menu types */
export type ContextMenuType = 'cell' | 'favorite' | null;

/** Context menu state */
export interface ContextMenuState {
  /** Whether the menu is open */
  isOpen: boolean;
  /** Menu position */
  position: ContextMenuPosition;
  /** Type of context menu */
  type: ContextMenuType;
  /** Target data (address for cell, favorite id for favorite) */
  target: CellSelection | FavoriteItem | null;
}

/** Selected cell state */
export interface CellSelection {
  /** Type of memory */
  memoryType: MemoryType;
  /** Cell address */
  address: number;
  /** Current value (boolean for coils/discrete, number for registers) */
  value: boolean | number;
}

// ============================================================================
// Number Input
// ============================================================================

/** Input mode for number entry */
export type NumberInputMode = 'DEC' | 'HEX';

/** State for number input popover */
export interface NumberInputState {
  /** Whether the popover is open */
  isOpen: boolean;
  /** Target cell */
  target: CellSelection | null;
  /** Current input value (string for editing) */
  inputValue: string;
  /** Current input mode */
  inputMode: NumberInputMode;
}

// ============================================================================
// Memory Data
// ============================================================================

/** Memory data for a range of addresses */
export interface MemoryData {
  /** Type of memory */
  memoryType: MemoryType;
  /** Starting address */
  startAddress: number;
  /** Values array (boolean[] for coils/discrete, number[] for registers) */
  values: boolean[] | number[];
}

/** Memory cell data for rendering */
export interface MemoryCellData {
  /** Address of this cell */
  address: number;
  /** Current value */
  value: boolean | number;
  /** Whether this cell is selected */
  isSelected: boolean;
  /** Whether this cell is being edited */
  isEditing: boolean;
  /** Whether this cell is a favorite */
  isFavorite: boolean;
}
