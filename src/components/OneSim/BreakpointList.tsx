/**
 * BreakpointList Component
 *
 * Displays and manages debugger breakpoints with add/remove/toggle functionality.
 */

import { memo, useCallback, useState } from 'react';
import { Plus, X, Circle, CircleDot, Hash, Variable, Code, Timer } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDebugger } from './useDebugger';
import type { Breakpoint, BreakpointType } from '../../types/onesim';

// ============================================================================
// Types
// ============================================================================

export interface BreakpointListProps {
  /** Optional class name */
  className?: string;
  /** Compact display mode */
  compact?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Format breakpoint for display */
function formatBreakpoint(bp: Breakpoint): string {
  switch (bp.breakpointType) {
    case 'network':
      return `Network ${bp.networkId ?? '?'}`;
    case 'device':
      return bp.deviceAddress ?? '?';
    case 'condition':
      return bp.condition ?? '?';
    case 'scanCount':
      return `Scan #${bp.scanCount ?? '?'}`;
    default:
      return 'Unknown';
  }
}

/** Get icon for breakpoint type */
function BreakpointIcon({ type }: { type: BreakpointType }) {
  switch (type) {
    case 'network':
      return <Hash size={12} className="text-blue-400" />;
    case 'device':
      return <Variable size={12} className="text-green-400" />;
    case 'condition':
      return <Code size={12} className="text-purple-400" />;
    case 'scanCount':
      return <Timer size={12} className="text-orange-400" />;
    default:
      return <Circle size={12} className="text-neutral-400" />;
  }
}

// ============================================================================
// AddBreakpointDialog Component
// ============================================================================

interface AddBreakpointDialogProps {
  onAdd: (type: BreakpointType, value: string) => void;
  onClose: () => void;
}

function AddBreakpointDialog({ onAdd, onClose }: AddBreakpointDialogProps) {
  const [type, setType] = useState<BreakpointType>('device');
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(type, value.trim());
      onClose();
    }
  };

  const getPlaceholder = () => {
    switch (type) {
      case 'network':
        return 'Network ID (e.g., 1)';
      case 'device':
        return 'Device address (e.g., M0001)';
      case 'condition':
        return 'Condition (e.g., D0 > 100)';
      case 'scanCount':
        return 'Scan count (e.g., 1000)';
      default:
        return 'Value';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 w-80 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-neutral-200">Add Breakpoint</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-700 rounded transition-colors"
          >
            <X size={14} className="text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as BreakpointType)}
                className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-600 rounded text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="device">Device Change</option>
                <option value="network">Network</option>
                <option value="condition">Condition</option>
                <option value="scanCount">Scan Count</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">Value</label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={getPlaceholder()}
                className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-600 rounded text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// BreakpointItem Component
// ============================================================================

interface BreakpointItemProps {
  breakpoint: Breakpoint;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

function BreakpointItem({ breakpoint, onToggle, onRemove }: BreakpointItemProps) {
  return (
    <li
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 text-sm rounded',
        'hover:bg-neutral-700/50 transition-colors group'
      )}
    >
      {/* Toggle checkbox */}
      <button
        onClick={() => onToggle(breakpoint.id)}
        className="flex-shrink-0"
        title={breakpoint.enabled ? 'Disable breakpoint' : 'Enable breakpoint'}
      >
        {breakpoint.enabled ? (
          <CircleDot size={14} className="text-red-500" />
        ) : (
          <Circle size={14} className="text-neutral-500" />
        )}
      </button>

      {/* Type icon */}
      <BreakpointIcon type={breakpoint.breakpointType} />

      {/* Label */}
      <span
        className={cn(
          'flex-1 font-mono text-xs truncate',
          breakpoint.enabled ? 'text-neutral-200' : 'text-neutral-500'
        )}
        title={formatBreakpoint(breakpoint)}
      >
        {formatBreakpoint(breakpoint)}
      </span>

      {/* Hit count */}
      {breakpoint.hitCount > 0 && (
        <span className="text-xs text-neutral-500" title="Hit count">
          {breakpoint.hitCount}
        </span>
      )}

      {/* Remove button */}
      <button
        onClick={() => onRemove(breakpoint.id)}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-neutral-600 rounded transition-all"
        title="Remove breakpoint"
      >
        <X size={12} className="text-neutral-400" />
      </button>
    </li>
  );
}

// ============================================================================
// BreakpointList Component
// ============================================================================

export const BreakpointList = memo(function BreakpointList({
  className,
  compact: _compact = false,
}: BreakpointListProps) {
  // compact mode reserved for future use
  void _compact;
  const {
    breakpoints,
    addBreakpoint,
    removeBreakpoint,
    toggleBreakpoint,
  } = useDebugger();

  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleAdd = useCallback(
    async (type: BreakpointType, value: string) => {
      const params: Parameters<typeof addBreakpoint>[0] = {
        breakpointType: type,
      };

      switch (type) {
        case 'network':
          params.networkId = parseInt(value, 10);
          break;
        case 'device':
          params.deviceAddress = value.toUpperCase();
          break;
        case 'condition':
          params.condition = value;
          break;
        case 'scanCount':
          params.scanCount = parseInt(value, 10);
          break;
      }

      await addBreakpoint(params);
    },
    [addBreakpoint]
  );

  const handleToggle = useCallback(
    (id: string) => {
      toggleBreakpoint(id);
    },
    [toggleBreakpoint]
  );

  const handleRemove = useCallback(
    (id: string) => {
      removeBreakpoint(id);
    },
    [removeBreakpoint]
  );

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-neutral-700">
        <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
          Breakpoints
        </h4>
        <button
          onClick={() => setShowAddDialog(true)}
          className="p-1 hover:bg-neutral-700 rounded transition-colors"
          title="Add breakpoint"
        >
          <Plus size={14} className="text-neutral-400" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {breakpoints.length === 0 ? (
          <div className="px-2 py-4 text-xs text-neutral-500 text-center">
            No breakpoints set
          </div>
        ) : (
          <ul className="py-1">
            {breakpoints.map((bp) => (
              <BreakpointItem
                key={bp.id}
                breakpoint={bp}
                onToggle={handleToggle}
                onRemove={handleRemove}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Add Dialog */}
      {showAddDialog && (
        <AddBreakpointDialog
          onAdd={handleAdd}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
});

export default BreakpointList;
