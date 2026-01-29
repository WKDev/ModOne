//! ModOne - Mod Manager Application
//!
//! This is the main library crate for the ModOne Tauri application.

pub mod commands;
pub mod error;
pub mod logging;
pub mod modbus;
pub mod parser;
pub mod project;
pub mod scenario;
pub mod sim;

// Re-export error types for convenience
pub use error::{ModOneError, ModOneResult};

// Re-export logging types
pub use logging::{ErrorLogger, SharedErrorLogger, LogEntry};

use project::{AutoSaveManager, ProjectManager};

// Re-export commands for registration
use commands::{
    clear_recent_projects, close_project, close_project_force, create_project,
    get_app_settings, get_auto_save_settings, get_project_status, get_recent_projects,
    mark_project_modified, open_project, remove_from_recent, save_app_settings, save_project,
    set_auto_save_enabled, set_auto_save_interval, set_backup_count, start_auto_save,
    stop_auto_save,
    // Recovery commands
    get_available_backups, validate_project_integrity, recover_project_from_backup,
    attempt_project_recovery,
    // Layout commands
    delete_layout, get_last_active_layout, get_restore_last_session, list_layouts, load_layout,
    save_layout, set_last_active_layout, set_restore_last_session,
    // Logging commands
    clear_error_logs, get_log_path, get_recent_errors, open_logs_directory,
    // Modbus commands
    modbus_bulk_write, modbus_get_status, modbus_list_serial_ports, modbus_load_memory_csv,
    modbus_read_coils, modbus_read_discrete_inputs, modbus_read_holding_registers,
    modbus_read_input_registers, modbus_save_memory_csv, modbus_start_rtu, modbus_start_tcp,
    modbus_stop_rtu, modbus_stop_tcp, modbus_write_coil, modbus_write_coils,
    modbus_write_discrete_input, modbus_write_holding_register, modbus_write_holding_registers,
    modbus_write_input_register, ModbusState,
    // Canvas commands
    canvas_circuit_exists, canvas_create_circuit, canvas_delete_circuit, canvas_list_circuits,
    canvas_load_circuit, canvas_save_circuit,
    // Scenario commands
    scenario_create, scenario_delete, scenario_exists, scenario_export_csv, scenario_import_csv,
    scenario_list, scenario_load, scenario_save,
    // Parser commands
    parser_parse_csv_content, parser_parse_csv_file, parser_parse_csv_grouped,
};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to ModOne!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the shared project manager
    let project_manager = ProjectManager::new_shared();

    // Initialize the auto-save manager
    let auto_save_manager = std::sync::Arc::new(std::sync::Mutex::new(AutoSaveManager::default()));

    // Initialize Modbus state
    let modbus_state = ModbusState::default();

    // Initialize error logger
    let error_logger = ErrorLogger::new_shared()
        .unwrap_or_else(|e| {
            log::warn!("Failed to initialize error logger: {}. Using default.", e);
            std::sync::Arc::new(std::sync::Mutex::new(ErrorLogger::default()))
        });

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(project_manager)
        .manage(auto_save_manager)
        .manage(modbus_state)
        .manage(error_logger)
        .setup(|app| {
            log::info!("ModOne application starting...");
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
                log::info!("Debug mode enabled with logging plugin");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            // Project management commands
            create_project,
            open_project,
            save_project,
            close_project,
            close_project_force,
            get_recent_projects,
            get_project_status,
            mark_project_modified,
            remove_from_recent,
            clear_recent_projects,
            // Auto-save commands
            get_auto_save_settings,
            set_auto_save_enabled,
            set_auto_save_interval,
            set_backup_count,
            start_auto_save,
            stop_auto_save,
            // Recovery commands
            get_available_backups,
            validate_project_integrity,
            recover_project_from_backup,
            attempt_project_recovery,
            // Logging commands
            get_log_path,
            get_recent_errors,
            clear_error_logs,
            open_logs_directory,
            // Settings commands
            get_app_settings,
            save_app_settings,
            // Layout commands
            save_layout,
            load_layout,
            list_layouts,
            delete_layout,
            set_last_active_layout,
            get_last_active_layout,
            set_restore_last_session,
            get_restore_last_session,
            // Modbus commands
            modbus_start_tcp,
            modbus_stop_tcp,
            modbus_start_rtu,
            modbus_stop_rtu,
            modbus_list_serial_ports,
            modbus_get_status,
            modbus_read_coils,
            modbus_write_coil,
            modbus_write_coils,
            modbus_read_discrete_inputs,
            modbus_write_discrete_input,
            modbus_read_holding_registers,
            modbus_write_holding_register,
            modbus_write_holding_registers,
            modbus_read_input_registers,
            modbus_write_input_register,
            modbus_bulk_write,
            modbus_save_memory_csv,
            modbus_load_memory_csv,
            // Canvas commands
            canvas_save_circuit,
            canvas_load_circuit,
            canvas_create_circuit,
            canvas_list_circuits,
            canvas_delete_circuit,
            canvas_circuit_exists,
            // Scenario commands
            scenario_load,
            scenario_save,
            scenario_import_csv,
            scenario_export_csv,
            scenario_create,
            scenario_list,
            scenario_delete,
            scenario_exists,
            // Parser commands
            parser_parse_csv_file,
            parser_parse_csv_content,
            parser_parse_csv_grouped,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
