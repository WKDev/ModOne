//! 감사 로그 값 타입 — 심각도, 클라이언트 정보, 항목, 쿼리, 결과.

use serde::{Deserialize, Serialize};

/// 감사 이벤트 심각도.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuditSeverity {
    Info,
    Warning,
    Error,
}

impl AuditSeverity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Warning => "warning",
            Self::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "info" => Some(Self::Info),
            "warning" => Some(Self::Warning),
            "error" => Some(Self::Error),
            _ => None,
        }
    }
}

/// 이벤트에 첨부되는 클라이언트/행위자 신원 정보. `client_info` 컬럼에 JSON으로 저장.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditClientInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub application_uri: Option<String>,
}

impl AuditClientInfo {
    /// 모든 필드가 None이면 true.
    pub fn is_empty(&self) -> bool {
        self.ip_address.is_none()
            && self.session_id.is_none()
            && self.username.is_none()
            && self.application_uri.is_none()
    }

    /// DB 저장용 JSON 직렬화. 비어 있으면 `None`.
    pub fn to_json(&self) -> Option<String> {
        if self.is_empty() {
            None
        } else {
            serde_json::to_string(self).ok()
        }
    }

    /// JSON 역직렬화. `None`이거나 파싱 실패 시 default.
    pub fn from_json(json: Option<&str>) -> Self {
        json.and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default()
    }
}

/// SQLite에 저장/조회되는 단일 감사 항목.
///
/// `category`/`event_type`은 도메인 무관 문자열이다. 소비자가 자신의 enum으로
/// 매핑한다.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogEntry {
    pub id: i64,
    pub timestamp: String,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_type: Option<String>,
    pub severity: AuditSeverity,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_info: Option<AuditClientInfo>,
}

/// 감사 항목 필터 쿼리 파라미터.
///
/// `Default`는 수동 구현이다 — `#[derive(Default)]`는 `limit`을 0으로 둬서
/// 쿼리가 항상 0건을 반환하는 함정이 있다. serde 역직렬화 기본값(`default_limit`)과
/// 맞춰 200으로 둔다.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_type: Option<String>,
    /// 최소 심각도. 지정 시 해당 레벨 이상만 반환.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<AuditSeverity>,
    /// ISO-8601 이후.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from: Option<String>,
    /// ISO-8601 이전.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
    /// message/detail/client_info 자유텍스트 검색.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search: Option<String>,
    /// 최대 반환 수 (기본 200).
    #[serde(default = "default_limit")]
    pub limit: u32,
    /// 페이지네이션 오프셋 (기본 0).
    #[serde(default)]
    pub offset: u32,
}

fn default_limit() -> u32 {
    200
}

impl Default for AuditLogQuery {
    fn default() -> Self {
        Self {
            category: None,
            event_type: None,
            severity: None,
            from: None,
            to: None,
            search: None,
            limit: default_limit(),
            offset: 0,
        }
    }
}

/// 쿼리 결과 + 전체 매칭 수.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogResult {
    pub entries: Vec<AuditLogEntry>,
    pub total_count: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn severity_roundtrip() {
        for s in [AuditSeverity::Info, AuditSeverity::Warning, AuditSeverity::Error] {
            assert_eq!(AuditSeverity::from_str(s.as_str()), Some(s));
        }
        assert_eq!(AuditSeverity::from_str("bogus"), None);
    }

    #[test]
    fn client_info_empty_serialization() {
        let empty = AuditClientInfo::default();
        assert!(empty.is_empty());
        assert!(empty.to_json().is_none());
    }

    #[test]
    fn client_info_roundtrip() {
        let info = AuditClientInfo {
            ip_address: Some("10.0.0.1".to_string()),
            session_id: None,
            username: Some("admin".to_string()),
            application_uri: None,
        };
        let json = info.to_json().unwrap();
        let parsed = AuditClientInfo::from_json(Some(&json));
        assert_eq!(parsed.ip_address, info.ip_address);
        assert_eq!(parsed.username, info.username);
        assert!(parsed.session_id.is_none());
    }

    #[test]
    fn client_info_from_invalid_json() {
        assert!(AuditClientInfo::from_json(Some("not valid json")).is_empty());
    }

    #[test]
    fn entry_serde_roundtrip() {
        let entry = AuditLogEntry {
            id: 1,
            timestamp: "2026-06-27T00:00:00Z".to_string(),
            category: "authentication".to_string(),
            event_type: Some("auth_failure".to_string()),
            severity: AuditSeverity::Warning,
            message: "Login failed".to_string(),
            detail: Some("bad password".to_string()),
            source: Some("auth".to_string()),
            client_info: Some(AuditClientInfo {
                username: Some("baduser".to_string()),
                ..Default::default()
            }),
        };
        let json = serde_json::to_string(&entry).unwrap();
        let parsed: AuditLogEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.category, "authentication");
        assert_eq!(parsed.event_type.as_deref(), Some("auth_failure"));
        assert_eq!(parsed.severity, AuditSeverity::Warning);
        assert!(parsed.client_info.is_some());
    }
}
