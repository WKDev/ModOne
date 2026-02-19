/**
 * LadderEditor Component
 *
 * Main ladder diagram editor with GxWorks-style top toolbar.
 * Integrates toolbox, grid, properties panel, and toolbar.
 */

import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core';
import { cn } from '../../lib/utils';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useLadderDocument } from '../../stores/hooks/useLadderDocument';
import { useLadderUIStore } from '../../stores/ladderUIStore';
import { LadderGrid } from './LadderGrid';
import { LadderToolbox } from './LadderToolbox';
import { LadderToolbar } from './LadderToolbar';
import { NetworkCommentHeader } from './NetworkCommentHeader';
import { LadderPropertiesPanel } from './properties';
import { useLadderDragDrop } from '../../hooks/useLadderDragDrop';
import { useLadderKeyboardShortcuts } from './hooks';

export interface LadderEditorProps {
  /** Optional additional class names */
  className?: string;
  /** Whether to show the toolbox */
  showToolbox?: boolean;
  /** Whether to show the properties panel */
  showPropertiesPanel?: boolean;
}

/**
 * DragOverlay content for grid element moves
 */
function DragOverlayContent({ activeId }: { activeId: string | null }) {
  if (!activeId) return null;

  return (
    <div className="px-3 py-2 bg-neutral-800 border border-blue-500 rounded shadow-lg text-sm text-neutral-200 opacity-80">
      Moving...
    </div>
  );
}

/**
 * LadderStatusBar - Status bar at the bottom of the editor
 */
function LadderStatusBar() {
  const { documentId } = useDocumentContext();
  const ladderDoc = useLadderDocument(documentId);
  const { mode, selectedElementIds } = useLadderUIStore(
    useShallow((state) => ({
      mode: state.mode,
      selectedElementIds: state.selectedElementIds,
    }))
  );

  const isMonitorMode = mode === 'monitor';
  const selectedCount = selectedElementIds.size;
  const elementCount = ladderDoc?.elements.size ?? 0;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-800 border-t border-neutral-700 text-xs text-neutral-400">
      <div className="flex items-center gap-4">
        <span>Mode: {isMonitorMode ? 'Monitor' : 'Edit'}</span>
        <span>Elements: {elementCount}</span>
        {selectedCount > 0 && <span>{selectedCount} selected</span>}
      </div>
      <div className="flex items-center gap-2">
        {isMonitorMode && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * LadderEditor - Main ladder diagram editor component
 */
export function LadderEditor({
  className,
  showToolbox = true,
  showPropertiesPanel = true,
}: LadderEditorProps) {
  const { documentId } = useDocumentContext();
  const ladderDoc = useLadderDocument(documentId);
  const mode = useLadderUIStore((state) => state.mode);
  const comment = ladderDoc?.comment;

  useEffect(() => {
    useLadderUIStore.getState().clearSelection();
    useLadderUIStore.getState().clearActiveTool();
  }, [documentId]);

  // Drag and drop handlers
  const { handleDragStart, handleDragOver, handleDragEnd } = useLadderDragDrop();

  // Keyboard shortcuts
  useLadderKeyboardShortcuts({ enabled: true });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Track active drag for overlay
  const [activeId, setActiveId] = useState<string | null>(null);

  const onDragStart = useCallback(
    (event: Parameters<typeof handleDragStart>[0]) => {
      setActiveId(event.active.id as string);
      handleDragStart(event);
    },
    [handleDragStart]
  );

  const onDragEnd = useCallback(
    (event: Parameters<typeof handleDragEnd>[0]) => {
      setActiveId(null);
      handleDragEnd(event);
    },
    [handleDragEnd]
  );

  const onDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Handle comment update
  const handleUpdateComment = useCallback(
    (newComment: string) => {
      ladderDoc?.updateComment(newComment);
    },
    [ladderDoc]
  );

  const isMonitorMode = mode === 'monitor';

  if (!ladderDoc) {
    return (
      <div className={cn('flex h-full items-center justify-center bg-neutral-900 text-neutral-400', className)}>
        No ladder document selected.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={handleDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className={cn('flex h-full bg-neutral-900', className)}>
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <LadderToolbar />

          {/* Element toolbox strip (GxWorks-style) */}
          {showToolbox && (
            <LadderToolbox disabled={isMonitorMode} />
          )}

          {/* Content area with grid and properties */}
          <div className="flex-1 flex overflow-hidden">
            {/* Grid area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Comment header */}
              <NetworkCommentHeader
                comment={comment}
                onUpdateComment={handleUpdateComment}
                editable={!isMonitorMode}
              />

              {/* Grid container - onKeyDown stops arrow key propagation so
                  the scroll container doesn't consume them before the grid */}
              <div
                className="flex-1 overflow-auto p-4"
                onKeyDown={(e) => {
                  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    // Let the global keyboard shortcut handler manage navigation
                    // Prevent the scroll container from scrolling on arrow keys
                    e.preventDefault();
                  }
                }}
              >
                <LadderGrid
                  readonly={isMonitorMode}
                  showRowNumbers
                />
              </div>
            </div>

            {/* Properties Panel */}
            {showPropertiesPanel && (
              <LadderPropertiesPanel className="w-64 border-l border-neutral-700 shrink-0" />
            )}
          </div>

          {/* Status bar */}
          <LadderStatusBar />
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        <DragOverlayContent activeId={activeId} />
      </DragOverlay>
    </DndContext>
  );
}

export default LadderEditor;
