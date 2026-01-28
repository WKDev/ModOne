/**
 * Common Properties Component
 *
 * Shared property fields (ID, position, label) used across all component editors.
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import type { Block } from '../../../OneCanvas/types';

// ============================================================================
// Types
// ============================================================================

interface CommonPropertiesProps {
  /** Component to display properties for */
  component: Block;
  /** Callback when property changes */
  onChange: (updates: Partial<Block>) => void;
}

// ============================================================================
// Component
// ============================================================================

export const CommonProperties = memo(function CommonProperties({
  component,
  onChange,
}: CommonPropertiesProps) {
  const [copied, setCopied] = useState(false);
  const [localX, setLocalX] = useState(component.position.x.toString());
  const [localY, setLocalY] = useState(component.position.y.toString());
  const [localLabel, setLocalLabel] = useState(component.label ?? '');

  // Sync local state when component changes
  useEffect(() => {
    setLocalX(component.position.x.toString());
    setLocalY(component.position.y.toString());
    setLocalLabel(component.label ?? '');
  }, [component.id, component.position.x, component.position.y, component.label]);

  // Copy ID to clipboard
  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(component.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [component.id]);

  // Handle position change
  const handlePositionChange = useCallback(
    (axis: 'x' | 'y', value: string) => {
      if (axis === 'x') {
        setLocalX(value);
      } else {
        setLocalY(value);
      }
    },
    []
  );

  const handlePositionBlur = useCallback(
    (axis: 'x' | 'y') => {
      const value = axis === 'x' ? localX : localY;
      const numValue = parseFloat(value) || 0;
      const snappedValue = Math.round(numValue / 10) * 10; // Snap to 10px grid

      if (axis === 'x' && snappedValue !== component.position.x) {
        onChange({ position: { ...component.position, x: snappedValue } });
      } else if (axis === 'y' && snappedValue !== component.position.y) {
        onChange({ position: { ...component.position, y: snappedValue } });
      }
    },
    [localX, localY, component.position, onChange]
  );

  // Handle label change with debounce
  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalLabel(e.target.value);
  }, []);

  const handleLabelBlur = useCallback(() => {
    if (localLabel !== (component.label ?? '')) {
      onChange({ label: localLabel || undefined });
    }
  }, [localLabel, component.label, onChange]);

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <h4 className="text-xs font-semibold uppercase text-neutral-400">
        General
      </h4>

      {/* Component ID (Read-only) */}
      <div className="space-y-1">
        <label className="text-xs text-neutral-500">Component ID</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-2 py-1.5 bg-neutral-800 rounded text-xs font-mono text-neutral-300 truncate">
            {component.id}
          </code>
          <button
            onClick={handleCopyId}
            className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
            title="Copy ID"
          >
            {copied ? (
              <Check size={14} className="text-green-500" />
            ) : (
              <Copy size={14} className="text-neutral-400" />
            )}
          </button>
        </div>
      </div>

      {/* Component Type */}
      <div className="space-y-1">
        <label className="text-xs text-neutral-500">Type</label>
        <div className="px-2 py-1.5 bg-neutral-800 rounded text-sm text-neutral-300">
          {component.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
        </div>
      </div>

      {/* Position */}
      <div className="space-y-1">
        <label className="text-xs text-neutral-500">Position</label>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-neutral-500 w-4">X</span>
              <input
                type="number"
                value={localX}
                onChange={(e) => handlePositionChange('x', e.target.value)}
                onBlur={() => handlePositionBlur('x')}
                step="10"
                className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-neutral-500">px</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-neutral-500 w-4">Y</span>
              <input
                type="number"
                value={localY}
                onChange={(e) => handlePositionChange('y', e.target.value)}
                onBlur={() => handlePositionBlur('y')}
                step="10"
                className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-neutral-500">px</span>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Label */}
      <div className="space-y-1">
        <label className="text-xs text-neutral-500">Label (optional)</label>
        <input
          type="text"
          value={localLabel}
          onChange={handleLabelChange}
          onBlur={handleLabelBlur}
          placeholder="Custom label..."
          maxLength={50}
          className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
});

export default CommonProperties;
