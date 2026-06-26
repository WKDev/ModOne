/**
 * SheetCanvasHost — PIXI drawing surface for the Sheet editor.
 *
 * Drop-in replacement for the former SVG `SheetCanvas`, built on the shared
 * canvas-core engine (PixiApplication + PixiViewport + CoordinateSystem +
 * GridRenderer) so the Sheet editor matches the Symbol and Schematic editors:
 * same white canvas, 5mm dot grid, middle/right-drag pan, wheel zoom.
 *
 * Element rendering reuses SheetOverlayRenderer. Selection outline + resize
 * handles and the select/move/resize interaction are handled here, routed
 * through the shared ToolInputBinding pointer pipeline. Double-clicking a text
 * element or a table cell opens an HTML `<input>` overlay (positioned via the
 * viewport's world→screen transform) for in-place editing — a capability the
 * old SVG editor lacked.
 */

import { useEffect, useRef, useState } from 'react';
import { Container, Graphics } from 'pixi.js';

import type { SheetDocument, SheetElement } from '../../../types/sheet';
import {
  PixiApplication,
  PixiViewport,
  CoordinateSystem,
  GridRenderer,
  ToolInputBinding,
  GRID_MODULE_MM,
  SELECTION_COLOR,
  SELECTION_HANDLE_STROKE,
  SELECTION_COLOR_CSS,
} from '@/canvas-core';
import { SheetOverlayRenderer } from '../../OneCanvas/renderers/SheetOverlayRenderer';

const SNAP = GRID_MODULE_MM; // 5mm
const HANDLE = 2.5; // mm — resize handle box
const HANDLE_HIT = 2.0; // mm — handle grab radius
const SEL_COLOR = SELECTION_COLOR;

type HandlePos = 'nw' | 'ne' | 'sw' | 'se';
type Bounds = { x: number; y: number; w: number; h: number };

/** Active in-place editor (text element content or a table cell). */
interface EditorState {
  id: string;
  field: { kind: 'text' } | { kind: 'cell'; col: number; row: number };
  left: number;
  top: number;
  width: number;
  height: number;
  fontPx: number;
  value: string;
}

interface Props {
  doc: SheetDocument;
  selectedId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<SheetElement>) => void;
  onModified: () => void;
}

const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const pos = (v: number, min = 1) => Math.max(min, v);

/** Bounding box of an element in mm (mirrors the SVG editor's getElBounds). */
function getElBounds(el: SheetElement): Bounds {
  switch (el.type) {
    case 'rect':
    case 'image':
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    case 'line':
      return {
        x: Math.min(el.x1, el.x2),
        y: Math.min(el.y1, el.y2),
        w: Math.abs(el.x2 - el.x1) || 2,
        h: Math.abs(el.y2 - el.y1) || 2,
      };
    case 'text':
      return {
        x: el.x,
        y: el.y - el.fontSize * 0.4,
        w: el.content.length * el.fontSize * 0.6 + 2,
        h: el.fontSize * 1.2,
      };
    case 'table':
      return {
        x: el.x,
        y: el.y,
        w: el.columns.reduce((s, c) => s + c.width, 0),
        h: el.rows.reduce((s, r) => s + r.height, 0),
      };
  }
}

export function SheetCanvasHost({
  doc,
  selectedId,
  onSelectElement,
  onUpdateElement,
  onModified,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const appRef = useRef<PixiApplication | null>(null);
  const viewportRef = useRef<PixiViewport | null>(null);
  const coordSysRef = useRef<CoordinateSystem | null>(null);
  const gridRef = useRef<GridRenderer | null>(null);
  const contentRef = useRef<SheetOverlayRenderer | null>(null);
  const pageGfxRef = useRef<Graphics | null>(null);
  const selGfxRef = useRef<Graphics | null>(null);
  const toolInputRef = useRef<ToolInputBinding | null>(null);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const editorRef = useRef<EditorState | null>(null);
  editorRef.current = editor;

  // Stable refs so the input handlers always see current props.
  const docRef = useRef(doc);
  docRef.current = doc;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const onSelectRef = useRef(onSelectElement);
  onSelectRef.current = onSelectElement;
  const onUpdateRef = useRef(onUpdateElement);
  onUpdateRef.current = onUpdateElement;
  const onModifiedRef = useRef(onModified);
  onModifiedRef.current = onModified;

  const dragRef = useRef<{
    mode: 'none' | 'move' | 'resize';
    handle: HandlePos;
    startBounds: Bounds;
    elStart: { x: number; y: number; x2: number; y2: number };
    start: { x: number; y: number };
  }>({
    mode: 'none',
    handle: 'nw',
    startBounds: { x: 0, y: 0, w: 0, h: 0 },
    elStart: { x: 0, y: 0, x2: 0, y2: 0 },
    start: { x: 0, y: 0 },
  });

  // --- draw helpers ------------------------------------------------------
  const drawPage = () => {
    const g = pageGfxRef.current;
    const page = docRef.current.page;
    if (!g) return;
    g.clear();
    g.rect(0, 0, page.width, page.height);
    g.fill({ color: 0xffffff });
    g.stroke({ width: 0.3, color: 0xbbbbbb });
    const m = page.margins;
    g.rect(m.left, m.top, page.width - m.left - m.right, page.height - m.top - m.bottom);
    g.stroke({ width: 0.2, color: 0xd0d7e2 });
  };

  const drawSelectionBounds = (b: Bounds | null) => {
    const g = selGfxRef.current;
    if (!g) return;
    g.clear();
    if (!b) return;
    g.rect(b.x - 0.5, b.y - 0.5, b.w + 1, b.h + 1);
    g.stroke({ width: 0.4, color: SEL_COLOR });
    for (const [hx, hy] of [
      [b.x, b.y],
      [b.x + b.w, b.y],
      [b.x, b.y + b.h],
      [b.x + b.w, b.y + b.h],
    ]) {
      g.rect(hx - HANDLE / 2, hy - HANDLE / 2, HANDLE, HANDLE);
      g.fill({ color: SEL_COLOR });
      g.stroke({ width: 0.3, color: SELECTION_HANDLE_STROKE });
    }
  };

  const drawSelection = () => {
    const el = docRef.current.elements.find((e) => e.id === selectedIdRef.current);
    drawSelectionBounds(el ? getElBounds(el) : null);
  };

  const renderContent = () => {
    contentRef.current?.setDocument(docRef.current);
  };

  // Center + fit the page in the current viewport. Re-run on container resize so
  // the page never drifts off-centre (the init-time size can be stale).
  const fitPage = (w?: number, h?: number) => {
    const vp = viewportRef.current;
    const c = containerRef.current;
    if (!vp || !c) return;
    const cw = w ?? (c.clientWidth || 800);
    const ch = h ?? (c.clientHeight || 600);
    const page = docRef.current.page;
    const zoom = Math.max(0.1, Math.min(cw / page.width, ch / page.height) * 0.9);
    vp.centerOn(page.width / 2, page.height / 2, zoom);
    gridRef.current?.render(vp.visibleBounds, vp.state.zoom);
  };

  // --- hit testing -------------------------------------------------------
  const handleAt = (wx: number, wy: number): HandlePos | null => {
    const el = docRef.current.elements.find((e) => e.id === selectedIdRef.current);
    if (!el) return null;
    const b = getElBounds(el);
    const corners: [HandlePos, number, number][] = [
      ['nw', b.x, b.y],
      ['ne', b.x + b.w, b.y],
      ['sw', b.x, b.y + b.h],
      ['se', b.x + b.w, b.y + b.h],
    ];
    for (const [h, cx, cy] of corners) {
      if (Math.abs(wx - cx) <= HANDLE_HIT && Math.abs(wy - cy) <= HANDLE_HIT) return h;
    }
    return null;
  };

  const elementAt = (wx: number, wy: number): SheetElement | null => {
    const els = docRef.current.elements;
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      if (el.type === 'line') {
        const dx = el.x2 - el.x1;
        const dy = el.y2 - el.y1;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((wx - el.x1) * dx + (wy - el.y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        if (Math.hypot(wx - (el.x1 + t * dx), wy - (el.y1 + t * dy)) <= 1.5) return el;
        continue;
      }
      const b = getElBounds(el);
      if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) return el;
    }
    return null;
  };

  // World → container-screen via the viewport transform.
  const worldToScreen = (wx: number, wy: number): { x: number; y: number } => {
    const vp = viewportRef.current?.viewport;
    if (!vp) return { x: 0, y: 0 };
    const p = vp.toScreen(wx, wy);
    return { x: p.x, y: p.y };
  };

  // Open the in-place editor for a text element or table cell at world (wx,wy).
  const openEditorAt = (wx: number, wy: number) => {
    const el = elementAt(wx, wy);
    if (!el) return;
    const zoom = viewportRef.current?.state.zoom ?? 1;
    if (el.type === 'text') {
      const top = worldToScreen(el.x, el.y - el.fontSize);
      onSelectRef.current(el.id);
      setEditor({
        id: el.id,
        field: { kind: 'text' },
        left: top.x,
        top: top.y,
        width: Math.max(60, getElBounds(el).w * zoom),
        height: Math.max(18, el.fontSize * 1.4 * zoom),
        fontPx: Math.max(8, el.fontSize * zoom),
        value: el.content,
      });
    } else if (el.type === 'table') {
      // Locate the cell under the cursor.
      let cy = el.y;
      for (let ri = 0; ri < el.rows.length; ri++) {
        const rh = el.rows[ri].height;
        if (wy >= cy && wy <= cy + rh) {
          let cx = el.x;
          for (let ci = 0; ci < el.columns.length; ci++) {
            const cw = el.columns[ci].width;
            if (wx >= cx && wx <= cx + cw) {
              const tl = worldToScreen(cx, cy);
              onSelectRef.current(el.id);
              setEditor({
                id: el.id,
                field: { kind: 'cell', col: ci, row: ri },
                left: tl.x,
                top: tl.y,
                width: cw * zoom,
                height: rh * zoom,
                fontPx: Math.max(8, el.fontSize * zoom),
                value: el.rows[ri].cells[el.columns[ci].key] ?? '',
              });
              return;
            }
            cx += cw;
          }
        }
        cy += rh;
      }
    }
  };

  const commitEditor = (value: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const el = docRef.current.elements.find((e) => e.id === ed.id);
    if (el) {
      if (ed.field.kind === 'text') {
        onUpdateRef.current(ed.id, { content: value } as Partial<SheetElement>);
      } else if (el.type === 'table') {
        const { col, row } = ed.field;
        const key = el.columns[col].key;
        const rows = el.rows.map((r, ri) =>
          ri === row ? { ...r, cells: { ...r.cells, [key]: value } } : r,
        );
        onUpdateRef.current(ed.id, { rows } as Partial<SheetElement>);
      }
      onModifiedRef.current();
    }
    setEditor(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const container = containerRef.current;
    const vp = viewportRef.current?.viewport;
    if (!container || !vp) return;
    const rect = container.getBoundingClientRect();
    const w = vp.toWorld(e.clientX - rect.left, e.clientY - rect.top);
    openEditorAt(w.x, w.y);
  };

  // --- mount -------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let destroyed = false;
    let activeApp: PixiApplication | null = null;

    const init = async () => {
      const app = new PixiApplication();
      activeApp = app;
      const gridConfig = {
        size: SNAP,
        visible: true,
        color: '#cccccc',
        majorColor: '#999999',
        subdivisions: 5,
      };
      await app.init({
        container,
        config: { backgroundColor: 0xffffff, grid: gridConfig, minZoom: 0.1, maxZoom: 10 },
        onResize: (w, h) => {
          fitPage(w, h);
          if (editorRef.current) setEditor(null);
        },
      });
      if (destroyed) {
        app.destroy();
        return;
      }
      app.stop();
      appRef.current = app;

      const viewport = new PixiViewport();
      const vpContainer = viewport.init({
        app: app.app,
        config: { backgroundColor: 0xffffff, grid: gridConfig, minZoom: 0.1, maxZoom: 10 },
        onViewportChange: () => {
          if (gridRef.current && viewportRef.current) {
            gridRef.current.render(
              viewportRef.current.visibleBounds,
              viewportRef.current.state.zoom,
            );
          }
          // Close the in-place editor on pan/zoom (it would otherwise drift).
          if (editorRef.current) setEditor(null);
        },
      });
      viewportRef.current = viewport;
      app.app.stage.addChild(vpContainer);

      const gridLayer = new Container();
      const pageLayer = new Container();
      const contentLayer = new Container();
      const selectionLayer = new Container();
      gridLayer.eventMode = 'none';
      pageLayer.eventMode = 'none';
      selectionLayer.eventMode = 'none';
      vpContainer.addChild(gridLayer, pageLayer, contentLayer, selectionLayer);

      const coordSys = new CoordinateSystem();
      coordSys.init(viewport.viewport);
      coordSys.gridSize = SNAP;
      coordSysRef.current = coordSys;

      gridRef.current = new GridRenderer({
        layer: gridLayer,
        config: {
          size: SNAP,
          visible: true,
          color: '#cccccc',
          majorColor: '#999999',
          alpha: 0.3,
          majorAlpha: 0.5,
          style: 'dots',
          subdivisions: 5,
        },
      });

      const pageGfx = new Graphics();
      pageGfx.eventMode = 'none';
      pageLayer.addChild(pageGfx);
      pageGfxRef.current = pageGfx;

      const content = new SheetOverlayRenderer();
      content.init(contentLayer);
      contentRef.current = content;

      const selGfx = new Graphics();
      selGfx.eventMode = 'none';
      selectionLayer.addChild(selGfx);
      selGfxRef.current = selGfx;

      const toolInput = new ToolInputBinding();
      toolInput.init({
        viewport: viewport.viewport,
        coordSys,
        handlers: {
          onPointerDown: (p) => onDown(p.world.x, p.world.y),
          onPointerMove: (p) => onMove(p.world.x, p.world.y),
          onPointerUp: () => onUp(),
        },
      });
      toolInputRef.current = toolInput;

      drawPage();
      renderContent();
      drawSelection();
      gridRef.current.render(viewport.visibleBounds, viewport.state.zoom);

      fitPage();

      if (!destroyed) app.start();
    };

    const onDown = (wx: number, wy: number) => {
      if (editorRef.current) commitEditor(editorRef.current.value);
      const h = handleAt(wx, wy);
      if (h) {
        const el = docRef.current.elements.find((e) => e.id === selectedIdRef.current);
        if (el) {
          dragRef.current = {
            mode: 'resize',
            handle: h,
            startBounds: getElBounds(el),
            elStart: { x: 0, y: 0, x2: 0, y2: 0 },
            start: { x: wx, y: wy },
          };
          return;
        }
      }
      const el = elementAt(wx, wy);
      if (!el) {
        onSelectRef.current(null);
        dragRef.current.mode = 'none';
        return;
      }
      onSelectRef.current(el.id);
      const elStart =
        el.type === 'line'
          ? { x: el.x1, y: el.y1, x2: el.x2, y2: el.y2 }
          : { x: (el as { x: number }).x, y: (el as { y: number }).y, x2: 0, y2: 0 };
      dragRef.current = {
        mode: 'move',
        handle: 'nw',
        startBounds: getElBounds(el),
        elStart,
        start: { x: wx, y: wy },
      };
    };

    const onMove = (wx: number, wy: number) => {
      const d = dragRef.current;
      if (d.mode === 'none') return;
      const id = selectedIdRef.current;
      if (!id) return;
      const el = docRef.current.elements.find((e) => e.id === id);
      if (!el) return;

      if (d.mode === 'move') {
        const dx = snap(d.elStart.x + (wx - d.start.x)) - d.elStart.x;
        const dy = snap(d.elStart.y + (wy - d.start.y)) - d.elStart.y;
        if (el.type === 'line') {
          const nx1 = d.elStart.x + dx, ny1 = d.elStart.y + dy;
          const nx2 = d.elStart.x2 + dx, ny2 = d.elStart.y2 + dy;
          onUpdateRef.current(id, { x1: nx1, y1: ny1, x2: nx2, y2: ny2 } as Partial<SheetElement>);
          drawSelectionBounds({
            x: Math.min(nx1, nx2),
            y: Math.min(ny1, ny2),
            w: Math.abs(nx2 - nx1) || 2,
            h: Math.abs(ny2 - ny1) || 2,
          });
        } else {
          onUpdateRef.current(id, { x: d.elStart.x + dx, y: d.elStart.y + dy } as Partial<SheetElement>);
          drawSelectionBounds({ x: d.elStart.x + dx, y: d.elStart.y + dy, w: d.startBounds.w, h: d.startBounds.h });
        }
        onModifiedRef.current();
        return;
      }

      // resize
      const dx = wx - d.start.x;
      const dy = wy - d.start.y;
      const b = d.startBounds;
      const hh = d.handle;
      if (el.type === 'rect' || el.type === 'image') {
        let nx = b.x, ny = b.y, nw = b.w, nh = b.h;
        if (hh.includes('w')) { nx = snap(b.x + dx); nw = pos(b.w + (b.x - nx)); }
        if (hh.includes('e')) { nw = pos(snap(b.w + dx)); }
        if (hh.includes('n')) { ny = snap(b.y + dy); nh = pos(b.h + (b.y - ny)); }
        if (hh.includes('s')) { nh = pos(snap(b.h + dy)); }
        onUpdateRef.current(id, { x: nx, y: ny, w: nw, h: nh } as Partial<SheetElement>);
        drawSelectionBounds({ x: nx, y: ny, w: nw, h: nh });
        onModifiedRef.current();
      } else if (el.type === 'line') {
        if (hh === 'nw') onUpdateRef.current(id, { x1: snap(b.x + dx), y1: snap(b.y + dy) } as Partial<SheetElement>);
        if (hh === 'se') onUpdateRef.current(id, { x2: snap(b.x + b.w + dx), y2: snap(b.y + b.h + dy) } as Partial<SheetElement>);
        onModifiedRef.current();
      }
    };

    const onUp = () => {
      dragRef.current.mode = 'none';
      drawSelection();
    };

    init();

    return () => {
      destroyed = true;
      activeApp?.stop();
      appRef.current?.stop();
      toolInputRef.current?.destroy();
      contentRef.current?.destroy();
      gridRef.current?.destroy();
      coordSysRef.current?.destroy();
      selGfxRef.current?.destroy();
      pageGfxRef.current?.destroy();
      viewportRef.current?.destroy();
      appRef.current?.destroy();
      toolInputRef.current = null;
      contentRef.current = null;
      gridRef.current = null;
      coordSysRef.current = null;
      selGfxRef.current = null;
      pageGfxRef.current = null;
      viewportRef.current = null;
      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    renderContent();
    drawPage();
    drawSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  useEffect(() => {
    drawSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative"
      style={{ backgroundColor: '#ffffff', cursor: 'crosshair' }}
      onDoubleClick={handleDoubleClick}
    >
      {editor && (
        <input
          data-testid="sheet-inline-editor"
          autoFocus
          defaultValue={editor.value}
          onBlur={(e) => commitEditor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitEditor(e.currentTarget.value);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditor(null);
            }
            e.stopPropagation();
          }}
          style={{
            position: 'absolute',
            left: editor.left,
            top: editor.top,
            width: editor.width,
            height: editor.height,
            fontSize: editor.fontPx,
            lineHeight: `${editor.height}px`,
            padding: '0 2px',
            margin: 0,
            border: `1px solid ${SELECTION_COLOR_CSS}`,
            outline: 'none',
            background: 'white',
            color: 'black',
            zIndex: 20,
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}
