//! Canvas Sync Module
//!
//! Provides synchronization between the canonical simulator runtime and OneCanvas circuit
//! simulation, mapping plc_out block states to Coils and plc_in block states
//! to Discrete Inputs.

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use thiserror::Error;

use super::memory::CanonicalRuntimeFacade;
use super::tag_registry::SharedTagRegistry;
use super::types::RuntimeBinding;

// ============================================================================
// Error Types
// ============================================================================

/// Canvas sync operation errors
#[derive(Debug, Error)]
pub enum CanvasSyncError {
    /// Error accessing device memory
    #[error("Runtime memory error: {0}")]
    RuntimeMemoryError(String),

    /// Mapping not found
    #[error("Mapping not found for block: {0}")]
    MappingNotFound(String),

    /// Invalid device address
    #[error("Invalid device address: {0}")]
    InvalidAddress(String),

    /// Event emission failed
    #[error("Failed to emit event: {0}")]
    EventEmissionFailed(String),
}

/// Result type for canvas sync operations
pub type CanvasSyncResult<T> = Result<T, CanvasSyncError>;

// ============================================================================
// PLC Block Types
// ============================================================================

/// Type of PLC block in the circuit
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PlcBlockType {
    /// PLC Output block - reads Coil/Output state and controls circuit switch
    PlcOut,
    /// PLC Input block - circuit state writes to Discrete Input
    PlcIn,
}

/// Mapping between a canvas PLC block and a device address
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlcBlockMapping {
    /// Canvas block unique ID
    pub block_id: String,
    /// Type of PLC block
    pub block_type: PlcBlockType,
    /// Canonical or tag binding for this PLC block.
    pub binding: RuntimeBinding,
    /// Human-readable display address.
    pub display_address: String,
    /// For contacts: normally open (true) or normally closed (false)
    #[serde(default = "default_normally_open")]
    pub normally_open: bool,
    /// Whether to invert the output state
    #[serde(default)]
    pub inverted: bool,
    /// Optional label for display
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

fn default_normally_open() -> bool {
    true
}

impl PlcBlockMapping {
    /// Create a new PLC output mapping
    pub fn new_plc_out(
        block_id: impl Into<String>,
        binding: RuntimeBinding,
        display_address: impl Into<String>,
    ) -> Self {
        Self {
            block_id: block_id.into(),
            block_type: PlcBlockType::PlcOut,
            binding,
            display_address: display_address.into(),
            normally_open: true,
            inverted: false,
            label: None,
        }
    }

    /// Create a new PLC input mapping
    pub fn new_plc_in(
        block_id: impl Into<String>,
        binding: RuntimeBinding,
        display_address: impl Into<String>,
    ) -> Self {
        Self {
            block_id: block_id.into(),
            block_type: PlcBlockType::PlcIn,
            binding,
            display_address: display_address.into(),
            normally_open: true,
            inverted: false,
            label: None,
        }
    }

    /// Set normally_open flag
    pub fn with_normally_open(mut self, normally_open: bool) -> Self {
        self.normally_open = normally_open;
        self
    }

    /// Set inverted flag
    pub fn with_inverted(mut self, inverted: bool) -> Self {
        self.inverted = inverted;
        self
    }

    /// Set label
    pub fn with_label(mut self, label: impl Into<String>) -> Self {
        self.label = Some(label.into());
        self
    }
}

// ============================================================================
// Event Payloads
// ============================================================================

/// Single PLC output update for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlcOutputUpdate {
    /// Canvas block ID
    pub block_id: String,
    /// Current state (true = ON/closed, false = OFF/open)
    pub state: bool,
    /// Optional current value for display
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

/// Batch PLC output updates event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlcOutputsEvent {
    /// List of output updates
    pub updates: Vec<PlcOutputUpdate>,
    /// Timestamp (epoch ms)
    pub timestamp: u64,
}

/// PLC input change from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlcInputChange {
    /// Canvas block ID
    pub block_id: String,
    /// Circuit state (true = energized, false = not energized)
    pub state: bool,
}

// ============================================================================
// Canvas Sync Structure
// ============================================================================

/// Canvas synchronization manager
///
/// Handles bidirectional state sync between the canonical runtime and
/// OneCanvas circuit simulation blocks.
pub struct CanvasSync {
    /// Simulation memory reference
    runtime: Arc<CanonicalRuntimeFacade>,
    /// Shared semantic tag registry
    tag_registry: SharedTagRegistry,
    /// Tauri app handle for event emission
    app_handle: RwLock<Option<tauri::AppHandle>>,
    /// Registered PLC block mappings
    plc_block_mappings: RwLock<Vec<PlcBlockMapping>>,
    /// Previous output states for change detection
    previous_states: RwLock<HashMap<String, bool>>,
    /// Statistics: number of output updates sent
    output_update_count: RwLock<u64>,
    /// Statistics: number of input changes processed
    input_change_count: RwLock<u64>,
}

impl CanvasSync {
    /// Create a new CanvasSync instance
    pub fn new(runtime: Arc<CanonicalRuntimeFacade>, tag_registry: SharedTagRegistry) -> Self {
        Self {
            runtime,
            tag_registry,
            app_handle: RwLock::new(None),
            plc_block_mappings: RwLock::new(Vec::new()),
            previous_states: RwLock::new(HashMap::new()),
            output_update_count: RwLock::new(0),
            input_change_count: RwLock::new(0),
        }
    }

    /// Set the Tauri app handle for event emission
    pub fn set_app_handle(&self, handle: tauri::AppHandle) {
        *self.app_handle.write() = Some(handle);
    }

    /// Clear the app handle
    pub fn clear_app_handle(&self) {
        *self.app_handle.write() = None;
    }

    // ========================================================================
    // Mapping Management
    // ========================================================================

    /// Register a PLC block mapping
    pub fn register_mapping(&self, mapping: PlcBlockMapping) {
        let mut mappings = self.plc_block_mappings.write();

        // Remove any existing mapping for this block_id
        mappings.retain(|m| m.block_id != mapping.block_id);

        mappings.push(mapping);
    }

    /// Register multiple mappings at once
    pub fn register_mappings(&self, mappings: Vec<PlcBlockMapping>) {
        for mapping in mappings {
            self.register_mapping(mapping);
        }
    }

    /// Remove a mapping by block_id
    pub fn remove_mapping(&self, block_id: &str) {
        let mut mappings = self.plc_block_mappings.write();
        mappings.retain(|m| m.block_id != block_id);

        // Also remove from previous states
        self.previous_states.write().remove(block_id);
    }

    /// Clear all mappings
    pub fn clear_mappings(&self) {
        self.plc_block_mappings.write().clear();
        self.previous_states.write().clear();
    }

    /// Get all current mappings
    pub fn get_mappings(&self) -> Vec<PlcBlockMapping> {
        self.plc_block_mappings.read().clone()
    }

    /// Get mapping by block_id
    pub fn get_mapping(&self, block_id: &str) -> Option<PlcBlockMapping> {
        self.plc_block_mappings
            .read()
            .iter()
            .find(|m| m.block_id == block_id)
            .cloned()
    }

    /// Get number of registered mappings
    pub fn mapping_count(&self) -> usize {
        self.plc_block_mappings.read().len()
    }

    // ========================================================================
    // PlcOut Handling (Runtime → OneCanvas)
    // ========================================================================

    /// Update all PLC output blocks with current device states
    ///
    /// Called after each scan cycle to sync coil states to canvas blocks.
    /// Only emits updates for blocks whose state has changed.
    pub fn update_plc_outputs(&self) -> CanvasSyncResult<usize> {
        let mappings = self.plc_block_mappings.read();
        let mut updates = Vec::new();
        let mut previous = self.previous_states.write();

        for mapping in mappings.iter() {
            if mapping.block_type != PlcBlockType::PlcOut {
                continue;
            }

            // Read device state from memory
            let state = self.read_device_state(mapping)?;

            // Apply normally_open and inverted logic
            let output_state = self.apply_output_logic(state, mapping);

            // Check if state changed
            let prev_state = previous.get(&mapping.block_id).copied();
            if prev_state != Some(output_state) {
                updates.push(PlcOutputUpdate {
                    block_id: mapping.block_id.clone(),
                    state: output_state,
                    value: Some(if output_state { "ON" } else { "OFF" }.to_string()),
                });
                previous.insert(mapping.block_id.clone(), output_state);
            }
        }

        let update_count = updates.len();

        // Emit event to frontend if there are updates
        if !updates.is_empty() {
            self.emit_plc_outputs(updates)?;
            *self.output_update_count.write() += update_count as u64;
        }

        Ok(update_count)
    }

    /// Force update all PLC outputs (ignores change detection)
    pub fn force_update_plc_outputs(&self) -> CanvasSyncResult<usize> {
        // Clear previous states to force all updates
        self.previous_states.write().clear();
        self.update_plc_outputs()
    }

    /// Read device state from memory based on mapping
    fn read_device_state(&self, mapping: &PlcBlockMapping) -> CanvasSyncResult<bool> {
        match &mapping.binding {
            RuntimeBinding::Canonical { address } => self
                .runtime
                .read_bool(*address)
                .map_err(|e| CanvasSyncError::RuntimeMemoryError(e.to_string())),
            RuntimeBinding::Tag { tag_id } => {
                let tag = self
                    .tag_registry
                    .resolve(tag_id)
                    .map_err(|e| CanvasSyncError::InvalidAddress(e.to_string()))?;
                self.runtime
                    .read_bool(tag.canonical_address)
                    .map_err(|e| CanvasSyncError::RuntimeMemoryError(e.to_string()))
            }
        }
    }

    /// Apply normally_open and inverted logic to output state
    fn apply_output_logic(&self, state: bool, mapping: &PlcBlockMapping) -> bool {
        let mut output = state;

        // For normally closed contacts, invert the state
        if !mapping.normally_open {
            output = !output;
        }

        // Apply additional inversion if configured
        if mapping.inverted {
            output = !output;
        }

        output
    }

    /// Emit PLC outputs event to frontend
    fn emit_plc_outputs(&self, updates: Vec<PlcOutputUpdate>) -> CanvasSyncResult<()> {
        let handle = self.app_handle.read();

        if let Some(ref app_handle) = *handle {
            let event = PlcOutputsEvent {
                updates,
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
            };

            app_handle
                .emit("sim:plc-outputs", &event)
                .map_err(|e| CanvasSyncError::EventEmissionFailed(e.to_string()))?;
        }

        Ok(())
    }

    // ========================================================================
    // PlcIn Handling (OneCanvas → Runtime)
    // ========================================================================

    /// Handle PLC input change from canvas
    ///
    /// Called when a circuit's state changes affecting a plc_in block.
    /// Writes the state to the corresponding device in the canonical runtime.
    pub fn handle_plc_input_change(&self, block_id: &str, circuit_state: bool) -> CanvasSyncResult<()> {
        let mapping = self.get_mapping(block_id)
            .ok_or_else(|| CanvasSyncError::MappingNotFound(block_id.to_string()))?;

        if mapping.block_type != PlcBlockType::PlcIn {
            return Err(CanvasSyncError::MappingNotFound(
                format!("{} is not a PlcIn block", block_id)
            ));
        }

        // Apply inverted logic
        let state = if mapping.inverted {
            !circuit_state
        } else {
            circuit_state
        };

        // Write to device memory
        self.write_device_state(&mapping, state)?;

        *self.input_change_count.write() += 1;

        Ok(())
    }

    /// Handle multiple PLC input changes at once
    pub fn handle_plc_input_changes(&self, changes: &[PlcInputChange]) -> CanvasSyncResult<usize> {
        let mut success_count = 0;

        for change in changes {
            match self.handle_plc_input_change(&change.block_id, change.state) {
                Ok(()) => success_count += 1,
                Err(e) => {
                    // Log error but continue processing other changes
                    log::warn!("Failed to handle plc input change for {}: {}", change.block_id, e);
                }
            }
        }

        Ok(success_count)
    }

    /// Write device state to memory based on mapping
    fn write_device_state(&self, mapping: &PlcBlockMapping, state: bool) -> CanvasSyncResult<()> {
        match &mapping.binding {
            RuntimeBinding::Canonical { address } => self
                .runtime
                .write_bool(
                    *address,
                    state,
                    crate::plc_runtime::CanonicalWriteSource::Simulation,
                )
                .map_err(|e| CanvasSyncError::RuntimeMemoryError(e.to_string())),
            RuntimeBinding::Tag { tag_id } => {
                let tag = self
                    .tag_registry
                    .resolve(tag_id)
                    .map_err(|e| CanvasSyncError::InvalidAddress(e.to_string()))?;
                self.runtime
                    .write_bool(
                        tag.canonical_address,
                        state,
                        crate::plc_runtime::CanonicalWriteSource::Simulation,
                    )
                    .map_err(|e| CanvasSyncError::RuntimeMemoryError(e.to_string()))
            }
        }
    }

    // ========================================================================
    // Change Detection Helpers
    // ========================================================================

    /// Get list of block IDs with changed states
    pub fn get_changed_blocks(&self) -> Vec<String> {
        let mappings = self.plc_block_mappings.read();
        let previous = self.previous_states.read();
        let mut changed = Vec::new();

        for mapping in mappings.iter() {
            if mapping.block_type != PlcBlockType::PlcOut {
                continue;
            }

            if let Ok(state) = self.read_device_state(mapping) {
                let output_state = self.apply_output_logic(state, mapping);
                let prev_state = previous.get(&mapping.block_id).copied();

                if prev_state != Some(output_state) {
                    changed.push(mapping.block_id.clone());
                }
            }
        }

        changed
    }

    /// Check if any output state has changed
    pub fn has_output_changes(&self) -> bool {
        !self.get_changed_blocks().is_empty()
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /// Get the number of output updates sent
    pub fn output_update_count(&self) -> u64 {
        *self.output_update_count.read()
    }

    /// Get the number of input changes processed
    pub fn input_change_count(&self) -> u64 {
        *self.input_change_count.read()
    }

    /// Reset statistics
    pub fn reset_stats(&self) {
        *self.output_update_count.write() = 0;
        *self.input_change_count.write() = 0;
    }
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::tag_registry::TagRegistry;
    use crate::plc_runtime::{CanonicalAddress, CanonicalAreaKind};

    fn bit_binding(area: CanonicalAreaKind, index: u32) -> RuntimeBinding {
        RuntimeBinding::canonical(CanonicalAddress::new(area, index))
    }

    fn create_test_sync() -> CanvasSync {
        let runtime = Arc::new(CanonicalRuntimeFacade::new());
        CanvasSync::new(runtime, Arc::new(TagRegistry::new()))
    }

    // ========================================================================
    // Mapping Management Tests
    // ========================================================================

    #[test]
    fn test_register_mapping() {
        let sync = create_test_sync();

        let mapping = PlcBlockMapping::new_plc_out("block1", bit_binding(CanonicalAreaKind::InternalBit, 0), "M0");
        sync.register_mapping(mapping.clone());

        assert_eq!(sync.mapping_count(), 1);
        assert!(sync.get_mapping("block1").is_some());
    }

    #[test]
    fn test_register_mapping_replaces_existing() {
        let sync = create_test_sync();

        let mapping1 =
            PlcBlockMapping::new_plc_out("block1", bit_binding(CanonicalAreaKind::InternalBit, 0), "M0");
        let mapping2 = PlcBlockMapping::new_plc_out(
            "block1",
            bit_binding(CanonicalAreaKind::InternalBit, 100),
            "M100",
        );

        sync.register_mapping(mapping1);
        sync.register_mapping(mapping2);

        assert_eq!(sync.mapping_count(), 1);
        assert_eq!(sync.get_mapping("block1").unwrap().display_address, "M100");
    }

    #[test]
    fn test_remove_mapping() {
        let sync = create_test_sync();

        sync.register_mapping(PlcBlockMapping::new_plc_out(
            "block1",
            bit_binding(CanonicalAreaKind::InternalBit, 0),
            "M0",
        ));
        sync.register_mapping(PlcBlockMapping::new_plc_out(
            "block2",
            bit_binding(CanonicalAreaKind::InternalBit, 1),
            "M1",
        ));

        assert_eq!(sync.mapping_count(), 2);

        sync.remove_mapping("block1");

        assert_eq!(sync.mapping_count(), 1);
        assert!(sync.get_mapping("block1").is_none());
        assert!(sync.get_mapping("block2").is_some());
    }

    #[test]
    fn test_clear_mappings() {
        let sync = create_test_sync();

        sync.register_mapping(PlcBlockMapping::new_plc_out(
            "block1",
            bit_binding(CanonicalAreaKind::InternalBit, 0),
            "M0",
        ));
        sync.register_mapping(PlcBlockMapping::new_plc_out(
            "block2",
            bit_binding(CanonicalAreaKind::InternalBit, 1),
            "M1",
        ));

        sync.clear_mappings();

        assert_eq!(sync.mapping_count(), 0);
    }

    // ========================================================================
    // PlcOut Tests
    // ========================================================================

    #[test]
    fn test_read_device_state() {
        let runtime = Arc::new(CanonicalRuntimeFacade::new());
        let sync = CanvasSync::new(Arc::clone(&runtime), Arc::new(TagRegistry::new()));

        // Set M0 to true
        runtime
            .write_bool(
                CanonicalAddress::new(CanonicalAreaKind::InternalBit, 0),
                true,
                crate::plc_runtime::CanonicalWriteSource::Simulation,
            )
            .unwrap();

        let mapping =
            PlcBlockMapping::new_plc_out("block1", bit_binding(CanonicalAreaKind::InternalBit, 0), "M0");
        let state = sync.read_device_state(&mapping).unwrap();

        assert!(state);
    }

    #[test]
    fn test_apply_output_logic_normally_open() {
        let sync = create_test_sync();

        let mapping = PlcBlockMapping::new_plc_out(
            "block1",
            bit_binding(CanonicalAreaKind::InternalBit, 0),
            "M0",
        )
            .with_normally_open(true);

        assert!(sync.apply_output_logic(true, &mapping));
        assert!(!sync.apply_output_logic(false, &mapping));
    }

    #[test]
    fn test_apply_output_logic_normally_closed() {
        let sync = create_test_sync();

        let mapping = PlcBlockMapping::new_plc_out(
            "block1",
            bit_binding(CanonicalAreaKind::InternalBit, 0),
            "M0",
        )
            .with_normally_open(false);

        // NC contact: output is inverted
        assert!(!sync.apply_output_logic(true, &mapping));
        assert!(sync.apply_output_logic(false, &mapping));
    }

    #[test]
    fn test_apply_output_logic_inverted() {
        let sync = create_test_sync();

        let mapping = PlcBlockMapping::new_plc_out(
            "block1",
            bit_binding(CanonicalAreaKind::InternalBit, 0),
            "M0",
        )
            .with_inverted(true);

        assert!(!sync.apply_output_logic(true, &mapping));
        assert!(sync.apply_output_logic(false, &mapping));
    }

    #[test]
    fn test_apply_output_logic_nc_and_inverted() {
        let sync = create_test_sync();

        let mapping = PlcBlockMapping::new_plc_out(
            "block1",
            bit_binding(CanonicalAreaKind::InternalBit, 0),
            "M0",
        )
            .with_normally_open(false)
            .with_inverted(true);

        // NC + inverted = double inversion = same as input
        assert!(sync.apply_output_logic(true, &mapping));
        assert!(!sync.apply_output_logic(false, &mapping));
    }

    // ========================================================================
    // PlcIn Tests
    // ========================================================================

    #[test]
    fn test_handle_plc_input_change() {
        let runtime = Arc::new(CanonicalRuntimeFacade::new());
        let sync = CanvasSync::new(Arc::clone(&runtime), Arc::new(TagRegistry::new()));

        let mapping =
            PlcBlockMapping::new_plc_in("sensor1", bit_binding(CanonicalAreaKind::InputBit, 0), "P0");
        sync.register_mapping(mapping);

        // Handle input change
        sync.handle_plc_input_change("sensor1", true).unwrap();

        // Verify P0 is set
        assert!(runtime
            .read_bool(CanonicalAddress::new(CanonicalAreaKind::InputBit, 0))
            .unwrap());

        // Handle input change to false
        sync.handle_plc_input_change("sensor1", false).unwrap();
        assert!(!runtime
            .read_bool(CanonicalAddress::new(CanonicalAreaKind::InputBit, 0))
            .unwrap());
    }

    #[test]
    fn test_handle_plc_input_change_inverted() {
        let runtime = Arc::new(CanonicalRuntimeFacade::new());
        let sync = CanvasSync::new(Arc::clone(&runtime), Arc::new(TagRegistry::new()));

        let mapping = PlcBlockMapping::new_plc_in(
            "sensor1",
            bit_binding(CanonicalAreaKind::InputBit, 0),
            "P0",
        )
            .with_inverted(true);
        sync.register_mapping(mapping);

        // Handle input change with inversion
        sync.handle_plc_input_change("sensor1", true).unwrap();
        assert!(!runtime
            .read_bool(CanonicalAddress::new(CanonicalAreaKind::InputBit, 0))
            .unwrap());

        sync.handle_plc_input_change("sensor1", false).unwrap();
        assert!(runtime
            .read_bool(CanonicalAddress::new(CanonicalAreaKind::InputBit, 0))
            .unwrap());
    }

    #[test]
    fn test_handle_plc_input_change_mapping_not_found() {
        let sync = create_test_sync();

        let result = sync.handle_plc_input_change("nonexistent", true);
        assert!(matches!(result, Err(CanvasSyncError::MappingNotFound(_))));
    }

    #[test]
    fn test_handle_plc_input_change_wrong_type() {
        let sync = create_test_sync();

        // Register as PlcOut, not PlcIn
        let mapping =
            PlcBlockMapping::new_plc_out("block1", bit_binding(CanonicalAreaKind::InternalBit, 0), "M0");
        sync.register_mapping(mapping);

        let result = sync.handle_plc_input_change("block1", true);
        assert!(matches!(result, Err(CanvasSyncError::MappingNotFound(_))));
    }

    // ========================================================================
    // Statistics Tests
    // ========================================================================

    #[test]
    fn test_statistics() {
        let runtime = Arc::new(CanonicalRuntimeFacade::new());
        let sync = CanvasSync::new(Arc::clone(&runtime), Arc::new(TagRegistry::new()));

        assert_eq!(sync.output_update_count(), 0);
        assert_eq!(sync.input_change_count(), 0);

        // Register and trigger input change
        sync.register_mapping(PlcBlockMapping::new_plc_in(
            "sensor1",
            bit_binding(CanonicalAreaKind::InputBit, 0),
            "P0",
        ));
        sync.handle_plc_input_change("sensor1", true).unwrap();

        assert_eq!(sync.input_change_count(), 1);

        sync.reset_stats();
        assert_eq!(sync.input_change_count(), 0);
    }

    // ========================================================================
    // Mapping Builder Tests
    // ========================================================================

    #[test]
    fn test_mapping_builder() {
        let mapping = PlcBlockMapping::new_plc_out(
            "led1",
            bit_binding(CanonicalAreaKind::InternalBit, 100),
            "M100",
        )
            .with_normally_open(false)
            .with_inverted(true)
            .with_label("Status LED");

        assert_eq!(mapping.block_id, "led1");
        assert_eq!(mapping.block_type, PlcBlockType::PlcOut);
        assert_eq!(mapping.display_address, "M100");
        assert!(!mapping.normally_open);
        assert!(mapping.inverted);
        assert_eq!(mapping.label, Some("Status LED".to_string()));
    }
}
