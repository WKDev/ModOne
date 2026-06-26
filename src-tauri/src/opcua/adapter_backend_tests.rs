// OpcUaAdapter ↔ OpcUaServer(native 백엔드) 통합 동작 테스트
//
// 어댑터 코어(OpcUaAdapter)는 opcua-codec 크레이트로 이전됐고 구체
// OpcUaServer 백엔드는 src-tauri에 있으므로, 둘을 함께 구동해 검증하는
// 테스트는 여기(native 셸)에 둔다.

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use parking_lot::RwLock;

    use crate::opcua::server::OpcUaServer;
    use crate::opcua::types::OpcUaConfig;
    use crate::opcua::{OpcUaAdapter, OpcUaMemory};
    use modone_contract::{
        CanonicalAddress, CanonicalAreaKind, CanonicalMemory, CanonicalValue, ProtocolAdapter,
    };

    #[test]
    fn apply_external_writes_updates_canonical_memory() {
        let canonical = Arc::new(RwLock::new(CanonicalMemory::new()));
        let opcua_memory = Arc::new(OpcUaMemory::new());
        let server = Arc::new(OpcUaServer::new(
            OpcUaConfig::default(),
            Arc::clone(&opcua_memory),
        ));
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
            mem.read(CanonicalAddress::new(CanonicalAreaKind::DataWord, 42))
                .unwrap(),
            CanonicalValue::U16(1234)
        );
        assert_eq!(
            mem.read(CanonicalAddress::new(CanonicalAreaKind::InternalBit, 7))
                .unwrap(),
            CanonicalValue::Bool(true)
        );

        // Writes should be drained
        assert!(opcua_memory.take_external_writes().is_empty());
    }

    #[test]
    fn full_sync_applies_writes_then_publishes() {
        let canonical = Arc::new(RwLock::new(CanonicalMemory::new()));
        let opcua_memory = Arc::new(OpcUaMemory::new());
        let server = Arc::new(OpcUaServer::new(
            OpcUaConfig::default(),
            Arc::clone(&opcua_memory),
        ));
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
            mem.read(CanonicalAddress::new(CanonicalAreaKind::DataWord, 0))
                .unwrap(),
            CanonicalValue::U16(9999)
        );
    }
}
