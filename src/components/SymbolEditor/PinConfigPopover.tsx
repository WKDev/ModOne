import { useState, useEffect, useRef } from 'react';
import type { SymbolPin } from '../../types/symbol';

interface PinConfigPopoverProps {
  screenX: number;
  screenY: number;
  canvasX: number;
  canvasY: number;
  onConfirm: (pin: SymbolPin) => void;
  onCancel: () => void;
}

export function PinConfigPopover({
  screenX,
  screenY,
  canvasX,
  canvasY,
  onConfirm,
  onCancel,
}: PinConfigPopoverProps) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [type, setType] = useState<SymbolPin['type']>('input');
  const [orientation, setOrientation] = useState<SymbolPin['orientation']>('right');
  const [length, setLength] = useState(40);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [name, number, type, orientation, length]);

  const handleConfirm = () => {
    onConfirm({
      id: crypto.randomUUID(),
      name,
      number,
      type,
      shape: 'line',
      position: { x: canvasX, y: canvasY },
      orientation,
      length,
    });
  };

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(screenX, window.innerWidth - 260),
    top: Math.min(screenY, window.innerHeight - 320),
    width: 240,
    zIndex: 100,
  };

  return (
    <div
      style={popoverStyle}
      className="bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl p-3 flex flex-col gap-2"
    >
      <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wide mb-1">Add Pin</h4>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-400">Name</label>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
          placeholder="e.g. VCC"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-400">Number</label>
        <input
          type="text"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          className="bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
          placeholder="e.g. 1"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-400">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as SymbolPin['type'])}
          className="bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="input">Input</option>
          <option value="output">Output</option>
          <option value="bidirectional">Bidirectional</option>
          <option value="power">Power</option>
          <option value="passive">Passive</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-400">Orientation</label>
        <select
          value={orientation}
          onChange={(e) => setOrientation(e.target.value as SymbolPin['orientation'])}
          className="bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="right">Right →</option>
          <option value="left">Left ←</option>
          <option value="up">Up ↑</option>
          <option value="down">Down ↓</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-400">Length</label>
        <input
          type="number"
          value={length}
          min={20}
          step={20}
          onChange={(e) => setLength(Number(e.target.value))}
          className="bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          Add Pin
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
