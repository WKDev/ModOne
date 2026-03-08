/**
 * Symbol Thumbnail Generator
 *
 * Renders SymbolLibrary GraphicsContext definitions to cached data-URL images
 * via a single offscreen Pixi.js Application.  The resulting strings are
 * consumed by <SymbolRenderer> as <img src>.
 */

import { Application, Graphics } from 'pixi.js';
import { getSymbolContextForBlockType, getSymbolSizeForBlockType } from '../renderers/symbols/symbolBridge';
import type { BlockType } from '../../../types/circuit';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const thumbnailCache = new Map<string, string>();

// ---------------------------------------------------------------------------
// Offscreen renderer (lazy singleton)
// ---------------------------------------------------------------------------

let offscreenApp: Application | null = null;
let initPromise: Promise<Application> | null = null;

function ensureApp(): Promise<Application> {
  if (offscreenApp) return Promise.resolve(offscreenApp);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const app = new Application();
    await app.init({
      width: 128,
      height: 128,
      backgroundAlpha: 0,
      antialias: true,
      // Use a dedicated offscreen canvas – never attached to the DOM
      resolution: typeof window !== 'undefined' ? window.devicePixelRatio ?? 1 : 1,
    });
    offscreenApp = app;
    return app;
  })();

  return initPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a single symbol type to a data-URL thumbnail.
 *
 * @param type       Block/symbol type to render.
 * @param width      Desired thumbnail width in CSS pixels.
 * @param height     Desired thumbnail height in CSS pixels.
 * @returns          `data:image/png;base64,…` string.
 */
export async function renderSymbolThumbnail(
  type: BlockType,
  width: number,
  height: number,
): Promise<string> {
  const key = `${type}:${width}:${height}`;
  const cached = thumbnailCache.get(key);
  if (cached) return cached;

  const app = await ensureApp();
  const symbolSize = getSymbolSizeForBlockType(type) ?? { width: 64, height: 64 };
  const ctx = getSymbolContextForBlockType(type);

  // Fit symbol into requested dimensions with some breathing room
  const scaleX = width / symbolSize.width;
  const scaleY = height / symbolSize.height;
  const scale = Math.min(scaleX, scaleY) * 0.85;

  const renderW = Math.max(1, Math.ceil(width));
  const renderH = Math.max(1, Math.ceil(height));

  app.renderer.resize(renderW, renderH);
  app.stage.removeChildren();

  const graphics = ctx ? new Graphics(ctx) : new Graphics();
  graphics.scale.set(scale);
  // Center the scaled symbol
  graphics.x = (renderW - symbolSize.width * scale) / 2;
  graphics.y = (renderH - symbolSize.height * scale) / 2;
  app.stage.addChild(graphics);
  app.render();

  const dataUrl = (app.canvas as HTMLCanvasElement).toDataURL('image/png');
  thumbnailCache.set(key, dataUrl);

  return dataUrl;
}

/**
 * Pre-render thumbnails for all canonical symbol types at a given size.
 * Returns the populated cache for immediate consumption.
 */
export async function preloadAllThumbnails(
  width: number,
  height: number,
): Promise<Map<string, string>> {
  const types = CANONICAL_SYMBOL_TYPES;
  for (const type of types) {
    await renderSymbolThumbnail(type, width, height);
  }
  return thumbnailCache;
}

/**
 * Synchronous cache lookup (returns `undefined` on miss).
 * Useful inside render paths where async is not possible.
 */
export function getCachedThumbnail(
  type: BlockType,
  width: number,
  height: number,
): string | undefined {
  return thumbnailCache.get(`${type}:${width}:${height}`);
}

// ---------------------------------------------------------------------------
// Symbol categories & metadata (used by Toolbox)
// ---------------------------------------------------------------------------

/** All canonical (non-legacy) symbol types eligible for the Toolbox. */
export const CANONICAL_SYMBOL_TYPES: BlockType[] = [
  'power_source',
  'ground',
  'switch_no',
  'switch_nc',
  'switch_changeover',
  'push_button_no',
  'push_button_nc',
  'fuse',
  'circuit_breaker',
  'overload_relay',
  'motor',
  'contactor',
  'relay_coil',
  'relay_contact_no',
  'relay_contact_nc',
  'resistor',
  'capacitor',
  'inductor',
  'diode',
  'led',
  'transformer',
  'plc_input',
  'plc_output',
  'timer_on_delay',
  'timer_off_delay',
  'counter_up',
  'counter_down',
  'terminal',
  'connector',
  'junction_box',
];

/** Human-readable display label for each symbol type. */
export const SYMBOL_LABELS: Record<string, string> = {
  power_source: 'Power Source',
  ground: 'Ground',
  switch_no: 'Switch (NO)',
  switch_nc: 'Switch (NC)',
  switch_changeover: 'Changeover Switch',
  push_button_no: 'Push Button (NO)',
  push_button_nc: 'Push Button (NC)',
  fuse: 'Fuse',
  circuit_breaker: 'Circuit Breaker',
  overload_relay: 'Overload Relay',
  motor: 'Motor',
  contactor: 'Contactor',
  relay_coil: 'Relay Coil',
  relay_contact_no: 'Relay Contact (NO)',
  relay_contact_nc: 'Relay Contact (NC)',
  resistor: 'Resistor',
  capacitor: 'Capacitor',
  inductor: 'Inductor',
  diode: 'Diode',
  led: 'LED',
  transformer: 'Transformer',
  plc_input: 'PLC Input',
  plc_output: 'PLC Output',
  timer_on_delay: 'Timer (On-Delay)',
  timer_off_delay: 'Timer (Off-Delay)',
  counter_up: 'Counter (Up)',
  counter_down: 'Counter (Down)',
  terminal: 'Terminal',
  connector: 'Connector',
  junction_box: 'Junction Box',
  custom_symbol: 'Custom Symbol',
};

export interface SymbolCategory {
  id: string;
  label: string;
  items: BlockType[];
}

/** Categorised symbol list for Toolbox rendering. */
export const SYMBOL_CATEGORIES: SymbolCategory[] = [
  {
    id: 'power',
    label: 'Power',
    items: ['power_source', 'ground'],
  },
  {
    id: 'switches',
    label: 'Switches & Buttons',
    items: ['switch_no', 'switch_nc', 'switch_changeover', 'push_button_no', 'push_button_nc'],
  },
  {
    id: 'protection',
    label: 'Protection',
    items: ['fuse', 'circuit_breaker', 'overload_relay'],
  },
  {
    id: 'actuators',
    label: 'Motors & Actuators',
    items: ['motor', 'contactor'],
  },
  {
    id: 'relays',
    label: 'Relays',
    items: ['relay_coil', 'relay_contact_no', 'relay_contact_nc'],
  },
  {
    id: 'passive',
    label: 'Passive Components',
    items: ['resistor', 'capacitor', 'inductor', 'diode', 'led', 'transformer'],
  },
  {
    id: 'plc',
    label: 'PLC',
    items: ['plc_input', 'plc_output'],
  },
  {
    id: 'timers',
    label: 'Timers & Counters',
    items: ['timer_on_delay', 'timer_off_delay', 'counter_up', 'counter_down'],
  },
  {
    id: 'connectivity',
    label: 'Connectivity',
    items: ['terminal', 'connector', 'junction_box'],
  },
];
