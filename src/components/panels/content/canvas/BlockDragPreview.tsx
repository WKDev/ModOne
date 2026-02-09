import { memo } from 'react';
import type { BlockType } from '../../../OneCanvas';

interface BlockDragPreviewProps {
  type: BlockType;
  presetLabel?: string;
}

export const BlockDragPreview = memo(function BlockDragPreview({ type, presetLabel }: BlockDragPreviewProps) {
  const labels: Record<BlockType, string> = {
    powersource: '+24V',
    plc_out: 'PLC Out',
    plc_in: 'PLC In',
    led: 'LED',
    button: 'Button',
    scope: 'Scope',
    text: 'Text',
    relay: 'Relay',
    fuse: 'Fuse',
    motor: 'Motor',
    emergency_stop: 'E-Stop',
    selector_switch: 'Selector',
    solenoid_valve: 'Solenoid',
    sensor: 'Sensor',
    pilot_lamp: 'Pilot Lamp',
    net_label: 'Net Label',
    transformer: 'Transformer',
    terminal_block: 'Terminal',
    overload_relay: 'Overload',
    contactor: 'Contactor',
    disconnect_switch: 'Disconnect',
    off_page_connector: 'Off-Page',
  };

  return (
    <div className="px-3 py-2 bg-neutral-700 border border-neutral-500 rounded shadow-lg text-white text-sm font-medium">
      {presetLabel || labels[type] || type}
    </div>
  );
});
