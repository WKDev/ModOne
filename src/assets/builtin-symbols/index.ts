import type { SymbolDefinition } from '@/types/symbol';
import { buttonSymbol } from './button';
import { contactorSymbol } from './contactor';
import { disconnectSwitchSymbol } from './disconnect_switch';
import { emergencyStopSymbol } from './emergency_stop';
import { fuseSymbol } from './fuse';
import { ledSymbol } from './led';
import { motorSymbol } from './motor';
import { netLabelSymbol } from './net_label';
import { offPageConnectorSymbol } from './off_page_connector';
import { overloadRelaySymbol } from './overload_relay';
import { pilotLampSymbol } from './pilot_lamp';
import { plcInSymbol } from './plc_in';
import { plcOutSymbol } from './plc_out';
import { powersourceSymbol } from './powersource';
import { relaySymbol } from './relay';
import { scopeSymbol } from './scope';
import { selectorSwitchSymbol } from './selector_switch';
import { sensorSymbol } from './sensor';
import { solenoidValveSymbol } from './solenoid_valve';
import { terminalBlockSymbol } from './terminal_block';
import { textSymbol } from './text';
import { transformerSymbol } from './transformer';

export const BUILTIN_SYMBOLS: ReadonlyMap<string, SymbolDefinition> = new Map([
  ['builtin:fuse', fuseSymbol],
  ['builtin:terminal_block', terminalBlockSymbol],
  ['builtin:emergency_stop', emergencyStopSymbol],
  ['builtin:pilot_lamp', pilotLampSymbol],
  ['builtin:led', ledSymbol],
  ['builtin:button', buttonSymbol],
  ['builtin:text', textSymbol],
  ['builtin:net_label', netLabelSymbol],
  ['builtin:relay', relaySymbol],
  ['builtin:contactor', contactorSymbol],
  ['builtin:motor', motorSymbol],
  ['builtin:overload_relay', overloadRelaySymbol],
  ['builtin:sensor', sensorSymbol],
  ['builtin:selector_switch', selectorSwitchSymbol],
  ['builtin:solenoid_valve', solenoidValveSymbol],
  ['builtin:disconnect_switch', disconnectSwitchSymbol],
  ['builtin:powersource', powersourceSymbol],
  ['builtin:transformer', transformerSymbol],
  ['builtin:plc_in', plcInSymbol],
  ['builtin:plc_out', plcOutSymbol],
  ['builtin:scope', scopeSymbol],
  ['builtin:off_page_connector', offPageConnectorSymbol],
]);

export function getBuiltinSymbol(id: string): SymbolDefinition | undefined {
  return BUILTIN_SYMBOLS.get(id);
}

export function getBuiltinSymbolForBlockType(blockType: string): SymbolDefinition | undefined {
  return BUILTIN_SYMBOLS.get(`builtin:${blockType}`);
}
