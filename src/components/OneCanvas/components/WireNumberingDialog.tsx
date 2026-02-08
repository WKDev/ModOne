/**
 * Wire Numbering Dialog Component
 *
 * Dialog for configuring wire numbering options (IEC 81346).
 */

import { memo, useState, useCallback } from 'react';
import { Hash, X } from 'lucide-react';
import type { NumberingScheme, WireNumberingOptions } from '../utils/wireNumbering';

// ============================================================================
// Types
// ============================================================================

interface WireNumberingDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Close the dialog */
  onClose: () => void;
  /** Number of wires that will be numbered */
  wireCount: number;
  /** Apply numbering with options */
  onApply: (options: WireNumberingOptions) => void;
}

// ============================================================================
// Component
// ============================================================================

export const WireNumberingDialog = memo(function WireNumberingDialog({
  isOpen,
  onClose,
  wireCount,
  onApply,
}: WireNumberingDialogProps) {
  // Form state
  const [scheme, setScheme] = useState<NumberingScheme>('sequential');
  const [startNumber, setStartNumber] = useState(1);
  const [prefix, setPrefix] = useState('');
  const [includeSignalType, setIncludeSignalType] = useState(false);
  const [sortByPosition, setSortByPosition] = useState(true);

  // Handle apply
  const handleApply = useCallback(() => {
    onApply({
      scheme,
      startNumber,
      prefix: prefix || undefined,
      includeSignalType,
      sortByPosition,
    });
    onClose();
  }, [scheme, startNumber, prefix, includeSignalType, sortByPosition, onApply, onClose]);

  // Handle reset
  const handleReset = useCallback(() => {
    setScheme('sequential');
    setStartNumber(1);
    setPrefix('');
    setIncludeSignalType(false);
    setSortByPosition(true);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[450px] bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Hash size={20} />
            Wire Numbering
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Wire count info */}
          <div className="text-sm text-neutral-400">
            <span className="text-blue-400 font-medium">{wireCount}</span> wires will be numbered
          </div>

          {/* Numbering Scheme */}
          <div className="space-y-2">
            <label className="block text-sm text-neutral-400">Numbering Scheme</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheme"
                  value="sequential"
                  checked={scheme === 'sequential'}
                  onChange={() => setScheme('sequential')}
                  className="accent-blue-500"
                />
                <span className="text-white">Sequential</span>
                <span className="text-neutral-500 text-sm">(1, 2, 3...)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheme"
                  value="component_based"
                  checked={scheme === 'component_based'}
                  onChange={() => setScheme('component_based')}
                  className="accent-blue-500"
                />
                <span className="text-white">Component Based</span>
                <span className="text-neutral-500 text-sm">(K1-F1-1, K1-M1-1...)</span>
              </label>
            </div>
          </div>

          {/* Start Number & Prefix */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-neutral-400 mb-1">Start Number</label>
              <input
                type="number"
                min={1}
                max={9999}
                value={startNumber}
                onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-neutral-400 mb-1">Prefix</label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g., W"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sortByPosition}
                onChange={(e) => setSortByPosition(e.target.checked)}
                className="accent-blue-500"
              />
              <span className="text-white text-sm">Sort wires by position (top-to-bottom, left-to-right)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSignalType}
                onChange={(e) => setIncludeSignalType(e.target.checked)}
                className="accent-blue-500"
              />
              <span className="text-white text-sm">Include signal type prefix (L=power, C=control, S=signal)</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-700">
          <button
            onClick={handleReset}
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Reset to Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={wireCount === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded transition-colors"
            >
              Apply Numbering
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default WireNumberingDialog;
