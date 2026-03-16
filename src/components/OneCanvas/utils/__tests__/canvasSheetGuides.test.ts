import { describe, expect, it } from 'vitest';
import {
  getDefaultCanvasSheetBounds,
  getDefaultPdfOutputGuideBounds,
} from '../canvasSheetGuides';

describe('canvasSheetGuides', () => {
  it('uses an A0 landscape canvas as the default sheet', () => {
    expect(getDefaultCanvasSheetBounds()).toMatchObject({
      x: 0,
      y: 0,
      width: 1189,
      height: 841,
      paperSize: 'A0',
      orientation: 'landscape',
    });
  });

  it('centers the A3 pdf output guide inside the default canvas sheet', () => {
    expect(getDefaultPdfOutputGuideBounds()).toMatchObject({
      x: 384.5,
      y: 272,
      width: 420,
      height: 297,
      paperSize: 'A3',
      orientation: 'landscape',
    });
  });
});
