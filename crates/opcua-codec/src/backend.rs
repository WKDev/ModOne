// OPC UA 서버 백엔드를 trait 뒤에 숨겨 구현 교체(Rust↔.NET)를 가능케 하는 경계
//
// 계약(00-CONTRACT.md) §4: OPC UA 서버를 trait 뒤에 숨겨, 동일 trait의 .NET 데몬
// 구현으로 무중단 교체 가능하게 한다. `OpcUaAdapter`는 이 trait에만 의존하고
// 구체 구현(`OpcUaServer` = RustOpcUaBackend)을 알지 못한다. 구체 백엔드 선택은
// src-tauri 조립 지점 한 곳에서만 이뤄진다.
//
// 현재 표면은 어댑터의 publish 경로(canonical → OPC UA 주소공간)만 추상화한다.
// 라이프사이클(start/stop/status/sessions/security)의 trait화는 후속 단계에서
// 노드스펙 경계 정리 이후 확장한다.

use std::collections::HashMap;

use modone_contract::DirtyPublishWindow;
use modone_contract::{CanonicalAddress, CanonicalMemory};

use crate::error::OpcUaError;
use crate::memory::OpcUaNodeId;

/// OPC UA 서버 백엔드 추상화.
///
/// 구체 구현체:
/// - `OpcUaServer` (`opcua` crate v0.12 래핑, 현재 native 기본 백엔드)
/// - `DotNetOpcUaBackend` (별도 프로세스, 추후) — 동일 trait 구현
pub trait OpcUaServerBackend: Send + Sync {
    /// dirty 윈도우에 해당하는 canonical 값을 OPC UA 변수 노드로 publish.
    fn update_node_values(
        &self,
        windows: &[DirtyPublishWindow],
        canonical_memory: &CanonicalMemory,
        publish_map: &HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
    ) -> Result<(), OpcUaError>;

    /// 전체 런타임 상태를 OPC UA 주소공간으로 동기화.
    fn sync_all_node_values(
        &self,
        canonical_memory: &CanonicalMemory,
        publish_map: &HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
    ) -> Result<(), OpcUaError>;
}
