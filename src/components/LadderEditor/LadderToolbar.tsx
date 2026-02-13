/**
 * LadderToolbar Component
 *
 * Toolbar for the ladder editor with undo/redo, mode toggle, and common actions.
 */

import { useCallback } from 'react';
import {
  Undo2,
  Redo2,
  Play,
  Square,
  Copy,
  Clipboard,
  Trash2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useLadderDocument } from '../../stores/hooks/useLadderDocument';
import { useLadderUIStore } from '../../stores/ladderUIStore';
import type { LadderElement } from '../../types/ladder';

export interface LadderToolbarProps {
  /** Optional class name */
  className?: string;
}

/**
 * ToolbarButton - Reusable button component for toolbar
 */
function ToolbarButton({
  onClick,
  disabled,
  active,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        'text-neutral-400 hover:text-neutral-200',
        'hover:bg-neutral-700',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
        active && 'bg-blue-600 text-white hover:bg-blue-500'
      )}
    >
      {children}
    </button>
  );
}

/**
 * ToolbarSeparator - Visual separator between button groups
 */
function ToolbarSeparator() {
  return <div className="w-px h-5 bg-neutral-700 mx-1" />;
}

/**
 * LadderToolbar - Main toolbar component
 */
export function LadderToolbar({ className }: LadderToolbarProps) {
  const { documentId } = useDocumentContext();
  const ladderDoc = useLadderDocument(documentId);

  const mode = useLadderUIStore((state) => state.mode);
  const selectedElementIds = useLadderUIStore((state) => state.selectedElementIds);
  const clipboard = useLadderUIStore((state) => state.clipboard);
  const startMonitoring = useLadderUIStore((state) => state.startMonitoring);
  const stopMonitoring = useLadderUIStore((state) => state.stopMonitoring);
  const setClipboard = useLadderUIStore((state) => state.setClipboard);
  const setSelection = useLadderUIStore((state) => state.setSelection);
  const clearSelection = useLadderUIStore((state) => state.clearSelection);

  const canUndo = ladderDoc?.canUndo ?? false;
  const canRedo = ladderDoc?.canRedo ?? false;
  const isDirty = ladderDoc?.isDirty ?? false;
  const hasSelection = selectedElementIds.size > 0;
  const hasClipboard = clipboard.length > 0;
  const isEditMode = mode === 'edit';

  const undo = useCallback(() => {
    ladderDoc?.undo();
  }, [ladderDoc]);

  const redo = useCallback(() => {
    ladderDoc?.redo();
  }, [ladderDoc]);

  const copyToClipboard = useCallback(() => {
    if (!ladderDoc || selectedElementIds.size === 0) return;

    const selectedElements: LadderElement[] = [];
    selectedElementIds.forEach((id) => {
      const element = ladderDoc.elements.get(id);
      if (element) {
        selectedElements.push(JSON.parse(JSON.stringify(element)) as LadderElement);
      }
    });

    setClipboard(selectedElements);
  }, [ladderDoc, selectedElementIds, setClipboard]);

  const pasteFromClipboard = useCallback(() => {
    if (!ladderDoc || clipboard.length === 0 || !isEditMode) return;

    const firstElement = clipboard[0];
    const basePosition = firstElement.position;

    // Try row+1 first, then search downward for first available row
    let offsetRow = 1;
    const offsetCol = 0;
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const testRow = basePosition.row + offsetRow;
      const testCol = basePosition.col + offsetCol;
      const occupied = [...ladderDoc.elements.values()].some(
        (el) => el.position.row === testRow && el.position.col === testCol
      );
      if (!occupied) break;
      offsetRow++;
    }

    const newIds: string[] = [];
    clipboard.forEach((element) => {
      const id = ladderDoc.addElement(
        element.type,
        {
          row: element.position.row + offsetRow,
          col: element.position.col + offsetCol,
        },
        {
          address: element.address,
          label: element.label,
          properties: element.properties,
        }
      );

      if (id) {
        newIds.push(id);
      }
    });

    if (newIds.length > 0) {
      setSelection(newIds);
    }
  }, [ladderDoc, clipboard, isEditMode, setSelection]);

  // Handle delete selected elements
  const handleDelete = useCallback(() => {
    if (!isEditMode) return;
    const ids = Array.from(selectedElementIds);
    ids.forEach((id) => ladderDoc?.removeElement(id));
    clearSelection();
  }, [selectedElementIds, ladderDoc, isEditMode, clearSelection]);

  const clearAll = useCallback(() => {
    ladderDoc?.clearAll();
  }, [ladderDoc]);

  const markSaved = useCallback(() => {
    ladderDoc?.markSaved();
  }, [ladderDoc]);

  void clearAll;
  void markSaved;
  void isDirty;

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1.5',
        'bg-neutral-800 border-b border-neutral-700',
        className
      )}
    >
      {/* Undo/Redo */}
      <ToolbarButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
        <Redo2 size={16} />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Clipboard operations */}
      <ToolbarButton
        onClick={copyToClipboard}
        disabled={!hasSelection}
        title="Copy (Ctrl+C)"
      >
        <Copy size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={pasteFromClipboard}
        disabled={!hasClipboard || !isEditMode}
        title="Paste (Ctrl+V)"
      >
        <Clipboard size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={handleDelete}
        disabled={!hasSelection || !isEditMode}
        title="Delete (Del)"
      >
        <Trash2 size={16} />
      </ToolbarButton>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Mode toggle */}
      {isEditMode ? (
        <button
          type="button"
          onClick={startMonitoring}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded text-sm',
            'bg-green-600 text-white hover:bg-green-500',
            'transition-colors'
          )}
          title="Start Monitoring"
        >
          <Play size={14} />
          Monitor
        </button>
      ) : (
        <button
          type="button"
          onClick={stopMonitoring}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded text-sm',
            'bg-red-600 text-white hover:bg-red-500',
            'transition-colors'
          )}
          title="Stop Monitoring"
        >
          <Square size={14} />
          Stop
        </button>
      )}
    </div>
  );
}

export default LadderToolbar;
