use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use parking_lot::Mutex;

use crate::plc_runtime::{CanonicalAddress, CanonicalMemory, VendorProfile};
use crate::project::PlcSettings;
use crate::sim::tag_registry::SharedTagRegistry;

#[cfg(feature = "opcua-server")]
use crate::plc_runtime::CanonicalValue;
#[cfg(feature = "opcua-server")]
use super::address_space::{APP_NAMESPACE, OpcUaAccessLevel};
use super::address_space::{AddressSpaceSpec, build_address_space_spec};
use super::memory::{OpcUaMemory, OpcUaNodeId};
use super::types::{OpcUaConfig, OpcUaError, OpcUaStatus};

#[cfg(feature = "opcua-server")]
const DEFAULT_ENDPOINT_PATH: &str = "/";
#[cfg(feature = "opcua-server")]
const LOCAL_USER_TOKEN_ID: &str = "MODONE_LOCAL_USER";

pub struct OpcUaServer {
    config: OpcUaConfig,
    running: Arc<AtomicBool>,
    server_task: Mutex<Option<tokio::task::JoinHandle<()>>>,
    opcua_memory: Arc<OpcUaMemory>,
    address_spec: Mutex<Option<AddressSpaceSpec>>,
    #[cfg(feature = "opcua-server")]
    inner_server: Arc<parking_lot::RwLock<opcua::server::prelude::Server>>,
    #[cfg(feature = "opcua-server")]
    server_initialised: AtomicBool,
}

impl OpcUaServer {
    pub fn new(config: OpcUaConfig, opcua_memory: Arc<OpcUaMemory>) -> Self {
        Self {
            config,
            running: Arc::new(AtomicBool::new(false)),
            server_task: Mutex::new(None),
            opcua_memory,
            address_spec: Mutex::new(None),
            #[cfg(feature = "opcua-server")]
            inner_server: {
                let dummy = opcua::server::prelude::ServerBuilder::new()
                    .server()
                    .expect("default ServerBuilder must produce a valid Server");
                Arc::new(parking_lot::RwLock::new(dummy))
            },
            #[cfg(feature = "opcua-server")]
            server_initialised: AtomicBool::new(false),
        }
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    pub fn status(&self) -> OpcUaStatus {
        OpcUaStatus {
            running: self.is_running(),
            port: self.config.port,
            endpoint: if self.is_running() {
                format!("opc.tcp://{}:{}", self.config.bind_address, self.config.port)
            } else {
                String::new()
            },
            session_count: 0,
            session_count_supported: false,
        }
    }

    pub fn start(
        &self,
        canonical_memory: &parking_lot::RwLock<CanonicalMemory>,
        vendor_profile: &dyn VendorProfile,
        plc_settings: &PlcSettings,
        tag_registry: &SharedTagRegistry,
    ) -> Result<(), OpcUaError> {
        if self.is_running() {
            return Err(OpcUaError::Server("OPC UA server is already running".into()));
        }

        let memory = canonical_memory.read();
        let spec = build_address_space_spec(&memory, vendor_profile, plc_settings, tag_registry);
        drop(memory);

        self.opcua_memory
            .register_nodes(spec.primary_node_map.clone(), spec.publish_map.clone());

        #[cfg(feature = "opcua-server")]
        self.start_opcua_server(&spec)?;

        #[cfg(not(feature = "opcua-server"))]
        log::warn!("OPC UA server feature not enabled, running in stub mode");

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
        _windows: &[crate::modbus::DirtyPublishWindow],
        _canonical_memory: &CanonicalMemory,
        _publish_map: &HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
    ) -> Result<(), OpcUaError> {
        if !self.is_running() {
            return Ok(());
        }

        #[cfg(feature = "opcua-server")]
        self.update_opcua_node_values(_windows, _canonical_memory, _publish_map)?;

        Ok(())
    }

    pub fn sync_all_node_values(
        &self,
        _canonical_memory: &CanonicalMemory,
        _publish_map: &HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
    ) -> Result<(), OpcUaError> {
        if !self.is_running() {
            return Ok(());
        }

        #[cfg(feature = "opcua-server")]
        self.sync_all_opcua_node_values(_canonical_memory, _publish_map)?;

        Ok(())
    }

    #[cfg(feature = "opcua-server")]
    fn start_opcua_server(&self, spec: &AddressSpaceSpec) -> Result<(), OpcUaError> {
        use opcua::server::prelude::*;

        let mut user_token_ids = Vec::new();
        if self.config.anonymous_access {
            user_token_ids.push(ANONYMOUS_USER_TOKEN_ID.to_string());
        }

        let mut builder = ServerBuilder::new()
            .application_name(&self.config.server_name)
            .application_uri(&format!("urn:modone:{}", self.config.server_name))
            .product_uri("urn:modone:opcua")
            .host_and_port(&self.config.bind_address, self.config.port)
            .create_sample_keypair(true)
            .discovery_urls(vec![DEFAULT_ENDPOINT_PATH.to_string()]);

        if let Some(ref pki_dir) = self.config.pki_dir {
            builder = builder.pki_dir(pki_dir);
        }
        if let Some(ref cert_path) = self.config.certificate_path {
            builder = builder.certificate_path(cert_path);
        }
        if let Some(ref key_path) = self.config.private_key_path {
            builder = builder.private_key_path(key_path);
        }

        if let (Some(username), Some(password)) =
            (self.config.username.as_ref(), self.config.password.as_ref())
        {
            user_token_ids.push(LOCAL_USER_TOKEN_ID.to_string());
            builder = builder.user_token(
                LOCAL_USER_TOKEN_ID,
                ServerUserToken::user_pass(username.clone(), password.clone()),
            );
        }

        let endpoint = match self.config.security_policy {
            super::types::OpcUaSecurityPolicy::None => {
                ServerEndpoint::new_none(DEFAULT_ENDPOINT_PATH, &user_token_ids)
            }
            super::types::OpcUaSecurityPolicy::Basic256Sha256 => {
                ServerEndpoint::new_basic256sha256_sign_encrypt(DEFAULT_ENDPOINT_PATH, &user_token_ids)
            }
        };
        builder = builder.endpoint("default", endpoint);

        let server = builder
            .server()
            .ok_or_else(|| OpcUaError::Server("Failed to build OPC UA server from config".into()))?;

        let address_space = server.address_space();
        {
            let mut as_lock = address_space.write();
            let ns_uri = format!("urn:modone:{}", self.config.server_name);
            let ns = as_lock
                .register_namespace(&ns_uri)
                .map_err(|_| OpcUaError::AddressSpace("Failed to register namespace".into()))?;

            let mut folders: HashMap<String, NodeId> = HashMap::new();
            for node_spec in &spec.nodes {
                let parent_id = ensure_folder_path(&mut as_lock, ns, &mut folders, &node_spec.path_segments);
                let node_id = NodeId::new(ns, node_spec.node_id.identifier.clone());

                let vb = VariableBuilder::new(&node_id, &node_spec.browse_name, &node_spec.display_name);
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
                            let our_node_id = OpcUaNodeId::new(APP_NAMESPACE, &identifier);
                            if let Some(canonical_addr) = opcua_memory.resolve_node(&our_node_id) {
                                if let Some(ref variant) = value.value {
                                    let canonical_value = match variant {
                                        Variant::Boolean(b) => CanonicalValue::Bool(*b),
                                        Variant::UInt16(w) => CanonicalValue::U16(*w),
                                        Variant::Int16(w) => CanonicalValue::U16(*w as u16),
                                        Variant::Int32(w) => CanonicalValue::U16(*w as u16),
                                        Variant::UInt32(w) => CanonicalValue::U16(*w as u16),
                                        _ => return Err(StatusCode::BadTypeMismatch),
                                    };
                                    opcua_memory.record_external_write(canonical_addr, canonical_value);
                                    Ok(())
                                } else {
                                    Err(StatusCode::BadTypeMismatch)
                                }
                            } else {
                                Err(StatusCode::BadNodeIdUnknown)
                            }
                        },
                    );
                    vb.value_setter(setter)
                } else {
                    vb
                };

                let _ = as_lock.add_variables(vec![vb.build()], &parent_id);
            }
        }

        {
            let mut lock = self.inner_server.write();
            *lock = server;
        }
        self.server_initialised.store(true, Ordering::Release);

        let inner = Arc::clone(&self.inner_server);
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
        if self.server_initialised.load(Ordering::Acquire) {
            self.inner_server.write().abort();
            self.server_initialised.store(false, Ordering::Release);
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

        if !self.server_initialised.load(Ordering::Acquire) {
            return Ok(());
        }

        let server_guard = self.inner_server.read();
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
                    let opcua_node_id = NodeId::new(APP_NAMESPACE, node_id.identifier.clone());
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

        if !self.server_initialised.load(Ordering::Acquire) {
            return Ok(());
        }

        let server_guard = self.inner_server.read();
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
                    let opcua_node_id = NodeId::new(APP_NAMESPACE, node_id.identifier.clone());
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
