//! OPC UA 감사 로그 — 범용 `modone-audit` 엔진에 OPC UA 의미론(카테고리·이벤트타입
//! + 인증/계정 헬퍼)을 얹은 얇은 계층.
//!
//! 저장/조회/보존 엔진은 [`modone_audit`] 크레이트에 있다. 여기서는 OPC UA 전용
//! enum과, 그 enum을 문자열로 변환해 엔진에 기록하는 확장 트레잇만 제공한다.

use std::path::Path;

use serde::{Deserialize, Serialize};

// 범용 엔진 타입 재노출 — 기존 `crate::opcua::Audit*` 경로 호환.
// `AuditLogger`/`AuditLoggerState`는 엔진 타입의 별칭이다.
pub use modone_audit::{
    AuditClientInfo, AuditLogEntry, AuditLogQuery, AuditLogResult, AuditSeverity,
    AuditStore as AuditLogger, AuditStoreState as AuditLoggerState,
};

/// OPC UA 감사 DB(`<data_dir>/opcua/audit_log.db`)를 연다(없으면 생성).
pub fn open_opcua_audit(data_dir: &Path) -> Result<AuditLogger, String> {
    AuditLogger::open(&data_dir.join("opcua").join("audit_log.db"))
}

// ============================================================================
// OPC UA 이벤트 분류 enum
// ============================================================================

/// 감사 가능한 OPC UA 이벤트의 카테고리.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventCategory {
    ServerLifecycle,
    Session,
    Authentication,
    Configuration,
    Security,
}

impl AuditEventCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ServerLifecycle => "server_lifecycle",
            Self::Session => "session",
            Self::Authentication => "authentication",
            Self::Configuration => "configuration",
            Self::Security => "security",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "server_lifecycle" => Some(Self::ServerLifecycle),
            "session" => Some(Self::Session),
            "authentication" => Some(Self::Authentication),
            "configuration" => Some(Self::Configuration),
            "security" => Some(Self::Security),
            _ => None,
        }
    }
}

/// 세분화된 OPC UA 이벤트 타입.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    ServerStart,
    ServerStop,
    ClientConnect,
    ClientDisconnect,
    AuthSuccess,
    AuthFailure,
    ConfigChange,
    SecurityEvent,
    Other,
}

impl AuditEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ServerStart => "server_start",
            Self::ServerStop => "server_stop",
            Self::ClientConnect => "client_connect",
            Self::ClientDisconnect => "client_disconnect",
            Self::AuthSuccess => "auth_success",
            Self::AuthFailure => "auth_failure",
            Self::ConfigChange => "config_change",
            Self::SecurityEvent => "security_event",
            Self::Other => "other",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "server_start" => Some(Self::ServerStart),
            "server_stop" => Some(Self::ServerStop),
            "client_connect" => Some(Self::ClientConnect),
            "client_disconnect" => Some(Self::ClientDisconnect),
            "auth_success" => Some(Self::AuthSuccess),
            "auth_failure" => Some(Self::AuthFailure),
            "config_change" => Some(Self::ConfigChange),
            "security_event" => Some(Self::SecurityEvent),
            "other" => Some(Self::Other),
            _ => None,
        }
    }

    /// 이 이벤트 타입의 상위 카테고리.
    pub fn category(&self) -> AuditEventCategory {
        match self {
            Self::ServerStart | Self::ServerStop => AuditEventCategory::ServerLifecycle,
            Self::ClientConnect | Self::ClientDisconnect => AuditEventCategory::Session,
            Self::AuthSuccess | Self::AuthFailure => AuditEventCategory::Authentication,
            Self::ConfigChange => AuditEventCategory::Configuration,
            Self::SecurityEvent => AuditEventCategory::Security,
            Self::Other => AuditEventCategory::ServerLifecycle,
        }
    }
}

// ============================================================================
// 저장소(AuditLogger) 확장 — 타입드 기록 (Result 반환)
// ============================================================================

/// [`AuditLogger`]에 OPC UA enum 기반 타입드 기록을 추가하는 확장 트레잇.
/// 세션 모니터처럼 자체 저장소를 직접 들고 결과를 확인하는 곳에서 쓴다.
pub trait OpcuaAuditStore {
    fn record(
        &self,
        event_type: AuditEventType,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) -> Result<i64, String>;

    fn log_event(
        &self,
        event_type: AuditEventType,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) -> Result<i64, String>;

    fn log_with_client_info(
        &self,
        category: AuditEventCategory,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) -> Result<i64, String>;
}

impl OpcuaAuditStore for AuditLogger {
    fn record(
        &self,
        event_type: AuditEventType,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) -> Result<i64, String> {
        self.log_full(
            event_type.category().as_str(),
            Some(event_type.as_str()),
            severity,
            message,
            detail,
            source,
            client_info,
        )
    }

    fn log_event(
        &self,
        event_type: AuditEventType,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) -> Result<i64, String> {
        self.record(event_type, severity, message, detail, source, client_info)
    }

    fn log_with_client_info(
        &self,
        category: AuditEventCategory,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) -> Result<i64, String> {
        self.log_full(category.as_str(), None, severity, message, detail, source, client_info)
    }
}

// ============================================================================
// 상태(AuditLoggerState) 확장 — 타입드 기록 + 인증/계정 헬퍼 (no-op 가능)
// ============================================================================

/// [`AuditLoggerState`]에 OPC UA enum 기반 기록과 인증/계정 도메인 헬퍼를 추가한다.
/// 저장소 미초기화 시 내부적으로 no-op이 된다.
pub trait OpcuaAuditState {
    fn record(
        &self,
        event_type: AuditEventType,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    );

    fn log_auth_success(&self, username: &str);
    fn log_auth_success_with_ip(&self, username: &str, client_ip: Option<&str>);
    fn log_auth_failure(&self, username: &str, reason: &str);
    fn log_auth_failure_with_ip(&self, username: &str, reason: &str, client_ip: Option<&str>);
    fn log_auth_disabled_account(&self, username: &str);
    fn log_credential_resolution(&self, resolved_count: usize, total_enabled: usize);
    fn log_credential_verify_failed(&self, username: &str);
    fn log_credential_cache_miss(&self, username: &str);
    fn log_account_created(&self, username: &str, role: &str);
    fn log_account_deleted(&self, username: &str);
    fn log_account_updated(&self, username: &str, changes: &str);
}

impl OpcuaAuditState for AuditLoggerState {
    fn record(
        &self,
        event_type: AuditEventType,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) {
        self.log_full(
            event_type.category().as_str(),
            Some(event_type.as_str()),
            severity,
            message,
            detail,
            source,
            client_info,
        );
    }

    fn log_auth_success(&self, username: &str) {
        self.log_auth_success_with_ip(username, None);
    }

    fn log_auth_success_with_ip(&self, username: &str, client_ip: Option<&str>) {
        let client_info = AuditClientInfo {
            username: Some(username.to_string()),
            ip_address: client_ip.map(|s| s.to_string()),
            ..Default::default()
        };
        let ip_detail = client_ip
            .map(|ip| format!("username={}, client_ip={}", username, ip))
            .unwrap_or_else(|| username.to_string());
        self.record(
            AuditEventType::AuthSuccess,
            AuditSeverity::Info,
            &format!("User '{}' authenticated successfully", username),
            Some(&ip_detail),
            Some("auth"),
            Some(&client_info),
        );
    }

    fn log_auth_failure(&self, username: &str, reason: &str) {
        self.log_auth_failure_with_ip(username, reason, None);
    }

    fn log_auth_failure_with_ip(&self, username: &str, reason: &str, client_ip: Option<&str>) {
        let client_info = AuditClientInfo {
            username: Some(username.to_string()),
            ip_address: client_ip.map(|s| s.to_string()),
            ..Default::default()
        };
        let detail = match client_ip {
            Some(ip) => format!("username={}, reason={}, client_ip={}", username, reason, ip),
            None => format!("username={}, reason={}", username, reason),
        };
        self.record(
            AuditEventType::AuthFailure,
            AuditSeverity::Error,
            &format!("Authentication failed for user '{}': {}", username, reason),
            Some(&detail),
            Some("auth"),
            Some(&client_info),
        );
    }

    fn log_auth_disabled_account(&self, username: &str) {
        let client_info = AuditClientInfo {
            username: Some(username.to_string()),
            ..Default::default()
        };
        self.record(
            AuditEventType::AuthFailure,
            AuditSeverity::Warning,
            &format!("Authentication attempt on disabled account '{}'", username),
            Some(username),
            Some("auth"),
            Some(&client_info),
        );
    }

    fn log_credential_resolution(&self, resolved_count: usize, total_enabled: usize) {
        self.log(
            AuditEventCategory::Authentication.as_str(),
            AuditSeverity::Info,
            &format!(
                "Credential resolution completed: {}/{} enabled accounts verified",
                resolved_count, total_enabled
            ),
            Some(&format!(
                "resolved={}, total_enabled={}",
                resolved_count, total_enabled
            )),
            Some("auth"),
        );
    }

    fn log_credential_verify_failed(&self, username: &str) {
        self.log(
            AuditEventCategory::Authentication.as_str(),
            AuditSeverity::Warning,
            &format!(
                "Cached credential for '{}' failed bcrypt verification during server startup",
                username
            ),
            Some(username),
            Some("auth"),
        );
    }

    fn log_credential_cache_miss(&self, username: &str) {
        self.log(
            AuditEventCategory::Authentication.as_str(),
            AuditSeverity::Warning,
            &format!(
                "No cached credential for enabled account '{}' during server startup",
                username
            ),
            Some(username),
            Some("auth"),
        );
    }

    fn log_account_created(&self, username: &str, role: &str) {
        self.log(
            AuditEventCategory::Configuration.as_str(),
            AuditSeverity::Info,
            &format!("User account '{}' created with role '{}'", username, role),
            Some(&format!("username={}, role={}", username, role)),
            Some("auth"),
        );
    }

    fn log_account_deleted(&self, username: &str) {
        self.log(
            AuditEventCategory::Configuration.as_str(),
            AuditSeverity::Info,
            &format!("User account '{}' deleted", username),
            Some(username),
            Some("auth"),
        );
    }

    fn log_account_updated(&self, username: &str, changes: &str) {
        self.log(
            AuditEventCategory::Configuration.as_str(),
            AuditSeverity::Info,
            &format!("User account '{}' updated: {}", username, changes),
            Some(&format!("username={}, changes={}", username, changes)),
            Some("auth"),
        );
    }
}
