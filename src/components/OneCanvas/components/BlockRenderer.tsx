/**
 * Block Renderer Component
 *
 * Dispatches to the appropriate block component based on block type.
 */

import { memo, useCallback, useEffect } from 'react';
import type { Block } from '../types';
import { PowerBlock } from './blocks/PowerBlock';
import { LedBlock } from './blocks/LedBlock';
import { PlcOutBlock } from './blocks/PlcOutBlock';
import { PlcInBlock } from './blocks/PlcInBlock';
import { ButtonBlock } from './blocks/ButtonBlock';
import { ScopeBlock } from './blocks/ScopeBlock';
import { TextBlock } from './blocks/TextBlock';
import { RelayBlock } from './blocks/RelayBlock';
import { FuseBlock } from './blocks/FuseBlock';
import { MotorBlock } from './blocks/MotorBlock';
import { EmergencyStopBlock } from './blocks/EmergencyStopBlock';
import { SelectorSwitchBlock } from './blocks/SelectorSwitchBlock';
import { SolenoidValveBlock } from './blocks/SolenoidValveBlock';
import { SensorBlock } from './blocks/SensorBlock';
import { PilotLampBlock } from './blocks/PilotLampBlock';
import { NetLabelBlock } from './blocks/NetLabelBlock';
import { TransformerBlock } from './blocks/TransformerBlock';
import { TerminalBlockComp } from './blocks/TerminalBlockComp';
import { OverloadRelayBlock } from './blocks/OverloadRelayBlock';
import { ContactorBlock } from './blocks/ContactorBlock';
import { DisconnectSwitchBlock } from './blocks/DisconnectSwitchBlock';
import { OffPageConnectorBlock } from './blocks/OffPageConnectorBlock';
import { SymbolRenderer } from './SymbolRenderer';
import { useSymbolStore } from '@stores/symbolStore';
import { useProjectStore } from '@stores/projectStore';
import type { CustomSymbolBlock } from '../../../types/symbol';
// JunctionBlock is now rendered as SVG dot in the wire layer (JunctionDot.tsx)

// ============================================================================
// Types
// ============================================================================

interface BlockRendererProps {
  /** Block data */
  block: Block;
  /** Whether the block is selected */
  isSelected?: boolean;
  /** Block click handler */
  onBlockClick?: (blockId: string, e: React.MouseEvent) => void;
  /** Wire start handler */
  onStartWire?: (blockId: string, portId: string) => void;
  /** Wire end handler */
  onEndWire?: (blockId: string, portId: string) => void;
  /** Drag start handler */
  onDragStart?: (blockId: string, event: React.MouseEvent) => void;
  /** Connected port IDs for this block */
  connectedPorts?: Set<string>;
  /** Simulation voltage at ports */
  portVoltages?: Map<string, number>;
  /** Button press handler (for button blocks) */
  onButtonPress?: (blockId: string) => void;
  /** Button release handler (for button blocks) */
  onButtonRelease?: (blockId: string) => void;
  /** PLC output active states (for plc_out blocks) */
  plcOutputStates?: Map<string, boolean>;
  /** Component update handler (for text blocks inline editing) */
  onUpdateComponent?: (id: string, updates: Partial<Block>) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders the appropriate block component based on block type.
 */
export const BlockRenderer = memo(function BlockRenderer({
  block,
  isSelected,
  onBlockClick,
  onStartWire,
  onEndWire,
  onDragStart,
  connectedPorts,
  portVoltages,
  onButtonPress,
  onButtonRelease,
  plcOutputStates,
  onUpdateComponent,
}: BlockRendererProps) {
  const { projectSymbols, globalSymbols, currentSymbol, loadSymbol } = useSymbolStore((state) => ({
    projectSymbols: state.projectSymbols,
    globalSymbols: state.globalSymbols,
    currentSymbol: state.currentSymbol,
    loadSymbol: state.loadSymbol,
  }));
  const currentProjectPath = useProjectStore((state) => state.currentProjectPath);

  useEffect(() => {
    if (block.type !== 'custom_symbol' || !currentProjectPath) {
      return;
    }

    const csBlock = block as CustomSymbolBlock;
    if (!csBlock.symbolId || currentSymbol?.id === csBlock.symbolId) {
      return;
    }

    const scope = projectSymbols.some((symbol) => symbol.id === csBlock.symbolId)
      ? 'project'
      : globalSymbols.some((symbol) => symbol.id === csBlock.symbolId)
        ? 'global'
        : undefined;

    if (scope) {
      void loadSymbol(currentProjectPath, csBlock.symbolId, scope);
    }
  }, [block, currentProjectPath, currentSymbol?.id, globalSymbols, loadSymbol, projectSymbols]);

  // Common props for all block types
  const commonProps = {
    isSelected,
    onBlockClick,
    onStartWire,
    onEndWire,
    connectedPorts,
  };

  // Position wrapper
  const style = {
    position: 'absolute' as const,
    left: block.position.x,
    top: block.position.y,
  };

  // Get voltage at first input port (for LED blocks)
  const getVoltage = () => {
    if (!portVoltages) return undefined;
    const inputPort = block.ports.find((p) => p.type === 'input');
    return inputPort ? portVoltages.get(`${block.id}:${inputPort.id}`) : undefined;
  };

  // Render based on block type
  const renderBlock = () => {
    switch (block.type) {
      case 'powersource':
        return <PowerBlock block={block} {...commonProps} />;

      case 'led':
        return <LedBlock block={block} {...commonProps} voltage={getVoltage()} />;

      case 'plc_out':
        return (
          <PlcOutBlock
            block={block}
            {...commonProps}
            isActiveOverride={plcOutputStates?.get(block.address)}
          />
        );

      case 'plc_in':
        return <PlcInBlock block={block} {...commonProps} voltage={getVoltage()} />;

      case 'button':
        return (
          <ButtonBlock
            block={block}
            {...commonProps}
            onPress={onButtonPress}
            onRelease={onButtonRelease}
          />
        );

      case 'scope':
        return (
          <ScopeBlock
            block={block}
            {...commonProps}
            channelVoltages={
              block.ports
                .slice(0, block.channels)
                .map((p) => portVoltages?.get(`${block.id}:${p.id}`) ?? 0)
            }
          />
        );

      case 'text':
        return (
          <TextBlock
            block={block}
            {...commonProps}
            onUpdateComponent={onUpdateComponent}
          />
        );

      case 'relay':
        return <RelayBlock block={block} {...commonProps} />;
      case 'fuse':
        return <FuseBlock block={block} {...commonProps} />;
      case 'motor':
        return <MotorBlock block={block} {...commonProps} />;
      case 'emergency_stop':
        return <EmergencyStopBlock block={block} {...commonProps} />;
      case 'selector_switch':
        return <SelectorSwitchBlock block={block} {...commonProps} />;
      case 'solenoid_valve':
        return <SolenoidValveBlock block={block} {...commonProps} />;
      case 'sensor':
        return <SensorBlock block={block} {...commonProps} />;
      case 'pilot_lamp':
        return <PilotLampBlock block={block} {...commonProps} />;
      case 'net_label':
        return <NetLabelBlock block={block} {...commonProps} />;
      case 'transformer':
        return <TransformerBlock block={block} {...commonProps} />;
      case 'terminal_block':
        return <TerminalBlockComp block={block} {...commonProps} />;
      case 'overload_relay':
        return <OverloadRelayBlock block={block} {...commonProps} />;
      case 'contactor':
        return <ContactorBlock block={block} {...commonProps} />;
      case 'disconnect_switch':
        return <DisconnectSwitchBlock block={block} {...commonProps} />;
      case 'off_page_connector':
        return <OffPageConnectorBlock block={block} {...commonProps} />;

      case 'custom_symbol': {
        const csBlock = block as CustomSymbolBlock;
        const symbolDef = currentSymbol?.id === csBlock.symbolId ? currentSymbol : null;
        if (symbolDef) {
          return <SymbolRenderer symbol={symbolDef} scale={1} />;
        }

        return (
          <g>
            <rect
              x={0}
              y={0}
              width={block.size?.width ?? 60}
              height={block.size?.height ?? 60}
              fill="none"
              stroke="#888"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
            <text x={4} y={14} fontSize={10} fill="#666">
              {csBlock.symbolId || 'custom'}
            </text>
          </g>
        );
      }
      default:
        // Unknown block type - render a placeholder
        return (
          <div
            className="w-16 h-16 bg-red-900 border-2 border-red-500 rounded flex items-center justify-center text-white text-xs"
          >
            Unknown
          </div>
        );
    }
  };

  // Handle mouse down for drag start
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      onDragStart?.(block.id, event);
    },
    [block.id, onDragStart]
  );

  return (
    <div style={style} data-block-id={block.id} onMouseDown={handleMouseDown}>
      {renderBlock()}
    </div>
  );
});

export default BlockRenderer;
