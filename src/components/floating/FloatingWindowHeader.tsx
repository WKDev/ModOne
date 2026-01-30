/**
 * Floating Window Header
 *
 * Header component for floating windows with title bar and control buttons.
 * Supports Tauri drag region for window movement and HTML5 drag for dock-to-main.
 */

import { useCallback, useState } from 'react';
import { ArrowDownLeft, Minus, Square, X, GripVertical } from 'lucide-react';

/** Data transferred when dragging a floating panel to dock */
export interface FloatingPanelDragData {
  windowId: string;
  panelId: string;
  type: 'floating-to-dock';
  title: string;
}

/** MIME type for floating panel drag data */
export const FLOATING_PANEL_MIME_TYPE = 'application/x-floating-panel';

interface FloatingWindowHeaderProps {
  /** Window title */
  title: string;
  /** ID of the Tauri window */
  windowId: string;
  /** ID of the panel in this window */
  panelId: string;
  /** Callback to dock the window back to main */
  onDock: () => void;
  /** Callback to minimize the window */
  onMinimize: () => void;
  /** Callback to maximize/restore the window */
  onMaximize: () => void;
  /** Callback to close the window */
  onClose: () => void;
}

export function FloatingWindowHeader({
  title,
  windowId,
  panelId,
  onDock,
  onMinimize,
  onMaximize,
  onClose,
}: FloatingWindowHeaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      const dragData: FloatingPanelDragData = {
        windowId,
        panelId,
        type: 'floating-to-dock',
        title,
      };
      e.dataTransfer.setData(FLOATING_PANEL_MIME_TYPE, JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'move';
      setIsDragging(true);
    },
    [windowId, panelId, title]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      className={`h-8 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-2 select-none flex-shrink-0 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Drag handle for dock-to-main */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="flex items-center justify-center w-6 h-full cursor-grab hover:bg-gray-700 rounded transition-colors"
        title="Drag to dock in main window"
      >
        <GripVertical size={14} className="text-gray-400" />
      </div>

      {/* Title - Tauri drag region for window movement */}
      <span
        className="text-sm text-gray-200 truncate flex-1 ml-1"
        data-tauri-drag-region
      >
        {title}
      </span>

      {/* Control buttons */}
      <div className="flex items-center gap-1">
        {/* Dock button */}
        <button
          onClick={onDock}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Dock to main window"
        >
          <ArrowDownLeft size={14} />
        </button>

        {/* Minimize button */}
        <button
          onClick={onMinimize}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Minimize"
        >
          <Minus size={14} />
        </button>

        {/* Maximize/Restore button */}
        <button
          onClick={onMaximize}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Maximize"
        >
          <Square size={12} />
        </button>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-600 text-gray-400 hover:text-white transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
