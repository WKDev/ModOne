//! Tauri command handlers module
//!
//! This module contains all Tauri IPC command handlers that can be invoked
//! from the frontend application.

pub mod canvas;
pub mod canvas_sync;
pub mod explorer;
pub mod layout;
pub mod licensing;
pub mod logging;
pub mod menu;
pub mod modbus;
pub mod network;
pub mod opcua;
pub mod parser;
pub mod project;
pub mod scenario;
pub mod schematic;
pub mod scope_sim;
pub mod settings;
pub mod sim;
pub mod symbols;
pub mod nodeset2_export;
pub mod tag_import_export;
pub mod tags;
pub mod window;

// Re-export all project commands for convenient registration in lib.rs
pub use project::{
    attempt_project_recovery,
    clear_recent_projects,
    close_project,
    close_project_force,
    create_project,
    get_auto_save_settings,
    // Recovery commands
    get_available_backups,
    get_project_status,
    get_recent_projects,
    mark_project_modified,
    open_project,
    recover_project_from_backup,
    remove_from_recent,
    save_project,
    set_project_watched_tags,
    set_auto_save_enabled,
    set_auto_save_interval,
    set_backup_count,
    start_auto_save,
    stop_auto_save,
    update_project_config,
    validate_project_integrity,
};

// Re-export licensing commands
pub use licensing::{activate_license, checkout_license, deactivate_license, get_license_info};

// Re-export settings commands
pub use settings::{get_app_settings, save_app_settings};

// Re-export logging commands
pub use logging::{clear_error_logs, get_log_path, get_recent_errors, open_logs_directory};

// Re-export layout commands
pub use layout::{
    delete_layout, get_last_active_layout, get_restore_last_session, list_layouts, load_layout,
    save_layout, set_last_active_layout, set_restore_last_session,
};

// Re-export modbus commands and state
pub use modbus::{
    modbus_bulk_write, modbus_get_generators, modbus_get_status, modbus_list_serial_ports,
    modbus_load_memory_csv, modbus_read_coils, modbus_read_discrete_inputs,
    modbus_read_holding_registers, modbus_read_input_registers, modbus_save_memory_csv,
    modbus_set_generators, modbus_start_rtu, modbus_start_tcp, modbus_stop_rtu, modbus_stop_tcp,
    modbus_write_coil, modbus_write_coils, modbus_write_discrete_input,
    modbus_write_holding_register, modbus_write_holding_registers, modbus_write_input_register,
    ModbusState,
};

// Re-export canvas commands
pub use canvas::{
    canvas_circuit_exists,
    canvas_create_circuit,
    canvas_delete_circuit,
    canvas_list_circuits,
    canvas_load_circuit,
    canvas_save_circuit,
    scope_add_sample,
    scope_add_samples,
    scope_arm_trigger,
    scope_clear_mappings,
    // Scope commands and state
    scope_create,
    scope_delete,
    scope_exists,
    scope_get_data,
    scope_get_mappings,
    scope_list,
    // Scope mapping commands
    scope_register_mapping,
    scope_register_mappings,
    scope_remove_mapping,
    scope_reset,
    scope_run_stop,
    scope_update_settings,
    ScopeState,
};

// Re-export scope-simulation integration commands
pub use scope_sim::{scope_read_device_voltage, scope_tick};

// Re-export scenario commands and state
pub use scenario::{
    scenario_create,
    scenario_delete,
    scenario_exists,
    scenario_export_csv,
    scenario_get_state,
    scenario_get_status,
    scenario_import_csv,
    scenario_list,
    scenario_load,
    scenario_pause,
    scenario_resume,
    // Execution commands
    scenario_run,
    scenario_save,
    scenario_seek,
    scenario_stop,
    ScenarioExecutorState,
};

// Re-export parser commands
pub use parser::{
    parser_format_modbus_address, parser_is_read_only, parser_load_program,
    parser_map_address_to_modbus, parser_map_modbus_to_address, parser_parse_csv_content,
    parser_parse_csv_file, parser_parse_csv_grouped, parser_parse_modbus_address,
    parser_program_exists, parser_save_program,
};

// Re-export canvas sync commands
pub use canvas_sync::{
    canvas_sync_clear_mappings, canvas_sync_force_update_outputs, canvas_sync_get_changed_blocks,
    canvas_sync_get_mappings, canvas_sync_get_status, canvas_sync_handle_input,
    canvas_sync_handle_inputs, canvas_sync_has_changes, canvas_sync_init,
    canvas_sync_register_mapping, canvas_sync_register_mappings, canvas_sync_remove_mapping,
    canvas_sync_reset_stats, canvas_sync_shutdown, canvas_sync_update_outputs, CanvasSyncState,
};

// Re-export simulation commands
pub use sim::{
    ladder_force_device, ladder_release_force, runtime_query_audit_log,
    ladder_start_monitoring, ladder_stop_monitoring,
    sim_add_breakpoint, sim_add_watch, sim_continue, sim_create_raw_tag, sim_get_breakpoints,
    sim_get_debugger_state, sim_get_memory_snapshot, sim_get_scan_info, sim_get_status,
    sim_get_tag, sim_get_watches, sim_list_tags, sim_load_program, sim_pause, sim_read_binding,
    sim_register_tag, sim_remove_breakpoint, sim_remove_tag, sim_remove_watch, sim_reset,
    sim_resolve_binding, sim_resolve_binding_parts, sim_resume, sim_run,
    sim_set_breakpoint_enabled, sim_step, sim_stop, sim_write_binding, SimState,
};

// Re-export explorer commands
pub use explorer::{
    create_project_file, get_file_info, list_project_files, path_exists, read_file_contents,
    write_file_contents,
};

// Re-export window commands and state
pub use window::{
    close_all_floating_windows, window_close_floating, window_create_floating,
    window_floating_exists, window_focus_floating, window_get_floating_info, window_list_floating,
    window_maximize_floating, window_minimize_floating, window_update_bounds, FloatingWindowInfo,
    FloatingWindowRegistry, FloatingWindowState, WindowBounds,
};

// Re-export schematic commands
pub use schematic::{
    schematic_delete, schematic_exists, schematic_list, schematic_load, schematic_save,
};

// Re-export symbol commands (JSON-backed)
pub use symbols::{symbol_delete, symbol_list, symbol_list_all, symbol_load, symbol_save};

// Re-export project block loader commands (XML-backed)
pub use symbols::{
    project_block_delete,
    project_block_ensure_dir,
    project_block_import_xml,
    project_block_list,
    project_block_load,
    project_block_load_all,
    project_block_load_all_with_warnings,
    project_block_symbols_dir,
};

// Re-export OPC UA commands and state
pub use opcua::{
    opcua_add_user_account, opcua_clear_audit_log, opcua_enforce_audit_retention,
    opcua_get_anonymous_access, opcua_get_audit_log_count, opcua_get_audit_retention_days,
    opcua_get_security_policies,
    opcua_get_sessions, opcua_get_status, opcua_list_user_accounts, opcua_query_audit_log,
    opcua_remove_user_account, opcua_set_anonymous_access, opcua_set_audit_retention_days,
    opcua_set_security_policies,
    opcua_restart_server, opcua_start_server, opcua_stop_server, opcua_update_user_account, CredentialCacheState,
    OpcUaState, UserAccountStoreState,
};

// Re-export tag commands and state
pub use tags::{check_canonical_address_duplicate, create_tag, delete_tag, delete_tags, list_tags, read_tags, set_watched_tags, update_tag_definition, write_tag, TagEventBridgeState};

// Re-export tag import/export commands
pub use tag_import_export::{export_tags_csv, export_tags_json, export_tags_nodeset2, import_tags_csv, import_tags_json, validate_csv_import, validate_json_import};

// Re-export network commands
pub use network::{
    network_add_alias, network_check_ip, network_cleanup_aliases, network_get_active_aliases,
    network_list_interfaces, network_remove_alias, NetworkState,
};
