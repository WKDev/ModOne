//! Tauri command handlers module
//!
//! This module contains all Tauri IPC command handlers that can be invoked
//! from the frontend application.

pub mod project;
pub mod settings;

// Re-export all project commands for convenient registration in lib.rs
pub use project::{
    clear_recent_projects, close_project, close_project_force, create_project,
    get_auto_save_settings, get_project_status, get_recent_projects, mark_project_modified,
    open_project, remove_from_recent, save_project, set_auto_save_enabled, set_auto_save_interval,
    set_backup_count, start_auto_save, stop_auto_save,
};

// Re-export settings commands
pub use settings::{get_app_settings, save_app_settings};

// Future command modules will be added here:
// pub mod modbus;
// pub mod canvas;
// pub mod scenario;
