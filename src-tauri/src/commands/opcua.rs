use std::fs;
use std::sync::Arc;

use parking_lot::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::opcua::{OpcUaConfig, OpcUaMemory, OpcUaSecurityPolicy, OpcUaServer, OpcUaStatus};
use crate::plc_runtime::{CanonicalMemory, VendorProfile, resolve_vendor_profile};
use crate::project::{OpcUaSecurityPolicySetting, ProjectConfig, SharedProjectManager};
use crate::sim::tag_registry::SharedTagRegistry;
use crate::commands::sim::SimState;

const OPCUA_STATUS_UPDATE_EVENT: &str = "opcua:status-update";

pub struct OpcUaState {
    pub server: Mutex<Option<Arc<OpcUaServer>>>,
    pub memory: Arc<OpcUaMemory>,
    pub project_owned: Mutex<bool>,
}

impl Default for OpcUaState {
    fn default() -> Self {
        Self {
            server: Mutex::new(None),
            memory: Arc::new(OpcUaMemory::new()),
            project_owned: Mutex::new(false),
        }
    }
}

#[tauri::command]
pub fn opcua_get_status(state: State<'_, OpcUaState>) -> Result<OpcUaStatus, String> {
    Ok(state
        .server
        .lock()
        .as_ref()
        .map(|server| server.status())
        .unwrap_or_default())
}

#[tauri::command]
pub async fn opcua_start_server(
    app: AppHandle,
    state: State<'_, OpcUaState>,
    sim_state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    mut config: OpcUaConfig,
) -> Result<OpcUaStatus, String> {
    let project_config = current_project_config(&project_state)?;
    let plc_settings = project_config
        .as_ref()
        .map(|project| project.plc.clone())
        .unwrap_or_default();
    let vendor_profile = resolve_vendor_profile(&plc_settings).map_err(|e| e.to_string())?;
    finalize_opcua_config(&app, &mut config, project_config.as_ref())?;

    let server = start_server_common(
        &app,
        &state,
        config,
        &sim_state.runtime().handle(),
        vendor_profile.as_ref(),
        &plc_settings,
        &sim_state.tag_registry(),
        false,
    )?;

    Ok(server.status())
}

#[tauri::command]
pub async fn opcua_stop_server(
    app: AppHandle,
    state: State<'_, OpcUaState>,
) -> Result<(), String> {
    stop_server_common(&app, &state)
}

pub fn opcua_start_project_simulation(
    app: &AppHandle,
    opcua_state: &OpcUaState,
    canonical_memory: &parking_lot::RwLock<CanonicalMemory>,
    vendor_profile: &dyn VendorProfile,
    project_config: &ProjectConfig,
    tag_registry: &SharedTagRegistry,
) -> Result<Arc<OpcUaServer>, String> {
    let mut config = OpcUaConfig {
        bind_address: project_config
            .network
            .plc_ip
            .clone()
            .unwrap_or_else(|| "127.0.0.1".to_string()),
        port: project_config.opcua.port,
        server_name: project_config.opcua.server_name.clone(),
        security_policy: match project_config.opcua.security_policy {
            OpcUaSecurityPolicySetting::None => OpcUaSecurityPolicy::None,
            OpcUaSecurityPolicySetting::Basic256Sha256 => OpcUaSecurityPolicy::Basic256Sha256,
        },
        anonymous_access: project_config.opcua.anonymous_access,
        certificate_path: None,
        private_key_path: None,
        pki_dir: None,
        username: project_config.opcua.username.clone(),
        password: project_config.opcua.password.clone(),
    };
    finalize_opcua_config(app, &mut config, Some(project_config))?;

    start_server_common(
        app,
        opcua_state,
        config,
        canonical_memory,
        vendor_profile,
        &project_config.plc,
        tag_registry,
        true,
    )
}

pub fn opcua_stop_project_simulation(
    app: &AppHandle,
    opcua_state: &OpcUaState,
) -> Result<(), String> {
    stop_server_common(app, opcua_state)
}

fn current_project_config(
    project_state: &State<'_, SharedProjectManager>,
) -> Result<Option<ProjectConfig>, String> {
    let manager = project_state
        .lock()
        .map_err(|e| format!("Failed to acquire project manager lock: {e}"))?;
    Ok(manager.get_current_project().map(|project| project.config.clone()))
}

fn finalize_opcua_config(
    app: &AppHandle,
    config: &mut OpcUaConfig,
    project_config: Option<&ProjectConfig>,
) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
    let opcua_dir = app_data_dir.join("opcua");
    let pki_dir = opcua_dir.join("pki");
    fs::create_dir_all(&pki_dir).map_err(|e| format!("Failed to create OPC UA PKI dir: {e}"))?;

    config.bind_address = project_config
        .and_then(|project| project.network.plc_ip.clone())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            if config.bind_address.trim().is_empty() {
                "127.0.0.1".to_string()
            } else {
                config.bind_address.clone()
            }
        });
    config.certificate_path.get_or_insert_with(|| "own/cert.der".into());
    config.private_key_path
        .get_or_insert_with(|| "private/private.pem".into());
    config.pki_dir.get_or_insert(pki_dir);
    if config.username.as_deref().map_or(true, str::is_empty) {
        config.username = Some("modone".to_string());
    }
    if config.password.as_deref().map_or(true, str::is_empty) {
        config.password = Some("modone".to_string());
    }
    Ok(())
}

fn start_server_common(
    app: &AppHandle,
    opcua_state: &OpcUaState,
    config: OpcUaConfig,
    canonical_memory: &parking_lot::RwLock<CanonicalMemory>,
    vendor_profile: &dyn VendorProfile,
    plc_settings: &crate::project::PlcSettings,
    tag_registry: &SharedTagRegistry,
    project_owned: bool,
) -> Result<Arc<OpcUaServer>, String> {
    {
        let server = opcua_state.server.lock();
        if let Some(ref existing) = *server {
            if existing.is_running() {
                return Err("OPC UA server is already running".into());
            }
        }
    }

    let server = Arc::new(OpcUaServer::new(config, Arc::clone(&opcua_state.memory)));
    server
        .start(canonical_memory, vendor_profile, plc_settings, tag_registry)
        .map_err(|e| e.to_string())?;

    *opcua_state.server.lock() = Some(Arc::clone(&server));
    *opcua_state.project_owned.lock() = project_owned;
    emit_status_update(app, &server.status());
    Ok(server)
}

fn stop_server_common(app: &AppHandle, opcua_state: &OpcUaState) -> Result<(), String> {
    if let Some(server) = opcua_state.server.lock().take() {
        server.stop().map_err(|e| e.to_string())?;
    }
    *opcua_state.project_owned.lock() = false;
    emit_status_update(app, &OpcUaStatus::default());
    Ok(())
}

fn emit_status_update(app: &AppHandle, status: &OpcUaStatus) {
    let _ = app.emit(OPCUA_STATUS_UPDATE_EVENT, status);
}
