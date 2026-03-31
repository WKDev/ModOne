/**
 * Behavior Rules Panel — IFTTT-style visual rule editor
 *
 * Allows users to define declarative behavior rules for custom symbols:
 *   IF [condition] THEN [action] ELSE [action]
 *
 * Rules are stored in the symbol's behavior.rules array and serialized to XML.
 */
import { useState, useCallback } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Zap, Eye, ToggleLeft } from 'lucide-react';
import type { BehaviorRule, BehaviorCondition, BehaviorAction, ConditionType, ActionType } from '../../types/behaviorRules';
import type { SymbolPin } from '../../types/symbol';

// ============================================================================
// Types
// ============================================================================

interface BehaviorRulesPanelProps {
  rules: BehaviorRule[];
  pins: SymbolPin[];
  graphicIds: string[];
  onChange: (rules: BehaviorRule[]) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CONDITION_OPTIONS: { value: ConditionType; label: string; group: string }[] = [
  { value: 'port_powered', label: 'Port has power', group: 'Circuit' },
  { value: 'port_voltage_above', label: 'Voltage above threshold', group: 'Circuit' },
  { value: 'port_voltage_below', label: 'Voltage below threshold', group: 'Circuit' },
  { value: 'property_equals', label: 'Property equals value', group: 'State' },
  { value: 'state_is', label: 'Current state is...', group: 'State' },
  { value: 'always', label: 'Always', group: 'Other' },
];

const ACTION_OPTIONS: { value: ActionType; label: string; group: string }[] = [
  { value: 'set_state', label: 'Set visual state', group: 'Visual' },
  { value: 'clear_state', label: 'Clear visual state', group: 'Visual' },
  { value: 'set_property', label: 'Set property value', group: 'Property' },
  { value: 'energize_port', label: 'Energize port (conduct)', group: 'Circuit' },
  { value: 'block_port', label: 'Block port (disconnect)', group: 'Circuit' },
  { value: 'emit_event', label: 'Emit event', group: 'Event' },
];

const VISUAL_STATES = [
  'idle', 'energized', 'deenergized', 'lit', 'dark',
  'running', 'stopped', 'open', 'closed', 'pressed', 'released',
];

const inputClass = 'w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500';
const selectClass = 'w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500';

// ============================================================================
// Condition Editor
// ============================================================================

function ConditionEditor({
  condition,
  pins,
  onChange,
  onRemove,
}: {
  condition: BehaviorCondition;
  pins: SymbolPin[];
  onChange: (c: BehaviorCondition) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-1.5 p-2 bg-blue-950/30 border border-blue-900/50 rounded">
      <Zap size={12} className="text-blue-400 mt-1 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="flex gap-1.5">
          <select
            value={condition.type}
            onChange={(e) => onChange({ ...condition, type: e.target.value as ConditionType })}
            className={selectClass}
          >
            {CONDITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {condition.negate && (
            <span className="px-1.5 py-0.5 text-[10px] bg-red-900/40 text-red-300 rounded shrink-0">NOT</span>
          )}
        </div>

        {/* Port selector for port_* conditions */}
        {condition.type.startsWith('port_') && (
          <select
            value={condition.portId ?? ''}
            onChange={(e) => onChange({ ...condition, portId: e.target.value })}
            className={selectClass}
          >
            <option value="">Select port...</option>
            {pins.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
            ))}
          </select>
        )}

        {/* Threshold for voltage conditions */}
        {(condition.type === 'port_voltage_above' || condition.type === 'port_voltage_below') && (
          <input
            type="number"
            value={condition.threshold ?? 0}
            onChange={(e) => onChange({ ...condition, threshold: Number(e.target.value) })}
            className={inputClass}
            placeholder="Threshold (V)"
          />
        )}

        {/* State name for state_is */}
        {condition.type === 'state_is' && (
          <select
            value={condition.stateName ?? ''}
            onChange={(e) => onChange({ ...condition, stateName: e.target.value })}
            className={selectClass}
          >
            <option value="">Select state...</option>
            {VISUAL_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {/* Property key + value for property_equals */}
        {condition.type === 'property_equals' && (
          <div className="flex gap-1.5">
            <input
              type="text"
              value={condition.propertyKey ?? ''}
              onChange={(e) => onChange({ ...condition, propertyKey: e.target.value })}
              className={inputClass}
              placeholder="Property key"
            />
            <input
              type="text"
              value={condition.value ?? ''}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              className={inputClass}
              placeholder="Value"
            />
          </div>
        )}
      </div>
      <button type="button" onClick={onRemove} className="p-0.5 text-neutral-500 hover:text-red-400 shrink-0">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ============================================================================
// Action Editor
// ============================================================================

function ActionEditor({
  action,
  pins,
  graphicIds: _graphicIds,
  label,
  labelColor,
  onChange,
  onRemove,
}: {
  action: BehaviorAction;
  pins: SymbolPin[];
  graphicIds: string[];
  label: string;
  labelColor: string;
  onChange: (a: BehaviorAction) => void;
  onRemove: () => void;
}) {
  return (
    <div className={`flex items-start gap-1.5 p-2 border rounded ${
      label === 'THEN' ? 'bg-green-950/30 border-green-900/50' : 'bg-amber-950/30 border-amber-900/50'
    }`}>
      <span className={`text-[10px] font-bold mt-0.5 shrink-0 ${labelColor}`}>{label}</span>
      <div className="flex-1 space-y-1.5">
        <select
          value={action.type}
          onChange={(e) => onChange({ ...action, type: e.target.value as ActionType })}
          className={selectClass}
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* State name for set_state/clear_state */}
        {(action.type === 'set_state' || action.type === 'clear_state') && (
          <select
            value={action.stateName ?? ''}
            onChange={(e) => onChange({ ...action, stateName: e.target.value })}
            className={selectClass}
          >
            <option value="">Select state...</option>
            {VISUAL_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {/* Port for energize/block */}
        {(action.type === 'energize_port' || action.type === 'block_port') && (
          <select
            value={action.portId ?? ''}
            onChange={(e) => onChange({ ...action, portId: e.target.value })}
            className={selectClass}
          >
            <option value="">Select port...</option>
            {pins.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
            ))}
          </select>
        )}

        {/* Property key + value for set_property */}
        {action.type === 'set_property' && (
          <div className="flex gap-1.5">
            <input
              type="text"
              value={action.propertyKey ?? ''}
              onChange={(e) => onChange({ ...action, propertyKey: e.target.value })}
              className={inputClass}
              placeholder="Property key"
            />
            <input
              type="text"
              value={action.value ?? ''}
              onChange={(e) => onChange({ ...action, value: e.target.value })}
              className={inputClass}
              placeholder="Value"
            />
          </div>
        )}

        {/* Event name */}
        {action.type === 'emit_event' && (
          <input
            type="text"
            value={action.eventName ?? ''}
            onChange={(e) => onChange({ ...action, eventName: e.target.value })}
            className={inputClass}
            placeholder="Event name"
          />
        )}
      </div>
      <button type="button" onClick={onRemove} className="p-0.5 text-neutral-500 hover:text-red-400 shrink-0">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ============================================================================
// Single Rule Editor
// ============================================================================

function RuleEditor({
  rule,
  index,
  pins,
  graphicIds,
  onChange,
  onRemove,
}: {
  rule: BehaviorRule;
  index: number;
  pins: SymbolPin[];
  graphicIds: string[];
  onChange: (r: BehaviorRule) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const updateCondition = (i: number, c: BehaviorCondition) => {
    const conditions = [...rule.conditions];
    conditions[i] = c;
    onChange({ ...rule, conditions });
  };

  const removeCondition = (i: number) => {
    onChange({ ...rule, conditions: rule.conditions.filter((_, idx) => idx !== i) });
  };

  const addCondition = () => {
    onChange({
      ...rule,
      conditions: [...rule.conditions, { type: 'port_powered' }],
    });
  };

  const updateThenAction = (i: number, a: BehaviorAction) => {
    const thenActions = [...rule.thenActions];
    thenActions[i] = a;
    onChange({ ...rule, thenActions });
  };

  const removeThenAction = (i: number) => {
    onChange({ ...rule, thenActions: rule.thenActions.filter((_, idx) => idx !== i) });
  };

  const addThenAction = () => {
    onChange({
      ...rule,
      thenActions: [...rule.thenActions, { type: 'set_state' }],
    });
  };

  const updateElseAction = (i: number, a: BehaviorAction) => {
    const elseActions = [...rule.elseActions];
    elseActions[i] = a;
    onChange({ ...rule, elseActions });
  };

  const removeElseAction = (i: number) => {
    onChange({ ...rule, elseActions: rule.elseActions.filter((_, idx) => idx !== i) });
  };

  const addElseAction = () => {
    onChange({
      ...rule,
      elseActions: [...rule.elseActions, { type: 'clear_state' }],
    });
  };

  return (
    <div className="border border-neutral-700 rounded-lg overflow-hidden">
      {/* Rule header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-neutral-750 hover:bg-neutral-700 transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="text-xs font-medium flex-1 text-left">
          {rule.name || `Rule ${index + 1}`}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange({ ...rule, enabled: !rule.enabled }); }}
          className={`p-0.5 rounded ${rule.enabled ? 'text-green-400' : 'text-neutral-500'}`}
          title={rule.enabled ? 'Enabled' : 'Disabled'}
        >
          <ToggleLeft size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-0.5 text-neutral-500 hover:text-red-400"
        >
          <Trash2 size={12} />
        </button>
      </button>

      {expanded && (
        <div className="p-3 space-y-3 bg-neutral-800/50">
          {/* Rule name */}
          <input
            type="text"
            value={rule.name ?? ''}
            onChange={(e) => onChange({ ...rule, name: e.target.value })}
            className={inputClass}
            placeholder="Rule name..."
          />

          {/* Condition logic */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-500 uppercase font-bold">IF</span>
            <select
              value={rule.conditionLogic}
              onChange={(e) => onChange({ ...rule, conditionLogic: e.target.value as 'all' | 'any' })}
              className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 rounded text-[10px]"
            >
              <option value="all">ALL conditions match</option>
              <option value="any">ANY condition matches</option>
            </select>
          </div>

          {/* Conditions */}
          <div className="space-y-1.5">
            {rule.conditions.map((c, i) => (
              <ConditionEditor
                key={i}
                condition={c}
                pins={pins}
                onChange={(updated) => updateCondition(i, updated)}
                onRemove={() => removeCondition(i)}
              />
            ))}
            <button
              type="button"
              onClick={addCondition}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-blue-400 hover:text-blue-300"
            >
              <Plus size={10} /> Add condition
            </button>
          </div>

          {/* THEN actions */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-green-400 uppercase font-bold">THEN</span>
            {rule.thenActions.map((a, i) => (
              <ActionEditor
                key={i}
                action={a}
                pins={pins}
                graphicIds={graphicIds}
                label="THEN"
                labelColor="text-green-400"
                onChange={(updated) => updateThenAction(i, updated)}
                onRemove={() => removeThenAction(i)}
              />
            ))}
            <button
              type="button"
              onClick={addThenAction}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-green-400 hover:text-green-300"
            >
              <Plus size={10} /> Add action
            </button>
          </div>

          {/* ELSE actions */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-amber-400 uppercase font-bold">ELSE</span>
            {rule.elseActions.map((a, i) => (
              <ActionEditor
                key={i}
                action={a}
                pins={pins}
                graphicIds={graphicIds}
                label="ELSE"
                labelColor="text-amber-400"
                onChange={(updated) => updateElseAction(i, updated)}
                onRemove={() => removeElseAction(i)}
              />
            ))}
            <button
              type="button"
              onClick={addElseAction}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-amber-400 hover:text-amber-300"
            >
              <Plus size={10} /> Add else action
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Panel
// ============================================================================

export function BehaviorRulesPanel({ rules, pins, graphicIds, onChange }: BehaviorRulesPanelProps) {
  const updateRule = useCallback((index: number, rule: BehaviorRule) => {
    const updated = [...rules];
    updated[index] = rule;
    onChange(updated);
  }, [rules, onChange]);

  const removeRule = useCallback((index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  }, [rules, onChange]);

  const addRule = useCallback(() => {
    const newRule: BehaviorRule = {
      id: `rule_${Date.now()}`,
      name: '',
      priority: rules.length + 1,
      conditionLogic: 'all',
      enabled: true,
      conditions: [{ type: 'port_powered' }],
      thenActions: [{ type: 'set_state', stateName: 'energized' }],
      elseActions: [{ type: 'clear_state', stateName: 'energized' }],
    };
    onChange([...rules, newRule]);
  }, [rules, onChange]);

  return (
    <div className="space-y-3">
      {rules.length === 0 ? (
        <div className="text-center py-4">
          <Eye size={24} className="mx-auto text-neutral-600 mb-2" />
          <p className="text-xs text-neutral-500">No behavior rules defined</p>
          <p className="text-[10px] text-neutral-600 mt-1">
            Add rules to control how this symbol reacts during simulation
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, i) => (
            <RuleEditor
              key={rule.id ?? i}
              rule={rule}
              index={i}
              pins={pins}
              graphicIds={graphicIds}
              onChange={(r) => updateRule(i, r)}
              onRemove={() => removeRule(i)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRule}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-neutral-600 rounded-lg text-xs text-neutral-400 hover:text-neutral-300 hover:border-neutral-500 transition-colors"
      >
        <Plus size={14} />
        Add Behavior Rule
      </button>
    </div>
  );
}
