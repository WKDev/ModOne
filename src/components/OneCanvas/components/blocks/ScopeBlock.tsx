/**
 * Scope Block Component
 *
 * Oscilloscope for monitoring voltage signals with real-time waveform display.
 */

import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import { ScopeExpandedView } from './ScopeExpandedView';
import { drawWaveform, drawEmptyScope } from './waveformRenderer';
import { useSimulation } from '../../../../hooks/useSimulation';
import type { ScopeBlock as ScopeBlockType } from '../../types';
import type { ScopeDisplayData } from '../../../../types/onesim';

// ============================================================================
// Types
// ============================================================================

interface ScopeBlockProps {
  /** Block data */
  block: ScopeBlockType;
  /** Whether the block is selected */
  isSelected?: boolean;
  /** Selection handler */
  onSelect?: (blockId: string, addToSelection: boolean) => void;
  /** Wire start handler */
  onStartWire?: (blockId: string, portId: string) => void;
  /** Wire end handler */
  onEndWire?: (blockId: string, portId: string) => void;
  /** Connected port IDs */
  connectedPorts?: Set<string>;
  /** Channel voltages for display */
  channelVoltages?: number[];
}

// ============================================================================
// Constants
// ============================================================================

const BLOCK_WIDTH = 100;
const BLOCK_HEIGHT = 80;

// Canvas dimensions for inline display
const CANVAS_WIDTH = 88;
const CANVAS_HEIGHT = 52;

// Polling interval for scope data (50ms = 20 FPS)
const SCOPE_POLL_INTERVAL = 50;

// ============================================================================
// Custom Hook: useScopeData
// ============================================================================

/**
 * Hook for polling scope display data from the Rust backend.
 */
function useScopeData(scopeId: string, isSimulating: boolean): ScopeDisplayData | null {
  const [displayData, setDisplayData] = useState<ScopeDisplayData | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!isSimulating) {
      setDisplayData(null);
      return;
    }

    const interval = setInterval(async () => {
      if (!mountedRef.current) return;

      try {
        const data = await invoke<ScopeDisplayData>('scope_get_data', { scopeId });
        if (mountedRef.current) {
          setDisplayData(data);
        }
      } catch (e) {
        // Scope might not exist yet, ignore errors
        console.debug('Failed to get scope data:', e);
      }
    }, SCOPE_POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [scopeId, isSimulating]);

  return displayData;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Oscilloscope block for monitoring voltage signals.
 */
export const ScopeBlock = memo(function ScopeBlock({
  block,
  isSelected,
  onSelect,
  onStartWire,
  onEndWire,
  connectedPorts,
}: ScopeBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isRunning } = useSimulation();
  const displayData = useScopeData(block.id, isRunning);
  const [isExpanded, setIsExpanded] = useState(false);

  // Create scope on mount
  useEffect(() => {
    const createScope = async () => {
      try {
        await invoke('scope_create', {
          scopeId: block.id,
          channels: block.channels,
          bufferSize: 1000,
          sampleRate: 1000,
        });
      } catch (e) {
        // Scope might already exist
        console.debug('Failed to create scope:', e);
      }
    };

    createScope();

    // Cleanup: delete scope on unmount
    return () => {
      invoke('scope_delete', { scopeId: block.id }).catch(() => {
        // Ignore cleanup errors
      });
    };
  }, [block.id, block.channels]);

  // Draw waveform when data updates
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (displayData) {
      drawWaveform(ctx, displayData, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      drawEmptyScope(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }, [displayData]);

  // Double-click to expand
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
  }, []);

  return (
    <>
      <BlockWrapper
        blockId={block.id}
        isSelected={isSelected}
        onSelect={onSelect}
        width={BLOCK_WIDTH}
        height={BLOCK_HEIGHT}
      >
        {/* Block body */}
        <div
          className="
            w-full h-full rounded border-2 border-neutral-600
            bg-neutral-900
            flex flex-col
            text-white text-xs select-none
            overflow-hidden
          "
        >
          {/* Screen area with Canvas */}
          <div
            className="flex-1 bg-black m-1 rounded relative cursor-pointer"
            onDoubleClick={handleDoubleClick}
            title="Double-click to expand"
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full h-full"
            />
          </div>

          {/* Status bar */}
          <div className="flex justify-between items-center px-1 py-0.5 bg-neutral-800 text-[8px] text-neutral-400">
            <span>{block.timeBase}ms/div</span>
            <span>{block.triggerMode.toUpperCase()}</span>
            <span>{block.channels}CH</span>
          </div>
        </div>

        {/* Ports (channel inputs on left) */}
        {block.ports.slice(0, block.channels).map((port) => (
          <Port
            key={port.id}
            port={port}
            blockId={block.id}
            blockSize={{ width: BLOCK_WIDTH, height: BLOCK_HEIGHT }}
            isConnected={connectedPorts?.has(port.id)}
            onStartWire={onStartWire}
            onEndWire={onEndWire}
          />
        ))}
      </BlockWrapper>

      {/* Expanded view modal */}
      {isExpanded && (
        <ScopeExpandedView
          block={block}
          displayData={displayData}
          isRunning={isRunning}
          onClose={() => setIsExpanded(false)}
        />
      )}
    </>
  );
});

export default ScopeBlock;
