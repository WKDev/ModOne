//! ModOne - Mod Manager Application
//!
//! This is the main library crate for the ModOne Tauri application.

pub mod commands;
pub mod modbus;
pub mod project;

use project::{AutoSaveManager, ProjectManager};

// Re-export commands for registration
use commands::{
    clear_recent_projects, close_project, close_project_force, create_project,
    get_app_settings, get_auto_save_settings, get_project_status, get_recent_projects,
    mark_project_modified, open_project, remove_from_recent, save_app_settings, save_project,
    set_auto_save_enabled, set_auto_save_interval, set_backup_count, start_auto_save,
    stop_auto_save,
    // Layout commands
    delete_layout, get_last_active_layout, get_restore_last_session, list_layouts, load_layout,
    save_layout, set_last_active_layout, set_restore_last_session,
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

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(project_manager)
        .manage(auto_save_manager)
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
