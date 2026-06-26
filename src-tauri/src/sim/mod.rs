//! OneSim Module
//!
//! PLC simulation engine for LS Electric PLCs.

// 순수 코어(메모리/타이머/카운터/태그/디버거/래더 실행기)는 sim-engine 크레이트로
// 이전됨. 기존 `crate::sim::<module>::...` 경로 호환을 위해 모듈째 재노출한다.
pub use sim_engine::{counter, debugger, executor, memory, tag_registry, timer, types};

// native 셸 — 전송/Tauri/tokio 비동기 드라이버는 여기 잔류.
pub mod canvas_sync;
pub mod engine;
pub mod monitoring;
pub mod protocol_runtime;
pub mod runtime_host;
pub mod tag_events;

pub use canvas_sync::{
    CanvasSync, CanvasSyncError, CanvasSyncResult, PlcBlockMapping, PlcBlockType, PlcInputChange,
    PlcOutputUpdate, PlcOutputsEvent,
};
pub use counter::CounterManager;
pub use engine::{
    EngineError, EngineResult, OneSimEngine, ScanCompleteEvent, StateChangeEvent, WatchdogEvent,
};
pub use executor::{
    compile_program, CompiledNetwork, CompiledNode, CompiledOperand, CompiledProgram,
    DeviceAddress, ExecutionError, ExecutionResult, LadderNetwork, LadderNode, LadderProgram,
    NetworkExecutionResult, NodeType, ProgramExecutionResult, ProgramExecutor,
};
pub use memory::{CanonicalRuntimeFacade, SimMemoryError, SimMemoryResult};
pub use timer::TimerManager;
pub use types::*;
