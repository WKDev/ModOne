//! 실 PLC CPU 드라이버 계약 — 실제 장비와 canonical 메모리를 동기화하는 인터페이스
//!
//! 의미상 `ProtocolAdapter` 의 "방향 뒤집기"판이다. 서버 어댑터는 CPU 가
//! 권위자지만, FieldLink 는 **실제 장비가 권위자**이고 우리 메모리는 미러다.
//! 구체 전송(Modbus master / OPC-UA client)은 native 셸(src-tauri)이 구현한다.
//! 이번 단계 산출물은 trait 정의까지. 설계: docs/architecture/multi-cpu/00-design.md

use crate::cpu::CpuHealth;

/// 실 CPU 드라이버 trait. canonical 메모리를 실제 장비와 양방향 동기화한다.
pub trait FieldLink: Send + Sync {
    /// 실 장비에서 입력을 읽어 canonical 메모리에 반영한다(장비 → 메모리).
    /// 쓰기 출처는 `CanonicalWriteSource::ExternalProtocol` 의미를 따른다.
    fn poll_device(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;

    /// canonical 출력 변경을 실 장비에 쓴다(메모리 → 장비).
    fn write_device(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;

    /// 현재 연결/데이터 품질 상태.
    fn health(&self) -> CpuHealth;
}
