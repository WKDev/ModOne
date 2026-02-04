import { describe, it, expect } from 'vitest';
import {
  screenToCanvas,
  canvasToScreen,
  calculateZoomPan,
} from '../canvasCoordinates';

describe('canvasCoordinates', () => {
  describe('screenToCanvas & canvasToScreen round-trip', () => {
    it('should convert back and forth without loss', () => {
      const testCases = [
        { screen: { x: 100, y: 200 }, pan: { x: 0, y: 0 }, zoom: 1 },
        { screen: { x: 100, y: 200 }, pan: { x: 50, y: 30 }, zoom: 1 },
        { screen: { x: 100, y: 200 }, pan: { x: 0, y: 0 }, zoom: 2 },
        { screen: { x: 100, y: 200 }, pan: { x: 50, y: 30 }, zoom: 1.5 },
        { screen: { x: 100, y: 200 }, pan: { x: -50, y: -30 }, zoom: 0.5 },
      ];

      testCases.forEach(({ screen, pan, zoom }) => {
        const canvas = screenToCanvas(screen, pan, zoom);
        const backToScreen = canvasToScreen(canvas, pan, zoom);

        expect(backToScreen.x).toBeCloseTo(screen.x, 5);
        expect(backToScreen.y).toBeCloseTo(screen.y, 5);
      });
    });
  });

  describe('calculateZoomPan', () => {
    it('should keep pivot point fixed in screen space after zoom', () => {
      const testCases = [
        {
          currentPan: { x: 0, y: 0 },
          currentZoom: 1,
          newZoom: 2,
          pivot: { x: 200, y: 150 },
        },
        {
          currentPan: { x: 50, y: 30 },
          currentZoom: 1.5,
          newZoom: 2.5,
          pivot: { x: 300, y: 250 },
        },
        {
          currentPan: { x: 100, y: 80 },
          currentZoom: 2,
          newZoom: 0.5,
          pivot: { x: 150, y: 100 },
        },
      ];

      testCases.forEach(({ currentPan, currentZoom, newZoom, pivot }) => {
        const newPan = calculateZoomPan(currentPan, currentZoom, newZoom, pivot);

        // Pivot point should be at same screen position after zoom
        const canvasPointBefore = screenToCanvas(pivot, currentPan, currentZoom);
        const screenPointAfter = canvasToScreen(canvasPointBefore, newPan, newZoom);

        expect(screenPointAfter.x).toBeCloseTo(pivot.x, 5);
        expect(screenPointAfter.y).toBeCloseTo(pivot.y, 5);
      });
    });
  });
});
