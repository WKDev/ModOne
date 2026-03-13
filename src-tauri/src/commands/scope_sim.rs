//! Scope-Simulation Integration Commands
//!
//! Provides Tauri commands for integrating scope visualization with the
//! PLC simulation engine, allowing real-time device value monitoring.

use tauri::State;

use super::canvas::ScopeState;
use super::sim::SimState;
use crate::canvas::scope_sync::ScopeSampleResult;
use crate::plc_runtime::CanonicalValue;
use crate::sim::types::RuntimeBinding;

// ============================================================================
// Scope-Simulation Integration Commands
// ============================================================================

/// Sample all registered scope channels from simulation memory.
///
/// This command reads device values from the simulation engine and feeds
/// them to the corresponding scope channels. Should be called each simulation
/// scan cycle or at a fixed interval.
///
/// # Returns
/// ScopeSampleResult with count of samples added and any errors encountered.
#[tauri::command]
pub async fn scope_tick(
    scope_state: State<'_, ScopeState>,
    sim_state: State<'_, SimState>,
) -> Result<ScopeSampleResult, String> {
    let mut result = ScopeSampleResult::default();

    // Get simulation engine and memory
    let engine_arc = sim_state.engine();
    let engine_guard = engine_arc.lock();
    let engine = match engine_guard.as_ref() {
        Some(e) => e,
        None => {
            // Simulation not running - skip sampling
            return Ok(result);
        }
    };

    let runtime = engine.runtime();

    // Get mappings
    let mappings = scope_state
        .mappings()
        .read()
        .map_err(|e| format!("Failed to acquire mappings read lock: {}", e))?;

    // Get scopes for writing samples
    let mut scopes = scope_state
        .scopes()
        .write()
        .map_err(|e| format!("Failed to acquire scopes write lock: {}", e))?;

    // Process each mapping
    for mapping in mappings.iter() {
        // Skip disabled channels
        if !mapping.enabled {
            result.channels_skipped += 1;
            continue;
        }

        // Get scope engine
        let scope: &mut crate::canvas::scope::ScopeEngine = match scopes.get_mut(&mapping.scope_id) {
            Some(s) => s,
            None => {
                result.channels_skipped += 1;
                result.errors.push(format!(
                    "Scope '{}' not found for channel {}",
                    mapping.scope_id, mapping.channel
                ));
                continue;
            }
        };

        // Read device value and convert to voltage
        let voltage = match read_device_voltage(runtime, &sim_state.tag_registry(), mapping) {
            Ok(v) => v,
            Err(e) => {
                result.channels_skipped += 1;
                result.errors.push(format!(
                    "Error reading {}: {}",
                    mapping.display_address, e
                ));
                continue;
            }
        };

        // Add sample to scope
        scope.add_sample(mapping.channel, voltage);
        result.samples_added += 1;
    }

    Ok(result)
}

/// Read device value from memory and convert to voltage based on mapping.
fn read_device_voltage(
    runtime: &std::sync::Arc<crate::sim::memory::CanonicalRuntimeFacade>,
    tag_registry: &crate::sim::tag_registry::SharedTagRegistry,
    mapping: &crate::canvas::scope_sync::ScopeChannelMapping,
) -> Result<f32, String> {
    match &mapping.binding {
        RuntimeBinding::Canonical { address } => match runtime.read(*address).map_err(|e| e.to_string())? {
            CanonicalValue::Bool(value) => Ok(if value { mapping.scale } else { 0.0 } + mapping.offset),
            CanonicalValue::U16(value) => Ok(value as f32 * mapping.scale + mapping.offset),
        },
        RuntimeBinding::Tag { tag_id } => {
            let tag = tag_registry.resolve(tag_id).map_err(|e| e.to_string())?;
            match runtime.read(tag.canonical_address).map_err(|e| e.to_string())? {
                CanonicalValue::Bool(value) => Ok(if value { mapping.scale } else { 0.0 } + mapping.offset),
                CanonicalValue::U16(value) => Ok(value as f32 * mapping.scale + mapping.offset),
            }
        }
    }
}

/// Read a single device value as voltage without adding to scope.
///
/// Useful for getting current value for display or debugging.
///
/// # Arguments
/// * `device_type` - Device type (M, P, K, D, etc.)
/// * `address` - Device address number
/// * `scale` - Optional voltage scale (default: 5.0 for bits, 0.001 for words)
/// * `offset` - Optional voltage offset (default: 0.0)
#[tauri::command]
pub async fn scope_read_device_voltage(
    sim_state: State<'_, SimState>,
    binding: RuntimeBinding,
    display_address: Option<String>,
    scale: Option<f32>,
    offset: Option<f32>,
) -> Result<f32, String> {
    let engine_arc = sim_state.engine();
    let engine_guard = engine_arc.lock();
    let engine = engine_guard
        .as_ref()
        .ok_or("Simulation is not running")?;

    let runtime = engine.runtime();
    let offset_val = offset.unwrap_or(0.0);
    let scale_val = scale.unwrap_or(match &binding {
        RuntimeBinding::Canonical { address } if address.area.is_bit_area() || address.bit_index.is_some() => 5.0,
        RuntimeBinding::Canonical { .. } => 0.001,
        RuntimeBinding::Tag { .. } => 1.0,
    });

    // Create temporary mapping for reading
    let mapping = crate::canvas::scope_sync::ScopeChannelMapping {
        scope_id: String::new(),
        channel: 0,
        binding,
        display_address: display_address.unwrap_or_default(),
        scale: scale_val,
        offset: offset_val,
        enabled: true,
        label: None,
    };

    read_device_voltage(runtime, &sim_state.tag_registry(), &mapping)
}
