//! PLC 사이클 실행기 코어 — 전송/Tauri/tokio 런타임 없는 순수 시뮬레이션 로직
//!
//! 메모리·타이머·카운터·태그·디버거·래더 실행기를 담는다. `modone-contract`의
//! canonical 모델과 `plc-model`의 VendorProfile에만 의존하고, 비동기 드라이버
//! (interval/select)·소켓·Tauri 는 native 셸(src-tauri/sim)에 남는다. wasm·native
//! 양쪽으로 컴파일된다. 설계: docs/wasm-migration/00-CONTRACT.md, 02-PLC-MODEL.md.

pub mod counter;
pub mod debugger;
pub mod executor;
pub mod memory;
pub mod tag_registry;
pub mod timer;
pub mod types;

pub use counter::CounterManager;
pub use executor::{
    compile_program, CompiledNetwork, CompiledNode, CompiledOperand, CompiledProgram,
    DeviceAddress, ExecutionError, ExecutionResult, LadderNetwork, LadderNode, LadderProgram,
    NetworkExecutionResult, NodeType, ProgramExecutionResult, ProgramExecutor,
};
pub use memory::{CanonicalRuntimeFacade, SimMemoryError, SimMemoryResult};
pub use timer::TimerManager;
pub use types::*;
