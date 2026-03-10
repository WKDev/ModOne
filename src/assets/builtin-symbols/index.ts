import type { SymbolDefinition } from '@/types/symbol';
import { buttonSymbol } from './button';
import { capacitorSymbol } from './capacitor';
import { circuitBreakerSymbol } from './circuit_breaker';
import { contactorSymbol } from './contactor';
import { connectorSymbol } from './connector';
import { counterDownSymbol } from './counter_down';
import { counterUpSymbol } from './counter_up';
import { disconnectSwitchSymbol } from './disconnect_switch';
import { diodeSymbol } from './diode';
import { emergencyStopSymbol } from './emergency_stop';
import { fuseSymbol } from './fuse';
import { groundSymbol } from './ground';
import { inductorSymbol } from './inductor';
import { junctionBoxSymbol } from './junction_box';
import { ledSymbol } from './led';
import { motorSymbol } from './motor';
import { netLabelSymbol } from './net_label';
import { offPageConnectorSymbol } from './off_page_connector';
import { overloadRelaySymbol } from './overload_relay';
import { pilotLampSymbol } from './pilot_lamp';
import { plcInSymbol } from './plc_in';
import { plcOutSymbol } from './plc_out';
import { powersourceSymbol } from './powersource';
import { powerSourceDc2pSymbol } from './power_source_dc_2p';
import { powerSourceAc1pSymbol } from './power_source_ac_1p';
import { powerSourceAc2pSymbol } from './power_source_ac_2p';
import { pushButtonNcSymbol } from './push_button_nc';
import { pushButtonNoSymbol } from './push_button_no';
import { relaySymbol } from './relay';
import { relayContactNcSymbol } from './relay_contact_nc';
import { relayContactNoSymbol } from './relay_contact_no';
import { resistorSymbol } from './resistor';
import { scopeSymbol } from './scope';
import { selectorSwitchSymbol } from './selector_switch';
import { sensorSymbol } from './sensor';
import { solenoidValveSymbol } from './solenoid_valve';
import { switchChangeoverSymbol } from './switch_changeover';
import { switchNcSymbol } from './switch_nc';
import { switchNoSymbol } from './switch_no';
import { terminalSymbol } from './terminal';
import { terminalBlockSymbol } from './terminal_block';
import { textSymbol } from './text';
import { timerOffDelaySymbol } from './timer_off_delay';
import { timerOnDelaySymbol } from './timer_on_delay';
import { transformerSymbol } from './transformer';

export const BUILTIN_SYMBOLS: ReadonlyMap<string, SymbolDefinition> = new Map([
  ['builtin:fuse', fuseSymbol],
  ['builtin:ground', groundSymbol],
  ['builtin:relay_contact_no', relayContactNoSymbol],
  ['builtin:relay_contact_nc', relayContactNcSymbol],
  ['builtin:switch_no', switchNoSymbol],
  ['builtin:switch_nc', switchNcSymbol],
  ['builtin:switch_changeover', switchChangeoverSymbol],
  ['builtin:circuit_breaker', circuitBreakerSymbol],
  ['builtin:capacitor', capacitorSymbol],
  ['builtin:resistor', resistorSymbol],
  ['builtin:inductor', inductorSymbol],
  ['builtin:diode', diodeSymbol],
  ['builtin:terminal', terminalSymbol],
  ['builtin:connector', connectorSymbol],
  ['builtin:timer_on_delay', timerOnDelaySymbol],
  ['builtin:timer_off_delay', timerOffDelaySymbol],
  ['builtin:counter_up', counterUpSymbol],
  ['builtin:counter_down', counterDownSymbol],
  ['builtin:junction_box', junctionBoxSymbol],
  ['builtin:push_button_no', pushButtonNoSymbol],
  ['builtin:push_button_nc', pushButtonNcSymbol],
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
  ['builtin:power_source_dc_2p', powerSourceDc2pSymbol],
  ['builtin:power_source_ac_1p', powerSourceAc1pSymbol],
  ['builtin:power_source_ac_2p', powerSourceAc2pSymbol],
  ['builtin:transformer', transformerSymbol],
  ['builtin:plc_in', plcInSymbol],
  ['builtin:plc_out', plcOutSymbol],
  ['builtin:scope', scopeSymbol],
  ['builtin:off_page_connector', offPageConnectorSymbol],
]);

const BLOCK_TYPE_TO_SYMBOL_ID: ReadonlyMap<string, string> = new Map([
  ['powersource', 'builtin:powersource'],
  ['power_source', 'builtin:powersource'],
  ['power_source_dc_2p', 'builtin:power_source_dc_2p'],
  ['power_source_ac_1p', 'builtin:power_source_ac_1p'],
  ['power_source_ac_2p', 'builtin:power_source_ac_2p'],
  ['ground', 'builtin:ground'],
  ['plc_in', 'builtin:plc_in'],
  ['plc_out', 'builtin:plc_out'],
  ['plc_input', 'builtin:plc_in'],
  ['plc_output', 'builtin:plc_out'],
  ['relay', 'builtin:relay'],
  ['relay_coil', 'builtin:relay'],
  ['relay_contact_no', 'builtin:relay_contact_no'],
  ['relay_contact_nc', 'builtin:relay_contact_nc'],
  ['switch_no', 'builtin:switch_no'],
  ['switch_nc', 'builtin:switch_nc'],
  ['switch_changeover', 'builtin:switch_changeover'],
  ['push_button_no', 'builtin:push_button_no'],
  ['push_button_nc', 'builtin:push_button_nc'],
  ['circuit_breaker', 'builtin:circuit_breaker'],
  ['fuse', 'builtin:fuse'],
  ['capacitor', 'builtin:capacitor'],
  ['resistor', 'builtin:resistor'],
  ['inductor', 'builtin:inductor'],
  ['diode', 'builtin:diode'],
  ['terminal', 'builtin:terminal'],
  ['connector', 'builtin:connector'],
  ['timer_on_delay', 'builtin:timer_on_delay'],
  ['timer_off_delay', 'builtin:timer_off_delay'],
  ['counter_up', 'builtin:counter_up'],
  ['counter_down', 'builtin:counter_down'],
  ['junction_box', 'builtin:junction_box'],
  ['motor', 'builtin:motor'],
  ['transformer', 'builtin:transformer'],
  ['led', 'builtin:led'],
  ['pilot_lamp', 'builtin:pilot_lamp'],
  ['overload_relay', 'builtin:overload_relay'],
  ['contactor', 'builtin:contactor'],
  ['solenoid_valve', 'builtin:solenoid_valve'],
  ['sensor', 'builtin:sensor'],
  ['button', 'builtin:button'],
  ['emergency_stop', 'builtin:emergency_stop'],
  ['selector_switch', 'builtin:selector_switch'],
  ['net_label', 'builtin:net_label'],
  ['disconnect_switch', 'builtin:disconnect_switch'],
  ['terminal_block', 'builtin:terminal_block'],
  ['scope', 'builtin:scope'],
  ['off_page_connector', 'builtin:off_page_connector'],
  ['text', 'builtin:text'],
]);

export function getBuiltinSymbol(id: string): SymbolDefinition | undefined {
  return BUILTIN_SYMBOLS.get(id);
}

export function getBuiltinSymbolForBlockType(blockType: string): SymbolDefinition | undefined {
  const symbolId = BLOCK_TYPE_TO_SYMBOL_ID.get(blockType) ?? `builtin:${blockType}`;
  return BUILTIN_SYMBOLS.get(symbolId);
}
