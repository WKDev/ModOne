// OPC UA 모듈. 순수 코어(codec/주소공간 스펙/어댑터/trait)는 opcua-codec
// 크레이트로 이전됐고, 여기서 같은 이름으로 재노출해 기존 `crate::opcua::*`
// 경로를 유지한다. native 전용(server/auth/audit + 프로젝트 결합 빌더 +
// 백엔드 trait 구현)은 src-tauri에 잔류한다.

// native 전용 모듈
pub mod address_space;
pub mod audit;
pub mod auth;
pub mod backend_impl;
pub mod control;
pub mod node_values;
pub mod server;
pub mod types;

// opcua-codec(순수 코어) 모듈 재노출 — `super::memory::` 등 기존 경로 호환
pub use opcua_codec::{adapter, address_space_spec, backend, dirty_tracker, error, mapping, memory};

// 재배치된 테스트(구체 OpcUaServer/project 의존이라 native 셸에 둠)
#[cfg(test)]
mod adapter_backend_tests;
#[cfg(test)]
mod mapping_project_tests;

pub use opcua_codec::adapter::OpcUaAdapter;
pub use opcua_codec::backend::OpcUaServerBackend;
pub use control::OpcUaServerControl;
pub use audit::{
    AuditClientInfo, AuditEventCategory, AuditEventType, AuditLogEntry, AuditLogQuery,
    AuditLogResult, AuditLogger, AuditLoggerState, AuditSeverity,
};
pub use auth::{
    AuthError, CredentialCache, UserAccount, UserAccountInfo, UserAccountStore, UserRole,
    VerifiedCredential, resolve_verified_credentials, resolve_verified_credentials_audited,
};
pub use address_space::is_bool_address;
pub use opcua_codec::dirty_tracker::{DirtyTracker, SharedDirtyTracker};
pub use opcua_codec::mapping::{
    ByteOrder, MappedValue, MappingAccessLevel, MappingError, OpcUaDataType, OpcUaMappingConfig,
    OpcUaMappingStore, RegisterRange, ScalingConfig, ScalingKind, SharedMappingStore,
    StringEncoding, StringMappingConfig, eng_to_raw, f32_to_registers, f64_to_registers,
    raw_to_eng, read_bool_mapped, read_registers_to_mapped, registers_to_f32, registers_to_f64,
    registers_to_string, string_to_registers, write_bool_mapped, write_mapped_to_registers,
};
pub use opcua_codec::memory::OpcUaMemory;
pub use server::OpcUaServer;
pub use types::{OpcUaConfig, OpcUaError, OpcUaSecurityPolicy, OpcUaSessionInfo, OpcUaStatus};
