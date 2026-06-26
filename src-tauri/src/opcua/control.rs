// OPC UA 서버 라이프사이클/상태를 trait 뒤에 숨겨 백엔드 교체(Rust↔.NET)를
// 가능케 하는 native 경계 (계약 §4의 커맨드 측).
//
// 어댑터-측 publish 경계는 opcua-codec의 `OpcUaServerBackend`(순수)가 담당하고,
// 여기서는 커맨드/셸이 쓰는 라이프사이클(start/stop/status/sessions)을 추상화한다.
// 이 trait은 native 전용 타입(OpcUaStatus/OpcUaSessionInfo/AuditLoggerState)을
// 참조하므로 src-tauri에 둔다. 구체 백엔드 선택은 src-tauri 조립 지점 한 곳
// (`start_server_common`)에서 이뤄진다.

use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::RwLock;

use modone_contract::CanonicalMemory;
use opcua_codec::OpcUaError;

use super::address_space::AddressSpaceSpec;
use super::audit::AuditLoggerState;
use super::server::OpcUaServer;
use super::types::{OpcUaSessionInfo, OpcUaStatus};

/// OPC UA 서버 라이프사이클/상태 추상화.
///
/// 구체 구현체:
/// - `OpcUaServer` (`opcua` crate v0.12 래핑, 현재 native 기본 백엔드)
/// - `DotNetOpcUaBackend` (별도 프로세스, 추후) — 동일 trait 구현
pub trait OpcUaServerControl: Send + Sync {
    /// 사전 빌드된 주소공간 spec으로 서버를 시작한다.
    fn start(
        &self,
        canonical_memory: &Arc<RwLock<CanonicalMemory>>,
        spec: AddressSpaceSpec,
        audit_logger: Option<&AuditLoggerState>,
        audit_data_dir: Option<PathBuf>,
    ) -> Result<(), OpcUaError>;

    /// 서버를 정지한다(기본 사유 user_request).
    fn stop(&self, audit_logger: Option<&AuditLoggerState>) -> Result<(), OpcUaError>;

    /// 종료 사유를 audit에 남기며 서버를 정지한다.
    fn stop_with_reason(
        &self,
        audit_logger: Option<&AuditLoggerState>,
        reason: &str,
    ) -> Result<(), OpcUaError>;

    /// 서버 가동 여부.
    fn is_running(&self) -> bool;

    /// 프런트엔드용 서버 상태.
    fn status(&self) -> OpcUaStatus;

    /// 활성 세션 정보.
    fn get_sessions(&self) -> Vec<OpcUaSessionInfo>;
}

impl OpcUaServerControl for OpcUaServer {
    fn start(
        &self,
        canonical_memory: &Arc<RwLock<CanonicalMemory>>,
        spec: AddressSpaceSpec,
        audit_logger: Option<&AuditLoggerState>,
        audit_data_dir: Option<PathBuf>,
    ) -> Result<(), OpcUaError> {
        OpcUaServer::start(self, canonical_memory, spec, audit_logger, audit_data_dir)
    }

    fn stop(&self, audit_logger: Option<&AuditLoggerState>) -> Result<(), OpcUaError> {
        OpcUaServer::stop(self, audit_logger)
    }

    fn stop_with_reason(
        &self,
        audit_logger: Option<&AuditLoggerState>,
        reason: &str,
    ) -> Result<(), OpcUaError> {
        OpcUaServer::stop_with_reason(self, audit_logger, reason)
    }

    fn is_running(&self) -> bool {
        OpcUaServer::is_running(self)
    }

    fn status(&self) -> OpcUaStatus {
        OpcUaServer::status(self)
    }

    fn get_sessions(&self) -> Vec<OpcUaSessionInfo> {
        OpcUaServer::get_sessions(self)
    }
}
