/**
 * LadderEditor Component
 *
 * Main ladder diagram editor with drag-and-drop support.
 * Integrates toolbox, grid, network list, properties panel, and toolbar.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core';
import { cn } from '../../lib/utils';
import {
  useLadderStore,
  selectCurrentNetworkId,
  selectCurrentNetwork,
  selectMode,
  selectNetworksArray,
  selectSelectedElementIds,
} from '../../stores/ladderStore';
import { LadderGrid } from './LadderGrid';
import { LadderToolbox } from './LadderToolbox';
import { LadderToolbar } from './LadderToolbar';
import { LadderNetworkList } from './LadderNetworkList';
import { NetworkCommentHeader } from './NetworkCommentHeader';
import { LadderPropertiesPanel } from './properties';
import { useLadderDragDrop } from '../../hooks/useLadderDragDrop';
import { useLadderKeyboardShortcuts } from './hooks';

export interface LadderEditorProps {
  /** Optional additional class names */
  className?: string;
  /** Whether to show the toolbox */
  showToolbox?: boolean;
  /** Whether to show the network list sidebar */
  showNetworkList?: boolean;
  /** Whether to show the properties panel */
  showPropertiesPanel?: boolean;
}

/**
 * DragOverlay content based on active drag item
 */
function DragOverlayContent({ activeId }: { activeId: string | null }) {
  if (!activeId) return null;

  // Check if dragging from toolbox
  if (activeId.startsWith('toolbox-')) {
    const elementType = activeId.replace('toolbox-', '');
    return (
      <div className="px-3 py-2 bg-neutral-800 border border-blue-500 rounded shadow-lg text-sm text-neutral-200">
        {elementType.replace(/_/g, ' ')}
      </div>
    );
  }

  // Dragging grid element
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
  const mode = useLadderStore(selectMode);
  const networks = useLadderStore(selectNetworksArray);
  const selectedElementIds = useLadderStore(selectSelectedElementIds);
  const currentNetwork = useLadderStore(selectCurrentNetwork);

  const isMonitorMode = mode === 'monitor';
  const selectedCount = selectedElementIds.size;
  const elementCount = currentNetwork?.elements.size ?? 0;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-800 border-t border-neutral-700 text-xs text-neutral-400">
      <div className="flex items-center gap-4">
        <span>Mode: {isMonitorMode ? 'Monitor' : 'Edit'}</span>
        <span>Networks: {networks.length}</span>
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
  showNetworkList = true,
  showPropertiesPanel = true,
}: LadderEditorProps) {
  const currentNetworkId = useLadderStore(selectCurrentNetworkId);
  const currentNetwork = useLadderStore(selectCurrentNetwork);
  const mode = useLadderStore(selectMode);
  const networks = useLadderStore(selectNetworksArray);
  const addNetwork = useLadderStore((state) => state.addNetwork);
  const updateNetwork = useLadderStore((state) => state.updateNetwork);

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

  // Create a default network if none exists
  useEffect(() => {
    if (networks.length === 0) {
      addNetwork('Network 1');
    }
  }, [networks.length, addNetwork]);

  // Handle network comment update
  const handleUpdateComment = useCallback(
    (comment: string) => {
      if (currentNetworkId) {
        updateNetwork(currentNetworkId, { comment });
      }
    },
    [currentNetworkId, updateNetwork]
  );

  const isMonitorMode = mode === 'monitor';

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={handleDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className={cn('flex h-full bg-neutral-900', className)}>
        {/* Network List Sidebar */}
        {showNetworkList && (
          <LadderNetworkList className="w-48 shrink-0" />
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <LadderToolbar />

          {/* Content area with toolbox and grid */}
          <div className="flex-1 flex overflow-hidden">
            {/* Toolbox */}
            {showToolbox && (
              <LadderToolbox
                disabled={isMonitorMode}
                className="border-r border-neutral-700 shrink-0"
              />
            )}

            {/* Grid area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Network comment header */}
              {currentNetwork && (
                <NetworkCommentHeader
                  comment={currentNetwork.comment}
                  onUpdateComment={handleUpdateComment}
                  editable={!isMonitorMode}
                />
              )}

              {/* Grid container */}
              <div className="flex-1 overflow-auto p-4">
                {currentNetworkId ? (
                  <LadderGrid
                    networkId={currentNetworkId}
                    readonly={isMonitorMode}
                    showRowNumbers
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-neutral-500">
                    No network selected
                  </div>
                )}
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
