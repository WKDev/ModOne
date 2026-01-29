/**
 * LadderEditor Component
 *
 * Main ladder diagram editor with drag-and-drop support.
 * Integrates the toolbox, grid, and DnD context.
 */

import { useCallback, useEffect } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { cn } from '../../lib/utils';
import { useLadderStore, selectCurrentNetworkId, selectMode, selectNetworksArray } from '../../stores/ladderStore';
import { LadderGrid } from './LadderGrid';
import { LadderToolbox } from './LadderToolbox';
import { useLadderDragDrop } from '../../hooks/useLadderDragDrop';

export interface LadderEditorProps {
  /** Optional additional class names */
  className?: string;
  /** Whether to show the toolbox */
  showToolbox?: boolean;
  /** Toolbox position */
  toolboxPosition?: 'left' | 'right';
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
 * LadderEditor - Main ladder diagram editor component
 */
export function LadderEditor({
  className,
  showToolbox = true,
  toolboxPosition = 'left',
}: LadderEditorProps) {
  const currentNetworkId = useLadderStore(selectCurrentNetworkId);
  const mode = useLadderStore(selectMode);
  const networks = useLadderStore(selectNetworksArray);
  const addNetwork = useLadderStore((state) => state.addNetwork);

  // Drag and drop handlers
  const { handleDragStart, handleDragOver, handleDragEnd } = useLadderDragDrop();

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
  const [activeId, setActiveId] = React.useState<string | null>(null);

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

  const isMonitorMode = mode === 'monitor';

  // Render toolbox
  const toolbox = showToolbox && (
    <LadderToolbox
      disabled={isMonitorMode}
      className={cn(
        toolboxPosition === 'left' ? 'border-r' : 'border-l',
        'border-neutral-700'
      )}
    />
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={handleDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className={cn('flex h-full bg-neutral-900', className)}>
        {/* Toolbox (left) */}
        {toolboxPosition === 'left' && toolbox}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Network tabs (optional - could be added later) */}
          {networks.length > 1 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-neutral-800 border-b border-neutral-700 overflow-x-auto">
              {networks.map((network, index) => (
                <button
                  key={network.id}
                  onClick={() => useLadderStore.getState().selectNetwork(network.id)}
                  className={cn(
                    'px-3 py-1 text-sm rounded transition-colors',
                    network.id === currentNetworkId
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
                  )}
                >
                  {network.label || `Network ${index + 1}`}
                </button>
              ))}
            </div>
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

          {/* Status bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-800 border-t border-neutral-700 text-xs text-neutral-400">
            <div className="flex items-center gap-4">
              <span>Mode: {mode === 'monitor' ? 'Monitor' : 'Edit'}</span>
              {networks.length > 0 && (
                <span>Networks: {networks.length}</span>
              )}
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
        </div>

        {/* Toolbox (right) */}
        {toolboxPosition === 'right' && toolbox}
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        <DragOverlayContent activeId={activeId} />
      </DragOverlay>
    </DndContext>
  );
}

// Need React for useState
import React from 'react';

export default LadderEditor;
