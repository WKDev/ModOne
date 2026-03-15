use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::Mutex;

use crate::plc_runtime::{CanonicalAddress, CanonicalMemory, VendorProfile};
use crate::project::PlcSettings;

#[cfg(feature = "opcua-server")]
use crate::plc_runtime::CanonicalValue;

use super::address_space::{build_address_space_spec, AddressSpaceSpec};

#[cfg(feature = "opcua-server")]
use super::address_space::{OpcUaAccessLevel, APP_NAMESPACE};
use super::memory::{OpcUaMemory, OpcUaNodeId};
use super::types::{OpcUaConfig, OpcUaError, OpcUaStatus};

/// OPC UA server wrapper.
///
/// Manages the lifecycle of an OPC UA TCP server, including address space
/// construction, write callback registration, and value updates.
pub struct OpcUaServer {
    config: OpcUaConfig,
    running: Arc<AtomicBool>,
    server_task: Mutex<Option<tokio::task::JoinHandle<()>>>,
    opcua_memory: Arc<OpcUaMemory>,
    /// Cached address space spec for value updates.
    address_spec: Mutex<Option<AddressSpaceSpec>>,
    /// The inner opcua server wrapped in Arc<RwLock<>> so it can be shared
    /// with the background task and stopped from another thread.
    #[cfg(feature = "opcua-server")]
    inner_server: Arc<parking_lot::RwLock<opcua::server::prelude::Server>>,
    /// Whether the inner server has been initialised (separate from `running`
    /// which tracks the full start lifecycle).
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
                // Create a dummy server that will be replaced on start().
                // ServerBuilder::new() creates a minimal valid config.
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

    pub fn config(&self) -> &OpcUaConfig {
        &self.config
    }

    pub fn memory(&self) -> &Arc<OpcUaMemory> {
        &self.opcua_memory
    }

    /// Start the OPC UA server.
    ///
    /// Builds the address space from canonical memory and vendor profile,
    /// registers write callbacks, and spawns the server on a background task.
    pub fn start(
        &self,
        canonical_memory: &parking_lot::RwLock<CanonicalMemory>,
        vendor_profile: &dyn VendorProfile,
        plc_settings: &PlcSettings,
    ) -> Result<(), OpcUaError> {
        if self.is_running() {
            return Err(OpcUaError::Server("OPC UA server is already running".into()));
        }

        // Build address space spec
        let memory = canonical_memory.read();
        let spec = build_address_space_spec(&memory, vendor_profile, plc_settings);
        drop(memory);

        // Register node mappings in OpcUaMemory
        self.opcua_memory.register_nodes(spec.node_map.clone());

        log::info!(
            "OPC UA: Built address space with {} nodes ({} unique canonical addresses)",
            spec.nodes.len(),
            spec.node_map.len(),
        );

        // Start the actual OPC UA server
        #[cfg(feature = "opcua-server")]
        {
            self.start_opcua_server(&spec)?;
        }

        #[cfg(not(feature = "opcua-server"))]
        {
            log::warn!("OPC UA server feature not enabled, running in stub mode");
        }

        *self.address_spec.lock() = Some(spec);
        self.running.store(true, Ordering::Relaxed);

        log::info!(
            "OPC UA server started on opc.tcp://{}:{}",
            self.config.bind_address,
            self.config.port
        );

        Ok(())
    }

    /// Stop the OPC UA server.
    pub fn stop(&self) -> Result<(), OpcUaError> {
        if !self.is_running() {
            return Ok(());
        }

        self.running.store(false, Ordering::Relaxed);

        #[cfg(feature = "opcua-server")]
        {
            self.stop_opcua_server();
        }

        if let Some(task) = self.server_task.lock().take() {
            task.abort();
        }

        *self.address_spec.lock() = None;
        self.opcua_memory.clear();

        log::info!("OPC UA server stopped");
        Ok(())
    }

    /// Get current server status.
    pub fn status(&self) -> OpcUaStatus {
        OpcUaStatus {
            running: self.is_running(),
            port: self.config.port,
            endpoint: if self.is_running() {
                format!(
                    "opc.tcp://{}:{}",
                    self.config.bind_address, self.config.port
                )
            } else {
                String::new()
            },
            session_count: 0, // TODO: track active sessions
        }
    }

    /// Update OPC UA variable node values from canonical memory.
    ///
    /// Called by OpcUaAdapter::publish_dirty_state to push changed values
    /// into the OPC UA address space. The opcua crate's subscription engine
    /// then automatically notifies subscribed clients.
    pub fn update_node_values(
        &self,
        windows: &[crate::modbus::DirtyPublishWindow],
        canonical_memory: &CanonicalMemory,
        node_map: &HashMap<CanonicalAddress, OpcUaNodeId>,
    ) -> Result<(), OpcUaError> {
        if !self.is_running() {
            return Ok(());
        }

        #[cfg(feature = "opcua-server")]
        {
            self.update_opcua_node_values(windows, canonical_memory, node_map)?;
        }

        #[cfg(not(feature = "opcua-server"))]
        {
            let _ = (windows, canonical_memory, node_map);
        }

        Ok(())
    }

    /// Update all mapped node values from canonical memory (full sync).
    pub fn sync_all_node_values(
        &self,
        canonical_memory: &CanonicalMemory,
        node_map: &HashMap<CanonicalAddress, OpcUaNodeId>,
    ) -> Result<(), OpcUaError> {
        if !self.is_running() {
            return Ok(());
        }

        #[cfg(feature = "opcua-server")]
        {
            self.sync_all_opcua_node_values(canonical_memory, node_map)?;
        }

        #[cfg(not(feature = "opcua-server"))]
        {
            let _ = (canonical_memory, node_map);
        }

        Ok(())
    }

    // =========================================================================
    // opcua crate integration (behind feature gate)
    // =========================================================================

    #[cfg(feature = "opcua-server")]
    fn start_opcua_server(&self, spec: &AddressSpaceSpec) -> Result<(), OpcUaError> {
        use opcua::server::prelude::*;

        let mut builder = ServerBuilder::new()
            .application_name(&self.config.server_name)
            .application_uri(&format!("urn:ModOne:{}", self.config.server_name))
            .host_and_port(&self.config.bind_address, self.config.port)
            .create_sample_keypair(true)
            .discovery_urls(vec![format!(
                "opc.tcp://{}:{}",
                self.config.bind_address, self.config.port
            )]);

        if self.config.anonymous_access {
            builder = builder.endpoint(
                "none",
                ServerEndpoint::new_none("/", &[ANONYMOUS_USER_TOKEN_ID.into()]),
            );
        }

        let server = builder
            .server()
            .ok_or_else(|| OpcUaError::Server("Failed to build OPC UA server from config".into()))?;

        // Build address space
        let address_space = server.address_space();
        {
            let mut as_lock = address_space.write();
            let ns_uri = format!("urn:ModOne:{}", self.config.server_name);
            let ns = as_lock
                .register_namespace(&ns_uri)
                .map_err(|_| OpcUaError::AddressSpace("Failed to register namespace".into()))?;

            // Create PLCSimulator folder
            let plc_folder_id = NodeId::new(ns, "PLCSimulator");
            as_lock.add_folder_with_id(
                &plc_folder_id,
                "PLCSimulator",
                "PLC Simulator Root",
                &NodeId::objects_folder_id(),
            );

            // Create MemoryAreas folder
            let memory_areas_folder_id = NodeId::new(ns, "MemoryAreas");
            as_lock.add_folder_with_id(
                &memory_areas_folder_id,
                "MemoryAreas",
                "Canonical Memory Areas",
                &plc_folder_id,
            );

            // Track which area folders we've created
            let mut area_folders: HashMap<String, NodeId> = HashMap::new();

            for node_spec in &spec.nodes {
                let area_name = format!("{:?}", node_spec.canonical_address.area);

                // Create area folder if needed
                let parent_id = area_folders.entry(area_name.clone()).or_insert_with(|| {
                    let folder_id = NodeId::new(ns, area_name.clone());
                    as_lock.add_folder_with_id(
                        &folder_id,
                        &area_name,
                        &area_name,
                        &memory_areas_folder_id,
                    );
                    folder_id
                });

                let node_id = NodeId::new(ns, node_spec.node_id.identifier.clone());

                // Build variable using VariableBuilder for proper access level
                let vb = VariableBuilder::new(&node_id, &node_spec.display_name, &node_spec.display_name);

                let vb = if node_spec.is_bool {
                    vb.data_type(DataTypeId::Boolean).value(false)
                } else {
                    vb.data_type(DataTypeId::UInt16).value(0u16)
                };

                // Set writable if ReadWrite
                let vb = if node_spec.access_level == OpcUaAccessLevel::ReadWrite {
                    vb.writable()
                } else {
                    vb
                };

                // Attach write callback for writable variables
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

                let var = vb.build();
                let _ = as_lock.add_variables(vec![var], parent_id);
            }
        }

        // Replace the dummy server and spawn the run task
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
        node_map: &HashMap<CanonicalAddress, OpcUaNodeId>,
    ) -> Result<(), OpcUaError> {
        use opcua::server::prelude::*;

        if !self.server_initialised.load(Ordering::Acquire) {
            return Ok(());
        }

        let server_guard = self.inner_server.read();

        let address_space = server_guard.address_space();
        let mut as_lock = address_space.write();
        let now = DateTime::now();

        for (canonical_addr, node_id) in node_map {
            let in_window = windows.iter().any(|w| {
                w.area == canonical_addr.area
                    && canonical_addr.index >= w.start_index
                    && canonical_addr.index <= w.end_index
            });

            if !in_window {
                continue;
            }

            let opcua_node_id = NodeId::new(APP_NAMESPACE, node_id.identifier.clone());

            if let Ok(value) = canonical_memory.read(*canonical_addr) {
                let variant = match value {
                    CanonicalValue::Bool(b) => Variant::Boolean(b),
                    CanonicalValue::U16(w) => Variant::UInt16(w),
                };
                let _ = as_lock.set_variable_value(
                    &opcua_node_id,
                    variant,
                    &now,
                    &now,
                );
            }
        }

        Ok(())
    }

    #[cfg(feature = "opcua-server")]
    fn sync_all_opcua_node_values(
        &self,
        canonical_memory: &CanonicalMemory,
        node_map: &HashMap<CanonicalAddress, OpcUaNodeId>,
    ) -> Result<(), OpcUaError> {
        use opcua::server::prelude::*;

        if !self.server_initialised.load(Ordering::Acquire) {
            return Ok(());
        }

        let server_guard = self.inner_server.read();

        let address_space = server_guard.address_space();
        let mut as_lock = address_space.write();
        let now = DateTime::now();

        for (canonical_addr, node_id) in node_map {
            let opcua_node_id = NodeId::new(APP_NAMESPACE, node_id.identifier.clone());

            if let Ok(value) = canonical_memory.read(*canonical_addr) {
                let variant = match value {
                    CanonicalValue::Bool(b) => Variant::Boolean(b),
                    CanonicalValue::U16(w) => Variant::UInt16(w),
                };
                let _ = as_lock.set_variable_value(
                    &opcua_node_id,
                    variant,
                    &now,
                    &now,
                );
            }
        }

        Ok(())
    }
}
