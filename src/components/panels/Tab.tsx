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
        border-r border-[var(--color-border)] transition-colors duration-150
        ${isActive
          ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-b-2 border-b-[var(--color-accent)]'
          : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-secondary)] border-b-2 border-b-transparent'
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

      {/* Title (with * prefix when modified) */}
      <span className="flex-1 truncate text-xs font-medium">
        {isModified && <span className="text-[var(--color-text-muted)]">*</span>}
        {title}
      </span>

      {/* Close button */}
      <button
        className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded
          transition-opacity duration-150
          ${isActive || isHovered ? 'opacity-100' : 'opacity-0'}
          hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]`}
        onClick={handleCloseClick}
        title="Close"
      >
        <X size={12} />
      </button>
    </div>
  );
}
