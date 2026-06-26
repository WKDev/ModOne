/**
 * SheetCanvasHost — PIXI drawing surface for the Sheet editor.
 *
 * Drop-in replacement for the former SVG `SheetCanvas`, built on the shared
 * canvas-core engine (PixiApplication + PixiViewport + CoordinateSystem +
 * GridRenderer) so the Sheet editor matches the Symbol and Schematic editors:
 * same white canvas, 5mm dot grid, middle/right-drag pan, wheel zoom.
 *
 * Element rendering reuses SheetOverlayRenderer (the existing PIXI sheet
 * renderer). Selection outline + resize handles and the select/move/resize
 * interaction are handled here, routed through the shared ToolInputBinding
 * pointer pipeline. Element creation / properties stay in the React panel,
 * which mutates the document via onUpdateElement.
 */

import { useEffect, useRef } from 'react';
import { Container, Graphics } from 'pixi.js';

import type { SheetDocument, SheetElement } from '../../../types/sheet';
import {
  PixiApplication,
  PixiViewport,
  CoordinateSystem,
  GridRenderer,
  ToolInputBinding,
  GRID_MODULE_MM,
} from '@/canvas-core';
import { SheetOverlayRenderer } from '../../OneCanvas/renderers/SheetOverlayRenderer';

const SNAP = GRID_MODULE_MM; // 5mm
const HANDLE = 2.5; // mm — resize handle box
const HANDLE_HIT = 2.0; // mm — handle grab radius
const SEL_COLOR = 0x2563eb;

type HandlePos = 'nw' | 'ne' | 'sw' | 'se';
type Bounds = { x: number; y: number; w: number; h: number };

interface Props {
  doc: SheetDocument;
  selectedId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<SheetElement>) => void;
  onModified: () => void;
}

const snap = (v: number) => Math.round(v / SNAP) * SNAP;

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

const pos = (v: number, min = 1) => Math.max(min, v);

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

  // Active interaction (move / resize) state.
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
    // Page border.
    g.rect(0, 0, page.width, page.height);
    g.fill({ color: 0xffffff });
    g.stroke({ width: 0.3, color: 0xbbbbbb });
    // Margin guide.
    const m = page.margins;
    g.rect(m.left, m.top, page.width - m.left - m.right, page.height - m.top - m.bottom);
    g.stroke({ width: 0.2, color: 0xd0d7e2 });
  };

  const drawSelection = () => {
    const g = selGfxRef.current;
    if (!g) return;
    g.clear();
    const el = docRef.current.elements.find((e) => e.id === selectedIdRef.current);
    if (!el) return;
    const b = getElBounds(el);
    // Dashed-look outline (solid here; thin) + corner handles.
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
      g.stroke({ width: 0.3, color: 0xffffff });
    }
  };

  const renderContent = () => {
    contentRef.current?.setDocument(docRef.current);
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
    // Topmost first.
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      if (el.type === 'line') {
        // Distance from point to segment.
        const dx = el.x2 - el.x1;
        const dy = el.y2 - el.y1;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((wx - el.x1) * dx + (wy - el.y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = el.x1 + t * dx;
        const py = el.y1 + t * dy;
        if (Math.hypot(wx - px, wy - py) <= 1.5) return el;
        continue;
      }
      const b = getElBounds(el);
      if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) return el;
    }
    return null;
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
        },
      });
      viewportRef.current = viewport;
      app.app.stage.addChild(vpContainer);

      // Layers (bottom → top): grid, page, content, selection.
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

      // Pointer input through the shared pipeline (primary button only;
      // middle/right → native pixi-viewport pan).
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

      // Fit the page in view.
      const page = docRef.current.page;
      const cw = container.clientWidth || 800;
      const ch = container.clientHeight || 600;
      const zoom = Math.max(0.1, Math.min(cw / page.width, ch / page.height) * 0.9);
      viewport.centerOn(page.width / 2, page.height / 2, zoom);

      if (!destroyed) app.start();
    };

    // Interaction handlers (defined inside so they close over refs).
    const onDown = (wx: number, wy: number) => {
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
          onUpdateRef.current(id, {
            x1: d.elStart.x + dx,
            y1: d.elStart.y + dy,
            x2: d.elStart.x2 + dx,
            y2: d.elStart.y2 + dy,
          } as Partial<SheetElement>);
        } else {
          onUpdateRef.current(id, {
            x: d.elStart.x + dx,
            y: d.elStart.y + dy,
          } as Partial<SheetElement>);
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
        onModifiedRef.current();
      } else if (el.type === 'line') {
        if (hh === 'nw') onUpdateRef.current(id, { x1: snap(b.x + dx), y1: snap(b.y + dy) } as Partial<SheetElement>);
        if (hh === 'se') onUpdateRef.current(id, { x2: snap(b.x + b.w + dx), y2: snap(b.y + b.h + dy) } as Partial<SheetElement>);
        onModifiedRef.current();
      }
    };

    const onUp = () => {
      dragRef.current.mode = 'none';
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

  // Re-render content + page when the document changes.
  useEffect(() => {
    renderContent();
    drawPage();
    drawSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // Re-draw selection overlay when selection changes.
  useEffect(() => {
    drawSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative"
      style={{ backgroundColor: '#ffffff', cursor: 'crosshair' }}
    />
  );
}
