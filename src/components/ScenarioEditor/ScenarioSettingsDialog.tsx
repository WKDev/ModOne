/**
 * ScenarioSettingsDialog Component
 *
 * Modal dialog for configuring scenario settings (loop, delay, auto-start).
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { useScenarioStore, selectSettings } from '../../stores/scenarioStore';
import type { ScenarioSettings } from '../../types/scenario';

// ============================================================================
// Types
// ============================================================================

interface ScenarioSettingsDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const ScenarioSettingsDialog = memo(function ScenarioSettingsDialog({
  isOpen,
  onClose,
}: ScenarioSettingsDialogProps) {
  // Store
  const storeSettings = useScenarioStore(selectSettings);
  const updateSettings = useScenarioStore((state) => state.updateSettings);

  // Local form state
  const [localSettings, setLocalSettings] = useState<ScenarioSettings>({
    loop: false,
    loopCount: 1,
    loopDelay: 0,
    autoStart: false,
  });

  // Validation errors
  const [errors, setErrors] = useState<Partial<Record<keyof ScenarioSettings, string>>>({});

  // Sync local state when dialog opens
  useEffect(() => {
    if (isOpen && storeSettings) {
      setLocalSettings({ ...storeSettings });
      setErrors({});
    }
  }, [isOpen, storeSettings]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Validate settings
  const validate = useCallback((settings: ScenarioSettings): boolean => {
    const newErrors: Partial<Record<keyof ScenarioSettings, string>> = {};

    if (settings.loopCount < 0) {
      newErrors.loopCount = 'Loop count cannot be negative';
    }

    if (settings.loopDelay < 0) {
      newErrors.loopDelay = 'Loop delay cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, []);

  // Handle field changes
  const handleChange = useCallback((field: keyof ScenarioSettings, value: boolean | number) => {
    setLocalSettings((prev) => {
      const updated = { ...prev, [field]: value };
      validate(updated);
      return updated;
    });
  }, [validate]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!validate(localSettings)) return;

    updateSettings(localSettings);
    onClose();
  }, [localSettings, validate, updateSettings, onClose]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
            <h2 className="text-lg font-semibold text-white">Scenario Settings</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-neutral-700 rounded transition-colors"
              title="Close"
            >
              <X size={20} className="text-neutral-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Loop Enabled */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-neutral-200">
                  Loop Scenario
                </label>
                <p className="text-xs text-neutral-500">
                  Repeat the scenario when it finishes
                </p>
              </div>
              <button
                onClick={() => handleChange('loop', !localSettings.loop)}
                className={`
                  relative w-11 h-6 rounded-full transition-colors
                  ${localSettings.loop ? 'bg-blue-600' : 'bg-neutral-600'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform
                    ${localSettings.loop ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>

            {/* Loop Count */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-neutral-200">
                Loop Count
              </label>
              <input
                type="number"
                value={localSettings.loopCount}
                onChange={(e) => handleChange('loopCount', parseInt(e.target.value, 10) || 0)}
                min="0"
                disabled={!localSettings.loop}
                className={`
                  w-full px-3 py-2 bg-neutral-900 border rounded text-sm text-white
                  placeholder:text-neutral-500 focus:outline-none focus:ring-1
                  ${errors.loopCount
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-neutral-700 focus:ring-blue-500'
                  }
                  ${!localSettings.loop ? 'opacity-50' : ''}
                `}
              />
              {errors.loopCount ? (
                <p className="text-xs text-red-400">{errors.loopCount}</p>
              ) : (
                <p className="text-xs text-neutral-500">
                  Number of times to repeat (0 = infinite)
                </p>
              )}
            </div>

            {/* Loop Delay */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-neutral-200">
                Loop Delay (ms)
              </label>
              <input
                type="number"
                value={localSettings.loopDelay}
                onChange={(e) => handleChange('loopDelay', parseInt(e.target.value, 10) || 0)}
                min="0"
                step="100"
                disabled={!localSettings.loop}
                className={`
                  w-full px-3 py-2 bg-neutral-900 border rounded text-sm text-white
                  placeholder:text-neutral-500 focus:outline-none focus:ring-1
                  ${errors.loopDelay
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-neutral-700 focus:ring-blue-500'
                  }
                  ${!localSettings.loop ? 'opacity-50' : ''}
                `}
              />
              {errors.loopDelay ? (
                <p className="text-xs text-red-400">{errors.loopDelay}</p>
              ) : (
                <p className="text-xs text-neutral-500">
                  Delay between loop iterations
                </p>
              )}
            </div>

            {/* Auto Start */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-700">
              <div>
                <label className="text-sm font-medium text-neutral-200">
                  Auto-Start with Simulation
                </label>
                <p className="text-xs text-neutral-500">
                  Start scenario when simulation starts
                </p>
              </div>
              <button
                onClick={() => handleChange('autoStart', !localSettings.autoStart)}
                className={`
                  relative w-11 h-6 rounded-full transition-colors
                  ${localSettings.autoStart ? 'bg-blue-600' : 'bg-neutral-600'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform
                    ${localSettings.autoStart ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-neutral-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={Object.keys(errors).length > 0}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
});

export default ScenarioSettingsDialog;
