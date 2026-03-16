import type { Rect } from '../types';
import {
  getPaperDimensions,
  type PaperOrientation,
  type PaperSize,
} from './printSupport';

export const DEFAULT_CANVAS_PAPER_SIZE: PaperSize = 'A0';
export const DEFAULT_CANVAS_ORIENTATION: PaperOrientation = 'landscape';
export const DEFAULT_PDF_OUTPUT_PAPER_SIZE: PaperSize = 'A3';
export const DEFAULT_PDF_OUTPUT_ORIENTATION: PaperOrientation = 'landscape';

export interface SheetGuideBounds extends Rect {
  paperSize: PaperSize;
  orientation: PaperOrientation;
}

function createSheetBounds(
  paperSize: PaperSize,
  orientation: PaperOrientation,
  x: number = 0,
  y: number = 0,
): SheetGuideBounds {
  const dimensions = getPaperDimensions(paperSize, orientation);

  return {
    x,
    y,
    width: dimensions.width,
    height: dimensions.height,
    paperSize,
    orientation,
  };
}

export function getDefaultCanvasSheetBounds(): SheetGuideBounds {
  return createSheetBounds(DEFAULT_CANVAS_PAPER_SIZE, DEFAULT_CANVAS_ORIENTATION);
}

export function getDefaultPdfOutputGuideBounds(): SheetGuideBounds {
  const canvasBounds = getDefaultCanvasSheetBounds();
  const outputBounds = createSheetBounds(
    DEFAULT_PDF_OUTPUT_PAPER_SIZE,
    DEFAULT_PDF_OUTPUT_ORIENTATION,
  );

  return {
    ...outputBounds,
    x: canvasBounds.x + (canvasBounds.width - outputBounds.width) / 2,
    y: canvasBounds.y + (canvasBounds.height - outputBounds.height) / 2,
  };
}
