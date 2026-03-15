use std::sync::Arc;

use parking_lot::RwLock;

use crate::modbus::{DirtyPublishWindow, ProtocolAdapter};
use crate::plc_runtime::{CanonicalMemory, CanonicalWriteSource};

use super::memory::OpcUaMemory;
use super::server::OpcUaServer;

/// OPC UA protocol adapter implementing the ProtocolAdapter trait.
///
/// Bridges between the canonical memory model and the OPC UA server's
/// address space, handling bidirectional data flow:
/// - External writes: OPC UA client → canonical memory
/// - State publishing: canonical memory → OPC UA address space variables
pub struct OpcUaAdapter {
    canonical_memory: Arc<RwLock<CanonicalMemory>>,
    opcua_memory: Arc<OpcUaMemory>,
    server: Arc<OpcUaServer>,
}

impl OpcUaAdapter {
    pub fn new(
        canonical_memory: Arc<RwLock<CanonicalMemory>>,
        opcua_memory: Arc<OpcUaMemory>,
        server: Arc<OpcUaServer>,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plc_runtime::{CanonicalAddress, CanonicalAreaKind, CanonicalMemory, CanonicalValue};
    use crate::opcua::types::OpcUaConfig;

    #[test]
    fn apply_external_writes_updates_canonical_memory() {
        let canonical = Arc::new(RwLock::new(CanonicalMemory::new()));
        let opcua_memory = Arc::new(OpcUaMemory::new());
        let server = Arc::new(OpcUaServer::new(OpcUaConfig::default(), Arc::clone(&opcua_memory)));
        let adapter = OpcUaAdapter::new(Arc::clone(&canonical), Arc::clone(&opcua_memory), server);

        // Simulate OPC UA client writing a value
        opcua_memory.record_external_write(
            CanonicalAddress::new(CanonicalAreaKind::DataWord, 42),
            CanonicalValue::U16(1234),
        );
        opcua_memory.record_external_write(
            CanonicalAddress::new(CanonicalAreaKind::InternalBit, 7),
            CanonicalValue::Bool(true),
        );

        // Apply writes
        adapter.apply_external_writes().unwrap();

        // Verify canonical memory was updated
        let mem = canonical.read();
        assert_eq!(
            mem.read(CanonicalAddress::new(CanonicalAreaKind::DataWord, 42)).unwrap(),
            CanonicalValue::U16(1234)
        );
        assert_eq!(
            mem.read(CanonicalAddress::new(CanonicalAreaKind::InternalBit, 7)).unwrap(),
            CanonicalValue::Bool(true)
        );

        // Writes should be drained
        assert!(opcua_memory.take_external_writes().is_empty());
    }

    #[test]
    fn full_sync_applies_writes_then_publishes() {
        let canonical = Arc::new(RwLock::new(CanonicalMemory::new()));
        let opcua_memory = Arc::new(OpcUaMemory::new());
        let server = Arc::new(OpcUaServer::new(OpcUaConfig::default(), Arc::clone(&opcua_memory)));
        let adapter = OpcUaAdapter::new(Arc::clone(&canonical), Arc::clone(&opcua_memory), server);

        // Record a write and do full sync
        opcua_memory.record_external_write(
            CanonicalAddress::new(CanonicalAreaKind::DataWord, 0),
            CanonicalValue::U16(9999),
        );

        adapter.full_sync().unwrap();

        // Should be applied
        let mem = canonical.read();
        assert_eq!(
            mem.read(CanonicalAddress::new(CanonicalAreaKind::DataWord, 0)).unwrap(),
            CanonicalValue::U16(9999)
        );
    }
}
