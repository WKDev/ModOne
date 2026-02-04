/**
 * Mouse Interaction State Machine
 *
 * Manages mouse interaction states: idle → pressed → dragging/clicking
 * Helps distinguish between clicks and drags consistently.
 */

import { useState, useCallback, useRef } from 'react';
import type { Position } from '../types';

export type MouseState = 'idle' | 'pressed' | 'dragging' | 'clicking';

export interface MouseInteraction {
  state: MouseState;
  startPos: Position | null;
  currentPos: Position | null;
  hasMoved: boolean;
}

interface UseMouseInteractionOptions {
  /** Minimum distance in pixels to consider a drag (default: 3) */
  dragThreshold?: number;
}

/**
 * Hook for tracking mouse interaction state
 */
export function useMouseInteraction(options: UseMouseInteractionOptions = {}) {
  const { dragThreshold = 3 } = options;

  const [state, setState] = useState<MouseState>('idle');
  const startPosRef = useRef<Position | null>(null);
  const currentPosRef = useRef<Position | null>(null);

  const handleMouseDown = useCallback((pos: Position) => {
    startPosRef.current = pos;
    currentPosRef.current = pos;
    setState('pressed');
  }, []);

  const handleMouseMove = useCallback(
    (pos: Position) => {
      currentPosRef.current = pos;

      if (state === 'pressed' && startPosRef.current) {
        const dx = pos.x - startPosRef.current.x;
        const dy = pos.y - startPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance >= dragThreshold) {
          setState('dragging');
        }
      }
    },
    [state, dragThreshold]
  );

  const handleMouseUp = useCallback(() => {
    if (state === 'pressed') {
      setState('clicking');
    }
    // Reset to idle after a short delay to allow click handlers to execute
    setTimeout(() => {
      setState('idle');
      startPosRef.current = null;
      currentPosRef.current = null;
    }, 0);
  }, [state]);

  const reset = useCallback(() => {
    setState('idle');
    startPosRef.current = null;
    currentPosRef.current = null;
  }, []);

  const hasMoved = useCallback((): boolean => {
    if (!startPosRef.current || !currentPosRef.current) return false;
    const dx = currentPosRef.current.x - startPosRef.current.x;
    const dy = currentPosRef.current.y - startPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance >= dragThreshold;
  }, [dragThreshold]);

  return {
    state,
    startPos: startPosRef.current,
    currentPos: currentPosRef.current,
    hasMoved: hasMoved(),
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    reset,
  };
}
