/**
 * Numpad Component
 *
 * A virtual numpad for entering numeric values with optional hex keys.
 */

import { memo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface NumpadProps {
  /** Whether to show hex keys (A-F) */
  isHexMode: boolean;
  /** Callback when a key is pressed */
  onKeyPress: (key: string) => void;
  /** Callback when backspace is pressed */
  onBackspace: () => void;
  /** Callback when clear is pressed */
  onClear: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Virtual numpad with optional hex keys for value input.
 */
export const Numpad = memo(function Numpad({
  isHexMode,
  onKeyPress,
  onBackspace,
  onClear,
}: NumpadProps) {
  // Key layout for number pad
  const numKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'];
  const hexKeys = ['A', 'B', 'C', 'D', 'E', 'F'];

  const buttonClass = `
    w-10 h-10 rounded
    bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] active:bg-[var(--color-border)]
    text-[var(--color-text-primary)] font-mono text-lg
    flex items-center justify-center
    transition-colors
  `;

  const actionButtonClass = `
    w-10 h-10 rounded
    bg-[var(--color-bg-hover)] hover:bg-[var(--color-border)] active:bg-[var(--color-text-muted)]
    text-[var(--color-text-primary)] font-mono text-sm
    flex items-center justify-center
    transition-colors
  `;

  return (
    <div className="flex gap-2">
      {/* Number keys grid */}
      <div className="grid grid-cols-3 gap-1">
        {numKeys.map((key) => (
          <button
            key={key}
            type="button"
            className={buttonClass}
            onClick={() => onKeyPress(key)}
          >
            {key}
          </button>
        ))}
        {/* Clear and Backspace buttons */}
        <button
          type="button"
          className={actionButtonClass}
          onClick={onClear}
          title="Clear"
        >
          CLR
        </button>
        <button
          type="button"
          className={actionButtonClass}
          onClick={onBackspace}
          title="Backspace"
        >
          ⌫
        </button>
      </div>

      {/* Hex keys - only show in HEX mode */}
      {isHexMode && (
        <div className="grid grid-cols-2 gap-1">
          {hexKeys.map((key) => (
            <button
              key={key}
              type="button"
              className={buttonClass}
              onClick={() => onKeyPress(key)}
            >
              {key}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default Numpad;
