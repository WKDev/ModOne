/**
 * LadderEditor Component
 *
 * Main ladder diagram editor with GxWorks-style top toolbar.
 * Renders the ladder grid using Pixi.js via LadderPixiCanvasHost.
 * Integrates toolbox, properties panel, toolbar, and status bar.
 */

import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '../../lib/utils';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useLadderDocument } from '../../stores/hooks/useLadderDocument';
import { useLadderUIStore } from '../../stores/ladderUIStore';
import {
  LadderPixiCanvasHost,
  type LadderPixiCanvasHostRef,
} from './pixi/LadderPixiCanvasHost';
import { useLadderPixiRenderer } from './pixi/useLadderPixiRenderer';
import { LadderToolbox } from './LadderToolbox';
import { LadderToolbar } from './LadderToolbar';
import { NetworkCommentHeader } from './NetworkCommentHeader';
import { LadderPropertiesPanel } from './properties';
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

  // Pixi canvas host state
  const [pixiHostRef, setPixiHostRef] = useState<LadderPixiCanvasHostRef | null>(null);

  useEffect(() => {
    useLadderUIStore.getState().clearSelection();
    useLadderUIStore.getState().clearActiveTool();
  }, [documentId]);

  // Keyboard shortcuts
  useLadderKeyboardShortcuts({ enabled: true });

  // Bridge store data → Pixi rendering
  useLadderPixiRenderer({
    hostRef: pixiHostRef,
    ladderDoc,
    readonly: mode === 'monitor',
  });

  // Handle Pixi canvas ready
  const handlePixiReady = useCallback((ref: LadderPixiCanvasHostRef) => {
    setPixiHostRef(ref);
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
    <div className={cn('flex h-full bg-neutral-900', className)}>
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <LadderToolbar />

        {/* Element toolbox strip (GxWorks-style) */}
        {showToolbox && (
          <LadderToolbox disabled={isMonitorMode} />
        )}

        {/* Content area with canvas and properties */}
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Comment header */}
            <NetworkCommentHeader
              comment={comment}
              onUpdateComment={handleUpdateComment}
              editable={!isMonitorMode}
            />

            {/* Pixi canvas */}
            <LadderPixiCanvasHost
              className="flex-1"
              onReady={handlePixiReady}
            />
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
  );
}

export default LadderEditor;
