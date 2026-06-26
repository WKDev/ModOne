//! ModOne 공유 계약 — canonical 메모리 모델과 프로토콜 어댑터 인터페이스
//!
//! wasm·native 양쪽으로 컴파일되는 코어 계약 크레이트. src-tauri/sim-engine/
//! modbus-codec/opcua-codec 가 모두 이 크레이트에 의존한다. 전송(소켓/serial/
//! TLS)이나 Tauri/project 에는 절대 의존하지 않는다. 자세한 규약은
//! docs/wasm-migration/00-CONTRACT.md 참조.

pub mod adapter;
pub mod clock;
pub mod event_bus;
pub mod memory;
pub mod types;

pub use adapter::{DirtyPublishWindow, ProtocolAdapter};
pub use event_bus::CanonicalMemoryBus;
pub use memory::{CanonicalMemory, CanonicalMemoryError, CanonicalMemorySnapshot};
pub use types::{
    CanonicalAccess, CanonicalAddress, CanonicalAreaKind, CanonicalMemoryBatchChange,
    CanonicalMemoryChange, CanonicalMemoryEvent, CanonicalValue, CanonicalWriteSource,
};
