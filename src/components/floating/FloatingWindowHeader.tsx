/**
 * Floating Window Header
 *
 * Header component for floating windows with title bar and control buttons.
 * Supports Tauri drag region for window movement.
 */

import { ArrowDownLeft, Minus, Square, X } from 'lucide-react';

interface FloatingWindowHeaderProps {
  /** Window title */
  title: string;
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
  onDock,
  onMinimize,
  onMaximize,
  onClose,
}: FloatingWindowHeaderProps) {
  return (
    <div
      className="h-8 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-2 select-none flex-shrink-0"
      data-tauri-drag-region
    >
      {/* Title - clickable area for dragging */}
      <span
        className="text-sm text-gray-200 truncate flex-1"
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
