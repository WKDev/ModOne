use std::sync::Arc;

use parking_lot::RwLock;

use modone_contract::{DirtyPublishWindow, ProtocolAdapter};
use modone_contract::{CanonicalMemory, CanonicalWriteSource};

use crate::backend::OpcUaServerBackend;
use crate::memory::OpcUaMemory;

/// OPC UA protocol adapter implementing the ProtocolAdapter trait.
///
/// Bridges between the canonical memory model and the OPC UA server's
/// address space, handling bidirectional data flow:
/// - External writes: OPC UA client → canonical memory
/// - State publishing: canonical memory → OPC UA address space variables
///
/// Depends only on the [`OpcUaServerBackend`] trait (계약 §4): the concrete
/// backend (`OpcUaServer` today, a .NET daemon later) is chosen at the
/// src-tauri assembly point, not here.
pub struct OpcUaAdapter {
    canonical_memory: Arc<RwLock<CanonicalMemory>>,
    opcua_memory: Arc<OpcUaMemory>,
    server: Arc<dyn OpcUaServerBackend>,
}

impl OpcUaAdapter {
    pub fn new(
        canonical_memory: Arc<RwLock<CanonicalMemory>>,
        opcua_memory: Arc<OpcUaMemory>,
        server: Arc<dyn OpcUaServerBackend>,
    ) -> Self {
        Self {
            canonical_memory,
            opcua_memory,
            server,
        }
    }

    /// Apply external writes from OPC UA clients into canonical memory.
    fn apply_writes(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let writes = self.opcua_memory.take_external_writes();
        if writes.is_empty() {
            return Ok(());
        }

        let mut mem = self.canonical_memory.write();
        for w in writes {
            mem.write(w.address, w.value, CanonicalWriteSource::ExternalProtocol)?;
        }
        Ok(())
    }

    /// Publish dirty canonical state into OPC UA address space variable nodes.
    fn publish_dirty(
        &self,
        windows: &[DirtyPublishWindow],
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if windows.is_empty() {
            return Ok(());
        }

        let mem = self.canonical_memory.read();
        let publish_map = self.opcua_memory.publish_map_snapshot();

        self.server
            .update_node_values(windows, &mem, &publish_map)
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
    }

    /// Publish full runtime state into OPC UA address space.
    fn publish_all(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mem = self.canonical_memory.read();
        let publish_map = self.opcua_memory.publish_map_snapshot();

        self.server
            .sync_all_node_values(&mem, &publish_map)
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
    }
}

impl ProtocolAdapter for OpcUaAdapter {
    fn apply_external_writes(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.apply_writes()
    }

    fn publish_dirty_state(
        &self,
        windows: &[DirtyPublishWindow],
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.publish_dirty(windows)
    }

    fn publish_runtime_state(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.publish_all()
    }

    fn full_sync(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.apply_writes()?;
        self.publish_all()
    }
}
