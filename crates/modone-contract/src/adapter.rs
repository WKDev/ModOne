//! 프로토콜 어댑터 계약 — 런타임이 프로토콜별 어댑터와 canonical 메모리를 동기화하는 인터페이스
//!
//! 이 trait 은 프로토콜 런타임과 구체 어댑터(Modbus, OPC UA 등) 사이의 경계다.
//! 프로토콜 런타임은 이 trait 을 통해 canonical 메모리를 프로토콜별 주소공간과
//! 동기화한다. 구체 매핑 정책(Modbus 등)은 각 codec 크레이트가 소유한다.

use crate::types::{CanonicalAddress, CanonicalAreaKind};

/// Transport-agnostic protocol adapter trait.
pub trait ProtocolAdapter: Send + Sync {
    /// Apply external writes from protocol clients back into canonical memory.
    fn apply_external_writes(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;

    /// Publish only the dirty canonical regions into protocol address space.
    fn publish_dirty_state(
        &self,
        windows: &[DirtyPublishWindow],
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;

    /// Publish full canonical runtime state into protocol address space.
    fn publish_runtime_state(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;

    /// Full synchronization: apply external writes then publish all state.
    fn full_sync(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
}

/// A contiguous canonical region marked dirty for incremental publishing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DirtyPublishWindow {
    pub area: CanonicalAreaKind,
    pub start_index: u32,
    pub end_index: u32,
}

impl DirtyPublishWindow {
    pub fn single(address: CanonicalAddress) -> Self {
        Self {
            area: address.area,
            start_index: address.index,
            end_index: address.index,
        }
    }
}
