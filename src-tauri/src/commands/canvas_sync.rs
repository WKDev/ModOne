//! Canvas Sync Tauri command handlers
//!
//! This module provides Tauri commands for synchronizing OneSim DeviceMemory
//! with OneCanvas circuit simulation (PLC block mappings).

use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::sim::{
    CanvasSync, DeviceMemory, PlcBlockMapping, PlcBlockType, PlcInputChange,
};

// ============================================================================
// Managed State
// ============================================================================

/// Managed state for Canvas Sync functionality
pub struct CanvasSyncState {
    /// Canvas sync instance
    pub sync: Arc<CanvasSync>,
    /// Shared simulation memory
    pub sim_memory: Arc<DeviceMemory>,
    /// Whether sync is enabled
    pub enabled: RwLock<bool>,
}

impl Default for CanvasSyncState {
    fn default() -> Self {
        let sim_memory = Arc::new(DeviceMemory::new());
        let sync = Arc::new(CanvasSync::new(Arc::clone(&sim_memory)));
        Self {
            sync,
            sim_memory,
            enabled: RwLock::new(false),
        }
    }
}

impl CanvasSyncState {
    /// Create with existing simulation memory
    pub fn with_memory(sim_memory: Arc<DeviceMemory>) -> Self {
        let sync = Arc::new(CanvasSync::new(Arc::clone(&sim_memory)));
        Self {
            sync,
            sim_memory,
            enabled: RwLock::new(false),
        }
    }
}

// ============================================================================
// API Types
// ============================================================================

/// Mapping configuration from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlcBlockMappingConfig {
    /// Canvas block unique ID
    pub block_id: String,
    /// Type of PLC block: "plcOut" or "plcIn"
    pub block_type: String,
    /// Device type (M, P, K, etc.)
    pub device_type: String,
    /// Device address number
    pub address: u16,
    /// For contacts: normally open (true) or normally closed (false)
    #[serde(default = "default_true")]
    pub normally_open: bool,
    /// Whether to invert the output state
    #[serde(default)]
    pub inverted: bool,
    /// Optional label for display
    pub label: Option<String>,
}

fn default_true() -> bool {
    true
}

impl From<PlcBlockMappingConfig> for PlcBlockMapping {
    fn from(config: PlcBlockMappingConfig) -> Self {
        let block_type = match config.block_type.to_lowercase().as_str() {
            "plcin" | "plc_in" | "input" => PlcBlockType::PlcIn,
            _ => PlcBlockType::PlcOut,
        };

        PlcBlockMapping {
            block_id: config.block_id,
            block_type,
            device_type: config.device_type,
            address: config.address,
            normally_open: config.normally_open,
            inverted: config.inverted,
            label: config.label,
        }
    }
}

/// Canvas sync status information
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasSyncStatus {
    /// Whether sync is enabled
    pub enabled: bool,
    /// Number of registered mappings
    pub mapping_count: usize,
    /// Number of PlcOut mappings
    pub plc_out_count: usize,
    /// Number of PlcIn mappings
    pub plc_in_count: usize,
    /// Number of output updates sent
    pub output_update_count: u64,
    /// Number of input changes processed
    pub input_change_count: u64,
}

/// Mapping summary for frontend display
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MappingSummary {
    /// Canvas block ID
    pub block_id: String,
    /// Block type: "plcOut" or "plcIn"
    pub block_type: String,
    /// Device address string (e.g., "M0", "P100")
    pub device_address: String,
    /// Optional label
    pub label: Option<String>,
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Initialize canvas sync with app handle for event emission
#[tauri::command]
pub fn canvas_sync_init(
    app_handle: tauri::AppHandle,
    state: State<'_, CanvasSyncState>,
) -> Result<(), String> {
    state.sync.set_app_handle(app_handle);
    *state.enabled.write() = true;
    log::info!("Canvas sync initialized");
    Ok(())
}

/// Shutdown canvas sync
#[tauri::command]
pub fn canvas_sync_shutdown(state: State<'_, CanvasSyncState>) -> Result<(), String> {
    *state.enabled.write() = false;
    state.sync.clear_app_handle();
    state.sync.clear_mappings();
    state.sync.reset_stats();
    log::info!("Canvas sync shutdown");
    Ok(())
}

/// Get canvas sync status
#[tauri::command]
pub fn canvas_sync_get_status(state: State<'_, CanvasSyncState>) -> CanvasSyncStatus {
    let mappings = state.sync.get_mappings();
    let plc_out_count = mappings
        .iter()
        .filter(|m| m.block_type == PlcBlockType::PlcOut)
        .count();
    let plc_in_count = mappings
        .iter()
        .filter(|m| m.block_type == PlcBlockType::PlcIn)
        .count();

    CanvasSyncStatus {
        enabled: *state.enabled.read(),
        mapping_count: mappings.len(),
        plc_out_count,
        plc_in_count,
        output_update_count: state.sync.output_update_count(),
        input_change_count: state.sync.input_change_count(),
    }
}

/// Register a single PLC block mapping
#[tauri::command]
pub fn canvas_sync_register_mapping(
    mapping: PlcBlockMappingConfig,
    state: State<'_, CanvasSyncState>,
) -> Result<(), String> {
    let plc_mapping: PlcBlockMapping = mapping.into();
    log::debug!(
        "Registering PLC block mapping: {} -> {}{}",
        plc_mapping.block_id,
        plc_mapping.device_type,
        plc_mapping.address
    );
    state.sync.register_mapping(plc_mapping);
    Ok(())
}

/// Register multiple PLC block mappings at once
#[tauri::command]
pub fn canvas_sync_register_mappings(
    mappings: Vec<PlcBlockMappingConfig>,
    state: State<'_, CanvasSyncState>,
) -> Result<usize, String> {
    let count = mappings.len();
    let plc_mappings: Vec<PlcBlockMapping> = mappings.into_iter().map(Into::into).collect();
    state.sync.register_mappings(plc_mappings);
    log::info!("Registered {} PLC block mappings", count);
    Ok(count)
}

/// Remove a mapping by block ID
#[tauri::command]
pub fn canvas_sync_remove_mapping(
    block_id: String,
    state: State<'_, CanvasSyncState>,
) -> Result<(), String> {
    state.sync.remove_mapping(&block_id);
    log::debug!("Removed PLC block mapping: {}", block_id);
    Ok(())
}

/// Clear all mappings
#[tauri::command]
pub fn canvas_sync_clear_mappings(state: State<'_, CanvasSyncState>) -> Result<(), String> {
    state.sync.clear_mappings();
    log::info!("Cleared all PLC block mappings");
    Ok(())
}

/// Get all registered mappings
#[tauri::command]
pub fn canvas_sync_get_mappings(state: State<'_, CanvasSyncState>) -> Vec<MappingSummary> {
    state
        .sync
        .get_mappings()
        .into_iter()
        .map(|m| MappingSummary {
            block_id: m.block_id,
            block_type: match m.block_type {
                PlcBlockType::PlcOut => "plcOut".to_string(),
                PlcBlockType::PlcIn => "plcIn".to_string(),
            },
            device_address: format!("{}{}", m.device_type, m.address),
            label: m.label,
        })
        .collect()
}

/// Manually trigger PLC output update (normally called by simulation loop)
#[tauri::command]
pub fn canvas_sync_update_outputs(state: State<'_, CanvasSyncState>) -> Result<usize, String> {
    if !*state.enabled.read() {
        return Ok(0);
    }

    state
        .sync
        .update_plc_outputs()
        .map_err(|e| format!("Failed to update PLC outputs: {}", e))
}

/// Force update all PLC outputs (ignores change detection)
#[tauri::command]
pub fn canvas_sync_force_update_outputs(state: State<'_, CanvasSyncState>) -> Result<usize, String> {
    if !*state.enabled.read() {
        return Ok(0);
    }

    state
        .sync
        .force_update_plc_outputs()
        .map_err(|e| format!("Failed to force update PLC outputs: {}", e))
}

/// Handle PLC input change from canvas (circuit state affects device memory)
#[tauri::command]
pub fn canvas_sync_handle_input(
    block_id: String,
    state_value: bool,
    state: State<'_, CanvasSyncState>,
) -> Result<(), String> {
    if !*state.enabled.read() {
        return Err("Canvas sync is not enabled".to_string());
    }

    state
        .sync
        .handle_plc_input_change(&block_id, state_value)
        .map_err(|e| format!("Failed to handle PLC input: {}", e))
}

/// Handle multiple PLC input changes at once
#[tauri::command]
pub fn canvas_sync_handle_inputs(
    changes: Vec<PlcInputChange>,
    state: State<'_, CanvasSyncState>,
) -> Result<usize, String> {
    if !*state.enabled.read() {
        return Err("Canvas sync is not enabled".to_string());
    }

    state
        .sync
        .handle_plc_input_changes(&changes)
        .map_err(|e| format!("Failed to handle PLC inputs: {}", e))
}

/// Reset sync statistics
#[tauri::command]
pub fn canvas_sync_reset_stats(state: State<'_, CanvasSyncState>) -> Result<(), String> {
    state.sync.reset_stats();
    Ok(())
}

/// Check if any output states have changed (useful for polling)
#[tauri::command]
pub fn canvas_sync_has_changes(state: State<'_, CanvasSyncState>) -> bool {
    if !*state.enabled.read() {
        return false;
    }
    state.sync.has_output_changes()
}

/// Get list of block IDs with pending state changes
#[tauri::command]
pub fn canvas_sync_get_changed_blocks(state: State<'_, CanvasSyncState>) -> Vec<String> {
    if !*state.enabled.read() {
        return vec![];
    }
    state.sync.get_changed_blocks()
}
