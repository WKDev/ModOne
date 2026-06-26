use std::fs;
use std::net::{IpAddr, TcpListener};
use std::str::FromStr;
use std::sync::Arc;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::commands::sim::SimState;
use crate::commands::tags::MappingStoreState;
use crate::opcua::auth::UserRole;
use crate::opcua::{
    resolve_verified_credentials_audited, AuditLogQuery, AuditLogResult,
    AuditLoggerState, CredentialCache, OpcUaConfig, OpcUaMappingStore, OpcUaMemory,
    OpcUaSecurityPolicy, OpcUaServer, OpcUaSessionInfo, OpcUaStatus, UserAccountInfo,
    UserAccountStore,
};
use crate::plc_runtime::{resolve_vendor_profile, CanonicalMemory, VendorProfile};
use crate::project::{validate_project_config, ProjectConfig, SharedProjectManager};
use crate::sim::tag_registry::SharedTagRegistry;

const OPCUA_STATUS_UPDATE_EVENT: &str = "opcua:status-update";

/// Request to create a new user account.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub role: UserRole,
}

/// Request to update an existing user account.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserRequest {
    pub username: String,
    /// If provided, the password will be changed.
    pub password: Option<String>,
    /// If provided, the role will be changed.
    pub role: Option<UserRole>,
    /// If provided, the enabled state will be changed.
    pub enabled: Option<bool>,
}

// ============================================================================
// OPC UA State
// ============================================================================

/// Thread-safe wrapper for the persistent user account store.
///
/// Initialized during app setup with the app data directory path so
/// accounts are persisted to `<app_data_dir>/opcua_accounts.json`.
pub struct UserAccountStoreState(pub Mutex<UserAccountStore>);

/// Thread-safe wrapper for the in-memory credential cache.
///
/// Holds plaintext passwords deposited during account CRUD operations.
/// These are never persisted to disk and are lost on app restart.
/// The cache is used at server startup to resolve verified credentials
/// that can be registered with the opcua crate.
pub struct CredentialCacheState(pub Mutex<CredentialCache>);

impl Default for CredentialCacheState {
    fn default() -> Self {
        Self(Mutex::new(CredentialCache::new()))
    }
}

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

/// Returns detailed information about all active OPC UA client sessions.
///
/// The frontend polls this periodically to populate the session monitoring table.
#[tauri::command]
pub fn opcua_get_sessions(state: State<'_, OpcUaState>) -> Result<Vec<OpcUaSessionInfo>, String> {
    Ok(state
        .server
        .lock()
        .as_ref()
        .map(|server| server.get_sessions())
        .unwrap_or_default())
}

#[tauri::command]
pub async fn opcua_start_server(
    app: AppHandle,
    state: State<'_, OpcUaState>,
    sim_state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    mapping_store_state: State<'_, MappingStoreState>,
    account_store_state: State<'_, UserAccountStoreState>,
    credential_cache_state: State<'_, CredentialCacheState>,
    audit_state: State<'_, AuditLoggerState>,
    mut config: OpcUaConfig,
) -> Result<OpcUaStatus, String> {
    let project_config = current_project_config(&project_state)?;
    let plc_settings = project_config
        .as_ref()
        .map(|project| project.plc.clone())
        .unwrap_or_default();
    let vendor_profile = resolve_vendor_profile(&plc_settings).map_err(|e| e.to_string())?;

    // Resolve multi-account credentials from the account store + credential cache.
    // Audit events are emitted for each authentication outcome.
    resolve_config_credentials(
        &mut config,
        &account_store_state,
        &credential_cache_state,
        Some(&audit_state),
    );

    finalize_opcua_config(&app, &mut config, project_config.as_ref())?;

    let server = start_server_common(
        &app,
        &state,
        config,
        &sim_state.runtime().handle(),
        vendor_profile.as_ref(),
        &plc_settings,
        &sim_state.tag_registry(),
        Some(&mapping_store_state.store),
        false,
        Some(&audit_state),
    )?;

    Ok(server.status())
}

#[tauri::command]
pub async fn opcua_stop_server(
    app: AppHandle,
    state: State<'_, OpcUaState>,
    audit_state: State<'_, AuditLoggerState>,
) -> Result<(), String> {
    stop_server_common(&app, &state, Some(&audit_state))
}

/// Atomically restart the OPC UA server: stop if running, then start with
/// the latest project configuration and resolved credentials.
///
/// This is the canonical way to apply settings changes (security policies,
/// anonymous access, user accounts, address space) that require a restart.
#[tauri::command]
pub async fn opcua_restart_server(
    app: AppHandle,
    state: State<'_, OpcUaState>,
    sim_state: State<'_, SimState>,
    project_state: State<'_, SharedProjectManager>,
    mapping_store_state: State<'_, MappingStoreState>,
    account_store_state: State<'_, UserAccountStoreState>,
    credential_cache_state: State<'_, CredentialCacheState>,
    audit_state: State<'_, AuditLoggerState>,
    mut config: OpcUaConfig,
) -> Result<OpcUaStatus, String> {
    // Stop the running server first (ignore "not running" errors).
    let _ = stop_server_with_reason(&app, &state, Some(&audit_state), "restart");

    let project_config = current_project_config(&project_state)?;
    let plc_settings = project_config
        .as_ref()
        .map(|project| project.plc.clone())
        .unwrap_or_default();
    let vendor_profile = resolve_vendor_profile(&plc_settings).map_err(|e| e.to_string())?;

    resolve_config_credentials(
        &mut config,
        &account_store_state,
        &credential_cache_state,
        Some(&audit_state),
    );

    finalize_opcua_config(&app, &mut config, project_config.as_ref())?;

    let server = start_server_common(
        &app,
        &state,
        config,
        &sim_state.runtime().handle(),
        vendor_profile.as_ref(),
        &plc_settings,
        &sim_state.tag_registry(),
        Some(&mapping_store_state.store),
        false,
        Some(&audit_state),
    )?;

    Ok(server.status())
}

pub fn opcua_start_project_simulation(
    app: &AppHandle,
    opcua_state: &OpcUaState,
    canonical_memory: &Arc<parking_lot::RwLock<CanonicalMemory>>,
    vendor_profile: &dyn VendorProfile,
    project_config: &ProjectConfig,
    tag_registry: &SharedTagRegistry,
    mapping_store: Option<&OpcUaMappingStore>,
    account_store_state: Option<&UserAccountStoreState>,
    credential_cache_state: Option<&CredentialCacheState>,
    audit_state: Option<&AuditLoggerState>,
) -> Result<Arc<OpcUaServer>, String> {
    let mut config = OpcUaConfig {
        bind_address: project_config
            .network
            .plc_ip
            .clone()
            .unwrap_or_else(|| "127.0.0.1".to_string()),
        port: project_config.opcua.port,
        server_name: project_config.opcua.server_name.clone(),
        pki_dir: Default::default(),
        certificate_path: Default::default(),
        private_key_path: Default::default(),
        username: project_config.opcua.username.clone(),
        password: project_config.opcua.password.clone(),
        verified_credentials: Vec::new(),
        security_policies: project_config.opcua.security_policies.clone(),
        allow_anonymous: project_config.opcua.allow_anonymous,
    };

    // Resolve multi-account credentials if account store is available.
    // Audit events are emitted for each authentication outcome.
    if let (Some(store_state), Some(cache_state)) = (account_store_state, credential_cache_state) {
        resolve_config_credentials(&mut config, store_state, cache_state, audit_state);
    }

    finalize_opcua_config(app, &mut config, Some(project_config))?;

    start_server_common(
        app,
        opcua_state,
        config,
        canonical_memory,
        vendor_profile,
        &project_config.plc,
        tag_registry,
        mapping_store,
        true,
        audit_state,
    )
}

pub fn opcua_stop_project_simulation(
    app: &AppHandle,
    opcua_state: &OpcUaState,
    audit_state: Option<&AuditLoggerState>,
) -> Result<(), String> {
    stop_server_common(app, opcua_state, audit_state)
}

fn current_project_config(
    project_state: &State<'_, SharedProjectManager>,
) -> Result<Option<ProjectConfig>, String> {
    let manager = project_state
        .lock()
        .map_err(|e| format!("Failed to acquire project manager lock: {e}"))?;
    Ok(manager
        .get_current_project()
        .map(|project| project.config.clone()))
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
    config.certificate_path = "own/cert.der".into();
    config.private_key_path = "private/private.pem".into();
    config.pki_dir = pki_dir;

    let ip = IpAddr::from_str(&config.bind_address)
        .map_err(|_| format!("Invalid OPC UA bind address: {}", config.bind_address))?;
    if ip.is_unspecified() {
        return Err("OPC UA bind address must not be unspecified".into());
    }
    if TcpListener::bind((ip, 0)).is_err() {
        return Err(format!(
            "OPC UA bind address {} is not currently assigned to a local interface",
            config.bind_address
        ));
    }

    // Apply security policies from project config if available, otherwise keep config's own.
    // If still empty after that, fall back to default policies.
    if let Some(project_config) = project_config {
        if !project_config.opcua.security_policies.is_empty() {
            config.security_policies = project_config.opcua.security_policies.clone();
        }
        validate_project_config(project_config).map_err(|e| e.to_string())?;
    }
    if config.security_policies.is_empty() {
        config.security_policies = crate::opcua::OpcUaSecurityPolicy::default_enabled();
    }

    // Apply anonymous access from project config if available.
    if let Some(project_config) = project_config {
        config.allow_anonymous = project_config.opcua.allow_anonymous;
    }

    // When multi-account credentials are available, skip legacy username/password validation.
    // Also skip if anonymous access is enabled — server can start without credentials.
    if config.verified_credentials.is_empty() && !config.allow_anonymous {
        if config
            .username
            .as_deref()
            .map(str::trim)
            .unwrap_or_default()
            .is_empty()
        {
            return Err("OPC UA username is required (no multi-account credentials available and anonymous access is disabled)".into());
        }
        if config
            .password
            .as_deref()
            .map(str::trim)
            .unwrap_or_default()
            .is_empty()
        {
            return Err("OPC UA password is required (no multi-account credentials available and anonymous access is disabled)".into());
        }
    }

    Ok(())
}

fn start_server_common(
    app: &AppHandle,
    opcua_state: &OpcUaState,
    config: OpcUaConfig,
    canonical_memory: &Arc<parking_lot::RwLock<CanonicalMemory>>,
    vendor_profile: &dyn VendorProfile,
    plc_settings: &crate::project::PlcSettings,
    tag_registry: &SharedTagRegistry,
    mapping_store: Option<&OpcUaMappingStore>,
    project_owned: bool,
    audit_state: Option<&AuditLoggerState>,
) -> Result<Arc<OpcUaServer>, String> {
    {
        let server = opcua_state.server.lock();
        if let Some(ref existing) = *server {
            if existing.is_running() {
                return Err("OPC UA server is already running".into());
            }
        }
    }

    // Resolve audit data directory for the session monitor.
    let audit_data_dir = app
        .path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.to_path_buf());

    let server = Arc::new(OpcUaServer::new(config, Arc::clone(&opcua_state.memory)));

    // 프로젝트 토폴로지/태그 → OPC UA 주소공간 spec 해석은 src-tauri(여기)에서
    // 수행하고, 결과 spec만 백엔드에 넘긴다 (계약 §1: 코어는 project/sim 비결합).
    let spec = {
        let memory = canonical_memory.read();
        crate::opcua::address_space::build_address_space_spec(
            &memory,
            vendor_profile,
            plc_settings,
            tag_registry,
            mapping_store,
        )
    };

    server
        .start(canonical_memory, spec, audit_state, audit_data_dir)
        .map_err(|e| e.to_string())?;

    *opcua_state.server.lock() = Some(Arc::clone(&server));
    *opcua_state.project_owned.lock() = project_owned;
    emit_status_update(app, &server.status());
    Ok(server)
}

fn stop_server_common(
    app: &AppHandle,
    opcua_state: &OpcUaState,
    audit_state: Option<&AuditLoggerState>,
) -> Result<(), String> {
    stop_server_with_reason(app, opcua_state, audit_state, "user_request")
}

fn stop_server_with_reason(
    app: &AppHandle,
    opcua_state: &OpcUaState,
    audit_state: Option<&AuditLoggerState>,
    reason: &str,
) -> Result<(), String> {
    if let Some(server) = opcua_state.server.lock().take() {
        server
            .stop_with_reason(audit_state, reason)
            .map_err(|e| e.to_string())?;
    }
    *opcua_state.project_owned.lock() = false;
    emit_status_update(app, &OpcUaStatus::default());
    Ok(())
}

// ============================================================================
// Security Policy Commands
// ============================================================================

/// Info about a single security policy, sent to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityPolicyInfo {
    /// Enum variant key (e.g. "Basic256Sha256")
    pub id: OpcUaSecurityPolicy,
    /// Human-readable name (e.g. "Basic256Sha256")
    pub display_name: &'static str,
    /// OPC UA standard policy URI
    pub policy_uri: &'static str,
    /// Whether encryption is required
    pub requires_encryption: bool,
    /// Auto-determined message security mode
    pub message_security_mode: &'static str,
    /// Whether this policy is currently enabled in project config
    pub enabled: bool,
}

/// Returns all available security policies with their enabled state
/// based on the current project configuration.
#[tauri::command]
pub fn opcua_get_security_policies(
    project_state: State<'_, SharedProjectManager>,
) -> Result<Vec<SecurityPolicyInfo>, String> {
    let enabled_policies = current_project_config_policies(&project_state);
    let infos = OpcUaSecurityPolicy::all()
        .iter()
        .map(|policy| SecurityPolicyInfo {
            id: *policy,
            display_name: policy.display_name(),
            policy_uri: policy.policy_uri(),
            requires_encryption: policy.requires_encryption(),
            message_security_mode: policy.auto_message_security_mode(),
            enabled: enabled_policies.contains(policy),
        })
        .collect();
    Ok(infos)
}

/// Sets the enabled security policies in the current project configuration.
/// The server must be restarted for changes to take effect.
#[tauri::command]
pub fn opcua_set_security_policies(
    project_state: State<'_, SharedProjectManager>,
    policies: Vec<OpcUaSecurityPolicy>,
) -> Result<Vec<SecurityPolicyInfo>, String> {
    // Validate: at least one policy must be enabled
    if policies.is_empty() {
        return Err("At least one security policy must be enabled".into());
    }

    // Deduplicate while preserving order
    let mut seen = std::collections::HashSet::new();
    let deduped: Vec<OpcUaSecurityPolicy> = policies
        .into_iter()
        .filter(|p| seen.insert(*p))
        .collect();

    {
        let mut manager = project_state
            .lock()
            .map_err(|e| format!("Failed to acquire project manager lock: {e}"))?;
        let project = manager
            .get_current_project_mut()
            .ok_or("No project is currently open")?;
        project.config.opcua.security_policies = deduped.clone();
        project.is_modified = true;
    }

    // Return updated policy list with new enabled states
    let infos = OpcUaSecurityPolicy::all()
        .iter()
        .map(|policy| SecurityPolicyInfo {
            id: *policy,
            display_name: policy.display_name(),
            policy_uri: policy.policy_uri(),
            requires_encryption: policy.requires_encryption(),
            message_security_mode: policy.auto_message_security_mode(),
            enabled: deduped.contains(policy),
        })
        .collect();
    Ok(infos)
}

/// Helper to get enabled policies from the current project, or defaults if no project open.
fn current_project_config_policies(
    project_state: &State<'_, SharedProjectManager>,
) -> Vec<OpcUaSecurityPolicy> {
    let manager = match project_state.lock() {
        Ok(m) => m,
        Err(_) => return OpcUaSecurityPolicy::default_enabled(),
    };
    manager
        .get_current_project()
        .map(|project| project.config.opcua.security_policies.clone())
        .unwrap_or_else(OpcUaSecurityPolicy::default_enabled)
}

/// Resolve multi-account credentials from the UserAccountStore + CredentialCache
/// and populate the config's `verified_credentials` field.
///
/// Each enabled account whose plaintext password is cached and bcrypt-verified
/// will be included. If no accounts are configured or none can be verified,
/// the server will fall back to legacy `username`/`password` fields.
///
/// Authentication audit events are emitted for each credential resolution outcome
/// when an `AuditLoggerState` is provided.
fn resolve_config_credentials(
    config: &mut OpcUaConfig,
    account_store_state: &UserAccountStoreState,
    credential_cache_state: &CredentialCacheState,
    audit_state: Option<&AuditLoggerState>,
) {
    let store = account_store_state.0.lock();
    let cache = credential_cache_state.0.lock();
    let verified = resolve_verified_credentials_audited(&store, &cache, audit_state);

    if verified.is_empty() {
        log::info!(
            "No verified multi-account credentials available; \
             server will use legacy single-credential mode if configured."
        );
    } else {
        log::info!(
            "Resolved {} verified account(s) for OPC UA server authentication",
            verified.len()
        );
    }

    config.verified_credentials = verified;
}

fn emit_status_update(app: &AppHandle, status: &OpcUaStatus) {
    let _ = app.emit(OPCUA_STATUS_UPDATE_EVENT, status);
}

// ============================================================================
// Anonymous Access Commands
// ============================================================================

/// Returns the current anonymous access setting from the project configuration.
#[tauri::command]
pub fn opcua_get_anonymous_access(
    project_state: State<'_, SharedProjectManager>,
) -> Result<bool, String> {
    let manager = project_state
        .lock()
        .map_err(|e| format!("Failed to acquire project manager lock: {e}"))?;
    Ok(manager
        .get_current_project()
        .map(|project| project.config.opcua.allow_anonymous)
        .unwrap_or(false))
}

/// Sets the anonymous access toggle in the current project configuration.
/// The server must be restarted for the change to take effect.
#[tauri::command]
pub fn opcua_set_anonymous_access(
    project_state: State<'_, SharedProjectManager>,
    allow: bool,
) -> Result<bool, String> {
    let mut manager = project_state
        .lock()
        .map_err(|e| format!("Failed to acquire project manager lock: {e}"))?;
    let project = manager
        .get_current_project_mut()
        .ok_or("No project is currently open")?;
    project.config.opcua.allow_anonymous = allow;
    project.is_modified = true;
    Ok(allow)
}

// ============================================================================
// User Account CRUD Commands (persistent storage)
// ============================================================================

/// List all OPC UA user accounts (password hashes are never exposed to the frontend).
#[tauri::command]
pub fn opcua_list_user_accounts(
    state: State<'_, UserAccountStoreState>,
) -> Result<Vec<UserAccountInfo>, String> {
    let store = state.0.lock();
    Ok(store.list())
}

/// Add a new OPC UA user account with bcrypt-hashed password.
///
/// The plaintext password is also deposited into the in-memory credential cache
/// so it can be used when starting the OPC UA server (the opcua crate requires
/// plaintext for its built-in authentication).
///
/// Emits an `account.created` audit event on success.
#[tauri::command]
pub fn opcua_add_user_account(
    state: State<'_, UserAccountStoreState>,
    credential_cache_state: State<'_, CredentialCacheState>,
    audit_state: State<'_, AuditLoggerState>,
    request: CreateUserRequest,
) -> Result<UserAccountInfo, String> {
    let username = request.username.trim().to_string();
    if username.is_empty() {
        return Err("Username cannot be empty".into());
    }
    if request.password.is_empty() {
        return Err("Password cannot be empty".into());
    }
    if username.len() > 64 {
        return Err("Username must be 64 characters or fewer".into());
    }
    if request.password.len() < 4 {
        return Err("Password must be at least 4 characters".into());
    }

    let role_str = format!("{:?}", request.role);
    let mut store = state.0.lock();
    let info = store
        .add(&username, &request.password, request.role)
        .map_err(|e| e.to_string())?;

    // Deposit plaintext into credential cache for server registration.
    credential_cache_state
        .0
        .lock()
        .set(&username, request.password);

    // Emit audit event for account creation.
    audit_state.log_account_created(&username, &role_str);

    Ok(info)
}

/// Update an existing OPC UA user account (role, enabled, and/or password).
///
/// If a new password is provided, the credential cache is updated with
/// the new plaintext so it can be used on next server start.
///
/// Emits an `account.updated` audit event on success.
#[tauri::command]
pub fn opcua_update_user_account(
    state: State<'_, UserAccountStoreState>,
    credential_cache_state: State<'_, CredentialCacheState>,
    audit_state: State<'_, AuditLoggerState>,
    request: UpdateUserRequest,
) -> Result<UserAccountInfo, String> {
    let username = request.username.trim().to_string();
    if username.is_empty() {
        return Err("Username cannot be empty".into());
    }

    if let Some(ref password) = request.password {
        if password.is_empty() {
            return Err("Password cannot be empty".into());
        }
        if password.len() < 4 {
            return Err("Password must be at least 4 characters".into());
        }
    }

    // Build a summary of what changed for the audit event.
    let mut changes = Vec::new();
    if request.role.is_some() {
        changes.push(format!("role={:?}", request.role.unwrap()));
    }
    if let Some(enabled) = request.enabled {
        changes.push(format!("enabled={}", enabled));
    }
    if request.password.is_some() {
        changes.push("password changed".to_string());
    }

    let mut store = state.0.lock();
    let info = store
        .update(
            &username,
            request.role,
            request.enabled,
            request.password.as_deref(),
        )
        .map_err(|e| e.to_string())?;

    // Update credential cache if a new password was provided.
    if let Some(password) = request.password {
        credential_cache_state
            .0
            .lock()
            .set(&username, password);
    }

    // Emit audit event for account update.
    let changes_str = if changes.is_empty() {
        "no changes".to_string()
    } else {
        changes.join(", ")
    };
    audit_state.log_account_updated(&username, &changes_str);

    Ok(info)
}

/// Remove an OPC UA user account by username.
///
/// Also removes the corresponding entry from the credential cache.
///
/// Emits an `account.deleted` audit event on success.
#[tauri::command]
pub fn opcua_remove_user_account(
    state: State<'_, UserAccountStoreState>,
    credential_cache_state: State<'_, CredentialCacheState>,
    audit_state: State<'_, AuditLoggerState>,
    username: String,
) -> Result<(), String> {
    let trimmed = username.trim();
    if trimmed.is_empty() {
        return Err("Username cannot be empty".into());
    }
    let mut store = state.0.lock();
    store.remove(trimmed).map_err(|e| e.to_string())?;

    // Remove from credential cache as well.
    credential_cache_state.0.lock().remove(trimmed);

    // Emit audit event for account deletion.
    audit_state.log_account_deleted(trimmed);

    Ok(())
}

// ============================================================================
// Audit Log Commands
// ============================================================================

/// Query the OPC UA audit log with optional filters.
#[tauri::command]
pub fn opcua_query_audit_log(
    state: State<'_, AuditLoggerState>,
    query: AuditLogQuery,
) -> Result<AuditLogResult, String> {
    let guard = state.inner.lock();
    let logger = guard
        .as_ref()
        .ok_or_else(|| "Audit logger not initialized".to_string())?;
    logger.query(&query)
}

/// Clear all audit log entries.
#[tauri::command]
pub fn opcua_clear_audit_log(state: State<'_, AuditLoggerState>) -> Result<u64, String> {
    let guard = state.inner.lock();
    let logger = guard
        .as_ref()
        .ok_or_else(|| "Audit logger not initialized".to_string())?;
    logger.clear()
}

/// Enforce audit log retention policy (delete old entries).
#[tauri::command]
pub fn opcua_enforce_audit_retention(
    state: State<'_, AuditLoggerState>,
) -> Result<u64, String> {
    let guard = state.inner.lock();
    let logger = guard
        .as_ref()
        .ok_or_else(|| "Audit logger not initialized".to_string())?;
    logger.enforce_retention()
}

/// Get the total count of audit log entries.
#[tauri::command]
pub fn opcua_get_audit_log_count(state: State<'_, AuditLoggerState>) -> Result<u32, String> {
    let guard = state.inner.lock();
    let logger = guard
        .as_ref()
        .ok_or_else(|| "Audit logger not initialized".to_string())?;
    logger.count()
}

/// Get the current audit log retention policy (days).
#[tauri::command]
pub fn opcua_get_audit_retention_days(state: State<'_, AuditLoggerState>) -> Result<i64, String> {
    let guard = state.inner.lock();
    let logger = guard
        .as_ref()
        .ok_or_else(|| "Audit logger not initialized".to_string())?;
    Ok(logger.retention_days())
}

/// Set the audit log retention policy (days). Minimum 1 day.
/// Also immediately enforces the new retention policy.
#[tauri::command]
pub fn opcua_set_audit_retention_days(
    days: u32,
    state: State<'_, AuditLoggerState>,
) -> Result<u64, String> {
    let mut guard = state.inner.lock();
    let logger = guard
        .as_mut()
        .ok_or_else(|| "Audit logger not initialized".to_string())?;
    logger.set_retention_days(days.max(1) as i64);
    logger.enforce_retention()
}
