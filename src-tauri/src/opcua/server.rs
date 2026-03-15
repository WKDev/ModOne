use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Arc;

use parking_lot::Mutex;

use crate::plc_runtime::{CanonicalAddress, CanonicalMemory, VendorProfile};
use crate::project::PlcSettings;
use crate::sim::tag_registry::SharedTagRegistry;

#[cfg(feature = "opcua-server")]
use super::address_space::OpcUaAccessLevel;
use super::address_space::{build_address_space_spec, AddressSpaceSpec};
use super::memory::{OpcUaMemory, OpcUaNodeId};
use super::types::{OpcUaConfig, OpcUaError, OpcUaStatus};
#[cfg(feature = "opcua-server")]
use crate::plc_runtime::CanonicalValue;
#[cfg(feature = "opcua-server")]
use sha2::{Digest, Sha256};

const DEFAULT_ENDPOINT_PATH: &str = "/";
#[cfg(feature = "opcua-server")]
const LOCAL_USER_TOKEN_ID: &str = "MODONE_LOCAL_USER";
#[cfg(feature = "opcua-server")]
const RESERVED_NAMESPACE_URI: &str = "urn:modone:internal:reserved";

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

    pub fn start(
        &self,
        canonical_memory: &parking_lot::RwLock<CanonicalMemory>,
        vendor_profile: &dyn VendorProfile,
        plc_settings: &PlcSettings,
        tag_registry: &SharedTagRegistry,
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

        let memory = canonical_memory.read();
        let spec = build_address_space_spec(&memory, vendor_profile, plc_settings, tag_registry);
        drop(memory);

        self.opcua_memory
            .register_nodes(spec.primary_node_map.clone(), spec.publish_map.clone());

        #[cfg(feature = "opcua-server")]
        self.start_opcua_server(&spec)?;

        *self.address_spec.lock() = Some(spec);
        self.running.store(true, Ordering::Relaxed);
        Ok(())
    }

    pub fn stop(&self) -> Result<(), OpcUaError> {
        if !self.is_running() {
            return Ok(());
        }

        self.running.store(false, Ordering::Relaxed);

        #[cfg(feature = "opcua-server")]
        self.stop_opcua_server();

        if let Some(task) = self.server_task.lock().take() {
            task.abort();
        }

        *self.address_spec.lock() = None;
        self.opcua_memory.clear();
        Ok(())
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

    #[cfg(feature = "opcua-server")]
    fn start_opcua_server(&self, spec: &AddressSpaceSpec) -> Result<(), OpcUaError> {
        use opcua::server::prelude::*;

        let username = self
            .config
            .username
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .ok_or_else(|| OpcUaError::Config("Username is required for OPC UA".into()))?;
        let password = self
            .config
            .password
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .ok_or_else(|| OpcUaError::Config("Password is required for OPC UA".into()))?;

        let certificate_metadata = bootstrap_server_pki(&self.config)?;
        *self.certificate_metadata.lock() = certificate_metadata;

        let user_token_ids = vec![LOCAL_USER_TOKEN_ID.to_string()];

        let mut builder = ServerBuilder::new()
            .application_name(&self.config.server_name)
            .application_uri(&format!("urn:modone:{}", self.config.server_name))
            .product_uri("urn:modone:opcua")
            .host_and_port(&self.config.bind_address, self.config.port)
            .pki_dir(&self.config.pki_dir)
            .certificate_path(&self.config.certificate_path)
            .private_key_path(&self.config.private_key_path)
            .create_sample_keypair(false)
            .discovery_urls(vec![DEFAULT_ENDPOINT_PATH.to_string()])
            .user_token(
                LOCAL_USER_TOKEN_ID,
                ServerUserToken::user_pass(username.to_string(), password.to_string()),
            );

        let endpoint =
            ServerEndpoint::new_basic256sha256_sign_encrypt(DEFAULT_ENDPOINT_PATH, &user_token_ids);
        builder = builder.endpoint("default", endpoint);

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

                let _ = as_lock.add_variables(vec![vb.build()], &parent_id);
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

#[cfg(feature = "opcua-server")]
fn ensure_folder_path(
    as_lock: &mut opcua::server::prelude::AddressSpace,
    ns: u16,
    folders: &mut HashMap<String, opcua::server::prelude::NodeId>,
    path_segments: &[String],
) -> opcua::server::prelude::NodeId {
    use opcua::server::prelude::NodeId;

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
            as_lock.add_folder_with_id(&folder_id, segment, segment, &parent_id);
            folder_id
        });
        parent_id = folder_id.clone();
    }

    parent_id
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
            .discovery_urls(vec![DEFAULT_ENDPOINT_PATH.to_string()])
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
}
