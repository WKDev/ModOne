import { useDraggable, useDroppable, DraggableAttributes } from '@dnd-kit/core';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { GripVertical } from 'lucide-react';
import { PanelDragData } from '../../types/dnd';
import { PanelState } from '../../types/panel';
import { usePanelDnd } from '../../providers/PanelDndProvider';

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

  // Combine refs
  const setRefs = (node: HTMLDivElement | null) => {
    setDraggableRef(node);
    setDroppableRef(node);
  };

  // Determine if this panel is being hovered for drop
  const isDropTarget = isOver && dragState.overPanel === panel.id;
  const dropPosition = isDropTarget ? dragState.overPosition : null;

  return (
    <div
      ref={setRefs}
      className={`relative flex flex-col rounded overflow-hidden ${
        isActive
          ? 'ring-2 ring-blue-500'
          : 'ring-1 ring-gray-700'
      } bg-gray-800 ${isDragging ? 'opacity-50 shadow-2xl z-50' : ''}`}
      style={{ gridArea: panel.gridArea }}
    >
      {/* Drag handle overlay in header area */}
      <DragHandle
        attributes={attributes}
        listeners={listeners}
        isDragging={isDragging}
      />

      {/* Drop zone overlays when dragging another panel */}
      {isAnyDragging && !isDragging && (
        <DropZoneOverlay
          isOver={isDropTarget}
          dropPosition={dropPosition}
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
}

function DropZoneOverlay({ isOver, dropPosition }: DropZoneOverlayProps) {
  if (!isOver) {
    return (
      <div className="absolute inset-0 z-40 pointer-events-none">
        {/* Semi-transparent overlay to indicate valid drop target */}
        <div className="absolute inset-0 border-2 border-dashed border-gray-600/50 rounded" />
      </div>
    );
  }

  // Render highlighted drop zone based on position
  const getPositionStyles = (): string => {
    switch (dropPosition) {
      case 'top':
        return 'top-0 left-0 right-0 h-1/4 bg-blue-500/30 border-b-2 border-blue-500';
      case 'bottom':
        return 'bottom-0 left-0 right-0 h-1/4 bg-blue-500/30 border-t-2 border-blue-500';
      case 'left':
        return 'top-1/4 bottom-1/4 left-0 w-1/4 bg-blue-500/30 border-r-2 border-blue-500';
      case 'right':
        return 'top-1/4 bottom-1/4 right-0 w-1/4 bg-blue-500/30 border-l-2 border-blue-500';
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
