import { X } from 'lucide-react';
import { useState } from 'react';

export interface TabComponentProps {
  id: string;
  icon?: React.ReactNode;
  title: string;
  isActive: boolean;
  isModified: boolean;
  onActivate: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export function Tab({
  id,
  icon,
  title,
  isActive,
  isModified,
  onActivate,
  onClose,
  onContextMenu,
  draggable = true,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: TabComponentProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate();
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(e);
  };

  return (
    <div
      data-tab-id={id}
      className={`group relative flex items-center gap-1.5 px-3 h-8 min-w-[100px] max-w-[180px] cursor-pointer select-none
        border-r border-gray-700 transition-colors duration-150
        ${isActive
          ? 'bg-gray-800 text-gray-100 border-b-2 border-b-blue-500'
          : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-200 border-b-2 border-b-transparent'
        }`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      {/* Icon */}
      {icon && (
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {icon}
        </span>
      )}

      {/* Modified indicator */}
      {isModified && (
        <span
          className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-400"
          title="Unsaved changes"
        />
      )}

      {/* Title */}
      <span className="flex-1 truncate text-xs font-medium">{title}</span>

      {/* Close button */}
      <button
        className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded
          transition-opacity duration-150
          ${isActive || isHovered ? 'opacity-100' : 'opacity-0'}
          hover:bg-gray-600 text-gray-400 hover:text-white`}
        onClick={handleCloseClick}
        title="Close"
      >
        <X size={12} />
      </button>
    </div>
  );
}
