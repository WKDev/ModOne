import type { Block, Wire, Junction, Position, HandleConstraint } from '../types';
import { BlockRenderer } from './BlockRenderer';
import { Wire as WireComponent } from './WireRenderer';

interface CanvasContentProps {
  blocks: Map<string, Block>;
  wires: Wire[];
  junctions: Map<string, Junction>;
  onBlockClick?: (blockId: string, e: React.MouseEvent) => void;
  onWireClick?: (wireId: string, e: React.MouseEvent) => void;
  onJunctionClick?: (junctionId: string, e: React.MouseEvent) => void;
  selectedBlockIds?: Set<string>;
  selectedWireIds?: Set<string>;
  connectedPorts?: Set<string>;
  portVoltages?: Map<string, number>;
  onButtonPress?: (blockId: string) => void;
  onButtonRelease?: (blockId: string) => void;
  plcOutputStates?: Map<string, boolean>;
  onStartWire?: (blockId: string, portId: string) => void;
  onEndWire?: (blockId: string, portId: string) => void;
  onBlockDragStart?: (blockId: string, event: React.MouseEvent) => void;

  // Wire interaction handlers
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
}

/**
 * Canvas Content
 *
 * Canvas Space 컴포넌트들을 렌더링합니다.
 * TransformedLayer 내부에서 사용됩니다.
 */
export function CanvasContent({
  blocks,
  wires,
  junctions,
  onBlockClick,
  onWireClick,
  onJunctionClick,
  selectedBlockIds,
  selectedWireIds,
  connectedPorts,
  portVoltages,
  onButtonPress,
  onButtonRelease,
  plcOutputStates,
  onStartWire,
  onEndWire,
  onBlockDragStart,
  onWireContextMenu,
  onWireHandleDragStart,
  onWireHandleContextMenu,
  onWireSegmentDragStart,
  onWireEndpointSegmentDragStart,
}: CanvasContentProps) {
  // Calculate port positions for wire rendering
  const getPortPosition = (blockId: string, portId: string) => {
    const block = blocks.get(blockId);
    if (!block) return null;

    const port = block.ports.find((p) => p.id === portId);
    if (!port) return null;

    // Calculate port position relative to block
    const offset = port.offset ?? 0.5;
    let x = block.position.x;
    let y = block.position.y;

    switch (port.position) {
      case 'top':
        x += block.size.width * offset;
        break;
      case 'bottom':
        x += block.size.width * offset;
        y += block.size.height;
        break;
      case 'left':
        y += block.size.height * offset;
        break;
      case 'right':
        x += block.size.width;
        y += block.size.height * offset;
        break;
    }

    return { x, y };
  };

  return (
    <>
      {/* SVG layer for wires (rendered behind blocks) */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        {wires.map((wire) => {
          // Get wire endpoints
          const fromPos =
            'componentId' in wire.from
              ? getPortPosition(wire.from.componentId, wire.from.portId)
              : junctions.get(wire.from.junctionId)?.position;
          const toPos =
            'componentId' in wire.to
              ? getPortPosition(wire.to.componentId, wire.to.portId)
              : junctions.get(wire.to.junctionId)?.position;

          if (!fromPos || !toPos) return null;

          return (
            <WireComponent
              key={wire.id}
              id={wire.id}
              from={fromPos}
              to={toPos}
              isSelected={selectedWireIds?.has(wire.id)}
              onClick={onWireClick}
              handles={wire.handles}
              fromExitDirection={wire.fromExitDirection}
              toExitDirection={wire.toExitDirection}
              onContextMenu={onWireContextMenu}
              onHandleDragStart={onWireHandleDragStart}
              onHandleContextMenu={onWireHandleContextMenu}
              onSegmentDragStart={onWireSegmentDragStart}
              onEndpointSegmentDragStart={onWireEndpointSegmentDragStart}
            />
          );
        })}
      </svg>

      {/* Blocks (rendered in front of wires) */}
      {Array.from(blocks.values()).map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          isSelected={selectedBlockIds?.has(block.id)}
          onBlockClick={onBlockClick}
          onStartWire={onStartWire}
          onEndWire={onEndWire}
          onDragStart={onBlockDragStart}
          connectedPorts={connectedPorts}
          portVoltages={portVoltages}
          onButtonPress={onButtonPress}
          onButtonRelease={onButtonRelease}
          plcOutputStates={plcOutputStates}
        />
      ))}

      {/* Junctions (rendered as small dots) */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        {Array.from(junctions.values()).map((junction) => (
          <circle
            key={junction.id}
            cx={junction.position.x}
            cy={junction.position.y}
            r={4}
            fill={junction.selected ? '#facc15' : '#6b7280'}
            className="pointer-events-auto cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onJunctionClick?.(junction.id, e.nativeEvent as unknown as React.MouseEvent);
            }}
          />
        ))}
      </svg>
    </>
  );
}
