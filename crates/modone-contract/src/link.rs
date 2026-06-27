//! inter-CPU 메모리 링크 — CPU 간 단방향 데이터 복사를 선언하는 코어 타입
//!
//! "공유 메모리" 마술 대신 명시적 단방향 복사만 허용한다(실 PLC 의 데이터링크
//! 방식). src 가 권위자, dst 는 미러. 설계: docs/architecture/multi-cpu/00-design.md

use serde::{Deserialize, Serialize};

use crate::cpu::CpuId;
use crate::types::CanonicalAreaKind;

/// canonical 메모리의 연속 구간 `[start_index, end_index]` (양끝 포함).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CanonicalRange {
    pub area: CanonicalAreaKind,
    pub start_index: u32,
    pub end_index: u32,
}

impl CanonicalRange {
    /// 구간 길이(셀 개수). `end < start` 면 0.
    pub fn len(&self) -> u32 {
        self.end_index.saturating_sub(self.start_index) + 1
    }

    pub fn is_empty(&self) -> bool {
        self.end_index < self.start_index
    }

    /// 같은 area 에서 인덱스 구간이 겹치는가. 링크 충돌 정적 검증의 기본 연산.
    pub fn overlaps(&self, other: &CanonicalRange) -> bool {
        self.area == other.area
            && self.start_index <= other.end_index
            && other.start_index <= self.end_index
    }
}

/// 링크 한쪽 끝 — 특정 CPU 의 메모리 구간.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LinkEndpoint {
    pub cpu: CpuId,
    pub range: CanonicalRange,
}

/// 링크 동기화 강도 — 프로젝트 설정으로 유저가 고른다.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "mode", content = "ms", rename_all = "snake_case")]
pub enum LinkSyncMode {
    /// src dirty 발생 시 비동기 복사(기본). 사이클 정확도는 보장 안 함.
    Eventual,
    /// 고정 주기(ms) 스냅샷 복사.
    Periodic(u32),
    /// src(가상) 스캔 종료 이벤트에 동기. 가상↔가상 링크에서만 의미.
    OnScan,
}

impl Default for LinkSyncMode {
    fn default() -> Self {
        Self::Eventual
    }
}

/// CPU 간 단방향 메모리 링크. src 가 권위자, dst 는 미러(소비 CPU 입장 read-only).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MemoryLink {
    pub src: LinkEndpoint,
    pub dst: LinkEndpoint,
    #[serde(default)]
    pub sync: LinkSyncMode,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn range(area: CanonicalAreaKind, start: u32, end: u32) -> CanonicalRange {
        CanonicalRange {
            area,
            start_index: start,
            end_index: end,
        }
    }

    #[test]
    fn range_len_and_empty() {
        assert_eq!(range(CanonicalAreaKind::OutputBit, 0, 15).len(), 16);
        assert!(range(CanonicalAreaKind::OutputBit, 5, 4).is_empty());
    }

    #[test]
    fn overlap_only_within_same_area() {
        let a = range(CanonicalAreaKind::OutputBit, 0, 10);
        let b = range(CanonicalAreaKind::OutputBit, 10, 20);
        let c = range(CanonicalAreaKind::OutputBit, 11, 20);
        let d = range(CanonicalAreaKind::InputBit, 0, 10);
        assert!(a.overlaps(&b)); // 경계(10) 공유
        assert!(!a.overlaps(&c)); // 분리
        assert!(!a.overlaps(&d)); // 다른 area
    }

    #[test]
    fn sync_mode_defaults_eventual() {
        assert_eq!(LinkSyncMode::default(), LinkSyncMode::Eventual);
    }
}
