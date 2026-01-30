import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DragMoveEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
} from '@dnd-kit/core';
import { DragState, PanelDragData, DropPosition, getDropPosition } from '../types/dnd';
import { usePanelStore } from '../stores/panelStore';
import { useWindowBoundary } from '../hooks/useWindowBoundary';
import { DEFAULT_FLOATING_WINDOW_SIZE } from '../types/window';

interface ExtendedDragState extends DragState {
  /** Whether dragging outside main window */
  isOutsideMainWindow: boolean;
  /** Screen position when outside window */
  screenPosition: { x: number; y: number } | null;
}

interface FloatingDragState {
  /** Whether a floating panel drag is active (HTML5 drag) */
  isFloatingDragActive: boolean;
  /** Panel ID being dragged from floating window */
  floatingPanelId: string | null;
  /** Window ID of the floating window */
  floatingWindowId: string | null;
}

interface PanelDndContextValue {
  /** Current drag state */
  dragState: ExtendedDragState;
  /** Whether a drag operation is in progress */
  isDragging: boolean;
  /** Floating drag state for HTML5 drag from floating windows */
  floatingDragState: FloatingDragState;
  /** Notify that a floating panel drag has started */
  notifyFloatingDragStart: (panelId: string, windowId: string) => void;
  /** Notify that a floating panel drag has ended */
  notifyFloatingDragEnd: () => void;
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
 * Supports both docking within main window and undocking to floating windows
 */
export function PanelDndProvider({ children }: PanelDndProviderProps) {
  const [dragState, setDragState] = useState<ExtendedDragState>({
    activePanel: null,
    overPanel: null,
    overPosition: null,
    isOutsideMainWindow: false,
    screenPosition: null,
  });

  const [floatingDragState, setFloatingDragState] = useState<FloatingDragState>({
    isFloatingDragActive: false,
    floatingPanelId: null,
    floatingWindowId: null,
  });

  const notifyFloatingDragStart = useCallback((panelId: string, windowId: string) => {
    setFloatingDragState({
      isFloatingDragActive: true,
      floatingPanelId: panelId,
      floatingWindowId: windowId,
    });
  }, []);

  const notifyFloatingDragEnd = useCallback(() => {
    setFloatingDragState({
      isFloatingDragActive: false,
      floatingPanelId: null,
      floatingWindowId: null,
    });
  }, []);

  // Track the last known pointer position for drag end
  const lastPointerPosition = useRef<{ clientX: number; clientY: number } | null>(null);

  const { panels, splitPanel, mergePanelAsTabs, undockPanel } = usePanelStore();
  const { checkPosition, getScreenPosition } = useWindowBoundary();

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
        isOutsideMainWindow: false,
        screenPosition: null,
      });
    }
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    // Track pointer position during drag
    const pointerEvent = event.activatorEvent as PointerEvent;
    if (pointerEvent) {
      lastPointerPosition.current = {
        clientX: pointerEvent.clientX,
        clientY: pointerEvent.clientY,
      };
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over, active } = event;
    const pointerEvent = event.activatorEvent as PointerEvent;

    // Update last pointer position
    if (pointerEvent) {
      lastPointerPosition.current = {
        clientX: pointerEvent.clientX,
        clientY: pointerEvent.clientY,
      };
    }

    // Check if outside main window using current pointer position
    const clientX = lastPointerPosition.current?.clientX ?? 0;
    const clientY = lastPointerPosition.current?.clientY ?? 0;
    const isOutside = checkPosition(clientX, clientY);
    const screenPos = getScreenPosition(clientX, clientY);

    if (isOutside) {
      setDragState((prev) => ({
        ...prev,
        overPanel: null,
        overPosition: null,
        isOutsideMainWindow: true,
        screenPosition: screenPos,
      }));
      return;
    }

    if (!over || !active) {
      setDragState((prev) => ({
        ...prev,
        overPanel: null,
        overPosition: null,
        isOutsideMainWindow: false,
        screenPosition: null,
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
        isOutsideMainWindow: false,
        screenPosition: null,
      }));
      return;
    }

    // Calculate drop position from pointer position
    const overRect = over.rect;

    let dropPosition: DropPosition = 'center';
    if (overRect && pointerEvent) {
      dropPosition = getDropPosition(
        pointerEvent.clientX,
        pointerEvent.clientY,
        overRect as unknown as DOMRect
      );
    }

    setDragState((prev) => ({
      ...prev,
      overPanel: overId,
      overPosition: dropPosition,
      isOutsideMainWindow: false,
      screenPosition: null,
    }));
  }, [checkPosition, getScreenPosition]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeData = active.data.current as PanelDragData | undefined;

    // Check if dropped outside main window - create floating window
    if (dragState.isOutsideMainWindow && dragState.screenPosition && activeData) {
      try {
        await undockPanel(activeData.panelId, {
          x: dragState.screenPosition.x - DEFAULT_FLOATING_WINDOW_SIZE.width / 2,
          y: dragState.screenPosition.y - 20,
          width: DEFAULT_FLOATING_WINDOW_SIZE.width,
          height: DEFAULT_FLOATING_WINDOW_SIZE.height,
        });
      } catch (error) {
        console.error('Failed to create floating window:', error);
      }
    } else if (over && active.id !== over.id && activeData && dragState.overPosition) {
      // Normal docking operation
      const overId = String(over.id);

      if (dragState.overPosition === 'center') {
        // Merge as tabs
        mergePanelAsTabs(overId, activeData.panelId);
      } else {
        // Split operation
        splitPanel(overId, activeData.panelId, dragState.overPosition);
      }
    }

    // Reset drag state
    setDragState({
      activePanel: null,
      overPanel: null,
      overPosition: null,
      isOutsideMainWindow: false,
      screenPosition: null,
    });
    lastPointerPosition.current = null;
  }, [panels, splitPanel, mergePanelAsTabs, undockPanel, dragState.overPosition, dragState.isOutsideMainWindow, dragState.screenPosition]);

  const handleDragCancel = useCallback(() => {
    setDragState({
      activePanel: null,
      overPanel: null,
      overPosition: null,
      isOutsideMainWindow: false,
      screenPosition: null,
    });
    lastPointerPosition.current = null;
  }, []);

  const contextValue = useMemo<PanelDndContextValue>(
    () => ({
      dragState,
      isDragging: dragState.activePanel !== null,
      floatingDragState,
      notifyFloatingDragStart,
      notifyFloatingDragEnd,
    }),
    [dragState, floatingDragState, notifyFloatingDragStart, notifyFloatingDragEnd]
  );

  return (
    <PanelDndContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {dragState.activePanel && (
            <div
              className={`p-2 bg-gray-800 border rounded shadow-xl ${
                dragState.isOutsideMainWindow
                  ? 'border-purple-500 opacity-80'
                  : 'border-blue-500 opacity-90'
              }`}
              style={{ width: 200 }}
            >
              <div className="text-sm font-medium text-gray-200">
                {dragState.activePanel.title}
              </div>
              <div className="text-xs text-gray-400">
                {dragState.isOutsideMainWindow
                  ? 'Drop to create floating window'
                  : dragState.activePanel.panelType}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </PanelDndContext.Provider>
  );
}
