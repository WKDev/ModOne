//! Protocol-agnostic PLC runtime foundation.
//!
//! This module introduces the canonical memory model that future vendor
//! profiles, tags, and protocol adapters will build on.

mod modbus_policy;

// canonical 메모리 모델/타입/이벤트버스는 modone-contract 크레이트로 이전됨.
// vendor 프로파일/하드웨어 모델은 plc-model 크레이트로 이전됨.
// 기존 `crate::plc_runtime::...` 경로 호환을 위해 모듈과 항목을 재노출한다.
pub use modone_contract::{event_bus, memory, types};
pub use plc_model::profiles;

pub use event_bus::CanonicalMemoryBus;
pub use memory::{CanonicalMemory, CanonicalMemoryError, CanonicalMemorySnapshot};
pub use modbus_policy::resolve_modbus_mapping_policy;
pub use plc_model::{
    resolve_vendor_profile, ModbusAddressSpace, ModbusMappingPolicy, ModbusMappingRule,
    ModbusMappingSource, OpcUaAliasPolicy, VendorAddress, VendorAddressMetadata,
    VendorAddressNumberBase, VendorDataKind, VendorProfile, VendorProfileError, VendorProfileId,
};
pub use types::{
    CanonicalAccess, CanonicalAddress, CanonicalAreaKind, CanonicalMemoryBatchChange,
    CanonicalMemoryChange, CanonicalMemoryEvent, CanonicalValue, CanonicalWriteSource,
};
