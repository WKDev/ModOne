//! Simulation Control Commands
//!
//! Tauri command handlers for PLC simulation control, memory access,
//! and debugging operations.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::commands::canvas_sync::CanvasSyncState;
use crate::commands::modbus::{
    modbus_start_project_simulation, modbus_stop_project_simulation, ModbusState,
};
use crate::commands::network::NetworkState;
use crate::commands::opcua::{
    opcua_start_project_simulation, opcua_stop_project_simulation, CredentialCacheState,
    OpcUaState, UserAccountStoreState,
};
use crate::opcua::AuditLoggerState;
use crate::modbus::ModbusMemory;
use crate::plc_runtime::{
    resolve_vendor_profile, CanonicalAddress, CanonicalValue, CanonicalWriteSource, VendorAddress,
};
use crate::project::{PlcSettings, ProjectConfig, SharedProjectManager};
use crate::sim::{
    debugger::{SimDebugger, StepResult, StepType},
    executor::{compile_program, LadderProgram},
    memory::CanonicalRuntimeFacade,
    runtime_host::SimulationRuntimeHost,
    tag_registry::SharedTagRegistry,
    types::{
        Breakpoint, ForcedDeviceValue, MemorySnapshot, RegisterTagRequest, RuntimeBinding,
        ScanCycleInfo, SimulationConfig, SimulationStatus, TagDefinition, WatchVariable,
    },
};

// ============================================================================
// Simulation State
// ============================================================================

/// Managed state for the simulation engine
pub struct SimState {
    host: Arc<SimulationRuntimeHost>,
}

impl Default for SimState {
    fn default() -> Self {
        Self::new()
    }
}

impl SimState {
    pub fn with_runtime(runtime: Arc<CanonicalRuntimeFacade>) -> Self {
        Self {
            host: Arc::new(SimulationRuntimeHost::with_runtime(
                runtime,
                Arc::new(crate::sim::tag_registry::TagRegistry::new()),
            )),
        }
    }

    /// Create with both canonical runtime and ModbusMemory for ModbusAdapter.
    pub fn with_runtime_and_modbus(
        runtime: Arc<CanonicalRuntimeFacade>,
        modbus_memory: Arc<ModbusMemory>,
        tag_registry: SharedTagRegistry,
    ) -> Self {
        Self {
            host: Arc::new(SimulationRuntimeHost::with_runtime_and_modbus(
                runtime,
                modbus_memory,
                tag_registry,
            )),
        }
    }

    /// Create a new simulation state
    pub fn new() -> Self {
        Self::with_runtime(Arc::new(CanonicalRuntimeFacade::new()))
    }

    /// Get the engine (if running)
    pub fn engine(&self) -> Arc<parking_lot::Mutex<Option<Arc<crate::sim::engine::OneSimEngine>>>> {
        self.host.engine()
    }

    pub fn runtime(&self) -> &Arc<CanonicalRuntimeFacade> {
        self.host.runtime()
    }

    /// Get the debugger
    pub fn debugger(&self) -> Arc<SimDebugger> {
        self.host.debugger()
    }

    pub fn host(&self) -> Arc<SimulationRuntimeHost> {
        Arc::clone(&self.host)
    }

    pub fn tag_registry(&self) -> SharedTagRegistry {
        self.host.tag_registry()
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchBindingRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub binding: Option<RuntimeBinding>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedBinding {
    pub binding: RuntimeBinding,
    pub display_address: String,
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
    network_state: State<'_, NetworkState>,
    opcua_state: State<'_, OpcUaState>,
    opcua_account_store: State<'_, UserAccountStoreState>,
    opcua_credential_cache: State<'_, CredentialCacheState>,
    mapping_store_state: State<'_, crate::commands::tags::MappingStoreState>,
    project_state: State<'_, SharedProjectManager>,
    canvas_sync_state: State<'_, CanvasSyncState>,
    params: Option<SimRunParams>,
) -> Result<(), String> {
    let project_config = current_project_config(&project_state)?;
    let plc_settings = project_config
        .as_ref()
        .map(|config| config.plc.clone())
        .unwrap_or_default();
    let profile = resolve_vendor_profile(&plc_settings).map_err(|e| e.to_string())?;

    if let Some(project_config) = project_config.as_ref() {
        if project_config.modbus.simulation.enabled {
            modbus_start_project_simulation(
                &modbus_state,
                &network_state,
                app.clone(),
                project_config,
            )
            .await?;
        }

        // Start OPC UA server if enabled
        if project_config.opcua.enabled {
            let canonical_memory_arc = state.runtime().handle();
            let audit_logger_state = app.try_state::<AuditLoggerState>();
            let opcua_server = opcua_start_project_simulation(
                &app,
                &opcua_state,
                &canonical_memory_arc,
                profile.as_ref(),
                project_config,
                &state.tag_registry(),
                Some(&mapping_store_state.store),
                Some(&opcua_account_store),
                Some(&opcua_credential_cache),
                audit_logger_state.as_deref(),
            )?;

            // Create OPC UA adapter and attach to protocol runtime
            let opcua_adapter = std::sync::Arc::new(crate::opcua::OpcUaAdapter::new(
                state.runtime().handle(),
                std::sync::Arc::clone(&opcua_state.memory),
                opcua_server,
            ));
            state.host().protocol_runtime().attach_adapter(
                "opcua",
                std::sync::Arc::clone(state.runtime()),
                opcua_adapter,
            )?;
        }
    }

    state.host().run(
        app,
        project_config,
        plc_settings,
        canvas_sync_state.canvas_sync(),
        params.and_then(|p| p.config),
    )
}

/// Stop the simulation
#[tauri::command]
pub async fn sim_stop(
    app: AppHandle,
    state: State<'_, SimState>,
    modbus_state: State<'_, ModbusState>,
    network_state: State<'_, NetworkState>,
    opcua_state: State<'_, OpcUaState>,
) -> Result<(), String> {
    state.host().stop(&app)?;
    let audit_logger_state = app.try_state::<AuditLoggerState>();
    opcua_stop_project_simulation(&app, &opcua_state, audit_logger_state.as_deref())?;
    modbus_stop_project_simulation(&modbus_state, &network_state).await
}

/// Pause the simulation
#[tauri::command]
pub fn sim_pause(app: AppHandle, state: State<'_, SimState>) -> Result<(), String> {
    state.host().pause(&app)
}

/// Resume the simulation
#[tauri::command]
pub fn sim_resume(app: AppHandle, state: State<'_, SimState>) -> Result<(), String> {
    state.host().resume(&app)
}

/// Reset the simulation
#[tauri::command]
pub async fn sim_reset(
    app: AppHandle,
    state: State<'_, SimState>,
    modbus_state: State<'_, ModbusState>,
    network_state: State<'_, NetworkState>,
    opcua_state: State<'_, OpcUaState>,
) -> Result<(), String> {
    state.host().reset(&app);
    let audit_logger_state = app.try_state::<AuditLoggerState>();
    opcua_stop_project_simulation(&app, &opcua_state, audit_logger_state.as_deref())?;
    modbus_stop_project_simulation(&modbus_state, &network_state).await?;
    Ok(())
}

/// Get simulation status
#[tauri::command]
pub fn sim_get_status(state: State<'_, SimState>) -> Result<SimulationStatus, String> {
    Ok(state.host().status())
}

/// Get scan cycle info
#[tauri::command]
pub fn sim_get_scan_info(state: State<'_, SimState>) -> Result<ScanCycleInfo, String> {
    Ok(state.host().scan_info())
}

/// Load a ladder program for simulation
#[tauri::command]
pub fn sim_load_program(
    state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    program: LadderProgram,
) -> Result<(), String> {
    let plc_settings = active_plc_settings(Some(&project_state))?;
    let profile = resolve_vendor_profile(&plc_settings).map_err(|e| e.to_string())?;
    let compiled = compile_program(&program, profile.as_ref()).map_err(|e| e.to_string())?;
    state.host().load_program(compiled);
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
) -> Result<(String, CanonicalAddress), String> {
    let plc_settings = active_plc_settings(project_state)?;
    resolve_sim_address_for_settings(&plc_settings, address)
}

fn resolve_runtime_binding(
    project_state: Option<&State<'_, SharedProjectManager>>,
    request: &WatchBindingRequest,
) -> Result<(RuntimeBinding, String), String> {
    if let Some(binding) = request.binding.clone() {
        let display = request
            .display_address
            .clone()
            .or_else(|| request.address.clone())
            .unwrap_or_else(|| format!("{binding:?}"));
        return Ok((binding, display));
    }

    let address = request
        .address
        .as_deref()
        .ok_or_else(|| "Watch/breakpoint request must include binding or address".to_string())?;
    let (normalized, canonical) = resolve_sim_address(project_state, address)?;
    Ok((RuntimeBinding::canonical(canonical), normalized))
}

#[tauri::command]
pub fn sim_resolve_binding(
    project_state: State<'_, SharedProjectManager>,
    address: String,
) -> Result<ResolvedBinding, String> {
    let (display_address, canonical) = resolve_sim_address(Some(&project_state), &address)?;
    Ok(ResolvedBinding {
        binding: RuntimeBinding::canonical(canonical),
        display_address,
    })
}

#[tauri::command]
pub fn sim_resolve_binding_parts(
    project_state: State<'_, SharedProjectManager>,
    family: String,
    index: u32,
) -> Result<ResolvedBinding, String> {
    let plc_settings = active_plc_settings(Some(&project_state))?;
    let profile = resolve_vendor_profile(&plc_settings).map_err(|e| e.to_string())?;
    let vendor_address = VendorAddress::new(family.to_uppercase(), index);
    let display_address = profile
        .format_address(&vendor_address)
        .unwrap_or_else(|_| format!("{}{}", family.to_uppercase(), index));
    let canonical = profile
        .to_canonical(&vendor_address)
        .map_err(|e| e.to_string())?;
    Ok(ResolvedBinding {
        binding: RuntimeBinding::canonical(canonical),
        display_address,
    })
}

fn resolve_sim_address_for_settings(
    plc_settings: &PlcSettings,
    address: &str,
) -> Result<(String, CanonicalAddress), String> {
    let profile = resolve_vendor_profile(&plc_settings).map_err(|e| e.to_string())?;
    let vendor_address = profile.parse_address(address).map_err(|e| e.to_string())?;
    let normalized_address = profile
        .format_address(&vendor_address)
        .unwrap_or_else(|_| address.to_uppercase());
    let canonical = profile
        .to_canonical(&vendor_address)
        .map_err(|e| e.to_string())?;
    Ok((normalized_address, canonical))
}

fn read_canonical_device(
    runtime: &Arc<CanonicalRuntimeFacade>,
    address: CanonicalAddress,
) -> Result<DeviceValue, String> {
    match runtime.read(address).map_err(|e| e.to_string())? {
        CanonicalValue::Bool(value) => Ok(DeviceValue::Bit { value }),
        CanonicalValue::U16(value) => Ok(DeviceValue::Word { value }),
    }
}

fn resolve_binding_to_canonical(
    registry: &SharedTagRegistry,
    binding: &RuntimeBinding,
) -> Result<CanonicalAddress, String> {
    registry.resolve_binding(binding).map_err(|e| e.to_string())
}

fn ensure_opcua_namespace_mutable(opcua_state: &OpcUaState) -> Result<(), String> {
    let server_guard = opcua_state.server.lock();
    if server_guard
        .as_ref()
        .map(|server| server.is_running())
        .unwrap_or(false)
    {
        return Err("namespace frozen during active OPC UA session".to_string());
    }
    Ok(())
}

fn write_canonical_device(
    runtime: &Arc<CanonicalRuntimeFacade>,
    address: CanonicalAddress,
    value: &DeviceValue,
) -> Result<(), String> {
    match value {
        DeviceValue::Bit { value } => runtime
            .write(
                address,
                CanonicalValue::Bool(*value),
                CanonicalWriteSource::Simulation,
            )
            .map_err(|e| e.to_string()),
        DeviceValue::Word { value } => runtime
            .write(
                address,
                CanonicalValue::U16(*value),
                CanonicalWriteSource::Simulation,
            )
            .map_err(|e| e.to_string()),
    }
}

#[tauri::command]
pub fn sim_read_binding(
    state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    request: WatchBindingRequest,
) -> Result<DeviceValue, String> {
    let engine_arc = state.engine();
    let engine_guard = engine_arc.lock();
    let engine = engine_guard.as_ref().ok_or("Simulation is not running")?;
    let runtime = engine.runtime();
    let (binding, _) = resolve_runtime_binding(Some(&project_state), &request)?;
    let canonical = resolve_binding_to_canonical(&state.tag_registry(), &binding)?;
    read_canonical_device(runtime, canonical)
}

#[tauri::command]
pub fn sim_write_binding(
    app: AppHandle,
    state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    request: WatchBindingRequest,
    value: DeviceValue,
) -> Result<(), String> {
    let engine_arc = state.engine();
    let engine_guard = engine_arc.lock();
    let engine = engine_guard.as_ref().ok_or("Simulation is not running")?;
    let runtime = engine.runtime();
    let (binding, display_address) = resolve_runtime_binding(Some(&project_state), &request)?;
    let canonical = resolve_binding_to_canonical(&state.tag_registry(), &binding)?;
    let old_value = read_canonical_device(runtime, canonical)?;
    write_canonical_device(runtime, canonical, &value)?;

    let _ = app.emit(
        SIM_DEVICE_CHANGE_EVENT,
        serde_json::json!({
            "address": display_address,
            "binding": binding,
            "oldValue": old_value,
            "newValue": value
        }),
    );

    let debugger = state.debugger();
    if let Some(hit) = debugger.check_device_change(
        &binding,
        &display_address,
        serde_json::to_value(&old_value).unwrap_or_default(),
        serde_json::to_value(&value).unwrap_or_default(),
    ) {
        debugger.pause(hit.clone());
        let _ = app.emit(SIM_BREAKPOINT_HIT_EVENT, serde_json::json!({ "hit": hit }));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::opcua::OpcUaState;
    use crate::opcua::{OpcUaConfig, OpcUaMemory, OpcUaServer};
    use crate::plc_runtime::CanonicalAreaKind;
    use crate::plc_runtime::{CanonicalMemory, CanonicalValue, CanonicalWriteSource};
    use crate::project::{PlcHardwareTopology, PlcManufacturer};
    use crate::sim::tag_registry::TagRegistry;
    use parking_lot::RwLock;
    use std::sync::Arc;

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
            CanonicalAddress::with_bit_index(CanonicalAreaKind::DataWord, 100, 5)
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
        assert_eq!(x, CanonicalAddress::new(CanonicalAreaKind::InputBit, 0o10));

        let (_, m) = resolve_sim_address_for_settings(&settings, "M100").expect("M should map");
        assert_eq!(
            m,
            CanonicalAddress::new(CanonicalAreaKind::InternalBit, 100)
        );

        let (_, y) = resolve_sim_address_for_settings(&settings, "Y17").expect("Y should map");
        assert_eq!(y, CanonicalAddress::new(CanonicalAreaKind::OutputBit, 0o17));
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
            CanonicalAddress::new(CanonicalAreaKind::InputBit, 19)
        );

        let (_, output) = resolve_sim_address_for_settings(&settings, "P0020").expect("P20");
        assert_eq!(
            output,
            CanonicalAddress::new(CanonicalAreaKind::OutputBit, 20)
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn opcua_running_session_freezes_tag_namespace_mutations() {
        let settings = PlcSettings {
            manufacturer: PlcManufacturer::LS,
            model: "XGK".to_string(),
            scan_time_ms: 10,
            hardware_topology: PlcHardwareTopology::default(),
        };
        let profile = resolve_vendor_profile(&settings).unwrap();
        let canonical_memory = Arc::new(RwLock::new(CanonicalMemory::new()));
        canonical_memory
            .write()
            .write(
                CanonicalAddress::new(CanonicalAreaKind::OutputBit, 0),
                CanonicalValue::Bool(false),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();
        let tag_registry = Arc::new(TagRegistry::new());
        let temp = tempfile::tempdir().unwrap();
        let port_listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = port_listener.local_addr().unwrap().port();
        drop(port_listener);

        let server = Arc::new(OpcUaServer::new(
            OpcUaConfig {
                bind_address: "127.0.0.1".to_string(),
                port,
                server_name: "Namespace Freeze Test".to_string(),
                pki_dir: temp.path().join("pki"),
                certificate_path: "own/cert.der".into(),
                private_key_path: "private/private.pem".into(),
                username: Some("freeze-user".to_string()),
                password: Some("freeze-pass".to_string()),
                ..OpcUaConfig::default()
            },
            Arc::new(OpcUaMemory::new()),
        ));
        server
            .start(
                &canonical_memory,
                profile.as_ref(),
                &settings,
                &tag_registry,
                None,
                None,
                None,
            )
            .unwrap();

        let opcua_state = OpcUaState {
            server: parking_lot::Mutex::new(Some(server.clone())),
            memory: Arc::new(OpcUaMemory::new()),
            project_owned: parking_lot::Mutex::new(false),
        };

        let err = ensure_opcua_namespace_mutable(&opcua_state).unwrap_err();
        assert_eq!(err, "namespace frozen during active OPC UA session");

        server.stop(None).unwrap();
    }
}

/// Get memory snapshot
#[tauri::command]
pub fn sim_get_memory_snapshot(state: State<'_, SimState>) -> Result<MemorySnapshot, String> {
    let engine_arc = state.engine();
    let engine_guard = engine_arc.lock();

    let engine = engine_guard.as_ref().ok_or("Simulation is not running")?;

    Ok(engine.runtime().get_snapshot(
        "sim",
        engine.get_status().scan_count,
        engine
            .timer_mgr()
            .get_all_states()
            .into_iter()
            .map(|(k, v)| (k as u32, v))
            .collect(),
        engine
            .counter_mgr()
            .get_all_states()
            .into_iter()
            .map(|(k, v)| (k as u32, v))
            .collect(),
    ))
}

#[tauri::command]
pub fn sim_register_tag(
    state: State<'_, SimState>,
    opcua_state: State<'_, OpcUaState>,
    mut request: RegisterTagRequest,
) -> Result<TagDefinition, String> {
    ensure_opcua_namespace_mutable(&opcua_state)?;
    if request.canonical_address.is_none() {
        if let Some(binding) = request.binding.clone() {
            request.canonical_address = Some(resolve_binding_to_canonical(
                &state.tag_registry(),
                &binding,
            )?);
        }
    }

    if request.canonical_address.is_none() {
        return Err("Tag registration requires a canonical binding".to_string());
    }

    if request.vendor_aliases.is_empty() {
        if let Some(RuntimeBinding::Canonical { address }) = request.binding.as_ref() {
            request
                .vendor_aliases
                .push(format!("{:?}:{}", address.area, address.index));
        }
    }

    state
        .tag_registry()
        .register_semantic(request)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sim_get_tag(state: State<'_, SimState>, tag_id: String) -> Result<TagDefinition, String> {
    state
        .tag_registry()
        .resolve(&tag_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sim_list_tags(
    state: State<'_, SimState>,
    include_raw: Option<bool>,
) -> Result<Vec<TagDefinition>, String> {
    Ok(state.tag_registry().list(include_raw.unwrap_or(false)))
}

#[tauri::command]
pub fn sim_remove_tag(
    state: State<'_, SimState>,
    opcua_state: State<'_, OpcUaState>,
    mapping_store: State<'_, crate::commands::tags::MappingStoreState>,
    tag_id: String,
) -> Result<(), String> {
    ensure_opcua_namespace_mutable(&opcua_state)?;
    state
        .tag_registry()
        .remove(&tag_id)
        .map_err(|e| e.to_string())?;
    // Synchronized removal: clean up OpcUaMappingConfig entry for deleted tag
    mapping_store.store.remove(&tag_id);
    Ok(())
}

#[tauri::command]
pub fn sim_create_raw_tag(
    state: State<'_, SimState>,
    opcua_state: State<'_, OpcUaState>,
    project_state: State<'_, SharedProjectManager>,
    request: WatchBindingRequest,
) -> Result<TagDefinition, String> {
    ensure_opcua_namespace_mutable(&opcua_state)?;
    let (binding, display_address) = resolve_runtime_binding(Some(&project_state), &request)?;
    let canonical = resolve_binding_to_canonical(&state.tag_registry(), &binding)?;
    Ok(state.tag_registry().register_raw(
        canonical,
        Some(display_address.clone()),
        vec![display_address],
    ))
}

// ============================================================================
// Debugging Commands
// ============================================================================

/// Add a breakpoint
#[tauri::command]
pub fn sim_add_breakpoint(
    state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    breakpoint: Breakpoint,
) -> Result<String, String> {
    let mut breakpoint = breakpoint;
    if breakpoint.breakpoint_type == crate::sim::types::BreakpointType::Device
        && breakpoint.device_binding.is_none()
    {
        if let Some(address) = breakpoint.device_address.as_deref() {
            let (_, canonical) = resolve_sim_address(Some(&project_state), address)?;
            breakpoint.device_binding = Some(RuntimeBinding::canonical(canonical));
        }
    }

    let id = state.debugger().add_breakpoint(breakpoint);
    Ok(id)
}

/// Remove a breakpoint
#[tauri::command]
pub fn sim_remove_breakpoint(state: State<'_, SimState>, id: String) -> Result<(), String> {
    state
        .debugger()
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
        .debugger()
        .set_breakpoint_enabled(&id, enabled)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get all breakpoints
#[tauri::command]
pub fn sim_get_breakpoints(state: State<'_, SimState>) -> Result<Vec<Breakpoint>, String> {
    Ok(state.debugger().get_breakpoints())
}

/// Add a watch variable
#[tauri::command]
pub fn sim_add_watch(
    state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    request: WatchBindingRequest,
) -> Result<(), String> {
    let (binding, display_address) = resolve_runtime_binding(Some(&project_state), &request)?;
    let tracked_display_address = display_address.clone();
    let engine_arc = state.engine();
    let engine_guard = engine_arc.lock();

    if let Some(ref engine) = *engine_guard {
        state
            .debugger()
            .add_watch_binding(binding.clone(), display_address, engine.runtime());
        state
            .host()
            .monitoring()
            .register_binding(binding, tracked_display_address);
        Ok(())
    } else {
        // Add watch without initial value
        let runtime = CanonicalRuntimeFacade::new();
        state
            .debugger()
            .add_watch_binding(binding.clone(), display_address, &runtime);
        state
            .host()
            .monitoring()
            .register_binding(binding, tracked_display_address);
        Ok(())
    }
}

/// Remove a watch variable
#[tauri::command]
pub fn sim_remove_watch(
    state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    request: WatchBindingRequest,
) -> Result<(), String> {
    let (binding, _) = resolve_runtime_binding(Some(&project_state), &request)?;
    state.host().monitoring().unregister_binding(&binding);
    state
        .debugger()
        .remove_watch_binding(&binding)
        .map_err(|e| e.to_string())
}

/// Get all watch variables
#[tauri::command]
pub fn sim_get_watches(state: State<'_, SimState>) -> Result<Vec<WatchVariable>, String> {
    Ok(state.debugger().get_watches())
}

/// Step execution (network or scan)
#[tauri::command]
pub fn sim_step(
    app: AppHandle,
    state: State<'_, SimState>,
    step_type: StepType,
) -> Result<StepResult, String> {
    let engine_arc = state.engine();
    let engine_guard = engine_arc.lock();

    let engine = engine_guard.as_ref().ok_or("Simulation is not running")?;

    // Enable step mode
    state.debugger().enable_step_mode(step_type);

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
        breakpoint_hit: state.debugger().get_pause_state(),
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
    state.debugger().continue_execution();

    // Resume the engine
    sim_resume(app, state)
}

/// Get debugger state
#[tauri::command]
pub fn sim_get_debugger_state(state: State<'_, SimState>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "stepMode": state.debugger().is_step_mode(),
        "stepType": state.debugger().get_step_type(),
        "pausedAt": state.debugger().get_pause_state(),
        "breakpoints": state.debugger().get_breakpoints(),
        "watches": state.debugger().get_watches()
    }))
}

// ============================================================================
// Ladder Monitoring Commands
// ============================================================================

/// Start ladder monitoring mode
#[tauri::command]
pub fn ladder_start_monitoring(state: State<'_, SimState>) -> Result<(), String> {
    state.host().monitoring().set_active(true);
    Ok(())
}

/// Stop ladder monitoring mode
#[tauri::command]
pub fn ladder_stop_monitoring(state: State<'_, SimState>) -> Result<(), String> {
    state.host().monitoring().set_active(false);
    Ok(())
}

/// Force a device to a specific value
#[tauri::command]
pub fn ladder_force_device(
    state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    request: WatchBindingRequest,
    value: serde_json::Value,
) -> Result<(), String> {
    let (binding, display_address) = resolve_runtime_binding(Some(&project_state), &request)?;
    state.host().monitoring().force_device(ForcedDeviceValue {
        binding,
        display_address,
        value,
    });
    Ok(())
}

/// Release force on a device
#[tauri::command]
pub fn ladder_release_force(
    state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    request: WatchBindingRequest,
) -> Result<(), String> {
    let (binding, display_address) = resolve_runtime_binding(Some(&project_state), &request)?;
    state
        .host()
        .monitoring()
        .release_force(&display_address, &binding);
    Ok(())
}
