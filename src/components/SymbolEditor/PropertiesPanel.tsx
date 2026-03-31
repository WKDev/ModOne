import { useState, useCallback, useMemo } from 'react';
import { Save, AlertCircle, Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import type { GraphicPrimitive, SymbolDefinition, SymbolPin } from '../../types/symbol';
import type { BehaviorRule } from '../../types/behaviorRules';
import { saveSymbol } from '../../services/symbolService';
import { validateSymbol } from '../../utils/symbolValidation';
import { BehaviorRulesPanel } from './BehaviorRulesPanel';

// ============================================================================
// Types
// ============================================================================

interface PropertiesPanelProps {
  symbol: SymbolDefinition;
  onChange: (symbol: SymbolDefinition) => void;
  projectDir: string;
  isDirty: boolean;
  onSaveSuccess?: () => void;
  // Sub-AC 4-3: shape naming & selection inspection
  selectedIds?: Set<string>;
  activeUnit?: number | null;
  onUpdatePrimitiveLabel?: (index: number, label: string) => void;
  onUpdatePrimitiveText?: (index: number, text: string) => void;
  onUpdatePin?: (pinId: string, updates: Partial<Pick<SymbolPin, 'name' | 'number'>>) => void;
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

// ============================================================================
// Collapsible Section
// ============================================================================

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

function Section({ title, children, defaultOpen = true, badge }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-neutral-700 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-neutral-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">{title}</span>
          {badge && (
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-600/40 text-blue-300 font-medium">
              {badge}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown size={12} className="text-neutral-500" />
        ) : (
          <ChevronRight size={12} className="text-neutral-500" />
        )}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

// ============================================================================
// Field Components
// ============================================================================

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function Field({ id: _id, label, required, error, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-neutral-400">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

const inputClass = (hasError?: boolean) =>
  `w-full px-2 py-1.5 bg-neutral-900 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
    hasError ? 'border-red-500' : 'border-neutral-700'
  }`;

// ============================================================================
// Shape Inspector Section
// ============================================================================

interface ShapeInspectorProps {
  selectedItem: SelectedItem;
  onUpdatePrimitiveLabel?: (index: number, label: string) => void;
  onUpdatePrimitiveText?: (index: number, text: string) => void;
  onUpdatePin?: (pinId: string, updates: Partial<Pick<SymbolPin, 'name' | 'number'>>) => void;
}

function ShapeInspector({
  selectedItem,
  onUpdatePrimitiveLabel,
  onUpdatePrimitiveText,
  onUpdatePin,
}: ShapeInspectorProps) {
  if (!selectedItem) return null;

  if (selectedItem.type === 'primitive') {
    const { primitive, index } = selectedItem;

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
      </Section>
    );
  }

  if (selectedItem.type === 'pin') {
    const { pin } = selectedItem;

    return (
      <Section title="Pin Inspector" defaultOpen={true} badge="Pin">
        <Field id="pin-name" label="Pin Name" required>
          <input
            id="pin-name"
            type="text"
            value={pin.name}
            onChange={(e) => onUpdatePin?.(pin.id, { name: e.target.value })}
            className={inputClass()}
            placeholder="e.g. VCC, GND, IN1"
          />
        </Field>

        <Field id="pin-number" label="Pin Number">
          <input
            id="pin-number"
            type="text"
            value={pin.number}
            onChange={(e) => onUpdatePin?.(pin.id, { number: e.target.value })}
            className={inputClass()}
            placeholder="e.g. 1, A1"
          />
        </Field>

        {/* Pin metadata (read-only) */}
        <div className="rounded bg-neutral-900/60 border border-neutral-700/50 px-3 py-2 text-xs space-y-1">
          <p className="text-neutral-500 font-medium uppercase tracking-wider text-[10px]">Pin Info</p>
          <p className="text-neutral-400">
            <span className="text-neutral-500">type</span>{' '}
            <span className="font-mono">{pin.type}</span>
          </p>
          <p className="text-neutral-400">
            <span className="text-neutral-500">orient</span>{' '}
            <span className="font-mono">{pin.orientation}</span>
          </p>
          <p className="text-neutral-400">
            <span className="text-neutral-500">pos</span>{' '}
            <span className="font-mono">({pin.position.x}, {pin.position.y})</span>
          </p>
        </div>
      </Section>
    );
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
  onUpdatePrimitiveLabel,
  onUpdatePrimitiveText,
  onUpdatePin,
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
        {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-700/60">

        {/* ── Shape / Pin Inspector (shown when selection exists) ── */}
        {hasSelection && !multiSelection && selectedItem && (
          <ShapeInspector
            selectedItem={selectedItem}
            onUpdatePrimitiveLabel={onUpdatePrimitiveLabel}
            onUpdatePrimitiveText={onUpdatePrimitiveText}
            onUpdatePin={onUpdatePin}
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
