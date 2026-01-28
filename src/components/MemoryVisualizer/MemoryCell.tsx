/**
 * Memory Cell Component
 *
 * Displays and handles interaction for individual memory cells.
 * Supports both boolean (coil/discrete) and numeric (register) types.
 */

import { memo } from 'react';
import type { DisplayFormat } from './types';
import { formatValue } from './utils/formatters';

// ============================================================================
// Types
// ============================================================================

interface MemoryCellProps {
  /** Memory address for this cell */
  address: number;
  /** Cell value (boolean for coils/discrete, number for registers) */
  value: boolean | number;
  /** Whether this is a boolean type (coil/discrete) or register type */
  isBooleanType: boolean;
  /** Display format for register values */
  displayFormat: DisplayFormat;
  /** Whether the cell is read-only (discrete/input registers) */
  isReadOnly: boolean;
  /** Whether this cell is currently selected */
  isSelected?: boolean;
  /** Click handler for editing */
  onClick: () => void;
  /** Context menu handler */
  onContextMenu: (e: React.MouseEvent) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Individual memory cell component with optimized rendering.
 * Uses memo to prevent unnecessary re-renders.
 */
export const MemoryCell = memo(function MemoryCell({
  address,
  value,
  isBooleanType,
  displayFormat,
  isReadOnly,
  isSelected = false,
  onClick,
  onContextMenu,
}: MemoryCellProps) {
  // Coil or Discrete Input - Boolean display
  if (isBooleanType) {
    const boolValue = value as boolean;

    return (
      <button
        type="button"
        className={`
          w-full h-8 flex items-center justify-center
          text-sm font-medium transition-colors
          ${boolValue
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
          }
          ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
          ${isReadOnly ? 'cursor-default opacity-80' : 'cursor-pointer'}
        `}
        onClick={!isReadOnly ? onClick : undefined}
        onContextMenu={onContextMenu}
        disabled={isReadOnly}
        title={`Address: ${address}\nValue: ${boolValue ? 'ON (1)' : 'OFF (0)'}`}
      >
        {boolValue ? '1' : '0'}
      </button>
    );
  }

  // Register - Numeric display
  const numValue = value as number;
  const displayValue = formatValue(numValue, displayFormat);

  return (
    <button
      type="button"
      className={`
        w-full h-8 px-1 flex items-center justify-center
        text-xs font-mono truncate transition-colors
        bg-neutral-800 hover:bg-neutral-700 text-neutral-200
        ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
        ${isReadOnly ? 'cursor-default opacity-80' : 'cursor-pointer'}
      `}
      onClick={!isReadOnly ? onClick : undefined}
      onContextMenu={onContextMenu}
      title={`Address: ${address}\nDEC: ${numValue}\nHEX: 0x${numValue.toString(16).toUpperCase().padStart(4, '0')}`}
    >
      {displayValue}
    </button>
  );
});

export default MemoryCell;
