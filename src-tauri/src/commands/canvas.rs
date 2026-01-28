//! Tauri command handlers for canvas/circuit operations
//!
//! This module provides IPC commands for saving, loading, and creating
//! circuit files in YAML format.

use std::fs;
use std::path::{Path, PathBuf};

// ============================================================================
// Default Circuit Template
// ============================================================================

/// Create a default circuit YAML content with the given name.
fn create_default_circuit(name: &str) -> String {
    let now = chrono::Utc::now().to_rfc3339();
    format!(
        r#"version: "1.0"
metadata:
  name: "{name}"
  description: ""
  tags: []
  created: "{now}"
  modified: "{now}"
components: []
wires: []
"#
    )
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Save circuit content to a file.
///
/// # Arguments
/// * `path` - Full path to the circuit file (.yaml)
/// * `content` - YAML content to write
#[tauri::command]
pub async fn canvas_save_circuit(path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(&path);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Write content to file
    fs::write(&path, content).map_err(|e| format!("Failed to save circuit: {}", e))?;

    log::info!("Circuit saved to: {}", path.display());
    Ok(())
}

/// Load circuit content from a file.
///
/// # Arguments
/// * `path` - Full path to the circuit file (.yaml)
///
/// # Returns
/// The YAML content as a string.
#[tauri::command]
pub async fn canvas_load_circuit(path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);

    if !path.exists() {
        return Err(format!("Circuit file not found: {}", path.display()));
    }

    let content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read circuit: {}", e))?;

    log::info!("Circuit loaded from: {}", path.display());
    Ok(content)
}

/// Create a new circuit file with default content.
///
/// # Arguments
/// * `name` - Name for the new circuit
/// * `path` - Full path where to save the circuit file (.yaml)
#[tauri::command]
pub async fn canvas_create_circuit(name: String, path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);

    // Check if file already exists
    if path.exists() {
        return Err(format!("Circuit file already exists: {}", path.display()));
    }

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Create default circuit content
    let content = create_default_circuit(&name);

    // Write to file
    fs::write(&path, content).map_err(|e| format!("Failed to create circuit: {}", e))?;

    log::info!("New circuit created at: {}", path.display());
    Ok(())
}

/// List all circuit files in a directory.
///
/// # Arguments
/// * `dir` - Directory path to search for .yaml circuit files
///
/// # Returns
/// List of circuit file paths found.
#[tauri::command]
pub async fn canvas_list_circuits(dir: String) -> Result<Vec<String>, String> {
    let dir_path = PathBuf::from(&dir);

    if !dir_path.exists() {
        return Ok(vec![]);
    }

    if !dir_path.is_dir() {
        return Err(format!("Not a directory: {}", dir_path.display()));
    }

    let mut circuits = Vec::new();

    let entries = fs::read_dir(&dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "yaml" || ext == "yml" {
                    if let Some(path_str) = path.to_str() {
                        circuits.push(path_str.to_string());
                    }
                }
            }
        }
    }

    // Sort by filename
    circuits.sort();

    Ok(circuits)
}

/// Delete a circuit file.
///
/// # Arguments
/// * `path` - Full path to the circuit file to delete
#[tauri::command]
pub async fn canvas_delete_circuit(path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);

    if !path.exists() {
        return Err(format!("Circuit file not found: {}", path.display()));
    }

    fs::remove_file(&path).map_err(|e| format!("Failed to delete circuit: {}", e))?;

    log::info!("Circuit deleted: {}", path.display());
    Ok(())
}

/// Check if a circuit file exists.
///
/// # Arguments
/// * `path` - Full path to check
///
/// # Returns
/// true if file exists, false otherwise.
#[tauri::command]
pub async fn canvas_circuit_exists(path: String) -> bool {
    Path::new(&path).exists()
}
