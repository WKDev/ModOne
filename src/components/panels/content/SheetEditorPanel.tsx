import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileWarning,
  Plus,
  RefreshCw,
  Save,
  FileSpreadsheet,
  Copy,
  Square,
  Type,
  Minus as LineIcon,
  Table2,
  Image,
  X,
  Trash2,
} from 'lucide-react';
import Papa from 'papaparse';
import { explorerService } from '../../../services/explorerService';
import { useEditorAreaStore } from '../../../stores/editorAreaStore';
import { parseSheetXml, serializeSheetXml } from '../../../services/sheetXmlService';
import type {
  SheetDocument,
  SheetElement,
  SheetElementType,
  SheetPage,
  PageSizeKey,
} from '../../../types/sheet';
import { PAGE_SIZES } from '../../../types/sheet';
import { SheetCanvasHost } from './SheetCanvasHost';
import { isEditableTarget } from '@/canvas-core';

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------

interface SheetEditorPanelProps { data?: unknown; }
interface SheetTabData { filePath?: string; relativePath?: string; }

function isSheetTabData(v: unknown): v is SheetTabData { return typeof v === 'object' && v !== null; }
function isSheetXml(p: string): boolean { return p.endsWith('.sheet.xml'); }

/** Clamp to minimum positive value */
function pos(v: number, min = 0.1): number { return Math.max(min, v); }

function createDefaultElement(type: SheetElementType, id: string, cx: number, cy: number): SheetElement {
  switch (type) {
    case 'rect':
      return { id, type: 'rect', x: cx, y: cy, w: 50, h: 30, stroke: 'black', strokeWidth: 0.5, fill: 'none' };
    case 'line':
      return { id, type: 'line', x1: cx, y1: cy, x2: cx + 50, y2: cy, stroke: 'black', strokeWidth: 0.5 };
    case 'text':
      return { id, type: 'text', x: cx, y: cy, content: 'Text', fontSize: 10, fontFamily: 'sans-serif', align: 'left', color: 'black' };
    case 'table':
      return { id, type: 'table', x: cx, y: cy, columns: [{ key: 'A', label: 'A', width: 40 }, { key: 'B', label: 'B', width: 40 }], rows: [{ height: 8, cells: { A: '', B: '' } }], merges: [], stroke: 'black', strokeWidth: 0.35, fontSize: 8, fontFamily: 'sans-serif' };
    case 'image':
      return { id, type: 'image', x: cx, y: cy, w: 30, h: 20, data: '', mimeType: 'image/png' };
  }
}

let _elCtr = 0;
function nextId(): string { return `el-${Date.now()}-${++_elCtr}`; }



// ===========================================================================
// Page Properties Editor (when no element selected)
// ===========================================================================

function PagePropertiesEditor({ doc, onUpdate }: { doc: SheetDocument; onUpdate: (page: Partial<SheetPage>) => void }) {
  const { page } = doc;
  const currentSize = Object.entries(PAGE_SIZES).find(([, s]) => s.width === page.width && s.height === page.height)?.[0] as PageSizeKey | undefined;
  const isLandscape = page.width > page.height;

  const setPageSize = (key: PageSizeKey) => {
    const s = PAGE_SIZES[key];
    onUpdate({ width: s.width, height: s.height });
  };

  const toggleOrientation = () => {
    onUpdate({ width: page.height, height: page.width });
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Page</div>

      <div className="flex items-center gap-2">
        <label className="w-20 text-xs text-[var(--color-text-muted)] text-right">Size</label>
        <select value={currentSize ?? 'custom'} onChange={(e) => { if (e.target.value !== 'custom') setPageSize(e.target.value as PageSizeKey); }}
          className="flex-1 px-1.5 py-0.5 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded">
          {Object.keys(PAGE_SIZES).map(k => <option key={k} value={k}>{k}</option>)}
          {!currentSize && <option value="custom">Custom</option>}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="w-20 text-xs text-[var(--color-text-muted)] text-right">Orientation</label>
        <button type="button" onClick={toggleOrientation}
          className="px-2 py-0.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          {isLandscape ? 'Landscape' : 'Portrait'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="w-20 text-xs text-[var(--color-text-muted)] text-right">Width</label>
        <input type="number" step="1" value={page.width} onChange={(e) => onUpdate({ width: pos(Number(e.target.value), 50) })}
          className="w-20 px-1.5 py-0.5 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-right" />
        <span className="text-[10px] text-[var(--color-text-muted)]">mm</span>
      </div>

      <div className="flex items-center gap-2">
        <label className="w-20 text-xs text-[var(--color-text-muted)] text-right">Height</label>
        <input type="number" step="1" value={page.height} onChange={(e) => onUpdate({ height: pos(Number(e.target.value), 50) })}
          className="w-20 px-1.5 py-0.5 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-right" />
        <span className="text-[10px] text-[var(--color-text-muted)]">mm</span>
      </div>

      <div className="text-xs font-medium text-[var(--color-text-secondary)] mt-2 mb-1">Margins</div>
      {(['top', 'right', 'bottom', 'left'] as const).map(side => (
        <div key={side} className="flex items-center gap-2">
          <label className="w-20 text-xs text-[var(--color-text-muted)] text-right capitalize">{side}</label>
          <input type="number" step="1" value={page.margins[side]}
            onChange={(e) => onUpdate({ margins: { ...page.margins, [side]: pos(Number(e.target.value), 0) } } as any)}
            className="w-20 px-1.5 py-0.5 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-right" />
          <span className="text-[10px] text-[var(--color-text-muted)]">mm</span>
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// Element Properties Editor (enforces positive values)
// ===========================================================================

function PropertiesEditor({ element, onUpdate }: { element: SheetElement; onUpdate: (id: string, updates: Partial<SheetElement>) => void }) {
  const numField = (label: string, key: string, value: number, unit = 'mm', minVal?: number) => (
    <div className="flex items-center gap-2">
      <label className="w-20 text-xs text-[var(--color-text-muted)] text-right">{label}</label>
      <input type="number" step="0.5" value={value}
        onChange={(e) => { const v = Number(e.target.value); onUpdate(element.id, { [key]: minVal != null ? pos(v, minVal) : v } as never); }}
        className="w-20 px-1.5 py-0.5 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-right" />
      <span className="text-[10px] text-[var(--color-text-muted)]">{unit}</span>
    </div>
  );
  const textField = (label: string, key: string, value: string) => (
    <div className="flex items-center gap-2">
      <label className="w-20 text-xs text-[var(--color-text-muted)] text-right">{label}</label>
      <input type="text" value={value} onChange={(e) => onUpdate(element.id, { [key]: e.target.value } as never)}
        className="flex-1 px-1.5 py-0.5 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded" />
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">{element.type.toUpperCase()} — {element.id}</div>
      {element.type === 'rect' && (<>{numField('X', 'x', element.x)}{numField('Y', 'y', element.y)}{numField('Width', 'w', element.w, 'mm', 1)}{numField('Height', 'h', element.h, 'mm', 1)}{textField('Stroke', 'stroke', element.stroke)}{numField('Stroke W', 'strokeWidth', element.strokeWidth, '', 0.1)}{textField('Fill', 'fill', element.fill)}</>)}
      {element.type === 'line' && (<>{numField('X1', 'x1', element.x1)}{numField('Y1', 'y1', element.y1)}{numField('X2', 'x2', element.x2)}{numField('Y2', 'y2', element.y2)}{textField('Stroke', 'stroke', element.stroke)}{numField('Stroke W', 'strokeWidth', element.strokeWidth, '', 0.1)}</>)}
      {element.type === 'text' && (<>{numField('X', 'x', element.x)}{numField('Y', 'y', element.y)}{textField('Content', 'content', element.content)}{numField('Font Size', 'fontSize', element.fontSize, 'pt', 1)}{textField('Font', 'fontFamily', element.fontFamily)}{textField('Color', 'color', element.color)}</>)}
      {element.type === 'table' && (<>{numField('X', 'x', element.x)}{numField('Y', 'y', element.y)}{numField('Font Size', 'fontSize', element.fontSize, 'pt', 1)}<div className="text-[10px] text-[var(--color-text-muted)] mt-1">{element.columns.length} cols x {element.rows.length} rows</div></>)}
      {element.type === 'image' && (<>{numField('X', 'x', element.x)}{numField('Y', 'y', element.y)}{numField('Width', 'w', element.w, 'mm', 1)}{numField('Height', 'h', element.h, 'mm', 1)}</>)}
    </div>
  );
}

// ===========================================================================
// Template Variables Popup
// ===========================================================================

function TemplatePopup({ doc, onUpdate, onAdd, onRemove, onClose }: {
  doc: SheetDocument;
  onUpdate: (key: string, value: string) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Template Variables</h2>
            <button type="button" onClick={onClose} className="p-1 hover:bg-[var(--color-bg-secondary)] rounded"><X size={16} /></button>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto space-y-2">
            <p className="text-xs text-[var(--color-text-muted)] mb-2">
              Use <code className="bg-[var(--color-bg-secondary)] px-1 rounded">{'${varName}'}</code> in text and table cells.
            </p>
            {doc.templates.map(t => (
              <div key={t.key} className="flex items-center gap-2">
                <code className="w-28 px-2 py-1 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-[var(--color-text-muted)] truncate">{t.key}</code>
                <span className="text-xs">=</span>
                <input type="text" value={t.value} onChange={(e) => onUpdate(t.key, e.target.value)}
                  className="flex-1 px-2 py-1 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded" />
                <button type="button" onClick={() => onRemove(t.key)} className="p-1 text-[var(--color-error)] hover:bg-[var(--color-bg-secondary)] rounded"><Trash2 size={12} /></button>
              </div>
            ))}
            {doc.templates.length === 0 && <p className="text-xs text-[var(--color-text-muted)] italic text-center py-4">No templates defined yet.</p>}
          </div>
          <div className="px-4 py-3 border-t border-[var(--color-border)] flex justify-between">
            <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"><Plus size={12} /> Add Variable</button>
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded bg-[var(--color-accent)] text-white">Done</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ===========================================================================
// Main Component
// ===========================================================================

export const SheetEditorPanel = memo(function SheetEditorPanel({ data }: SheetEditorPanelProps) {
  const tabData = isSheetTabData(data) ? data : undefined;
  const filePath = tabData?.filePath;
  const relativePath = tabData?.relativePath;
  const isSheet = filePath ? isSheetXml(filePath) : false;

  const [sheetDoc, setSheetDoc] = useState<SheetDocument | null>(null);
  const [grid, setGrid] = useState<string[][]>([['']]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModified, setIsModified] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showTemplatePopup, setShowTemplatePopup] = useState(false);

  const findTabByFilePath = useEditorAreaStore((s) => s.findTabByFilePath);
  const updateTabModified = useEditorAreaStore((s) => s.updateTabModified);

  const loadFile = useCallback(async () => {
    if (!filePath) return;
    setIsLoading(true);
    setError(null);
    try {
      const content = await explorerService.readFileContents(filePath);
      if (isSheetXml(filePath)) {
        setSheetDoc(parseSheetXml(content));
      } else {
        const result = Papa.parse<string[]>(content, { skipEmptyLines: false });
        const rows = Array.isArray(result.data) ? result.data : [];
        const normalized = rows.length === 0 ? [['']] : rows;
        const maxCols = Math.max(1, ...normalized.map(r => r.length));
        setGrid(normalized.map(r => r.length >= maxCols ? r : [...r, ...Array(maxCols - r.length).fill('')]));
      }
      setIsModified(false);
    } catch (err) {
      setError(`Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [filePath]);

  useEffect(() => { void loadFile(); }, [loadFile]);
  useEffect(() => { if (!filePath) return; const tab = findTabByFilePath(filePath); if (tab) updateTabModified(tab.id, isModified); }, [filePath, findTabByFilePath, isModified, updateTabModified]);

  const saveFile = useCallback(async () => {
    if (!filePath) return;
    setIsSaving(true);
    try {
      await explorerService.writeFileContents(filePath, isSheet && sheetDoc ? serializeSheetXml(sheetDoc) : Papa.unparse(grid));
      setIsModified(false);
    } catch (err) {
      setError(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  }, [filePath, isSheet, sheetDoc, grid]);

  const markModified = useCallback(() => setIsModified(true), []);

  const selectedElement = useMemo(() => sheetDoc?.elements.find(e => e.id === selectedElementId) ?? null, [sheetDoc, selectedElementId]);

  const updateElement = useCallback((id: string, updates: Partial<SheetElement>) => {
    setSheetDoc(prev => prev ? { ...prev, elements: prev.elements.map(el => el.id === id ? { ...el, ...updates } as SheetElement : el) } : prev);
    setIsModified(true);
  }, []);

  const addElement = useCallback((type: SheetElementType) => {
    if (!sheetDoc) return;
    const id = nextId();
    const cx = sheetDoc.page.width / 2 - 25;
    const cy = sheetDoc.page.height / 2 - 15;
    setSheetDoc(prev => prev ? { ...prev, elements: [...prev.elements, createDefaultElement(type, id, cx, cy)] } : prev);
    setSelectedElementId(id);
    setIsModified(true);
  }, [sheetDoc]);

  const removeSelected = useCallback(() => {
    if (!selectedElementId) return;
    setSheetDoc(prev => prev ? { ...prev, elements: prev.elements.filter(e => e.id !== selectedElementId) } : prev);
    setSelectedElementId(null);
    setIsModified(true);
  }, [selectedElementId]);

  const updatePage = useCallback((updates: Partial<SheetPage>) => {
    setSheetDoc(prev => prev ? { ...prev, page: { ...prev.page, ...updates } } : prev);
    setIsModified(true);
  }, []);

  const updateTemplate = useCallback((key: string, value: string) => { setSheetDoc(prev => prev ? { ...prev, templates: prev.templates.map(t => t.key === key ? { ...t, value } : t) } : prev); setIsModified(true); }, []);
  const addTemplate = useCallback(() => { setSheetDoc(prev => { if (!prev) return prev; let i = prev.templates.length + 1; let k = `var${i}`; while (prev.templates.some(t => t.key === k)) { i++; k = `var${i}`; } return { ...prev, templates: [...prev.templates, { key: k, value: '' }] }; }); setIsModified(true); }, []);
  const removeTemplate = useCallback((key: string) => { setSheetDoc(prev => prev ? { ...prev, templates: prev.templates.filter(t => t.key !== key) } : prev); setIsModified(true); }, []);

  // Keyboard shortcuts (Delete = remove selected, Escape = deselect) — matches
  // the Symbol/Schematic editors. The shared isEditableTarget guard skips these
  // while typing in a properties field or the inline cell editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId) {
          e.preventDefault();
          removeSelected();
        }
      } else if (e.key === 'Escape') {
        setSelectedElementId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedElementId, removeSelected]);

  // Loading/Error/Empty states
  if (isLoading) return <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] p-4"><RefreshCw size={48} className="mb-4 animate-spin" /><p className="text-sm">Loading sheet...</p></div>;
  if (error) return <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] p-4"><FileWarning size={48} className="mb-4 text-[var(--color-error)]" /><p className="text-sm text-center">{error}</p></div>;
  if (!filePath) return <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] p-4"><FileSpreadsheet size={48} className="mb-4" /><h3 className="text-lg font-medium mb-2">Sheet Editor</h3><p className="text-sm text-center">Open a .sheet.xml file from the explorer.</p></div>;

  // XML Sheet Editor
  if (isSheet && sheetDoc) {
    return (
      <div className="h-full flex flex-col bg-[var(--color-bg-primary)]">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--color-border)] flex-wrap">
          <button type="button" onClick={() => void saveFile()} disabled={isSaving || !isModified} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] disabled:opacity-50"><Save size={14} />{isSaving ? 'Saving...' : 'Save'}</button>
          <span className="w-px h-4 bg-[var(--color-border)] mx-1" />
          <button type="button" onClick={() => addElement('rect')} title="Add Rectangle" className="p-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"><Square size={14} /></button>
          <button type="button" onClick={() => addElement('line')} title="Add Line" className="p-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"><LineIcon size={14} /></button>
          <button type="button" onClick={() => addElement('text')} title="Add Text" className="p-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"><Type size={14} /></button>
          <button type="button" onClick={() => addElement('table')} title="Add Table" className="p-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"><Table2 size={14} /></button>
          <button type="button" onClick={() => addElement('image')} title="Add Image" className="p-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"><Image size={14} /></button>
          {selectedElementId && (<><span className="w-px h-4 bg-[var(--color-border)] mx-1" /><button type="button" onClick={removeSelected} title="Delete" className="p-1 rounded border border-red-400 bg-[var(--color-bg-secondary)] text-red-500"><Trash2 size={14} /></button></>)}
          <span className="w-px h-4 bg-[var(--color-border)] mx-1" />
          <button type="button" onClick={() => setShowTemplatePopup(true)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"><Copy size={14} />{'${}'}</button>
          <div className="ml-auto flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span>{sheetDoc.page.width}x{sheetDoc.page.height} mm</span>
            <span>{sheetDoc.elements.length} el</span>
            {isModified && <span className="text-[var(--color-warning)]">*</span>}
          </div>
        </div>

        {/* File path */}
        <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)] truncate">{relativePath || filePath}</div>

        {/* Main area */}
        <div className="flex-1 flex overflow-hidden">
          <SheetCanvasHost doc={sheetDoc} selectedId={selectedElementId} onSelectElement={setSelectedElementId} onUpdateElement={updateElement} onModified={markModified} />

          {/* Properties panel */}
          <div className="w-56 border-l border-[var(--color-border)] overflow-y-auto bg-[var(--color-bg-primary)] flex flex-col">
            <div className="px-2 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">Properties</div>
            {selectedElement ? (
              <PropertiesEditor element={selectedElement} onUpdate={updateElement} />
            ) : (
              <PagePropertiesEditor doc={sheetDoc} onUpdate={updatePage} />
            )}
            <div className="px-2 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] border-y border-[var(--color-border)] mt-auto">Elements ({sheetDoc.elements.length})</div>
            <div className="flex flex-col max-h-40 overflow-y-auto">
              {sheetDoc.elements.map(el => (
                <button key={el.id} type="button" onClick={() => setSelectedElementId(el.id)}
                  className={`px-2 py-1 text-xs text-left truncate ${el.id === selectedElementId ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}>
                  {el.type} — {el.id}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Template popup */}
        {showTemplatePopup && <TemplatePopup doc={sheetDoc} onUpdate={updateTemplate} onAdd={addTemplate} onRemove={removeTemplate} onClose={() => setShowTemplatePopup(false)} />}
      </div>
    );
  }

  // CSV fallback (unchanged)
  const columnCount = Math.max(1, ...grid.map(r => r.length));
  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-primary)]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
        <button type="button" onClick={() => void saveFile()} disabled={isSaving || !isModified} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] disabled:opacity-50"><Save size={14} />{isSaving ? 'Saving...' : 'Save'}</button>
        <div className="ml-auto text-xs text-[var(--color-text-muted)]">{grid.length} rows x {columnCount} cols {isModified ? '*' : ''}</div>
      </div>
      <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)] truncate">{relativePath || filePath}</div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead><tr><th className="sticky top-0 px-2 py-2 text-xs bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">#</th>{Array.from({ length: columnCount }, (_, i) => <th key={i} className="sticky top-0 px-2 py-2 text-xs text-left bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">{String.fromCharCode(65 + (i % 26))}</th>)}</tr></thead>
          <tbody>{grid.map((row, ri) => <tr key={ri} className="hover:bg-[var(--color-bg-secondary)]/40"><td className="px-2 py-1 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)]">{ri + 1}</td>{Array.from({ length: columnCount }, (_, ci) => <td key={ci} className="border-b border-[var(--color-border)]"><input type="text" value={row[ci] ?? ''} onChange={(e) => { setGrid(prev => { const next = prev.map(r => [...r]); next[ri][ci] = e.target.value; return next; }); setIsModified(true); }} className="w-full px-2 py-1 text-sm bg-transparent text-[var(--color-text-primary)] outline-none" /></td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
});

export default SheetEditorPanel;
