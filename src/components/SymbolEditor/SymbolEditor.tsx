import { useCallback, useMemo, useReducer, useState } from 'react';
import { toast } from 'sonner';
import { Save, X, Layers, FileDown, Play, Pencil } from 'lucide-react';
import type { SymbolDefinition, LibraryScope, TextPrimitive } from '../../types/symbol';
import { EditorToolbar } from './EditorToolbar';
import { PinConfigPopover } from './PinConfigPopover';
import { TextInputPopover } from './TextInputPopover';
import { PropertiesPanel } from './PropertiesPanel';
import { VisualStateBar } from './VisualStateBar';
import { symbolToXml } from '../../services/symbolXmlParser';
import { saveSymbol as saveSymbolToLibrary } from '../../services/symbolService';
import { validateSymbol } from '../../utils/symbolValidation';
import { useSymbolStore } from '../../stores/symbolStore';
import { SymbolEditorHost } from './SymbolEditorHost';

// Editor model / reducer / helpers — split out of this file to keep it small
// (CLAUDE.md → Code Organization). Re-exported below so existing importers
// (SymbolEditorHost, tests) keep using `from './SymbolEditor'`.
import type { SymbolEditorProps, LocalSymbol } from './editorModel';
import { MAX_UNITS } from './editorModel';
import { editorReducer, INITIAL_STATE } from './editorReducer';
import { createBlankSymbol, applyVisualStateOverrides } from './editorHelpers';

// Handler groups extracted into custom hooks (Stage 2 split) — each receives the
// shared editor state/setters and returns its handlers.
import {
  useSymbolHistory,
  useSymbolGeometry,
  useSymbolClipboard,
  useSymbolMultiUnit,
  useSymbolVisualState,
} from './hooks';

export * from './editorModel';
export * from './editorReducer';
export * from './editorHelpers';

// ============================================================================
// Main component
// ============================================================================

export function SymbolEditor({ symbol, projectDir, onClose, onSave }: SymbolEditorProps) {
  const [state, dispatch] = useReducer(editorReducer, INITIAL_STATE);
  const [localSymbol, setLocalSymbol] = useState<LocalSymbol>(() => symbol ?? createBlankSymbol());
  const [activeUnit, setActiveUnit] = useState<number | null>(
    () => (symbol?.units && symbol.units.length > 0) ? 0 : null,
  );
  const [pinPopover, setPinPopover] = useState<{
    screenX: number;
    screenY: number;
    canvasX: number;
    canvasY: number;
  } | null>(null);
  const [textPopover, setTextPopover] = useState<{
    screenX: number;
    screenY: number;
    canvasX: number;
    canvasY: number;
  } | null>(null);

  // Preview mode gates editing shortcuts (declared early so the keyboard
  // handler below can reference it without a temporal-dead-zone error).
  const [previewMode, setPreviewMode] = useState(false);

  const isMultiUnit = localSymbol.units !== undefined && localSymbol.units.length > 0;

  // ── History (undo/redo) ────────────────────────────────────────────────────

  const { historyRef, bumpHistory, handleUndo, handleRedo, canUndo, canRedo } =
    useSymbolHistory(dispatch);

  // ── Primitive / pin geometry handlers ──────────────────────────────────────

  const {
    handleAddPrimitive,
    handleMovePrimitives,
    handleResizePrimitive,
    handleRotatePrimitive,
    handleUpdatePrimitive,
    handleMovePins,
    handleAddPin,
    handleDeleteSelected,
    handleEnsurePrimitiveId,
    handleUpdatePrimitiveLabel,
    handleUpdatePrimitiveText,
    handleUpdatePin,
    getActiveGeometry,
  } = useSymbolGeometry({
    localSymbol,
    setLocalSymbol,
    isMultiUnit,
    activeUnit,
    historyRef,
    bumpHistory,
    dispatch,
    selectedIds: state.selectedIds,
  });

  // ── Clipboard + command keyboard shortcuts ──────────────────────────────────
  // The hook registers the Ctrl/Cmd keyboard effect internally; its returned
  // handlers are driven from there, so the component needs no destructured value.
  useSymbolClipboard({
    selectedIds: state.selectedIds,
    getActiveGeometry,
    handleAddPrimitive,
    handleAddPin,
    handleDeleteSelected,
    dispatch,
    previewMode,
    handleUndo,
    handleRedo,
  });

  // ── Multi-unit management ──────────────────────────────────────────────────

  const { handleEnableMultiUnit, handleAddUnit, handleRemoveUnit } = useSymbolMultiUnit({
    localSymbol,
    setLocalSymbol,
    setActiveUnit,
    historyRef,
    bumpHistory,
    dispatch,
  });

  // ── VisualState management ─────────────────────────────────────────────────

  const {
    visualStateNames,
    handleAddVisualState,
    handleRemoveVisualState,
    handleUpdateVisualStateOverride,
    handleClearVisualStateOverride,
  } = useSymbolVisualState({
    localSymbol,
    setLocalSymbol,
    activeVisualState: state.activeVisualState,
    dispatch,
  });

  // ── Canvas symbol (current unit + visual state overrides applied) ──────────

  const canvasSymbol: SymbolDefinition | null = useMemo(() => {
    // Step 1: resolve multi-unit
    let base: SymbolDefinition;
    if (!isMultiUnit || activeUnit === null) {
      base = localSymbol;
    } else {
      const unit = localSymbol.units?.[activeUnit];
      if (!unit) return localSymbol;
      base = {
        ...localSymbol,
        graphics: unit.graphics,
        pins: unit.pins,
      };
    }

    // Step 2: apply visual state overrides for preview/edit
    if (state.activeVisualState !== null) {
      const variant = localSymbol.visualStates?.[state.activeVisualState];
      if (variant) {
        return {
          ...base,
          graphics: applyVisualStateOverrides(base.graphics, variant),
        };
      }
    }

    return base;
  }, [localSymbol, isMultiUnit, activeUnit, state.activeVisualState]);

  // ── XML Export ─────────────────────────────────────────────────────────────

  const handleExportXml = useCallback(() => {
    const xml = symbolToXml(localSymbol);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${localSymbol.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.symbol.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [localSymbol]);

  // ── Preview mode ───────────────────────────────────────────────────────────
  // Preview is a static, non-editing view: edit handles are hidden and the
  // active visual state can be cycled to inspect the symbol's appearance.
  // (`previewMode` state is declared up top, beside the other editor state.)

  // ── Save to project / global library ───────────────────────────────────────

  const [saveScope, setSaveScope] = useState<LibraryScope>('project');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    // Validate before persisting — block on any validation error.
    const result = validateSymbol(localSymbol);
    if (!result.valid) {
      toast.error('Cannot save symbol', { description: result.errors[0].message });
      return;
    }

    setIsSaving(true);
    try {
      // symbolService already surfaces failures via toast and rethrows.
      await saveSymbolToLibrary(projectDir, localSymbol, saveScope);
      // Refresh the in-memory library so the Toolbox picks the symbol up
      // immediately (the saved symbol becomes loadable/placeable right away).
      await useSymbolStore.getState().loadLibrary(projectDir);
      dispatch({ type: 'MARK_CLEAN' });
      onSave?.(localSymbol);
      toast.success(
        saveScope === 'project'
          ? 'Saved to project library'
          : 'Saved to global library',
        { description: localSymbol.name },
      );
    } catch {
      // Error toast already shown by symbolService; keep editor state intact.
    } finally {
      setIsSaving(false);
    }
  }, [localSymbol, projectDir, saveScope, onSave]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div data-testid="symbol-editor" className="flex flex-col w-full h-full bg-neutral-900 overflow-hidden">
      {/* ─ Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-neutral-800">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">Symbol Editor</h2>
          <span className="text-sm text-neutral-400">{localSymbol.name}</span>
          {state.isDirty && <span className="text-xs text-amber-400">Unsaved</span>}
          {/* Active visual state indicator */}
          {state.activeVisualState && (
            <span className="px-2 py-0.5 text-xs rounded bg-green-900/50 text-green-400 font-medium border border-green-800/60">
              State: {state.activeVisualState}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Edit / Preview toggle */}
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors ${
              previewMode
                ? 'bg-amber-600 text-white hover:bg-amber-500'
                : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
            }`}
            title={previewMode ? 'Switch to Edit mode' : 'Switch to Preview mode'}
          >
            {previewMode ? <><Pencil size={14} /> Edit</> : <><Play size={14} /> Preview</>}
          </button>

          {!isMultiUnit && !previewMode && (
            <button
              type="button"
              onClick={handleEnableMultiUnit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
              title="Enable multi-unit mode"
            >
              <Layers size={14} />
              Multi-Unit
            </button>
          )}

          {/* XML Export */}
          <button
            type="button"
            onClick={handleExportXml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
            title="Export as XML"
          >
            <FileDown size={14} />
            XML
          </button>

          {/* Save target library scope */}
          <select
            data-testid="save-scope-select"
            value={saveScope}
            onChange={(e) => setSaveScope(e.target.value as LibraryScope)}
            disabled={isSaving}
            className="px-2 py-1.5 text-sm rounded bg-neutral-700 text-neutral-200 border border-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            title="Library to save into"
          >
            <option value="project">Project</option>
            <option value="global">Global</option>
          </select>

          <button
            type="button"
            data-testid="save-to-library-btn"
            onClick={handleSave}
            disabled={isSaving}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded text-white transition-colors ${
              isSaving ? 'bg-neutral-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'
            }`}
            title={`Save to ${saveScope} library`}
          >
            <Save size={14} />
            {isSaving ? 'Saving…' : 'Save to Library'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-700"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* ─ Multi-unit tab bar ──────────────────────────────────────────────── */}
      {isMultiUnit && localSymbol.units && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-neutral-700 bg-neutral-800/80">
          {localSymbol.units.map((unit, i) => (
            <button
              key={unit.unitId}
              type="button"
              onClick={() => setActiveUnit(i)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                activeUnit === i
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-600'
              }`}
            >
              {unit.name}
              {localSymbol.units!.length > 1 && (
                <span
                  role="button"
                  tabIndex={0}
                  className="ml-1.5 text-[10px] opacity-60 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); handleRemoveUnit(i); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleRemoveUnit(i); } }}
                >
                  &times;
                </span>
              )}
            </button>
          ))}
          {localSymbol.units.length < MAX_UNITS && (
            <button
              type="button"
              onClick={handleAddUnit}
              className="px-2 py-1 text-xs rounded bg-neutral-700 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-600"
            >
              +
            </button>
          )}
        </div>
      )}

      {/* ─ VisualState tab bar ─────────────────────────────────────────────── */}
      <VisualStateBar
        stateNames={visualStateNames}
        activeState={state.activeVisualState}
        onStateChange={(s) => dispatch({ type: 'SET_VISUAL_STATE', state: s })}
        onAddState={handleAddVisualState}
        onRemoveState={handleRemoveVisualState}
        previewMode={previewMode}
      />

      {/* ─ Main body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <div data-testid="symbol-editor-toolbar">
          <EditorToolbar
            currentTool={state.currentTool}
            onToolChange={(tool) => dispatch({ type: 'SET_TOOL', tool })}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />
        </div>

        {/* PixiJS drawing canvas */}
        <div data-testid="symbol-editor-canvas" className="relative flex-1 overflow-hidden">
          <SymbolEditorHost
            symbol={canvasSymbol}
            currentTool={previewMode ? 'select' : state.currentTool}
            selectedIds={state.selectedIds}
            dispatch={dispatch}
            onAddPrimitive={previewMode ? undefined : handleAddPrimitive}
            onMovePrimitives={previewMode ? undefined : handleMovePrimitives}
            onMovePins={previewMode ? undefined : handleMovePins}
            onResizePrimitive={previewMode ? undefined : handleResizePrimitive}
            onRotatePrimitive={previewMode ? undefined : handleRotatePrimitive}
            onUpdatePrimitive={previewMode ? undefined : handleUpdatePrimitive}
            onDeleteSelected={previewMode ? undefined : handleDeleteSelected}
            onOpenPinPopover={previewMode ? undefined : (screenX, screenY, canvasX, canvasY) => {
              setPinPopover({ screenX, screenY, canvasX, canvasY });
            }}
            onOpenTextPopover={previewMode ? undefined : (screenX, screenY, canvasX, canvasY) => {
              setTextPopover({ screenX, screenY, canvasX, canvasY });
            }}
            editingPolylineIndex={state.editingPolylineIndex}
            activeVisualState={state.activeVisualState}
            style={{ width: '100%', height: '100%' }}
          />

          {/* Visual state context overlay — shown when editing a non-base state */}
          {!previewMode && state.activeVisualState && (
            <div
              data-testid="visual-state-canvas-badge"
              className="pointer-events-none absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-900/75 px-3 py-0.5 text-xs font-medium text-purple-200 backdrop-blur-sm"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
              Editing: <span className="font-bold">{state.activeVisualState}</span>
            </div>
          )}

          {/* Preview mode overlay */}
          {previewMode && (
            <div
              data-testid="preview-mode-overlay"
              className="pointer-events-none absolute inset-0 z-10 rounded border-2 border-amber-500/30"
            />
          )}
        </div>

        {/* Right properties panel */}
        <PropertiesPanel
          symbol={localSymbol}
          onChange={setLocalSymbol}
          projectDir={projectDir}
          isDirty={state.isDirty}
          onSaveSuccess={() => dispatch({ type: 'MARK_CLEAN' })}
          selectedIds={state.selectedIds}
          activeUnit={activeUnit}
          activeVisualState={state.activeVisualState}
          onUpdateVisualStateOverride={handleUpdateVisualStateOverride}
          onClearVisualStateOverride={handleClearVisualStateOverride}
          onEnsurePrimitiveId={handleEnsurePrimitiveId}
          onUpdatePrimitiveLabel={handleUpdatePrimitiveLabel}
          onUpdatePrimitiveText={handleUpdatePrimitiveText}
          onUpdatePrimitive={handleUpdatePrimitive}
          onUpdatePin={handleUpdatePin}
        />
      </div>

      {/* ─ Pin config popover ──────────────────────────────────────────────── */}
      {pinPopover && (
        <PinConfigPopover
          screenX={pinPopover.screenX}
          screenY={pinPopover.screenY}
          canvasX={pinPopover.canvasX}
          canvasY={pinPopover.canvasY}
          onConfirm={(pin) => {
            handleAddPin(pin);
            setPinPopover(null);
          }}
          onCancel={() => setPinPopover(null)}
        />
      )}

      {/* ─ Text input popover ──────────────────────────────────────────────── */}
      {textPopover && (
        <TextInputPopover
          screenX={textPopover.screenX}
          screenY={textPopover.screenY}
          onConfirm={(text) => {
            const textPrim: TextPrimitive = {
              kind: 'text',
              x: textPopover.canvasX,
              y: textPopover.canvasY,
              text,
              fontSize: 12,
              fontFamily: 'monospace',
              fill: '#333333',
              anchor: 'start',
            };
            handleAddPrimitive(textPrim);
            setTextPopover(null);
          }}
          onCancel={() => setTextPopover(null)}
        />
      )}
    </div>
  );
}

export default SymbolEditor;
