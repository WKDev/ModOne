use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Arc;

use parking_lot::Mutex;

use crate::plc_runtime::{
    CanonicalAddress, CanonicalMemory, CanonicalMemoryError, CanonicalValue,
};

#[cfg(feature = "opcua-server")]
use super::address_space::OpcUaAccessLevel;
use super::address_space::AddressSpaceSpec;
use super::audit::{AuditEventType, AuditLoggerState, AuditSeverity, OpcuaAuditState, OpcuaAuditStore};
use super::memory::{OpcUaMemory, OpcUaNodeId};
use super::types::{OpcUaConfig, OpcUaError, OpcUaSessionInfo, OpcUaStatus};
#[cfg(feature = "opcua-server")]
use sha2::{Digest, Sha256};

const DEFAULT_ENDPOINT_PATH: &str = "/";
#[cfg(feature = "opcua-server")]
const DISCOVERY_ENDPOINT_PATH: &str = "/discovery";
#[cfg(feature = "opcua-server")]
const LOCAL_USER_TOKEN_ID: &str = "MODONE_LOCAL_USER";
#[cfg(feature = "opcua-server")]
const RESERVED_NAMESPACE_URI: &str = "urn:modone:internal:reserved";
#[cfg(feature = "opcua-server")]
const USER_TOKEN_PREFIX: &str = "MODONE_USER";

#[derive(Debug, Clone, Default)]
struct CertificateMetadata {
    fingerprint: Option<String>,
    valid_to: Option<String>,
}

pub struct OpcUaServer {
    config: OpcUaConfig,
    running: Arc<AtomicBool>,
    server_task: Mutex<Option<tokio::task::JoinHandle<()>>>,
    opcua_memory: Arc<OpcUaMemory>,
    address_spec: Mutex<Option<AddressSpaceSpec>>,
    certificate_metadata: Mutex<CertificateMetadata>,
    /// Session monitor that polls session count and emits audit events
    /// for client connect/disconnect lifecycle events.
    session_monitor: Mutex<Option<SessionMonitor>>,
    #[cfg(feature = "opcua-server")]
    inner_server: Mutex<Option<Arc<parking_lot::RwLock<opcua::server::prelude::Server>>>>,
    #[cfg(feature = "opcua-server")]
    server_initialised: AtomicBool,
    #[cfg(feature = "opcua-server")]
    namespace_index: AtomicU16,
}

impl OpcUaServer {
    pub fn new(config: OpcUaConfig, opcua_memory: Arc<OpcUaMemory>) -> Self {
        Self {
            config,
            running: Arc::new(AtomicBool::new(false)),
            server_task: Mutex::new(None),
            opcua_memory,
            address_spec: Mutex::new(None),
            certificate_metadata: Mutex::new(CertificateMetadata::default()),
            session_monitor: Mutex::new(None),
            #[cfg(feature = "opcua-server")]
            inner_server: Mutex::new(None),
            #[cfg(feature = "opcua-server")]
            server_initialised: AtomicBool::new(false),
            #[cfg(feature = "opcua-server")]
            namespace_index: AtomicU16::new(0),
        }
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed) && self.feature_enabled()
    }

    pub fn status(&self) -> OpcUaStatus {
        let mut status = OpcUaStatus {
            running: self.is_running(),
            port: self.config.port,
            endpoint: if self.is_running() {
                format!(
                    "opc.tcp://{}:{}{}",
                    self.config.bind_address, self.config.port, DEFAULT_ENDPOINT_PATH
                )
            } else {
                String::new()
            },
            endpoint_path: DEFAULT_ENDPOINT_PATH.to_string(),
            feature_enabled: self.feature_enabled(),
            active_security_policies: if self.is_running() {
                self.config.security_policies.clone()
            } else {
                Vec::new()
            },
            allow_anonymous: if self.is_running() {
                self.config.allow_anonymous
            } else {
                false
            },
            ..OpcUaStatus::default()
        };

        let certificate_metadata = self.certificate_metadata.lock().clone();
        status.certificate_fingerprint = certificate_metadata.fingerprint;
        status.certificate_valid_to = certificate_metadata.valid_to;

        #[cfg(feature = "opcua-server")]
        if let Some(server) = self.inner_server.lock().as_ref().cloned() {
            let server_guard = server.read();
            let server_state = server_guard.server_state();
            let server_state_guard = server_state.read();
            let connections = server_guard.connections();
            let metrics_arc = server_guard.server_metrics();
            let mut metrics = metrics_arc.write();
            metrics.update_from_server_state(&server_state_guard);
            metrics.update_from_connections(connections.read().clone());
            status.session_count = metrics
                .diagnostics
                .server_diagnostics_summary()
                .current_session_count;
            status.session_count_supported = true;
        }

        status
    }

    /// Returns detailed information about all active client sessions.
    ///
    /// Iterates over the server's live connection list via the
    /// `ServerMetrics::update_from_connections` pipeline, which internally
    /// accesses `pub(crate)` session methods (subscriptions, etc.) and
    /// produces serializable metric structs with client address, session id,
    /// activation state, and subscription counts.
    pub fn get_sessions(&self) -> Vec<OpcUaSessionInfo> {
        if !self.is_running() {
            return Vec::new();
        }

        #[cfg(feature = "opcua-server")]
        {
            return self.collect_session_details();
        }

        #[cfg(not(feature = "opcua-server"))]
        Vec::new()
    }

    /// Collect detailed session information from the server's connections
    /// using the `ServerMetrics` pipeline, enriched with per-session details
    /// tracked by the [`SessionMonitor`].
    ///
    /// The metrics pipeline calls `update_from_connections()` which internally
    /// accesses `pub(crate)` methods on `Session` (like `subscriptions()`)
    /// that are not accessible from outside the opcua crate. This gives us
    /// subscription counts, session activation state, and client addresses.
    ///
    /// The [`SessionMonitor`] maintains a shared [`HashMap`] of
    /// [`SessionDetail`] records keyed by `(client_address, session_id)`.
    /// When available, we use these records for:
    /// - `connected_at` — ISO 8601 timestamp when the session was first observed
    /// - `security_policy` — inferred from the connection's transport state
    /// - `subscription_count` — kept in sync each poll cycle
    #[cfg(feature = "opcua-server")]
    fn collect_session_details(&self) -> Vec<OpcUaSessionInfo> {
        let server = match self.inner_server.lock().as_ref().cloned() {
            Some(s) => s,
            None => return Vec::new(),
        };

        // Grab the monitor's shared session details (if the monitor is running).
        let monitor_details: Option<HashMap<SessionKey, SessionDetail>> = self
            .session_monitor
            .lock()
            .as_ref()
            .map(|m| m.session_details.lock().clone());

        let server_guard = server.read();
        let server_state = server_guard.server_state();
        let server_state_guard = server_state.read();
        let connections = server_guard.connections();
        let metrics_arc = server_guard.server_metrics();
        let mut metrics = metrics_arc.write();
        metrics.update_from_server_state(&server_state_guard);
        metrics.update_from_connections(connections.read().clone());

        let mut result = Vec::new();

        for connection in &metrics.connections {
            // Parse client IP from the socket address debug string.
            // Format is typically "V4(127.0.0.1:54321)" or "127.0.0.1:54321".
            let client_ip = parse_client_ip(&connection.client_address);

            for session in &connection.sessions {
                // Skip terminated sessions.
                if session.session_terminated {
                    continue;
                }

                let key = (connection.client_address.clone(), session.id.clone());
                let subscription_count = session.subscriptions.subscriptions.len() as u32;

                // Enrich with monitor-tracked details when available.
                let now_fallback = chrono::Utc::now()
                    .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
                let (security_policy, connected_at, last_contact_time, tracked_sub_count) =
                    if let Some(ref details_map) = monitor_details {
                        if let Some(detail) = details_map.get(&key) {
                            (
                                detail.security_policy.clone(),
                                detail.connected_at.clone(),
                                detail.last_contact_time.clone(),
                                detail.subscription_count,
                            )
                        } else {
                            // Session not yet tracked by monitor — use fallbacks.
                            (
                                infer_security_policy(
                                    &connection.transport_state,
                                    &self.config.security_policies,
                                ),
                                now_fallback.clone(),
                                now_fallback.clone(),
                                subscription_count,
                            )
                        }
                    } else {
                        // Monitor not running — use crate-level fallbacks.
                        (
                            connection.transport_state.clone(),
                            metrics.server.start_time.clone(),
                            now_fallback.clone(),
                            subscription_count,
                        )
                    };

                // Derive session state from activation status.
                let state = if session.session_activated {
                    "Activated".to_string()
                } else {
                    "Created".to_string()
                };

                // Build a stable secure channel ID from the connection's
                // client address (the crate does not expose a discrete
                // SecureChannelId, so we hash the address deterministically).
                let secure_channel_id = {
                    let hash: u32 = connection.client_address
                        .bytes()
                        .fold(0u32, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u32));
                    format!("SC-{}", hash)
                };

                // The server endpoint URI for this session.
                let server_uri = format!(
                    "opc.tcp://{}:{}{}",
                    self.config.bind_address, self.config.port, DEFAULT_ENDPOINT_PATH
                );

                result.push(OpcUaSessionInfo {
                    session_id: session.id.clone(),
                    client_name: if session.id.is_empty() {
                        "OPC UA Client".to_string()
                    } else {
                        session.id.clone()
                    },
                    client_description: String::new(), // opcua 0.12 does not expose ApplicationDescription
                    client_ip: client_ip.clone(),
                    server_uri,
                    security_policy,
                    security_mode: if session.session_activated {
                        "SignAndEncrypt".to_string()
                    } else {
                        "None".to_string()
                    },
                    connected_at,
                    last_contact_time,
                    secure_channel_id,
                    state,
                    subscription_count: tracked_sub_count.max(subscription_count),
                });
            }
        }

        result
    }

    /// Start the OPC UA server with optional audit logging.
    ///
    /// * `audit_logger` — if provided, a server-started audit event is recorded.
    /// * `audit_data_dir` — if provided, a session monitor is spawned that opens
    ///   its own SQLite connection for client connect/disconnect auditing.
    pub fn start(
        &self,
        canonical_memory: &Arc<parking_lot::RwLock<CanonicalMemory>>,
        spec: AddressSpaceSpec,
        audit_logger: Option<&AuditLoggerState>,
        audit_data_dir: Option<PathBuf>,
    ) -> Result<(), OpcUaError> {
        if self.is_running() {
            return Err(OpcUaError::Server(
                "OPC UA server is already running".into(),
            ));
        }

        if !self.feature_enabled() {
            return Err(OpcUaError::Config(
                "OPC UA server feature is not enabled in this build".into(),
            ));
        }

        // `spec`는 호출부(src-tauri 조립 지점)에서 프로젝트 토폴로지/태그로부터
        // 미리 빌드해 넘겨준다. 이 메서드는 project/sim에 결합되지 않는다(계약 §1).
        self.opcua_memory
            .register_nodes(spec.primary_node_map.clone(), spec.publish_map.clone());

        #[cfg(feature = "opcua-server")]
        self.start_opcua_server(&spec, Arc::clone(canonical_memory))?;

        *self.address_spec.lock() = Some(spec);
        self.running.store(true, Ordering::Relaxed);

        // Enforce audit log retention policy on server start
        if let Some(logger) = audit_logger {
            match logger.enforce_retention() {
                Ok(deleted) if deleted > 0 => {
                    log::info!(
                        "Audit log retention: purged {} old entries on server start",
                        deleted
                    );
                }
                Err(e) => {
                    log::warn!("Audit log retention enforcement failed on server start: {e}");
                }
                _ => {}
            }
        }

        // Emit server-started audit event with AuditEventType::ServerStart
        if let Some(logger) = audit_logger {
            logger.record(
                AuditEventType::ServerStart,
                AuditSeverity::Info,
                &format!(
                    "OPC UA server started on {}:{}",
                    self.config.bind_address, self.config.port
                ),
                Some(&format!(
                    "{{\"bind_address\":\"{}\",\"port\":{},\"security_policies\":{}}}",
                    self.config.bind_address,
                    self.config.port,
                    serde_json::to_string(&self.config.security_policies).unwrap_or_default()
                )),
                Some("server"),
                None,
            );
        }

        // Start session monitor for client connect/disconnect auditing
        #[cfg(feature = "opcua-server")]
        self.start_session_monitor(audit_data_dir);

        Ok(())
    }

    pub fn stop(&self, audit_logger: Option<&AuditLoggerState>) -> Result<(), OpcUaError> {
        self.stop_with_reason(audit_logger, "user_request")
    }

    /// Stop the OPC UA server, recording the shutdown reason in the audit log.
    ///
    /// `reason` is a short tag describing *why* the server is stopping, e.g.
    /// `"user_request"`, `"signal"` (SIGINT/SIGTERM), or `"app_shutdown"`.
    pub fn stop_with_reason(
        &self,
        audit_logger: Option<&AuditLoggerState>,
        reason: &str,
    ) -> Result<(), OpcUaError> {
        if !self.is_running() {
            return Ok(());
        }

        // Stop session monitor before shutting down server
        self.stop_session_monitor();

        self.running.store(false, Ordering::Relaxed);

        #[cfg(feature = "opcua-server")]
        self.stop_opcua_server();

        if let Some(task) = self.server_task.lock().take() {
            task.abort();
        }

        *self.address_spec.lock() = None;
        self.opcua_memory.clear();

        // Emit server-stopped audit event with shutdown reason
        if let Some(logger) = audit_logger {
            logger.record(
                AuditEventType::ServerStop,
                AuditSeverity::Info,
                &format!("OPC UA server stopped (reason: {})", reason),
                Some(&format!("{{\"reason\":\"{}\"}}", reason)),
                Some("server"),
                None,
            );
        }

        Ok(())
    }

    /// Stop the session monitor if running.
    fn stop_session_monitor(&self) {
        if let Some(monitor) = self.session_monitor.lock().take() {
            monitor.stop();
        }
    }

    pub fn update_node_values(
        &self,
        windows: &[crate::modbus::DirtyPublishWindow],
        canonical_memory: &CanonicalMemory,
        publish_map: &HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
    ) -> Result<(), OpcUaError> {
        if !self.is_running() {
            return Ok(());
        }

        #[cfg(feature = "opcua-server")]
        self.update_opcua_node_values(windows, canonical_memory, publish_map)?;

        Ok(())
    }

    pub fn sync_all_node_values(
        &self,
        canonical_memory: &CanonicalMemory,
        publish_map: &HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
    ) -> Result<(), OpcUaError> {
        if !self.is_running() {
            return Ok(());
        }

        #[cfg(feature = "opcua-server")]
        self.sync_all_opcua_node_values(canonical_memory, publish_map)?;

        Ok(())
    }

    fn feature_enabled(&self) -> bool {
        cfg!(feature = "opcua-server")
    }

    /// Resolve user tokens from verified multi-account credentials or legacy single-user config.
    ///
    /// Returns a list of (token_id, ServerUserToken) pairs ready for registration
    /// with the OPC UA server builder.
    ///
    /// **Bcrypt verification chain:** Multi-account credentials in
    /// `self.config.verified_credentials` have already been verified against
    /// their bcrypt password hashes by [`resolve_verified_credentials`] before
    /// reaching this method. Only credentials whose plaintext password matched
    /// the stored bcrypt hash are present. The verified plaintext is then
    /// registered with `ServerUserToken::user_pass()` so the opcua crate's
    /// built-in IdentityToken comparison accepts the same password the client
    /// provides during session activation.
    ///
    /// Multi-account credentials take precedence over the legacy single
    /// `username`/`password` fields.
    #[cfg(feature = "opcua-server")]
    fn resolve_user_tokens(
        &self,
    ) -> Result<Vec<(String, opcua::server::prelude::ServerUserToken)>, OpcUaError> {
        use opcua::server::prelude::ServerUserToken;

        let mut entries = Vec::new();

        if !self.config.verified_credentials.is_empty() {
            // Multi-account mode: register each verified credential as a separate token.
            for (idx, cred) in self.config.verified_credentials.iter().enumerate() {
                let token_id = format!("{}_{}", USER_TOKEN_PREFIX, idx);
                let token = ServerUserToken::user_pass(
                    cred.username.clone(),
                    cred.plaintext_password.clone(),
                );
                log::debug!(
                    "Registering account '{}' (role: {:?}) as token '{}'",
                    cred.username,
                    cred.role,
                    token_id
                );
                entries.push((token_id, token));
            }
        } else {
            // Legacy fallback: single username/password from config.
            let username = self
                .config
                .username
                .as_ref()
                .map(|value| value.trim())
                .filter(|value| !value.is_empty());
            let password = self
                .config
                .password
                .as_ref()
                .map(|value| value.trim())
                .filter(|value| !value.is_empty());

            match (username, password) {
                (Some(user), Some(pass)) => {
                    log::info!(
                        "Using legacy single-credential mode for user '{}'",
                        user
                    );
                    entries.push((
                        LOCAL_USER_TOKEN_ID.to_string(),
                        ServerUserToken::user_pass(user.to_string(), pass.to_string()),
                    ));
                }
                _ if self.config.allow_anonymous => {
                    // No credentials but anonymous access is enabled — that's fine.
                    log::info!(
                        "No user credentials configured; anonymous access will be the only \
                         authentication method."
                    );
                }
                _ => {
                    return Err(OpcUaError::Config(
                        "Username and password are required for OPC UA \
                         (or enable anonymous access)"
                            .into(),
                    ));
                }
            }
        }

        Ok(entries)
    }

    #[cfg(feature = "opcua-server")]
    fn start_opcua_server(
        &self,
        spec: &AddressSpaceSpec,
        canonical_memory: Arc<parking_lot::RwLock<CanonicalMemory>>,
    ) -> Result<(), OpcUaError> {
        use opcua::server::prelude::*;

        // Resolve account credentials: prefer multi-account store, fall back to legacy single-user.
        let user_token_entries = self.resolve_user_tokens()?;
        if user_token_entries.is_empty() && !self.config.allow_anonymous {
            return Err(OpcUaError::Config(
                "No valid user credentials available for OPC UA server. \
                 Add at least one account, provide legacy username/password, \
                 or enable anonymous access."
                    .into(),
            ));
        }

        let certificate_metadata = bootstrap_server_pki(&self.config)?;
        *self.certificate_metadata.lock() = certificate_metadata;

        // Collect all user token IDs for endpoint registration.
        let mut user_token_ids: Vec<String> = user_token_entries
            .iter()
            .map(|(id, _)| id.clone())
            .collect();

        // When anonymous access is enabled, include the ANONYMOUS token in endpoints.
        if self.config.allow_anonymous {
            user_token_ids.push(
                opcua::server::prelude::ANONYMOUS_USER_TOKEN_ID.to_string(),
            );
            log::info!("Anonymous access enabled — unauthenticated clients will be accepted");
        }

        let trust_client_certs = std::env::var("MODONE_OPCUA_TRUST_CLIENT_CERTS")
            .ok()
            .as_deref()
            == Some("1");

        let mut builder = ServerBuilder::new()
            .application_name(&self.config.server_name)
            .application_uri(&format!("urn:modone:{}", self.config.server_name))
            .product_uri("urn:modone:opcua")
            .host_and_port(&self.config.bind_address, self.config.port)
            .pki_dir(&self.config.pki_dir)
            .certificate_path(&self.config.certificate_path)
            .private_key_path(&self.config.private_key_path)
            .create_sample_keypair(false)
            .discovery_urls(vec![
                DEFAULT_ENDPOINT_PATH.to_string(),
                DISCOVERY_ENDPOINT_PATH.to_string(),
            ]);

        // Register each verified account as a separate ServerUserToken.
        for (token_id, server_user_token) in &user_token_entries {
            builder = builder.user_token(token_id, server_user_token.clone());
        }
        log::info!(
            "Registered {} user account(s) with OPC UA server",
            user_token_entries.len()
        );

        if trust_client_certs {
            builder = builder.trust_client_certs();
        }

        // Generate endpoints dynamically based on the user-selected security policies.
        // Each policy gets a named endpoint; the message security mode is auto-determined
        // per policy (None → no security, others → SignAndEncrypt).
        let policies = if self.config.security_policies.is_empty() {
            super::types::OpcUaSecurityPolicy::default_enabled()
        } else {
            self.config.security_policies.clone()
        };

        for (idx, policy) in policies.iter().enumerate() {
            let endpoint = build_server_endpoint(*policy, DEFAULT_ENDPOINT_PATH, &user_token_ids);
            let name = if idx == 0 {
                "default".to_string()
            } else {
                format!("policy_{}", idx)
            };
            builder = builder.endpoint(&name, endpoint);
        }

        // Always add a discovery endpoint (no security, no user tokens).
        builder = builder.endpoint(
            "discovery",
            ServerEndpoint::new_none(DISCOVERY_ENDPOINT_PATH, &[]),
        );

        let server = builder.server().ok_or_else(|| {
            OpcUaError::Server("Failed to build OPC UA server from config".into())
        })?;

        let address_space = server.address_space();
        {
            let mut as_lock = address_space.write();
            as_lock
                .register_namespace(RESERVED_NAMESPACE_URI)
                .map_err(|_| {
                    OpcUaError::AddressSpace("Failed to register reserved namespace".into())
                })?;
            let app_namespace_uri = format!("urn:modone:{}", self.config.server_name);
            let ns = as_lock
                .register_namespace(&app_namespace_uri)
                .map_err(|_| OpcUaError::AddressSpace("Failed to register namespace".into()))?;
            self.namespace_index.store(ns, Ordering::Release);

            let mut folders: HashMap<String, NodeId> = HashMap::new();
            for node_spec in &spec.nodes {
                let parent_id =
                    ensure_folder_path(&mut as_lock, ns, &mut folders, &node_spec.path_segments);
                let node_id = NodeId::new(ns, node_spec.node_id.identifier.clone());

                let vb =
                    VariableBuilder::new(&node_id, &node_spec.browse_name, &node_spec.display_name);
                let vb = if node_spec.is_bool {
                    vb.data_type(DataTypeId::Boolean).value(false)
                } else {
                    vb.data_type(DataTypeId::UInt16).value(0u16)
                };
                let vb = if node_spec.requires_live_value_getter() {
                    let canonical_memory = Arc::clone(&canonical_memory);
                    let canonical_address = node_spec.canonical_address;
                    let getter = AttrFnGetter::new_boxed(
                        move |_node_id,
                              timestamps_to_return,
                              attribute_id,
                              _index_range,
                              _data_encoding,
                              _max_age| {
                            if attribute_id != AttributeId::Value {
                                return Ok(None);
                            }

                            let value = canonical_memory.read().read(canonical_address);
                            Ok(Some(canonical_data_value(value, timestamps_to_return)))
                        },
                    );
                    vb.value_getter(getter)
                } else {
                    vb
                };
                let vb = if node_spec.access_level == OpcUaAccessLevel::ReadWrite {
                    vb.writable()
                } else {
                    vb
                };
                let vb = if node_spec.access_level == OpcUaAccessLevel::ReadWrite {
                    let opcua_memory = Arc::clone(&self.opcua_memory);
                    let identifier = node_spec.node_id.identifier.clone();
                    let setter = AttrFnSetter::new_boxed(
                        move |_node_id, _attr_id, _range, value: DataValue| {
                            let canonical_addr = opcua_memory
                                .resolve_identifier(&identifier)
                                .ok_or(StatusCode::BadNodeIdUnknown)?;
                            let variant =
                                value.value.as_ref().ok_or(StatusCode::BadTypeMismatch)?;
                            let canonical_value = variant_to_canonical_value(variant)?;
                            opcua_memory.record_external_write(canonical_addr, canonical_value);
                            Ok(())
                        },
                    );
                    vb.value_setter(setter)
                } else {
                    vb
                };
                // Apply optional description from OpcUaMappingConfig
                let vb = if let Some(ref desc) = node_spec.description {
                    vb.description(desc.as_str())
                } else {
                    vb
                };

                // Attach variable to parent folder via HasComponent reference
                // (consistent with FolderType folder hierarchy).
                vb.component_of(parent_id.clone()).insert(&mut as_lock);

                // If the node has an engineering unit, add an EngineeringUnits
                // property as an EUInformation extension object (OPC UA Part 8).
                if let Some(ref eu_str) = node_spec.engineering_unit {
                    add_engineering_units_property(
                        &mut as_lock,
                        ns,
                        &node_id,
                        &node_spec.node_id.identifier,
                        eu_str,
                    );
                }
            }
        }

        let server = Arc::new(parking_lot::RwLock::new(server));
        *self.inner_server.lock() = Some(Arc::clone(&server));
        self.server_initialised.store(true, Ordering::Release);

        let inner = Arc::clone(&server);
        let running = Arc::clone(&self.running);
        let task = tokio::task::spawn_blocking(move || {
            opcua::server::prelude::Server::run_server(inner);
            running.store(false, Ordering::Relaxed);
        });

        *self.server_task.lock() = Some(task);
        Ok(())
    }

    #[cfg(feature = "opcua-server")]
    fn stop_opcua_server(&self) {
        if let Some(server) = self.inner_server.lock().take() {
            server.write().abort();
            self.server_initialised.store(false, Ordering::Release);
            self.namespace_index.store(0, Ordering::Release);
        }
    }

    /// Start the session monitor that polls session count and emits audit events
    /// for client connect/disconnect lifecycle events.
    ///
    /// The monitor opens its own SQLite connection to the audit log database
    /// (SQLite WAL mode supports concurrent writers) so it can operate
    /// independently in an async task without borrowing the shared AuditLoggerState.
    #[cfg(feature = "opcua-server")]
    fn start_session_monitor(&self, audit_data_dir: Option<PathBuf>) {
        let server = match self.inner_server.lock().as_ref().cloned() {
            Some(s) => s,
            None => return,
        };
        let Some(data_dir) = audit_data_dir else {
            log::debug!("Session monitor not started: no audit data directory provided");
            return;
        };

        let monitor = SessionMonitor::new();
        monitor.start(server, data_dir, self.config.security_policies.clone());
        *self.session_monitor.lock() = Some(monitor);
    }

    #[cfg(feature = "opcua-server")]
    fn update_opcua_node_values(
        &self,
        windows: &[crate::modbus::DirtyPublishWindow],
        canonical_memory: &CanonicalMemory,
        publish_map: &HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
    ) -> Result<(), OpcUaError> {
        use opcua::server::prelude::*;

        let namespace_index = self.namespace_index.load(Ordering::Acquire);
        if !self.server_initialised.load(Ordering::Acquire) || namespace_index == 0 {
            return Ok(());
        }

        let server = match self.inner_server.lock().as_ref().cloned() {
            Some(server) => server,
            None => return Ok(()),
        };
        let server_guard = server.read();
        let address_space = server_guard.address_space();
        let mut as_lock = address_space.write();
        let now = DateTime::now();

        for (canonical_addr, node_ids) in publish_map {
            let in_window = windows.iter().any(|window| {
                window.area == canonical_addr.area
                    && canonical_addr.index >= window.start_index
                    && canonical_addr.index <= window.end_index
            });
            if !in_window {
                continue;
            }

            if let Ok(value) = canonical_memory.read(*canonical_addr) {
                let variant = match value {
                    CanonicalValue::Bool(b) => Variant::Boolean(b),
                    CanonicalValue::U16(w) => Variant::UInt16(w),
                };
                for node_id in node_ids {
                    let opcua_node_id = NodeId::new(namespace_index, node_id.identifier.clone());
                    let _ = as_lock.set_variable_value(&opcua_node_id, variant.clone(), &now, &now);
                }
            }
        }

        Ok(())
    }

    #[cfg(feature = "opcua-server")]
    fn sync_all_opcua_node_values(
        &self,
        canonical_memory: &CanonicalMemory,
        publish_map: &HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
    ) -> Result<(), OpcUaError> {
        use opcua::server::prelude::*;

        let namespace_index = self.namespace_index.load(Ordering::Acquire);
        if !self.server_initialised.load(Ordering::Acquire) || namespace_index == 0 {
            return Ok(());
        }

        let server = match self.inner_server.lock().as_ref().cloned() {
            Some(server) => server,
            None => return Ok(()),
        };
        let server_guard = server.read();
        let address_space = server_guard.address_space();
        let mut as_lock = address_space.write();
        let now = DateTime::now();

        for (canonical_addr, node_ids) in publish_map {
            if let Ok(value) = canonical_memory.read(*canonical_addr) {
                let variant = match value {
                    CanonicalValue::Bool(b) => Variant::Boolean(b),
                    CanonicalValue::U16(w) => Variant::UInt16(w),
                };
                for node_id in node_ids {
                    let opcua_node_id = NodeId::new(namespace_index, node_id.identifier.clone());
                    let _ = as_lock.set_variable_value(&opcua_node_id, variant.clone(), &now, &now);
                }
            }
        }

        Ok(())
    }
}

// ============================================================================
// Session Monitor — detects client connect/disconnect via session count delta
// ============================================================================

/// Default polling interval for the session monitor (2 seconds).
const SESSION_MONITOR_POLL_INTERVAL: std::time::Duration = std::time::Duration::from_secs(2);

/// Per-session detail record tracked externally by the [`SessionMonitor`].
///
/// The opcua 0.12 crate does not expose connection timestamps or the
/// negotiated security policy per session. We track these externally:
/// - `connected_at` is recorded when a new session key is first observed.
/// - `security_policy` is inferred by matching the connection's transport
///   state against the server's configured endpoint security policies.
/// - `subscription_count` is updated on every poll cycle from the crate's
///   metrics pipeline.
#[derive(Debug, Clone)]
struct SessionDetail {
    /// Remote IP address of the connected client.
    client_ip: String,
    /// Inferred security policy display name (e.g. "Basic256Sha256").
    security_policy: String,
    /// ISO 8601 timestamp when the session was first observed (connect time).
    connected_at: String,
    /// ISO 8601 timestamp of the last time the monitor observed this session.
    last_contact_time: String,
    /// Number of active subscriptions on this session (updated each poll).
    subscription_count: u32,
    /// Session activation (authentication) state from the last poll.
    activated: bool,
}

/// Composite key for uniquely identifying a session within the monitor.
type SessionKey = (String, String); // (client_address, session_id)

/// Thread-safe map of per-session detail records shared between
/// the [`SessionMonitor`] polling task and the `collect_session_details`
/// method on [`OpcUaServer`].
type SharedSessionDetails = Arc<Mutex<HashMap<SessionKey, SessionDetail>>>;

/// Monitors OPC UA server session count changes and emits audit events
/// for client connect and disconnect lifecycle events.
///
/// The opcua 0.12 crate does not provide direct session lifecycle callbacks,
/// so we poll session metrics at a fixed interval and detect deltas.
///
/// In addition to audit logging, the monitor maintains a
/// [`SharedSessionDetails`] map that tracks per-session details (client IP,
/// inferred security policy, connection timestamp, subscription count).
/// This map is read by [`OpcUaServer::collect_session_details`] to enrich
/// the [`OpcUaSessionInfo`] structs returned to the frontend.
struct SessionMonitor {
    cancel: Arc<AtomicBool>,
    task: Mutex<Option<tokio::task::JoinHandle<()>>>,
    /// Per-session detail records shared with `OpcUaServer::collect_session_details`.
    session_details: SharedSessionDetails,
}

impl SessionMonitor {
    fn new() -> Self {
        Self {
            cancel: Arc::new(AtomicBool::new(false)),
            task: Mutex::new(None),
            session_details: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Returns a clone of the shared session details map for reading.
    fn shared_details(&self) -> SharedSessionDetails {
        Arc::clone(&self.session_details)
    }

    /// Start the session monitor polling loop.
    ///
    /// Opens its own `AuditLogger` connection to the given data directory
    /// (SQLite WAL mode handles concurrent access) and polls session count
    /// at a fixed interval.
    ///
    /// `security_policies` is the list of policies configured on the server,
    /// used to infer which security policy each session is using based on
    /// the connection's transport state string from the opcua crate metrics.
    #[cfg(feature = "opcua-server")]
    fn start(
        &self,
        server: Arc<parking_lot::RwLock<opcua::server::prelude::Server>>,
        audit_data_dir: PathBuf,
        security_policies: Vec<super::types::OpcUaSecurityPolicy>,
    ) {
        let cancel = Arc::clone(&self.cancel);
        let details = Arc::clone(&self.session_details);
        self.cancel.store(false, Ordering::Relaxed);

        let handle = tokio::spawn(async move {
            // Open a dedicated audit logger for the monitor task.
            let audit_logger = match super::audit::open_opcua_audit(&audit_data_dir) {
                Ok(logger) => logger,
                Err(e) => {
                    log::error!("Session monitor: failed to open audit logger: {e}");
                    return;
                }
            };

            log::info!("OPC UA session monitor started (poll interval: {:?})", SESSION_MONITOR_POLL_INTERVAL);
            // Track sessions by (client_address, session_id) to detect individual
            // connect/disconnect events and capture client IP addresses.
            let mut known_sessions: HashSet<(String, String)> = HashSet::new();
            // Track sessions that have been activated (authenticated) to emit
            // AuthSuccess audit events exactly once per session activation.
            let mut authenticated_sessions: HashSet<(String, String)> = HashSet::new();

            loop {
                if cancel.load(Ordering::Relaxed) {
                    break;
                }

                tokio::time::sleep(SESSION_MONITOR_POLL_INTERVAL).await;

                if cancel.load(Ordering::Relaxed) {
                    break;
                }

                // Collect current active sessions with their client addresses,
                // activation (authentication) status, and per-session metrics
                // (subscription count, transport state for security policy inference).
                let (current_sessions, activated_sessions_snapshot, live_session_data): (
                    HashSet<SessionKey>,
                    HashSet<SessionKey>,
                    Vec<(SessionKey, String, u32, bool)>, // (key, transport_state, sub_count, activated)
                ) = {
                    let server_guard = server.read();
                    let server_state = server_guard.server_state();
                    let server_state_guard = server_state.read();
                    let connections = server_guard.connections();
                    let metrics_arc = server_guard.server_metrics();
                    let mut metrics = metrics_arc.write();
                    metrics.update_from_server_state(&server_state_guard);
                    metrics.update_from_connections(connections.read().clone());

                    let mut sessions = HashSet::new();
                    let mut activated = HashSet::new();
                    let mut data = Vec::new();
                    for connection in &metrics.connections {
                        let client_addr = connection.client_address.clone();
                        let transport_state = connection.transport_state.clone();
                        for session in &connection.sessions {
                            if !session.session_terminated {
                                let key = (client_addr.clone(), session.id.clone());
                                let sub_count = session.subscriptions.subscriptions.len() as u32;
                                data.push((key.clone(), transport_state.clone(), sub_count, session.session_activated));
                                sessions.insert(key.clone());
                                if session.session_activated {
                                    activated.insert(key);
                                }
                            }
                        }
                    }
                    (sessions, activated, data)
                };

                // Update the shared session details map.
                // - New sessions get a fresh connected_at timestamp and
                //   inferred security policy.
                // - Existing sessions get their subscription count and
                //   activation state refreshed.
                // - Disconnected sessions are pruned.
                {
                    let now_iso = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
                    let mut detail_map = details.lock();

                    for (key, transport_state, sub_count, activated) in &live_session_data {
                        if let Some(existing) = detail_map.get_mut(key) {
                            // Update mutable fields each cycle.
                            existing.subscription_count = *sub_count;
                            existing.activated = *activated;
                            existing.last_contact_time = now_iso.clone();
                        } else {
                            // New session — record connect time and infer security policy.
                            let client_ip = parse_client_ip(&key.0);
                            let security_policy = infer_security_policy(transport_state, &security_policies);
                            detail_map.insert(key.clone(), SessionDetail {
                                client_ip,
                                security_policy,
                                connected_at: now_iso.clone(),
                                last_contact_time: now_iso.clone(),
                                subscription_count: *sub_count,
                                activated: *activated,
                            });
                        }
                    }

                    // Remove entries for sessions that are no longer live.
                    detail_map.retain(|k, _| current_sessions.contains(k));
                }

                // Detect newly connected sessions (present now, absent before).
                for (client_addr, session_id) in current_sessions.difference(&known_sessions) {
                    let client_ip = parse_client_ip(client_addr);
                    let client_info = super::audit::AuditClientInfo {
                        ip_address: Some(client_ip.clone()),
                        session_id: Some(session_id.clone()),
                        ..Default::default()
                    };
                    let detail = format!(
                        "{{\"client_ip\":\"{}\",\"session_id\":\"{}\",\"active_sessions\":{}}}",
                        client_ip, session_id, current_sessions.len()
                    );
                    if let Err(e) = audit_logger.log_event(
                        super::audit::AuditEventType::ClientConnect,
                        AuditSeverity::Info,
                        &format!(
                            "Client connected from {} (active sessions: {})",
                            client_ip, current_sessions.len()
                        ),
                        Some(&detail),
                        Some("session_monitor"),
                        Some(&client_info),
                    ) {
                        log::warn!("Session monitor: failed to log connect event: {e}");
                    } else {
                        log::info!(
                            "Audit: client connected from {} (sessions: {} -> {})",
                            client_ip, known_sessions.len(), current_sessions.len()
                        );
                    }
                }

                // Detect disconnected sessions (present before, absent now).
                for (client_addr, session_id) in known_sessions.difference(&current_sessions) {
                    let client_ip = parse_client_ip(client_addr);
                    let client_info = super::audit::AuditClientInfo {
                        ip_address: Some(client_ip.clone()),
                        session_id: Some(session_id.clone()),
                        ..Default::default()
                    };
                    let detail = format!(
                        "{{\"client_ip\":\"{}\",\"session_id\":\"{}\",\"active_sessions\":{}}}",
                        client_ip, session_id, current_sessions.len()
                    );
                    if let Err(e) = audit_logger.log_event(
                        super::audit::AuditEventType::ClientDisconnect,
                        AuditSeverity::Info,
                        &format!(
                            "Client disconnected from {} (active sessions: {})",
                            client_ip, current_sessions.len()
                        ),
                        Some(&detail),
                        Some("session_monitor"),
                        Some(&client_info),
                    ) {
                        log::warn!("Session monitor: failed to log disconnect event: {e}");
                    } else {
                        log::info!(
                            "Audit: client disconnected from {} (sessions: {} -> {})",
                            client_ip, known_sessions.len(), current_sessions.len()
                        );
                    }
                }

                // --- Detect newly authenticated sessions (AuthSuccess events) ---
                // A session that transitions to "activated" state has completed
                // OPC UA authentication. Emit AuthSuccess with username and client IP.
                for (client_addr, session_id) in activated_sessions_snapshot.difference(&authenticated_sessions) {
                    let client_ip = parse_client_ip(client_addr);
                    // The session ID from the opcua crate typically contains the
                    // client application name (e.g. "urn:MyApp"). For username
                    // identity we use the session ID as the best available identifier;
                    // anonymous sessions are labelled accordingly.
                    let username = if session_id.is_empty() {
                        "anonymous".to_string()
                    } else {
                        session_id.clone()
                    };

                    let client_info = super::audit::AuditClientInfo {
                        ip_address: Some(client_ip.clone()),
                        session_id: Some(session_id.clone()),
                        username: Some(username.clone()),
                        ..Default::default()
                    };
                    let detail = format!(
                        "{{\"username\":\"{}\",\"client_ip\":\"{}\",\"session_id\":\"{}\"}}",
                        username, client_ip, session_id
                    );
                    if let Err(e) = audit_logger.log_event(
                        AuditEventType::AuthSuccess,
                        AuditSeverity::Info,
                        &format!(
                            "Client session authenticated (user: '{}', IP: {})",
                            username, client_ip
                        ),
                        Some(&detail),
                        Some("session_monitor"),
                        Some(&client_info),
                    ) {
                        log::warn!("Session monitor: failed to log auth success event: {e}");
                    } else {
                        log::info!(
                            "Audit: auth success for user '{}' from {}",
                            username, client_ip
                        );
                    }
                }

                // Clean up entries for sessions that no longer exist, then track
                // the current activated set.
                authenticated_sessions.retain(|k| current_sessions.contains(k));
                authenticated_sessions.extend(activated_sessions_snapshot);

                known_sessions = current_sessions;
            }

            log::info!("OPC UA session monitor stopped");
        });

        *self.task.lock() = Some(handle);
    }

    /// Stop the session monitor.
    fn stop(&self) {
        self.cancel.store(true, Ordering::Relaxed);
        if let Some(task) = self.task.lock().take() {
            task.abort();
        }
    }
}

impl Drop for SessionMonitor {
    fn drop(&mut self) {
        self.stop();
    }
}

// ============================================================================
// Audit Event Helpers
// ============================================================================

/// Parse a client IP address from the debug-formatted socket address string.
///
/// The opcua crate formats `SocketAddr` via `Debug`, producing strings like
/// `"V4(127.0.0.1:54321)"` or `"127.0.0.1:54321"`. This function extracts
/// just the IP portion, stripping the port and any wrapper.
fn parse_client_ip(raw: &str) -> String {
    // Strip outer wrapper like "V4(...)" or "V6(...)"
    let inner = raw
        .strip_prefix("V4(")
        .or_else(|| raw.strip_prefix("V6("))
        .and_then(|s| s.strip_suffix(')'))
        .unwrap_or(raw);
    // Strip the port suffix (last :PORT)
    inner
        .rsplit_once(':')
        .map(|(ip, _port)| ip.to_string())
        .unwrap_or_else(|| inner.to_string())
}

/// Infer the security policy display name from the connection's transport state
/// string by matching it against the server's configured security policies.
///
/// The opcua 0.12 crate's `ServerMetrics` exposes a `transport_state` string
/// per connection but does not directly provide the negotiated security policy.
/// We perform a case-insensitive substring match of each configured policy's
/// display name and policy URI fragment against the transport state string.
///
/// To avoid false-positive substring matches (e.g. "Basic256" matching a
/// transport state that actually contains "Basic256Sha256"), we collect all
/// candidates and return the one with the longest matching fragment. This
/// ensures the most specific policy wins.
///
/// Matching also normalises hyphens and underscores so that display names
/// like "Aes128-Sha256-RsaOaep" correctly match transport strings that use
/// the crate's internal underscore form "Aes128_Sha256_RsaOaep".
fn infer_security_policy(
    transport_state: &str,
    configured_policies: &[super::types::OpcUaSecurityPolicy],
) -> String {
    if transport_state.is_empty() {
        return "Unknown".to_string();
    }

    /// Normalise a string for matching: lowercase and replace hyphens with underscores.
    fn normalise(s: &str) -> String {
        s.to_lowercase().replace('-', "_")
    }

    let normalised = normalise(transport_state);

    // Collect all matching policies with the length of their longest matching
    // fragment so we can pick the most specific match.
    let mut best: Option<(&super::types::OpcUaSecurityPolicy, usize)> = Option::None;

    for policy in configured_policies {
        let mut match_len: usize = 0;

        // Try display name (e.g. "Aes128-Sha256-RsaOaep").
        let name_norm = normalise(policy.display_name());
        if normalised.contains(&name_norm) {
            match_len = match_len.max(name_norm.len());
        }

        // Try the URI fragment after '#' (e.g. "Aes128_Sha256_RsaOaep").
        let uri = policy.policy_uri();
        if let Some(frag) = uri.rsplit('#').next() {
            let frag_norm = normalise(frag);
            if normalised.contains(&frag_norm) {
                match_len = match_len.max(frag_norm.len());
            }
        }

        if match_len > 0 {
            if best.map_or(true, |(_, len)| match_len > len) {
                best = Some((policy, match_len));
            }
        }
    }

    if let Some((policy, _)) = best {
        return policy.display_name().to_string();
    }

    // No configured policy matched — return the raw transport state as-is.
    transport_state.to_string()
}

/// Create folder hierarchy nodes as OPC UA `FolderType` objects linked via
/// `HasComponent` references.  Each path segment becomes a folder whose parent
/// references it with a forward `HasComponent` reference, matching the OPC UA
/// convention for structuring address‑space objects.
///
/// Returns the [`NodeId`] of the deepest folder (i.e. the direct parent for
/// variable nodes placed at the end of the path).
#[cfg(feature = "opcua-server")]
fn ensure_folder_path(
    as_lock: &mut opcua::server::prelude::AddressSpace,
    ns: u16,
    folders: &mut HashMap<String, opcua::server::prelude::NodeId>,
    path_segments: &[String],
) -> opcua::server::prelude::NodeId {
    use opcua::server::prelude::{NodeId, ObjectBuilder};

    let mut parent_id = NodeId::objects_folder_id();
    let mut current_path = String::new();

    for segment in path_segments {
        if !current_path.is_empty() {
            current_path.push('/');
        }
        current_path.push_str(segment);

        let folder_id = folders.entry(current_path.clone()).or_insert_with(|| {
            let identifier = format!("folder/{}", current_path.replace('/', "_"));
            let folder_id = NodeId::new(ns, identifier);
            // Build FolderType object with a HasComponent reference from parent → child.
            ObjectBuilder::new(&folder_id, segment, segment)
                .is_folder()
                .component_of(parent_id.clone())
                .insert(as_lock);
            folder_id
        });
        parent_id = folder_id.clone();
    }

    parent_id
}

/// Add an `EngineeringUnits` OPC UA property (EUInformation extension object)
/// to the given variable node.
///
/// The property is a child Variable of the tag's Variable node, linked via
/// `HasProperty`. The value is an `EUInformation` extension object per
/// OPC UA Part 8 — Data Access, with the `display_name` set to the
/// human-readable unit string (e.g. "°C", "bar", "RPM").
///
/// The UNECE recommendation 20 unit_id is set to -1 (unknown) since the
/// tag only carries a free-text unit string.
#[cfg(feature = "opcua-server")]
fn add_engineering_units_property(
    as_lock: &mut opcua::server::prelude::AddressSpace,
    ns: u16,
    parent_node_id: &opcua::server::prelude::NodeId,
    parent_identifier: &str,
    engineering_unit: &str,
) {
    use opcua::server::prelude::*;
    use opcua::types::service_types::EUInformation;

    // Construct the EUInformation extension object.
    // namespace_uri: OPC UA UNECE namespace (http://www.opcfoundation.org/UA/units/un/cefact)
    // unit_id: -1 means "not specified" in UNECE Rec 20
    // display_name: the human-readable unit string
    // description: same as display_name (no separate long description available)
    let eu_info = EUInformation {
        namespace_uri: UAString::from("http://www.opcfoundation.org/UA/units/un/cefact"),
        unit_id: -1,
        display_name: LocalizedText::new("", engineering_unit),
        description: LocalizedText::new("", engineering_unit),
    };

    let eu_ext_obj = ExtensionObject::from_encodable(
        ObjectId::EUInformation_Encoding_DefaultBinary,
        &eu_info,
    );

    let property_id = NodeId::new(ns, format!("{}/EngineeringUnits", parent_identifier));
    let property_node = Variable::new_data_value(
        &property_id,
        "EngineeringUnits",
        "EngineeringUnits",
        DataTypeId::EUInformation,
        None,
        None,
        eu_ext_obj,
    );

    let _ = as_lock.insert(
        property_node,
        Some(&[
            // PropertyType type definition
            (
                &NodeId::from(&VariableTypeId::PropertyType),
                &ReferenceTypeId::HasTypeDefinition,
                ReferenceDirection::Forward,
            ),
            // HasProperty from parent variable (inverse = parent → child)
            (
                parent_node_id,
                &ReferenceTypeId::HasProperty,
                ReferenceDirection::Inverse,
            ),
        ]),
    );
}

/// Build a [`ServerEndpoint`] for the given [`OpcUaSecurityPolicy`].
///
/// Uses [`OpcUaSecurityPolicy::policy_uri()`] to resolve the opcua crate's
/// [`SecurityPolicy`] and auto-determines the message security mode:
/// - `None` → `MessageSecurityMode::None` (plaintext, testing only)
/// - All others → `MessageSecurityMode::SignAndEncrypt`
///
/// This ensures the server only advertises the exact policies the user selected.
#[cfg(feature = "opcua-server")]
fn build_server_endpoint(
    policy: super::types::OpcUaSecurityPolicy,
    path: &str,
    user_token_ids: &[String],
) -> opcua::server::prelude::ServerEndpoint {
    use opcua::server::prelude::{MessageSecurityMode, SecurityPolicy, ServerEndpoint};

    // Convert our OpcUaSecurityPolicy → opcua crate SecurityPolicy via the
    // standard OPC UA policy URI, keeping a single source of truth for URIs.
    let crate_policy = SecurityPolicy::from_uri(policy.policy_uri());

    // Auto-determine message security mode: None for no-security, SignAndEncrypt
    // for all encryption-capable policies.
    let security_mode = if policy.requires_encryption() {
        MessageSecurityMode::SignAndEncrypt
    } else {
        MessageSecurityMode::None
    };

    ServerEndpoint::new(path, crate_policy, security_mode, user_token_ids)
}

#[cfg(feature = "opcua-server")]
fn variant_to_canonical_value(
    variant: &opcua::server::prelude::Variant,
) -> Result<CanonicalValue, opcua::server::prelude::StatusCode> {
    use opcua::server::prelude::{StatusCode, Variant};

    match variant {
        Variant::Boolean(value) => Ok(CanonicalValue::Bool(*value)),
        Variant::UInt16(value) => Ok(CanonicalValue::U16(*value)),
        Variant::Int16(value) if *value >= 0 => Ok(CanonicalValue::U16(*value as u16)),
        Variant::Int16(_) => Err(StatusCode::BadOutOfRange),
        Variant::Int32(value) if *value >= 0 && *value <= u16::MAX as i32 => {
            Ok(CanonicalValue::U16(*value as u16))
        }
        Variant::Int32(_) => Err(StatusCode::BadOutOfRange),
        Variant::UInt32(value) if *value <= u16::MAX as u32 => {
            Ok(CanonicalValue::U16(*value as u16))
        }
        Variant::UInt32(_) => Err(StatusCode::BadOutOfRange),
        _ => Err(StatusCode::BadTypeMismatch),
    }
}

#[cfg(feature = "opcua-server")]
fn canonical_data_value(
    value: Result<CanonicalValue, CanonicalMemoryError>,
    timestamps_to_return: opcua::server::prelude::TimestampsToReturn,
) -> opcua::server::prelude::DataValue {
    use opcua::server::prelude::{DataValue, DateTime, StatusCode, Variant};

    match value {
        Ok(CanonicalValue::Bool(value)) => {
            let now = DateTime::now();
            let mut data_value = DataValue::from((Variant::Boolean(value), StatusCode::Good));
            data_value.set_timestamps(timestamps_to_return, now, now);
            data_value
        }
        Ok(CanonicalValue::U16(value)) => {
            let now = DateTime::now();
            let mut data_value = DataValue::from((Variant::UInt16(value), StatusCode::Good));
            data_value.set_timestamps(timestamps_to_return, now, now);
            data_value
        }
        Err(error) => {
            let status = canonical_read_error_status(&error);
            let now = DateTime::now();
            let mut data_value = DataValue {
                value: None,
                status: Some(status),
                source_timestamp: None,
                source_picoseconds: None,
                server_timestamp: None,
                server_picoseconds: None,
            };
            data_value.set_timestamps(timestamps_to_return, now, now);
            data_value
        }
    }
}

#[cfg(feature = "opcua-server")]
fn canonical_read_error_status(error: &CanonicalMemoryError) -> opcua::server::prelude::StatusCode {
    use opcua::server::prelude::StatusCode;

    match error {
        CanonicalMemoryError::AddressOutOfRange { .. }
        | CanonicalMemoryError::BitIndexOutOfRange { .. }
        | CanonicalMemoryError::BitIndexOnBitArea { .. } => StatusCode::BadNodeIdUnknown,
        CanonicalMemoryError::TypeMismatch { .. }
        | CanonicalMemoryError::WriteNotAllowed { .. }
        | CanonicalMemoryError::SnapshotSizeMismatch { .. } => StatusCode::BadUnexpectedError,
    }
}

#[cfg(feature = "opcua-server")]
fn bootstrap_server_pki(config: &OpcUaConfig) -> Result<CertificateMetadata, OpcUaError> {
    use opcua::server::prelude::{ServerBuilder, ServerEndpoint, ServerUserToken};

    let cert_path = absolute_pki_path(&config.pki_dir, &config.certificate_path);
    let key_path = absolute_pki_path(&config.pki_dir, &config.private_key_path);

    if cert_path.exists() ^ key_path.exists() {
        return Err(OpcUaError::Config(
            "OPC UA certificate and private key must either both exist or both be missing".into(),
        ));
    }

    if !cert_path.exists() && !key_path.exists() {
        if let Some(parent) = cert_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                OpcUaError::Config(format!("Failed to create certificate dir: {e}"))
            })?;
        }
        if let Some(parent) = key_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                OpcUaError::Config(format!("Failed to create private key dir: {e}"))
            })?;
        }

        let bootstrap_user_token_ids = vec![LOCAL_USER_TOKEN_ID.to_string()];
        let bootstrap = ServerBuilder::new()
            .application_name(&config.server_name)
            .application_uri(&format!("urn:modone:{}", config.server_name))
            .product_uri("urn:modone:opcua")
            .host_and_port(&config.bind_address, config.port)
            .pki_dir(&config.pki_dir)
            .certificate_path(&config.certificate_path)
            .private_key_path(&config.private_key_path)
            .create_sample_keypair(true)
            .discovery_urls(vec![
                DEFAULT_ENDPOINT_PATH.to_string(),
                DISCOVERY_ENDPOINT_PATH.to_string(),
            ])
            .user_token(
                LOCAL_USER_TOKEN_ID,
                ServerUserToken::user_pass(
                    "__bootstrap__".to_string(),
                    "__bootstrap__".to_string(),
                ),
            )
            .endpoint(
                "bootstrap",
                ServerEndpoint::new_basic256sha256_sign_encrypt(
                    DEFAULT_ENDPOINT_PATH,
                    &bootstrap_user_token_ids,
                ),
            )
            .endpoint(
                "bootstrap-discovery",
                ServerEndpoint::new_none(DISCOVERY_ENDPOINT_PATH, &[]),
            );

        bootstrap.server().ok_or_else(|| {
            OpcUaError::Config(
                "Failed to generate OPC UA server certificate and private key".into(),
            )
        })?;
    }

    if !cert_path.exists() || !key_path.exists() {
        return Err(OpcUaError::Config(
            "OPC UA certificate bootstrap did not produce both certificate and key files".into(),
        ));
    }

    read_certificate_metadata(&cert_path)
}

#[cfg(feature = "opcua-server")]
fn read_certificate_metadata(cert_path: &Path) -> Result<CertificateMetadata, OpcUaError> {
    let cert_bytes = fs::read(cert_path)
        .map_err(|e| OpcUaError::Config(format!("Failed to read OPC UA certificate: {e}")))?;
    let (_, cert) = x509_parser::parse_x509_certificate(&cert_bytes)
        .map_err(|_| OpcUaError::Config("Failed to parse OPC UA certificate".into()))?;
    let fingerprint = fingerprint_sha256(&cert_bytes);

    Ok(CertificateMetadata {
        fingerprint: Some(fingerprint),
        valid_to: Some(cert.validity().not_after.to_string()),
    })
}

#[cfg(feature = "opcua-server")]
fn fingerprint_sha256(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect::<Vec<_>>()
        .join(":")
}

#[cfg(feature = "opcua-server")]
fn absolute_pki_path(root: &Path, relative_or_absolute: &Path) -> PathBuf {
    if relative_or_absolute.is_absolute() {
        relative_or_absolute.to_path_buf()
    } else {
        root.join(relative_or_absolute)
    }
}

#[cfg(all(test, feature = "opcua-server"))]
mod tests {
    use super::*;
    use opcua::server::prelude::{StatusCode, Variant};
    use tempfile::tempdir;

    #[test]
    fn variant_to_canonical_value_rejects_out_of_range_and_wrong_type() {
        assert_eq!(
            variant_to_canonical_value(&Variant::UInt16(42)).unwrap(),
            CanonicalValue::U16(42)
        );
        assert_eq!(
            variant_to_canonical_value(&Variant::Int32(65535)).unwrap(),
            CanonicalValue::U16(65535)
        );
        assert_eq!(
            variant_to_canonical_value(&Variant::Int16(-1)).unwrap_err(),
            StatusCode::BadOutOfRange
        );
        assert_eq!(
            variant_to_canonical_value(&Variant::UInt32(70000)).unwrap_err(),
            StatusCode::BadOutOfRange
        );
        assert_eq!(
            variant_to_canonical_value(&Variant::Double(1.5)).unwrap_err(),
            StatusCode::BadTypeMismatch
        );
    }

    #[test]
    fn bootstrap_server_pki_rejects_broken_cert_key_pairs() {
        let temp = tempdir().unwrap();
        let pki_dir = temp.path().join("pki");
        let cert_path = pki_dir.join("own").join("cert.der");
        fs::create_dir_all(cert_path.parent().unwrap()).unwrap();
        fs::write(&cert_path, b"orphan-cert").unwrap();

        let config = OpcUaConfig {
            pki_dir: pki_dir.clone(),
            certificate_path: PathBuf::from("own/cert.der"),
            private_key_path: PathBuf::from("private/private.pem"),
            ..OpcUaConfig::default()
        };

        let err = bootstrap_server_pki(&config).unwrap_err();
        match err {
            OpcUaError::Config(message) => {
                assert!(message.contains("must either both exist or both be missing"));
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[test]
    fn build_server_endpoint_maps_all_policies() {
        use crate::opcua::types::OpcUaSecurityPolicy;

        let user_tokens = vec!["test_user".to_string()];

        // None policy → no security
        let ep = build_server_endpoint(OpcUaSecurityPolicy::None, "/", &user_tokens);
        assert_eq!(ep.security_policy, "None");
        assert_eq!(ep.security_mode, "None");

        // Basic128Rsa15 → SignAndEncrypt
        let ep = build_server_endpoint(OpcUaSecurityPolicy::Basic128Rsa15, "/", &user_tokens);
        assert_eq!(ep.security_policy, "Basic128Rsa15");
        assert_eq!(ep.security_mode, "SignAndEncrypt");

        // Basic256 → SignAndEncrypt
        let ep = build_server_endpoint(OpcUaSecurityPolicy::Basic256, "/", &user_tokens);
        assert_eq!(ep.security_policy, "Basic256");
        assert_eq!(ep.security_mode, "SignAndEncrypt");

        // Basic256Sha256 → SignAndEncrypt
        let ep = build_server_endpoint(OpcUaSecurityPolicy::Basic256Sha256, "/", &user_tokens);
        assert_eq!(ep.security_policy, "Basic256Sha256");
        assert_eq!(ep.security_mode, "SignAndEncrypt");

        // Aes128Sha256RsaOaep → SignAndEncrypt
        let ep =
            build_server_endpoint(OpcUaSecurityPolicy::Aes128Sha256RsaOaep, "/", &user_tokens);
        assert_eq!(ep.security_policy, "Aes128_Sha256_RsaOaep");
        assert_eq!(ep.security_mode, "SignAndEncrypt");

        // Aes256Sha256RsPss → SignAndEncrypt
        let ep =
            build_server_endpoint(OpcUaSecurityPolicy::Aes256Sha256RsPss, "/", &user_tokens);
        assert_eq!(ep.security_policy, "Aes256_Sha256_RsPss");
        assert_eq!(ep.security_mode, "SignAndEncrypt");
    }

    #[test]
    fn build_server_endpoint_passes_user_token_ids() {
        use crate::opcua::types::OpcUaSecurityPolicy;

        let user_tokens = vec!["token_a".to_string(), "token_b".to_string()];
        let ep = build_server_endpoint(OpcUaSecurityPolicy::Basic256Sha256, "/test", &user_tokens);
        assert_eq!(ep.path, "/test");
        assert_eq!(ep.user_token_ids.len(), 2);
        assert!(ep.user_token_ids.contains(&"token_a".to_string()));
        assert!(ep.user_token_ids.contains(&"token_b".to_string()));
    }

    #[test]
    fn config_default_security_policies_not_empty() {
        let config = OpcUaConfig::default();
        assert!(!config.security_policies.is_empty());
        assert!(config
            .security_policies
            .contains(&crate::opcua::types::OpcUaSecurityPolicy::Basic256Sha256));
    }

    #[test]
    fn status_reports_active_policies_when_not_running() {
        let config = OpcUaConfig::default();
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);
        let status = server.status();
        assert!(!status.running);
        assert!(status.active_security_policies.is_empty());
    }

    #[test]
    fn ensure_folder_path_creates_folder_type_with_has_component_refs() {
        use opcua::server::prelude::{
            AddressSpace, NodeId, ObjectTypeId, ReferenceTypeId,
        };

        let mut address_space = AddressSpace::new();
        let ns = address_space
            .register_namespace("urn:test:folder")
            .unwrap();
        let mut folders = HashMap::new();
        let segments = vec![
            "Root".to_string(),
            "Child".to_string(),
            "Grandchild".to_string(),
        ];

        let leaf_id = ensure_folder_path(&mut address_space, ns, &mut folders, &segments);

        // Verify all three folders were created
        assert_eq!(folders.len(), 3);
        let root_id = &folders["Root"];
        let child_id = &folders["Root/Child"];
        let grandchild_id = &folders["Root/Child/Grandchild"];
        assert_eq!(&leaf_id, grandchild_id);

        // Verify each folder node has FolderType as its type definition
        for folder_id in [root_id, child_id, grandchild_id] {
            assert!(
                address_space.has_reference(
                    folder_id,
                    &ObjectTypeId::FolderType.into(),
                    ReferenceTypeId::HasTypeDefinition,
                ),
                "Folder {:?} should have FolderType type definition",
                folder_id
            );
        }

        // Verify HasComponent references: Objects → Root → Child → Grandchild
        let objects_id = NodeId::objects_folder_id();
        assert!(
            address_space.has_reference(
                &objects_id,
                root_id,
                ReferenceTypeId::HasComponent,
            ),
            "Objects folder should have HasComponent reference to Root"
        );
        assert!(
            address_space.has_reference(
                root_id,
                child_id,
                ReferenceTypeId::HasComponent,
            ),
            "Root should have HasComponent reference to Child"
        );
        assert!(
            address_space.has_reference(
                child_id,
                grandchild_id,
                ReferenceTypeId::HasComponent,
            ),
            "Child should have HasComponent reference to Grandchild"
        );
    }

    #[test]
    fn ensure_folder_path_reuses_existing_folders() {
        use opcua::server::prelude::AddressSpace;

        let mut address_space = AddressSpace::new();
        let ns = address_space
            .register_namespace("urn:test:folder-reuse")
            .unwrap();
        let mut folders = HashMap::new();

        // Create "A/B/C"
        ensure_folder_path(
            &mut address_space,
            ns,
            &mut folders,
            &["A".to_string(), "B".to_string(), "C".to_string()],
        );
        // Create "A/B/D" – should reuse "A" and "A/B"
        ensure_folder_path(
            &mut address_space,
            ns,
            &mut folders,
            &["A".to_string(), "B".to_string(), "D".to_string()],
        );

        // 4 unique folders: A, A/B, A/B/C, A/B/D
        assert_eq!(folders.len(), 4);
    }

    // ========================================================================
    // Identity token / bcrypt verification chain tests
    // ========================================================================

    /// Verify that `resolve_user_tokens` produces ServerUserToken entries from
    /// bcrypt-verified credentials. Only credentials that passed bcrypt
    /// verification (via `resolve_verified_credentials`) are included.
    #[test]
    fn resolve_user_tokens_uses_bcrypt_verified_credentials() {
        use crate::opcua::auth::{
            CredentialCache, UserAccountStore,
            UserRole, resolve_verified_credentials,
        };

        // Create a store with two accounts using bcrypt-hashed passwords.
        let dir = tempdir().unwrap();
        let mut store = UserAccountStore::load(dir.path()).unwrap();
        store.add("alice", "alice_pass", UserRole::Admin).unwrap();
        store.add("bob", "bob_pass", UserRole::Operator).unwrap();

        // Cache only correct passwords for both.
        let mut cache = CredentialCache::new();
        cache.set("alice", "alice_pass".to_string());
        cache.set("bob", "bob_pass".to_string());

        // Resolve verified credentials (bcrypt verification happens here).
        let verified = resolve_verified_credentials(&store, &cache);
        assert_eq!(verified.len(), 2);

        // Build OpcUaConfig with verified credentials.
        let config = OpcUaConfig {
            verified_credentials: verified,
            allow_anonymous: false,
            ..OpcUaConfig::default()
        };
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);

        // resolve_user_tokens should produce 2 ServerUserToken entries.
        let tokens = server.resolve_user_tokens().unwrap();
        assert_eq!(tokens.len(), 2);

        // Each token should have the correct username.
        let usernames: Vec<&str> = tokens
            .iter()
            .map(|(_, token)| token.user.as_str())
            .collect();
        assert!(usernames.contains(&"alice"));
        assert!(usernames.contains(&"bob"));
    }

    /// Verify that wrong passwords fail bcrypt verification and thus do NOT
    /// produce identity tokens — the OPC UA server will reject such clients.
    #[test]
    fn resolve_user_tokens_rejects_wrong_bcrypt_password() {
        use crate::opcua::auth::{
            CredentialCache, UserAccountStore,
            UserRole, resolve_verified_credentials,
        };

        let dir = tempdir().unwrap();
        let mut store = UserAccountStore::load(dir.path()).unwrap();
        store.add("charlie", "correct_pass", UserRole::Operator).unwrap();

        // Cache a WRONG password for charlie.
        let mut cache = CredentialCache::new();
        cache.set("charlie", "wrong_pass".to_string());

        // bcrypt verification should reject the wrong password.
        let verified = resolve_verified_credentials(&store, &cache);
        assert!(verified.is_empty(), "Wrong password should not produce verified credentials");

        // With no verified credentials and anonymous disabled, resolve_user_tokens errors.
        let config = OpcUaConfig {
            verified_credentials: verified,
            allow_anonymous: false,
            ..OpcUaConfig::default()
        };
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);

        let result = server.resolve_user_tokens();
        assert!(result.is_err(), "Should error when no credentials pass bcrypt verification");
    }

    /// Verify that disabled accounts are excluded from identity token resolution
    /// even when their cached password is correct.
    #[test]
    fn resolve_user_tokens_excludes_disabled_accounts() {
        use crate::opcua::auth::{
            CredentialCache, UserAccountStore,
            UserRole, resolve_verified_credentials,
        };

        let dir = tempdir().unwrap();
        let mut store = UserAccountStore::load(dir.path()).unwrap();
        store.add("dave", "dave_pass", UserRole::Viewer).unwrap();
        store.update("dave", None, Some(false), None).unwrap(); // disable account

        let mut cache = CredentialCache::new();
        cache.set("dave", "dave_pass".to_string());

        let verified = resolve_verified_credentials(&store, &cache);
        assert!(verified.is_empty(), "Disabled account should not produce verified credentials");

        // With anonymous enabled, this should be OK (just no user tokens).
        let config = OpcUaConfig {
            verified_credentials: verified,
            allow_anonymous: true,
            ..OpcUaConfig::default()
        };
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);

        let tokens = server.resolve_user_tokens().unwrap();
        assert!(tokens.is_empty());
    }

    /// Verify that only the subset of accounts with correct cached passwords
    /// produce identity tokens — demonstrating selective bcrypt verification.
    #[test]
    fn resolve_user_tokens_partial_bcrypt_verification() {
        use crate::opcua::auth::{
            CredentialCache, UserAccountStore,
            UserRole, resolve_verified_credentials,
        };

        let dir = tempdir().unwrap();
        let mut store = UserAccountStore::load(dir.path()).unwrap();
        store.add("valid_user", "correct_pw", UserRole::Admin).unwrap();
        store.add("invalid_user", "secret_pw", UserRole::Operator).unwrap();

        let mut cache = CredentialCache::new();
        cache.set("valid_user", "correct_pw".to_string()); // correct
        cache.set("invalid_user", "wrong_pw".to_string());  // wrong

        let verified = resolve_verified_credentials(&store, &cache);
        assert_eq!(verified.len(), 1, "Only the account with correct bcrypt hash should verify");
        assert_eq!(verified[0].username, "valid_user");

        let config = OpcUaConfig {
            verified_credentials: verified,
            allow_anonymous: false,
            ..OpcUaConfig::default()
        };
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);

        let tokens = server.resolve_user_tokens().unwrap();
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0].1.user, "valid_user");
    }

    /// Verify that the ServerUserToken password field matches the plaintext that
    /// was bcrypt-verified, ensuring the OPC UA crate will accept the same
    /// password the client provides during IdentityToken exchange.
    #[test]
    fn resolve_user_tokens_server_user_token_contains_verified_plaintext() {
        use crate::opcua::auth::{
            CredentialCache, UserAccountStore,
            UserRole, resolve_verified_credentials,
        };

        let dir = tempdir().unwrap();
        let mut store = UserAccountStore::load(dir.path()).unwrap();
        store.add("eve", "eve_secret_123", UserRole::Operator).unwrap();

        let mut cache = CredentialCache::new();
        cache.set("eve", "eve_secret_123".to_string());

        let verified = resolve_verified_credentials(&store, &cache);
        assert_eq!(verified.len(), 1);

        let config = OpcUaConfig {
            verified_credentials: verified,
            allow_anonymous: false,
            ..OpcUaConfig::default()
        };
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);

        let tokens = server.resolve_user_tokens().unwrap();
        assert_eq!(tokens.len(), 1);

        let (token_id, server_user_token) = &tokens[0];
        assert!(token_id.starts_with(USER_TOKEN_PREFIX));
        assert_eq!(server_user_token.user, "eve");
        // The ServerUserToken stores the bcrypt-verified plaintext password
        // that the OPC UA crate uses for IdentityToken comparison at runtime.
        assert_eq!(
            server_user_token.pass.as_deref(),
            Some("eve_secret_123"),
            "ServerUserToken must contain the bcrypt-verified plaintext for OPC UA identity comparison"
        );
    }

    // ========================================================================
    // Anonymous IdentityToken acceptance / rejection tests
    // ========================================================================

    /// When `allow_anonymous` is true and no user credentials are configured,
    /// `resolve_user_tokens` should succeed (returning an empty list of user
    /// tokens). The server will rely solely on anonymous identity tokens.
    #[test]
    fn anonymous_accepted_when_enabled_no_credentials() {
        let config = OpcUaConfig {
            allow_anonymous: true,
            // No verified credentials, no legacy username/password
            ..OpcUaConfig::default()
        };
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);

        // resolve_user_tokens should succeed — anonymous access fills the gap.
        let tokens = server.resolve_user_tokens().unwrap();
        assert!(
            tokens.is_empty(),
            "No user tokens expected when only anonymous access is enabled"
        );
    }

    /// When `allow_anonymous` is false and no user credentials are configured,
    /// `resolve_user_tokens` should return an error — the server cannot accept
    /// any identity tokens at all.
    #[test]
    fn anonymous_rejected_when_disabled_no_credentials() {
        let config = OpcUaConfig {
            allow_anonymous: false,
            // No verified credentials, no legacy username/password
            ..OpcUaConfig::default()
        };
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);

        let result = server.resolve_user_tokens();
        assert!(
            result.is_err(),
            "Should error when anonymous is disabled and no credentials exist"
        );
    }

    /// When `allow_anonymous` is true, the ANONYMOUS_USER_TOKEN_ID should be
    /// included in the endpoint's user_token_ids list, which tells the OPC UA
    /// crate to accept anonymous identity tokens from clients.
    #[test]
    fn anonymous_token_id_included_in_endpoint_when_enabled() {
        use crate::opcua::types::OpcUaSecurityPolicy;

        // Simulate what start_opcua_server does: resolve tokens, then add
        // ANONYMOUS_USER_TOKEN_ID if allow_anonymous is true.
        let config = OpcUaConfig {
            allow_anonymous: true,
            ..OpcUaConfig::default()
        };
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);

        let user_token_entries = server.resolve_user_tokens().unwrap();
        let mut user_token_ids: Vec<String> = user_token_entries
            .iter()
            .map(|(id, _)| id.clone())
            .collect();

        // This mirrors start_opcua_server logic: add ANONYMOUS when enabled.
        if server.config.allow_anonymous {
            user_token_ids.push(
                opcua::server::prelude::ANONYMOUS_USER_TOKEN_ID.to_string(),
            );
        }

        assert!(
            user_token_ids.contains(
                &opcua::server::prelude::ANONYMOUS_USER_TOKEN_ID.to_string()
            ),
            "ANONYMOUS_USER_TOKEN_ID must be in endpoint token IDs when anonymous is enabled"
        );

        // Build an endpoint and verify the anonymous token ID is passed through.
        let ep = build_server_endpoint(
            OpcUaSecurityPolicy::Basic256Sha256,
            "/",
            &user_token_ids,
        );
        assert!(
            ep.user_token_ids
                .contains(&opcua::server::prelude::ANONYMOUS_USER_TOKEN_ID.to_string()),
            "Endpoint must include ANONYMOUS token ID when anonymous access is enabled"
        );
    }

    /// When `allow_anonymous` is false, the ANONYMOUS_USER_TOKEN_ID must NOT
    /// be in the endpoint's user_token_ids list. This causes the OPC UA crate
    /// to reject anonymous identity tokens from clients.
    #[test]
    fn anonymous_token_id_excluded_from_endpoint_when_disabled() {
        use crate::opcua::auth::{
            CredentialCache, UserAccountStore, UserRole, resolve_verified_credentials,
        };
        use crate::opcua::types::OpcUaSecurityPolicy;

        // Create a valid user so the server can start without anonymous.
        let dir = tempdir().unwrap();
        let mut store = UserAccountStore::load(dir.path()).unwrap();
        store.add("admin", "admin_pass", UserRole::Admin).unwrap();

        let mut cache = CredentialCache::new();
        cache.set("admin", "admin_pass".to_string());

        let verified = resolve_verified_credentials(&store, &cache);
        assert_eq!(verified.len(), 1);

        let config = OpcUaConfig {
            verified_credentials: verified,
            allow_anonymous: false,
            ..OpcUaConfig::default()
        };
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);

        let user_token_entries = server.resolve_user_tokens().unwrap();
        let mut user_token_ids: Vec<String> = user_token_entries
            .iter()
            .map(|(id, _)| id.clone())
            .collect();

        // Mirror start_opcua_server: do NOT add ANONYMOUS when disabled.
        if server.config.allow_anonymous {
            user_token_ids.push(
                opcua::server::prelude::ANONYMOUS_USER_TOKEN_ID.to_string(),
            );
        }

        assert!(
            !user_token_ids.contains(
                &opcua::server::prelude::ANONYMOUS_USER_TOKEN_ID.to_string()
            ),
            "ANONYMOUS_USER_TOKEN_ID must NOT be in endpoint token IDs when anonymous is disabled"
        );

        // Build an endpoint and verify anonymous is excluded.
        let ep = build_server_endpoint(
            OpcUaSecurityPolicy::Basic256Sha256,
            "/",
            &user_token_ids,
        );
        assert!(
            !ep.user_token_ids
                .contains(&opcua::server::prelude::ANONYMOUS_USER_TOKEN_ID.to_string()),
            "Endpoint must NOT include ANONYMOUS token ID when anonymous access is disabled"
        );
    }

    /// When `allow_anonymous` is true alongside user credentials, both anonymous
    /// and user identity tokens should be accepted. The ANONYMOUS token ID is
    /// included in the endpoint's token list alongside the user token IDs.
    #[test]
    fn anonymous_coexists_with_user_credentials_when_enabled() {
        use crate::opcua::auth::{
            CredentialCache, UserAccountStore, UserRole, resolve_verified_credentials,
        };
        use crate::opcua::types::OpcUaSecurityPolicy;

        let dir = tempdir().unwrap();
        let mut store = UserAccountStore::load(dir.path()).unwrap();
        store.add("operator", "op_pass", UserRole::Operator).unwrap();

        let mut cache = CredentialCache::new();
        cache.set("operator", "op_pass".to_string());

        let verified = resolve_verified_credentials(&store, &cache);
        assert_eq!(verified.len(), 1);

        let config = OpcUaConfig {
            verified_credentials: verified,
            allow_anonymous: true, // Both user auth and anonymous
            ..OpcUaConfig::default()
        };
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);

        let user_token_entries = server.resolve_user_tokens().unwrap();
        assert_eq!(user_token_entries.len(), 1, "Should have 1 user token");

        let mut user_token_ids: Vec<String> = user_token_entries
            .iter()
            .map(|(id, _)| id.clone())
            .collect();

        // Mirror start_opcua_server: add ANONYMOUS when enabled.
        if server.config.allow_anonymous {
            user_token_ids.push(
                opcua::server::prelude::ANONYMOUS_USER_TOKEN_ID.to_string(),
            );
        }

        // Should have both user token and anonymous token IDs.
        assert_eq!(
            user_token_ids.len(),
            2,
            "Should have 1 user token ID + 1 ANONYMOUS token ID"
        );
        assert!(
            user_token_ids.contains(
                &opcua::server::prelude::ANONYMOUS_USER_TOKEN_ID.to_string()
            ),
            "ANONYMOUS_USER_TOKEN_ID must be present alongside user tokens"
        );
        assert!(
            user_token_ids.iter().any(|id| id.starts_with(USER_TOKEN_PREFIX)),
            "User token ID must be present alongside ANONYMOUS"
        );

        // Build endpoint and verify both are passed through.
        let ep = build_server_endpoint(
            OpcUaSecurityPolicy::None,
            "/",
            &user_token_ids,
        );
        assert_eq!(
            ep.user_token_ids.len(),
            2,
            "Endpoint should have both user and anonymous token IDs"
        );
    }

    /// Verify that `start_opcua_server` gate logic rejects startup when
    /// no credentials are available and anonymous is disabled.
    #[test]
    fn server_startup_rejected_no_credentials_anonymous_disabled() {
        let config = OpcUaConfig {
            allow_anonymous: false,
            verified_credentials: Vec::new(),
            username: None,
            password: None,
            ..OpcUaConfig::default()
        };
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);

        // The resolve_user_tokens call itself should error.
        let result = server.resolve_user_tokens();
        assert!(
            result.is_err(),
            "Server should refuse to resolve tokens when no auth method is available"
        );
    }

    /// Verify that legacy single-user mode with anonymous enabled accepts
    /// anonymous tokens even without explicit user credentials.
    #[test]
    fn anonymous_accepted_legacy_mode_no_user_password() {
        let config = OpcUaConfig {
            allow_anonymous: true,
            username: None,
            password: None,
            verified_credentials: Vec::new(),
            ..OpcUaConfig::default()
        };
        let memory = Arc::new(OpcUaMemory::new());
        let server = OpcUaServer::new(config, memory);

        // Should succeed — anonymous fills the gap.
        let tokens = server.resolve_user_tokens().unwrap();
        assert!(tokens.is_empty(), "No user tokens in anonymous-only mode");
    }

    // ========================================================================
    // Security policy inference tests
    // ========================================================================

    /// Helper: all security policy variants for use in inference tests.
    fn all_policies() -> Vec<crate::opcua::types::OpcUaSecurityPolicy> {
        crate::opcua::types::OpcUaSecurityPolicy::all().to_vec()
    }

    #[test]
    fn infer_security_policy_empty_transport_state_returns_unknown() {
        assert_eq!(infer_security_policy("", &all_policies()), "Unknown");
    }

    #[test]
    fn infer_security_policy_matches_none_policy() {
        let policies = all_policies();
        // The "None" policy display name is "None (No Security)".
        // Transport state containing "none" should match.
        let result = infer_security_policy("none", &policies);
        assert_eq!(result, "None (No Security)");
    }

    #[test]
    fn infer_security_policy_matches_basic256sha256_over_basic256() {
        let policies = all_policies();
        // "Basic256Sha256" should win over "Basic256" even though "Basic256"
        // is a substring — we pick the longest match.
        let result = infer_security_policy(
            "open/secure-channel, policy=Basic256Sha256",
            &policies,
        );
        assert_eq!(result, "Basic256Sha256");
    }

    #[test]
    fn infer_security_policy_matches_plain_basic256() {
        let policies = all_policies();
        // When only "Basic256" appears (without "Sha256"), it should match Basic256.
        let result = infer_security_policy("policy=Basic256, mode=SignAndEncrypt", &policies);
        assert_eq!(result, "Basic256");
    }

    #[test]
    fn infer_security_policy_matches_aes128_with_underscores() {
        let policies = all_policies();
        // The opcua crate uses underscores: "Aes128_Sha256_RsaOaep".
        // Our display name uses hyphens: "Aes128-Sha256-RsaOaep".
        // Normalisation should handle this.
        let result = infer_security_policy(
            "open, security=Aes128_Sha256_RsaOaep",
            &policies,
        );
        assert_eq!(result, "Aes128-Sha256-RsaOaep");
    }

    #[test]
    fn infer_security_policy_matches_aes256_with_underscores() {
        let policies = all_policies();
        let result = infer_security_policy(
            "secure-channel Aes256_Sha256_RsPss active",
            &policies,
        );
        assert_eq!(result, "Aes256-Sha256-RsPss");
    }

    #[test]
    fn infer_security_policy_matches_basic128rsa15() {
        let policies = all_policies();
        let result = infer_security_policy("Basic128Rsa15", &policies);
        assert_eq!(result, "Basic128Rsa15");
    }

    #[test]
    fn infer_security_policy_case_insensitive() {
        let policies = all_policies();
        let result = infer_security_policy("BASIC256SHA256", &policies);
        assert_eq!(result, "Basic256Sha256");
    }

    #[test]
    fn infer_security_policy_no_match_returns_raw_state() {
        let policies = all_policies();
        let result = infer_security_policy("waiting-for-hello", &policies);
        assert_eq!(result, "waiting-for-hello");
    }

    #[test]
    fn infer_security_policy_subset_of_configured_policies() {
        use crate::opcua::types::OpcUaSecurityPolicy;
        // Only Basic256Sha256 and None configured — should not match Basic256.
        let policies = vec![
            OpcUaSecurityPolicy::None,
            OpcUaSecurityPolicy::Basic256Sha256,
        ];
        let result = infer_security_policy("policy=Basic256, mode=Sign", &policies);
        // "Basic256" is a substring of "Basic256Sha256" display name check,
        // but `Basic256Sha256` (len 14) > `Basic256` match? No — "basic256sha256"
        // is NOT contained in "policy=basic256, mode=sign". Only "none" and
        // "basic256sha256" are candidates; neither is present aside from a
        // partial "basic256". The None (No Security) display name normalised is
        // "none (no security)" — also not present as substring. The URI fragment
        // "none" IS present in "policy=basic256, mode=sign"? No. So no match → raw.
        // Actually wait: URI fragment for Basic256Sha256 is "Basic256Sha256".
        // "basic256sha256" is NOT a substring of "policy=basic256, mode=sign".
        // URI fragment for None is "None". "none" IS a substring of... no.
        // So the result should be the raw transport state.
        assert_eq!(result, "policy=Basic256, mode=Sign");
    }

    #[test]
    fn infer_security_policy_prefers_longer_match_regardless_of_order() {
        use crate::opcua::types::OpcUaSecurityPolicy;
        // Put Basic256 BEFORE Basic256Sha256 in the list — the longer match
        // should still win when the transport state contains "Basic256Sha256".
        let policies = vec![
            OpcUaSecurityPolicy::Basic256,
            OpcUaSecurityPolicy::Basic256Sha256,
        ];
        let result = infer_security_policy("Basic256Sha256", &policies);
        assert_eq!(result, "Basic256Sha256");
    }

    #[test]
    fn infer_security_policy_uri_fragment_match() {
        use crate::opcua::types::OpcUaSecurityPolicy;
        // The policy URI for Aes128 ends with "#Aes128_Sha256_RsaOaep".
        // Normalised: "aes128_sha256_rsaoaep".
        // Display name: "Aes128-Sha256-RsaOaep" → normalised "aes128_sha256_rsaoaep".
        // Both should match the same string.
        let policies = vec![OpcUaSecurityPolicy::Aes128Sha256RsaOaep];
        let result = infer_security_policy("aes128_sha256_rsaoaep", &policies);
        assert_eq!(result, "Aes128-Sha256-RsaOaep");
    }
}
