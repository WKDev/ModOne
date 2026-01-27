import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
} from '@dnd-kit/core';
import { DragState, PanelDragData, DropPosition, getDropPosition } from '../types/dnd';
import { usePanelStore } from '../stores/panelStore';

interface PanelDndContextValue {
  /** Current drag state */
  dragState: DragState;
  /** Whether a drag operation is in progress */
  isDragging: boolean;
}

const PanelDndContext = createContext<PanelDndContextValue | null>(null);

/**
 * Hook to access the panel DnD context
 */
export function usePanelDnd(): PanelDndContextValue {
  const context = useContext(PanelDndContext);
  if (!context) {
    throw new Error('usePanelDnd must be used within PanelDndProvider');
  }
  return context;
}

interface PanelDndProviderProps {
  children: React.ReactNode;
}

/**
 * Provider for panel drag-and-drop functionality
 */
export function PanelDndProvider({ children }: PanelDndProviderProps) {
  const [dragState, setDragState] = useState<DragState>({
    activePanel: null,
    overPanel: null,
    overPosition: null,
  });

  const { panels, splitPanel, mergePanelAsTabs } = usePanelStore();

  // Configure sensors with activation constraints to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Require 10px movement before starting drag
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const panelData = active.data.current as PanelDragData | undefined;

    if (panelData) {
      setDragState({
        activePanel: panelData,
        overPanel: null,
        overPosition: null,
      });
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over, active } = event;

    if (!over || !active) {
      setDragState((prev) => ({
        ...prev,
        overPanel: null,
        overPosition: null,
      }));
      return;
    }

    const overId = String(over.id);

    // Don't allow dropping on self
    if (overId === String(active.id)) {
      setDragState((prev) => ({
        ...prev,
        overPanel: null,
        overPosition: null,
      }));
      return;
    }

    // Calculate drop position from pointer position
    const overRect = over.rect;
    const pointerPosition = event.activatorEvent as PointerEvent;

    let dropPosition: DropPosition = 'center';
    if (overRect && pointerPosition) {
      dropPosition = getDropPosition(
        pointerPosition.clientX,
        pointerPosition.clientY,
        overRect as unknown as DOMRect
      );
    }

    setDragState((prev) => ({
      ...prev,
      overPanel: overId,
      overPosition: dropPosition,
    }));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeData = active.data.current as PanelDragData | undefined;
      const overId = String(over.id);

      if (activeData && dragState.overPosition) {
        // Handle the drop based on position
        if (dragState.overPosition === 'center') {
          // Merge as tabs
          mergePanelAsTabs(overId, activeData.panelId);
        } else {
          // Split operation
          splitPanel(overId, activeData.panelId, dragState.overPosition);
        }
      }
    }

    // Reset drag state
    setDragState({
      activePanel: null,
      overPanel: null,
      overPosition: null,
    });
  }, [panels, splitPanel, mergePanelAsTabs, dragState.overPosition]);

  const handleDragCancel = useCallback(() => {
    setDragState({
      activePanel: null,
      overPanel: null,
      overPosition: null,
    });
  }, []);

  const contextValue = useMemo<PanelDndContextValue>(
    () => ({
      dragState,
      isDragging: dragState.activePanel !== null,
    }),
    [dragState]
  );

  return (
    <PanelDndContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {dragState.activePanel && (
            <div
              className="p-2 bg-gray-800 border border-blue-500 rounded shadow-xl opacity-90"
              style={{ width: 200 }}
            >
              <div className="text-sm font-medium text-gray-200">
                {dragState.activePanel.title}
              </div>
              <div className="text-xs text-gray-400">
                {dragState.activePanel.panelType}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </PanelDndContext.Provider>
  );
}
