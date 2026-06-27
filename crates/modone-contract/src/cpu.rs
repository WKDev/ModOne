//! CPU 식별자·종류·헬스 — 가상/실 CPU를 한 모델에서 구분하는 코어 타입
//!
//! CpuNode/CpuDriver/CpuManager 같은 런타임 구조는 엔진(sim-engine)·tokio에
//! 의존하므로 native 셸에 둔다. 이 크레이트에는 전송·엔진과 무관한 식별/분류
//! 타입만 둔다. 설계: docs/architecture/multi-cpu/00-design.md

use serde::{Deserialize, Serialize};

/// 프로젝트 안에서 CPU 를 식별하는 안정적 ID (config 의 `id` 필드와 1:1).
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct CpuId(String);

impl CpuId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for CpuId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl From<&str> for CpuId {
    fn from(value: &str) -> Self {
        Self(value.to_string())
    }
}

impl From<String> for CpuId {
    fn from(value: String) -> Self {
        Self(value)
    }
}

/// CPU 종류 — "메모리를 누가 전진시키는가".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CpuKind {
    /// 래더 엔진이 메모리의 권위자.
    Virtual,
    /// 실제 장비가 권위자, 우리 메모리는 미러.
    Real,
}

/// 실 CPU 의 연결/데이터 품질. 가상 CPU 는 항상 `Good`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CpuHealth {
    Good,
    /// 연결은 됐으나 일부 값이 stale.
    Degraded,
    Disconnected,
}

impl Default for CpuHealth {
    fn default() -> Self {
        Self::Good
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cpu_id_roundtrip() {
        let id = CpuId::from("vcpu-main");
        assert_eq!(id.as_str(), "vcpu-main");
        assert_eq!(id.to_string(), "vcpu-main");
        assert_eq!(CpuId::new("x"), CpuId::from("x".to_string()));
    }

    #[test]
    fn cpu_health_defaults_good() {
        assert_eq!(CpuHealth::default(), CpuHealth::Good);
    }
}
