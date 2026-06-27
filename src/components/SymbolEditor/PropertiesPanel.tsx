import { useState, useCallback, useMemo } from 'react';
import { Save, AlertCircle, Check, Copy, Trash2, Layers2 } from 'lucide-react';
import type { GraphicPrimitive, GraphicPrimitiveOverride, SymbolDefinition, SymbolPin, SymbolVisualVariant } from '../../types/symbol';
import type { BehaviorRule } from '../../types/behaviorRules';
import type { PinUpdate } from './editorModel';
import { saveSymbol } from '../../services/symbolService';
import { validateSymbol } from '../../utils/symbolValidation';
import { BehaviorRulesPanel } from './BehaviorRulesPanel';
import { AnimationsPanel } from './AnimationsPanel';
import { Section, Field, inputClass } from './inspectors/fields';
import { PinInspector } from './inspectors/PinInspector';
import { SymbolPropertiesEditor } from './inspectors/SymbolPropertiesEditor';

// ============================================================================
// Types
// ============================================================================

interface PropertiesPanelProps {
  symbol: SymbolDefinition;
  onChange: (symbol: SymbolDefinition) => void;
  projectDir: string;
  isDirty: boolean;
  onSaveSuccess?: () => void;
  // Shape naming & selection inspection
  selectedIds?: Set<string>;
  activeUnit?: number | null;
  onUpdatePrimitiveLabel?: (index: number, label: string) => void;
  onUpdatePrimitiveText?: (index: number, text: string) => void;
  onUpdatePrimitive?: (index: number, prim: GraphicPrimitive) => void;
  onUpdatePin?: (pinId: string, updates: PinUpdate) => void;
  // Sub-AC 3-1: Visual State context tracking
  /** The currently active VisualState being edited (null = base) */
  activeVisualState?: string | null;
  /** Assign a stable id to the primitive at `index` if it doesn't have one */
  onEnsurePrimitiveId?: (index: number) => void;
  /** Update (merge) a primitive's visual state override */
  onUpdateVisualStateOverride?: (primitiveId: string, override: Partial<GraphicPrimitiveOverride>) => void;
  /** Clear all overrides for a primitive in the active visual state */
  onClearVisualStateOverride?: (primitiveId: string) => void;
}

type SelectedItem =
  | { type: 'primitive'; index: number; primitive: GraphicPrimitive }
  | { type: 'pin'; pin: SymbolPin }
  | null;

// ============================================================================
// Helpers
// ============================================================================

function resolveSelectedItem(
  symbol: SymbolDefinition,
  selectedIds: Set<string> | undefined,
  activeUnit: number | null | undefined,
): SelectedItem {
  if (!selectedIds || selectedIds.size !== 1) return null;

  const [id] = selectedIds;

  // Resolve graphics/pins from active unit or top-level
  const graphics =
    activeUnit != null && symbol.units?.[activeUnit]
      ? symbol.units[activeUnit].graphics
      : symbol.graphics;
  const pins =
    activeUnit != null && symbol.units?.[activeUnit]
      ? symbol.units[activeUnit].pins
      : symbol.pins;

  if (id.startsWith('g-')) {
    const index = parseInt(id.slice(2), 10);
    const primitive = graphics[index];
    if (!primitive) return null;
    return { type: 'primitive', index, primitive };
  }

  const pin = pins.find((p) => p.id === id);
  if (pin) return { type: 'pin', pin };

  return null;
}

function primitiveKindLabel(kind: GraphicPrimitive['kind']): string {
  const labels: Record<GraphicPrimitive['kind'], string> = {
    rect: 'Rectangle',
    circle: 'Circle',
    polyline: 'Polyline',
    arc: 'Arc',
    text: 'Text',
  };
  return labels[kind] ?? kind;
}

/** Resolve the current override record for a primitive in a given visual state */
function resolveOverride(
  symbol: SymbolDefinition,
  stateName: string | null | undefined,
  primitiveId: string | undefined,
): GraphicPrimitiveOverride | undefined {
  if (!stateName || !primitiveId) return undefined;
  const variant = (symbol.visualStates as Record<string, SymbolVisualVariant> | undefined)?.[stateName];
  return variant?.primitiveOverrides?.[primitiveId];
}

// ============================================================================
// Visual State Override Panel
// ============================================================================

interface VisualStateOverridePanelProps {
  /** Currently active visual state name */
  activeVisualState: string;
  /** The primitive being inspected */
  primitiveIndex: number;
  primitive: GraphicPrimitive;
  /** Existing override record for this primitive+state (may be undefined) */
  currentOverride: GraphicPrimitiveOverride | undefined;
  onEnsurePrimitiveId?: (index: number) => void;
  onUpdateOverride?: (primitiveId: string, override: Partial<GraphicPrimitiveOverride>) => void;
  onClearOverride?: (primitiveId: string) => void;
}

/**
 * Compact panel shown inside the Shape Inspector when a named visual state
 * is active.  Displays the current override record for the selected primitive
 * and provides controls to edit or clear it.
 */
function VisualStateOverridePanel({
  activeVisualState,
  primitiveIndex,
  primitive,
  currentOverride,
  onEnsurePrimitiveId,
  onUpdateOverride,
  onClearOverride,
}: VisualStateOverridePanelProps) {
  const primitiveId = primitive.id;
  const hasOverride = currentOverride !== undefined && Object.keys(currentOverride).length > 0;

  // Helper: ensure the primitive has an id, then call the update handler.
  const handleChange = (field: keyof GraphicPrimitiveOverride, value: unknown) => {
    if (!primitiveId) return;
    onUpdateOverride?.(primitiveId, { [field]: value } as Partial<GraphicPrimitiveOverride>);
  };

  return (
    <div className="rounded border border-purple-700/50 bg-purple-950/20 p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers2 size={11} className="text-purple-400" />
          <span className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider">
            Visual State
          </span>
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-700/60 text-purple-200 font-medium">
            {activeVisualState}
          </span>
        </div>

        {hasOverride && primitiveId && (
          <button
            type="button"
            onClick={() => onClearOverride?.(primitiveId)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded bg-neutral-700 text-neutral-400 hover:text-red-300 hover:bg-red-900/30 transition-colors"
            title="Clear all overrides for this state"
          >
            <Trash2 size={10} />
            Clear
          </button>
        )}
      </div>

      {/* No ID — need to enable overrides */}
      {!primitiveId && (
        <div className="space-y-2">
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            This shape has no stable ID. Assign one to enable per-state visual overrides.
          </p>
          <button
            type="button"
            onClick={() => onEnsurePrimitiveId?.(primitiveIndex)}
            className="w-full px-2 py-1.5 text-xs rounded bg-purple-700 hover:bg-purple-600 text-white transition-colors"
          >
            Enable Visual State Overrides
          </button>
        </div>
      )}

      {/* Has ID — show override controls */}
      {primitiveId && (
        <>
          {/* Status badge */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${hasOverride ? 'bg-purple-400' : 'bg-neutral-600'}`}
            />
            <span className="text-[10px] text-neutral-400">
              {hasOverride
                ? `${Object.keys(currentOverride!).length} override${Object.keys(currentOverride!).length > 1 ? 's' : ''} active`
                : 'Inherits base appearance'}
            </span>
          </div>

          {/* Visible toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-400">Visible</span>
            <button
              type="button"
              onClick={() => {
                const nextVisible = currentOverride?.visible === false ? undefined : false;
                if (nextVisible === undefined) {
                  // Remove the visible override
                  if (currentOverride) {
                    const { visible: _v, ...rest } = currentOverride;
                    if (Object.keys(rest).length === 0) {
                      onClearOverride?.(primitiveId);
                    } else {
                      onUpdateOverride?.(primitiveId, rest);
                    }
                  }
                } else {
                  handleChange('visible', nextVisible);
                }
              }}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                currentOverride?.visible === false
                  ? 'bg-red-700/60 text-red-200 hover:bg-red-600/60'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              }`}
            >
              {currentOverride?.visible === false ? 'Hidden' : 'Visible'}
            </button>
          </div>

          {/* Opacity slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">Opacity</span>
              <span className="text-[10px] text-neutral-500 font-mono">
                {currentOverride?.opacity !== undefined
                  ? Math.round(currentOverride.opacity * 100) + '%'
                  : '100% (base)'}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={currentOverride?.opacity ?? 1}
              onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
              className="w-full h-1.5 accent-purple-500"
            />
          </div>

          {/* Stroke color (only for non-text primitives) */}
          {primitive.kind !== 'text' && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-neutral-400">Stroke</span>
              <div className="flex items-center gap-1.5">
                {currentOverride?.stroke !== undefined && (
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {currentOverride.stroke}
                  </span>
                )}
                <input
                  type="color"
                  value={currentOverride?.stroke ?? ('stroke' in primitive ? primitive.stroke : '#ffffff')}
                  onChange={(e) => handleChange('stroke', e.target.value)}
                  className="w-7 h-6 rounded border border-neutral-600 cursor-pointer bg-transparent"
                  title="Stroke color override"
                />
              </div>
            </div>
          )}

          {/* Fill color */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-neutral-400">Fill</span>
            <div className="flex items-center gap-1.5">
              {currentOverride?.fill !== undefined && (
                <span className="text-[10px] text-neutral-500 font-mono">
                  {currentOverride.fill}
                </span>
              )}
              <input
                type="color"
                value={
                  currentOverride?.fill ??
                  ('fill' in primitive ? primitive.fill : '#000000')
                }
                onChange={(e) => handleChange('fill', e.target.value)}
                className="w-7 h-6 rounded border border-neutral-600 cursor-pointer bg-transparent"
                title="Fill color override"
              />
            </div>
          </div>

          {/* Text override (only for text primitives) */}
          {primitive.kind === 'text' && (
            <div className="space-y-1">
              <span className="text-[11px] text-neutral-400 block">Text Override</span>
              <input
                type="text"
                value={currentOverride?.text ?? ''}
                onChange={(e) => handleChange('text', e.target.value || undefined)}
                placeholder={`(base: "${primitive.text}")`}
                className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Shape Inspector Section
// ============================================================================

interface ShapeInspectorProps {
  selectedItem: SelectedItem;
  symbol: SymbolDefinition;
  activeVisualState?: string | null;
  currentOverride?: GraphicPrimitiveOverride;
  onUpdatePrimitiveLabel?: (index: number, label: string) => void;
  onUpdatePrimitiveText?: (index: number, text: string) => void;
  onUpdatePrimitive?: (index: number, prim: GraphicPrimitive) => void;
  onUpdatePin?: (pinId: string, updates: PinUpdate) => void;
  onEnsurePrimitiveId?: (index: number) => void;
  onUpdateVisualStateOverride?: (primitiveId: string, override: Partial<GraphicPrimitiveOverride>) => void;
  onClearVisualStateOverride?: (primitiveId: string) => void;
}

function ShapeInspector({
  selectedItem,
  activeVisualState,
  currentOverride,
  onUpdatePrimitiveLabel,
  onUpdatePrimitiveText,
  onUpdatePrimitive,
  onUpdatePin,
  onEnsurePrimitiveId,
  onUpdateVisualStateOverride,
  onClearVisualStateOverride,
}: ShapeInspectorProps) {
  if (!selectedItem) return null;

  if (selectedItem.type === 'primitive') {
    const { primitive, index } = selectedItem;
    const inNamedState = activeVisualState !== null && activeVisualState !== undefined;

    return (
      <Section title="Shape Inspector" defaultOpen={true} badge={primitiveKindLabel(primitive.kind)}>
        {/* Label field for all primitives */}
        <Field id={`shape-label-${index}`} label="Label / Name">
          <input
            id={`shape-label-${index}`}
            type="text"
            value={primitive.label ?? ''}
            onChange={(e) => onUpdatePrimitiveLabel?.(index, e.target.value)}
            className={inputClass()}
            placeholder={`e.g. ${primitive.kind}_body`}
          />
          <p className="text-[10px] text-neutral-500 mt-0.5">
            Semantic name for identifying this shape element
          </p>
        </Field>

        {/* Text content field — only for text primitives */}
        {primitive.kind === 'text' && (
          <Field id={`shape-text-${index}`} label="Text Content">
            <input
              id={`shape-text-${index}`}
              type="text"
              value={primitive.text}
              onChange={(e) => onUpdatePrimitiveText?.(index, e.target.value)}
              className={inputClass()}
              placeholder="Display text..."
            />
          </Field>
        )}

        {/* Shape ID (read-only) */}
        {primitive.id && (
          <Field id={`shape-id-${index}`} label="Element ID">
            <input
              id={`shape-id-${index}`}
              type="text"
              value={primitive.id}
              readOnly
              className="w-full px-2 py-1.5 bg-neutral-950 border border-neutral-700 rounded text-xs font-mono text-neutral-500 cursor-default"
            />
          </Field>
        )}

        {/* Geometric info (read-only summary) */}
        <div className="rounded bg-neutral-900/60 border border-neutral-700/50 px-3 py-2 text-xs space-y-1">
          <p className="text-neutral-500 font-medium uppercase tracking-wider text-[10px]">Geometry</p>
          {primitive.kind === 'rect' && (
            <p className="text-neutral-400">
              <span className="text-neutral-500">x</span> {primitive.x}&nbsp;&nbsp;
              <span className="text-neutral-500">y</span> {primitive.y}&nbsp;&nbsp;
              <span className="text-neutral-500">w</span> {primitive.width}&nbsp;&nbsp;
              <span className="text-neutral-500">h</span> {primitive.height}
            </p>
          )}
          {primitive.kind === 'circle' && (
            <p className="text-neutral-400">
              <span className="text-neutral-500">cx</span> {primitive.cx}&nbsp;&nbsp;
              <span className="text-neutral-500">cy</span> {primitive.cy}&nbsp;&nbsp;
              <span className="text-neutral-500">r</span> {primitive.r}
            </p>
          )}
          {primitive.kind === 'arc' && (
            <p className="text-neutral-400">
              <span className="text-neutral-500">cx</span> {primitive.cx}&nbsp;&nbsp;
              <span className="text-neutral-500">cy</span> {primitive.cy}&nbsp;&nbsp;
              <span className="text-neutral-500">r</span> {primitive.r}
            </p>
          )}
          {primitive.kind === 'polyline' && (
            <p className="text-neutral-400">
              <span className="text-neutral-500">pts</span> {primitive.points.length}
            </p>
          )}
          {primitive.kind === 'text' && (
            <p className="text-neutral-400">
              <span className="text-neutral-500">x</span> {primitive.x}&nbsp;&nbsp;
              <span className="text-neutral-500">y</span> {primitive.y}&nbsp;&nbsp;
              <span className="text-neutral-500">fs</span> {primitive.fontSize}
            </p>
          )}
        </div>

        {/* Closed-polygon toggle — only for polylines */}
        {primitive.kind === 'polyline' && (
          <label className="flex items-center gap-2 px-1 text-xs text-neutral-300 cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid={`polyline-closed-${index}`}
              checked={!!primitive.closed}
              onChange={(e) =>
                onUpdatePrimitive?.(index, { ...primitive, closed: e.target.checked })
              }
              className="accent-blue-500"
            />
            Closed polygon (connect last point to first)
          </label>
        )}

        {/* ── Visual State Override Section ── */}
        {inNamedState && (
          <VisualStateOverridePanel
            activeVisualState={activeVisualState!}
            primitiveIndex={index}
            primitive={primitive}
            currentOverride={currentOverride}
            onEnsurePrimitiveId={onEnsurePrimitiveId}
            onUpdateOverride={onUpdateVisualStateOverride}
            onClearOverride={onClearVisualStateOverride}
          />
        )}
      </Section>
    );
  }

  if (selectedItem.type === 'pin') {
    return <PinInspector pin={selectedItem.pin} onUpdatePin={onUpdatePin} />;
  }

  return null;
}

// ============================================================================
// Main Component
// ============================================================================

export function PropertiesPanel({
  symbol,
  onChange,
  projectDir,
  isDirty,
  onSaveSuccess,
  selectedIds,
  activeUnit,
  activeVisualState,
  onUpdatePrimitiveLabel,
  onUpdatePrimitiveText,
  onUpdatePrimitive,
  onUpdatePin,
  onEnsurePrimitiveId,
  onUpdateVisualStateOverride,
  onClearVisualStateOverride,
}: PropertiesPanelProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [idCopied, setIdCopied] = useState(false);

  // Resolve selected item once per render
  const selectedItem = useMemo(
    () => resolveSelectedItem(symbol, selectedIds, activeUnit),
    [symbol, selectedIds, activeUnit],
  );

  // Resolve the current visual state override for the selected primitive
  const currentOverride = useMemo(() => {
    if (selectedItem?.type !== 'primitive') return undefined;
    return resolveOverride(symbol, activeVisualState, selectedItem.primitive.id);
  }, [symbol, activeVisualState, selectedItem]);

  const handleChange = useCallback(
    (field: keyof SymbolDefinition, value: string | number) => {
      onChange({
        ...symbol,
        [field]: value,
        updatedAt: new Date().toISOString(),
      });
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field as string];
          return next;
        });
      }
      setSaveMessage(null);
    },
    [symbol, onChange, errors],
  );

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(symbol.id);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }, [symbol.id]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!symbol.name.trim()) {
      newErrors.name = 'Name is required';
      isValid = false;
    }

    if (symbol.width < 20) {
      newErrors.width = 'Width must be at least 20';
      isValid = false;
    }

    if (symbol.height < 20) {
      newErrors.height = 'Height must be at least 20';
      isValid = false;
    }

    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(symbol.version)) {
      newErrors.version = 'Version must be in format X.Y.Z (e.g. 1.0.0)';
      isValid = false;
    }

    const validationResult = validateSymbol(symbol);
    if (!validationResult.valid) {
      validationResult.errors.forEach((err) => {
        if (err.rule === 'non_empty_name') {
          newErrors.name = err.message;
        } else if (err.rule === 'valid_dimensions') {
          if (!newErrors.width && !newErrors.height) {
            newErrors.width = err.message;
          }
        }
      });
      if (validationResult.errors.length > 0 && isValid) {
        const generalErrors = validationResult.errors.filter(
          (e) => e.rule !== 'non_empty_name' && e.rule !== 'valid_dimensions',
        );
        if (generalErrors.length > 0) {
          newErrors.general = generalErrors[0].message;
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      await saveSymbol(projectDir, symbol, 'project');
      setSaveMessage({ type: 'success', text: 'Symbol saved successfully' });
      onSaveSuccess?.();
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Failed to save symbol:', err);
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save symbol',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasSelection = selectedIds && selectedIds.size > 0;
  const multiSelection = selectedIds && selectedIds.size > 1;

  return (
    <div className="w-[280px] flex flex-col bg-neutral-800 border-l border-neutral-700 h-full text-neutral-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-700 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-white">Properties</h3>
        <div className="flex items-center gap-2">
          {/* Active visual state badge in header */}
          {activeVisualState && (
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-700/50 text-purple-300 font-medium">
              {activeVisualState}
            </span>
          )}
          {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-700/60">

        {/* ── Shape / Pin Inspector (shown when selection exists) ── */}
        {hasSelection && !multiSelection && selectedItem && (
          <ShapeInspector
            selectedItem={selectedItem}
            symbol={symbol}
            activeVisualState={activeVisualState}
            currentOverride={currentOverride}
            onUpdatePrimitiveLabel={onUpdatePrimitiveLabel}
            onUpdatePrimitiveText={onUpdatePrimitiveText}
            onUpdatePrimitive={onUpdatePrimitive}
            onUpdatePin={onUpdatePin}
            onEnsurePrimitiveId={onEnsurePrimitiveId}
            onUpdateVisualStateOverride={onUpdateVisualStateOverride}
            onClearVisualStateOverride={onClearVisualStateOverride}
          />
        )}

        {/* Multi-selection notice */}
        {multiSelection && (
          <div className="px-4 py-3">
            <p className="text-xs text-neutral-400 text-center">
              {selectedIds!.size} items selected
            </p>
          </div>
        )}

        {/* ── Symbol Identity ── */}
        <Section title="Symbol Identity" defaultOpen={true}>
          {/* Symbol Name */}
          <Field id="symbol-name" label="Name" required error={errors.name}>
            <input
              id="symbol-name"
              type="text"
              value={symbol.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={inputClass(!!errors.name)}
              placeholder="Symbol Name"
            />
          </Field>

          {/* Symbol ID */}
          <Field id="symbol-id" label="Symbol ID">
            <div className="relative">
              <input
                id="symbol-id"
                type="text"
                value={symbol.id}
                onChange={(e) => handleChange('id', e.target.value)}
                className="w-full px-2 py-1.5 pr-8 bg-neutral-900 border border-neutral-700 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 text-neutral-400"
                placeholder="Unique symbol ID"
                spellCheck={false}
                data-testid="symbol-id-input"
              />
              <button
                type="button"
                onClick={handleCopyId}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-neutral-500 hover:text-neutral-300 transition-colors"
                title="Copy ID"
              >
                {idCopied ? (
                  <Check size={12} className="text-green-400" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 mt-0.5">
              Unique identifier — changing this may break existing references
            </p>
          </Field>
        </Section>

        {/* ── Symbol Metadata ── */}
        <Section title="Metadata" defaultOpen={!hasSelection}>
          {/* Description */}
          <Field id="symbol-desc" label="Description">
            <textarea
              id="symbol-desc"
              value={symbol.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              placeholder="Optional description..."
            />
          </Field>

          {/* Category */}
          <Field id="symbol-category" label="Category">
            <input
              id="symbol-category"
              type="text"
              value={symbol.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className={inputClass()}
              placeholder="e.g. Power, Logic"
            />
          </Field>

          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <Field id="symbol-width" label="Width" error={errors.width}>
              <input
                id="symbol-width"
                type="number"
                min={20}
                step={20}
                value={symbol.width}
                onChange={(e) => handleChange('width', parseInt(e.target.value) || 0)}
                className={inputClass(!!errors.width)}
              />
            </Field>
            <Field id="symbol-height" label="Height" error={errors.height}>
              <input
                id="symbol-height"
                type="number"
                min={20}
                step={20}
                value={symbol.height}
                onChange={(e) => handleChange('height', parseInt(e.target.value) || 0)}
                className={inputClass(!!errors.height)}
              />
            </Field>
          </div>

          {/* Author */}
          <Field id="symbol-author" label="Author">
            <input
              id="symbol-author"
              type="text"
              value={symbol.author || ''}
              onChange={(e) => handleChange('author', e.target.value)}
              className={inputClass()}
              placeholder="Author Name"
            />
          </Field>

          {/* Version */}
          <Field id="symbol-version" label="Version" error={errors.version}>
            <input
              id="symbol-version"
              type="text"
              value={symbol.version}
              onChange={(e) => handleChange('version', e.target.value)}
              className={inputClass(!!errors.version)}
              placeholder="1.0.0"
            />
          </Field>
        </Section>

        {/* ── Symbol Properties (instance params: voltage, netName, …) ── */}
        <Section title="Symbol Properties" defaultOpen={false} badge={
          symbol.properties.length > 0 ? String(symbol.properties.length) : undefined
        }>
          <SymbolPropertiesEditor
            properties={symbol.properties}
            onChange={(properties) =>
              onChange({ ...symbol, properties, updatedAt: new Date().toISOString() })
            }
          />
        </Section>

        {/* ── Behavior Rules (IFTTT) ── */}
        <Section title="Behavior Rules" defaultOpen={false} badge={
          (symbol.behavior?.rules?.length ?? 0) > 0
            ? String(symbol.behavior!.rules!.length)
            : undefined
        }>
          <BehaviorRulesPanel
            rules={symbol.behavior?.rules ?? []}
            pins={symbol.pins}
            graphicIds={symbol.graphics
              .map((g) => g.id)
              .filter((id): id is string => id != null)}
            visualStateNames={Object.keys(symbol.visualStates ?? {})}
            onChange={(rules: BehaviorRule[]) => {
              onChange({
                ...symbol,
                behavior: {
                  ...symbol.behavior,
                  rules,
                },
                updatedAt: new Date().toISOString(),
              });
            }}
          />
        </Section>

        {/* ── Animations ── */}
        <Section title="Animations" defaultOpen={false} badge={
          Object.values(symbol.animations ?? {}).reduce((n, a) => n + a.length, 0) > 0
            ? String(Object.values(symbol.animations ?? {}).reduce((n, a) => n + a.length, 0))
            : undefined
        }>
          <AnimationsPanel
            stateNames={Object.keys(symbol.visualStates ?? {})}
            graphics={symbol.graphics
              .filter((g): g is typeof g & { id: string } => g.id != null)
              .map((g) => ({ id: g.id, label: g.label }))}
            animations={symbol.animations ?? {}}
            onChange={(animations) => {
              onChange({
                ...symbol,
                animations,
                updatedAt: new Date().toISOString(),
              });
            }}
          />
        </Section>

        {/* ── Validation Errors ── */}
        {errors.general && (
          <div className="px-4 py-3">
            <div className="p-2 bg-red-900/30 border border-red-800 rounded flex items-start gap-2">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">{errors.general}</p>
            </div>
          </div>
        )}

        {/* ── Save Message ── */}
        {saveMessage && (
          <div className="px-4 py-3">
            <div
              className={`p-2 border rounded flex items-start gap-2 ${
                saveMessage.type === 'success'
                  ? 'bg-green-900/30 border-green-800 text-green-300'
                  : 'bg-red-900/30 border-red-800 text-red-300'
              }`}
            >
              {saveMessage.type === 'success' ? (
                <Check size={14} className="mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
              )}
              <p className="text-xs">{saveMessage.text}</p>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="p-4 border-t border-neutral-700 bg-neutral-800 shrink-0">
        <button
          data-testid="save-symbol-btn"
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
            isSaving
              ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {isSaving ? (
            <>Saving...</>
          ) : (
            <>
              <Save size={16} />
              Save Symbol
            </>
          )}
        </button>
      </div>
    </div>
  );
}
