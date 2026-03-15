use std::sync::Arc;

use parking_lot::Mutex;
use tauri::State;

use crate::opcua::{OpcUaConfig, OpcUaMemory, OpcUaSecurityPolicy, OpcUaServer, OpcUaStatus};

/// Managed Tauri state for the OPC UA server.
pub struct OpcUaState {
    pub server: Mutex<Option<Arc<OpcUaServer>>>,
    pub memory: Arc<OpcUaMemory>,
}

impl Default for OpcUaState {
    fn default() -> Self {
        Self {
            server: Mutex::new(None),
            memory: Arc::new(OpcUaMemory::new()),
        }
    }
}

/// Get OPC UA server status.
#[tauri::command]
pub fn opcua_get_status(state: State<'_, OpcUaState>) -> Result<OpcUaStatus, String> {
    let server = state.server.lock();
    Ok(server
        .as_ref()
        .map(|s| s.status())
        .unwrap_or_default())
}

/// Start the OPC UA server with the given configuration.
#[tauri::command]
pub async fn opcua_start_server(
    state: State<'_, OpcUaState>,
    config: OpcUaConfig,
) -> Result<OpcUaStatus, String> {
    let server = state.server.lock();
    if let Some(ref s) = *server {
        if s.is_running() {
            return Err("OPC UA server is already running".into());
        }
    }
    drop(server);

    // Create a new server instance
    let memory = Arc::clone(&state.memory);
    let new_server = Arc::new(OpcUaServer::new(config, memory));
    *state.server.lock() = Some(Arc::clone(&new_server));

    Ok(new_server.status())
}

/// Stop the OPC UA server.
#[tauri::command]
pub async fn opcua_stop_server(state: State<'_, OpcUaState>) -> Result<(), String> {
    let server = state.server.lock();
    if let Some(ref s) = *server {
        s.stop().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Start OPC UA server as part of project simulation lifecycle.
///
/// Called from sim_run when opcua.enabled is true in project config.
pub fn opcua_start_project_simulation(
    opcua_state: &OpcUaState,
    canonical_memory: &parking_lot::RwLock<crate::plc_runtime::CanonicalMemory>,
    vendor_profile: &dyn crate::plc_runtime::VendorProfile,
    project_config: &crate::project::ProjectConfig,
) -> Result<Arc<OpcUaServer>, String> {
    let opcua_settings = &project_config.opcua;

    let bind_address = project_config
        .network
        .plc_ip
        .clone()
        .unwrap_or_else(|| "0.0.0.0".to_string());

    let security_policy = match opcua_settings.security_policy {
        crate::project::OpcUaSecurityPolicySetting::None => OpcUaSecurityPolicy::None,
        crate::project::OpcUaSecurityPolicySetting::Basic256Sha256 => {
            OpcUaSecurityPolicy::Basic256Sha256
        }
    };

    let config = OpcUaConfig {
        bind_address,
        port: opcua_settings.port,
        server_name: opcua_settings.server_name.clone(),
        security_policy,
        anonymous_access: opcua_settings.anonymous_access,
        certificate_path: None,
        private_key_path: None,
    };

    let memory = Arc::clone(&opcua_state.memory);
    let server = Arc::new(OpcUaServer::new(config, memory));

    server
        .start(canonical_memory, vendor_profile, &project_config.plc)
        .map_err(|e| e.to_string())?;

    *opcua_state.server.lock() = Some(Arc::clone(&server));

    Ok(server)
}

/// Stop OPC UA server as part of project simulation lifecycle.
pub fn opcua_stop_project_simulation(opcua_state: &OpcUaState) -> Result<(), String> {
    let server = opcua_state.server.lock();
    if let Some(ref s) = *server {
        s.stop().map_err(|e| e.to_string())?;
    }
    Ok(())
}
