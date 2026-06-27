import { GraphicsContext } from 'pixi.js';
import type { SymbolDefinition, GraphicPrimitive } from '../../../../types/symbol';
import type { Port } from '../../types';
import { buildStaticPorts, resolveInstancePorts } from './resolveInstancePorts';

// ---------------------------------------------------------------------------
// Internal caches
// ---------------------------------------------------------------------------

const definitionCache = new Map<string, SymbolDefinition>();
const contextCache = new Map<string, GraphicsContext>();
const portsCache = new Map<string, Port[]>();

// ---------------------------------------------------------------------------
// Color conversion
// ---------------------------------------------------------------------------

function cssColorToHex(color: string): number {
  if (!color || color === 'none' || color === 'transparent') return 0x000000;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = hex[0], g = hex[1], b = hex[2];
      return parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
    }
    return parseInt(hex, 16);
  }

  return 0xd0d4da;
}

function isTransparent(color: string): boolean {
  return !color || color === 'none' || color === 'transparent' || color === '';
}

// ---------------------------------------------------------------------------
// GraphicPrimitive[] → GraphicsContext
// ---------------------------------------------------------------------------

function buildContext(def: SymbolDefinition): GraphicsContext {
  const ctx = new GraphicsContext();

  for (const prim of def.graphics) {
    drawPrimitive(ctx, prim);
  }

  if (def.graphics.length === 0) {
    ctx.rect(2, 2, def.width - 4, def.height - 4)
      .fill({ color: 0x1a1d23 })
      .stroke({ color: 0xd0d4da, width: 2 });
  }

  return ctx;
}

function drawPrimitive(ctx: GraphicsContext, prim: GraphicPrimitive): void {
  switch (prim.kind) {
    case 'rect':
      drawRect(ctx, prim);
      break;
    case 'circle':
      drawCircle(ctx, prim);
      break;
    case 'polyline':
      drawPolyline(ctx, prim);
      break;
    case 'arc':
      drawArc(ctx, prim);
      break;
    case 'text':
      break;
  }
}

function drawRect(
  ctx: GraphicsContext,
  p: Extract<GraphicPrimitive, { kind: 'rect' }>,
): void {
  ctx.rect(p.x, p.y, p.width, p.height);
  if (!isTransparent(p.fill)) {
    ctx.fill({ color: cssColorToHex(p.fill) });
  }
  if (!isTransparent(p.stroke) && p.strokeWidth > 0) {
    ctx.stroke({ color: cssColorToHex(p.stroke), width: p.strokeWidth });
  }
}

function drawCircle(
  ctx: GraphicsContext,
  p: Extract<GraphicPrimitive, { kind: 'circle' }>,
): void {
  ctx.circle(p.cx, p.cy, p.r);
  if (!isTransparent(p.fill)) {
    ctx.fill({ color: cssColorToHex(p.fill) });
  }
  if (!isTransparent(p.stroke) && p.strokeWidth > 0) {
    ctx.stroke({ color: cssColorToHex(p.stroke), width: p.strokeWidth });
  }
}

function drawPolyline(
  ctx: GraphicsContext,
  p: Extract<GraphicPrimitive, { kind: 'polyline' }>,
): void {
  if (p.points.length < 2) return;

  ctx.moveTo(p.points[0].x, p.points[0].y);
  for (let i = 1; i < p.points.length; i++) {
    ctx.lineTo(p.points[i].x, p.points[i].y);
  }
  if (!isTransparent(p.fill)) {
    ctx.fill({ color: cssColorToHex(p.fill) });
  }
  if (!isTransparent(p.stroke) && p.strokeWidth > 0) {
    ctx.stroke({ color: cssColorToHex(p.stroke), width: p.strokeWidth });
  }
}

function drawArc(
  ctx: GraphicsContext,
  p: Extract<GraphicPrimitive, { kind: 'arc' }>,
): void {
  ctx.arc(p.cx, p.cy, p.r, p.startAngle, p.endAngle);
  if (!isTransparent(p.fill)) {
    ctx.fill({ color: cssColorToHex(p.fill) });
  }
  if (!isTransparent(p.stroke) && p.strokeWidth > 0) {
    ctx.stroke({ color: cssColorToHex(p.stroke), width: p.strokeWidth });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function registerCustomSymbol(def: SymbolDefinition): void {
  definitionCache.set(def.id, def);
  contextCache.delete(def.id);
  portsCache.delete(def.id);
}

export function unregisterCustomSymbol(symbolId: string): void {
  definitionCache.delete(symbolId);
  const ctx = contextCache.get(symbolId);
  if (ctx) {
    contextCache.delete(symbolId);
  }
  portsCache.delete(symbolId);
}

export function getCustomSymbolContext(symbolId: string): GraphicsContext | null {
  let ctx = contextCache.get(symbolId);
  if (ctx) return ctx;

  const def = definitionCache.get(symbolId);
  if (!def) return null;

  ctx = buildContext(def);
  contextCache.set(symbolId, ctx);
  return ctx;
}

export function getCustomSymbolDefinition(symbolId: string): SymbolDefinition | null {
  return definitionCache.get(symbolId) ?? null;
}

export function getCustomSymbolSize(
  symbolId: string,
): { width: number; height: number } | null {
  const def = definitionCache.get(symbolId);
  if (!def) return null;
  return { width: def.width, height: def.height };
}

export function getCustomSymbolPorts(
  symbolId: string,
  instanceProps?: Record<string, string | number | boolean>,
): Port[] | null {
  const def = definitionCache.get(symbolId);
  if (!def) return null;

  // Parametric symbols depend on the instance's properties — resolve fresh.
  if (def.portTemplates && def.portTemplates.length > 0) {
    return resolveInstancePorts(def, instanceProps);
  }

  // Static symbols: cache by id.
  let ports = portsCache.get(symbolId);
  if (ports) return ports;
  ports = buildStaticPorts(def.pins);
  portsCache.set(symbolId, ports);
  return ports;
}

export function isCustomSymbolRegistered(symbolId: string): boolean {
  return definitionCache.has(symbolId);
}

export function clearCustomSymbolCache(): void {
  definitionCache.clear();
  contextCache.clear();
  portsCache.clear();
}
