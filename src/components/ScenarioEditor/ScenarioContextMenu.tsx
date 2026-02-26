/**
 * Scenario Context Menu Component
 *
 * Right-click context menu for grid row operations.
 */

import { memo, useEffect, useRef } from 'react';
import { Trash2, Copy, ToggleLeft, ChevronDown, ChevronUp } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ContextMenuProps {
  x: number;
  y: number;
  selectedCount: number;
  onClose: () => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const ScenarioContextMenu = memo(function ScenarioContextMenu({
  x,
  y,
  selectedCount,
  onClose,
  onInsertAbove,
  onInsertBelow,
  onDuplicate,
  onDelete,
  onToggleEnabled,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const plural = selectedCount > 1 ? 's' : '';

  const menuItems = [
    { icon: ChevronUp, label: 'Insert Row Above', onClick: onInsertAbove },
    { icon: ChevronDown, label: 'Insert Row Below', onClick: onInsertBelow },
    { icon: Copy, label: `Duplicate Row${plural}`, onClick: onDuplicate },
    { icon: ToggleLeft, label: `Toggle Enabled`, onClick: onToggleEnabled },
    { icon: Trash2, label: `Delete Row${plural}`, onClick: onDelete, danger: true },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl py-1 z-50 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          className={`
            w-full px-3 py-2 text-sm text-left flex items-center gap-2
            hover:bg-[var(--color-bg-tertiary)] transition-colors
            ${item.danger ? 'text-[var(--color-error)] hover:text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'}
          `}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          <item.icon size={16} />
          {item.label}
        </button>
      ))}
    </div>
  );
});

export default ScenarioContextMenu;
