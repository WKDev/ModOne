/**
 * Text Properties Component
 *
 * Property editor for text/annotation blocks.
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { CommonProperties } from './CommonProperties';
import type { TextBlock, TextStyle, Block } from '../../../OneCanvas/types';

// ============================================================================
// Types
// ============================================================================

interface TextPropertiesProps {
  component: TextBlock;
  onChange: (updates: Partial<Block>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const TEXT_STYLES: { value: TextStyle; label: string; description: string }[] = [
  { value: 'label', label: 'Label', description: 'Simple text label' },
  { value: 'title', label: 'Title', description: 'Bold title text' },
  { value: 'note', label: 'Note', description: 'Italic annotation' },
  { value: 'section', label: 'Section', description: 'Section header (uppercase)' },
];

// ============================================================================
// Component
// ============================================================================

export const TextProperties = memo(function TextProperties({
  component,
  onChange,
}: TextPropertiesProps) {
  const [localContent, setLocalContent] = useState(component.content);
  const [localFontSize, setLocalFontSize] = useState(component.fontSize.toString());
  const [localTextColor, setLocalTextColor] = useState(component.textColor);
  const [localBgColor, setLocalBgColor] = useState(component.backgroundColor);

  // Sync local state when component changes
  useEffect(() => {
    setLocalContent(component.content);
    setLocalFontSize(component.fontSize.toString());
    setLocalTextColor(component.textColor);
    setLocalBgColor(component.backgroundColor);
  }, [component.id, component.content, component.fontSize, component.textColor, component.backgroundColor]);

  // Handle content change
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalContent(e.target.value);
  }, []);

  const handleContentBlur = useCallback(() => {
    if (localContent !== component.content) {
      onChange({ content: localContent } as Partial<TextBlock>);
    }
  }, [localContent, component.content, onChange]);

  // Handle text style change
  const handleStyleChange = useCallback((style: TextStyle) => {
    onChange({ textStyle: style } as Partial<TextBlock>);
  }, [onChange]);

  // Handle font size change
  const handleFontSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalFontSize(e.target.value);
  }, []);

  const handleFontSizeBlur = useCallback(() => {
    const value = parseInt(localFontSize, 10);
    if (!isNaN(value) && value >= 8 && value <= 72) {
      onChange({ fontSize: value } as Partial<TextBlock>);
    } else {
      setLocalFontSize(component.fontSize.toString());
    }
  }, [localFontSize, component.fontSize, onChange]);

  // Handle color changes
  const handleTextColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTextColor(e.target.value);
    onChange({ textColor: e.target.value } as Partial<TextBlock>);
  }, [onChange]);

  const handleBgColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalBgColor(e.target.value);
    onChange({ backgroundColor: e.target.value } as Partial<TextBlock>);
  }, [onChange]);

  const handleClearBgColor = useCallback(() => {
    setLocalBgColor('');
    onChange({ backgroundColor: '' } as Partial<TextBlock>);
  }, [onChange]);

  // Handle border toggle
  const handleBorderToggle = useCallback(() => {
    onChange({ showBorder: !component.showBorder } as Partial<TextBlock>);
  }, [component.showBorder, onChange]);

  return (
    <div className="space-y-4">
      <CommonProperties component={component} onChange={onChange} />

      {/* Content */}
      <div>
        <label className="block text-xs text-neutral-400 mb-1">Content</label>
        <textarea
          value={localContent}
          onChange={handleContentChange}
          onBlur={handleContentBlur}
          className="w-full px-2 py-1 bg-neutral-800 border border-neutral-600 rounded text-sm text-white resize-y min-h-[60px]"
          rows={3}
        />
      </div>

      {/* Text Style */}
      <div>
        <label className="block text-xs text-neutral-400 mb-1">Style</label>
        <div className="grid grid-cols-2 gap-1">
          {TEXT_STYLES.map((style) => (
            <button
              key={style.value}
              type="button"
              className={`
                px-2 py-1 rounded text-xs text-left
                ${component.textStyle === style.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }
              `}
              onClick={() => handleStyleChange(style.value)}
              title={style.description}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div>
        <label className="block text-xs text-neutral-400 mb-1">Font Size</label>
        <input
          type="number"
          value={localFontSize}
          onChange={handleFontSizeChange}
          onBlur={handleFontSizeBlur}
          min={8}
          max={72}
          className="w-full px-2 py-1 bg-neutral-800 border border-neutral-600 rounded text-sm text-white"
        />
      </div>

      {/* Text Color */}
      <div>
        <label className="block text-xs text-neutral-400 mb-1">Text Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={localTextColor}
            onChange={handleTextColorChange}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border border-neutral-600"
          />
          <span className="text-xs text-neutral-400">{localTextColor}</span>
        </div>
      </div>

      {/* Background Color */}
      <div>
        <label className="block text-xs text-neutral-400 mb-1">Background</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={localBgColor || '#1a1a1a'}
            onChange={handleBgColorChange}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border border-neutral-600"
          />
          <span className="text-xs text-neutral-400 flex-1">
            {localBgColor || 'Transparent'}
          </span>
          {localBgColor && (
            <button
              type="button"
              onClick={handleClearBgColor}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Border Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-neutral-400">Show Border</label>
        <button
          type="button"
          onClick={handleBorderToggle}
          className={`
            w-10 h-5 rounded-full transition-colors relative
            ${component.showBorder ? 'bg-blue-600' : 'bg-neutral-700'}
          `}
        >
          <span
            className={`
              absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
              ${component.showBorder ? 'left-5' : 'left-0.5'}
            `}
          />
        </button>
      </div>
    </div>
  );
});

export default TextProperties;
