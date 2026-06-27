//! 런타임 운영 감사 — 시뮬레이션/제어 조작(force 설정·해제, 시뮬 상태 전환)을
//! 불변 감사 로그에 기록한다. 안전 추적·컴플라이언스가 목적이며, 저장은 범용
//! `modone-audit` 엔진을 그대로 쓴다(OPC UA 감사와 별도 DB).

use std::path::Path;

use modone_audit::{AuditLogQuery, AuditLogResult, AuditSeverity, AuditStore, AuditStoreState};

/// 런타임 운영 감사 이벤트의 단일 카테고리.
const CATEGORY: &str = "runtime_control";
/// 이벤트 출처 태그.
const SOURCE: &str = "runtime";

/// Tauri managed state. OPC UA 감사(`AuditLoggerState`)와 **타입으로 구분**하기 위한
/// newtype — 같은 타입을 두 번 manage하면 Tauri State가 충돌하기 때문.
pub struct RuntimeAuditState(AuditStoreState);

impl RuntimeAuditState {
    /// 런타임 감사 DB(`<data_dir>/runtime/audit_log.db`)를 연다.
    pub fn open(data_dir: &Path) -> Result<Self, String> {
        let store = AuditStore::open(&data_dir.join("runtime").join("audit_log.db"))?;
        Ok(Self(AuditStoreState::new(store)))
    }

    /// 저장소 없는 빈 상태(초기화 실패 시 fallback). 기록은 no-op.
    pub fn empty() -> Self {
        Self(AuditStoreState::empty())
    }

    /// 내부 범용 상태 접근(조회/보존 커맨드용).
    pub fn inner(&self) -> &AuditStoreState {
        &self.0
    }

    /// 강제값(force) 설정 기록. 안전상 Warning 레벨.
    pub fn force_set(&self, address: &str, value: &serde_json::Value) {
        let detail = serde_json::json!({ "address": address, "value": value }).to_string();
        self.0.log_full(
            CATEGORY,
            Some("force_set"),
            AuditSeverity::Warning,
            &format!("Force set: {} = {}", address, value),
            Some(&detail),
            Some(SOURCE),
            None,
        );
    }

    /// 강제값 해제 기록.
    pub fn force_release(&self, address: &str) {
        let detail = serde_json::json!({ "address": address }).to_string();
        self.0.log_full(
            CATEGORY,
            Some("force_release"),
            AuditSeverity::Warning,
            &format!("Force released: {}", address),
            Some(&detail),
            Some(SOURCE),
            None,
        );
    }

    /// 시뮬레이션 상태 전환 기록(start/stop/pause/resume/reset).
    pub fn sim_event(&self, event_type: &str, message: &str) {
        self.0.log_full(
            CATEGORY,
            Some(event_type),
            AuditSeverity::Info,
            message,
            None,
            Some(SOURCE),
            None,
        );
    }

    /// 감사 항목 조회.
    pub fn query(&self, q: &AuditLogQuery) -> Result<AuditLogResult, String> {
        self.0.query(q)
    }
}
