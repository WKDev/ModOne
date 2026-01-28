/**
 * Wire Drawing Hook
 *
 * Manages the wire drawing interaction state.
 */

import { useState, useCallback } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { isValidConnection, getValidTargets } from '../utils/connectionValidator';
import { getPortAbsolutePosition } from '../utils/wirePathCalculator';
import type { Position, WireEndpoint } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface WireDrawingState {
  /** Source endpoint */
  from: WireEndpoint;
  /** Source port absolute position */
  fromPosition: Position;
  /** Current mouse/preview position */
  tempPosition: Position;
  /** Valid target endpoints */
  validTargets: Set<string>; // "componentId:portId" format
}

interface UseWireDrawingReturn {
  /** Current drawing state (null if not drawing) */
  drawing: WireDrawingState | null;
  /** Whether currently drawing a wire */
  isDrawing: boolean;
  /** Start drawing a wire from a port */
  startWire: (blockId: string, portId: string) => void;
  /** Update the wire preview position */
  updateWirePreview: (mousePosition: Position) => void;
  /** Complete the wire at a target port */
  endWire: (blockId: string, portId: string) => boolean;
  /** Cancel wire drawing */
  cancelWire: () => void;
  /** Check if a port is a valid target */
  isValidTarget: (blockId: string, portId: string) => boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useWireDrawing(): UseWireDrawingReturn {
  const [drawing, setDrawing] = useState<WireDrawingState | null>(null);

  // Store access
  const components = useCanvasStore((state) => state.components);
  const wires = useCanvasStore((state) => state.wires);
  const addWire = useCanvasStore((state) => state.addWire);

  // Check if currently drawing
  const isDrawing = drawing !== null;

  // Start drawing a wire from a port
  const startWire = useCallback(
    (blockId: string, portId: string) => {
      const block = components.get(blockId);
      if (!block) return;

      // Get port absolute position
      const fromPosition = getPortAbsolutePosition(block, portId);
      if (!fromPosition) return;

      // Get valid targets
      const from: WireEndpoint = { componentId: blockId, portId };
      const targets = getValidTargets(from, components, wires);
      const validTargets = new Set(
        targets.map((t) => `${t.componentId}:${t.portId}`)
      );

      setDrawing({
        from,
        fromPosition,
        tempPosition: fromPosition,
        validTargets,
      });
    },
    [components, wires]
  );

  // Update wire preview position
  const updateWirePreview = useCallback((mousePosition: Position) => {
    setDrawing((prev) => {
      if (!prev) return null;
      return { ...prev, tempPosition: mousePosition };
    });
  }, []);

  // Complete the wire at a target port
  const endWire = useCallback(
    (blockId: string, portId: string): boolean => {
      if (!drawing) return false;

      const to: WireEndpoint = { componentId: blockId, portId };
      const validation = isValidConnection(drawing.from, to, components, wires);

      if (validation.valid) {
        addWire(drawing.from, to);
        setDrawing(null);
        return true;
      }

      // Invalid connection - keep drawing or cancel
      console.warn('Invalid wire connection:', validation.reason);
      return false;
    },
    [drawing, components, wires, addWire]
  );

  // Cancel wire drawing
  const cancelWire = useCallback(() => {
    setDrawing(null);
  }, []);

  // Check if a port is a valid target
  const isValidTarget = useCallback(
    (blockId: string, portId: string): boolean => {
      if (!drawing) return false;
      return drawing.validTargets.has(`${blockId}:${portId}`);
    },
    [drawing]
  );

  return {
    drawing,
    isDrawing,
    startWire,
    updateWirePreview,
    endWire,
    cancelWire,
    isValidTarget,
  };
}

export default useWireDrawing;
