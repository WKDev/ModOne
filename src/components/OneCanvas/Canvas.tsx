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
import { GridBackground } from './GridBackground';
import { useCoordinateSystem } from './coordinate-system/useCoordinateSystem';
import { CoordinateSystemProvider } from './coordinate-system/CoordinateSystemContext';
import { TransformedLayer } from './layers/TransformedLayer';
import { OverlayLayer } from './layers/OverlayLayer';
import { CanvasContent } from './content/CanvasContent';
import { CanvasOverlays } from './overlays/CanvasOverlays';
import { useInteraction } from './contexts/InteractionContext';
import type { Block, Wire, Junction, Position } from './types';
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

  // Viewport (from facade — do NOT read from global store)
  zoom: number;
  pan: Position;

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
   onWireHandleContextMenu?: (wireId: string, handleIndex: number, e: React.MouseEvent) => void;
   onWireEndpointSegmentDragStart?: (
     wireId: string,
     end: 'from' | 'to',
     orientation: 'horizontal' | 'vertical',
     e: React.MouseEvent
   ) => void;

  // Component update
  onUpdateComponent?: (id: string, updates: Partial<Block>) => void;

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
    zoom,
    pan,
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
    onWireHandleContextMenu,
    onWireEndpointSegmentDragStart,
    onUpdateComponent,
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
  const { cursor, send } = useInteraction();

  const gridSize = propGridSize ?? 20;
  const showGrid = propShowGrid ?? true;

  // Coordinate system
  const coordinateSystem = useCoordinateSystem({
    containerRef,
    zoom,
    pan,
  });

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
      // Selection clearing is now handled by useSelectionHandler in OneCanvasPanel
      onCanvasClick?.(event);
    }
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    if (event.target === containerRef.current || event.target === contentRef.current) {
      onCanvasDoubleClick?.(event);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    const position = rect
      ? {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
      : {
          x: event.clientX,
          y: event.clientY,
        };

    send({
      type: 'WHEEL',
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      ctrlKey: event.ctrlKey || event.metaKey,
      position,
    });
  };

  return (
    <CoordinateSystemProvider value={coordinateSystem}>
      <div
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden select-none ${className}`}
        style={{ cursor }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
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
               onWireHandleContextMenu={onWireHandleContextMenu}
               onWireEndpointSegmentDragStart={onWireEndpointSegmentDragStart}
              onUpdateComponent={onUpdateComponent}
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
