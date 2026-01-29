/**
 * WatchList Component
 *
 * Displays and manages watch variables with current value, previous value,
 * and change count tracking.
 */

import { memo, useCallback, useState } from 'react';
import { Plus, X, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDebugger } from './useDebugger';
import type { WatchVariable } from '../../types/onesim';

// ============================================================================
// Types
// ============================================================================

export interface WatchListProps {
  /** Optional class name */
  className?: string;
  /** Compact display mode */
  compact?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Format value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'ON' : 'OFF';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'object') {
    // Handle DeviceValue objects
    const obj = value as Record<string, unknown>;
    if ('type' in obj) {
      if (obj.type === 'bit' && 'value' in obj) {
        return obj.value ? 'ON' : 'OFF';
      }
      if (obj.type === 'word' && 'value' in obj) {
        return String(obj.value);
      }
    }
    return JSON.stringify(value);
  }
  return String(value);
}

/** Get change indicator */
function getChangeIndicator(current: unknown, previous: unknown): 'up' | 'down' | 'same' | 'none' {
  if (previous === null || previous === undefined) {
    return 'none';
  }

  // Extract numeric values
  const currentNum = extractNumericValue(current);
  const previousNum = extractNumericValue(previous);

  if (currentNum === null || previousNum === null) {
    // Compare as strings for non-numeric
    return formatValue(current) === formatValue(previous) ? 'same' : 'none';
  }

  if (currentNum > previousNum) return 'up';
  if (currentNum < previousNum) return 'down';
  return 'same';
}

/** Extract numeric value from DeviceValue or raw value */
function extractNumericValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if ('type' in obj && 'value' in obj) {
      if (obj.type === 'bit') {
        return obj.value ? 1 : 0;
      }
      if (obj.type === 'word' && typeof obj.value === 'number') {
        return obj.value;
      }
    }
  }
  return null;
}

// ============================================================================
// ChangeIndicator Component
// ============================================================================

function ChangeIndicator({ type }: { type: 'up' | 'down' | 'same' | 'none' }) {
  switch (type) {
    case 'up':
      return <TrendingUp size={12} className="text-green-400" />;
    case 'down':
      return <TrendingDown size={12} className="text-red-400" />;
    case 'same':
      return <Minus size={12} className="text-neutral-500" />;
    default:
      return null;
  }
}

// ============================================================================
// WatchItem Component
// ============================================================================

interface WatchItemProps {
  watch: WatchVariable;
  onRemove: (address: string) => void;
  compact?: boolean;
}

function WatchItem({ watch, onRemove, compact }: WatchItemProps) {
  const changeType = getChangeIndicator(watch.currentValue, watch.previousValue);

  return (
    <tr className="hover:bg-neutral-700/30 group">
      {/* Address */}
      <td className="px-2 py-1.5">
        <span className="font-mono text-xs text-neutral-200">{watch.address}</span>
      </td>

      {/* Current Value */}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-blue-400">
            {formatValue(watch.currentValue)}
          </span>
          <ChangeIndicator type={changeType} />
        </div>
      </td>

      {/* Previous Value (if not compact) */}
      {!compact && (
        <td className="px-2 py-1.5">
          <span className="font-mono text-xs text-neutral-500">
            {formatValue(watch.previousValue)}
          </span>
        </td>
      )}

      {/* Change Count (if not compact) */}
      {!compact && (
        <td className="px-2 py-1.5 text-right">
          <span
            className={cn(
              'text-xs',
              watch.changeCount > 0 ? 'text-amber-400' : 'text-neutral-500'
            )}
          >
            {watch.changeCount}
          </span>
        </td>
      )}

      {/* Remove Button */}
      <td className="px-1 py-1.5">
        <button
          onClick={() => onRemove(watch.address)}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-neutral-600 rounded transition-all"
          title="Remove watch"
        >
          <X size={12} className="text-neutral-400" />
        </button>
      </td>
    </tr>
  );
}

// ============================================================================
// WatchList Component
// ============================================================================

export const WatchList = memo(function WatchList({
  className,
  compact = false,
}: WatchListProps) {
  const { watches, addWatch, removeWatch, refreshWatches, isLoading } = useDebugger();

  const [newAddress, setNewAddress] = useState('');

  const handleAdd = useCallback(async () => {
    const address = newAddress.trim().toUpperCase();
    if (address) {
      await addWatch(address);
      setNewAddress('');
    }
  }, [newAddress, addWatch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleAdd();
      }
    },
    [handleAdd]
  );

  const handleRemove = useCallback(
    (address: string) => {
      removeWatch(address);
    },
    [removeWatch]
  );

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-neutral-700">
        <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
          Watch
        </h4>
        <button
          onClick={refreshWatches}
          disabled={isLoading}
          className={cn(
            'p-1 hover:bg-neutral-700 rounded transition-colors',
            isLoading && 'animate-spin'
          )}
          title="Refresh watch values"
        >
          <RefreshCw size={14} className="text-neutral-400" />
        </button>
      </div>

      {/* Add Watch Input */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-neutral-700">
        <input
          type="text"
          value={newAddress}
          onChange={(e) => setNewAddress(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Address (e.g., D0001)"
          className="flex-1 px-2 py-1 bg-neutral-900 border border-neutral-600 rounded text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleAdd}
          disabled={!newAddress.trim()}
          className="p-1 hover:bg-neutral-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add watch"
        >
          <Plus size={14} className="text-neutral-400" />
        </button>
      </div>

      {/* Watch Table */}
      <div className="flex-1 overflow-y-auto">
        {watches.length === 0 ? (
          <div className="px-2 py-4 text-xs text-neutral-500 text-center">
            No watches set
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-neutral-500 border-b border-neutral-700/50">
                <th className="px-2 py-1 font-normal">Address</th>
                <th className="px-2 py-1 font-normal">Value</th>
                {!compact && <th className="px-2 py-1 font-normal">Prev</th>}
                {!compact && <th className="px-2 py-1 font-normal text-right">Changes</th>}
                <th className="w-6"></th>
              </tr>
            </thead>
            <tbody>
              {watches.map((w) => (
                <WatchItem
                  key={w.address}
                  watch={w}
                  onRemove={handleRemove}
                  compact={compact}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
});

export default WatchList;
