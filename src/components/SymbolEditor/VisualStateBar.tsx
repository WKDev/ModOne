/**
 * VisualStateBar — State tab bar for editing per-state visual overrides
 *
 * Shows tabs for each visual state defined on the symbol.
 * "Base" tab shows the default graphics. Other tabs show the overridden state.
 * Users can add custom state names and remove existing ones.
 */
import { useState } from 'react';
import { Plus, X, Eye, EyeOff } from 'lucide-react';

interface VisualStateBarProps {
  /** Names of all defined visual states (from symbol.visualStates keys) */
  stateNames: string[];
  /** Currently active state being edited (null = base/default) */
  activeState: string | null;
  /** Callback when user switches state tab */
  onStateChange: (state: string | null) => void;
  /** Callback when user adds a new state */
  onAddState: (name: string) => void;
  /** Callback when user removes a state */
  onRemoveState: (name: string) => void;
  /** Whether we're in preview mode */
  previewMode?: boolean;
}

const SUGGESTED_STATES = [
  'energized', 'deenergized', 'lit', 'dark', 'running', 'stopped',
  'open', 'closed', 'pressed', 'released', 'tripped', 'fault',
  'detecting', 'active', 'inactive',
];

export function VisualStateBar({
  stateNames,
  activeState,
  onStateChange,
  onAddState,
  onRemoveState,
  previewMode,
}: VisualStateBarProps) {
  const [showAddInput, setShowAddInput] = useState(false);
  const [newStateName, setNewStateName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleAdd = () => {
    const name = newStateName.trim().toLowerCase().replace(/\s+/g, '_');
    if (name && !stateNames.includes(name)) {
      onAddState(name);
      setNewStateName('');
      setShowAddInput(false);
      setShowSuggestions(false);
      onStateChange(name);
    }
  };

  const handleSuggestionClick = (name: string) => {
    if (!stateNames.includes(name)) {
      onAddState(name);
      setShowSuggestions(false);
      setShowAddInput(false);
      setNewStateName('');
      onStateChange(name);
    }
  };

  const unusedSuggestions = SUGGESTED_STATES.filter((s) => !stateNames.includes(s));

  return (
    <div className="border-b border-neutral-700 bg-neutral-800/80">
      <div className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto">
        {/* Preview mode indicator */}
        {previewMode && (
          <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-amber-400 bg-amber-900/30 rounded mr-2">
            <Eye size={10} /> PREVIEW
          </span>
        )}

        {/* Base state tab */}
        <button
          type="button"
          onClick={() => onStateChange(null)}
          className={`px-3 py-1 text-xs rounded transition-colors shrink-0 ${
            activeState === null
              ? 'bg-blue-600 text-white'
              : 'bg-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-600'
          }`}
        >
          Base
        </button>

        {/* State tabs */}
        {stateNames.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onStateChange(name)}
            className={`group flex items-center gap-1 px-3 py-1 text-xs rounded transition-colors shrink-0 ${
              activeState === name
                ? 'bg-green-600 text-white'
                : 'bg-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-600'
            }`}
          >
            {name}
            <span
              role="button"
              tabIndex={0}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 ml-0.5"
              onClick={(e) => {
                e.stopPropagation();
                if (activeState === name) onStateChange(null);
                onRemoveState(name);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  if (activeState === name) onStateChange(null);
                  onRemoveState(name);
                }
              }}
            >
              <X size={10} />
            </span>
          </button>
        ))}

        {/* Add state button */}
        {!showAddInput ? (
          <button
            type="button"
            onClick={() => { setShowAddInput(true); setShowSuggestions(true); }}
            className="px-2 py-1 text-xs rounded bg-neutral-700 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-600 shrink-0"
            title="Add visual state"
          >
            <Plus size={12} />
          </button>
        ) : (
          <div className="relative flex items-center gap-1 shrink-0">
            <input
              type="text"
              value={newStateName}
              onChange={(e) => setNewStateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setShowAddInput(false); setShowSuggestions(false); }
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="State name..."
              className="w-28 px-2 py-1 text-xs bg-neutral-900 border border-neutral-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAdd}
              className="px-1.5 py-1 text-xs rounded bg-green-700 text-white hover:bg-green-600"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setShowAddInput(false); setShowSuggestions(false); }}
              className="px-1 py-1 text-xs text-neutral-500 hover:text-neutral-300"
            >
              <X size={12} />
            </button>

            {/* Suggestions dropdown */}
            {showSuggestions && unusedSuggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-neutral-800 border border-neutral-600 rounded shadow-lg max-h-48 overflow-y-auto w-48">
                <div className="px-2 py-1 text-[10px] text-neutral-500 uppercase">Suggested</div>
                {unusedSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
