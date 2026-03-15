use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::Mutex;

use crate::plc_runtime::{CanonicalAddress, CanonicalMemory, VendorProfile};
use crate::project::PlcSettings;

#[cfg(feature = "opcua-server")]
use crate::plc_runtime::{CanonicalAreaKind, CanonicalValue};

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
    /// The inner opcua::server::Server handle (behind feature gate).
    #[cfg(feature = "opcua-server")]
    inner_server: Arc<parking_lot::RwLock<Option<opcua::server::Server>>>,
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
            inner_server: Arc::new(parking_lot::RwLock::new(None)),
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

        let server_config = ServerBuilder::new()
            .application_name(&self.config.server_name)
            .application_uri(&format!("urn:ModOne:{}", self.config.server_name))
            .host_and_port(&self.config.bind_address, self.config.port)
            .discovery_urls(vec![format!(
                "opc.tcp://{}:{}",
                self.config.bind_address, self.config.port
            )]);

        let server_config = if self.config.anonymous_access {
            server_config
                .endpoint(
                    "none",
                    ServerEndpoint::new_none("/", &[ANONYMOUS_USER_TOKEN_ID.into()]),
                )
        } else {
            server_config
        };

        let mut server = server_config
            .server()
            .map_err(|e| OpcUaError::Server(format!("Failed to build OPC UA server: {}", e)))?;

        // Build address space
        let address_space = server.address_space();
        {
            let mut address_space = address_space.write();
            let ns = address_space.register_namespace(&format!("urn:ModOne:{}", self.config.server_name))
                .map_err(|e| OpcUaError::AddressSpace(format!("Failed to register namespace: {}", e)))?;

            // Create PLCSimulator folder
            let plc_folder_id = NodeId::new(ns, "PLCSimulator");
            address_space.add_folder(
                &plc_folder_id,
                "PLCSimulator",
                "PLC Simulator Root",
                &NodeId::objects_folder_id(),
            );

            // Create MemoryAreas folder
            let memory_areas_folder_id = NodeId::new(ns, "MemoryAreas");
            address_space.add_folder(
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
                    let folder_id = NodeId::new(ns, &area_name);
                    address_space.add_folder(
                        &folder_id,
                        &area_name,
                        &area_name,
                        &memory_areas_folder_id,
                    );
                    folder_id
                });

                let node_id = NodeId::new(ns, node_spec.node_id.identifier.as_str());

                if node_spec.is_bool {
                    let mut var = Variable::new(&node_id, &node_spec.display_name, &node_spec.display_name, false);
                    if node_spec.access_level == OpcUaAccessLevel::ReadWrite {
                        var.set_access_level(AccessLevel::CURRENT_READ | AccessLevel::CURRENT_WRITE);
                    } else {
                        var.set_access_level(AccessLevel::CURRENT_READ);
                    }
                    let _ = address_space.add_variable(var, parent_id);
                } else {
                    let mut var = Variable::new(&node_id, &node_spec.display_name, &node_spec.display_name, 0u16);
                    if node_spec.access_level == OpcUaAccessLevel::ReadWrite {
                        var.set_access_level(AccessLevel::CURRENT_READ | AccessLevel::CURRENT_WRITE);
                    } else {
                        var.set_access_level(AccessLevel::CURRENT_READ);
                    }
                    let _ = address_space.add_variable(var, parent_id);
                }
            }
        }

        // Register write callback
        let opcua_memory = Arc::clone(&self.opcua_memory);
        {
            let mut address_space = address_space.write();
            let node_ids: Vec<NodeId> = spec.nodes.iter()
                .filter(|n| n.access_level == OpcUaAccessLevel::ReadWrite)
                .map(|n| NodeId::new(APP_NAMESPACE, n.node_id.identifier.as_str()))
                .collect();

            let setter = AttributeSetterCallback::new(move |node_id, _attr_id, value| {
                let id_str = if let Identifier::String(ref s) = node_id.identifier {
                    s.as_ref().to_string()
                } else {
                    return StatusCode::BadNodeIdUnknown;
                };

                let our_node_id = OpcUaNodeId::new(APP_NAMESPACE, &id_str);
                if let Some(canonical_addr) = opcua_memory.resolve_node(&our_node_id) {
                    if let Some(ref variant) = value.value {
                        let canonical_value = match variant {
                            Variant::Boolean(b) => CanonicalValue::Bool(*b),
                            Variant::UInt16(w) => CanonicalValue::U16(*w),
                            Variant::Int16(w) => CanonicalValue::U16(*w as u16),
                            Variant::Int32(w) => CanonicalValue::U16(*w as u16),
                            Variant::UInt32(w) => CanonicalValue::U16(*w as u16),
                            _ => return StatusCode::BadTypeMismatch,
                        };
                        opcua_memory.record_external_write(canonical_addr, canonical_value);
                        StatusCode::Good
                    } else {
                        StatusCode::BadTypeMismatch
                    }
                } else {
                    StatusCode::BadNodeIdUnknown
                }
            });

            for node_id in &node_ids {
                address_space.set_attribute_setter(node_id, setter.clone());
            }
        }

        // Store server and spawn
        *self.inner_server.write() = Some(server);

        let inner = Arc::clone(&self.inner_server);
        let running = Arc::clone(&self.running);
        let task = tokio::task::spawn_blocking(move || {
            if let Some(ref mut server) = *inner.write() {
                server.run();
            }
            running.store(false, Ordering::Relaxed);
        });

        *self.server_task.lock() = Some(task);
        Ok(())
    }

    #[cfg(feature = "opcua-server")]
    fn stop_opcua_server(&self) {
        if let Some(ref server) = *self.inner_server.read() {
            server.abort();
        }
        *self.inner_server.write() = None;
    }

    #[cfg(feature = "opcua-server")]
    fn update_opcua_node_values(
        &self,
        windows: &[crate::modbus::DirtyPublishWindow],
        canonical_memory: &CanonicalMemory,
        node_map: &HashMap<CanonicalAddress, OpcUaNodeId>,
    ) -> Result<(), OpcUaError> {
        use opcua::server::prelude::*;

        let server_guard = self.inner_server.read();
        let Some(ref server) = *server_guard else {
            return Ok(());
        };

        let address_space = server.address_space();
        let mut address_space = address_space.write();
        let now = DateTime::now();

        for (canonical_addr, node_id) in node_map {
            // Check if this address falls within any dirty window
            let in_window = windows.iter().any(|w| {
                w.area == canonical_addr.area
                    && canonical_addr.index >= w.start_index
                    && canonical_addr.index <= w.end_index
            });

            if !in_window {
                continue;
            }

            let opcua_node_id = NodeId::new(APP_NAMESPACE, node_id.identifier.as_str());

            if let Ok(value) = canonical_memory.read(*canonical_addr) {
                let variant = match value {
                    CanonicalValue::Bool(b) => Variant::Boolean(b),
                    CanonicalValue::U16(w) => Variant::UInt16(w),
                };
                let _ = address_space.set_variable_value(
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

        let server_guard = self.inner_server.read();
        let Some(ref server) = *server_guard else {
            return Ok(());
        };

        let address_space = server.address_space();
        let mut address_space = address_space.write();
        let now = DateTime::now();

        for (canonical_addr, node_id) in node_map {
            let opcua_node_id = NodeId::new(APP_NAMESPACE, node_id.identifier.as_str());

            if let Ok(value) = canonical_memory.read(*canonical_addr) {
                let variant = match value {
                    CanonicalValue::Bool(b) => Variant::Boolean(b),
                    CanonicalValue::U16(w) => Variant::UInt16(w),
                };
                let _ = address_space.set_variable_value(
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
