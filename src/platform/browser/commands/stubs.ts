/**
 * Safe stub handlers for backend features not yet ported to the browser.
 *
 * Increment 1 keeps symbol / canvas / runtime (modbus, opcua, simulation,
 * scope, scenario, parser, tags) as inert stubs that return empty/typed values
 * so the editors boot and run without throwing. Symbol and canvas persistence
 * are upgraded in a later increment; modbus/opcua/simulation move to a
 * rust/wasm backend after that.
 */
import type { CommandMap, CommandHandler } from '../types';

const nullHandler: CommandHandler = () => null;
const emptyArray: CommandHandler = () => [];
const falseHandler: CommandHandler = () => false;

/** Assign one handler to many command names. */
function many(names: string[], handler: CommandHandler): CommandMap {
  return Object.fromEntries(names.map((n) => [n, handler]));
}

export const stubCommands: CommandMap = {
  // ---- Symbols (persistence arrives in increment 2) -----------------------
  symbol_save: nullHandler,
  symbol_load: nullHandler,
  symbol_delete: nullHandler,
  symbol_list: emptyArray,
  symbol_list_all: emptyArray,

  // ---- Project XML symbol blocks ------------------------------------------
  project_block_list: emptyArray,
  project_block_load: nullHandler,
  project_block_load_all: emptyArray,
  project_block_load_all_with_warnings: emptyArray,
  project_block_delete: nullHandler,
  project_block_import_xml: nullHandler,
  project_block_ensure_dir: (args) => `${String(args.projectDir ?? '/modone')}/.modone/symbols`,
  project_block_symbols_dir: (args) => `${String(args.projectDir ?? '/modone')}/.modone/symbols`,

  // ---- Canvas / circuits (persistence arrives in increment 2) -------------
  canvas_save_circuit: nullHandler,
  canvas_load_circuit: () => '',
  canvas_create_circuit: nullHandler,
  canvas_delete_circuit: nullHandler,
  canvas_list_circuits: emptyArray,
  canvas_circuit_exists: falseHandler,
  schematic_save: nullHandler,
  schematic_load: nullHandler,

  // ---- Canvas <-> simulation sync -----------------------------------------
  ...many(
    [
      'canvas_sync_init',
      'canvas_sync_shutdown',
      'canvas_sync_register_mapping',
      'canvas_sync_register_mappings',
      'canvas_sync_remove_mapping',
      'canvas_sync_clear_mappings',
      'canvas_sync_handle_input',
      'canvas_sync_handle_inputs',
      'canvas_sync_force_update_outputs',
      'canvas_sync_reset_stats',
    ],
    nullHandler
  ),
  canvas_sync_get_mappings: emptyArray,
  canvas_sync_get_status: () => ({ running: false, mappingCount: 0 }),

  // ---- Modbus -------------------------------------------------------------
  ...many(
    [
      'modbus_start_tcp',
      'modbus_stop_tcp',
      'modbus_start_rtu',
      'modbus_stop_rtu',
      'modbus_write_coil',
      'modbus_write_coils',
      'modbus_write_discrete_input',
      'modbus_write_holding_register',
      'modbus_write_holding_registers',
      'modbus_write_input_register',
      'modbus_bulk_write',
      'modbus_save_memory_csv',
      'modbus_load_memory_csv',
    ],
    nullHandler
  ),
  modbus_list_serial_ports: emptyArray,
  modbus_get_status: () => ({
    tcp_running: false,
    rtu_running: false,
    tcp_port: 502,
    rtu_port: null,
    connection_count: 0,
    connections: [],
  }),
  modbus_read_coils: (args) => Array.from({ length: Number(args.count ?? 0) }, () => false),
  modbus_read_discrete_inputs: (args) => Array.from({ length: Number(args.count ?? 0) }, () => false),
  modbus_read_holding_registers: (args) => Array.from({ length: Number(args.count ?? 0) }, () => 0),
  modbus_read_input_registers: (args) => Array.from({ length: Number(args.count ?? 0) }, () => 0),

  // ---- OPC UA -------------------------------------------------------------
  ...many(
    [
      'opcua_start_server',
      'opcua_stop_server',
      'opcua_restart_server',
      'opcua_set_security_policies',
      'opcua_set_anonymous_access',
      'opcua_add_user_account',
      'opcua_remove_user_account',
      'opcua_update_user_account',
      'opcua_clear_audit_log',
      'opcua_enforce_audit_retention',
      'opcua_set_audit_retention_days',
    ],
    nullHandler
  ),
  opcua_get_status: () => ({
    running: false,
    port: 4840,
    endpoint: '',
    endpointPath: '',
    sessionCount: 0,
    sessionCountSupported: false,
    featureEnabled: false,
  }),
  opcua_get_security_policies: emptyArray,
  opcua_get_sessions: emptyArray,
  opcua_list_user_accounts: emptyArray,
  opcua_get_anonymous_access: falseHandler,
  opcua_query_audit_log: emptyArray,
  opcua_get_audit_log_count: () => 0,
  opcua_get_audit_retention_days: () => 30,

  // ---- Simulation / debugger ----------------------------------------------
  ...many(
    [
      'sim_run',
      'sim_stop',
      'sim_pause',
      'sim_resume',
      'sim_reset',
      'sim_load_program',
      'sim_continue',
      'sim_add_watch',
      'sim_remove_watch',
      'sim_remove_breakpoint',
      'sim_set_breakpoint_enabled',
    ],
    nullHandler
  ),
  sim_step: () => ({ success: true, stepType: 'network', scanCount: 1 }),
  sim_add_breakpoint: () => `bp-${Math.floor(performance.now())}`,
  sim_get_breakpoints: emptyArray,
  sim_get_watches: emptyArray,
  sim_get_debugger_state: () => ({ running: false, paused: false }),
  sim_resolve_binding: nullHandler,
  sim_resolve_binding_parts: nullHandler,

  // ---- Scope --------------------------------------------------------------
  ...many(
    [
      'scope_create',
      'scope_delete',
      'scope_run_stop',
      'scope_reset',
      'scope_arm_trigger',
      'scope_update_settings',
      'scope_add_sample',
      'scope_add_samples',
      'scope_register_mapping',
      'scope_register_mappings',
      'scope_remove_mapping',
      'scope_clear_mappings',
      'scope_tick',
    ],
    nullHandler
  ),
  scope_list: emptyArray,
  scope_exists: falseHandler,
  scope_get_data: nullHandler,
  scope_get_mappings: emptyArray,
  scope_read_device_voltage: () => 0,

  // ---- Scenario -----------------------------------------------------------
  ...many(
    [
      'scenario_save',
      'scenario_export_csv',
      'scenario_import_csv',
      'scenario_delete',
      'scenario_pause',
      'scenario_resume',
      'scenario_stop',
      'scenario_seek',
      'scenario_create',
    ],
    nullHandler
  ),
  scenario_list: emptyArray,
  scenario_load: nullHandler,
  scenario_exists: falseHandler,
  scenario_run: (_args, ctx) => {
    ctx.emit('scenario:status', { status: 'running' });
    return null;
  },

  // ---- Parser (ladder programs) -------------------------------------------
  ...many(['parser_save_program', 'parser_load_program'], nullHandler),
  parser_program_exists: falseHandler,
  parser_is_read_only: falseHandler,
  parser_parse_csv_content: () => ({ rows: [], errors: [] }),
  parser_parse_csv_file: () => ({ rows: [], errors: [] }),
  parser_parse_modbus_address: nullHandler,
  parser_format_modbus_address: () => '',
  parser_map_address_to_modbus: nullHandler,
  parser_map_modbus_to_address: nullHandler,

  // ---- Tags ---------------------------------------------------------------
  ...many(
    [
      'create_tag',
      'delete_tag',
      'delete_tags',
      'write_tag',
      'update_tag_definition',
      'set_watched_tags',
      'set_project_watched_tags',
      'export_tags_csv',
      'export_tags_json',
      'import_tags_csv',
      'import_tags_json',
    ],
    nullHandler
  ),
  list_tags: emptyArray,
  read_tags: emptyArray,
  check_canonical_address_duplicate: falseHandler,
  validate_csv_import: () => ({ valid: true, errors: [] }),
  validate_json_import: () => ({ valid: true, errors: [] }),

  // ---- Ladder monitoring --------------------------------------------------
  ...many(
    ['ladder_start_monitoring', 'ladder_stop_monitoring', 'ladder_force_device', 'ladder_release_force'],
    nullHandler
  ),

  // ---- Floating windows (no multi-window in the browser) ------------------
  ...many(
    [
      'window_create_floating',
      'window_close_floating',
      'window_focus_floating',
      'window_minimize_floating',
      'window_maximize_floating',
      'window_update_bounds',
    ],
    nullHandler
  ),
  window_list_floating: emptyArray,
  window_floating_exists: falseHandler,
  window_get_floating_info: nullHandler,
};
