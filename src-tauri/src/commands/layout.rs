//! Layout Command Handlers
//!
//! Tauri commands for managing layout presets and persistence.

use crate::project::layout::{LayoutConfig, LayoutStorageManager};
use tauri::AppHandle;

/// Save a layout configuration
#[tauri::command]
pub async fn save_layout(app: AppHandle, config: LayoutConfig) -> Result<(), String> {
    // Validate layout name
    if config.name.is_empty() {
        return Err("Layout name cannot be empty".to_string());
    }

    if config.name.contains(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-' && c != '_') {
        return Err("Layout name contains invalid characters".to_string());
    }

    let manager = LayoutStorageManager::new(&app)?;
    manager.save_layout(config)?;

    log::info!("Layout saved successfully");
    Ok(())
}

/// Load a layout configuration by name
#[tauri::command]
pub async fn load_layout(app: AppHandle, name: String) -> Result<LayoutConfig, String> {
    let manager = LayoutStorageManager::new(&app)?;
    let config = manager.load_layout(&name)?;

    log::info!("Layout '{}' loaded successfully", name);
    Ok(config)
}

/// List all available layout names
#[tauri::command]
pub async fn list_layouts(app: AppHandle) -> Result<Vec<String>, String> {
    let manager = LayoutStorageManager::new(&app)?;
    manager.list_layouts()
}

/// Delete a layout by name
#[tauri::command]
pub async fn delete_layout(app: AppHandle, name: String) -> Result<(), String> {
    let manager = LayoutStorageManager::new(&app)?;
    manager.delete_layout(&name)?;

    log::info!("Layout '{}' deleted successfully", name);
    Ok(())
}

/// Set the last active layout name
#[tauri::command]
pub async fn set_last_active_layout(app: AppHandle, name: Option<String>) -> Result<(), String> {
    let manager = LayoutStorageManager::new(&app)?;
    manager.set_last_active(name)
}

/// Get the last active layout name
#[tauri::command]
pub async fn get_last_active_layout(app: AppHandle) -> Result<Option<String>, String> {
    let manager = LayoutStorageManager::new(&app)?;
    manager.get_last_active()
}

/// Set restore last session preference
#[tauri::command]
pub async fn set_restore_last_session(app: AppHandle, restore: bool) -> Result<(), String> {
    let manager = LayoutStorageManager::new(&app)?;
    manager.set_restore_last_session(restore)
}

/// Get restore last session preference
#[tauri::command]
pub async fn get_restore_last_session(app: AppHandle) -> Result<bool, String> {
    let manager = LayoutStorageManager::new(&app)?;
    manager.get_restore_last_session()
}
