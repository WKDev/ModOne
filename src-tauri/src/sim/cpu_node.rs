// 단일 CPU를 메모리·드라이버·헬스로 묶는 노드 — 멀티-CPU 비파괴 래핑(단계 2)
//
// 현재는 단일 가상 CPU 를 감싸는 용도다. 멀티-CPU/실 CPU 는 후속 단계에서
// `CpuManager` 가 이 노드를 N 개 보유하도록 확장한다.
// 설계: docs/architecture/multi-cpu/00-design.md

use std::sync::Arc;

use parking_lot::Mutex;

use modone_contract::{CpuHealth, CpuId, CpuKind};

use super::engine::OneSimEngine;
use super::memory::CanonicalRuntimeFacade;

/// 단일 CPU 프로젝트의 기본 primary CPU 식별자.
pub const PRIMARY_CPU_ID: &str = "cpu-0";

/// CPU 메모리를 전진시키는 드라이버. 가상은 래더 엔진, 실은 FieldLink(후속 단계).
pub enum CpuDriver {
    /// 래더 엔진이 권위자. 엔진은 run() 시점에 지연 생성되므로 슬롯으로 보관한다.
    Virtual(Arc<Mutex<Option<Arc<OneSimEngine>>>>),
}

impl CpuDriver {
    pub fn kind(&self) -> CpuKind {
        match self {
            CpuDriver::Virtual(_) => CpuKind::Virtual,
        }
    }
}

/// CPU 1개 = 식별자 + canonical 메모리 + 드라이버.
pub struct CpuNode {
    id: CpuId,
    runtime: Arc<CanonicalRuntimeFacade>,
    driver: CpuDriver,
}

impl CpuNode {
    /// 가상 CPU 노드 생성. 엔진 슬롯은 비어 있고 run() 에서 채워진다.
    pub fn new_virtual(id: CpuId, runtime: Arc<CanonicalRuntimeFacade>) -> Self {
        Self {
            id,
            runtime,
            driver: CpuDriver::Virtual(Arc::new(Mutex::new(None))),
        }
    }

    pub fn id(&self) -> &CpuId {
        &self.id
    }

    pub fn runtime(&self) -> &Arc<CanonicalRuntimeFacade> {
        &self.runtime
    }

    pub fn kind(&self) -> CpuKind {
        self.driver.kind()
    }

    /// 현재 연결/데이터 품질. 가상 CPU 는 항상 Good.
    pub fn health(&self) -> CpuHealth {
        match &self.driver {
            CpuDriver::Virtual(_) => CpuHealth::Good,
        }
    }

    /// 가상 드라이버의 엔진 슬롯 핸들(지연 생성/교체를 위해 슬롯을 노출).
    pub fn engine_slot(&self) -> &Arc<Mutex<Option<Arc<OneSimEngine>>>> {
        match &self.driver {
            CpuDriver::Virtual(slot) => slot,
        }
    }
}
