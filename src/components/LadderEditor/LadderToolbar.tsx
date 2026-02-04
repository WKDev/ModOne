/**
 * LadderToolbar Component
 *
 * Toolbar for the ladder editor with undo/redo, mode toggle, and common actions.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
import { useLadderStore } from '../../stores/ladderStore';

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
  const {
    mode,
    historyIndex,
    history,
    selectedElementIds,
    clipboard,
    undo,
    redo,
    startMonitoring,
    stopMonitoring,
    copyToClipboard,
    pasteFromClipboard,
    removeElement,
  } = useLadderStore(
    useShallow((state) => ({
      mode: state.mode,
      historyIndex: state.historyIndex,
      history: state.history,
      selectedElementIds: state.selectedElementIds,
      clipboard: state.clipboard,
      undo: state.undo,
      redo: state.redo,
      startMonitoring: state.startMonitoring,
      stopMonitoring: state.stopMonitoring,
      copyToClipboard: state.copyToClipboard,
      pasteFromClipboard: state.pasteFromClipboard,
      removeElement: state.removeElement,
    }))
  );

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;
  const hasSelection = selectedElementIds.size > 0;
  const hasClipboard = clipboard.length > 0;
  const isEditMode = mode === 'edit';

  // Handle delete selected elements
  const handleDelete = useCallback(() => {
    if (!isEditMode) return;
    const ids = Array.from(selectedElementIds);
    ids.forEach((id) => removeElement(id));
  }, [selectedElementIds, removeElement, isEditMode]);

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
        onClick={() => pasteFromClipboard()}
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
