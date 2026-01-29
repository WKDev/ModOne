/**
 * NetworkCommentHeader Component
 *
 * Displays and allows editing of network comments above the grid.
 * Supports multi-line comments with expandable textarea.
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

export interface NetworkCommentHeaderProps {
  /** Current comment text */
  comment?: string;
  /** Called when comment is updated */
  onUpdateComment: (comment: string) => void;
  /** Whether editing is allowed */
  editable?: boolean;
  /** Optional class name */
  className?: string;
  /** Placeholder text when no comment */
  placeholder?: string;
}

/**
 * NetworkCommentHeader - Editable comment header for networks
 */
export function NetworkCommentHeader({
  comment,
  onUpdateComment,
  editable = true,
  className,
  placeholder = 'Click to add a comment...',
}: NetworkCommentHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editValue]);

  // Start editing
  const handleClick = useCallback(() => {
    if (!editable) return;
    setEditValue(comment || '');
    setIsEditing(true);
  }, [editable, comment]);

  // Save comment
  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed !== (comment || '').trim()) {
      onUpdateComment(trimmed);
    }
    setIsEditing(false);
  }, [editValue, comment, onUpdateComment]);

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(comment || '');
      setIsEditing(false);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // Ctrl/Cmd + Enter to save
      e.preventDefault();
      handleSave();
    }
  }, [comment, handleSave]);

  // Toggle expand for long comments
  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const hasComment = comment && comment.trim().length > 0;
  const isMultiLine = comment ? comment.split('\n').length > 1 : false;
  const isLongComment = comment ? comment.length > 100 : false;

  if (isEditing) {
    return (
      <div className={cn('bg-neutral-900 border-b border-neutral-700', className)}>
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder="Enter network comment... (Ctrl+Enter to save, Escape to cancel)"
          className={cn(
            'w-full px-3 py-2 text-sm resize-none',
            'bg-neutral-800 text-neutral-100',
            'border border-neutral-600 rounded',
            'focus:outline-none focus:border-blue-500',
            'placeholder:text-neutral-500'
          )}
          rows={3}
        />
        <div className="flex justify-end gap-2 px-3 py-1 text-[10px] text-neutral-500">
          <span>Ctrl+Enter to save</span>
          <span>|</span>
          <span>Escape to cancel</span>
        </div>
      </div>
    );
  }

  if (!hasComment) {
    return (
      <div
        className={cn(
          'px-3 py-2 bg-neutral-900/50 border-b border-neutral-700/50',
          'cursor-pointer transition-colors',
          editable && 'hover:bg-neutral-800/50',
          className
        )}
        onClick={handleClick}
        role="button"
        tabIndex={editable ? 0 : undefined}
        title={editable ? 'Click to add comment' : undefined}
      >
        <p className="text-sm text-neutral-600 italic">
          {editable ? placeholder : ''}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-neutral-900/70 border-b border-neutral-700',
        'cursor-pointer transition-colors',
        editable && 'hover:bg-neutral-800/70',
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={editable ? 0 : undefined}
      title={editable ? 'Click to edit comment' : undefined}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        {/* Comment icon */}
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
          className="mt-0.5 text-neutral-500 shrink-0"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>

        {/* Comment text */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm text-neutral-400 italic whitespace-pre-wrap',
              !isExpanded && isLongComment && 'line-clamp-2'
            )}
          >
            {comment}
          </p>

          {/* Expand/collapse button for long comments */}
          {(isMultiLine || isLongComment) && (
            <button
              type="button"
              onClick={handleToggleExpand}
              className="mt-1 text-[10px] text-blue-400 hover:text-blue-300"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Edit indicator */}
        {editable && (
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
            className="text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        )}
      </div>
    </div>
  );
}

export default NetworkCommentHeader;
