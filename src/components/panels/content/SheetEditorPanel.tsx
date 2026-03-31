import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Trash2,
} from 'lucide-react';
import Papa from 'papaparse';
import { explorerService } from '../../../services/explorerService';
import { useEditorAreaStore } from '../../../stores/editorAreaStore';
import { parseSheetXml, serializeSheetXml, resolveTemplateString } from '../../../services/sheetXmlService';
import type {
  SheetDocument,
  SheetElement,
  SheetElementType,
  SheetPage,
  PageSizeKey,
} from '../../../types/sheet';
import { MM_TO_PX, PAGE_SIZES } from '../../../types/sheet';

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

/** Get bounding box of an element in mm */
function getElBounds(el: SheetElement): { x: number; y: number; w: number; h: number } {
  switch (el.type) {
    case 'rect': case 'image': return { x: el.x, y: el.y, w: el.w, h: el.h };
    case 'line': return { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), w: Math.abs(el.x2 - el.x1) || 2, h: Math.abs(el.y2 - el.y1) || 2 };
    case 'text': return { x: el.x, y: el.y - el.fontSize * 0.4, w: el.content.length * el.fontSize * 0.6 + 2, h: el.fontSize * 1.2 };
    case 'table': return { x: el.x, y: el.y, w: el.columns.reduce((s, c) => s + c.width, 0), h: el.rows.reduce((s, r) => s + r.height, 0) };
  }
}

type HandlePos = 'nw' | 'ne' | 'sw' | 'se';
const HANDLE_SIZE = 2.5; // mm — resize handle size
const PAGE_OVERFLOW = 50; // mm — extra space around page for overflow elements
const SNAP_GRID = 5; // mm — snap grid size

// ===========================================================================
// SheetCanvas — SVG with zoom/pan/drag/resize
// ===========================================================================

interface CanvasProps {
  doc: SheetDocument;
  selectedId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<SheetElement>) => void;
  onModified: () => void;
}

function SheetCanvas({ doc, selectedId, onSelectElement, onUpdateElement, onModified }: CanvasProps) {
  const { page, elements, templates } = doc;
  const OVF = PAGE_OVERFLOW;

  // Viewbox includes overflow area around the page
  const vbX = -OVF;
  const vbY = -OVF;
  const vbW = page.width + OVF * 2;
  const vbH = page.height + OVF * 2;

  // Zoom & pan
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Drag
  const [isDragging, setIsDragging] = useState(false);
  const didDrag = useRef(false);
  const dragStart = useRef({ elX: 0, elY: 0, elX2: 0, elY2: 0, mx: 0, my: 0 });

  // Resize
  const [isResizing, setIsResizing] = useState(false);
  const resizeInfo = useRef({ handle: '' as HandlePos, startBounds: { x: 0, y: 0, w: 0, h: 0 }, mx: 0, my: 0 });

  // Crosshair
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const templateMap = useMemo(() => { const m: Record<string, string> = {}; for (const t of templates) m[t.key] = t.value; return m; }, [templates]);
  const resolve = useCallback((s: string) => resolveTemplateString(s, templateMap), [templateMap]);

  // Screen → mm (accounting for overflow offset in viewBox)
  const screenToMm = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const c = containerRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    return {
      x: (sx - panX) / (zoom * MM_TO_PX) + vbX,
      y: (sy - panY) / (zoom * MM_TO_PX) + vbY,
    };
  }, [zoom, panX, panY, vbX, vbY]);

  const snapToGrid = useCallback((v: number) => Math.round(v / SNAP_GRID) * SNAP_GRID, []);

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const c = containerRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(z => {
      const newZoom = Math.max(0.1, Math.min(10, z * factor));
      const ratio = newZoom / z;
      setPanX(px => mx - ratio * (mx - px));
      setPanY(py => my - ratio * (my - py));
      return newZoom;
    });
  }, []);
  const zoomIn = useCallback(() => setZoom(z => Math.min(10, z * 1.25)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.1, z / 1.25)), []);
  const zoomFit = useCallback(() => {
    const c = containerRef.current;
    if (!c || c.clientWidth === 0 || c.clientHeight === 0) return;
    // Fit to page size (not overflow), with some padding
    const pagePxW = page.width * MM_TO_PX;
    const pagePxH = page.height * MM_TO_PX;
    const z = Math.min(c.clientWidth / pagePxW, c.clientHeight / pagePxH) * 0.85;
    setZoom(z);
    // Center the page (offset by overflow in viewBox)
    const pageOffsetX = OVF * MM_TO_PX * z; // page starts at OVF inside the SVG
    const pageOffsetY = OVF * MM_TO_PX * z;
    setPanX((c.clientWidth - pagePxW * z) / 2 - pageOffsetX);
    setPanY((c.clientHeight - pagePxH * z) / 2 - pageOffsetY);
  }, [page.width, page.height, vbW, vbH, OVF]);

  // Fit on mount and when container resizes
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const t = setTimeout(zoomFit, 50);
    const ro = new ResizeObserver(() => zoomFit());
    ro.observe(c);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [zoomFit]);

  // Pan (middle mouse or Alt+left)
  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
    }
  }, [panX, panY]);

  const handleContainerMouseMove = useCallback((e: React.MouseEvent) => {
    // Update crosshair
    const mm = screenToMm(e.clientX, e.clientY);
    setMousePos(mm);

    if (isPanning) {
      setPanX(panStart.current.panX + e.clientX - panStart.current.x);
      setPanY(panStart.current.panY + e.clientY - panStart.current.y);
      return;
    }
    if (isDragging && selectedId) {
      didDrag.current = true;
      const mm2 = screenToMm(e.clientX, e.clientY);
      const startMm = screenToMm(dragStart.current.mx, dragStart.current.my);
      const dx = snapToGrid(mm2.x - startMm.x + dragStart.current.elX) - dragStart.current.elX;
      const dy = snapToGrid(mm2.y - startMm.y + dragStart.current.elY) - dragStart.current.elY;
      const el = elements.find(el => el.id === selectedId);
      if (!el) return;
      if (el.type === 'line') {
        onUpdateElement(selectedId, { x1: dragStart.current.elX + dx, y1: dragStart.current.elY + dy, x2: dragStart.current.elX2 + dx, y2: dragStart.current.elY2 + dy } as any);
      } else {
        onUpdateElement(selectedId, { x: dragStart.current.elX + dx, y: dragStart.current.elY + dy } as any);
      }
      onModified();
      return;
    }
    if (isResizing && selectedId) {
      didDrag.current = true;
      const mm2 = screenToMm(e.clientX, e.clientY);
      const startMm = screenToMm(resizeInfo.current.mx, resizeInfo.current.my);
      const dx = mm2.x - startMm.x;
      const dy = mm2.y - startMm.y;
      const b = resizeInfo.current.startBounds;
      const h = resizeInfo.current.handle;
      const el = elements.find(el => el.id === selectedId);
      if (!el) return;
      if (el.type === 'rect' || el.type === 'image') {
        let nx = b.x, ny = b.y, nw = b.w, nh = b.h;
        if (h.includes('w')) { nx = b.x + dx; nw = pos(b.w - dx, 1); }
        if (h.includes('e')) { nw = pos(b.w + dx, 1); }
        if (h.includes('n')) { ny = b.y + dy; nh = pos(b.h - dy, 1); }
        if (h.includes('s')) { nh = pos(b.h + dy, 1); }
        onUpdateElement(selectedId, { x: nx, y: ny, w: nw, h: nh } as any);
      } else if (el.type === 'line') {
        if (h === 'nw') onUpdateElement(selectedId, { x1: b.x + dx, y1: b.y + dy } as any);
        if (h === 'se') onUpdateElement(selectedId, { x2: b.x + b.w + dx, y2: b.y + b.h + dy } as any);
      }
      onModified();
      return;
    }
  }, [isPanning, isDragging, isResizing, selectedId, elements, screenToMm, snapToGrid, onUpdateElement, onModified]);

  const handleContainerMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  const handleContainerMouseLeave = useCallback(() => {
    setIsPanning(false);
    setIsDragging(false);
    setIsResizing(false);
    setMousePos(null);
  }, []);

  // Deselect when clicking SVG background (only if no drag occurred)
  const handleSvgClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !didDrag.current) {
      onSelectElement(null);
    }
  }, [onSelectElement]);

  // Element drag start
  const startDrag = useCallback((e: React.MouseEvent, el: SheetElement) => {
    if (e.button !== 0 || e.altKey) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectElement(el.id);
    setIsDragging(true);
    didDrag.current = false;
    if (el.type === 'line') {
      dragStart.current = { elX: el.x1, elY: el.y1, elX2: el.x2, elY2: el.y2, mx: e.clientX, my: e.clientY };
    } else if ('x' in el) {
      dragStart.current = { elX: (el as any).x, elY: (el as any).y, elX2: 0, elY2: 0, mx: e.clientX, my: e.clientY };
    }
  }, [onSelectElement]);

  // Resize handle start
  const startResize = useCallback((e: React.MouseEvent, handle: HandlePos) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    didDrag.current = false;
    const el = elements.find(el => el.id === selectedId);
    if (el) resizeInfo.current = { handle, startBounds: getElBounds(el), mx: e.clientX, my: e.clientY };
  }, [selectedId, elements]);

  // Selected element bounds & handles
  const selectedEl = elements.find(e => e.id === selectedId);
  const selBounds = selectedEl ? getElBounds(selectedEl) : null;
  const handles: { pos: HandlePos; cx: number; cy: number }[] = selBounds ? [
    { pos: 'nw', cx: selBounds.x, cy: selBounds.y },
    { pos: 'ne', cx: selBounds.x + selBounds.w, cy: selBounds.y },
    { pos: 'sw', cx: selBounds.x, cy: selBounds.y + selBounds.h },
    { pos: 'se', cx: selBounds.x + selBounds.w, cy: selBounds.y + selBounds.h },
  ] : [];

  const svgW = vbW * MM_TO_PX * zoom;
  const svgH = vbH * MM_TO_PX * zoom;

  // Snap crosshair position to grid
  const crosshair = mousePos ? { x: snapToGrid(mousePos.x), y: snapToGrid(mousePos.y) } : null;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative"
      onWheel={handleWheel}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleContainerMouseUp}
      onMouseLeave={handleContainerMouseLeave}
      style={{ backgroundColor: '#f3f4f6', cursor: isPanning ? 'grabbing' : isDragging ? 'move' : isResizing ? 'nwse-resize' : 'crosshair' }}
    >
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-1 py-0.5 shadow-sm">
        <button type="button" onClick={zoomOut} className="p-0.5 hover:bg-[var(--color-bg-secondary)] rounded"><ZoomOut size={14} /></button>
        <span className="text-[10px] text-[var(--color-text-muted)] w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={zoomIn} className="p-0.5 hover:bg-[var(--color-bg-secondary)] rounded"><ZoomIn size={14} /></button>
        <button type="button" onClick={zoomFit} className="p-0.5 hover:bg-[var(--color-bg-secondary)] rounded"><Maximize2 size={14} /></button>
      </div>

      {/* Coordinate display */}
      {mousePos && (
        <div className="absolute bottom-2 left-2 z-10 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-primary)]/80 border border-[var(--color-border)] rounded px-1.5 py-0.5 font-mono">
          {mousePos.x.toFixed(1)}, {mousePos.y.toFixed(1)} mm
        </div>
      )}

      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        width={svgW}
        height={svgH}
        style={{ position: 'absolute', left: panX, top: panY }}
        onClick={handleSvgClick}
      >
        {/* Background: light gray overflow, white page, grid on page */}
        <defs>
          <pattern id="sg5" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="0.3" cy="0.3" r="0.15" fill="#ddd" />
          </pattern>
          <pattern id="sg25" width="25" height="25" patternUnits="userSpaceOnUse">
            <rect width="25" height="25" fill="url(#sg5)" />
            <circle cx="0.3" cy="0.3" r="0.25" fill="#bbb" />
          </pattern>
          {/* Clip path so grid only shows on page */}
          <clipPath id="page-clip">
            <rect x="0" y="0" width={page.width} height={page.height} />
          </clipPath>
        </defs>
        {/* Overflow area - just a subtle color behind everything */}
        <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="#f3f4f6" />
        {/* Page white background */}
        <rect x="0" y="0" width={page.width} height={page.height} fill="white" />
        {/* Grid dots only on page */}
        <rect x="0" y="0" width={page.width} height={page.height} fill="url(#sg25)" clipPath="url(#page-clip)" />
        {/* Page border */}
        <rect x="0" y="0" width={page.width} height={page.height} fill="none" stroke="#bbb" strokeWidth="0.3" />

        {/* Crosshair guide lines */}
        {crosshair && !isDragging && !isResizing && (
          <g opacity="0.4" pointerEvents="none">
            <line x1={crosshair.x} y1={vbY} x2={crosshair.x} y2={vbY + vbH} stroke="#2563eb" strokeWidth="0.2" strokeDasharray="2 2" />
            <line x1={vbX} y1={crosshair.y} x2={vbX + vbW} y2={crosshair.y} stroke="#2563eb" strokeWidth="0.2" strokeDasharray="2 2" />
          </g>
        )}

        {/* Snap guide lines for dragging/resizing */}
        {(isDragging || isResizing) && selBounds && (
          <g opacity="0.5" pointerEvents="none">
            <line x1={selBounds.x} y1={vbY} x2={selBounds.x} y2={vbY + vbH} stroke="#f59e0b" strokeWidth="0.15" strokeDasharray="1 1" />
            <line x1={selBounds.x + selBounds.w} y1={vbY} x2={selBounds.x + selBounds.w} y2={vbY + vbH} stroke="#f59e0b" strokeWidth="0.15" strokeDasharray="1 1" />
            <line x1={vbX} y1={selBounds.y} x2={vbX + vbW} y2={selBounds.y} stroke="#f59e0b" strokeWidth="0.15" strokeDasharray="1 1" />
            <line x1={vbX} y1={selBounds.y + selBounds.h} x2={vbX + vbW} y2={selBounds.y + selBounds.h} stroke="#f59e0b" strokeWidth="0.15" strokeDasharray="1 1" />
          </g>
        )}

        {/* Elements */}
        {elements.map((el) => {
          const isSel = el.id === selectedId;
          switch (el.type) {
            case 'rect':
              return (<g key={el.id} onMouseDown={(e) => startDrag(e, el)} onClick={(e) => e.stopPropagation()}><rect x={el.x} y={el.y} width={el.w} height={el.h} stroke={el.stroke} strokeWidth={el.strokeWidth} fill={el.fill === 'none' ? 'transparent' : el.fill} className="cursor-move" />{isSel && <rect x={el.x - 0.5} y={el.y - 0.5} width={el.w + 1} height={el.h + 1} stroke="#2563eb" strokeWidth="0.4" fill="none" strokeDasharray="2 1" />}</g>);
            case 'line':
              return (<g key={el.id} onMouseDown={(e) => startDrag(e, el)} onClick={(e) => e.stopPropagation()}><line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={el.stroke} strokeWidth={el.strokeWidth} className="cursor-move" /><line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="transparent" strokeWidth="3" className="cursor-move" />{isSel && <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="2 1" />}</g>);
            case 'text':
              return (<g key={el.id} onMouseDown={(e) => startDrag(e, el)} onClick={(e) => e.stopPropagation()}><text x={el.x} y={el.y + el.fontSize * 0.35} fontSize={el.fontSize} fontFamily={el.fontFamily} textAnchor={el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start'} fill={el.color} className="cursor-move select-none" dominantBaseline="middle">{resolve(el.content)}</text>{isSel && (() => { const b = getElBounds(el); return <rect x={b.x} y={b.y} width={b.w} height={b.h} stroke="#2563eb" strokeWidth="0.4" fill="none" strokeDasharray="2 1" />; })()}</g>);
            case 'table': { const tw = el.columns.reduce((s, c) => s + c.width, 0); const th = el.rows.reduce((s, r) => s + r.height, 0); return (<g key={el.id} onMouseDown={(e) => startDrag(e, el)} onClick={(e) => e.stopPropagation()}><rect x={el.x} y={el.y} width={tw} height={th} stroke={el.stroke} strokeWidth={el.strokeWidth} fill="none" className="cursor-move" />{(() => { let cx = el.x; return el.columns.slice(0, -1).map((c, i) => { cx += c.width; return <line key={`c${i}`} x1={cx} y1={el.y} x2={cx} y2={el.y + th} stroke={el.stroke} strokeWidth={el.strokeWidth} />; }); })()}{(() => { let ry = el.y; return el.rows.slice(0, -1).map((r, i) => { ry += r.height; return <line key={`r${i}`} x1={el.x} y1={ry} x2={el.x + tw} y2={ry} stroke={el.stroke} strokeWidth={el.strokeWidth} />; }); })()}{(() => { let ry = el.y; const items: ReactNode[] = []; for (let ri = 0; ri < el.rows.length; ri++) { let cx = el.x; for (const col of el.columns) { const v = el.rows[ri].cells[col.key]; if (v) items.push(<text key={`${ri}-${col.key}`} x={cx + 1.5} y={ry + el.rows[ri].height * 0.6} fontSize={el.fontSize} fontFamily={el.fontFamily} fill="black" className="select-none">{resolve(v)}</text>); cx += col.width; } ry += el.rows[ri].height; } return items; })()}{isSel && <rect x={el.x - 0.5} y={el.y - 0.5} width={tw + 1} height={th + 1} stroke="#2563eb" strokeWidth="0.4" fill="none" strokeDasharray="2 1" />}</g>); }
            case 'image':
              return (<g key={el.id} onMouseDown={(e) => startDrag(e, el)} onClick={(e) => e.stopPropagation()}>{el.data ? <image x={el.x} y={el.y} width={el.w} height={el.h} href={`data:${el.mimeType};base64,${el.data}`} className="cursor-move" /> : <rect x={el.x} y={el.y} width={el.w} height={el.h} stroke="#999" strokeWidth="0.3" fill="#f0f0f0" strokeDasharray="1 1" className="cursor-move" />}{isSel && <rect x={el.x - 0.5} y={el.y - 0.5} width={el.w + 1} height={el.h + 1} stroke="#2563eb" strokeWidth="0.4" fill="none" strokeDasharray="2 1" />}</g>);
            default: return null;
          }
        })}

        {/* Resize handles */}
        {selBounds && handles.map(h => (
          <rect key={h.pos} x={h.cx - HANDLE_SIZE / 2} y={h.cy - HANDLE_SIZE / 2} width={HANDLE_SIZE} height={HANDLE_SIZE} fill="#2563eb" stroke="white" strokeWidth="0.3" rx="0.3" className="cursor-nwse-resize" onMouseDown={(e) => startResize(e, h.pos)} />
        ))}
      </svg>
    </div>
  );
}

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
          <SheetCanvas doc={sheetDoc} selectedId={selectedElementId} onSelectElement={setSelectedElementId} onUpdateElement={updateElement} onModified={markModified} />

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
