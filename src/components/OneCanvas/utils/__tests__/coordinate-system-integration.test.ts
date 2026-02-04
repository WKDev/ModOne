/**
 * Integration tests for coordinate system
 * Tests the complete flow: CSS transform → screen position → canvas position
 */

import { describe, it, expect } from 'vitest';
import { screenToCanvas, canvasToScreen } from '../canvasCoordinates';

describe('Coordinate System Integration', () => {
  describe('CSS Transform Simulation', () => {
    // Simulate how CSS transform works with origin-top-left
    const simulateCSSTransform = (
      canvasPos: { x: number; y: number },
      pan: { x: number; y: number },
      zoom: number
    ) => {
      // CSS: transform: translate(pan.x, pan.y) scale(zoom)
      // With origin-top-left, this applies in order: scale first, then translate
      // So: screenPos = canvasPos * zoom + pan
      return {
        x: canvasPos.x * zoom + pan.x,
        y: canvasPos.y * zoom + pan.y,
      };
    };

    it('should match CSS transform behavior', () => {
      const testCases = [
        {
          name: 'No transform',
          canvasPos: { x: 100, y: 50 },
          pan: { x: 0, y: 0 },
          zoom: 1,
        },
        {
          name: 'With pan only',
          canvasPos: { x: 100, y: 50 },
          pan: { x: 20, y: 30 },
          zoom: 1,
        },
        {
          name: 'With zoom only',
          canvasPos: { x: 100, y: 50 },
          pan: { x: 0, y: 0 },
          zoom: 2,
        },
        {
          name: 'With pan and zoom',
          canvasPos: { x: 100, y: 50 },
          pan: { x: 20, y: 30 },
          zoom: 1.5,
        },
        {
          name: 'Zoomed out with pan',
          canvasPos: { x: 200, y: 150 },
          pan: { x: -50, y: -30 },
          zoom: 0.5,
        },
      ];

      testCases.forEach(({ name, canvasPos, pan, zoom }) => {
        // Simulate where CSS would render the point
        const cssScreenPos = simulateCSSTransform(canvasPos, pan, zoom);

        // Our function should produce the same result
        const ourScreenPos = canvasToScreen(canvasPos, pan, zoom);

        expect(ourScreenPos.x, `${name} - X`).toBeCloseTo(cssScreenPos.x, 10);
        expect(ourScreenPos.y, `${name} - Y`).toBeCloseTo(cssScreenPos.y, 10);
      });
    });

    it('should correctly reverse CSS transform (screen to canvas)', () => {
      const testCases = [
        {
          name: 'No transform',
          screenPos: { x: 100, y: 50 },
          pan: { x: 0, y: 0 },
          zoom: 1,
          expectedCanvas: { x: 100, y: 50 },
        },
        {
          name: 'With pan',
          screenPos: { x: 120, y: 80 },
          pan: { x: 20, y: 30 },
          zoom: 1,
          expectedCanvas: { x: 100, y: 50 },
        },
        {
          name: 'With zoom',
          screenPos: { x: 200, y: 100 },
          pan: { x: 0, y: 0 },
          zoom: 2,
          expectedCanvas: { x: 100, y: 50 },
        },
        {
          name: 'With pan and zoom',
          screenPos: { x: 170, y: 105 },
          pan: { x: 20, y: 30 },
          zoom: 1.5,
          expectedCanvas: { x: 100, y: 50 },
        },
      ];

      testCases.forEach(({ name, screenPos, pan, zoom, expectedCanvas }) => {
        const canvasPos = screenToCanvas(screenPos, pan, zoom);

        expect(canvasPos.x, `${name} - X`).toBeCloseTo(expectedCanvas.x, 10);
        expect(canvasPos.y, `${name} - Y`).toBeCloseTo(expectedCanvas.y, 10);
      });
    });

    it('should handle mouse click scenario correctly', () => {
      // Scenario: User clicks on screen at (300, 200)
      // Container is at (0, 0) so relative position is (300, 200)
      // Canvas has pan=(50, 30) and zoom=2
      // What canvas coordinate did they click on?

      const screenPosRelativeToContainer = { x: 300, y: 200 };
      const pan = { x: 50, y: 30 };
      const zoom = 2;

      const canvasPos = screenToCanvas(screenPosRelativeToContainer, pan, zoom);

      // Expected: (300 - 50) / 2 = 125, (200 - 30) / 2 = 85
      expect(canvasPos.x).toBeCloseTo(125, 10);
      expect(canvasPos.y).toBeCloseTo(85, 10);

      // Verify reverse: if we place something at canvas (125, 85),
      // it should appear at screen (300, 200)
      const backToScreen = canvasToScreen(canvasPos, pan, zoom);
      expect(backToScreen.x).toBeCloseTo(300, 10);
      expect(backToScreen.y).toBeCloseTo(200, 10);
    });

    it('should handle drag scenario correctly', () => {
      // Scenario: Drag a block from canvas position (100, 100)
      // Initial state: pan=(0, 0), zoom=1
      // User drags mouse from screen (100, 100) to screen (150, 120)

      const originalCanvasPos = { x: 100, y: 100 };
      const pan = { x: 0, y: 0 };
      const zoom = 1;

      // Start drag at screen position corresponding to canvas position
      const startScreen = canvasToScreen(originalCanvasPos, pan, zoom);
      expect(startScreen.x).toBe(100);
      expect(startScreen.y).toBe(100);

      // Convert back to canvas to verify
      const startCanvas = screenToCanvas(startScreen, pan, zoom);
      expect(startCanvas.x).toBe(100);
      expect(startCanvas.y).toBe(100);

      // Mouse moves to (150, 120)
      const endScreen = { x: 150, y: 120 };
      const endCanvas = screenToCanvas(endScreen, pan, zoom);

      // Delta in canvas space should be (50, 20)
      const deltaX = endCanvas.x - startCanvas.x;
      const deltaY = endCanvas.y - startCanvas.y;
      expect(deltaX).toBe(50);
      expect(deltaY).toBe(20);

      // New position should be (150, 120)
      const newCanvasPos = {
        x: originalCanvasPos.x + deltaX,
        y: originalCanvasPos.y + deltaY,
      };
      expect(newCanvasPos.x).toBe(150);
      expect(newCanvasPos.y).toBe(120);
    });

    it('should handle drag scenario with zoom correctly', () => {
      // Same scenario but with zoom=2
      const originalCanvasPos = { x: 100, y: 100 };
      const pan = { x: 0, y: 0 };
      const zoom = 2;

      // Block at canvas (100, 100) appears at screen (200, 200)
      const startScreen = canvasToScreen(originalCanvasPos, pan, zoom);
      expect(startScreen.x).toBe(200);
      expect(startScreen.y).toBe(200);

      // Mouse moves to screen (250, 240)
      const endScreen = { x: 250, y: 240 };
      const endCanvas = screenToCanvas(endScreen, pan, zoom);

      // Delta in canvas space should be (25, 20) because of zoom
      const deltaX = endCanvas.x - originalCanvasPos.x;
      const deltaY = endCanvas.y - originalCanvasPos.y;
      expect(deltaX).toBe(25);  // (250 - 200) / 2
      expect(deltaY).toBe(20);  // (240 - 200) / 2

      // New canvas position
      const newCanvasPos = {
        x: originalCanvasPos.x + deltaX,
        y: originalCanvasPos.y + deltaY,
      };
      expect(newCanvasPos.x).toBe(125);
      expect(newCanvasPos.y).toBe(120);

      // Verify it appears at the right screen position
      const newScreen = canvasToScreen(newCanvasPos, pan, zoom);
      expect(newScreen.x).toBe(250);
      expect(newScreen.y).toBe(240);
    });

    it('should handle drag scenario with pan and zoom correctly', () => {
      // Complex scenario with both pan and zoom
      const originalCanvasPos = { x: 100, y: 100 };
      const pan = { x: 50, y: 30 };
      const zoom = 1.5;

      // Block at canvas (100, 100) with pan and zoom
      const startScreen = canvasToScreen(originalCanvasPos, pan, zoom);
      expect(startScreen.x).toBe(200);  // 100 * 1.5 + 50
      expect(startScreen.y).toBe(180);  // 100 * 1.5 + 30

      // Start drag - convert screen back to canvas
      const startCanvas = screenToCanvas(startScreen, pan, zoom);
      expect(startCanvas.x).toBeCloseTo(100, 10);
      expect(startCanvas.y).toBeCloseTo(100, 10);

      // Mouse moves to screen (230, 210)
      const endScreen = { x: 230, y: 210 };
      const endCanvas = screenToCanvas(endScreen, pan, zoom);

      // Calculate delta
      const deltaX = endCanvas.x - startCanvas.x;
      const deltaY = endCanvas.y - startCanvas.y;

      // Expected: (230 - 50) / 1.5 - 100 = 120 - 100 = 20
      //           (210 - 30) / 1.5 - 100 = 120 - 100 = 20
      expect(deltaX).toBeCloseTo(20, 10);
      expect(deltaY).toBeCloseTo(20, 10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero zoom gracefully', () => {
      // This shouldn't happen in practice, but shouldn't crash
      const screenPos = { x: 100, y: 100 };
      const pan = { x: 0, y: 0 };
      const zoom = 0.0001; // Very small instead of zero to avoid division by zero

      const canvasPos = screenToCanvas(screenPos, pan, zoom);
      expect(canvasPos.x).toBe(1000000); // Very large number
      expect(canvasPos.y).toBe(1000000);
    });

    it('should handle negative coordinates', () => {
      const canvasPos = { x: -50, y: -30 };
      const pan = { x: 20, y: 10 };
      const zoom = 2;

      const screenPos = canvasToScreen(canvasPos, pan, zoom);
      expect(screenPos.x).toBe(-80);  // -50 * 2 + 20
      expect(screenPos.y).toBe(-50);  // -30 * 2 + 10

      const backToCanvas = screenToCanvas(screenPos, pan, zoom);
      expect(backToCanvas.x).toBe(-50);
      expect(backToCanvas.y).toBe(-30);
    });

    it('should handle very large zoom values', () => {
      const canvasPos = { x: 10, y: 10 };
      const pan = { x: 0, y: 0 };
      const zoom = 10;

      const screenPos = canvasToScreen(canvasPos, pan, zoom);
      expect(screenPos.x).toBe(100);
      expect(screenPos.y).toBe(100);

      const backToCanvas = screenToCanvas(screenPos, pan, zoom);
      expect(backToCanvas.x).toBe(10);
      expect(backToCanvas.y).toBe(10);
    });
  });
});
