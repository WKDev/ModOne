use std::collections::HashMap;

use parking_lot::Mutex;

use crate::plc_runtime::{CanonicalAddress, CanonicalValue};

/// Unique identifier for an OPC UA node in the address space.
///
/// This is a lightweight wrapper instead of depending on the opcua crate's NodeId
/// so that the memory module can be compiled without the opcua feature.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct OpcUaNodeId {
    pub namespace: u16,
    pub identifier: String,
}

impl OpcUaNodeId {
    pub fn new(namespace: u16, identifier: impl Into<String>) -> Self {
        Self {
            namespace,
            identifier: identifier.into(),
        }
    }
}

impl std::fmt::Display for OpcUaNodeId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ns={};s=\"{}\"", self.namespace, self.identifier)
    }
}

/// A single external write recorded from an OPC UA client.
#[derive(Debug, Clone)]
pub struct ExternalWrite {
    pub address: CanonicalAddress,
    pub value: CanonicalValue,
}

/// Tracks OPC UA client writes and maintains the node-to-canonical address mapping.
///
/// Mirrors the ModbusMemory pattern of `external_coil_writes`/`external_holding_writes`
/// but generalized for arbitrary canonical addresses.
pub struct OpcUaMemory {
    /// Writes from OPC UA clients, drained by the adapter each flush cycle.
    external_writes: Mutex<Vec<ExternalWrite>>,
    /// Canonical address → OPC UA NodeId mapping (built during address space creation).
    node_map: parking_lot::RwLock<HashMap<CanonicalAddress, OpcUaNodeId>>,
    /// Reverse mapping: OPC UA NodeId → CanonicalAddress (used in write callbacks).
    reverse_map: parking_lot::RwLock<HashMap<OpcUaNodeId, CanonicalAddress>>,
}

impl OpcUaMemory {
    pub fn new() -> Self {
        Self {
            external_writes: Mutex::new(Vec::new()),
            node_map: parking_lot::RwLock::new(HashMap::new()),
            reverse_map: parking_lot::RwLock::new(HashMap::new()),
        }
    }

    /// Record a write from an OPC UA client. Called from the OPC UA server write callback.
    pub fn record_external_write(&self, address: CanonicalAddress, value: CanonicalValue) {
        self.external_writes
            .lock()
            .push(ExternalWrite { address, value });
    }

    /// Drain all pending external writes. Called by the adapter during flush.
    pub fn take_external_writes(&self) -> Vec<ExternalWrite> {
        std::mem::take(&mut *self.external_writes.lock())
    }

    /// Register the full node mapping after building the address space.
    pub fn register_nodes(&self, map: HashMap<CanonicalAddress, OpcUaNodeId>) {
        let reverse: HashMap<OpcUaNodeId, CanonicalAddress> = map
            .iter()
            .map(|(addr, node_id)| (node_id.clone(), *addr))
            .collect();
        *self.node_map.write() = map;
        *self.reverse_map.write() = reverse;
    }

    /// Look up the canonical address for a given OPC UA NodeId.
    pub fn resolve_node(&self, node_id: &OpcUaNodeId) -> Option<CanonicalAddress> {
        self.reverse_map.read().get(node_id).copied()
    }

    /// Look up the OPC UA NodeId for a given canonical address.
    pub fn resolve_address(&self, address: &CanonicalAddress) -> Option<OpcUaNodeId> {
        self.node_map.read().get(address).cloned()
    }

    /// Get a snapshot of all mapped canonical addresses and their node IDs.
    pub fn node_map_snapshot(&self) -> HashMap<CanonicalAddress, OpcUaNodeId> {
        self.node_map.read().clone()
    }

    /// Number of registered nodes.
    pub fn node_count(&self) -> usize {
        self.node_map.read().len()
    }

    /// Clear all mappings and pending writes.
    pub fn clear(&self) {
        self.external_writes.lock().clear();
        self.node_map.write().clear();
        self.reverse_map.write().clear();
    }
}

impl Default for OpcUaMemory {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plc_runtime::CanonicalAreaKind;

    #[test]
    fn record_and_drain_external_writes() {
        let memory = OpcUaMemory::new();

        memory.record_external_write(
            CanonicalAddress::new(CanonicalAreaKind::DataWord, 42),
            CanonicalValue::U16(1234),
        );
        memory.record_external_write(
            CanonicalAddress::new(CanonicalAreaKind::InternalBit, 7),
            CanonicalValue::Bool(true),
        );

        let writes = memory.take_external_writes();
        assert_eq!(writes.len(), 2);
        assert_eq!(writes[0].address, CanonicalAddress::new(CanonicalAreaKind::DataWord, 42));
        assert!(matches!(writes[0].value, CanonicalValue::U16(1234)));

        // Second drain should be empty
        assert!(memory.take_external_writes().is_empty());
    }

    #[test]
    fn register_and_resolve_nodes() {
        let memory = OpcUaMemory::new();

        let mut map = HashMap::new();
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 0);
        let node_id = OpcUaNodeId::new(2, "DataWord.0");
        map.insert(addr, node_id.clone());

        memory.register_nodes(map);

        assert_eq!(memory.resolve_address(&addr), Some(node_id.clone()));
        assert_eq!(memory.resolve_node(&node_id), Some(addr));
        assert_eq!(memory.node_count(), 1);
    }
}
