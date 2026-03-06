/**
 * Pixi Canvas Export Utility
 *
 * Exports the Pixi.js canvas content as PNG, SVG, or PDF.
 * Uses the Pixi v8 extract API for raster capture and data-driven
 * SVG generation from the Zustand store for vector output.
 */

import { Rectangle } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { jsPDF } from 'jspdf';
import { useDocumentRegistry } from '@stores/documentRegistry';
import type { CanvasDocumentData } from '@/types/document';
import { isCanvasDocument } from '@/types/document';
import type { Block, Junction, Wire } from '../types';
import { isPortEndpoint } from '../types';

// Re-export download helpers from existing canvasExport
export { downloadBlob, downloadText } from '../utils/canvasExport';

// ============================================================================
// Types
// ============================================================================

/** Options for canvas export */
export interface ExportOptions {
  /** Scale factor for output resolution (default: 2 for retina) */
  scale?: number;
  /** Background color (default: '#0a0a0a') */
  backgroundColor?: string;
  /** Padding around content in px (default: 20) */
  padding?: number;
  /** Optional title text rendered above the content */
  title?: string;
}

/** PDF export options (extends standard export options) */
export interface PdfExportOptions extends ExportOptions {
  /** PDF page orientation (default: auto-detect based on content aspect ratio) */
  orientation?: 'portrait' | 'landscape' | 'auto';
  /** PDF page format (default: 'a4') */
  pageFormat?: 'a4' | 'a3' | 'letter' | 'legal';
  /** Whether to fit content to page (default: true) */
  fitToPage?: boolean;
  /** Page margins in mm (default: 10) */
  pageMargin?: number;
}

/** Resolved options with all defaults applied */
interface ResolvedExportOptions {
  scale: number;
  backgroundColor: string;
  padding: number;
  title?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: ResolvedExportOptions = {
  scale: 2,
  backgroundColor: '#0a0a0a',
  padding: 20,
};

const TITLE_FONT_SIZE = 16;
const TITLE_LINE_HEIGHT = 24;
const TITLE_COLOR = '#e5e5e5';
const TITLE_FONT_FAMILY = 'monospace';

// ============================================================================
// Internal Helpers
// ============================================================================

function resolveOptions(options?: ExportOptions): ResolvedExportOptions {
  return {
    scale: options?.scale ?? DEFAULT_OPTIONS.scale,
    backgroundColor: options?.backgroundColor ?? DEFAULT_OPTIONS.backgroundColor,
    padding: options?.padding ?? DEFAULT_OPTIONS.padding,
    title: options?.title,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Computes the bounding box of all visible content in world coordinates.
 * Scans components, wires, and junctions to find the enclosing rectangle.
 */
function computeWorldBounds(
  components: Map<string, Block>,
  wires: Wire[],
  junctions: Map<string, Junction>,
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasContent = false;

  for (const block of components.values()) {
    hasContent = true;
    minX = Math.min(minX, block.position.x);
    minY = Math.min(minY, block.position.y);
    maxX = Math.max(maxX, block.position.x + block.size.width);
    maxY = Math.max(maxY, block.position.y + block.size.height);
  }

  for (const junction of junctions.values()) {
    hasContent = true;
    minX = Math.min(minX, junction.position.x - 4);
    minY = Math.min(minY, junction.position.y - 4);
    maxX = Math.max(maxX, junction.position.x + 4);
    maxY = Math.max(maxY, junction.position.y + 4);
  }

  for (const wire of wires) {
    if (isPortEndpoint(wire.from)) {
      const comp = components.get(wire.from.componentId);
      if (comp) {
        hasContent = true;
        minX = Math.min(minX, comp.position.x);
        minY = Math.min(minY, comp.position.y);
        maxX = Math.max(maxX, comp.position.x + comp.size.width);
        maxY = Math.max(maxY, comp.position.y + comp.size.height);
      }
    } else {
      const junc = junctions.get(wire.from.junctionId);
      if (junc) {
        hasContent = true;
        minX = Math.min(minX, junc.position.x);
        minY = Math.min(minY, junc.position.y);
        maxX = Math.max(maxX, junc.position.x);
        maxY = Math.max(maxY, junc.position.y);
      }
    }

    if (isPortEndpoint(wire.to)) {
      const comp = components.get(wire.to.componentId);
      if (comp) {
        hasContent = true;
        minX = Math.min(minX, comp.position.x);
        minY = Math.min(minY, comp.position.y);
        maxX = Math.max(maxX, comp.position.x + comp.size.width);
        maxY = Math.max(maxY, comp.position.y + comp.size.height);
      }
    } else {
      const junc = junctions.get(wire.to.junctionId);
      if (junc) {
        hasContent = true;
        minX = Math.min(minX, junc.position.x);
        minY = Math.min(minY, junc.position.y);
        maxX = Math.max(maxX, junc.position.x);
        maxY = Math.max(maxY, junc.position.y);
      }
    }

    if (wire.handles) {
      for (const handle of wire.handles) {
        minX = Math.min(minX, handle.position.x);
        minY = Math.min(minY, handle.position.y);
        maxX = Math.max(maxX, handle.position.x);
        maxY = Math.max(maxY, handle.position.y);
      }
    }
  }

  if (!hasContent) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Get the active canvas document data from the Zustand store.
 */
function getCanvasDocumentData(documentId: string): CanvasDocumentData | null {
  const state = useDocumentRegistry.getState();
  const doc = state.documents.get(documentId);
  if (!doc || !isCanvasDocument(doc)) {
    return null;
  }
  return doc.data;
}

/**
 * Capture the Pixi viewport as an HTMLCanvasElement using the extract API.
 * Temporarily repositions the viewport to frame the given world-space bounds.
 */
function captureViewportRegion(
  app: Application,
  viewport: Viewport,
  worldBounds: { x: number; y: number; width: number; height: number },
  opts: ResolvedExportOptions,
): HTMLCanvasElement {
  // Save current viewport state
  const savedScaleX = viewport.scale.x;
  const savedScaleY = viewport.scale.y;
  const savedX = viewport.x;
  const savedY = viewport.y;

  try {
    // Calculate frame with padding in world coordinates
    const paddingWorld = opts.padding / opts.scale;
    const frameX = worldBounds.x - paddingWorld;
    const frameY = worldBounds.y - paddingWorld;
    const frameWidth = worldBounds.width + paddingWorld * 2;
    const frameHeight = worldBounds.height + paddingWorld * 2;

    const frame = new Rectangle(frameX, frameY, frameWidth, frameHeight);

    // Use Pixi v8 extract API with frame option
    const extracted = app.renderer.extract.canvas({
      target: viewport,
      frame,
      resolution: opts.scale,
      clearColor: opts.backgroundColor,
    });

    return extracted as HTMLCanvasElement;
  } finally {
    // Restore viewport state
    viewport.scale.set(savedScaleX, savedScaleY);
    viewport.position.set(savedX, savedY);
  }
}

/**
 * Add a title to a canvas by compositing it onto a new canvas with the title.
 */
function addTitleToCanvas(
  sourceCanvas: HTMLCanvasElement,
  title: string,
  opts: ResolvedExportOptions,
): HTMLCanvasElement {
  const titleHeight = TITLE_LINE_HEIGHT + 8;
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height + Math.ceil(titleHeight * opts.scale);

  const ctx = resultCanvas.getContext('2d');
  if (!ctx) {
    return sourceCanvas;
  }

  // Background
  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);

  // Title text
  ctx.fillStyle = TITLE_COLOR;
  ctx.font = `bold ${TITLE_FONT_SIZE * opts.scale}px ${TITLE_FONT_FAMILY}`;
  ctx.fillText(title, opts.padding * opts.scale, (opts.padding + TITLE_FONT_SIZE) * opts.scale);

  // Source canvas below title
  ctx.drawImage(sourceCanvas, 0, Math.ceil(titleHeight * opts.scale));

  return resultCanvas;
}

/**
 * Convert a canvas element to a PNG blob.
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob returned null'));
        }
      },
      'image/png',
      1.0,
    );
  });
}

/**
 * Convert a Blob to a data URL.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Get image dimensions from a data URL.
 */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error('Failed to load image for dimension check'));
    img.src = dataUrl;
  });
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Export the Pixi canvas content as a PNG blob.
 *
 * Uses the Pixi v8 extract API to capture the viewport content.
 * Exports the full schematic (all content), not just the visible area.
 *
 * @param app       - Pixi Application instance
 * @param viewport  - pixi-viewport Viewport instance
 * @param documentId - Active document ID for reading data from store
 * @param options   - Export configuration
 * @returns A Promise resolving to a PNG Blob
 */
export async function exportPixiToPng(
  app: Application,
  viewport: Viewport,
  documentId: string,
  options?: ExportOptions,
): Promise<Blob> {
  const opts = resolveOptions(options);
  const data = getCanvasDocumentData(documentId);

  if (!data) {
    throw new Error(`No canvas document found for ID: ${documentId}`);
  }

  const worldBounds = computeWorldBounds(data.components, data.wires, data.junctions);
  if (!worldBounds) {
    // Empty canvas — export a small placeholder
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = 200;
    emptyCanvas.height = 200;
    const ctx = emptyCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = opts.backgroundColor;
      ctx.fillRect(0, 0, 200, 200);
    }
    return canvasToBlob(emptyCanvas);
  }

  let canvas = captureViewportRegion(app, viewport, worldBounds, opts);

  if (opts.title) {
    canvas = addTitleToCanvas(canvas, opts.title, opts);
  }

  return canvasToBlob(canvas);
}

/**
 * Export the canvas content as a standalone SVG string.
 *
 * Generates SVG from the schematic data in the Zustand store.
 * This is a data-driven SVG generation, not a Pixi Graphics extraction.
 *
 * @param documentId - Active document ID
 * @param options    - Export configuration
 * @returns A Promise resolving to an SVG document string
 */
export async function exportPixiToSvg(
  documentId: string,
  options?: ExportOptions,
): Promise<string> {
  const opts = resolveOptions(options);
  const data = getCanvasDocumentData(documentId);

  if (!data) {
    throw new Error(`No canvas document found for ID: ${documentId}`);
  }

  const worldBounds = computeWorldBounds(data.components, data.wires, data.junctions);
  if (!worldBounds) {
    return '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>';
  }

  const { padding, backgroundColor, title } = opts;
  const titleHeight = title ? TITLE_LINE_HEIGHT + 8 : 0;
  const viewBoxWidth = worldBounds.width + padding * 2;
  const viewBoxHeight = worldBounds.height + padding * 2 + titleHeight;

  const offsetX = -worldBounds.x + padding;
  const offsetY = -worldBounds.y + padding + titleHeight;

  const svgParts: string[] = [];

  // Render blocks as rectangles with labels
  for (const block of data.components.values()) {
    const x = block.position.x + offsetX;
    const y = block.position.y + offsetY;
    svgParts.push(
      `<rect x="${x}" y="${y}" width="${block.size.width}" height="${block.size.height}" ` +
      `fill="#2a2a2a" stroke="#888888" stroke-width="1" />`,
    );
    const blockWithDesignation = block as { designation?: string };
    if (blockWithDesignation.designation) {
      svgParts.push(
        `<text x="${x + block.size.width / 2}" y="${y - 4}" ` +
        `text-anchor="middle" fill="#9ca3af" font-size="11" font-family="monospace">` +
        `${escapeXml(blockWithDesignation.designation)}</text>`,
      );
    }
  }

  // Render junctions as circles
  for (const junction of data.junctions.values()) {
    const cx = junction.position.x + offsetX;
    const cy = junction.position.y + offsetY;
    svgParts.push(
      `<circle cx="${cx}" cy="${cy}" r="4" fill="#10b981" />`,
    );
  }

  // Build SVG document
  let svgDoc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${viewBoxWidth}"
     height="${viewBoxHeight}"
     viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">
  <rect width="100%" height="100%" fill="${backgroundColor}" />`;

  if (title) {
    svgDoc += `
  <text x="${padding}" y="${padding + TITLE_FONT_SIZE}"
        fill="${TITLE_COLOR}" font-family="${TITLE_FONT_FAMILY}" font-size="${TITLE_FONT_SIZE}"
        font-weight="bold">${escapeXml(title)}</text>`;
  }

  svgDoc += `\n  ${svgParts.join('\n  ')}`;
  svgDoc += '\n</svg>';

  return svgDoc;
}

/**
 * Export the canvas content as PDF.
 *
 * Generates a PNG image first via the Pixi extract API,
 * then embeds it in a PDF document using jsPDF.
 *
 * @param app        - Pixi Application instance
 * @param viewport   - pixi-viewport Viewport instance
 * @param documentId - Active document ID
 * @param options    - Export configuration including PDF-specific options
 * @returns A Promise resolving to a PDF Blob
 */
export async function exportPixiToPdf(
  app: Application,
  viewport: Viewport,
  documentId: string,
  options?: PdfExportOptions,
): Promise<Blob> {
  const {
    orientation = 'auto',
    pageFormat = 'a4',
    fitToPage = true,
    pageMargin = 10,
    ...exportOptions
  } = options ?? {};

  const pngBlob = await exportPixiToPng(app, viewport, documentId, exportOptions);
  const pngDataUrl = await blobToDataUrl(pngBlob);
  const imgDimensions = await getImageDimensions(pngDataUrl);

  let pdfOrientation: 'portrait' | 'landscape';
  if (orientation === 'auto') {
    pdfOrientation = imgDimensions.width > imgDimensions.height ? 'landscape' : 'portrait';
  } else {
    pdfOrientation = orientation;
  }

  const doc = new jsPDF({
    orientation: pdfOrientation,
    unit: 'mm',
    format: pageFormat,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - pageMargin * 2;
  const contentHeight = pageHeight - pageMargin * 2;

  let imgWidth: number;
  let imgHeight: number;
  let imgX: number;
  let imgY: number;

  if (fitToPage) {
    const imgAspect = imgDimensions.width / imgDimensions.height;
    const pageAspect = contentWidth / contentHeight;

    if (imgAspect > pageAspect) {
      imgWidth = contentWidth;
      imgHeight = contentWidth / imgAspect;
    } else {
      imgHeight = contentHeight;
      imgWidth = contentHeight * imgAspect;
    }

    imgX = pageMargin + (contentWidth - imgWidth) / 2;
    imgY = pageMargin + (contentHeight - imgHeight) / 2;
  } else {
    const exportScale = exportOptions.scale ?? 2;
    const dpi = 96 * exportScale;
    const mmPerPx = 25.4 / dpi;

    imgWidth = imgDimensions.width * mmPerPx;
    imgHeight = imgDimensions.height * mmPerPx;
    imgX = pageMargin;
    imgY = pageMargin;
  }

  if (exportOptions.title) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(exportOptions.title, pageMargin, pageMargin / 2 + 3);
    imgY = Math.max(imgY, pageMargin + 5);
  }

  doc.addImage(pngDataUrl, 'PNG', imgX, imgY, imgWidth, imgHeight);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  const timestamp = new Date().toLocaleString();
  doc.text(`Exported: ${timestamp}`, pageMargin, pageHeight - 5);

  return doc.output('blob');
}
