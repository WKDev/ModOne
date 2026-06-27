//! thread-safe 감사 저장소 래퍼 + 백그라운드 보존 스케줄러.

use std::sync::Arc;

use parking_lot::Mutex;
use tokio::sync::mpsc;

use crate::store::AuditStore;
use crate::types::{AuditClientInfo, AuditLogEntry, AuditLogQuery, AuditLogResult, AuditSeverity};

/// 기본 보존 점검 주기: 1시간.
const DEFAULT_RETENTION_INTERVAL_SECS: u64 = 3600;

/// Tauri 등이 managed state로 공유하는 thread-safe 감사 저장소.
///
/// 선택적 백그라운드 보존 스케줄러가 주기적으로 만료 항목을 정리한다. 내부 저장소를
/// `Arc<Mutex<…>>`로 감싸 스케줄러 태스크와 공유한다. 저장소가 초기화되지 않은
/// 상태에서의 기록 호출은 no-op이다.
pub struct AuditStoreState {
    /// 내부 저장소. 소비자가 잠그고 [`AuditStore`] 메서드를 직접 호출할 수 있도록 공개.
    /// (미초기화 시 명시적 에러를 반환하려는 호출부가 `as_ref()` 패턴을 쓴다.)
    pub inner: Arc<Mutex<Option<AuditStore>>>,
    retention_cancel_tx: Mutex<Option<mpsc::Sender<()>>>,
    retention_interval_secs: Mutex<u64>,
}

impl AuditStoreState {
    pub fn new(store: AuditStore) -> Self {
        Self {
            inner: Arc::new(Mutex::new(Some(store))),
            retention_cancel_tx: Mutex::new(None),
            retention_interval_secs: Mutex::new(DEFAULT_RETENTION_INTERVAL_SECS),
        }
    }

    /// 저장소 없이 빈 상태 생성(초기화 실패 시 fallback). 기록은 no-op.
    pub fn empty() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
            retention_cancel_tx: Mutex::new(None),
            retention_interval_secs: Mutex::new(DEFAULT_RETENTION_INTERVAL_SECS),
        }
    }

    pub fn retention_interval_secs(&self) -> u64 {
        *self.retention_interval_secs.lock()
    }

    /// 보존 점검 주기 설정 (최소 60초). 다음 스케줄러 재시작 시 반영.
    pub fn set_retention_interval_secs(&self, secs: u64) {
        *self.retention_interval_secs.lock() = secs.max(60);
    }

    /// 주기적으로 보존 정책을 적용하는 백그라운드 태스크 시작. 이미 돌고 있으면 먼저 중지.
    ///
    /// 주의: tokio 런타임 컨텍스트 안에서 호출해야 한다(Tauri setup 등).
    pub fn start_retention_scheduler(&self) {
        self.stop_retention_scheduler();
        let interval_secs = *self.retention_interval_secs.lock();
        let (tx, mut rx) = mpsc::channel::<()>(1);
        *self.retention_cancel_tx.lock() = Some(tx);

        let inner = Arc::clone(&self.inner);
        let interval_duration = std::time::Duration::from_secs(interval_secs);

        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(interval_duration);
            // 첫 tick은 즉시 발생 — 시작 시 이미 적용했다고 보고 건너뜀.
            ticker.tick().await;
            log::info!(
                "Audit log retention scheduler started (interval: {}s)",
                interval_secs
            );
            loop {
                tokio::select! {
                    _ = ticker.tick() => {
                        let result = {
                            let guard = inner.lock();
                            guard.as_ref().map(|s| s.enforce_retention())
                        };
                        match result {
                            Some(Ok(deleted)) if deleted > 0 => {
                                log::info!("Audit log retention: purged {} expired entries", deleted);
                            }
                            Some(Err(e)) => log::warn!("Audit log retention failed: {e}"),
                            _ => {}
                        }
                    }
                    _ = rx.recv() => {
                        log::info!("Audit log retention scheduler stopped");
                        break;
                    }
                }
            }
        });
    }

    /// 보존 스케줄러 중지.
    pub fn stop_retention_scheduler(&self) {
        if let Some(tx) = self.retention_cancel_tx.lock().take() {
            let _ = tx.try_send(());
        }
    }

    pub fn is_retention_scheduler_running(&self) -> bool {
        self.retention_cancel_tx.lock().is_some()
    }

    /// 모든 필드를 갖는 이벤트 기록 (저장소 미초기화 시 no-op).
    pub fn log_full(
        &self,
        category: &str,
        event_type: Option<&str>,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) {
        if let Some(ref store) = *self.inner.lock() {
            if let Err(e) =
                store.log_full(category, event_type, severity, message, detail, source, client_info)
            {
                log::error!("Audit log write failed: {e}");
            }
        }
    }

    /// 카테고리만으로 간단히 기록 (저장소 미초기화 시 no-op).
    pub fn log(
        &self,
        category: &str,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
    ) {
        self.log_full(category, None, severity, message, detail, source, None);
    }

    pub fn query(&self, q: &AuditLogQuery) -> Result<AuditLogResult, String> {
        match *self.inner.lock() {
            Some(ref store) => store.query(q),
            None => Ok(AuditLogResult {
                entries: Vec::new(),
                total_count: 0,
            }),
        }
    }

    pub fn get_by_id(&self, id: i64) -> Result<Option<AuditLogEntry>, String> {
        match *self.inner.lock() {
            Some(ref store) => store.get_by_id(id),
            None => Ok(None),
        }
    }

    pub fn enforce_retention(&self) -> Result<u64, String> {
        match *self.inner.lock() {
            Some(ref store) => store.enforce_retention(),
            None => Ok(0),
        }
    }

    pub fn clear_all(&self) -> Result<u64, String> {
        match *self.inner.lock() {
            Some(ref store) => store.clear(),
            None => Ok(0),
        }
    }

    pub fn count(&self) -> Result<u32, String> {
        match *self.inner.lock() {
            Some(ref store) => store.count(),
            None => Ok(0),
        }
    }

    pub fn get_retention_days(&self) -> i64 {
        match *self.inner.lock() {
            Some(ref store) => store.retention_days(),
            None => 90,
        }
    }

    pub fn set_retention_days(&self, days: i64) {
        if let Some(ref mut store) = *self.inner.lock() {
            store.set_retention_days(days);
        }
    }
}

impl Default for AuditStoreState {
    fn default() -> Self {
        Self::empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn record_and_query_via_state() {
        let state = AuditStoreState::new(AuditStore::open_in_memory().unwrap());
        state.log_full(
            "runtime_control",
            Some("force_set"),
            AuditSeverity::Warning,
            "forced %MW100=1",
            Some("{\"address\":\"%MW100\"}"),
            Some("runtime"),
            None,
        );
        let r = state.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(r.total_count, 1);
        assert_eq!(r.entries[0].event_type.as_deref(), Some("force_set"));
        assert_eq!(r.entries[0].severity, AuditSeverity::Warning);
    }

    #[test]
    fn empty_state_is_noop() {
        let state = AuditStoreState::empty();
        state.log("x", AuditSeverity::Info, "ignored", None, None);
        assert_eq!(state.count().unwrap(), 0);
        assert!(state.query(&AuditLogQuery::default()).unwrap().entries.is_empty());
    }
}
