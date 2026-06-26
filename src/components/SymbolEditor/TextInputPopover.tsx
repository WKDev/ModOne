// 텍스트 프리미티브 입력을 받는 인앱 팝오버 (window.prompt 대체 — WebView2 호환)
import { useState, useEffect, useRef } from 'react';

interface TextInputPopoverProps {
  screenX: number;
  screenY: number;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function TextInputPopover({
  screenX,
  screenY,
  onConfirm,
  onCancel,
}: TextInputPopoverProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (text.trim()) onConfirm(text);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [text, onConfirm, onCancel]);

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(screenX, window.innerWidth - 260),
    top: Math.min(screenY, window.innerHeight - 140),
    width: 240,
    zIndex: 100,
  };

  return (
    <div
      style={popoverStyle}
      data-testid="text-input-popover"
      className="bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl p-3 flex flex-col gap-2"
    >
      <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wide mb-1">Add Text</h4>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-400">Content</label>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
          placeholder="e.g. K1"
        />
      </div>

      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={() => { if (text.trim()) onConfirm(text); }}
          disabled={!text.trim()}
          className="flex-1 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded transition-colors"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
