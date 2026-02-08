/**
 * Print Support Utility
 *
 * Provides functionality for printing circuit schematics with:
 * - IEC/ISO standard title blocks
 * - Page layout configuration
 * - Multi-page printing support
 * - Print preview generation
 */

import type { Block } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Paper size standard */
export type PaperSize = 'A4' | 'A3' | 'A2' | 'A1' | 'A0' | 'Letter' | 'Legal' | 'Tabloid';

/** Paper orientation */
export type PaperOrientation = 'portrait' | 'landscape';

/** Title block position */
export type TitleBlockPosition = 'bottom-right' | 'bottom' | 'right';

/** Title block information (IEC/ISO standard) */
export interface TitleBlockInfo {
  /** Company/organization name */
  company?: string;
  /** Project title */
  projectTitle: string;
  /** Drawing title */
  drawingTitle: string;
  /** Drawing number */
  drawingNumber: string;
  /** Revision number */
  revision?: string;
  /** Drawn by */
  drawnBy?: string;
  /** Checked by */
  checkedBy?: string;
  /** Approved by */
  approvedBy?: string;
  /** Date (ISO format) */
  date?: string;
  /** Sheet number */
  sheetNumber?: number;
  /** Total sheets */
  totalSheets?: number;
  /** Scale */
  scale?: string;
  /** Additional notes */
  notes?: string;
}

/** Print layout configuration */
export interface PrintLayoutConfig {
  /** Paper size */
  paperSize: PaperSize;
  /** Paper orientation */
  orientation: PaperOrientation;
  /** Page margins in mm */
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Title block position */
  titleBlockPosition: TitleBlockPosition;
  /** Title block information */
  titleBlock: TitleBlockInfo;
  /** Whether to show grid in print */
  showGrid?: boolean;
  /** Grid color for printing */
  gridColor?: string;
  /** Whether to show wire labels */
  showWireLabels?: boolean;
  /** Whether to show component designations */
  showDesignations?: boolean;
  /** Print scale (1.0 = 100%) */
  scale?: number;
}

/** Paper dimensions in mm */
interface PaperDimensions {
  width: number;
  height: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Paper sizes in mm (width x height in portrait) */
export const PAPER_SIZES: Record<PaperSize, PaperDimensions> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
  A0: { width: 841, height: 1189 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  Tabloid: { width: 279, height: 432 },
};

/** Default margins in mm */
export const DEFAULT_MARGINS = {
  top: 10,
  right: 10,
  bottom: 25, // Extra space for title block
  left: 10,
};

/** Title block dimensions */
const TITLE_BLOCK_HEIGHT = 45; // mm
const TITLE_BLOCK_WIDTH_RATIO = 0.5; // 50% of page width

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get paper dimensions considering orientation
 */
export function getPaperDimensions(
  paperSize: PaperSize,
  orientation: PaperOrientation
): PaperDimensions {
  const base = PAPER_SIZES[paperSize];
  
  if (orientation === 'landscape') {
    return { width: base.height, height: base.width };
  }
  
  return { ...base };
}

/**
 * Convert mm to pixels at given DPI
 */
export function mmToPixels(mm: number, dpi: number = 96): number {
  return (mm / 25.4) * dpi;
}

/**
 * Convert pixels to mm at given DPI
 */
export function pixelsToMm(pixels: number, dpi: number = 96): number {
  return (pixels / dpi) * 25.4;
}

/**
 * Calculate the printable area dimensions
 */
export function getPrintableArea(config: PrintLayoutConfig): {
  width: number;
  height: number;
  x: number;
  y: number;
} {
  const paper = getPaperDimensions(config.paperSize, config.orientation);
  
  return {
    x: config.margins.left,
    y: config.margins.top,
    width: paper.width - config.margins.left - config.margins.right,
    height: paper.height - config.margins.top - config.margins.bottom - TITLE_BLOCK_HEIGHT,
  };
}

// ============================================================================
// Title Block Generation
// ============================================================================

/**
 * Generate SVG for title block (IEC/ISO standard format)
 */
export function generateTitleBlockSvg(
  config: PrintLayoutConfig,
  dpi: number = 96
): string {
  const paper = getPaperDimensions(config.paperSize, config.orientation);
  const titleBlock = config.titleBlock;
  
  // Title block dimensions
  const blockWidth = paper.width * TITLE_BLOCK_WIDTH_RATIO;
  const blockHeight = TITLE_BLOCK_HEIGHT;
  const x = paper.width - config.margins.right - blockWidth;
  const y = paper.height - config.margins.bottom - blockHeight;
  
  // Convert to pixels
  const xPx = mmToPixels(x, dpi);
  const yPx = mmToPixels(y, dpi);
  const widthPx = mmToPixels(blockWidth, dpi);
  const heightPx = mmToPixels(blockHeight, dpi);
  
  // Cell heights
  const rowHeight = heightPx / 4;
  
  const svg = `
    <g class="title-block" transform="translate(${xPx}, ${yPx})">
      <!-- Outer border -->
      <rect x="0" y="0" width="${widthPx}" height="${heightPx}" 
            fill="white" stroke="black" stroke-width="1.5"/>
      
      <!-- Row dividers -->
      <line x1="0" y1="${rowHeight}" x2="${widthPx}" y2="${rowHeight}" 
            stroke="black" stroke-width="0.5"/>
      <line x1="0" y1="${rowHeight * 2}" x2="${widthPx}" y2="${rowHeight * 2}" 
            stroke="black" stroke-width="0.5"/>
      <line x1="0" y1="${rowHeight * 3}" x2="${widthPx}" y2="${rowHeight * 3}" 
            stroke="black" stroke-width="0.5"/>
      
      <!-- Column dividers (for bottom rows) -->
      <line x1="${widthPx * 0.25}" y1="${rowHeight * 2}" x2="${widthPx * 0.25}" y2="${heightPx}" 
            stroke="black" stroke-width="0.5"/>
      <line x1="${widthPx * 0.5}" y1="${rowHeight * 2}" x2="${widthPx * 0.5}" y2="${heightPx}" 
            stroke="black" stroke-width="0.5"/>
      <line x1="${widthPx * 0.75}" y1="${rowHeight * 2}" x2="${widthPx * 0.75}" y2="${heightPx}" 
            stroke="black" stroke-width="0.5"/>
      
      <!-- Row 1: Company Name -->
      <text x="${widthPx / 2}" y="${rowHeight * 0.6}" 
            font-family="Arial, sans-serif" font-size="14" font-weight="bold"
            text-anchor="middle">${titleBlock.company || ''}</text>
      
      <!-- Row 2: Project & Drawing Title -->
      <text x="5" y="${rowHeight * 1.3}" 
            font-family="Arial, sans-serif" font-size="10" fill="#666">Project:</text>
      <text x="50" y="${rowHeight * 1.3}" 
            font-family="Arial, sans-serif" font-size="11">${titleBlock.projectTitle}</text>
      <text x="5" y="${rowHeight * 1.75}" 
            font-family="Arial, sans-serif" font-size="10" fill="#666">Title:</text>
      <text x="50" y="${rowHeight * 1.75}" 
            font-family="Arial, sans-serif" font-size="11" font-weight="bold">${titleBlock.drawingTitle}</text>
      
      <!-- Row 3: Drawn By, Checked By, Date, Scale -->
      <text x="5" y="${rowHeight * 2.4}" 
            font-family="Arial, sans-serif" font-size="8" fill="#666">Drawn</text>
      <text x="5" y="${rowHeight * 2.7}" 
            font-family="Arial, sans-serif" font-size="9">${titleBlock.drawnBy || ''}</text>
      
      <text x="${widthPx * 0.25 + 5}" y="${rowHeight * 2.4}" 
            font-family="Arial, sans-serif" font-size="8" fill="#666">Checked</text>
      <text x="${widthPx * 0.25 + 5}" y="${rowHeight * 2.7}" 
            font-family="Arial, sans-serif" font-size="9">${titleBlock.checkedBy || ''}</text>
      
      <text x="${widthPx * 0.5 + 5}" y="${rowHeight * 2.4}" 
            font-family="Arial, sans-serif" font-size="8" fill="#666">Date</text>
      <text x="${widthPx * 0.5 + 5}" y="${rowHeight * 2.7}" 
            font-family="Arial, sans-serif" font-size="9">${titleBlock.date || new Date().toISOString().split('T')[0]}</text>
      
      <text x="${widthPx * 0.75 + 5}" y="${rowHeight * 2.4}" 
            font-family="Arial, sans-serif" font-size="8" fill="#666">Scale</text>
      <text x="${widthPx * 0.75 + 5}" y="${rowHeight * 2.7}" 
            font-family="Arial, sans-serif" font-size="9">${titleBlock.scale || '1:1'}</text>
      
      <!-- Row 4: Drawing Number, Revision, Sheet -->
      <text x="5" y="${rowHeight * 3.4}" 
            font-family="Arial, sans-serif" font-size="8" fill="#666">Drawing No.</text>
      <text x="5" y="${rowHeight * 3.75}" 
            font-family="Arial, sans-serif" font-size="10" font-weight="bold">${titleBlock.drawingNumber}</text>
      
      <text x="${widthPx * 0.5 + 5}" y="${rowHeight * 3.4}" 
            font-family="Arial, sans-serif" font-size="8" fill="#666">Rev</text>
      <text x="${widthPx * 0.5 + 5}" y="${rowHeight * 3.75}" 
            font-family="Arial, sans-serif" font-size="10">${titleBlock.revision || 'A'}</text>
      
      <text x="${widthPx * 0.75 + 5}" y="${rowHeight * 3.4}" 
            font-family="Arial, sans-serif" font-size="8" fill="#666">Sheet</text>
      <text x="${widthPx * 0.75 + 5}" y="${rowHeight * 3.75}" 
            font-family="Arial, sans-serif" font-size="10">${titleBlock.sheetNumber || 1} of ${titleBlock.totalSheets || 1}</text>
    </g>
  `;
  
  return svg;
}

// ============================================================================
// Print Layout Functions
// ============================================================================

/**
 * Create default print layout configuration
 */
export function createDefaultPrintLayout(
  titleBlock: Partial<TitleBlockInfo> = {}
): PrintLayoutConfig {
  return {
    paperSize: 'A4',
    orientation: 'landscape',
    margins: { ...DEFAULT_MARGINS },
    titleBlockPosition: 'bottom-right',
    titleBlock: {
      projectTitle: titleBlock.projectTitle || 'Project',
      drawingTitle: titleBlock.drawingTitle || 'Schematic',
      drawingNumber: titleBlock.drawingNumber || 'DWG-001',
      revision: titleBlock.revision || 'A',
      date: titleBlock.date || new Date().toISOString().split('T')[0],
      sheetNumber: titleBlock.sheetNumber || 1,
      totalSheets: titleBlock.totalSheets || 1,
      scale: titleBlock.scale || '1:1',
      ...titleBlock,
    },
    showGrid: false,
    showWireLabels: true,
    showDesignations: true,
    scale: 1.0,
  };
}

/**
 * Calculate canvas bounds from components
 */
function calculateCanvasBounds(components: Block[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (components.length === 0) {
    return { minX: 0, minY: 0, maxX: 500, maxY: 500, width: 500, height: 500 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const block of components) {
    minX = Math.min(minX, block.position.x);
    minY = Math.min(minY, block.position.y);
    maxX = Math.max(maxX, block.position.x + block.size.width);
    maxY = Math.max(maxY, block.position.y + block.size.height);
  }

  const padding = 20;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Calculate the scale factor to fit content in printable area
 */
export function calculatePrintScale(
  components: Block[],
  config: PrintLayoutConfig,
  dpi: number = 96
): number {
  const canvasBounds = calculateCanvasBounds(components);
  const printableArea = getPrintableArea(config);
  
  // Convert printable area to pixels
  const printableWidthPx = mmToPixels(printableArea.width, dpi);
  const printableHeightPx = mmToPixels(printableArea.height, dpi);
  
  // Calculate scale factors
  const scaleX = printableWidthPx / canvasBounds.width;
  const scaleY = printableHeightPx / canvasBounds.height;
  
  // Use the smaller scale to fit everything
  return Math.min(scaleX, scaleY, config.scale || 1.0);
}

// ============================================================================
// Print Functions
// ============================================================================

/**
 * Generate print-ready HTML with CSS for printing
 */
export function generatePrintHtml(
  svgContent: string,
  config: PrintLayoutConfig
): string {
  const paper = getPaperDimensions(config.paperSize, config.orientation);
  const titleBlockSvg = generateTitleBlockSvg(config);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${config.titleBlock.drawingTitle} - ${config.titleBlock.drawingNumber}</title>
  <style>
    @page {
      size: ${config.paperSize} ${config.orientation};
      margin: 0;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    
    body {
      margin: 0;
      padding: 0;
      background: white;
    }
    
    .print-page {
      width: ${paper.width}mm;
      height: ${paper.height}mm;
      position: relative;
      overflow: hidden;
      page-break-after: always;
    }
    
    .schematic-content {
      position: absolute;
      top: ${config.margins.top}mm;
      left: ${config.margins.left}mm;
    }
    
    .title-block {
      position: absolute;
      bottom: ${config.margins.bottom}mm;
      right: ${config.margins.right}mm;
    }
  </style>
</head>
<body>
  <div class="print-page">
    <svg width="${paper.width}mm" height="${paper.height}mm" 
         viewBox="0 0 ${mmToPixels(paper.width)} ${mmToPixels(paper.height)}"
         xmlns="http://www.w3.org/2000/svg">
      
      <!-- Page border -->
      <rect x="${mmToPixels(config.margins.left - 1)}" 
            y="${mmToPixels(config.margins.top - 1)}" 
            width="${mmToPixels(paper.width - config.margins.left - config.margins.right + 2)}"
            height="${mmToPixels(paper.height - config.margins.top - config.margins.bottom + 2)}"
            fill="none" stroke="black" stroke-width="1"/>
      
      <!-- Schematic content -->
      <g transform="translate(${mmToPixels(config.margins.left)}, ${mmToPixels(config.margins.top)})">
        ${svgContent}
      </g>
      
      <!-- Title block -->
      ${titleBlockSvg}
    </svg>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Open print dialog for the current circuit
 */
export function openPrintDialog(
  svgContent: string,
  config: PrintLayoutConfig
): void {
  const printHtml = generatePrintHtml(svgContent, config);
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printHtml);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * Generate a print preview blob
 */
export function generatePrintPreviewBlob(
  svgContent: string,
  config: PrintLayoutConfig
): Blob {
  const printHtml = generatePrintHtml(svgContent, config);
  return new Blob([printHtml], { type: 'text/html' });
}
