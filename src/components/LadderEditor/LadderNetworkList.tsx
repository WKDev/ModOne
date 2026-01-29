/**
 * LadderNetworkList Component
 *
 * Sidebar panel for displaying and managing ladder networks.
 * Supports selection, add, delete, reorder (drag-and-drop) operations.
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { cn } from '../../lib/utils';
import { useLadderStore } from '../../stores/ladderStore';
import type { LadderNetwork } from '../../types/ladder';

export interface LadderNetworkListProps {
  /** Optional class name */
  className?: string;
  /** Whether to show the add button */
  showAddButton?: boolean;
  /** Whether networks can be deleted */
  allowDelete?: boolean;
  /** Called when a network is selected */
  onNetworkSelect?: (networkId: string) => void;
}

export interface NetworkListItemProps {
  /** Network data */
  network: LadderNetwork;
  /** Display index (1-based) */
  index: number;
  /** Whether this network is selected */
  isSelected: boolean;
  /** Whether this is the only network (can't delete) */
  isOnly: boolean;
  /** Whether the item is being dragged */
  isDragging?: boolean;
  /** Called when network is clicked */
  onSelect: () => void;
  /** Called when delete is clicked */
  onDelete: () => void;
  /** Called when insert after is clicked */
  onInsertAfter: () => void;
  /** Called when label is updated */
  onUpdateLabel: (label: string) => void;
  /** Drag handle attributes from useSortable */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

/**
 * NetworkListItem - Single network item in the list
 */
function NetworkListItem({
  network,
  index,
  isSelected,
  isOnly,
  isDragging,
  onSelect,
  onDelete,
  onInsertAfter,
  onUpdateLabel,
  dragHandleProps,
}: NetworkListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(network.label || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Start editing on double-click
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLabel(network.label || `Network ${index}`);
    setIsEditing(true);
  }, [network.label, index]);

  // Save label on blur or Enter
  const handleSave = useCallback(() => {
    const trimmed = editLabel.trim();
    if (trimmed && trimmed !== network.label) {
      onUpdateLabel(trimmed);
    }
    setIsEditing(false);
  }, [editLabel, network.label, onUpdateLabel]);

  // Handle key events in edit mode
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditLabel(network.label || '');
      setIsEditing(false);
    }
  }, [handleSave, network.label]);

  // Handle delete with confirmation for non-empty networks
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOnly) return;

    const hasElements = network.elements.size > 0;
    if (hasElements) {
      const confirmed = window.confirm(
        `Delete "${network.label || `Network ${index}`}"? This network has ${network.elements.size} element(s).`
      );
      if (!confirmed) return;
    }
    onDelete();
  }, [isOnly, network, index, onDelete]);

  // Handle insert after
  const handleInsertAfter = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInsertAfter();
  }, [onInsertAfter]);

  const elementCount = network.elements.size;
  const displayLabel = network.label || `Network ${index}`;

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer',
        'transition-colors',
        isSelected
          ? 'bg-blue-600 text-white'
          : 'hover:bg-neutral-700 text-neutral-300',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-blue-400'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
    >
      {/* Drag handle */}
      <div
        className={cn(
          'w-4 h-4 flex items-center justify-center cursor-grab active:cursor-grabbing',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          isSelected ? 'text-blue-200' : 'text-neutral-500'
        )}
        {...dragHandleProps}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="5" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </div>

      {/* Network index */}
      <span className={cn(
        'w-6 text-center text-xs font-mono',
        isSelected ? 'text-blue-200' : 'text-neutral-500'
      )}>
        {index}
      </span>

      {/* Label (editable) */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full px-1 py-0.5 rounded text-sm',
              'bg-neutral-700 border border-neutral-500',
              'text-neutral-100',
              'focus:outline-none focus:border-blue-500'
            )}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="block truncate text-sm"
            onDoubleClick={handleDoubleClick}
            title={displayLabel}
          >
            {displayLabel}
          </span>
        )}
      </div>

      {/* Element count badge */}
      {elementCount > 0 && (
        <span className={cn(
          'px-1.5 py-0.5 rounded text-[10px] font-medium',
          isSelected ? 'bg-blue-500' : 'bg-neutral-600'
        )}>
          {elementCount}
        </span>
      )}

      {/* Action buttons */}
      <div className={cn(
        'flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
        isSelected && 'opacity-100'
      )}>
        {/* Insert after button */}
        <button
          type="button"
          onClick={handleInsertAfter}
          className={cn(
            'p-1 rounded hover:bg-neutral-600',
            isSelected ? 'text-blue-200' : 'text-neutral-400'
          )}
          title="Insert network after"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Delete button */}
        {!isOnly && (
          <button
            type="button"
            onClick={handleDelete}
            className={cn(
              'p-1 rounded hover:bg-red-500/20',
              isSelected ? 'text-blue-200 hover:text-red-300' : 'text-neutral-400 hover:text-red-400'
            )}
            title="Delete network"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * SortableNetworkItem - Wrapper for NetworkListItem with drag-and-drop support
 */
interface SortableNetworkItemProps extends Omit<NetworkListItemProps, 'isDragging' | 'dragHandleProps'> {
  id: string;
}

function SortableNetworkItem({ id, ...props }: SortableNetworkItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <NetworkListItem
        {...props}
        isDragging={isDragging}
        dragHandleProps={listeners}
      />
    </div>
  );
}

/**
 * LadderNetworkList - Network list sidebar component
 */
export function LadderNetworkList({
  className,
  showAddButton = true,
  allowDelete = true,
  onNetworkSelect,
}: LadderNetworkListProps) {
  const {
    networks,
    currentNetworkId,
    selectNetwork,
    addNetwork,
    removeNetwork,
    updateNetwork,
    reorderNetworks,
  } = useLadderStore(
    useShallow((state) => ({
      networks: state.networks,
      currentNetworkId: state.currentNetworkId,
      selectNetwork: state.selectNetwork,
      addNetwork: state.addNetwork,
      removeNetwork: state.removeNetwork,
      updateNetwork: state.updateNetwork,
      reorderNetworks: state.reorderNetworks,
    }))
  );

  // Setup dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Start drag after 8px movement
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Convert Map to array for rendering
  const networkArray = Array.from(networks.values());

  // Handle network selection
  const handleSelect = useCallback((id: string) => {
    selectNetwork(id);
    onNetworkSelect?.(id);
  }, [selectNetwork, onNetworkSelect]);

  // Handle add network
  const handleAdd = useCallback(() => {
    const newId = addNetwork();
    onNetworkSelect?.(newId);
  }, [addNetwork, onNetworkSelect]);

  // Handle insert after specific network
  const handleInsertAfter = useCallback((afterId: string) => {
    // Find the position to insert
    const afterIndex = networkArray.findIndex(n => n.id === afterId);
    // Add a new network and it will be added at the end by default
    // Then we need to reorder it
    const newId = addNetwork();
    if (afterIndex !== -1 && afterIndex < networkArray.length - 1) {
      // The new network is at the end, move it to after afterIndex
      reorderNetworks(networkArray.length, afterIndex + 1);
    }
    onNetworkSelect?.(newId);
  }, [networkArray, addNetwork, onNetworkSelect, reorderNetworks]);

  // Handle drag end for reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = networkArray.findIndex((n) => n.id === active.id);
      const newIndex = networkArray.findIndex((n) => n.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderNetworks(oldIndex, newIndex);
      }
    }
  }, [networkArray, reorderNetworks]);

  // Handle delete network
  const handleDelete = useCallback((id: string) => {
    if (!allowDelete) return;
    removeNetwork(id);
  }, [allowDelete, removeNetwork]);

  // Handle update label
  const handleUpdateLabel = useCallback((id: string, label: string) => {
    updateNetwork(id, { label });
  }, [updateNetwork]);

  return (
    <div
      className={cn(
        'flex flex-col bg-neutral-800 border-r border-neutral-700',
        'min-w-[180px] max-w-[280px]',
        className
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-neutral-700">
        <h3 className="text-sm font-medium text-neutral-200">Networks</h3>
        <p className="text-[10px] text-neutral-500">{networkArray.length} network(s)</p>
      </div>

      {/* Network list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {networkArray.length === 0 ? (
          <div className="text-center py-4 text-sm text-neutral-500">
            No networks
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={networkArray.map(n => n.id)}
              strategy={verticalListSortingStrategy}
            >
              {networkArray.map((network, index) => (
                <SortableNetworkItem
                  key={network.id}
                  id={network.id}
                  network={network}
                  index={index + 1}
                  isSelected={network.id === currentNetworkId}
                  isOnly={networkArray.length === 1}
                  onSelect={() => handleSelect(network.id)}
                  onDelete={() => handleDelete(network.id)}
                  onInsertAfter={() => handleInsertAfter(network.id)}
                  onUpdateLabel={(label) => handleUpdateLabel(network.id, label)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add button */}
      {showAddButton && (
        <div className="p-2 border-t border-neutral-700">
          <button
            type="button"
            onClick={handleAdd}
            className={cn(
              'w-full flex items-center justify-center gap-2',
              'px-3 py-1.5 rounded text-sm',
              'bg-neutral-700 text-neutral-300',
              'hover:bg-neutral-600 hover:text-neutral-200',
              'transition-colors'
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Network
          </button>
        </div>
      )}
    </div>
  );
}

export default LadderNetworkList;
