/**
 * Canvas Component (Redesigned Architecture)
 *
 * Main canvas container with clear separation between:
 * - Transformed Layer (Canvas Space - blocks, wires)
 * - Overlay Layer (Container Space - selection box, UI)
 *
 * This architecture prevents double transformation and coordinates offset issues.
 */

import { useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { GridBackground } from './GridBackground';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useCoordinateSystem } from './coordinate-system/useCoordinateSystem';
import { CoordinateSystemProvider } from './coordinate-system/CoordinateSystemContext';
import { TransformedLayer } from './layers/TransformedLayer';
import { OverlayLayer } from './layers/OverlayLayer';
import { CanvasContent } from './content/CanvasContent';
import { CanvasOverlays } from './overlays/CanvasOverlays';
import type { Block, Wire, Junction, Position, HandleConstraint } from './types';
import type { SelectionBoxState } from './overlays/SelectionBox';
import type { WirePreviewState } from './overlays/WirePreview';

// ============================================================================
// Types
// ============================================================================

interface CanvasProps {
  // Content (Canvas Space)
  blocks: Map<string, Block>;
  wires: Wire[];
  junctions: Map<string, Junction>;

  // Overlays (Screen/Container Space)
  selectionBox: SelectionBoxState | null;
  wirePreview?: WirePreviewState | null;

  // Callbacks
  onBlockClick?: (blockId: string, e: React.MouseEvent) => void;
  onWireClick?: (wireId: string, e: React.MouseEvent) => void;
  onJunctionClick?: (junctionId: string, e: React.MouseEvent) => void;
  onCanvasClick?: (event: React.MouseEvent) => void;
  onCanvasDoubleClick?: (event: React.MouseEvent) => void;

  // Selection state
  selectedBlockIds?: Set<string>;
  selectedWireIds?: Set<string>;

  // Simulation state
  connectedPorts?: Set<string>;
  portVoltages?: Map<string, number>;
  plcOutputStates?: Map<string, boolean>;

  // Interaction callbacks
  onButtonPress?: (blockId: string) => void;
  onButtonRelease?: (blockId: string) => void;
  onStartWire?: (blockId: string, portId: string) => void;
  onEndWire?: (blockId: string, portId: string) => void;
  onBlockDragStart?: (blockId: string, event: React.MouseEvent) => void;

  // Wire interaction callbacks
  onWireContextMenu?: (wireId: string, position: Position, screenPos: { x: number; y: number }) => void;
  onWireHandleDragStart?: (
    wireId: string,
    handleIndex: number,
    constraint: HandleConstraint,
    e: React.MouseEvent,
    handlePosition: Position
  ) => void;
  onWireHandleContextMenu?: (wireId: string, handleIndex: number, e: React.MouseEvent) => void;
  onWireSegmentDragStart?: (
    wireId: string,
    handleIndexA: number,
    handleIndexB: number,
    orientation: 'horizontal' | 'vertical',
    e: React.MouseEvent,
    handlePosA: Position,
    handlePosB: Position,
    skipEndpointCheck?: boolean
  ) => void;
  onWireEndpointSegmentDragStart?: (
    wireId: string,
    end: 'from' | 'to',
    orientation: 'horizontal' | 'vertical',
    e: React.MouseEvent
  ) => void;

  // Settings
  className?: string;
  gridSize?: number;
  showGrid?: boolean;
  debugMode?: boolean;
}

export interface CanvasRef {
  getContainer: () => HTMLDivElement | null;
  getContent: () => HTMLDivElement | null;
  getOverlay: () => HTMLDivElement | null;
}

// ============================================================================
// Component
// ============================================================================

export const Canvas = forwardRef<CanvasRef, CanvasProps>(function Canvas(
  {
    blocks,
    wires,
    junctions,
    selectionBox,
    wirePreview,
    onBlockClick,
    onWireClick,
    onJunctionClick,
    onCanvasClick,
    onCanvasDoubleClick,
    selectedBlockIds,
    selectedWireIds,
    connectedPorts,
    portVoltages,
    plcOutputStates,
    onButtonPress,
    onButtonRelease,
    onStartWire,
    onEndWire,
    onBlockDragStart,
    onWireContextMenu,
    onWireHandleDragStart,
    onWireHandleContextMenu,
    onWireSegmentDragStart,
    onWireEndpointSegmentDragStart,
    className = '',
    gridSize: propGridSize,
    showGrid: propShowGrid,
    debugMode = false,
  },
  ref
) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<CanvasRef | null>(null);

  // Store state
  const zoom = useCanvasStore((state) => state.zoom);
  const pan = useCanvasStore((state) => state.pan);
  const storeGridSize = useCanvasStore((state) => state.gridSize);
  const storeShowGrid = useCanvasStore((state) => state.showGrid);
  const clearSelection = useCanvasStore((state) => state.clearSelection);

  const gridSize = propGridSize ?? storeGridSize;
  const showGrid = propShowGrid ?? storeShowGrid;

  // Coordinate system
  const coordinateSystem = useCoordinateSystem({
    containerRef,
    zoom,
    pan,
  });

  // Canvas interaction (pan/zoom)
  const { cursor } = useCanvasInteraction(containerRef);

  // Combine all selected IDs (blocks + wires) for overlays
  const allSelectedIds = useMemo(() => {
    const combined = new Set<string>();
    selectedBlockIds?.forEach(id => combined.add(id));
    selectedWireIds?.forEach(id => combined.add(id));
    return combined;
  }, [selectedBlockIds, selectedWireIds]);

  // Expose ref methods
  useImperativeHandle(ref, () => {
    const refObject = {
      getContainer: () => containerRef.current,
      getContent: () => contentRef.current,
      getOverlay: () => overlayRef.current,
    };
    canvasRef.current = refObject;
    return refObject;
  });

  // Handle canvas click
  const handleClick = (event: React.MouseEvent) => {
    if (event.target === containerRef.current || event.target === contentRef.current) {
      clearSelection();
      onCanvasClick?.(event);
    }
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    if (event.target === containerRef.current || event.target === contentRef.current) {
      onCanvasDoubleClick?.(event);
    }
  };

  return (
    <CoordinateSystemProvider value={coordinateSystem}>
      <div
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden select-none ${className}`}
        style={{ cursor }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Grid background */}
        <GridBackground gridSize={gridSize} showGrid={showGrid} zoom={zoom} />

        {/* Transformed Layer - Canvas Space */}
        <TransformedLayer zoom={zoom} pan={pan}>
          <div ref={contentRef}>
            <CanvasContent
              blocks={blocks}
              wires={wires}
              junctions={junctions}
              onBlockClick={onBlockClick}
              onWireClick={onWireClick}
              onJunctionClick={onJunctionClick}
              selectedBlockIds={selectedBlockIds}
              selectedWireIds={selectedWireIds}
              connectedPorts={connectedPorts}
              portVoltages={portVoltages}
              onButtonPress={onButtonPress}
              onButtonRelease={onButtonRelease}
              plcOutputStates={plcOutputStates}
              onStartWire={onStartWire}
              onEndWire={onEndWire}
              onBlockDragStart={onBlockDragStart}
              onWireContextMenu={onWireContextMenu}
              onWireHandleDragStart={onWireHandleDragStart}
              onWireHandleContextMenu={onWireHandleContextMenu}
              onWireSegmentDragStart={onWireSegmentDragStart}
              onWireEndpointSegmentDragStart={onWireEndpointSegmentDragStart}
            />
          </div>
        </TransformedLayer>

        {/* Overlay Layer - Screen/Container Space */}
        <OverlayLayer>
          <div ref={overlayRef}>
            <CanvasOverlays
              selectionBox={selectionBox}
              debugMode={debugMode}
              canvasRef={canvasRef}
              selectedIds={allSelectedIds}
              components={blocks}
              wires={wires}
              junctions={junctions}
              wirePreview={wirePreview}
            />
          </div>
        </OverlayLayer>
      </div>
    </CoordinateSystemProvider>
  );
});

export default Canvas;
