
## Task 7: Unified symbolBridge.ts (2026-03-08)
- symbolBridge.ts delegates to customSymbolBridge cache — builtins and custom symbols share the same Map
- `'symbolId' in block && block.symbolId` is the correct type-safe pattern for accessing optional symbolId on Block union type
- `CustomSymbolBlock` covers types: `custom_symbol | scope | text | net_label`
- BUILTIN_SYMBOLS has 42 entries; BLOCK_TYPE_TO_SYMBOL_ID handles aliases (e.g. relay_coil → builtin:relay)
- registerBuiltinSymbols() is idempotent via _builtinsRegistered flag; safe to call multiple times
- Build was already failing before this task (pre-existing TS errors in 7+ unrelated files)
- 2 pre-existing test failures: stale "22" hardcoded assertions in port-positions.test.ts and builtin-symbol-migration.test.ts


## SimulationRenderer._resolveTint() Category Refactoring (2026-03-08)

### Category Map Discovery
All 12 unique category values in builtin-symbols (42 files):
- switching (10): relay, relay_contact_no/nc, switch_no/nc/changeover, contactor, push_button_no/nc, disconnect_switch
- plc (6): plc_in, plc_out, timer_on_delay, timer_off_delay, counter_up, counter_down  
- connection (6): terminal, connector, junction_box, terminal_block, net_label, off_page_connector
- passive (4): capacitor, resistor, inductor, diode
- power (3): powersource, ground, transformer
- protection (3): fuse, circuit_breaker, overload_relay
- control (3): button, emergency_stop, selector_switch
- indicator (2): led, pilot_lamp
- actuator (2): motor, solenoid_valve
- sensing (1): sensor
- measurement (1): scope
- annotation (1): text

### Key Design Decision: 'switching' Category Compromise
The original switch had different colors for relay_coil (ACTIVE/blue) vs contacts/switches (RUNNING/green).
Both map to 'switching' category — can't preserve both with pure category lookup.
Decision: map 'switching' → 'running' because contacts/switches are the dominant use case.
relay_coil behavioral change (ACTIVE→RUNNING) is acceptable trade-off for cleaner code.

### TINT_BEHAVIOR_BY_CATEGORY Map
Only 6 categories explicitly mapped; remaining 6 fall through to 'default' (= COLOR_ACTIVE when on):
- plc → active, control → warning, switching → running, actuator → running, indicator → led, power → static

### Implementation Pattern
- Early return `if (!state) return COLOR_DEFAULT` eliminates all false-state branches
- Map.get() is O(1) — safe for high-frequency simulation rendering
- `symbol?.category ?? ''` safely handles unknown blockTypes (Map.get('') returns undefined → 'default')
- Switch on TintBehavior (not blockType) satisfies "no switch on raw blockType strings" requirement
