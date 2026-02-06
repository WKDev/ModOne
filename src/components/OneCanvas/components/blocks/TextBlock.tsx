/**
 * Text/Annotation Block Component
 *
 * Non-electrical block for adding labels, titles, notes, and section headers
 * to the canvas. Excluded from circuit simulation.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { BlockWrapper } from './BlockWrapper';
import type { TextBlock as TextBlockType, TextStyle } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface TextBlockProps {
  /** Block data */
  block: TextBlockType;
  /** Whether the block is selected */
  isSelected?: boolean;
  /** Selection handler */
  onSelect?: (blockId: string, addToSelection: boolean) => void;
  /** Block click handler */
  onBlockClick?: (blockId: string, e: React.MouseEvent) => void;
  /** Drag start handler */
  onDragStart?: (blockId: string, event: React.MouseEvent) => void;
  /** Update handler for editing content */
  onUpdateComponent?: (id: string, updates: Partial<TextBlockType>) => void;
}

// ============================================================================
// Style Presets
// ============================================================================

const STYLE_PRESETS: Record<TextStyle, { fontWeight: string; fontStyle: string; borderStyle: string }> = {
  label: { fontWeight: 'font-normal', fontStyle: '', borderStyle: 'border-neutral-600' },
  title: { fontWeight: 'font-bold', fontStyle: '', borderStyle: 'border-neutral-500' },
  note: { fontWeight: 'font-normal', fontStyle: 'italic', borderStyle: 'border-dashed border-neutral-600' },
  section: { fontWeight: 'font-semibold', fontStyle: 'uppercase tracking-wider', borderStyle: 'border-b-2 border-neutral-500' },
};

// ============================================================================
// Component
// ============================================================================

export const TextBlock = memo(function TextBlock({
  block,
  isSelected = false,
  onSelect,
  onBlockClick,
  onDragStart,
  onUpdateComponent,
}: TextBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(block.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stylePreset = STYLE_PRESETS[block.textStyle] || STYLE_PRESETS.label;

  // Start editing on double-click
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditContent(block.content);
    setIsEditing(true);
  }, [block.content]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Commit edit
  const commitEdit = useCallback(() => {
    setIsEditing(false);
    if (editContent !== block.content && onUpdateComponent) {
      onUpdateComponent(block.id, { content: editContent });
    }
  }, [editContent, block.content, block.id, onUpdateComponent]);

  // Handle key events in edit mode
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(block.content);
    }
    // Stop propagation so canvas shortcuts don't fire during editing
    e.stopPropagation();
  }, [commitEdit, block.content]);

  const bgStyle = block.backgroundColor
    ? { backgroundColor: block.backgroundColor }
    : {};

  return (
    <BlockWrapper
      blockId={block.id}
      isSelected={isSelected}
      onSelect={onSelect}
      onBlockClick={onBlockClick}
      onDragStart={onDragStart}
      width={block.size.width}
      height={block.size.height}
    >
      <div
        className={`
          w-full h-full flex items-center justify-start
          px-2 py-1 overflow-hidden select-none
          ${block.showBorder ? `border ${stylePreset.borderStyle}` : ''}
          ${stylePreset.fontWeight} ${stylePreset.fontStyle}
        `}
        style={{
          ...bgStyle,
          color: block.textColor,
          fontSize: `${block.fontSize}px`,
          lineHeight: 1.3,
        }}
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-transparent border-none outline-none resize-none p-0 m-0"
            style={{
              color: block.textColor,
              fontSize: `${block.fontSize}px`,
              lineHeight: 1.3,
              fontWeight: 'inherit',
              fontStyle: 'inherit',
            }}
          />
        ) : (
          <span className="whitespace-pre-wrap break-words w-full">
            {block.content || 'Double-click to edit'}
          </span>
        )}
      </div>
    </BlockWrapper>
  );
});

export default TextBlock;
