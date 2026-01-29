//! Tauri command handlers module
//!
//! This module contains all Tauri IPC command handlers that can be invoked
//! from the frontend application.

pub mod canvas;
pub mod layout;
pub mod logging;
pub mod modbus;
pub mod parser;
pub mod project;
pub mod scenario;
pub mod settings;

// Re-export all project commands for convenient registration in lib.rs
pub use project::{
    clear_recent_projects, close_project, close_project_force, create_project,
    get_auto_save_settings, get_project_status, get_recent_projects, mark_project_modified,
    open_project, remove_from_recent, save_project, set_auto_save_enabled, set_auto_save_interval,
    set_backup_count, start_auto_save, stop_auto_save,
    // Recovery commands
    get_available_backups, validate_project_integrity, recover_project_from_backup,
    attempt_project_recovery,
};

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
    modbus_bulk_write, modbus_get_status, modbus_list_serial_ports, modbus_load_memory_csv,
    modbus_read_coils, modbus_read_discrete_inputs, modbus_read_holding_registers,
    modbus_read_input_registers, modbus_save_memory_csv, modbus_start_rtu, modbus_start_tcp,
    modbus_stop_rtu, modbus_stop_tcp, modbus_write_coil, modbus_write_coils,
    modbus_write_discrete_input, modbus_write_holding_register, modbus_write_holding_registers,
    modbus_write_input_register, ModbusState,
};

// Re-export canvas commands
pub use canvas::{
    canvas_circuit_exists, canvas_create_circuit, canvas_delete_circuit, canvas_list_circuits,
    canvas_load_circuit, canvas_save_circuit,
};

// Re-export scenario commands
pub use scenario::{
    scenario_create, scenario_delete, scenario_exists, scenario_export_csv, scenario_import_csv,
    scenario_list, scenario_load, scenario_save,
};

// Re-export parser commands
pub use parser::{
    parser_format_modbus_address, parser_is_read_only, parser_load_program,
    parser_map_address_to_modbus, parser_map_modbus_to_address, parser_parse_csv_content,
    parser_parse_csv_file, parser_parse_csv_grouped, parser_parse_modbus_address,
    parser_program_exists, parser_save_program,
};
