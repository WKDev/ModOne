// wasm·native 양쪽에서 동작하는 시간/ID 공급자 (계약 §3 wasm-purity: 시간/ID 주입).
//
// native 셸은 실시간(chrono)과 uuid를 쓴다. wasm tier 는 JS 환경(Date/crypto)에
// 의존하지 않도록 자기완결적 단조 카운터를 쓴다. 타임스탬프/ID는 String 필드로
// 유지된다(계약 표면 불변). 실시간 주입(콜백)은 후속 작업 대상.

#[cfg(not(target_arch = "wasm32"))]
mod imp {
    pub fn now_rfc3339() -> String {
        chrono::Utc::now().to_rfc3339()
    }
    pub fn now_millis() -> u64 {
        chrono::Utc::now().timestamp_millis() as u64
    }
    pub fn new_id() -> String {
        uuid::Uuid::new_v4().to_string()
    }
}

#[cfg(target_arch = "wasm32")]
mod imp {
    use core::sync::atomic::{AtomicU64, Ordering};

    static SEQ: AtomicU64 = AtomicU64::new(0);

    fn next() -> u64 {
        SEQ.fetch_add(1, Ordering::Relaxed)
    }

    pub fn now_rfc3339() -> String {
        // 실시간 소스가 없는 wasm tier: 단조 시퀀스를 합성 타임스탬프로 사용.
        format!("seq:{}", next())
    }
    pub fn now_millis() -> u64 {
        next()
    }
    pub fn new_id() -> String {
        format!("wasm-{:016x}", next())
    }
}

/// RFC3339 타임스탬프 문자열(native) / 합성 시퀀스(wasm).
pub fn now_rfc3339() -> String {
    imp::now_rfc3339()
}

/// epoch millis(native) / 단조 시퀀스(wasm).
pub fn now_millis() -> u64 {
    imp::now_millis()
}

/// 고유 ID 문자열 — uuid v4(native) / 카운터 기반(wasm).
pub fn new_id() -> String {
    imp::new_id()
}
