/**
 * Symbol/Block Editor System
 *
 * Provides utilities for creating and editing custom block definitions.
 * Allows users to define their own symbols with custom ports, shapes, and behavior.
 */

import type { Port, PortPosition, Size } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Custom port definition for symbol editor */
export interface CustomPortDefinition {
  /** Port ID */
  id: string;
  /** Port label */
  label: string;
  /** Port type (input/output/bidirectional) */
  type: 'input' | 'output' | 'bidirectional';
  /** Position on block edge */
  position: PortPosition;
  /** Offset along the edge (0-1, where 0.5 is center) */
  offset: number;
  /** Optional description */
  description?: string;
}

/** Shape primitive for custom symbol graphics */
export type ShapePrimitive =
  | { type: 'rect'; x: number; y: number; width: number; height: number; rx?: number; fill?: string; stroke?: string; strokeWidth?: number }
  | { type: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; strokeWidth?: number }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill?: string; stroke?: string; strokeWidth?: number }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; stroke?: string; strokeWidth?: number }
  | { type: 'polyline'; points: string; fill?: string; stroke?: string; strokeWidth?: number }
  | { type: 'polygon'; points: string; fill?: string; stroke?: string; strokeWidth?: number }
  | { type: 'path'; d: string; fill?: string; stroke?: string; strokeWidth?: number }
  | { type: 'text'; x: number; y: number; content: string; fontSize?: number; fill?: string; textAnchor?: string };

/** Custom property definition */
export interface CustomPropertyDefinition {
  /** Property key */
  key: string;
  /** Display label */
  label: string;
  /** Property type */
  type: 'string' | 'number' | 'boolean' | 'select' | 'color';
  /** Default value */
  defaultValue: string | number | boolean;
  /** Options for select type */
  options?: Array<{ value: string; label: string }>;
  /** Description/help text */
  description?: string;
  /** Whether the property is required */
  required?: boolean;
  /** Validation constraints */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/** Complete custom symbol definition */
export interface CustomSymbolDefinition {
  /** Unique identifier */
  id: string;
  /** Symbol name */
  name: string;
  /** Category for organization */
  category: string;
  /** Description */
  description: string;
  /** Block size */
  size: Size;
  /** Port definitions */
  ports: CustomPortDefinition[];
  /** Custom properties */
  properties: CustomPropertyDefinition[];
  /** Shape primitives for rendering */
  shapes: ShapePrimitive[];
  /** Default label format (can use {prop} placeholders) */
  labelFormat: string;
  /** IEC/standard symbol code (if applicable) */
  standardCode?: string;
  /** Author */
  author?: string;
  /** Version */
  version: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last modified timestamp */
  updatedAt: string;
  /** Tags for searchability */
  tags: string[];
  /** Preview image (base64 SVG) */
  preview?: string;
}

/** Symbol library for storing custom symbols */
export interface SymbolLibrary {
  /** Library version */
  version: string;
  /** Library name */
  name: string;
  /** Custom symbols */
  symbols: CustomSymbolDefinition[];
  /** Categories */
  categories: string[];
  /** Last updated */
  lastUpdated: string;
}

// ============================================================================
// Constants
// ============================================================================

const SYMBOL_STORAGE_KEY = 'modone-custom-symbols';
const LIBRARY_VERSION = '1.0';

const DEFAULT_CATEGORIES = [
  'Custom',
  'Industrial',
  'Logic',
  'Measurement',
  'Safety',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique symbol ID
 */
function generateSymbolId(): string {
  return `sym_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert custom port definition to standard Port
 */
export function customPortToPort(portDef: CustomPortDefinition): Port {
  return {
    id: portDef.id,
    label: portDef.label,
    type: portDef.type === 'bidirectional' ? 'input' : portDef.type,
    position: portDef.position,
    offset: portDef.offset,
  };
}

/**
 * Generate SVG string from shape primitives
 */
export function shapesToSvg(
  shapes: ShapePrimitive[],
  size: Size,
  viewBox?: string
): string {
  const svgElements = shapes.map((shape) => {
    switch (shape.type) {
      case 'rect':
        return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" ${shape.rx ? `rx="${shape.rx}"` : ''} fill="${shape.fill || 'none'}" stroke="${shape.stroke || '#888'}" stroke-width="${shape.strokeWidth || 1}"/>`;
      case 'circle':
        return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" fill="${shape.fill || 'none'}" stroke="${shape.stroke || '#888'}" stroke-width="${shape.strokeWidth || 1}"/>`;
      case 'ellipse':
        return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" fill="${shape.fill || 'none'}" stroke="${shape.stroke || '#888'}" stroke-width="${shape.strokeWidth || 1}"/>`;
      case 'line':
        return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${shape.stroke || '#888'}" stroke-width="${shape.strokeWidth || 1}"/>`;
      case 'polyline':
        return `<polyline points="${shape.points}" fill="${shape.fill || 'none'}" stroke="${shape.stroke || '#888'}" stroke-width="${shape.strokeWidth || 1}"/>`;
      case 'polygon':
        return `<polygon points="${shape.points}" fill="${shape.fill || 'none'}" stroke="${shape.stroke || '#888'}" stroke-width="${shape.strokeWidth || 1}"/>`;
      case 'path':
        return `<path d="${shape.d}" fill="${shape.fill || 'none'}" stroke="${shape.stroke || '#888'}" stroke-width="${shape.strokeWidth || 1}"/>`;
      case 'text':
        return `<text x="${shape.x}" y="${shape.y}" font-size="${shape.fontSize || 12}" fill="${shape.fill || '#888'}" text-anchor="${shape.textAnchor || 'start'}">${shape.content}</text>`;
    }
  });

  const vb = viewBox || `0 0 ${size.width} ${size.height}`;
  return `<svg viewBox="${vb}" width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">${svgElements.join('')}</svg>`;
}

// ============================================================================
// Symbol CRUD Functions
// ============================================================================

/**
 * Load symbol library from localStorage
 */
export function loadSymbolLibrary(): SymbolLibrary {
  try {
    const stored = localStorage.getItem(SYMBOL_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load symbol library:', e);
  }

  return {
    version: LIBRARY_VERSION,
    name: 'Custom Symbols',
    symbols: [],
    categories: DEFAULT_CATEGORIES,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Save symbol library to localStorage
 */
export function saveSymbolLibrary(library: SymbolLibrary): void {
  try {
    library.lastUpdated = new Date().toISOString();
    localStorage.setItem(SYMBOL_STORAGE_KEY, JSON.stringify(library));
  } catch (e) {
    console.error('Failed to save symbol library:', e);
    throw new Error('Failed to save symbol library. Storage may be full.');
  }
}

/**
 * Get all custom symbols
 */
export function getAllSymbols(): CustomSymbolDefinition[] {
  const library = loadSymbolLibrary();
  return library.symbols;
}

/**
 * Get symbols by category
 */
export function getSymbolsByCategory(category: string): CustomSymbolDefinition[] {
  const library = loadSymbolLibrary();
  return library.symbols.filter((s) => s.category === category);
}

/**
 * Get a symbol by ID
 */
export function getSymbolById(id: string): CustomSymbolDefinition | undefined {
  const library = loadSymbolLibrary();
  return library.symbols.find((s) => s.id === id);
}

/**
 * Search symbols by name, description, or tags
 */
export function searchSymbols(query: string): CustomSymbolDefinition[] {
  const library = loadSymbolLibrary();
  const lowerQuery = query.toLowerCase();

  return library.symbols.filter(
    (s) =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.description.toLowerCase().includes(lowerQuery) ||
      s.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Create a new custom symbol
 */
export function createSymbol(
  name: string,
  category: string,
  size: Size,
  ports: CustomPortDefinition[],
  shapes: ShapePrimitive[],
  properties: CustomPropertyDefinition[] = [],
  options?: {
    description?: string;
    labelFormat?: string;
    standardCode?: string;
    tags?: string[];
  }
): CustomSymbolDefinition {
  const now = new Date().toISOString();

  const symbol: CustomSymbolDefinition = {
    id: generateSymbolId(),
    name,
    category,
    description: options?.description || '',
    size,
    ports,
    properties,
    shapes,
    labelFormat: options?.labelFormat || name,
    standardCode: options?.standardCode,
    version: '1.0',
    createdAt: now,
    updatedAt: now,
    tags: options?.tags || [],
  };

  // Generate preview SVG
  symbol.preview = btoa(shapesToSvg(shapes, size));

  // Save to library
  const library = loadSymbolLibrary();
  library.symbols.push(symbol);
  saveSymbolLibrary(library);

  return symbol;
}

/**
 * Update an existing symbol
 */
export function updateSymbol(
  id: string,
  updates: Partial<Omit<CustomSymbolDefinition, 'id' | 'createdAt'>>
): CustomSymbolDefinition | undefined {
  const library = loadSymbolLibrary();
  const index = library.symbols.findIndex((s) => s.id === id);

  if (index === -1) {
    return undefined;
  }

  library.symbols[index] = {
    ...library.symbols[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Regenerate preview if shapes changed
  if (updates.shapes || updates.size) {
    const sym = library.symbols[index];
    sym.preview = btoa(shapesToSvg(sym.shapes, sym.size));
  }

  saveSymbolLibrary(library);
  return library.symbols[index];
}

/**
 * Delete a symbol
 */
export function deleteSymbol(id: string): boolean {
  const library = loadSymbolLibrary();
  const index = library.symbols.findIndex((s) => s.id === id);

  if (index === -1) {
    return false;
  }

  library.symbols.splice(index, 1);
  saveSymbolLibrary(library);
  return true;
}

/**
 * Duplicate a symbol with a new name
 */
export function duplicateSymbol(id: string, newName: string): CustomSymbolDefinition | undefined {
  const original = getSymbolById(id);
  if (!original) {
    return undefined;
  }

  const now = new Date().toISOString();
  const duplicate: CustomSymbolDefinition = {
    ...original,
    id: generateSymbolId(),
    name: newName,
    createdAt: now,
    updatedAt: now,
  };

  const library = loadSymbolLibrary();
  library.symbols.push(duplicate);
  saveSymbolLibrary(library);

  return duplicate;
}

// ============================================================================
// Preset Symbol Templates
// ============================================================================

/**
 * Get built-in symbol templates for common industrial components
 */
export function getPresetTemplates(): Array<{
  name: string;
  category: string;
  template: Partial<CustomSymbolDefinition>;
}> {
  return [
    {
      name: 'Normally Open Contact',
      category: 'Industrial',
      template: {
        size: { width: 60, height: 30 },
        ports: [
          { id: 'in', label: '', type: 'input', position: 'left', offset: 0.5 },
          { id: 'out', label: '', type: 'output', position: 'right', offset: 0.5 },
        ],
        shapes: [
          { type: 'line', x1: 0, y1: 15, x2: 20, y2: 15, stroke: '#888', strokeWidth: 2 },
          { type: 'line', x1: 40, y1: 15, x2: 60, y2: 15, stroke: '#888', strokeWidth: 2 },
          { type: 'line', x1: 20, y1: 15, x2: 25, y2: 5, stroke: '#888', strokeWidth: 2 },
          { type: 'line', x1: 25, y1: 5, x2: 40, y2: 5, stroke: '#888', strokeWidth: 2 },
        ],
        labelFormat: 'NO',
        standardCode: 'IEC 60617',
      },
    },
    {
      name: 'Normally Closed Contact',
      category: 'Industrial',
      template: {
        size: { width: 60, height: 30 },
        ports: [
          { id: 'in', label: '', type: 'input', position: 'left', offset: 0.5 },
          { id: 'out', label: '', type: 'output', position: 'right', offset: 0.5 },
        ],
        shapes: [
          { type: 'line', x1: 0, y1: 15, x2: 20, y2: 15, stroke: '#888', strokeWidth: 2 },
          { type: 'line', x1: 40, y1: 15, x2: 60, y2: 15, stroke: '#888', strokeWidth: 2 },
          { type: 'line', x1: 20, y1: 15, x2: 40, y2: 15, stroke: '#888', strokeWidth: 2 },
          { type: 'line', x1: 30, y1: 5, x2: 30, y2: 25, stroke: '#888', strokeWidth: 2 },
        ],
        labelFormat: 'NC',
        standardCode: 'IEC 60617',
      },
    },
    {
      name: 'Coil',
      category: 'Industrial',
      template: {
        size: { width: 60, height: 30 },
        ports: [
          { id: 'in', label: '', type: 'input', position: 'left', offset: 0.5 },
          { id: 'out', label: '', type: 'output', position: 'right', offset: 0.5 },
        ],
        shapes: [
          { type: 'line', x1: 0, y1: 15, x2: 15, y2: 15, stroke: '#888', strokeWidth: 2 },
          { type: 'line', x1: 45, y1: 15, x2: 60, y2: 15, stroke: '#888', strokeWidth: 2 },
          { type: 'rect', x: 15, y: 5, width: 30, height: 20, rx: 2, fill: 'none', stroke: '#888', strokeWidth: 2 },
        ],
        labelFormat: 'K',
        standardCode: 'IEC 60617',
      },
    },
    {
      name: 'Push Button NO',
      category: 'Industrial',
      template: {
        size: { width: 60, height: 40 },
        ports: [
          { id: 'in', label: '', type: 'input', position: 'left', offset: 0.5 },
          { id: 'out', label: '', type: 'output', position: 'right', offset: 0.5 },
        ],
        shapes: [
          { type: 'line', x1: 0, y1: 20, x2: 20, y2: 20, stroke: '#888', strokeWidth: 2 },
          { type: 'line', x1: 40, y1: 20, x2: 60, y2: 20, stroke: '#888', strokeWidth: 2 },
          { type: 'line', x1: 20, y1: 20, x2: 25, y2: 10, stroke: '#888', strokeWidth: 2 },
          { type: 'line', x1: 25, y1: 10, x2: 40, y2: 10, stroke: '#888', strokeWidth: 2 },
          { type: 'line', x1: 30, y1: 10, x2: 30, y2: 5, stroke: '#888', strokeWidth: 2 },
          { type: 'circle', cx: 30, cy: 3, r: 3, fill: '#888', stroke: '#888' },
        ],
        labelFormat: 'S',
        standardCode: 'IEC 60617',
      },
    },
  ];
}

// ============================================================================
// Export/Import
// ============================================================================

/**
 * Export symbol library to JSON
 */
export function exportSymbolLibrary(): string {
  const library = loadSymbolLibrary();
  return JSON.stringify(library, null, 2);
}

/**
 * Import symbol library from JSON
 */
export function importSymbolLibrary(json: string, overwrite = false): number {
  try {
    const imported: SymbolLibrary = JSON.parse(json);

    if (!imported.symbols || !Array.isArray(imported.symbols)) {
      throw new Error('Invalid symbol library format');
    }

    const library = overwrite
      ? { ...imported, version: LIBRARY_VERSION }
      : loadSymbolLibrary();

    if (!overwrite) {
      const existingIds = new Set(library.symbols.map((s) => s.id));
      for (const symbol of imported.symbols) {
        if (existingIds.has(symbol.id)) {
          symbol.id = generateSymbolId();
        }
        library.symbols.push(symbol);
      }
    }

    saveSymbolLibrary(library);
    return imported.symbols.length;
  } catch (e) {
    console.error('Failed to import symbol library:', e);
    throw new Error('Failed to import symbol library. Invalid format.');
  }
}

/**
 * Export a single symbol to JSON
 */
export function exportSymbol(id: string): string | null {
  const symbol = getSymbolById(id);
  if (!symbol) {
    return null;
  }
  return JSON.stringify(symbol, null, 2);
}

/**
 * Import a single symbol from JSON
 */
export function importSymbol(json: string): CustomSymbolDefinition {
  const symbol: CustomSymbolDefinition = JSON.parse(json);

  if (!symbol.name || !symbol.size || !symbol.ports || !symbol.shapes) {
    throw new Error('Invalid symbol format');
  }

  // Generate new ID to avoid conflicts
  symbol.id = generateSymbolId();
  symbol.createdAt = new Date().toISOString();
  symbol.updatedAt = new Date().toISOString();

  const library = loadSymbolLibrary();
  library.symbols.push(symbol);
  saveSymbolLibrary(library);

  return symbol;
}
