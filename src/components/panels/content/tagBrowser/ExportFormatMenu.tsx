import { useCallback, useEffect, useRef } from 'react';
import { FileSpreadsheet, FileJson, FileCode } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

/** Supported export formats */
export type ExportFormat = 'csv' | 'json' | 'nodeset2';

interface ExportFormatOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const EXPORT_OPTIONS: ExportFormatOption[] = [
  {
    format: 'csv',
    label: 'CSV',
    description: '태그 필드 및 OPC UA 매핑 포함',
    icon: <FileSpreadsheet size={14} />,
  },
  {
    format: 'json',
    label: 'JSON',
    description: '폴더 트리 구조로 내보내기',
    icon: <FileJson size={14} />,
  },
  {
    format: 'nodeset2',
    label: 'NodeSet2 XML',
    description: 'OPC UA NodeSet2 XML 형식',
    icon: <FileCode size={14} />,
  },
];

// ============================================================================
// Props
// ============================================================================

export interface ExportFormatMenuProps {
  /** Whether the menu is currently visible */
  isOpen: boolean;
  /** Position relative to the trigger button */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Called when a format is selected */
  onSelectFormat: (format: ExportFormat) => void;
  /** Called when the menu should close (click outside, Escape, etc.) */
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Export Format Selection Menu
 *
 * A dropdown menu that appears when the export button is clicked,
 * offering CSV, JSON, and NodeSet2 XML export format options.
 * Follows the existing context menu pattern with outside-click and
 * Escape key dismissal, viewport edge adjustment, and consistent
 * styling with the codebase's design system.
 */
export function ExportFormatMenu({
  isOpen,
  anchorRef,
  onSelectFormat,
  onClose,
}: ExportFormatMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Close on outside click or Escape ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  // ── Position adjustment to keep menu in viewport ─────────────────────
  useEffect(() => {
    if (!isOpen || !menuRef.current || !anchorRef.current) return;

    const anchor = anchorRef.current.getBoundingClientRect();
    const menu = menuRef.current;
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default: align below the anchor, left-aligned
    let left = anchor.left;
    let top = anchor.bottom + 4;

    // Flip left if overflowing right edge
    if (left + menuRect.width > viewportWidth - 8) {
      left = anchor.right - menuRect.width;
    }
    // Ensure not off-screen left
    if (left < 8) {
      left = 8;
    }

    // Flip upward if overflowing bottom edge
    if (top + menuRect.height > viewportHeight - 8) {
      top = anchor.top - menuRect.height - 4;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }, [isOpen, anchorRef]);

  // ── Handle format selection ──────────────────────────────────────────
  const handleSelect = useCallback(
    (format: ExportFormat) => {
      onSelectFormat(format);
      onClose();
    },
    [onSelectFormat, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl"
      style={{ left: 0, top: 0 }}
      data-testid="export-format-menu"
      role="menu"
      aria-label="Export format selection"
    >
      {/* Menu header */}
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--color-border)]">
        내보내기 형식
      </div>

      {/* Format options */}
      {EXPORT_OPTIONS.map((option) => (
        <button
          key={option.format}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
          onClick={() => handleSelect(option.format)}
          role="menuitem"
          data-testid={`export-format-${option.format}`}
        >
          <span className="w-4 h-4 flex items-center justify-center text-[var(--text-muted)] shrink-0">
            {option.icon}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium">{option.label}</span>
            <span className="text-[10px] text-[var(--text-muted)] truncate">
              {option.description}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
