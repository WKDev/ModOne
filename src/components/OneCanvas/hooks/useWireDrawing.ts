/**
 * Wire Drawing Hook
 *
 * Manages the wire drawing interaction state.
 * Delegates to the canvas store for wire drawing state (single source of truth)
 * while keeping UI-specific logic (valid targets computation) in the hook.
 */

import { useState, useCallback, useMemo } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { isValidConnection, getValidTargets } from '../utils/connectionValidator';
import { getPortAbsolutePosition } from '../utils/wirePathCalculator';
import type { Position, WireEndpoint, PortEndpoint } from '../types';
import { isPortEndpoint } from '../types';

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
  // Valid targets are UI-only state computed when wire drawing starts
  const [validTargets, setValidTargets] = useState<Set<string>>(new Set());

  // Store access - use store as single source of truth for wire drawing state
  const components = useCanvasStore((state) => state.components);
  const wires = useCanvasStore((state) => state.wires);
  const storeWireDrawing = useCanvasStore((state) => state.wireDrawing);
  const startWireDrawing = useCanvasStore((state) => state.startWireDrawing);
  const updateWireDrawingStore = useCanvasStore((state) => state.updateWireDrawing);
  const completeWireDrawing = useCanvasStore((state) => state.completeWireDrawing);
  const cancelWireDrawing = useCanvasStore((state) => state.cancelWireDrawing);

  // Derive drawing state from store + local valid targets
  const drawing = useMemo((): WireDrawingState | null => {
    if (!storeWireDrawing) return null;

    if (!isPortEndpoint(storeWireDrawing.from)) return null;
    const block = components.get(storeWireDrawing.from.componentId);
    if (!block) return null;

    const fromPosition = getPortAbsolutePosition(block, storeWireDrawing.from.portId);
    if (!fromPosition) return null;

    return {
      from: storeWireDrawing.from,
      fromPosition,
      tempPosition: storeWireDrawing.tempPosition,
      validTargets,
    };
  }, [storeWireDrawing, components, validTargets]);

  const isDrawing = drawing !== null;

  // Start drawing a wire from a port
  const startWire = useCallback(
    (blockId: string, portId: string) => {
      const block = components.get(blockId);
      if (!block) return;

      const fromPosition = getPortAbsolutePosition(block, portId);
      if (!fromPosition) return;

      // Compute valid targets (UI logic)
      const from: PortEndpoint = { componentId: blockId, portId };
      const targets = getValidTargets(from, components, wires);
      setValidTargets(new Set(targets.filter(isPortEndpoint).map((t) => `${t.componentId}:${t.portId}`)));

      // Delegate to store
      startWireDrawing(from, { startPosition: fromPosition });
    },
    [components, wires, startWireDrawing]
  );

  // Update wire preview position
  const updateWirePreview = useCallback(
    (mousePosition: Position) => {
      updateWireDrawingStore(mousePosition);
    },
    [updateWireDrawingStore]
  );

  // Complete the wire at a target port
  const endWire = useCallback(
    (blockId: string, portId: string): boolean => {
      if (!storeWireDrawing) return false;

      const to: WireEndpoint = { componentId: blockId, portId };
      const validation = isValidConnection(storeWireDrawing.from, to, components, wires);

      if (validation.valid) {
        completeWireDrawing(to);
        setValidTargets(new Set());
        return true;
      }

      console.warn('Invalid wire connection:', validation.reason);
      return false;
    },
    [storeWireDrawing, components, wires, completeWireDrawing]
  );

  // Cancel wire drawing
  const cancelWire = useCallback(() => {
    cancelWireDrawing();
    setValidTargets(new Set());
  }, [cancelWireDrawing]);

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
