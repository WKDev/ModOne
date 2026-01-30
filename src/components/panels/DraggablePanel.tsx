import { useCallback, useState } from 'react';
import { useDraggable, useDroppable, DraggableAttributes } from '@dnd-kit/core';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { GripVertical } from 'lucide-react';
import { PanelDragData, DropPosition } from '../../types/dnd';
import { PanelState } from '../../types/panel';
import { usePanelDnd } from '../../providers/PanelDndProvider';
import { usePanelStore } from '../../stores/panelStore';
import {
  FLOATING_PANEL_MIME_TYPE,
  type FloatingPanelDragData,
} from '../floating/FloatingWindowHeader';

export interface DraggablePanelProps {
  panel: PanelState;
  isActive: boolean;
  children: React.ReactNode;
}

export function DraggablePanel({
  panel,
  isActive,
  children,
}: DraggablePanelProps) {
  const { dragState, isDragging: isAnyDragging } = usePanelDnd();
  const { dockPanel } = usePanelStore();

  // State for floating panel drag-to-dock
  const [floatingDragOver, setFloatingDragOver] = useState(false);
  const [floatingDropPosition, setFloatingDropPosition] = useState<DropPosition | null>(null);

  // Set up draggable
  const dragData: PanelDragData = {
    panelId: panel.id,
    panelType: panel.type,
    sourceGridArea: panel.gridArea,
    title: panel.title,
  };

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: panel.id,
    data: dragData,
  });

  // Set up droppable
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: panel.id,
  });

  // Calculate drop position based on cursor position within the panel
  const calculateDropPosition = useCallback(
    (e: React.DragEvent): DropPosition => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;

      // Calculate relative position (0-1)
      const relX = x / width;
      const relY = y / height;

      // Center zone for merge (inner 50%)
      const centerZone = 0.25;
      if (relX > centerZone && relX < 1 - centerZone && relY > centerZone && relY < 1 - centerZone) {
        return 'center';
      }

      // Determine edge zone
      if (relY < centerZone) return 'top';
      if (relY > 1 - centerZone) return 'bottom';
      if (relX < centerZone) return 'left';
      if (relX > 1 - centerZone) return 'right';

      return 'center';
    },
    []
  );

  // Handle floating panel drag events
  const handleFloatingDragOver = useCallback(
    (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(FLOATING_PANEL_MIME_TYPE)) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setFloatingDragOver(true);
        setFloatingDropPosition(calculateDropPosition(e));
      }
    },
    [calculateDropPosition]
  );

  const handleFloatingDragLeave = useCallback((e: React.DragEvent) => {
    // Only reset if leaving the panel itself, not entering a child
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setFloatingDragOver(false);
      setFloatingDropPosition(null);
    }
  }, []);

  const handleFloatingDrop = useCallback(
    async (e: React.DragEvent) => {
      const data = e.dataTransfer.getData(FLOATING_PANEL_MIME_TYPE);
      if (data) {
        e.preventDefault();
        e.stopPropagation();
        setFloatingDragOver(false);
        setFloatingDropPosition(null);

        try {
          const { panelId } = JSON.parse(data) as FloatingPanelDragData;
          const dropPos = calculateDropPosition(e);
          // Dock to this panel with the calculated position
          await dockPanel(panelId, panel.id, dropPos);
        } catch (error) {
          console.error('Failed to dock floating panel:', error);
        }
      }
    },
    [calculateDropPosition, dockPanel, panel.id]
  );

  // Combine refs
  const setRefs = (node: HTMLDivElement | null) => {
    setDraggableRef(node);
    setDroppableRef(node);
  };

  // Determine if this panel is being hovered for drop
  const isDropTarget = isOver && dragState.overPanel === panel.id;
  const dropPosition = isDropTarget ? dragState.overPosition : null;

  // Show drop zones for either dnd-kit dragging or floating panel dragging
  const showDropZones = (isAnyDragging && !isDragging) || floatingDragOver;
  const effectiveDropPosition = floatingDragOver ? floatingDropPosition : dropPosition;
  const effectiveIsOver = floatingDragOver || isDropTarget;

  return (
    <div
      ref={setRefs}
      className={`relative flex flex-col rounded overflow-hidden ${
        isActive
          ? 'ring-2 ring-blue-500'
          : 'ring-1 ring-gray-700'
      } bg-gray-800 ${isDragging ? 'opacity-50 shadow-2xl z-50' : ''}`}
      style={{ gridArea: panel.gridArea }}
      onDragOver={handleFloatingDragOver}
      onDragLeave={handleFloatingDragLeave}
      onDrop={handleFloatingDrop}
    >
      {/* Drag handle overlay in header area */}
      <DragHandle
        attributes={attributes}
        listeners={listeners}
        isDragging={isDragging}
      />

      {/* Drop zone overlays when dragging another panel (dnd-kit or floating) */}
      {showDropZones && (
        <DropZoneOverlay
          isOver={effectiveIsOver}
          dropPosition={effectiveDropPosition}
          isFloatingDrag={floatingDragOver}
        />
      )}

      {/* Panel content */}
      {children}
    </div>
  );
}

interface DragHandleProps {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  isDragging: boolean;
}

function DragHandle({ attributes, listeners, isDragging }: DragHandleProps) {
  return (
    <button
      {...attributes}
      {...listeners}
      className={`absolute top-0 left-0 w-6 h-8 flex items-center justify-center z-10
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
        text-gray-500 hover:text-gray-300 hover:bg-gray-600/50 transition-colors`}
      title="Drag to move panel"
    >
      <GripVertical size={14} />
    </button>
  );
}

interface DropZoneOverlayProps {
  isOver: boolean;
  dropPosition: string | null;
  isFloatingDrag?: boolean;
}

function DropZoneOverlay({ isOver, dropPosition, isFloatingDrag = false }: DropZoneOverlayProps) {
  if (!isOver) {
    return (
      <div className="absolute inset-0 z-40 pointer-events-none">
        {/* Semi-transparent overlay to indicate valid drop target */}
        <div className={`absolute inset-0 border-2 border-dashed rounded ${
          isFloatingDrag ? 'border-purple-500/50' : 'border-gray-600/50'
        }`} />
      </div>
    );
  }

  // Render highlighted drop zone based on position
  // Use purple for floating drags, blue for regular dnd-kit drags
  const getPositionStyles = (): string => {
    const color = isFloatingDrag ? 'purple' : 'blue';
    switch (dropPosition) {
      case 'top':
        return `top-0 left-0 right-0 h-1/4 bg-${color}-500/30 border-b-2 border-${color}-500`;
      case 'bottom':
        return `bottom-0 left-0 right-0 h-1/4 bg-${color}-500/30 border-t-2 border-${color}-500`;
      case 'left':
        return `top-1/4 bottom-1/4 left-0 w-1/4 bg-${color}-500/30 border-r-2 border-${color}-500`;
      case 'right':
        return `top-1/4 bottom-1/4 right-0 w-1/4 bg-${color}-500/30 border-l-2 border-${color}-500`;
      case 'center':
        return 'top-1/4 bottom-1/4 left-1/4 right-1/4 bg-green-500/30 border-2 border-dashed border-green-500';
      default:
        return '';
    }
  };

  const getPositionLabel = (): string => {
    switch (dropPosition) {
      case 'top':
        return 'Split Above';
      case 'bottom':
        return 'Split Below';
      case 'left':
        return 'Split Left';
      case 'right':
        return 'Split Right';
      case 'center':
        return 'Merge as Tab';
      default:
        return '';
    }
  };

  return (
    <div className="absolute inset-0 z-40 pointer-events-none">
      <div className={`absolute ${getPositionStyles()} rounded transition-all duration-150 flex items-center justify-center`}>
        <span className="text-xs font-medium text-white bg-black/50 px-2 py-1 rounded">
          {getPositionLabel()}
        </span>
      </div>
    </div>
  );
}
