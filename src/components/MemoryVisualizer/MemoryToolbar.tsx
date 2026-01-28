/**
 * Memory Toolbar Component
 *
 * Toolbar for configuring memory table view settings.
 */

import { RefreshCw } from 'lucide-react';
import type { MemoryType } from '../../types/modbus';
import type { DisplayFormat, MemoryViewConfig } from './types';

// ============================================================================
// Types
// ============================================================================

interface MemoryToolbarProps {
  /** Current view configuration */
  config: MemoryViewConfig;
  /** Callback when configuration changes */
  onConfigChange: (config: Partial<MemoryViewConfig>) => void;
  /** Callback to refresh data */
  onRefresh: () => void;
  /** Whether data is currently loading */
  isLoading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const MEMORY_TYPE_OPTIONS: { value: MemoryType; label: string }[] = [
  { value: 'coil', label: 'Coils (0x)' },
  { value: 'discrete', label: 'Discrete Inputs (1x)' },
  { value: 'input', label: 'Input Registers (3x)' },
  { value: 'holding', label: 'Holding Registers (4x)' },
];

const COLUMN_OPTIONS = [1, 2, 4, 8, 10, 16];

const FORMAT_OPTIONS: DisplayFormat[] = ['DEC', 'HEX', 'BINARY', 'SIGNED'];

// ============================================================================
// Component
// ============================================================================

/**
 * Toolbar for configuring memory visualizer view settings.
 */
export function MemoryToolbar({
  config,
  onConfigChange,
  onRefresh,
  isLoading,
}: MemoryToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-neutral-700 bg-neutral-800 p-2">
      {/* Memory Type Selector */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-neutral-400">Type:</label>
        <select
          value={config.memoryType}
          onChange={(e) =>
            onConfigChange({ memoryType: e.target.value as MemoryType })
          }
          className="rounded border border-neutral-600 bg-neutral-700 px-2 py-1 text-sm text-white"
        >
          {MEMORY_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Start Address Input */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-neutral-400">Start:</label>
        <input
          type="number"
          min={0}
          max={65535}
          value={config.startAddress}
          onChange={(e) =>
            onConfigChange({
              startAddress: Math.max(0, parseInt(e.target.value) || 0),
            })
          }
          className="w-20 rounded border border-neutral-600 bg-neutral-700 px-2 py-1 text-sm text-white"
        />
      </div>

      {/* Count Input */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-neutral-400">Count:</label>
        <input
          type="number"
          min={1}
          max={1000}
          value={config.count}
          onChange={(e) =>
            onConfigChange({
              count: Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)),
            })
          }
          className="w-20 rounded border border-neutral-600 bg-neutral-700 px-2 py-1 text-sm text-white"
        />
      </div>

      {/* Columns Selector */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-neutral-400">Cols:</label>
        <select
          value={config.columns}
          onChange={(e) => onConfigChange({ columns: parseInt(e.target.value) })}
          className="rounded border border-neutral-600 bg-neutral-700 px-2 py-1 text-sm text-white"
        >
          {COLUMN_OPTIONS.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      </div>

      {/* Display Format Toggle */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-neutral-400">Format:</label>
        <div className="flex">
          {FORMAT_OPTIONS.map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => onConfigChange({ displayFormat: fmt })}
              className={`px-2 py-1 text-xs transition-colors first:rounded-l last:rounded-r ${
                config.displayFormat === fmt
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Refresh Button */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={isLoading}
        className="flex items-center gap-1 rounded bg-neutral-700 px-2 py-1 text-sm text-white transition-colors hover:bg-neutral-600 disabled:opacity-50"
      >
        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>
  );
}

export default MemoryToolbar;
