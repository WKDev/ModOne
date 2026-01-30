//! Tauri command handlers for canvas/circuit operations
//!
//! This module provides IPC commands for saving, loading, and creating
//! circuit files in YAML format, as well as scope/oscilloscope functionality.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

use tauri::State;

use crate::canvas::scope::{ScopeDisplayData, ScopeEngine, ScopeSettings};

// ============================================================================
// Scope State Management
// ============================================================================

/// Managed state for scope engines
///
/// Stores multiple scope instances keyed by their block/scope ID.
/// Uses RwLock for thread-safe concurrent access.
pub struct ScopeState {
    /// Map of scope ID to scope engine
    scopes: RwLock<HashMap<String, ScopeEngine>>,
}

impl Default for ScopeState {
    fn default() -> Self {
        Self {
            scopes: RwLock::new(HashMap::new()),
        }
    }
}

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

// ============================================================================
// Scope Commands
// ============================================================================

/// Create a new scope engine instance.
///
/// # Arguments
/// * `scope_id` - Unique identifier for the scope (typically block ID)
/// * `channels` - Number of input channels (1-4 typical)
/// * `buffer_size` - Optional buffer size (default: 1000 samples)
/// * `sample_rate` - Optional sample rate in Hz (default: 1000)
#[tauri::command]
pub async fn scope_create(
    scope_id: String,
    channels: usize,
    buffer_size: Option<usize>,
    sample_rate: Option<u32>,
    state: State<'_, ScopeState>,
) -> Result<(), String> {
    let buffer = buffer_size.unwrap_or(1000);
    let rate = sample_rate.unwrap_or(1000);

    let mut scopes = state
        .scopes
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

    scopes.insert(scope_id.clone(), ScopeEngine::new(channels, buffer, rate));

    log::info!(
        "Created scope '{}' with {} channels, buffer={}, rate={}Hz",
        scope_id,
        channels,
        buffer,
        rate
    );
    Ok(())
}

/// Get display data from a scope for rendering.
///
/// # Arguments
/// * `scope_id` - The scope identifier
///
/// # Returns
/// ScopeDisplayData with channel points, statistics, and trigger info.
#[tauri::command]
pub async fn scope_get_data(
    scope_id: String,
    state: State<'_, ScopeState>,
) -> Result<ScopeDisplayData, String> {
    let scopes = state
        .scopes
        .read()
        .map_err(|e| format!("Failed to acquire read lock: {}", e))?;

    scopes
        .get(&scope_id)
        .map(|s| s.get_display_data())
        .ok_or_else(|| format!("Scope not found: {}", scope_id))
}

/// Update scope settings.
///
/// # Arguments
/// * `scope_id` - The scope identifier
/// * `settings` - New scope settings
#[tauri::command]
pub async fn scope_update_settings(
    scope_id: String,
    settings: ScopeSettings,
    state: State<'_, ScopeState>,
) -> Result<(), String> {
    let mut scopes = state
        .scopes
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

    scopes
        .get_mut(&scope_id)
        .map(|s| s.update_settings(settings))
        .ok_or_else(|| format!("Scope not found: {}", scope_id))?;

    log::debug!("Updated settings for scope '{}'", scope_id);
    Ok(())
}

/// Add a voltage sample to a scope channel.
///
/// # Arguments
/// * `scope_id` - The scope identifier
/// * `channel` - Channel index (0-based)
/// * `voltage` - Voltage value to add
#[tauri::command]
pub async fn scope_add_sample(
    scope_id: String,
    channel: usize,
    voltage: f32,
    state: State<'_, ScopeState>,
) -> Result<(), String> {
    let mut scopes = state
        .scopes
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

    scopes
        .get_mut(&scope_id)
        .map(|s| s.add_sample(channel, voltage))
        .ok_or_else(|| format!("Scope not found: {}", scope_id))
}

/// Add multiple voltage samples to a scope (batch operation).
///
/// # Arguments
/// * `scope_id` - The scope identifier
/// * `samples` - Vector of (channel, voltage) tuples
#[tauri::command]
pub async fn scope_add_samples(
    scope_id: String,
    samples: Vec<(usize, f32)>,
    state: State<'_, ScopeState>,
) -> Result<(), String> {
    let mut scopes = state
        .scopes
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

    let scope = scopes
        .get_mut(&scope_id)
        .ok_or_else(|| format!("Scope not found: {}", scope_id))?;

    for (channel, voltage) in samples {
        scope.add_sample(channel, voltage);
    }

    Ok(())
}

/// Control scope run/stop state.
///
/// # Arguments
/// * `scope_id` - The scope identifier
/// * `run` - true to run, false to stop
#[tauri::command]
pub async fn scope_run_stop(
    scope_id: String,
    run: bool,
    state: State<'_, ScopeState>,
) -> Result<(), String> {
    let mut scopes = state
        .scopes
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

    let scope = scopes
        .get_mut(&scope_id)
        .ok_or_else(|| format!("Scope not found: {}", scope_id))?;

    if run {
        scope.run();
        log::debug!("Scope '{}' started", scope_id);
    } else {
        scope.stop();
        log::debug!("Scope '{}' stopped", scope_id);
    }

    Ok(())
}

/// Reset a scope, clearing all buffers and trigger state.
///
/// # Arguments
/// * `scope_id` - The scope identifier
#[tauri::command]
pub async fn scope_reset(
    scope_id: String,
    state: State<'_, ScopeState>,
) -> Result<(), String> {
    let mut scopes = state
        .scopes
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

    scopes
        .get_mut(&scope_id)
        .map(|s| s.reset())
        .ok_or_else(|| format!("Scope not found: {}", scope_id))?;

    log::debug!("Reset scope '{}'", scope_id);
    Ok(())
}

/// Re-arm the trigger for a scope.
///
/// # Arguments
/// * `scope_id` - The scope identifier
#[tauri::command]
pub async fn scope_arm_trigger(
    scope_id: String,
    state: State<'_, ScopeState>,
) -> Result<(), String> {
    let mut scopes = state
        .scopes
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

    scopes
        .get_mut(&scope_id)
        .map(|s| s.arm_trigger())
        .ok_or_else(|| format!("Scope not found: {}", scope_id))?;

    log::debug!("Armed trigger for scope '{}'", scope_id);
    Ok(())
}

/// Delete a scope instance.
///
/// # Arguments
/// * `scope_id` - The scope identifier
#[tauri::command]
pub async fn scope_delete(
    scope_id: String,
    state: State<'_, ScopeState>,
) -> Result<(), String> {
    let mut scopes = state
        .scopes
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

    if scopes.remove(&scope_id).is_some() {
        log::info!("Deleted scope '{}'", scope_id);
        Ok(())
    } else {
        Err(format!("Scope not found: {}", scope_id))
    }
}

/// List all active scope IDs.
#[tauri::command]
pub async fn scope_list(
    state: State<'_, ScopeState>,
) -> Result<Vec<String>, String> {
    let scopes = state
        .scopes
        .read()
        .map_err(|e| format!("Failed to acquire read lock: {}", e))?;

    Ok(scopes.keys().cloned().collect())
}

/// Check if a scope exists.
///
/// # Arguments
/// * `scope_id` - The scope identifier
#[tauri::command]
pub async fn scope_exists(
    scope_id: String,
    state: State<'_, ScopeState>,
) -> Result<bool, String> {
    let scopes = state
        .scopes
        .read()
        .map_err(|e| format!("Failed to acquire read lock: {}", e))?;

    Ok(scopes.contains_key(&scope_id))
}
