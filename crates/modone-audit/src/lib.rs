//! 도메인 무관 SQLite append-only 감사 로그 엔진.
//!
//! 카테고리·이벤트타입은 **문자열**로 저장해 어떤 도메인(OPC UA, 런타임 운영 등)이든
//! 자신만의 타입 enum을 정의해 이 엔진을 공유할 수 있다. 저장/조회/보존 정책 같은
//! 기계적인 부분만 여기서 담당하고, 의미론(카테고리 값·헬퍼)은 소비자가 얹는다.
//!
//! - [`AuditStore`] — SQLite 연결 + 마이그레이션 + 기록/조회/보존.
//! - [`AuditStoreState`] — thread-safe 래퍼 + 백그라운드 보존 스케줄러.
//! - 값 타입: [`AuditSeverity`], [`AuditClientInfo`], [`AuditLogEntry`],
//!   [`AuditLogQuery`], [`AuditLogResult`].

mod state;
mod store;
mod types;

pub use state::AuditStoreState;
pub use store::AuditStore;
pub use types::{
    AuditClientInfo, AuditLogEntry, AuditLogQuery, AuditLogResult, AuditSeverity,
};
