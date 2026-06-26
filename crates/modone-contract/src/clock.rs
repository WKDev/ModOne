// 타임스탬프/batch_id 생성 지점 (§3 wasm-purity 경계).
//
// native(`std-clock` 피처, 기본)는 chrono/uuid를 직접 쓴다. 피처를 끄면(wasm 등)
// 호스트가 [`set_clock`]/[`set_id_source`]로 실제 구현을 주입하고, 주입 전에는
// 안전한 기본값(빈 타임스탬프, 단조 증가 카운터 ID)을 쓴다. 타임스탬프는 계약대로
// String 필드를 유지한다.

/// 현재 시각을 RFC3339 문자열로 반환.
pub fn now_rfc3339() -> String {
    #[cfg(feature = "std-clock")]
    {
        chrono::Utc::now().to_rfc3339()
    }
    #[cfg(not(feature = "std-clock"))]
    {
        injected::now()
    }
}

/// 새 배치 ID 문자열을 반환.
pub fn new_batch_id() -> String {
    #[cfg(feature = "std-clock")]
    {
        uuid::Uuid::new_v4().to_string()
    }
    #[cfg(not(feature = "std-clock"))]
    {
        injected::new_id()
    }
}

#[cfg(not(feature = "std-clock"))]
pub use injected::{set_clock, set_id_source};

#[cfg(not(feature = "std-clock"))]
mod injected {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::OnceLock;

    static CLOCK: OnceLock<fn() -> String> = OnceLock::new();
    static ID_SOURCE: OnceLock<fn() -> String> = OnceLock::new();
    static COUNTER: AtomicU64 = AtomicU64::new(0);

    /// 호스트(예: wasm 셸)가 실제 시계를 주입한다. 최초 1회만 적용된다.
    pub fn set_clock(f: fn() -> String) {
        let _ = CLOCK.set(f);
    }

    /// 호스트가 실제 ID 생성기를 주입한다. 최초 1회만 적용된다.
    pub fn set_id_source(f: fn() -> String) {
        let _ = ID_SOURCE.set(f);
    }

    pub fn now() -> String {
        CLOCK.get().map(|f| f()).unwrap_or_default()
    }

    pub fn new_id() -> String {
        match ID_SOURCE.get() {
            Some(f) => f(),
            None => format!("batch-{}", COUNTER.fetch_add(1, Ordering::Relaxed)),
        }
    }
}
