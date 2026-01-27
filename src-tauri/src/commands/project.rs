//! Tauri command handlers for project operations
//!
//! This module provides the IPC interface between the frontend and the
//! ProjectManager for create, open, save, and close operations.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::project::{
    AutoSaveSettings, CanvasData, MemorySnapshot, PlcSettings, ProjectConfig, ProjectError,
    RecentProject, ScenarioData, SharedAutoSaveManager, SharedProjectManager,
    // Recovery utilities
    find_backups, validate_mop_integrity, attempt_partial_recovery, recover_from_backup,
    BackupInfo, MopIntegrityResult, RecoveryResult,
};

// ============================================================================
// Response Types
// ============================================================================

/// Information returned after creating a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    /// Project name
    pub name: String,
    /// Full path to the .mop file
    pub path: PathBuf,
    /// Creation timestamp (ISO 8601 format)
    pub created_at: String,
}

/// Full project data returned when opening a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectData {
    /// Project configuration
    pub config: ProjectConfig,
    /// Canvas data if available
    pub canvas_data: Option<CanvasData>,
    /// Scenario data if available
    pub scenario_data: Option<ScenarioData>,
    /// Memory snapshot if available
    pub memory_snapshot: Option<MemorySnapshot>,
    /// Whether the project has unsaved changes
    pub is_modified: bool,
}

/// Current project status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectStatus {
    /// Whether a project is currently open
    pub is_open: bool,
    /// Whether the current project has unsaved changes
    pub is_modified: bool,
    /// Name of the current project (if open)
    pub name: Option<String>,
    /// Path to the current project (if open and saved)
    pub path: Option<PathBuf>,
}

// ============================================================================
// Error Handling
// ============================================================================

/// Convert ProjectError to a user-friendly error message
fn format_error(error: ProjectError) -> String {
    match error {
        ProjectError::NoProjectOpen => "No project is currently open".to_string(),
        ProjectError::UnsavedChanges => {
            "Project has unsaved changes. Save or discard changes first.".to_string()
        }
        ProjectError::MopFile(e) => format!("Project file error: {}", e),
        ProjectError::Config(e) => format!("Configuration error: {}", e),
        ProjectError::ConfigValidation(e) => format!("Configuration validation error: {}", e),
        ProjectError::Io(e) => format!("File operation failed: {}", e),
        ProjectError::Json(e) => format!("Data serialization error: {}", e),
        ProjectError::ProjectNotSaved => {
            "Project must be saved first. Use 'Save As' for new projects.".to_string()
        }
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Create a new project with the specified settings
///
/// # Arguments
/// * `name` - Project name
/// * `path` - Path where the .mop file will be saved
/// * `plc_manufacturer` - PLC manufacturer (e.g., "LS", "Mitsubishi", "Siemens")
/// * `plc_model` - PLC model name
/// * `scan_time_ms` - PLC scan time in milliseconds (optional, defaults to 10)
#[tauri::command]
pub async fn create_project(
    state: State<'_, SharedProjectManager>,
    name: String,
    path: PathBuf,
    plc_manufacturer: String,
    plc_model: String,
    scan_time_ms: Option<u32>,
) -> Result<ProjectInfo, String> {
    // Parse PLC manufacturer
    let manufacturer = plc_manufacturer
        .parse()
        .map_err(|e: String| format!("Invalid PLC manufacturer: {}", e))?;

    // Create PLC settings
    let plc_settings = PlcSettings {
        manufacturer,
        model: plc_model,
        scan_time_ms: scan_time_ms.unwrap_or(10),
    };

    // Acquire lock and create project
    let mut manager = state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;

    let info = manager
        .create_project(name, path, plc_settings)
        .map_err(format_error)?;

    Ok(ProjectInfo {
        name: info.name,
        path: info.path,
        created_at: info.created_at.to_rfc3339(),
    })
}

/// Open an existing project from a .mop file
///
/// # Arguments
/// * `path` - Path to the .mop file
#[tauri::command]
pub async fn open_project(
    state: State<'_, SharedProjectManager>,
    path: PathBuf,
) -> Result<ProjectData, String> {
    let mut manager = state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;

    let data = manager.open_project(path).map_err(format_error)?;

    Ok(ProjectData {
        config: data.config,
        canvas_data: data.canvas_data,
        scenario_data: data.scenario_data,
        memory_snapshot: data.memory_snapshot,
        is_modified: false,
    })
}

/// Save the current project
///
/// # Arguments
/// * `path` - Optional path for "Save As" operation. If None, saves to the original location.
#[tauri::command]
pub async fn save_project(
    state: State<'_, SharedProjectManager>,
    path: Option<PathBuf>,
) -> Result<(), String> {
    let mut manager = state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;

    manager.save_project(path).map_err(format_error)
}

/// Close the current project
///
/// Returns an error if there are unsaved changes.
/// Use `close_project_force` to close without saving.
#[tauri::command]
pub async fn close_project(state: State<'_, SharedProjectManager>) -> Result<(), String> {
    let mut manager = state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;

    manager.close_project().map_err(format_error)
}

/// Close the current project without saving
///
/// Warning: This will discard any unsaved changes.
#[tauri::command]
pub async fn close_project_force(state: State<'_, SharedProjectManager>) -> Result<(), String> {
    let mut manager = state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;

    manager.close_project_force().map_err(format_error)
}

/// Get the list of recently opened projects
#[tauri::command]
pub async fn get_recent_projects(
    state: State<'_, SharedProjectManager>,
) -> Result<Vec<RecentProject>, String> {
    let manager = state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;

    Ok(manager.get_recent_projects().to_vec())
}

/// Get the current project status
#[tauri::command]
pub async fn get_project_status(
    state: State<'_, SharedProjectManager>,
) -> Result<ProjectStatus, String> {
    let manager = state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;

    let (name, path) = if let Some(project) = manager.get_current_project() {
        (
            Some(project.config.project.name.clone()),
            project.mop_file.source_path().map(|p| p.to_path_buf()),
        )
    } else {
        (None, None)
    };

    Ok(ProjectStatus {
        is_open: manager.is_project_open(),
        is_modified: manager.is_modified(),
        name,
        path,
    })
}

/// Mark the current project as modified
///
/// This is typically called by the frontend when the user makes changes.
#[tauri::command]
pub async fn mark_project_modified(state: State<'_, SharedProjectManager>) -> Result<(), String> {
    let mut manager = state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;

    manager.mark_modified();
    Ok(())
}

/// Remove a project from the recent projects list
#[tauri::command]
pub async fn remove_from_recent(
    state: State<'_, SharedProjectManager>,
    path: PathBuf,
) -> Result<(), String> {
    let mut manager = state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;

    manager.remove_from_recent(&path);
    Ok(())
}

/// Clear all recent projects
#[tauri::command]
pub async fn clear_recent_projects(state: State<'_, SharedProjectManager>) -> Result<(), String> {
    let mut manager = state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;

    manager.clear_recent_projects();
    Ok(())
}

// ============================================================================
// Auto-Save Commands
// ============================================================================

/// Get the current auto-save settings from the open project
#[tauri::command]
pub async fn get_auto_save_settings(
    state: State<'_, SharedProjectManager>,
) -> Result<AutoSaveSettings, String> {
    let manager = state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;

    if let Some(project) = manager.get_current_project() {
        Ok(project.config.auto_save.clone())
    } else {
        // Return defaults if no project is open
        Ok(AutoSaveSettings::default())
    }
}

/// Enable or disable auto-save
#[tauri::command]
pub async fn set_auto_save_enabled(
    project_state: State<'_, SharedProjectManager>,
    auto_save_state: State<'_, SharedAutoSaveManager>,
    app_handle: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    // Update project config
    {
        let mut manager = project_state
            .lock()
            .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;
        if let Some(project) = manager.get_current_project_mut() {
            project.config.auto_save.enabled = enabled;
            project.is_modified = true;
        }
    }

    // Update auto-save manager
    let mut auto_save = auto_save_state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;
    auto_save.update_enabled(enabled);

    // Start or stop based on new state
    if enabled {
        let project_manager = (*project_state).clone();
        auto_save.start(project_manager, app_handle);
    } else {
        auto_save.stop();
    }

    Ok(())
}

/// Set the auto-save interval
#[tauri::command]
pub async fn set_auto_save_interval(
    project_state: State<'_, SharedProjectManager>,
    auto_save_state: State<'_, SharedAutoSaveManager>,
    app_handle: tauri::AppHandle,
    secs: u64,
) -> Result<(), String> {
    // Validate minimum interval
    if secs < 30 {
        return Err("Auto-save interval must be at least 30 seconds".to_string());
    }

    // Update project config
    {
        let mut manager = project_state
            .lock()
            .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;
        if let Some(project) = manager.get_current_project_mut() {
            project.config.auto_save.interval_secs = secs;
            project.is_modified = true;
        }
    }

    // Update auto-save manager and restart if running
    let mut auto_save = auto_save_state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;
    let project_manager = (*project_state).clone();
    auto_save.update_interval(secs, Some((project_manager, app_handle)));

    Ok(())
}

/// Set the number of backup files to keep
#[tauri::command]
pub async fn set_backup_count(
    project_state: State<'_, SharedProjectManager>,
    auto_save_state: State<'_, SharedAutoSaveManager>,
    count: u32,
) -> Result<(), String> {
    // Validate range
    if count == 0 || count > 10 {
        return Err("Backup count must be between 1 and 10".to_string());
    }

    // Update project config
    {
        let mut manager = project_state
            .lock()
            .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?;
        if let Some(project) = manager.get_current_project_mut() {
            project.config.auto_save.backup_count = count;
            project.is_modified = true;
        }
    }

    // Update auto-save manager
    auto_save_state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?
        .update_backup_count(count);

    Ok(())
}

/// Start the auto-save loop (called when project is opened)
#[tauri::command]
pub async fn start_auto_save(
    project_state: State<'_, SharedProjectManager>,
    auto_save_state: State<'_, SharedAutoSaveManager>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let project_manager = (*project_state).clone();
    auto_save_state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?
        .start(project_manager, app_handle);
    Ok(())
}

/// Stop the auto-save loop (called when project is closed)
#[tauri::command]
pub async fn stop_auto_save(
    auto_save_state: State<'_, SharedAutoSaveManager>,
) -> Result<(), String> {
    auto_save_state
        .lock()
        .map_err(|e| format!("Internal error: failed to acquire lock: {}", e))?
        .stop();
    Ok(())
}

// ============================================================================
// Recovery Commands
// ============================================================================

/// Get all available backup files for a project
///
/// Returns a list of backup files sorted by timestamp (most recent first).
#[tauri::command]
pub async fn get_available_backups(path: String) -> Result<Vec<BackupInfo>, String> {
    let path = PathBuf::from(path);

    if !path.exists() {
        return Err(format!("Project file not found: {}", path.display()));
    }

    Ok(find_backups(&path))
}

/// Validate the integrity of a .mop file
///
/// Returns detailed information about the file's structure and any issues found.
#[tauri::command]
pub async fn validate_project_integrity(path: String) -> Result<MopIntegrityResult, String> {
    let path = PathBuf::from(path);

    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }

    Ok(validate_mop_integrity(&path))
}

/// Recover a project from a backup file
///
/// Validates the backup integrity before copying to ensure it's valid.
#[tauri::command]
pub async fn recover_project_from_backup(
    backup_path: String,
    target_path: String,
) -> Result<(), String> {
    let backup_path = PathBuf::from(backup_path);
    let target_path = PathBuf::from(target_path);

    if !backup_path.exists() {
        return Err(format!("Backup file not found: {}", backup_path.display()));
    }

    recover_from_backup(&backup_path, &target_path)
        .map_err(|e| e.to_string())
}

/// Attempt to recover data from a corrupted project file
///
/// Extracts as much data as possible from the corrupted file to an output directory.
#[tauri::command]
pub async fn attempt_project_recovery(
    corrupted_path: String,
    output_dir: String,
) -> Result<RecoveryResult, String> {
    let corrupted_path = PathBuf::from(corrupted_path);
    let output_dir = PathBuf::from(output_dir);

    if !corrupted_path.exists() {
        return Err(format!("File not found: {}", corrupted_path.display()));
    }

    attempt_partial_recovery(&corrupted_path, &output_dir)
        .map_err(|e| e.to_string())
}
