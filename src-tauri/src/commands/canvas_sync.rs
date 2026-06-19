//! Canvas Sync Tauri command handlers
//!
//! This module provides Tauri commands for synchronizing the OneSim canonical runtime
//! with OneCanvas circuit simulation (PLC block mappings).

use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::plc_runtime::{resolve_vendor_profile, VendorAddress};
use crate::project::{PlcSettings, SharedProjectManager};
use crate::sim::{
    tag_registry::SharedTagRegistry, CanonicalRuntimeFacade, CanvasSync, PlcBlockMapping,
    PlcBlockType, PlcInputChange, RuntimeBinding,
};

// ============================================================================
// Managed State
// ============================================================================

/// Managed state for Canvas Sync functionality
pub struct CanvasSyncState {
    /// Canvas sync instance
    pub sync: Arc<CanvasSync>,
    /// Shared simulation runtime
    pub sim_runtime: Arc<CanonicalRuntimeFacade>,
    /// Whether sync is enabled
    pub enabled: RwLock<bool>,
    pub tag_registry: SharedTagRegistry,
}

impl Default for CanvasSyncState {
    fn default() -> Self {
        let sim_runtime = Arc::new(CanonicalRuntimeFacade::new());
        let tag_registry = Arc::new(crate::sim::tag_registry::TagRegistry::new());
        let sync = Arc::new(CanvasSync::new(
            Arc::clone(&sim_runtime),
            Arc::clone(&tag_registry),
        ));
        Self {
            sync,
            sim_runtime,
            enabled: RwLock::new(false),
            tag_registry,
        }
    }
}

impl CanvasSyncState {
    /// Create with existing simulation memory
    pub fn with_runtime(
        sim_runtime: Arc<CanonicalRuntimeFacade>,
        tag_registry: SharedTagRegistry,
    ) -> Self {
        let sync = Arc::new(CanvasSync::new(
            Arc::clone(&sim_runtime),
            Arc::clone(&tag_registry),
        ));
        Self {
            sync,
            sim_runtime,
            enabled: RwLock::new(false),
            tag_registry,
        }
    }

    /// Get canvas sync instance for engine wiring
    pub fn canvas_sync(&self) -> Option<Arc<CanvasSync>> {
        Some(Arc::clone(&self.sync))
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
    /// Canonical binding (preferred over legacy deviceType/address fields).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub binding: Option<RuntimeBinding>,
    /// Device type (M, P, K, etc.)
    #[serde(default)]
    pub device_type: String,
    /// Device address number
    #[serde(default)]
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

fn active_plc_settings(
    project_state: &State<'_, SharedProjectManager>,
) -> Result<PlcSettings, String> {
    let manager = project_state
        .lock()
        .map_err(|e| format!("Failed to acquire project manager lock: {}", e))?;

    Ok(manager
        .get_current_project()
        .map(|project| project.config.plc.clone())
        .unwrap_or_default())
}

fn resolve_binding(
    project_state: &State<'_, SharedProjectManager>,
    config: &PlcBlockMappingConfig,
) -> Result<(RuntimeBinding, String), String> {
    if let Some(binding) = config.binding.clone() {
        let display = if !config.device_type.is_empty() {
            format!("{}{}", config.device_type.to_uppercase(), config.address)
        } else {
            format!("{binding:?}")
        };
        return Ok((binding, display));
    }

    let plc_settings = active_plc_settings(project_state)?;
    let profile = resolve_vendor_profile(&plc_settings).map_err(|e| e.to_string())?;
    let vendor_address =
        VendorAddress::new(config.device_type.to_uppercase(), config.address as u32);
    profile
        .validate_address(&vendor_address)
        .map_err(|e| e.to_string())?;
    let canonical = profile
        .to_canonical(&vendor_address)
        .map_err(|e| e.to_string())?;
    let display = profile
        .format_address(&vendor_address)
        .unwrap_or_else(|_| format!("{}{}", config.device_type.to_uppercase(), config.address));
    Ok((RuntimeBinding::canonical(canonical), display))
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
    /// Canonical or tag binding
    pub binding: RuntimeBinding,
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
    project_state: State<'_, SharedProjectManager>,
) -> Result<(), String> {
    let block_type = match mapping.block_type.to_lowercase().as_str() {
        "plcin" | "plc_in" | "input" => PlcBlockType::PlcIn,
        _ => PlcBlockType::PlcOut,
    };
    let (binding, display_address) = resolve_binding(&project_state, &mapping)?;
    let plc_mapping = PlcBlockMapping {
        block_id: mapping.block_id,
        block_type,
        binding,
        display_address,
        normally_open: mapping.normally_open,
        inverted: mapping.inverted,
        label: mapping.label,
    };
    log::debug!(
        "Registering PLC block mapping: {} -> {}",
        plc_mapping.block_id,
        plc_mapping.display_address
    );
    state.sync.register_mapping(plc_mapping);
    Ok(())
}

/// Register multiple PLC block mappings at once
#[tauri::command]
pub fn canvas_sync_register_mappings(
    mappings: Vec<PlcBlockMappingConfig>,
    state: State<'_, CanvasSyncState>,
    project_state: State<'_, SharedProjectManager>,
) -> Result<usize, String> {
    let count = mappings.len();
    for mapping in mappings {
        canvas_sync_register_mapping(mapping, state.clone(), project_state.clone())?;
    }
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
            binding: m.binding,
            device_address: m.display_address,
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
pub fn canvas_sync_force_update_outputs(
    state: State<'_, CanvasSyncState>,
) -> Result<usize, String> {
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
