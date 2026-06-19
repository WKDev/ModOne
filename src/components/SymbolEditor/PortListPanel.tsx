/**
 * PortListPanel — Symbol Editor Port Management UI
 *
 * Renders a scrollable list of all ports on the current symbol/unit with:
 *  - Add / Delete controls
 *  - Inline field editing (name, number, type, orientation, length, shape)
 *  - Single and multi-select with keyboard support
 *  - Drag-handle reordering (visual only; committed via reorderPorts callback)
 *  - Validation feedback per port
 *
 * Designed to appear in the Symbol Editor right-side panel alongside
 * the existing PropertiesPanel.
 */

import { useCallback, useState } from 'react';
import { Plus, Trash2, GripVertical, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import type { PortDef, PortElectricalType, PortFunctionalRole, PortOrientation, PortShape } from '../../types/port';
import type { UsePortManagerReturn } from '../../hooks/usePortManager';
import { validatePortDef } from '../../types/port';

// ============================================================================
// Constants / Lookup tables
// ============================================================================

const ELECTRICAL_TYPE_LABELS: Record<PortElectricalType, string> = {
  input:          'Input',
  output:         'Output',
  bidirectional:  'Bidirectional',
  power:          'Power',
  passive:        'Passive',
  tri_state:      'Tri-State',
  power_in:       'Power In',
  power_out:      'Power Out',
  open_collector: 'Open Collector',
  open_emitter:   'Open Emitter',
  free:           'Free',
  unspecified:    'Unspecified',
  no_connect:     'No Connect',
};

const ORIENTATION_LABELS: Record<PortOrientation, string> = {
  right: 'Right →',
  left:  'Left ←',
  up:    'Up ↑',
  down:  'Down ↓',
};

const SHAPE_LABELS: Record<PortShape, string> = {
  line:            'Line',
  inverted:        'Inverted ○',
  clock:           'Clock',
  inverted_clock:  'Inverted Clock',
  input_low:       'Input Low',
  clock_low:       'Clock Low',
  output_low:      'Output Low',
  edge_clock_high: 'Edge Clock High',
  non_logic:       'Non-Logic',
};

const FUNCTIONAL_ROLE_LABELS: Record<PortFunctionalRole, string> = {
  general:       'General',
  plc_input:     'PLC Input',
  plc_output:    'PLC Output',
  communication: 'Communication',
};

/** Colour dot for quick visual type identification */
const ELECTRICAL_TYPE_COLOUR: Record<PortElectricalType, string> = {
  input:          'bg-green-500',
  output:         'bg-red-500',
  bidirectional:  'bg-blue-400',
  power:          'bg-yellow-400',
  passive:        'bg-neutral-400',
  tri_state:      'bg-purple-400',
  power_in:       'bg-yellow-300',
  power_out:      'bg-orange-400',
  open_collector: 'bg-pink-400',
  open_emitter:   'bg-pink-300',
  free:           'bg-neutral-500',
  unspecified:    'bg-neutral-500',
  no_connect:     'bg-neutral-600',
};

// ============================================================================
// Props
// ============================================================================

export interface PortListPanelProps {
  /** Port manager returned by usePortManager */
  portManager: UsePortManagerReturn;
  /** Whether the symbol bounding box info is available (for position clamping hints) */
  symbolWidth?: number;
  symbolHeight?: number;
}

// ============================================================================
// PortRow — single editable port row
// ============================================================================

interface PortRowProps {
  port: PortDef;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onToggleExpand: (id: string) => void;
  onUpdate: (id: string, changes: Partial<Omit<PortDef, 'id'>>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
}

function PortRow({
  port,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: PortRowProps) {
  const validationResult = validatePortDef(port);
  const hasErrors = !validationResult.valid;

  const handleFieldChange = <K extends keyof Omit<PortDef, 'id'>>(
    field: K,
    value: PortDef[K],
  ) => {
    onUpdate(port.id, { [field]: value } as Partial<Omit<PortDef, 'id'>>);
  };

  return (
    <div
      data-testid={`port-row-${port.id}`}
      className={`border rounded mb-1 transition-colors cursor-pointer select-none ${
        isSelected
          ? 'border-blue-500 bg-blue-900/30'
          : hasErrors
          ? 'border-red-700 bg-neutral-800/60'
          : 'border-neutral-700 bg-neutral-800/60 hover:border-neutral-500'
      }`}
      onClick={(e) => onSelect(port.id, e.shiftKey || e.ctrlKey || e.metaKey)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(port.id, e.shiftKey || e.ctrlKey || e.metaKey);
        }
      }}
      role="row"
      tabIndex={0}
      aria-selected={isSelected}
    >
      {/* ── Collapsed header row ── */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        {/* Grip handle (visual only) */}
        <span className="text-neutral-600 cursor-grab active:cursor-grabbing flex-shrink-0">
          <GripVertical size={12} />
        </span>

        {/* Type colour dot */}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${ELECTRICAL_TYPE_COLOUR[port.electricalType]}`}
          title={ELECTRICAL_TYPE_LABELS[port.electricalType]}
        />

        {/* Name + number */}
        <span className="flex-1 min-w-0 text-xs text-white font-mono truncate">
          {port.name || <span className="text-neutral-500 italic">unnamed</span>}
          {port.number ? (
            <span className="ml-1 text-neutral-400">[{port.number}]</span>
          ) : null}
        </span>

        {/* Orientation badge */}
        <span className="text-[10px] text-neutral-500 flex-shrink-0">
          {ORIENTATION_LABELS[port.orientation]}
        </span>

        {/* Visibility toggle */}
        <button
          type="button"
          title={port.hidden ? 'Hidden (click to show)' : 'Visible (click to hide)'}
          className="p-0.5 text-neutral-500 hover:text-neutral-200 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            handleFieldChange('hidden', !port.hidden);
          }}
        >
          {port.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>

        {/* Reorder buttons */}
        <button
          type="button"
          title="Move up"
          disabled={isFirst}
          className="p-0.5 text-neutral-500 hover:text-neutral-200 disabled:opacity-30 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onMoveUp(port.id); }}
        >
          <ChevronUp size={11} />
        </button>
        <button
          type="button"
          title="Move down"
          disabled={isLast}
          className="p-0.5 text-neutral-500 hover:text-neutral-200 disabled:opacity-30 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onMoveDown(port.id); }}
        >
          <ChevronDown size={11} />
        </button>

        {/* Expand / collapse */}
        <button
          type="button"
          title={isExpanded ? 'Collapse' : 'Expand to edit'}
          className="p-0.5 text-neutral-500 hover:text-neutral-200 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(port.id); }}
        >
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {/* Delete */}
        <button
          type="button"
          title="Delete port"
          className="p-0.5 text-neutral-600 hover:text-red-400 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete(port.id); }}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* ── Expanded detail editor ── */}
      {isExpanded && (
        <div
          className="px-3 pb-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-neutral-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Name */}
          <div className="col-span-2 space-y-0.5">
            <label className="block text-[10px] text-neutral-400">Name</label>
            <input
              type="text"
              value={port.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="e.g. IN, VCC"
              className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Number */}
          <div className="space-y-0.5">
            <label className="block text-[10px] text-neutral-400">Number</label>
            <input
              type="text"
              value={port.number}
              onChange={(e) => handleFieldChange('number', e.target.value)}
              placeholder="e.g. 1, A1"
              className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Length */}
          <div className="space-y-0.5">
            <label className="block text-[10px] text-neutral-400">Length (px)</label>
            <input
              type="number"
              value={port.length}
              min={10}
              step={10}
              onChange={(e) => handleFieldChange('length', Number(e.target.value))}
              className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Electrical Type */}
          <div className="col-span-2 space-y-0.5">
            <label className="block text-[10px] text-neutral-400">Electrical Type</label>
            <select
              value={port.electricalType}
              onChange={(e) => handleFieldChange('electricalType', e.target.value as PortElectricalType)}
              className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {(Object.keys(ELECTRICAL_TYPE_LABELS) as PortElectricalType[]).map((t) => (
                <option key={t} value={t}>{ELECTRICAL_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Orientation */}
          <div className="space-y-0.5">
            <label className="block text-[10px] text-neutral-400">Orientation</label>
            <select
              value={port.orientation}
              onChange={(e) => handleFieldChange('orientation', e.target.value as PortOrientation)}
              className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {(Object.keys(ORIENTATION_LABELS) as PortOrientation[]).map((o) => (
                <option key={o} value={o}>{ORIENTATION_LABELS[o]}</option>
              ))}
            </select>
          </div>

          {/* Shape */}
          <div className="space-y-0.5">
            <label className="block text-[10px] text-neutral-400">Shape</label>
            <select
              value={port.shape}
              onChange={(e) => handleFieldChange('shape', e.target.value as PortShape)}
              className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {(Object.keys(SHAPE_LABELS) as PortShape[]).map((s) => (
                <option key={s} value={s}>{SHAPE_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Functional Role */}
          <div className="col-span-2 space-y-0.5">
            <label className="block text-[10px] text-neutral-400">Functional Role</label>
            <select
              value={port.functionalRole}
              onChange={(e) => handleFieldChange('functionalRole', e.target.value as PortFunctionalRole)}
              className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {(Object.keys(FUNCTIONAL_ROLE_LABELS) as PortFunctionalRole[]).map((r) => (
                <option key={r} value={r}>{FUNCTIONAL_ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {/* Position */}
          <div className="space-y-0.5">
            <label className="block text-[10px] text-neutral-400">X (px)</label>
            <input
              type="number"
              value={port.position.x}
              step={1}
              onChange={(e) =>
                handleFieldChange('position', { x: Number(e.target.value), y: port.position.y })
              }
              className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-0.5">
            <label className="block text-[10px] text-neutral-400">Y (px)</label>
            <input
              type="number"
              value={port.position.y}
              step={1}
              onChange={(e) =>
                handleFieldChange('position', { x: port.position.x, y: Number(e.target.value) })
              }
              className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Visibility toggles */}
          <div className="col-span-2 flex gap-4">
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={port.nameVisible !== false}
                onChange={(e) => handleFieldChange('nameVisible', e.target.checked)}
                className="w-3 h-3"
              />
              Show name
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={port.numberVisible !== false}
                onChange={(e) => handleFieldChange('numberVisible', e.target.checked)}
                className="w-3 h-3"
              />
              Show number
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={port.hidden === true}
                onChange={(e) => handleFieldChange('hidden', e.target.checked)}
                className="w-3 h-3"
              />
              Hidden
            </label>
          </div>

          {/* Validation errors */}
          {hasErrors && (
            <div className="col-span-2 space-y-0.5">
              {validationResult.errors.map((err) => (
                <p key={`${err.field}-${err.message}`} className="text-[10px] text-red-400">
                  {err.field !== 'general' ? `${String(err.field)}: ` : ''}{err.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PortListPanel
// ============================================================================

export function PortListPanel({ portManager, symbolWidth, symbolHeight }: PortListPanelProps) {
  const {
    ports,
    selectedPortIds,
    selectPorts,
    togglePortSelection,
    deselectAllPorts,
    addPort,
    updatePort,
    deletePorts,
    deleteSelectedPorts,
    reorderPorts,
  } = portManager;

  // Track which port rows are expanded for editing
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (id: string, multi: boolean) => {
      if (multi) {
        togglePortSelection(id);
      } else {
        selectPorts([id]);
      }
    },
    [togglePortSelection, selectPorts],
  );

  const handleMoveUp = useCallback(
    (id: string) => {
      const idx = ports.findIndex((p) => p.id === id);
      if (idx <= 0) return;
      const ordered = ports.map((p) => p.id);
      ordered.splice(idx, 1);
      ordered.splice(idx - 1, 0, id);
      reorderPorts(ordered);
    },
    [ports, reorderPorts],
  );

  const handleMoveDown = useCallback(
    (id: string) => {
      const idx = ports.findIndex((p) => p.id === id);
      if (idx < 0 || idx >= ports.length - 1) return;
      const ordered = ports.map((p) => p.id);
      ordered.splice(idx, 1);
      ordered.splice(idx + 1, 0, id);
      reorderPorts(ordered);
    },
    [ports, reorderPorts],
  );

  const handleAddPort = useCallback(() => {
    // Place new port at the center of the symbol bounding box by default
    const defaultX = symbolWidth != null ? Math.round(symbolWidth / 2) : 0;
    const defaultY = symbolHeight != null ? Math.round(symbolHeight / 2) : 0;
    const newPort = addPort({ position: { x: defaultX, y: defaultY } });
    // Expand the new row immediately for editing
    setExpandedIds((prev) => new Set([...prev, newPort.id]));
    selectPorts([newPort.id]);
  }, [addPort, selectPorts, symbolWidth, symbolHeight]);

  const hasSelection = selectedPortIds.size > 0;

  return (
    <div
      data-testid="port-list-panel"
      className="flex flex-col bg-neutral-800 border-l border-neutral-700 h-full text-neutral-200 w-full"
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-neutral-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-white">Ports</h3>
          <span className="text-[10px] text-neutral-500 bg-neutral-700 rounded-full px-1.5 py-0.5">
            {ports.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {hasSelection && (
            <button
              type="button"
              data-testid="delete-selected-ports-btn"
              title={`Delete ${selectedPortIds.size} selected port(s)`}
              onClick={deleteSelectedPorts}
              className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-700 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            type="button"
            data-testid="add-port-btn"
            title="Add port"
            onClick={handleAddPort}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Port list */}
      <div
        className="flex-1 overflow-y-auto p-2"
        onClick={(e) => {
          // Click on blank area deselects
          if (e.target === e.currentTarget) deselectAllPorts();
        }}
      >
        {ports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-neutral-600">
            <p className="text-xs">No ports defined</p>
            <button
              type="button"
              onClick={handleAddPort}
              className="text-xs text-blue-500 hover:text-blue-400 underline"
            >
              Add first port
            </button>
          </div>
        ) : (
          ports.map((port, index) => (
            <PortRow
              key={port.id}
              port={port}
              isSelected={selectedPortIds.has(port.id)}
              isExpanded={expandedIds.has(port.id)}
              onSelect={handleSelect}
              onToggleExpand={toggleExpand}
              onUpdate={updatePort}
              onDelete={(id) => {
                deletePorts([id]);
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
              }}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              isFirst={index === 0}
              isLast={index === ports.length - 1}
            />
          ))
        )}
      </div>

      {/* Footer: selection summary */}
      {hasSelection && (
        <div className="px-3 py-1.5 border-t border-neutral-700 text-[10px] text-neutral-500">
          {selectedPortIds.size} port{selectedPortIds.size > 1 ? 's' : ''} selected
          {' · '}
          <button
            type="button"
            onClick={deselectAllPorts}
            className="underline hover:text-neutral-300"
          >
            deselect
          </button>
        </div>
      )}
    </div>
  );
}

export default PortListPanel;
