//! Simulation Control Commands
//!
//! Tauri command handlers for PLC simulation control, memory access,
//! and debugging operations.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use crate::commands::canvas_sync::CanvasSyncState;
use crate::commands::modbus::{
    modbus_start_project_simulation, modbus_stop_project_simulation, ModbusState,
};
use crate::modbus::ModbusMemory;
use crate::plc_runtime::{
    resolve_modbus_mapping_policy, resolve_vendor_profile, CanonicalAddress, CanonicalAreaKind,
    VendorAddress, VendorProfileId,
};
use crate::project::{PlcSettings, ProjectConfig, SharedProjectManager};
use crate::sim::{
    counter::CounterManager,
    debugger::{SimDebugger, StepResult, StepType},
    engine::OneSimEngine,
    executor::LadderProgram,
    memory::DeviceMemory,
    modserver_sync::ModServerSync,
    timer::TimerManager,
    types::{
        Breakpoint, MemorySnapshot, ScanCycleInfo, SimBitDeviceType, SimWordDeviceType,
        SimulationConfig, SimulationStatus, WatchVariable,
    },
};

// ============================================================================
// Simulation State
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForcedDeviceValue {
    pub value: serde_json::Value,
}

/// Managed state for the simulation engine
pub struct SimState {
    /// The simulation engine instance
    engine: Arc<Mutex<Option<Arc<OneSimEngine>>>>,
    /// The debugger instance
    debugger: Arc<SimDebugger>,
    memory: Arc<DeviceMemory>,
    /// Shared Modbus memory for ModServerSync
    modbus_memory: Option<Arc<ModbusMemory>>,
    program: Arc<Mutex<Option<LadderProgram>>>,
    scan_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    monitoring_active: Arc<AtomicBool>,
    forced_devices: Arc<parking_lot::RwLock<HashMap<String, serde_json::Value>>>,
}

impl Default for SimState {
    fn default() -> Self {
        Self::new()
    }
}

impl SimState {
    pub fn with_memory(memory: Arc<DeviceMemory>) -> Self {
        Self {
            engine: Arc::new(Mutex::new(None)),
            debugger: Arc::new(SimDebugger::default()),
            memory,
            modbus_memory: None,
            program: Arc::new(Mutex::new(None)),
            scan_task: Arc::new(Mutex::new(None)),
            monitoring_active: Arc::new(AtomicBool::new(false)),
            forced_devices: Arc::new(parking_lot::RwLock::new(HashMap::new())),
        }
    }

    /// Create with both DeviceMemory and ModbusMemory for ModServerSync
    pub fn with_memory_and_modbus(
        memory: Arc<DeviceMemory>,
        modbus_memory: Arc<ModbusMemory>,
    ) -> Self {
        Self {
            engine: Arc::new(Mutex::new(None)),
            debugger: Arc::new(SimDebugger::default()),
            memory,
            modbus_memory: Some(modbus_memory),
            program: Arc::new(Mutex::new(None)),
            scan_task: Arc::new(Mutex::new(None)),
            monitoring_active: Arc::new(AtomicBool::new(false)),
            forced_devices: Arc::new(parking_lot::RwLock::new(HashMap::new())),
        }
    }

    /// Create a new simulation state
    pub fn new() -> Self {
        Self::with_memory(Arc::new(DeviceMemory::new()))
    }

    /// Get the engine (if running)
    pub fn engine(&self) -> Arc<Mutex<Option<Arc<OneSimEngine>>>> {
        self.engine.clone()
    }

    pub fn memory(&self) -> &Arc<DeviceMemory> {
        &self.memory
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ResolvedSimAddress {
    Bit {
        device: SimBitDeviceType,
        address: u16,
    },
    Word {
        device: SimWordDeviceType,
        address: u16,
    },
    WordBit {
        device: SimWordDeviceType,
        address: u16,
        bit: u8,
    },
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
    modbus_state: State<'_, ModbusState>,
    project_state: State<'_, SharedProjectManager>,
    canvas_sync_state: State<'_, CanvasSyncState>,
    params: Option<SimRunParams>,
) -> Result<(), String> {
    let project_config = current_project_config(&project_state)?;
    if let Some(project_config) = project_config.as_ref() {
        if project_config.modbus.simulation.enabled {
            modbus_start_project_simulation(&modbus_state, app.clone(), project_config).await?;
        }
    }

    let mut engine_guard = state.engine.lock();

    // Check if already running
    if let Some(ref engine) = *engine_guard {
        if engine.is_running() {
            return Err("Simulation is already running".to_string());
        }
    }

    // Create new engine if needed
    if engine_guard.is_none() {
        let engine = Arc::new(OneSimEngine::with_components(
            Arc::clone(state.memory()),
            Arc::new(TimerManager::new()),
            Arc::new(CounterManager::new()),
        ));
        engine.set_app_handle(app.clone());

        // Apply config if provided
        if let Some(ref params) = params {
            if let Some(ref config) = params.config {
                engine.set_config(config.clone());
            }
        }

        *engine_guard = Some(engine);
    }

    // Wire monitoring state into engine
    if let Some(ref engine) = *engine_guard {
        engine.set_monitoring_state(
            Arc::clone(&state.monitoring_active),
            Arc::clone(&state.forced_devices),
        );
    }

    // Get engine reference
    let engine = engine_guard
        .as_ref()
        .cloned()
        .ok_or("Failed to create engine")?;

    // Wire canvas sync into engine
    if let Some(ref engine) = *engine_guard {
        if let Some(sync) = canvas_sync_state.canvas_sync() {
            engine.set_canvas_sync(sync);
        }
    }

    // Wire ModServer sync into engine (DeviceMemory ↔ ModbusMemory)
    if let Some(ref engine) = *engine_guard {
        if let Some(ref modbus_mem) = state.modbus_memory {
            let modserver_sync = if let Some(project_config) = project_config.as_ref() {
                let policy = resolve_modbus_mapping_policy(
                    &project_config.plc,
                    Some(&project_config.modbus.exposure),
                )
                .map_err(|e| e.to_string())?;
                Arc::new(ModServerSync::with_policy(
                    Arc::clone(state.memory()),
                    Arc::clone(modbus_mem),
                    policy,
                ))
            } else {
                Arc::new(ModServerSync::new(
                    Arc::clone(state.memory()),
                    Arc::clone(modbus_mem),
                ))
            };
            engine.set_modserver_sync(modserver_sync);
        }
    }

    let program = state
        .program
        .lock()
        .clone()
        .unwrap_or_else(|| LadderProgram {
            name: "Default Program".to_string(),
            networks: vec![],
        });

    // Start the engine
    engine.start(program).map_err(|e| e.to_string())?;

    drop(engine_guard);

    if let Some(handle) = state.scan_task.lock().take() {
        handle.abort();
    }

    let engine_clone = Arc::clone(&engine);
    let scan_task = tokio::spawn(async move {
        engine_clone.run_scan_loop().await;
    });
    *state.scan_task.lock() = Some(scan_task);

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
pub async fn sim_stop(
    app: AppHandle,
    state: State<'_, SimState>,
    modbus_state: State<'_, ModbusState>,
) -> Result<(), String> {
    let is_running = {
        let engine_guard = state.engine.lock();
        if let Some(ref engine) = *engine_guard {
            engine.stop();
            true
        } else {
            false
        }
    };

    if is_running {
        if let Some(handle) = state.scan_task.lock().take() {
            handle.abort();
        }

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

        modbus_stop_project_simulation(&modbus_state).await?;
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
pub async fn sim_reset(
    app: AppHandle,
    state: State<'_, SimState>,
    modbus_state: State<'_, ModbusState>,
) -> Result<(), String> {
    {
        let mut engine_guard = state.engine.lock();

        // Stop if running
        if let Some(ref engine) = *engine_guard {
            engine.stop();
        }

        // Clear the engine
        *engine_guard = None;
    }

    if let Some(handle) = state.scan_task.lock().take() {
        handle.abort();
    }

    state.forced_devices.write().clear();
    state.monitoring_active.store(false, Ordering::SeqCst);

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

    modbus_stop_project_simulation(&modbus_state).await?;
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

/// Load a ladder program for simulation
#[tauri::command]
pub fn sim_load_program(state: State<'_, SimState>, program: LadderProgram) -> Result<(), String> {
    *state.program.lock() = Some(program);
    Ok(())
}

// ============================================================================
// Memory Access Commands
// ============================================================================

fn active_plc_settings(
    project_state: Option<&State<'_, SharedProjectManager>>,
) -> Result<PlcSettings, String> {
    let Some(project_state) = project_state else {
        return Ok(PlcSettings::default());
    };

    let manager = project_state
        .lock()
        .map_err(|e| format!("Failed to acquire project manager lock: {}", e))?;

    Ok(manager
        .get_current_project()
        .map(|project| project.config.plc.clone())
        .unwrap_or_default())
}

fn current_project_config(
    project_state: &State<'_, SharedProjectManager>,
) -> Result<Option<ProjectConfig>, String> {
    let manager = project_state
        .lock()
        .map_err(|e| format!("Failed to acquire project manager lock: {}", e))?;

    Ok(manager
        .get_current_project()
        .map(|project| project.config.clone()))
}

fn resolve_sim_address(
    project_state: Option<&State<'_, SharedProjectManager>>,
    address: &str,
) -> Result<(String, ResolvedSimAddress), String> {
    let plc_settings = active_plc_settings(project_state)?;
    resolve_sim_address_for_settings(&plc_settings, address)
}

fn resolve_sim_address_for_settings(
    plc_settings: &PlcSettings,
    address: &str,
) -> Result<(String, ResolvedSimAddress), String> {
    let profile = resolve_vendor_profile(&plc_settings).map_err(|e| e.to_string())?;
    let vendor_address = profile.parse_address(address).map_err(|e| e.to_string())?;
    let normalized_address = profile
        .format_address(&vendor_address)
        .unwrap_or_else(|_| address.to_uppercase());
    let canonical = profile
        .to_canonical(&vendor_address)
        .map_err(|e| e.to_string())?;

    let resolved = bridge_canonical_to_legacy_device(profile.id(), &canonical)?;
    Ok((normalized_address, resolved))
}

fn resolve_range_address(
    project_state: Option<&State<'_, SharedProjectManager>>,
    family: &str,
    index: u32,
) -> Result<ResolvedSimAddress, String> {
    let plc_settings = active_plc_settings(project_state)?;
    resolve_range_address_for_settings(&plc_settings, family, index)
}

fn resolve_range_address_for_settings(
    plc_settings: &PlcSettings,
    family: &str,
    index: u32,
) -> Result<ResolvedSimAddress, String> {
    let profile = resolve_vendor_profile(&plc_settings).map_err(|e| e.to_string())?;
    let vendor_address = VendorAddress::new(family.to_uppercase(), index);
    profile
        .validate_address(&vendor_address)
        .map_err(|e| e.to_string())?;
    let canonical = profile
        .to_canonical(&vendor_address)
        .map_err(|e| e.to_string())?;

    bridge_canonical_to_legacy_device(profile.id(), &canonical)
}

fn bridge_canonical_to_legacy_device(
    profile_id: VendorProfileId,
    canonical: &CanonicalAddress,
) -> Result<ResolvedSimAddress, String> {
    let address = u16::try_from(canonical.index)
        .map_err(|_| format!("Address {} exceeds legacy simulator range", canonical.index))?;

    let map_word = |device| {
        if let Some(bit) = canonical.bit_index {
            ResolvedSimAddress::WordBit {
                device,
                address,
                bit,
            }
        } else {
            ResolvedSimAddress::Word { device, address }
        }
    };

    let resolved = match (profile_id, canonical.area) {
        (VendorProfileId::LsXg5000, CanonicalAreaKind::InputBit)
        | (VendorProfileId::LsXg5000, CanonicalAreaKind::OutputBit) => ResolvedSimAddress::Bit {
            device: SimBitDeviceType::P,
            address,
        },
        (VendorProfileId::LsXg5000, CanonicalAreaKind::InternalBit) => ResolvedSimAddress::Bit {
            device: SimBitDeviceType::M,
            address,
        },
        (VendorProfileId::LsXg5000, CanonicalAreaKind::RetentiveBit) => ResolvedSimAddress::Bit {
            device: SimBitDeviceType::K,
            address,
        },
        (VendorProfileId::LsXg5000, CanonicalAreaKind::SpecialBit) => ResolvedSimAddress::Bit {
            device: SimBitDeviceType::F,
            address,
        },
        (VendorProfileId::LsXg5000, CanonicalAreaKind::TimerDoneBit) => ResolvedSimAddress::Bit {
            device: SimBitDeviceType::T,
            address,
        },
        (VendorProfileId::LsXg5000, CanonicalAreaKind::CounterDoneBit) => ResolvedSimAddress::Bit {
            device: SimBitDeviceType::C,
            address,
        },
        (VendorProfileId::LsXg5000, CanonicalAreaKind::DataWord) => map_word(SimWordDeviceType::D),
        (VendorProfileId::LsXg5000, CanonicalAreaKind::RetentiveWord) => {
            map_word(SimWordDeviceType::R)
        }
        (VendorProfileId::LsXg5000, CanonicalAreaKind::IndexWord) => map_word(SimWordDeviceType::Z),
        (VendorProfileId::LsXg5000, CanonicalAreaKind::SystemWord) => {
            map_word(SimWordDeviceType::N)
        }
        (VendorProfileId::LsXg5000, CanonicalAreaKind::TimerValueWord) => {
            map_word(SimWordDeviceType::Td)
        }
        (VendorProfileId::LsXg5000, CanonicalAreaKind::CounterValueWord) => {
            map_word(SimWordDeviceType::Cd)
        }
        (VendorProfileId::MelsecFxQCommon, CanonicalAreaKind::InputBit) => {
            ResolvedSimAddress::Bit {
                device: SimBitDeviceType::X,
                address,
            }
        }
        (VendorProfileId::MelsecFxQCommon, CanonicalAreaKind::OutputBit) => {
            ResolvedSimAddress::Bit {
                device: SimBitDeviceType::Y,
                address,
            }
        }
        (VendorProfileId::MelsecFxQCommon, CanonicalAreaKind::InternalBit) => {
            ResolvedSimAddress::Bit {
                device: SimBitDeviceType::M,
                address,
            }
        }
        (VendorProfileId::MelsecFxQCommon, CanonicalAreaKind::RetentiveBit) => {
            ResolvedSimAddress::Bit {
                device: SimBitDeviceType::K,
                address,
            }
        }
        (VendorProfileId::MelsecFxQCommon, CanonicalAreaKind::TimerDoneBit) => {
            ResolvedSimAddress::Bit {
                device: SimBitDeviceType::T,
                address,
            }
        }
        (VendorProfileId::MelsecFxQCommon, CanonicalAreaKind::CounterDoneBit) => {
            ResolvedSimAddress::Bit {
                device: SimBitDeviceType::C,
                address,
            }
        }
        (VendorProfileId::MelsecFxQCommon, CanonicalAreaKind::DataWord) => {
            map_word(SimWordDeviceType::D)
        }
        (_, CanonicalAreaKind::SystemBit) => {
            return Err("SystemBit is not bridged by the legacy simulator memory".to_string());
        }
        (_, area) => {
            return Err(format!(
                "Canonical area {:?} is not bridged to the legacy simulator memory yet",
                area
            ));
        }
    };

    Ok(resolved)
}

fn read_resolved_device(
    memory: &Arc<DeviceMemory>,
    resolved: ResolvedSimAddress,
) -> Result<DeviceValue, String> {
    match resolved {
        ResolvedSimAddress::Bit { device, address } => {
            let value = memory
                .read_bit(device, address)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
        ResolvedSimAddress::Word { device, address } => {
            let value = memory
                .read_word(device, address)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Word { value })
        }
        ResolvedSimAddress::WordBit {
            device,
            address,
            bit,
        } => {
            let value = memory
                .read_word_bit(device, address, bit)
                .map_err(|e| e.to_string())?;
            Ok(DeviceValue::Bit { value })
        }
    }
}

fn write_resolved_device(
    memory: &Arc<DeviceMemory>,
    resolved: ResolvedSimAddress,
    value: &DeviceValue,
) -> Result<(), String> {
    match (resolved, value) {
        (ResolvedSimAddress::Bit { device, address }, DeviceValue::Bit { value }) => memory
            .write_bit(device, address, *value)
            .map_err(|e| e.to_string()),
        (ResolvedSimAddress::Word { device, address }, DeviceValue::Word { value }) => memory
            .write_word(device, address, *value)
            .map_err(|e| e.to_string()),
        (
            ResolvedSimAddress::WordBit {
                device,
                address,
                bit,
            },
            DeviceValue::Bit { value },
        ) => memory
            .write_word_bit(device, address, bit, *value)
            .map_err(|e| e.to_string()),
        (ResolvedSimAddress::Bit { .. }, DeviceValue::Word { .. }) => {
            Err("Bit device requires a bit value".to_string())
        }
        (ResolvedSimAddress::Word { .. }, DeviceValue::Bit { .. }) => {
            Err("Word device requires a word value".to_string())
        }
        (ResolvedSimAddress::WordBit { .. }, DeviceValue::Word { .. }) => {
            Err("Word-bit address requires a bit value".to_string())
        }
    }
}

/// Read a device value
#[tauri::command]
pub fn sim_read_device(
    state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    address: String,
) -> Result<DeviceValue, String> {
    let engine_guard = state.engine.lock();

    let engine = engine_guard.as_ref().ok_or("Simulation is not running")?;

    let memory = engine.memory();
    let (_, resolved) = resolve_sim_address(Some(&project_state), &address)?;
    read_resolved_device(memory, resolved)
}

/// Write a device value
#[tauri::command]
pub fn sim_write_device(
    app: AppHandle,
    state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    address: String,
    value: DeviceValue,
) -> Result<(), String> {
    let engine_guard = state.engine.lock();

    let engine = engine_guard.as_ref().ok_or("Simulation is not running")?;

    let memory = engine.memory();
    let (normalized_address, resolved) = resolve_sim_address(Some(&project_state), &address)?;

    // Get old value for change event
    let old_value = read_resolved_device(memory, resolved)?;
    write_resolved_device(memory, resolved, &value)?;

    // Emit device change event
    let _ = app.emit(
        SIM_DEVICE_CHANGE_EVENT,
        serde_json::json!({
            "address": normalized_address,
            "oldValue": old_value,
            "newValue": value
        }),
    );

    // Check device breakpoints
    let debugger = state.debugger();
    if let Some(hit) = debugger.check_device_change(
        &normalized_address,
        serde_json::to_value(&old_value).unwrap_or_default(),
        serde_json::to_value(&value).unwrap_or_default(),
    ) {
        debugger.pause(hit.clone());
        let _ = app.emit(SIM_BREAKPOINT_HIT_EVENT, serde_json::json!({ "hit": hit }));
    }

    Ok(())
}

/// Read a range of device memory
#[tauri::command]
pub fn sim_read_memory_range(
    state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    device_type: String,
    start: u16,
    count: u16,
) -> Result<Vec<DeviceValue>, String> {
    let engine_guard = state.engine.lock();

    let engine = engine_guard.as_ref().ok_or("Simulation is not running")?;

    let memory = engine.memory();
    let mut values = Vec::with_capacity(count as usize);

    for i in 0..count {
        let addr = start.saturating_add(i);
        let resolved = resolve_range_address(Some(&project_state), &device_type, addr as u32)?;
        let value = read_resolved_device(memory, resolved)?;
        values.push(value);
    }

    Ok(values)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::{PlcHardwareTopology, PlcManufacturer};

    #[test]
    fn resolves_ls_word_bit_addresses_through_profile_bridge() {
        let settings = PlcSettings {
            manufacturer: PlcManufacturer::LS,
            model: "XGK".to_string(),
            scan_time_ms: 10,
            hardware_topology: PlcHardwareTopology::default(),
        };

        let (normalized, resolved) =
            resolve_sim_address_for_settings(&settings, "d0100.5").expect("ls address");

        assert_eq!(normalized, "D0100.5");
        assert_eq!(
            resolved,
            ResolvedSimAddress::WordBit {
                device: SimWordDeviceType::D,
                address: 100,
                bit: 5,
            }
        );
    }

    #[test]
    fn resolves_melsec_internal_input_and_output_addresses() {
        let settings = PlcSettings {
            manufacturer: PlcManufacturer::Mitsubishi,
            model: "FX5U".to_string(),
            scan_time_ms: 10,
            hardware_topology: PlcHardwareTopology::default(),
        };

        let (_, x) = resolve_sim_address_for_settings(&settings, "X10").expect("X should map");
        assert_eq!(
            x,
            ResolvedSimAddress::Bit {
                device: SimBitDeviceType::X,
                address: 0o10,
            }
        );

        let (_, m) = resolve_sim_address_for_settings(&settings, "M100").expect("M should map");
        assert_eq!(
            m,
            ResolvedSimAddress::Bit {
                device: SimBitDeviceType::M,
                address: 100,
            }
        );

        let (_, y) = resolve_sim_address_for_settings(&settings, "Y17").expect("Y should map");
        assert_eq!(
            y,
            ResolvedSimAddress::Bit {
                device: SimBitDeviceType::Y,
                address: 0o17,
            }
        );
    }

    #[test]
    fn resolves_xbc_p_output_window_through_ls_compat_layer() {
        let settings = PlcSettings {
            manufacturer: PlcManufacturer::LS,
            model: "XBC-DN32H".to_string(),
            scan_time_ms: 10,
            hardware_topology: PlcHardwareTopology::default(),
        };

        let (_, input) = resolve_sim_address_for_settings(&settings, "P0019").expect("P19");
        assert_eq!(
            input,
            ResolvedSimAddress::Bit {
                device: SimBitDeviceType::P,
                address: 19,
            }
        );

        let (_, output) = resolve_sim_address_for_settings(&settings, "P0020").expect("P20");
        assert_eq!(
            output,
            ResolvedSimAddress::Bit {
                device: SimBitDeviceType::P,
                address: 20,
            }
        );
    }
}

/// Get memory snapshot
#[tauri::command]
pub fn sim_get_memory_snapshot(state: State<'_, SimState>) -> Result<MemorySnapshot, String> {
    let engine_guard = state.engine.lock();

    let engine = engine_guard.as_ref().ok_or("Simulation is not running")?;

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
    state
        .debugger
        .remove_breakpoint(&id)
        .map_err(|e| e.to_string())
}

/// Enable or disable a breakpoint
#[tauri::command]
pub fn sim_set_breakpoint_enabled(
    state: State<'_, SimState>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    state
        .debugger
        .set_breakpoint_enabled(&id, enabled)
        .map_err(|e| e.to_string())?;
    Ok(())
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
    state
        .debugger
        .remove_watch(&address)
        .map_err(|e| e.to_string())
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

    let engine = engine_guard.as_ref().ok_or("Simulation is not running")?;

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
pub fn sim_get_debugger_state(state: State<'_, SimState>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "stepMode": state.debugger.is_step_mode(),
        "stepType": state.debugger.get_step_type(),
        "pausedAt": state.debugger.get_pause_state(),
        "breakpoints": state.debugger.get_breakpoints(),
        "watches": state.debugger.get_watches()
    }))
}

// ============================================================================
// Ladder Monitoring Commands
// ============================================================================

/// Start ladder monitoring mode
#[tauri::command]
pub fn ladder_start_monitoring(state: State<'_, SimState>) -> Result<(), String> {
    state.monitoring_active.store(true, Ordering::SeqCst);
    Ok(())
}

/// Stop ladder monitoring mode
#[tauri::command]
pub fn ladder_stop_monitoring(state: State<'_, SimState>) -> Result<(), String> {
    state.monitoring_active.store(false, Ordering::SeqCst);
    Ok(())
}

/// Force a device to a specific value
#[tauri::command]
pub fn ladder_force_device(
    state: State<'_, SimState>,
    address: String,
    value: serde_json::Value,
) -> Result<(), String> {
    state.forced_devices.write().insert(address, value);
    Ok(())
}

/// Release force on a device
#[tauri::command]
pub fn ladder_release_force(state: State<'_, SimState>, address: String) -> Result<(), String> {
    state.forced_devices.write().remove(&address);
    Ok(())
}
