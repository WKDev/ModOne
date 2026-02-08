//! Scope-Simulation Integration Commands
//!
//! Provides Tauri commands for integrating scope visualization with the
//! PLC simulation engine, allowing real-time device value monitoring.

use tauri::State;

use super::canvas::ScopeState;
use super::sim::SimState;
use crate::canvas::scope_sync::ScopeSampleResult;
use crate::sim::types::{SimBitDeviceType, SimWordDeviceType};

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

    let memory = engine.memory();

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
        let voltage = match read_device_voltage(memory, mapping) {
            Ok(v) => v,
            Err(e) => {
                result.channels_skipped += 1;
                result.errors.push(format!(
                    "Error reading {}{}: {}",
                    mapping.device_type, mapping.address, e
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
    memory: &std::sync::Arc<crate::sim::memory::DeviceMemory>,
    mapping: &crate::canvas::scope_sync::ScopeChannelMapping,
) -> Result<f32, String> {
    let device_type = mapping.device_type.to_uppercase();

    // Determine if it's a bit or word device and read accordingly
    match device_type.as_str() {
        // Bit devices - output scale voltage when true, 0 when false
        "P" => {
            let value = memory
                .read_bit(SimBitDeviceType::P, mapping.address)
                .map_err(|e| e.to_string())?;
            Ok(if value { mapping.scale } else { 0.0 } + mapping.offset)
        }
        "M" => {
            let value = memory
                .read_bit(SimBitDeviceType::M, mapping.address)
                .map_err(|e| e.to_string())?;
            Ok(if value { mapping.scale } else { 0.0 } + mapping.offset)
        }
        "K" => {
            let value = memory
                .read_bit(SimBitDeviceType::K, mapping.address)
                .map_err(|e| e.to_string())?;
            Ok(if value { mapping.scale } else { 0.0 } + mapping.offset)
        }
        "F" => {
            let value = memory
                .read_bit(SimBitDeviceType::F, mapping.address)
                .map_err(|e| e.to_string())?;
            Ok(if value { mapping.scale } else { 0.0 } + mapping.offset)
        }
        "T" => {
            let value = memory
                .read_bit(SimBitDeviceType::T, mapping.address)
                .map_err(|e| e.to_string())?;
            Ok(if value { mapping.scale } else { 0.0 } + mapping.offset)
        }
        "C" => {
            let value = memory
                .read_bit(SimBitDeviceType::C, mapping.address)
                .map_err(|e| e.to_string())?;
            Ok(if value { mapping.scale } else { 0.0 } + mapping.offset)
        }
        // Word devices - value * scale + offset
        "D" => {
            let value = memory
                .read_word(SimWordDeviceType::D, mapping.address)
                .map_err(|e| e.to_string())?;
            Ok(value as f32 * mapping.scale + mapping.offset)
        }
        "R" => {
            let value = memory
                .read_word(SimWordDeviceType::R, mapping.address)
                .map_err(|e| e.to_string())?;
            Ok(value as f32 * mapping.scale + mapping.offset)
        }
        "Z" => {
            let value = memory
                .read_word(SimWordDeviceType::Z, mapping.address)
                .map_err(|e| e.to_string())?;
            Ok(value as f32 * mapping.scale + mapping.offset)
        }
        "N" => {
            let value = memory
                .read_word(SimWordDeviceType::N, mapping.address)
                .map_err(|e| e.to_string())?;
            Ok(value as f32 * mapping.scale + mapping.offset)
        }
        "TD" => {
            let value = memory
                .read_word(SimWordDeviceType::Td, mapping.address)
                .map_err(|e| e.to_string())?;
            Ok(value as f32 * mapping.scale + mapping.offset)
        }
        "CD" => {
            let value = memory
                .read_word(SimWordDeviceType::Cd, mapping.address)
                .map_err(|e| e.to_string())?;
            Ok(value as f32 * mapping.scale + mapping.offset)
        }
        _ => Err(format!("Unknown device type: {}", device_type)),
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
    device_type: String,
    address: u16,
    scale: Option<f32>,
    offset: Option<f32>,
) -> Result<f32, String> {
    let engine_arc = sim_state.engine();
    let engine_guard = engine_arc.lock();
    let engine = engine_guard
        .as_ref()
        .ok_or("Simulation is not running")?;

    let memory = engine.memory();
    let device_upper = device_type.to_uppercase();
    let offset_val = offset.unwrap_or(0.0);

    // Determine default scale based on device type
    let is_bit_device = matches!(device_upper.as_str(), "P" | "M" | "K" | "F" | "T" | "C");
    let scale_val = scale.unwrap_or(if is_bit_device { 5.0 } else { 0.001 });

    // Create temporary mapping for reading
    let mapping = crate::canvas::scope_sync::ScopeChannelMapping {
        scope_id: String::new(),
        channel: 0,
        device_type,
        address,
        scale: scale_val,
        offset: offset_val,
        enabled: true,
        label: None,
    };

    read_device_voltage(memory, &mapping)
}
