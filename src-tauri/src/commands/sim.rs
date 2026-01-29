//! Simulation Control Commands
//!
//! Tauri command handlers for PLC simulation control, memory access,
//! and debugging operations.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use crate::sim::{
    debugger::{SimDebugger, StepResult, StepType},
    engine::OneSimEngine,
    executor::LadderProgram,
    memory::DeviceMemory,
    types::{
        Breakpoint, MemorySnapshot, ScanCycleInfo, SimBitDeviceType,
        SimWordDeviceType, SimulationConfig, SimulationStatus, WatchVariable,
    },
};

// ============================================================================
// Simulation State
// ============================================================================

/// Managed state for the simulation engine
pub struct SimState {
    /// The simulation engine instance
    engine: Arc<Mutex<Option<OneSimEngine>>>,
    /// The debugger instance
    debugger: Arc<SimDebugger>,
}

impl Default for SimState {
    fn default() -> Self {
        Self::new()
    }
}

impl SimState {
    /// Create a new simulation state
    pub fn new() -> Self {
        Self {
            engine: Arc::new(Mutex::new(None)),
            debugger: Arc::new(SimDebugger::default()),
        }
    }

    /// Get the engine (if running)
    pub fn engine(&self) -> Arc<Mutex<Option<OneSimEngine>>> {
        self.engine.clone()
    }

    /// Get the debugger
    pub fn debugger(&self) -> Arc<SimDebugger> {
        self.debugger.clone()
    }
}

// ============================================================================
// Response Types
// ============================================================================

/// Device value (bit or word)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum DeviceValue {
    /// Bit value (boolean)
    #[serde(rename = "bit")]
    Bit { value: bool },
    /// Word value (16-bit unsigned)
    #[serde(rename = "word")]
    Word { value: u16 },
}

/// Simulation run parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimRunParams {
    /// Program ID to load (not currently used)
    pub program_id: Option<String>,
    /// Simulation configuration overrides
    pub config: Option<SimulationConfig>,
}

// ============================================================================
// Event Names
// ============================================================================

const SIM_STATUS_UPDATE_EVENT: &str = "sim:status-update";
const SIM_SCAN_COMPLETE_EVENT: &str = "sim:scan-complete";
const SIM_DEVICE_CHANGE_EVENT: &str = "sim:device-change";
const SIM_BREAKPOINT_HIT_EVENT: &str = "sim:breakpoint-hit";

// ============================================================================
// Simulation Lifecycle Commands
// ============================================================================

/// Start the simulation
#[tauri::command]
pub async fn sim_run(
    app: AppHandle,
    state: State<'_, SimState>,
    params: Option<SimRunParams>,
) -> Result<(), String> {
    let mut engine_guard = state.engine.lock();

    // Check if already running
    if let Some(ref engine) = *engine_guard {
        if engine.is_running() {
            return Err("Simulation is already running".to_string());
        }
    }

    // Create new engine if needed
    if engine_guard.is_none() {
        let engine = OneSimEngine::new();
        engine.set_app_handle(app.clone());

        // Apply config if provided
        if let Some(ref params) = params {
            if let Some(ref config) = params.config {
                engine.set_config(config.clone());
            }
        }

        *engine_guard = Some(engine);
    }

    // Get engine reference
    let engine = engine_guard.as_ref().ok_or("Failed to create engine")?;

    // Create an empty program for now (will be loaded from parser later)
    let program = LadderProgram {
        name: "Default Program".to_string(),
        networks: vec![],
    };

    // Start the engine
    engine.start(program).map_err(|e| e.to_string())?;

    // Emit status update
    let status = engine.get_status();
    let _ = app.emit(
        SIM_STATUS_UPDATE_EVENT,
        serde_json::json!({
            "status": status.state,
            "stats": {
                "scanCount": status.scan_count,
                "currentNetworkId": null,
                "timing": {
                    "current": status.last_scan_time_us as f64 / 1000.0,
                    "average": status.avg_scan_time_us as f64 / 1000.0,
                    "min": status.min_scan_time_us as f64 / 1000.0,
                    "max": status.max_scan_time_us as f64 / 1000.0
                },
                "watchdogTriggered": false
            }
        }),
    );

    Ok(())
}

/// Stop the simulation
#[tauri::command]
pub fn sim_stop(app: AppHandle, state: State<'_, SimState>) -> Result<(), String> {
    let engine_guard = state.engine.lock();

    if let Some(ref engine) = *engine_guard {
        engine.stop();

        // Emit status update
        let _ = app.emit(
            SIM_STATUS_UPDATE_EVENT,
            serde_json::json!({
                "status": "stopped",
                "stats": {
                    "scanCount": 0,
                    "currentNetworkId": null,
                    "timing": { "current": 0.0, "average": 0.0, "min": 0.0, "max": 0.0 },
                    "watchdogTriggered": false
                }
            }),
        );

        Ok(())
    } else {
        Err("Simulation is not running".to_string())
    }
}

/// Pause the simulation
#[tauri::command]
pub fn sim_pause(app: AppHandle, state: State<'_, SimState>) -> Result<(), String> {
    let engine_guard = state.engine.lock();

    if let Some(ref engine) = *engine_guard {
        engine.pause().map_err(|e| e.to_string())?;

        // Emit status update
        let status = engine.get_status();
        let _ = app.emit(
            SIM_STATUS_UPDATE_EVENT,
            serde_json::json!({
                "status": "paused",
                "stats": {
                    "scanCount": status.scan_count,
                    "currentNetworkId": null,
                    "timing": {
                        "current": status.last_scan_time_us as f64 / 1000.0,
                        "average": status.avg_scan_time_us as f64 / 1000.0,
                        "min": status.min_scan_time_us as f64 / 1000.0,
                        "max": status.max_scan_time_us as f64 / 1000.0
                    },
                    "watchdogTriggered": false
                }
            }),
        );

        Ok(())
    } else {
        Err("Simulation is not running".to_string())
    }
}

/// Resume the simulation
#[tauri::command]
pub fn sim_resume(app: AppHandle, state: State<'_, SimState>) -> Result<(), String> {
    let engine_guard = state.engine.lock();

    if let Some(ref engine) = *engine_guard {
        engine.resume().map_err(|e| e.to_string())?;

        // Emit status update
        let status = engine.get_status();
        let _ = app.emit(
            SIM_STATUS_UPDATE_EVENT,
            serde_json::json!({
                "status": "running",
                "stats": {
                    "scanCount": status.scan_count,
                    "currentNetworkId": null,
                    "timing": {
                        "current": status.last_scan_time_us as f64 / 1000.0,
                        "average": status.avg_scan_time_us as f64 / 1000.0,
                        "min": status.min_scan_time_us as f64 / 1000.0,
                        "max": status.max_scan_time_us as f64 / 1000.0
                    },
                    "watchdogTriggered": false
                }
            }),
        );

        Ok(())
    } else {
        Err("Simulation is not running".to_string())
    }
}

/// Reset the simulation
#[tauri::command]
pub fn sim_reset(app: AppHandle, state: State<'_, SimState>) -> Result<(), String> {
    let mut engine_guard = state.engine.lock();

    // Stop if running
    if let Some(ref engine) = *engine_guard {
        engine.stop();
    }

    // Clear the engine
    *engine_guard = None;

    // Reset debugger
    state.debugger.reset();

    // Emit status update
    let _ = app.emit(
        SIM_STATUS_UPDATE_EVENT,
        serde_json::json!({
            "status": "stopped",
            "stats": {
                "scanCount": 0,
                "currentNetworkId": null,
                "timing": { "current": 0.0, "average": 0.0, "min": 0.0, "max": 0.0 },
                "watchdogTriggered": false
            }
        }),
    );

    Ok(())
}

/// Get simulation status
#[tauri::command]
pub fn sim_get_status(state: State<'_, SimState>) -> Result<SimulationStatus, String> {
    let engine_guard = state.engine.lock();

    if let Some(ref engine) = *engine_guard {
        Ok(engine.get_status())
    } else {
        // Return default stopped status
        Ok(SimulationStatus::default())
    }
}

/// Get scan cycle info
#[tauri::command]
pub fn sim_get_scan_info(state: State<'_, SimState>) -> Result<ScanCycleInfo, String> {
    let engine_guard = state.engine.lock();

    if let Some(ref engine) = *engine_guard {
        Ok(engine.get_scan_info())
    } else {
        Ok(ScanCycleInfo {
            cycle_count: 0,
            last_scan_time: 0,
            average_scan_time: 0,
            max_scan_time: 0,
            timestamp: 0,
        })
    }
}

// ============================================================================
// Memory Access Commands
// ============================================================================

/// Parse device address string into type and address
fn parse_device_address(address: &str) -> Result<(String, u16), String> {
    if address.len() < 2 {
        return Err(format!("Invalid device address: {}", address));
    }

    let upper = address.to_uppercase();

    // Check for two-letter device types first (TD, CD)
    if upper.len() >= 3 {
        if upper.starts_with("TD") {
            let addr: u16 = upper[2..]
                .parse()
                .map_err(|_| format!("Invalid address number: {}", address))?;
            return Ok(("TD".to_string(), addr));
        }
        if upper.starts_with("CD") {
            let addr: u16 = upper[2..]
                .parse()
                .map_err(|_| format!("Invalid address number: {}", address))?;
            return Ok(("CD".to_string(), addr));
        }
    }

    let device_type = &upper[0..1];
    let addr: u16 = upper[1..]
        .parse()
        .map_err(|_| format!("Invalid address number: {}", address))?;

    Ok((device_type.to_string(), addr))
}

/// Read a device value
#[tauri::command]
pub fn sim_read_device(
    state: State<'_, SimState>,
    address: String,
) -> Result<DeviceValue, String> {
    let engine_guard = state.engine.lock();

    let engine = engine_guard
        .as_ref()
        .ok_or("Simulation is not running")?;

    let memory = engine.memory();
    let (device_type, addr) = parse_device_address(&address)?;

    match device_type.as_str() {
        "P" => {
            let value = memory
                .read_bit(SimBitDeviceType::P, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        "M" => {
            let value = memory
                .read_bit(SimBitDeviceType::M, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        "K" => {
            let value = memory
                .read_bit(SimBitDeviceType::K, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        "F" => {
            let value = memory
                .read_bit(SimBitDeviceType::F, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        "T" => {
            let value = memory
                .read_bit(SimBitDeviceType::T, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        "C" => {
            let value = memory
                .read_bit(SimBitDeviceType::C, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        "D" => {
            let value = memory
                .read_word(SimWordDeviceType::D, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        "R" => {
            let value = memory
                .read_word(SimWordDeviceType::R, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        "Z" => {
            let value = memory
                .read_word(SimWordDeviceType::Z, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        "N" => {
            let value = memory
                .read_word(SimWordDeviceType::N, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        "TD" => {
            let value = memory
                .read_word(SimWordDeviceType::Td, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        "CD" => {
            let value = memory
                .read_word(SimWordDeviceType::Cd, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        _ => Err(format!("Unknown device type: {}", device_type)),
    }
}

/// Write a device value
#[tauri::command]
pub fn sim_write_device(
    app: AppHandle,
    state: State<'_, SimState>,
    address: String,
    value: DeviceValue,
) -> Result<(), String> {
    let engine_guard = state.engine.lock();

    let engine = engine_guard
        .as_ref()
        .ok_or("Simulation is not running")?;

    let memory = engine.memory();
    let (device_type, addr) = parse_device_address(&address)?;

    // Get old value for change event
    let old_value = sim_read_device_internal(memory, &device_type, addr)?;

    match (&device_type[..], &value) {
        ("P", DeviceValue::Bit { value }) => {
            memory
                .write_bit(SimBitDeviceType::P, addr, *value)
                .map_err(|e| e.to_string())?;
        }
        ("M", DeviceValue::Bit { value }) => {
            memory
                .write_bit(SimBitDeviceType::M, addr, *value)
                .map_err(|e| e.to_string())?;
        }
        ("K", DeviceValue::Bit { value }) => {
            memory
                .write_bit(SimBitDeviceType::K, addr, *value)
                .map_err(|e| e.to_string())?;
        }
        ("D", DeviceValue::Word { value }) => {
            memory
                .write_word(SimWordDeviceType::D, addr, *value)
                .map_err(|e| e.to_string())?;
        }
        ("R", DeviceValue::Word { value }) => {
            memory
                .write_word(SimWordDeviceType::R, addr, *value)
                .map_err(|e| e.to_string())?;
        }
        ("Z", DeviceValue::Word { value }) => {
            memory
                .write_word(SimWordDeviceType::Z, addr, *value)
                .map_err(|e| e.to_string())?;
        }
        ("N", DeviceValue::Word { value }) => {
            memory
                .write_word(SimWordDeviceType::N, addr, *value)
                .map_err(|e| e.to_string())?;
        }
        _ => return Err(format!("Cannot write to device type: {}", device_type)),
    }

    // Emit device change event
    let _ = app.emit(
        SIM_DEVICE_CHANGE_EVENT,
        serde_json::json!({
            "address": address,
            "oldValue": old_value,
            "newValue": value
        }),
    );

    // Check device breakpoints
    let debugger = state.debugger();
    if let Some(hit) = debugger.check_device_change(
        &address,
        serde_json::to_value(&old_value).unwrap_or_default(),
        serde_json::to_value(&value).unwrap_or_default(),
    ) {
        debugger.pause(hit.clone());
        let _ = app.emit(
            SIM_BREAKPOINT_HIT_EVENT,
            serde_json::json!({ "hit": hit }),
        );
    }

    Ok(())
}

/// Internal helper to read device value
fn sim_read_device_internal(
    memory: &Arc<DeviceMemory>,
    device_type: &str,
    addr: u16,
) -> Result<DeviceValue, String> {
    match device_type {
        "P" => {
            let value = memory
                .read_bit(SimBitDeviceType::P, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        "M" => {
            let value = memory
                .read_bit(SimBitDeviceType::M, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        "K" => {
            let value = memory
                .read_bit(SimBitDeviceType::K, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        "F" => {
            let value = memory
                .read_bit(SimBitDeviceType::F, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        "T" => {
            let value = memory
                .read_bit(SimBitDeviceType::T, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        "C" => {
            let value = memory
                .read_bit(SimBitDeviceType::C, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        "D" => {
            let value = memory
                .read_word(SimWordDeviceType::D, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        "R" => {
            let value = memory
                .read_word(SimWordDeviceType::R, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        "Z" => {
            let value = memory
                .read_word(SimWordDeviceType::Z, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        "N" => {
            let value = memory
                .read_word(SimWordDeviceType::N, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        "TD" => {
            let value = memory
                .read_word(SimWordDeviceType::Td, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        "CD" => {
            let value = memory
                .read_word(SimWordDeviceType::Cd, addr)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        _ => Err(format!("Unknown device type: {}", device_type)),
    }
}

/// Read a range of device memory
#[tauri::command]
pub fn sim_read_memory_range(
    state: State<'_, SimState>,
    device_type: String,
    start: u16,
    count: u16,
) -> Result<Vec<DeviceValue>, String> {
    let engine_guard = state.engine.lock();

    let engine = engine_guard
        .as_ref()
        .ok_or("Simulation is not running")?;

    let memory = engine.memory();
    let mut values = Vec::with_capacity(count as usize);

    for i in 0..count {
        let addr = start + i;
        let value = sim_read_device_internal(memory, &device_type, addr)?;
        values.push(value);
    }

    Ok(values)
}

/// Get memory snapshot
#[tauri::command]
pub fn sim_get_memory_snapshot(state: State<'_, SimState>) -> Result<MemorySnapshot, String> {
    let engine_guard = state.engine.lock();

    let engine = engine_guard
        .as_ref()
        .ok_or("Simulation is not running")?;

    let memory = engine.memory();
    Ok(memory.get_snapshot("sim"))
}

// ============================================================================
// Debugging Commands
// ============================================================================

/// Add a breakpoint
#[tauri::command]
pub fn sim_add_breakpoint(
    state: State<'_, SimState>,
    breakpoint: Breakpoint,
) -> Result<String, String> {
    let id = state.debugger.add_breakpoint(breakpoint);
    Ok(id)
}

/// Remove a breakpoint
#[tauri::command]
pub fn sim_remove_breakpoint(state: State<'_, SimState>, id: String) -> Result<(), String> {
    state.debugger.remove_breakpoint(&id).map_err(|e| e.to_string())
}

/// Get all breakpoints
#[tauri::command]
pub fn sim_get_breakpoints(state: State<'_, SimState>) -> Result<Vec<Breakpoint>, String> {
    Ok(state.debugger.get_breakpoints())
}

/// Add a watch variable
#[tauri::command]
pub fn sim_add_watch(state: State<'_, SimState>, address: String) -> Result<(), String> {
    let engine_guard = state.engine.lock();

    if let Some(ref engine) = *engine_guard {
        let memory = engine.memory();
        state.debugger.add_watch(&address, memory);
        Ok(())
    } else {
        // Add watch without initial value
        state.debugger.add_watch(&address, &DeviceMemory::new());
        Ok(())
    }
}

/// Remove a watch variable
#[tauri::command]
pub fn sim_remove_watch(state: State<'_, SimState>, address: String) -> Result<(), String> {
    state.debugger.remove_watch(&address).map_err(|e| e.to_string())
}

/// Get all watch variables
#[tauri::command]
pub fn sim_get_watches(state: State<'_, SimState>) -> Result<Vec<WatchVariable>, String> {
    Ok(state.debugger.get_watches())
}

/// Step execution (network or scan)
#[tauri::command]
pub fn sim_step(
    app: AppHandle,
    state: State<'_, SimState>,
    step_type: StepType,
) -> Result<StepResult, String> {
    let engine_guard = state.engine.lock();

    let engine = engine_guard
        .as_ref()
        .ok_or("Simulation is not running")?;

    // Enable step mode
    state.debugger.enable_step_mode(step_type);

    // Execute single scan (step type determines granularity in future)
    engine.single_scan().map_err(|e| e.to_string())?;

    // Get status
    let status = engine.get_status();

    // Build step result
    let result = StepResult {
        success: true,
        step_type,
        network_id: None, // Would need to track current network
        scan_count: status.scan_count,
        breakpoint_hit: state.debugger.get_pause_state(),
    };

    // Emit status update
    let _ = app.emit(
        SIM_STATUS_UPDATE_EVENT,
        serde_json::json!({
            "status": status.state,
            "stats": {
                "scanCount": status.scan_count,
                "currentNetworkId": null,
                "timing": {
                    "current": status.last_scan_time_us as f64 / 1000.0,
                    "average": status.avg_scan_time_us as f64 / 1000.0,
                    "min": status.min_scan_time_us as f64 / 1000.0,
                    "max": status.max_scan_time_us as f64 / 1000.0
                },
                "watchdogTriggered": false
            }
        }),
    );

    Ok(result)
}

/// Continue execution after pause
#[tauri::command]
pub fn sim_continue(app: AppHandle, state: State<'_, SimState>) -> Result<(), String> {
    state.debugger.continue_execution();

    // Resume the engine
    sim_resume(app, state)
}

/// Get debugger state
#[tauri::command]
pub fn sim_get_debugger_state(
    state: State<'_, SimState>,
) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "stepMode": state.debugger.is_step_mode(),
        "stepType": state.debugger.get_step_type(),
        "pausedAt": state.debugger.get_pause_state(),
        "breakpoints": state.debugger.get_breakpoints(),
        "watches": state.debugger.get_watches()
    }))
}
