// OpcUaServer(opcua crate v0.12 native 백엔드)에 대한 OpcUaServerBackend 구현.
//
// trait는 opcua-codec(순수)에 정의되고, 구체 구현은 opcua crate에 결합돼 있어
// native 셸(src-tauri)에 둔다. 계약 §4: 어댑터는 trait에만 의존하고, 구체
// 백엔드(현재 OpcUaServer = RustOpcUaBackend) 선택은 src-tauri 조립 지점에서.

use std::collections::HashMap;

use modone_contract::{CanonicalAddress, CanonicalMemory, DirtyPublishWindow};
use opcua_codec::memory::OpcUaNodeId;
use opcua_codec::{OpcUaError, OpcUaServerBackend};

use super::server::OpcUaServer;

impl OpcUaServerBackend for OpcUaServer {
    fn update_node_values(
        &self,
        windows: &[DirtyPublishWindow],
        canonical_memory: &CanonicalMemory,
        publish_map: &HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
    ) -> Result<(), OpcUaError> {
        OpcUaServer::update_node_values(self, windows, canonical_memory, publish_map)
    }

    fn sync_all_node_values(
        &self,
        canonical_memory: &CanonicalMemory,
        publish_map: &HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
    ) -> Result<(), OpcUaError> {
        OpcUaServer::sync_all_node_values(self, canonical_memory, publish_map)
    }
}
