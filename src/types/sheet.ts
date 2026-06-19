/**
 * Sheet Document Types
 *
 * Defines the data model for engineering drawing sheets (.sheet.xml).
 * All spatial values are in mm unless otherwise noted.
 */

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export interface SheetPage {
  width: number;   // mm
  height: number;  // mm
  margins: SheetMargins;
}

export interface SheetMargins {
  top: number;     // mm
  right: number;   // mm
  bottom: number;  // mm
  left: number;    // mm
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

export type SheetElementType = 'rect' | 'line' | 'text' | 'table' | 'image';

interface SheetElementBase {
  id: string;
  type: SheetElementType;
}

export interface SheetRect extends SheetElementBase {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
}

export interface SheetLine extends SheetElementBase {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
}

export interface SheetText extends SheetElementBase {
  type: 'text';
  x: number;
  y: number;
  content: string;
  fontSize: number;       // in points
  fontFamily: string;
  align: 'left' | 'center' | 'right';
  color: string;
}

export interface SheetTableColumn {
  key: string;
  label: string;
  width: number;          // mm
}

export interface SheetTableRow {
  height: number;         // mm
  cells: Record<string, string>;
}

export interface SheetTableMerge {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface SheetTable extends SheetElementBase {
  type: 'table';
  x: number;
  y: number;
  columns: SheetTableColumn[];
  rows: SheetTableRow[];
  merges: SheetTableMerge[];
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
}

export interface SheetImage extends SheetElementBase {
  type: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  data: string;           // base64 encoded
  mimeType: string;       // e.g., 'image/png'
}

export type SheetElement =
  | SheetRect
  | SheetLine
  | SheetText
  | SheetTable
  | SheetImage;

// ---------------------------------------------------------------------------
// Template Variables
// ---------------------------------------------------------------------------

export interface SheetTemplateVar {
  key: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export interface SheetDocument {
  version: string;
  unit: 'mm';
  page: SheetPage;
  elements: SheetElement[];
  templates: SheetTemplateVar[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export function createEmptySheet(
  pageWidth = 297,
  pageHeight = 210,
): SheetDocument {
  return {
    version: '1.0',
    unit: 'mm',
    page: {
      width: pageWidth,
      height: pageHeight,
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
    },
    elements: [],
    templates: [],
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pixels per mm at 96 DPI */
export const MM_TO_PX = 96 / 25.4; // ≈ 3.7795

/** Standard page sizes in mm */
export const PAGE_SIZES = {
  'A4-landscape': { width: 297, height: 210 },
  'A4-portrait': { width: 210, height: 297 },
  'A3-landscape': { width: 420, height: 297 },
  'A3-portrait': { width: 297, height: 420 },
} as const;

export type PageSizeKey = keyof typeof PAGE_SIZES;
