/**
 * Canvas Export Utility
 *
 * Exports the OneCanvas content as PNG, SVG, or PDF.
 * Uses XMLSerializer + foreignObject approach for DOM-to-image conversion.
 *
 * Architecture:
 * - SVG export: Collects all SVG elements and HTML blocks from the container,
 *   wraps them in a standalone SVG document with foreignObject for HTML content.
 * - PNG export: Renders the SVG export result onto an offscreen <canvas>,
 *   then extracts a PNG blob.
 * - PDF export: Generates PNG first, then embeds in a jsPDF document.
 */

import { jsPDF } from 'jspdf';

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

/**
 * Computes the bounding box of all visible content within the container.
 * Scans block elements (positioned absolutely) and SVG elements to determine
 * the minimum enclosing rectangle in canvas-space coordinates.
 */
function computeContentBounds(container: HTMLElement): DOMRect {
  // Collect all bounding rects from child elements
  const rects: DOMRect[] = [];

  // Blocks are absolutely positioned divs inside the TransformedLayer
  const blockElements = container.querySelectorAll('[data-block-id]');
  blockElements.forEach((el) => {
    rects.push(el.getBoundingClientRect());
  });

  // SVG wire elements
  const svgElements = container.querySelectorAll('svg');
  svgElements.forEach((svg) => {
    // Get bounding boxes of individual SVG content (paths, circles, etc.)
    const paths = svg.querySelectorAll('path[d], circle, line, rect, polyline, polygon');
    paths.forEach((path) => {
      try {
        const rect = path.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          rects.push(rect);
        }
      } catch {
        // getBoundingClientRect can fail on detached elements
      }
    });
  });

  if (rects.length === 0) {
    // Fallback: use the container's own bounding rect
    return container.getBoundingClientRect();
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const rect of rects) {
    minX = Math.min(minX, rect.left);
    minY = Math.min(minY, rect.top);
    maxX = Math.max(maxX, rect.right);
    maxY = Math.max(maxY, rect.bottom);
  }

  return new DOMRect(minX, minY, maxX - minX, maxY - minY);
}

/**
 * Clones the container DOM subtree and inlines all computed styles
 * so the clone renders identically when placed inside a foreignObject.
 */
function cloneWithInlineStyles(node: HTMLElement): HTMLElement {
  const clone = node.cloneNode(true) as HTMLElement;
  inlineStylesRecursive(node, clone);
  return clone;
}

function inlineStylesRecursive(source: Element, target: Element): void {
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) return;

  const computed = window.getComputedStyle(source);
  // Copy key visual properties
  const properties = [
    'background-color', 'background', 'color', 'font-family', 'font-size',
    'font-weight', 'line-height', 'text-align', 'text-decoration',
    'border', 'border-radius', 'border-color', 'border-width', 'border-style',
    'padding', 'margin', 'width', 'height', 'min-width', 'min-height',
    'max-width', 'max-height', 'position', 'top', 'left', 'right', 'bottom',
    'display', 'flex-direction', 'justify-content', 'align-items', 'gap',
    'overflow', 'opacity', 'visibility', 'transform', 'transform-origin',
    'box-shadow', 'filter', 'z-index', 'pointer-events',
    'fill', 'stroke', 'stroke-width',
  ];

  for (const prop of properties) {
    const value = computed.getPropertyValue(prop);
    if (value) {
      target.style.setProperty(prop, value);
    }
  }

  // Remove Tailwind/class-based styles since they won't resolve in foreignObject
  // The inline styles we just set will take over
  // Keep classes for potential SVG use
  if (target.tagName !== 'svg' && !target.closest?.('svg')) {
    // Keep className but styles are now inline
  }

  // Recurse into children
  const sourceChildren = source.children;
  const targetChildren = target.children;
  const len = Math.min(sourceChildren.length, targetChildren.length);
  for (let i = 0; i < len; i++) {
    inlineStylesRecursive(sourceChildren[i], targetChildren[i]);
  }
}

/**
 * Extracts all stylesheets from the document and returns them as a single
 * <style> string for embedding in an SVG foreignObject.
 */
function collectStylesheets(): string {
  const styles: string[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules || sheet.rules;
      for (const rule of Array.from(rules)) {
        styles.push(rule.cssText);
      }
    } catch {
      // Cross-origin stylesheets will throw – skip them
    }
  }

  return styles.join('\n');
}

/**
 * Serializes the container's SVG elements into a standalone SVG string.
 */
function serializeSvgContent(
  container: HTMLElement,
  bounds: DOMRect,
  opts: ResolvedExportOptions,
): string {
  const { padding, backgroundColor, title } = opts;

  const titleHeight = title ? TITLE_LINE_HEIGHT + 8 : 0;
  const viewBoxWidth = bounds.width + padding * 2;
  const viewBoxHeight = bounds.height + padding * 2 + titleHeight;

  const svgParts: string[] = [];

  // Collect all SVG elements from the container
  const svgElements = container.querySelectorAll('svg');
  svgElements.forEach((svg) => {
    const children = svg.innerHTML;
    if (children.trim()) {
      // Compute SVG element offset relative to the container
      const svgRect = svg.getBoundingClientRect();
      const offsetX = svgRect.left - bounds.left + padding;
      const offsetY = svgRect.top - bounds.top + padding + titleHeight;

      svgParts.push(`<g transform="translate(${offsetX}, ${offsetY})">${children}</g>`);
    }
  });

  // Build the standalone SVG document
  let svgDoc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${viewBoxWidth}"
     height="${viewBoxHeight}"
     viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">
  <rect width="100%" height="100%" fill="${backgroundColor}" />`;

  // Title block
  if (title) {
    svgDoc += `
  <text x="${padding}" y="${padding + TITLE_FONT_SIZE}"
        fill="${TITLE_COLOR}" font-family="${TITLE_FONT_FAMILY}" font-size="${TITLE_FONT_SIZE}"
        font-weight="bold">${escapeXml(title)}</text>`;
  }

  // SVG content
  svgDoc += `\n  ${svgParts.join('\n  ')}`;

  svgDoc += '\n</svg>';

  return svgDoc;
}

/**
 * Builds a full SVG document with foreignObject wrapping the cloned DOM content.
 * This approach preserves HTML block rendering for PNG export.
 */
function buildForeignObjectSvg(
  container: HTMLElement,
  bounds: DOMRect,
  opts: ResolvedExportOptions,
): string {
  const { padding, backgroundColor, title, scale } = opts;

  const titleHeight = title ? TITLE_LINE_HEIGHT + 8 : 0;
  const contentWidth = bounds.width + padding * 2;
  const contentHeight = bounds.height + padding * 2 + titleHeight;
  const outputWidth = contentWidth * scale;
  const outputHeight = contentHeight * scale;

  // Clone and inline styles
  const clone = cloneWithInlineStyles(container);

  // Remove any interactive attributes / event handlers from clone
  clone.querySelectorAll('[data-wire-id]').forEach((el) => {
    el.removeAttribute('onclick');
    el.removeAttribute('onmousedown');
  });

  // Adjust clone positioning: reset transform, position at origin
  clone.style.position = 'relative';
  clone.style.transform = 'none';
  clone.style.transformOrigin = '0 0';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.overflow = 'visible';

  const serializer = new XMLSerializer();
  const cloneHtml = serializer.serializeToString(clone);
  const cssText = collectStylesheets();

  let svg = `<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${outputWidth}"
     height="${outputHeight}"
     viewBox="0 0 ${contentWidth} ${contentHeight}">
  <rect width="100%" height="100%" fill="${backgroundColor}" />`;

  // Title
  if (title) {
    svg += `
  <text x="${padding}" y="${padding + TITLE_FONT_SIZE}"
        fill="${TITLE_COLOR}" font-family="${TITLE_FONT_FAMILY}" font-size="${TITLE_FONT_SIZE}"
        font-weight="bold">${escapeXml(title)}</text>`;
  }

  // ForeignObject containing the cloned DOM
  svg += `
  <foreignObject x="${padding}" y="${padding + titleHeight}"
                 width="${bounds.width}" height="${bounds.height}">
    <div xmlns="http://www.w3.org/1999/xhtml"
         style="width: ${bounds.width}px; height: ${bounds.height}px; overflow: hidden; position: relative;">
      <style>${cssText}</style>
      ${cloneHtml}
    </div>
  </foreignObject>`;

  svg += '\n</svg>';

  return svg;
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
 * Renders an SVG string onto an offscreen canvas and returns the resulting PNG blob.
 */
function svgToCanvas(
  svgString: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to get 2D canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load SVG image for rendering: ${e}`));
    };

    img.src = url;
  });
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Export the canvas content as a PNG blob.
 *
 * Uses the foreignObject approach:
 * 1. Clone the container DOM with inlined styles
 * 2. Wrap in an SVG foreignObject
 * 3. Render the SVG onto an offscreen <canvas>
 * 4. Extract a PNG blob
 *
 * @param container - The DOM element containing the canvas content
 *                    (typically the TransformedLayer content div)
 * @param options   - Export configuration
 * @returns A Promise resolving to a PNG Blob
 */
export async function exportToPng(
  container: HTMLElement,
  options?: ExportOptions,
): Promise<Blob> {
  const opts = resolveOptions(options);
  const bounds = computeContentBounds(container);

  const titleHeight = opts.title ? TITLE_LINE_HEIGHT + 8 : 0;
  const contentWidth = bounds.width + opts.padding * 2;
  const contentHeight = bounds.height + opts.padding * 2 + titleHeight;
  const outputWidth = Math.ceil(contentWidth * opts.scale);
  const outputHeight = Math.ceil(contentHeight * opts.scale);

  // Build SVG with foreignObject for full DOM fidelity
  const svgString = buildForeignObjectSvg(container, bounds, opts);

  // Render SVG to canvas
  const canvas = await svgToCanvas(svgString, outputWidth, outputHeight);

  // Extract PNG blob
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
 * Export the canvas content as a standalone SVG string.
 *
 * Extracts only the SVG elements (wires, junctions) from the container.
 * HTML block content is not included — use PNG export for full fidelity.
 *
 * @param container - The DOM element containing the canvas content
 * @param options   - Export configuration
 * @returns A Promise resolving to an SVG document string
 */
export async function exportToSvg(
  container: HTMLElement,
  options?: ExportOptions,
): Promise<string> {
  const opts = resolveOptions(options);
  const bounds = computeContentBounds(container);

  return serializeSvgContent(container, bounds, opts);
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

/**
 * Export the canvas content as PDF.
 *
 * Generates a PNG image first, then embeds it in a PDF document using jsPDF.
 * Automatically adjusts page orientation based on content aspect ratio.
 *
 * @param container - The DOM element containing the canvas content
 * @param options   - Export configuration including PDF-specific options
 * @returns A Promise resolving to a PDF Blob
 */
export async function exportToPdf(
  container: HTMLElement,
  options?: PdfExportOptions,
): Promise<Blob> {
  const {
    orientation = 'auto',
    pageFormat = 'a4',
    fitToPage = true,
    pageMargin = 10,
    ...exportOptions
  } = options || {};

  // First, generate PNG from the canvas
  const pngBlob = await exportToPng(container, exportOptions);

  // Convert blob to base64 data URL for jsPDF
  const pngDataUrl = await blobToDataUrl(pngBlob);

  // Get image dimensions
  const imgDimensions = await getImageDimensions(pngDataUrl);

  // Determine page orientation based on content aspect ratio
  let pdfOrientation: 'portrait' | 'landscape';
  if (orientation === 'auto') {
    pdfOrientation = imgDimensions.width > imgDimensions.height ? 'landscape' : 'portrait';
  } else {
    pdfOrientation = orientation;
  }

  // Create PDF document
  const doc = new jsPDF({
    orientation: pdfOrientation,
    unit: 'mm',
    format: pageFormat,
  });

  // Get page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - pageMargin * 2;
  const contentHeight = pageHeight - pageMargin * 2;

  // Calculate image placement
  let imgWidth: number;
  let imgHeight: number;
  let imgX: number;
  let imgY: number;

  if (fitToPage) {
    // Scale to fit within the content area while maintaining aspect ratio
    const imgAspect = imgDimensions.width / imgDimensions.height;
    const pageAspect = contentWidth / contentHeight;

    if (imgAspect > pageAspect) {
      // Width-constrained
      imgWidth = contentWidth;
      imgHeight = contentWidth / imgAspect;
    } else {
      // Height-constrained
      imgHeight = contentHeight;
      imgWidth = contentHeight * imgAspect;
    }

    // Center on page
    imgX = pageMargin + (contentWidth - imgWidth) / 2;
    imgY = pageMargin + (contentHeight - imgHeight) / 2;
  } else {
    // Use actual pixel dimensions, converting to mm (assuming 96 DPI)
    const scale = (options?.scale ?? 2);
    const dpi = 96 * scale;
    const mmPerPx = 25.4 / dpi;

    imgWidth = imgDimensions.width * mmPerPx;
    imgHeight = imgDimensions.height * mmPerPx;
    imgX = pageMargin;
    imgY = pageMargin;

    // Handle multi-page if content is too large
    // For now, just use the first page with content at origin
  }

  // Add title if provided
  if (exportOptions.title) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(exportOptions.title, pageMargin, pageMargin / 2 + 3);
    // Adjust image position to account for title
    imgY = Math.max(imgY, pageMargin + 5);
  }

  // Add the image to the PDF
  doc.addImage(pngDataUrl, 'PNG', imgX, imgY, imgWidth, imgHeight);

  // Add footer with timestamp
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  const timestamp = new Date().toLocaleString();
  doc.text(`Exported: ${timestamp}`, pageMargin, pageHeight - 5);

  // Return as blob
  return doc.output('blob');
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
 * Get the dimensions of an image from its data URL.
 */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => reject(new Error('Failed to load image for dimension check'));
    img.src = dataUrl;
  });
}

// ============================================================================
// Download Helpers
// ============================================================================

/**
 * Triggers a browser download for a Blob.
 *
 * @param blob     - The file content as a Blob
 * @param filename - Suggested filename for the download
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  // Cleanup after a short delay to ensure the download starts
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Triggers a browser download for a text string.
 *
 * @param text     - The text content to download
 * @param filename - Suggested filename for the download
 * @param mimeType - MIME type (default: 'text/plain')
 */
export function downloadText(
  text: string,
  filename: string,
  mimeType: string = 'text/plain',
): void {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  downloadBlob(blob, filename);
}
