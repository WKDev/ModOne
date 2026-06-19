/**
 * XML Symbol Registry Initialization Hook
 *
 * Initializes the global XML symbol registry at app startup by:
 *  1. Registering all TypeScript built-in symbol definitions
 *  2. Loading XML-defined overrides for built-in symbols
 *
 * Call once in App.tsx (or MainWindowContent) to ensure the registry is
 * populated before any canvas document is opened.
 *
 * The XML-defined symbols take precedence over TypeScript counterparts,
 * enabling hot-patch of individual symbols without recompilation.
 *
 * Usage:
 *   function MainWindowContent() {
 *     useXmlSymbolInit();
 *     ...
 *   }
 */

import { useEffect, useRef } from 'react';
import { BUILTIN_SYMBOLS } from '@/assets/builtin-symbols';
import { xmlSymbolRegistry } from '@/services/xmlSymbolRegistry';

// Import built-in XML symbol definitions as raw strings.
// These are bundled at build time via Vite's ?raw transform.
import relayXml from '@/assets/builtin-symbols/xml/relay.symbol.xml?raw';
import fuseXml from '@/assets/builtin-symbols/xml/fuse.symbol.xml?raw';
import circuitBreakerXml from '@/assets/builtin-symbols/xml/circuit_breaker.symbol.xml?raw';
import motorXml from '@/assets/builtin-symbols/xml/motor.symbol.xml?raw';
import contactorXml from '@/assets/builtin-symbols/xml/contactor.symbol.xml?raw';
import overloadRelayXml from '@/assets/builtin-symbols/xml/overload_relay.symbol.xml?raw';
import disconnectSwitchXml from '@/assets/builtin-symbols/xml/disconnect_switch.symbol.xml?raw';
import transformerXml from '@/assets/builtin-symbols/xml/transformer.symbol.xml?raw';
import terminalBlockXml from '@/assets/builtin-symbols/xml/terminal_block.symbol.xml?raw';
import timerOnDelayXml from '@/assets/builtin-symbols/xml/timer_on_delay.symbol.xml?raw';
import timerOffDelayXml from '@/assets/builtin-symbols/xml/timer_off_delay.symbol.xml?raw';
import counterUpXml from '@/assets/builtin-symbols/xml/counter_up.symbol.xml?raw';
import counterDownXml from '@/assets/builtin-symbols/xml/counter_down.symbol.xml?raw';
import switchNoXml from '@/assets/builtin-symbols/xml/switch_no.symbol.xml?raw';
import switchNcXml from '@/assets/builtin-symbols/xml/switch_nc.symbol.xml?raw';
import switchChangeoverXml from '@/assets/builtin-symbols/xml/switch_changeover.symbol.xml?raw';
import pushButtonNoXml from '@/assets/builtin-symbols/xml/push_button_no.symbol.xml?raw';
import pushButtonNcXml from '@/assets/builtin-symbols/xml/push_button_nc.symbol.xml?raw';
import solenoidValveXml from '@/assets/builtin-symbols/xml/solenoid_valve.symbol.xml?raw';
import sensorXml from '@/assets/builtin-symbols/xml/sensor.symbol.xml?raw';
import pilotLampXml from '@/assets/builtin-symbols/xml/pilot_lamp.symbol.xml?raw';
import ledXml from '@/assets/builtin-symbols/xml/led.symbol.xml?raw';
import buttonXml from '@/assets/builtin-symbols/xml/button.symbol.xml?raw';
import emergencyStopXml from '@/assets/builtin-symbols/xml/emergency_stop.symbol.xml?raw';
import selectorSwitchXml from '@/assets/builtin-symbols/xml/selector_switch.symbol.xml?raw';
import groundXml from '@/assets/builtin-symbols/xml/ground.symbol.xml?raw';
import terminalXml from '@/assets/builtin-symbols/xml/terminal.symbol.xml?raw';
import connectorXml from '@/assets/builtin-symbols/xml/connector.symbol.xml?raw';
import junctionBoxXml from '@/assets/builtin-symbols/xml/junction_box.symbol.xml?raw';
import netLabelXml from '@/assets/builtin-symbols/xml/net_label.symbol.xml?raw';
import offPageConnectorXml from '@/assets/builtin-symbols/xml/off_page_connector.symbol.xml?raw';
import powersourceXml from '@/assets/builtin-symbols/xml/powersource.symbol.xml?raw';
import powerSourceDc2pXml from '@/assets/builtin-symbols/xml/power_source_dc_2p.symbol.xml?raw';
import powerSourceAc1pXml from '@/assets/builtin-symbols/xml/power_source_ac_1p.symbol.xml?raw';
import powerSourceAc2pXml from '@/assets/builtin-symbols/xml/power_source_ac_2p.symbol.xml?raw';
import plcInXml from '@/assets/builtin-symbols/xml/plc_in.symbol.xml?raw';
import plcOutXml from '@/assets/builtin-symbols/xml/plc_out.symbol.xml?raw';
import scopeXml from '@/assets/builtin-symbols/xml/scope.symbol.xml?raw';
import textXml from '@/assets/builtin-symbols/xml/text.symbol.xml?raw';
import resistorXml from '@/assets/builtin-symbols/xml/resistor.symbol.xml?raw';
import capacitorXml from '@/assets/builtin-symbols/xml/capacitor.symbol.xml?raw';
import inductorXml from '@/assets/builtin-symbols/xml/inductor.symbol.xml?raw';
import diodeXml from '@/assets/builtin-symbols/xml/diode.symbol.xml?raw';
import relayContactNoXml from '@/assets/builtin-symbols/xml/relay_contact_no.symbol.xml?raw';
import relayContactNcXml from '@/assets/builtin-symbols/xml/relay_contact_nc.symbol.xml?raw';

/**
 * All built-in XML symbol definitions in load order.
 * XML symbols override TypeScript built-ins with the same ID.
 */
const BUILTIN_XML_SYMBOLS: string[] = [
  relayXml,
  fuseXml,
  circuitBreakerXml,
  motorXml,
  contactorXml,
  overloadRelayXml,
  disconnectSwitchXml,
  transformerXml,
  terminalBlockXml,
  timerOnDelayXml,
  timerOffDelayXml,
  counterUpXml,
  counterDownXml,
  switchNoXml,
  switchNcXml,
  switchChangeoverXml,
  pushButtonNoXml,
  pushButtonNcXml,
  solenoidValveXml,
  sensorXml,
  pilotLampXml,
  ledXml,
  buttonXml,
  emergencyStopXml,
  selectorSwitchXml,
  groundXml,
  terminalXml,
  connectorXml,
  junctionBoxXml,
  netLabelXml,
  offPageConnectorXml,
  powersourceXml,
  powerSourceDc2pXml,
  powerSourceAc1pXml,
  powerSourceAc2pXml,
  plcInXml,
  plcOutXml,
  scopeXml,
  textXml,
  resistorXml,
  capacitorXml,
  inductorXml,
  diodeXml,
  relayContactNoXml,
  relayContactNcXml,
];

/**
 * Initialize the global XML symbol registry once per app session.
 *
 * Safe to call multiple times — initialization only runs once.
 */
export function useXmlSymbolInit(): void {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || xmlSymbolRegistry.isInitialized) {
      return;
    }
    initialized.current = true;

    // Step 1: Register all TypeScript built-in symbols
    xmlSymbolRegistry.initBuiltins(BUILTIN_SYMBOLS);

    // Step 2: Load XML-defined overrides (non-blocking; failures are logged)
    const results = xmlSymbolRegistry.loadBuiltinXml(BUILTIN_XML_SYMBOLS);

    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      console.warn(
        `[useXmlSymbolInit] ${failed.length}/${results.length} XML symbol(s) failed to load:`,
        failed.map((r) => `  ${r.id}: ${r.error}`).join('\n'),
      );
    } else {
      console.debug(
        `[useXmlSymbolInit] Loaded ${results.length} XML symbol overrides (${BUILTIN_SYMBOLS.size} built-ins registered).`,
      );
    }
  }, []);
}
