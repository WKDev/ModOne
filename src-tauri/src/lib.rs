//! ModOne - Mod Manager Application
//!
//! This is the main library crate for the ModOne Tauri application.

pub mod commands;
pub mod error;
pub mod modbus;
pub mod project;

// Re-export error types for convenience
pub use error::{ModOneError, ModOneResult};

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
    // Modbus commands
    modbus_bulk_write, modbus_get_status, modbus_list_serial_ports, modbus_load_memory_csv,
    modbus_read_coils, modbus_read_discrete_inputs, modbus_read_holding_registers,
    modbus_read_input_registers, modbus_save_memory_csv, modbus_start_rtu, modbus_start_tcp,
    modbus_stop_rtu, modbus_stop_tcp, modbus_write_coil, modbus_write_coils,
    modbus_write_discrete_input, modbus_write_holding_register, modbus_write_holding_registers,
    modbus_write_input_register, ModbusState,
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

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(project_manager)
        .manage(auto_save_manager)
        .manage(modbus_state)
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
