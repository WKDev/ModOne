import type { SymbolDefinition } from '@/types/symbol';
import { parseSymbolXml } from '@/services/symbolXmlParser';

/**
 * Built-in symbols are authored as `.symbol.xml` (the single source of truth,
 * same format as user symbols) and parsed at module load. The files are the
 * lossless serialization of the former hand-written `.ts` definitions; the
 * serializer↔parser identity is locked by builtinXmlRoundtrip.test.ts.
 */
const xmlModules = import.meta.glob('./xml/*.symbol.xml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function buildBuiltinSymbols(): Map<string, SymbolDefinition> {
  const map = new Map<string, SymbolDefinition>();
  for (const xml of Object.values(xmlModules)) {
    for (const sym of parseSymbolXml(xml)) {
      map.set(sym.id, sym);
    }
  }
  return map;
}

export const BUILTIN_SYMBOLS: ReadonlyMap<string, SymbolDefinition> = buildBuiltinSymbols();

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
