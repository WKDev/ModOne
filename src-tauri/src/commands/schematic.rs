//! Tauri command handlers for multi-page schematic operations
//!
//! This module provides IPC commands for saving and loading
//! multi-page schematic files with atomic save support.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

// ============================================================================
// Types
// ============================================================================

/// Page data for save operations
#[derive(Debug, Deserialize)]
pub struct PageSaveData {
    /// Page filename (e.g., "page_1.yaml")
    pub filename: String,
    /// Page content (JSON/YAML string)
    pub content: String,
}

/// Result from load operations
#[derive(Debug, Serialize)]
pub struct SchematicLoadResult {
    /// Manifest file content
    pub manifest: String,
    /// Page files with filename and content
    pub pages: Vec<PageLoadData>,
}

/// Page data for load operations
#[derive(Debug, Serialize)]
pub struct PageLoadData {
    /// Page filename
    pub filename: String,
    /// Page content
    pub content: String,
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Save a multi-page schematic with atomic write support.
///
/// Uses temp directory + rename strategy for atomicity:
/// 1. Write all files to a temp sibling directory
/// 2. Rename existing dir to backup
/// 3. Rename temp dir to target
/// 4. Delete backup
///
/// If any step fails after backup, attempts to restore from backup.
///
/// # Arguments
/// * `path` - Base directory path for the schematic (e.g., "schematics/my_schematic")
/// * `manifest` - Manifest file content (JSON string)
/// * `pages` - Array of page data with filename and content
#[tauri::command]
pub async fn schematic_save(
    path: String,
    manifest: String,
    pages: Vec<PageSaveData>,
) -> Result<(), String> {
    let base = PathBuf::from(&path);
    let parent = base
        .parent()
        .ok_or_else(|| "Invalid schematic path: no parent directory".to_string())?;
    let dir_name = base
        .file_name()
        .ok_or_else(|| "Invalid schematic path: no directory name".to_string())?
        .to_string_lossy()
        .to_string();

    // Create temp directory as sibling of base (NOT inside base)
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let tmp_dir = parent.join(format!(".tmp_{}_{}", dir_name, timestamp));

    // Ensure parent directory exists
    fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directory: {}", e))?;

    // Step 1: Write all files to temp directory
    fs::create_dir_all(&tmp_dir).map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Write manifest
    if let Err(e) = fs::write(tmp_dir.join("manifest.yaml"), &manifest) {
        let _ = fs::remove_dir_all(&tmp_dir);
        return Err(format!("Failed to write manifest: {}", e));
    }

    // Write page files
    for page in &pages {
        if let Err(e) = fs::write(tmp_dir.join(&page.filename), &page.content) {
            let _ = fs::remove_dir_all(&tmp_dir);
            return Err(format!("Failed to write page {}: {}", page.filename, e));
        }
    }

    // Step 2: Atomic swap
    let backup_dir = parent.join(format!(".backup_{}", dir_name));

    // Remove old backup if exists
    if backup_dir.exists() {
        let _ = fs::remove_dir_all(&backup_dir);
    }

    // Move existing to backup
    if base.exists() {
        if let Err(e) = fs::rename(&base, &backup_dir) {
            let _ = fs::remove_dir_all(&tmp_dir);
            return Err(format!("Failed to backup existing schematic: {}", e));
        }
    }

    // Move temp to target
    if let Err(e) = fs::rename(&tmp_dir, &base) {
        // Try to restore from backup
        if backup_dir.exists() {
            let _ = fs::rename(&backup_dir, &base);
        }
        return Err(format!("Failed to finalize schematic save: {}", e));
    }

    // Cleanup backup
    if backup_dir.exists() {
        let _ = fs::remove_dir_all(&backup_dir);
    }

    log::info!("Schematic saved to: {}", base.display());
    Ok(())
}

/// Load a multi-page schematic from a directory.
///
/// Reads the manifest file and all page files referenced in it.
///
/// # Arguments
/// * `path` - Base directory path for the schematic
///
/// # Returns
/// SchematicLoadResult with manifest and page contents
#[tauri::command]
pub async fn schematic_load(path: String) -> Result<SchematicLoadResult, String> {
    let base = PathBuf::from(&path);

    if !base.exists() {
        return Err(format!("Schematic directory not found: {}", base.display()));
    }

    if !base.is_dir() {
        return Err(format!("Schematic path is not a directory: {}", base.display()));
    }

    // Read manifest
    let manifest_path = base.join("manifest.yaml");
    if !manifest_path.exists() {
        return Err(format!("Manifest not found: {}", manifest_path.display()));
    }

    let manifest =
        fs::read_to_string(&manifest_path).map_err(|e| format!("Failed to read manifest: {}", e))?;

    // Read all page files (page_*.yaml)
    let mut pages = Vec::new();
    let entries =
        fs::read_dir(&base).map_err(|e| format!("Failed to read schematic directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let file_name = entry.file_name().to_string_lossy().to_string();

        if file_name.starts_with("page_") && file_name.ends_with(".yaml") {
            let content = fs::read_to_string(entry.path())
                .map_err(|e| format!("Failed to read page {}: {}", file_name, e))?;

            pages.push(PageLoadData {
                filename: file_name,
                content,
            });
        }
    }

    // Sort pages by filename to ensure correct order
    pages.sort_by(|a, b| a.filename.cmp(&b.filename));

    log::info!(
        "Schematic loaded from: {} ({} pages)",
        base.display(),
        pages.len()
    );

    Ok(SchematicLoadResult { manifest, pages })
}

/// List all schematics in a directory.
///
/// # Arguments
/// * `base_path` - Path to the schematics directory
///
/// # Returns
/// List of schematic directory names
#[tauri::command]
pub async fn schematic_list(base_path: String) -> Result<Vec<String>, String> {
    let base = PathBuf::from(&base_path);

    if !base.exists() {
        return Ok(Vec::new());
    }

    let mut schematics = Vec::new();
    let entries =
        fs::read_dir(&base).map_err(|e| format!("Failed to read schematics directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            // Skip temp and backup directories
            if !name.starts_with('.') && path.join("manifest.yaml").exists() {
                schematics.push(name);
            }
        }
    }

    schematics.sort();
    Ok(schematics)
}

/// Check if a schematic exists.
///
/// # Arguments
/// * `path` - Path to the schematic directory
#[tauri::command]
pub async fn schematic_exists(path: String) -> Result<bool, String> {
    let base = PathBuf::from(&path);
    Ok(base.exists() && base.is_dir() && base.join("manifest.yaml").exists())
}

/// Delete a schematic directory.
///
/// # Arguments
/// * `path` - Path to the schematic directory
#[tauri::command]
pub async fn schematic_delete(path: String) -> Result<(), String> {
    let base = PathBuf::from(&path);

    if !base.exists() {
        return Err(format!("Schematic not found: {}", base.display()));
    }

    fs::remove_dir_all(&base).map_err(|e| format!("Failed to delete schematic: {}", e))?;

    log::info!("Schematic deleted: {}", base.display());
    Ok(())
}
