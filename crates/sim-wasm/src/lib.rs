//! sim-engine을 wasm으로 노출하는 최소 루프백 하니스.
//!
//! 브라우저/Node에서 PLC 로직을 실행하고 canonical memory를 관찰하는 데모용.
//! wasm-bindgen 없이 raw `extern "C"` 숫자 ABI만 쓴다 → 추가 툴체인 없이
//! `cargo build --target wasm32-unknown-unknown` 결과를 그대로 로드할 수 있다.
//! 시간/ID는 contract runtime_env(wasm 카운터)라 JS 환경 의존이 없다.

use std::cell::RefCell;
use std::sync::Arc;

use plc_model::{LsProfile, PlcHardwareTopology};
use sim_engine::{
    compile_program, CanonicalRuntimeFacade, CompiledProgram, CounterManager, LadderNetwork,
    LadderNode, LadderProgram, NodeType, ProgramExecutor, SimBitDeviceType, TimerManager,
};

/// wasm 하니스 상태 — 메모리/실행기/컴파일된 데모 프로그램.
struct Harness {
    memory: Arc<CanonicalRuntimeFacade>,
    executor: ProgramExecutor,
    program: CompiledProgram,
}

thread_local! {
    static SIM: RefCell<Option<Harness>> = const { RefCell::new(None) };
}

/// 숫자 디바이스 코드 → 비트 디바이스 종류. (JS 데모와 공유하는 약속)
fn device_from_code(code: u32) -> Option<SimBitDeviceType> {
    Some(match code {
        0 => SimBitDeviceType::M,
        1 => SimBitDeviceType::P,
        2 => SimBitDeviceType::X,
        3 => SimBitDeviceType::Y,
        4 => SimBitDeviceType::K,
        _ => return None,
    })
}

/// 데모 프로그램: 네트워크 1개 — M0 접점이 P0 코일을 구동 (series([M0, P0])).
fn build_demo_program() -> LadderProgram {
    LadderProgram {
        name: "wasm-demo".to_string(),
        networks: vec![LadderNetwork {
            id: 0,
            nodes: vec![LadderNode::series(vec![
                LadderNode::contact(NodeType::ContactNo, "M0"),
                LadderNode::coil(NodeType::CoilOut, "P0"),
            ])],
            comment: None,
        }],
    }
}

/// 하니스 초기화 — 메모리/실행기 생성 + 데모 프로그램 컴파일.
#[no_mangle]
pub extern "C" fn sim_init() {
    let memory = Arc::new(CanonicalRuntimeFacade::new());
    let timer = Arc::new(TimerManager::new());
    let counter = Arc::new(CounterManager::new());
    let executor = ProgramExecutor::new(Arc::clone(&memory), timer, counter);
    let profile = LsProfile::new("XGK".to_string(), PlcHardwareTopology::default());
    let program =
        compile_program(&build_demo_program(), &profile).expect("demo program should compile");

    SIM.with(|s| {
        *s.borrow_mut() = Some(Harness {
            memory,
            executor,
            program,
        });
    });
}

/// 입력 비트 쓰기 (예: M0=1).
#[no_mangle]
pub extern "C" fn sim_set_bit(dev: u32, idx: u32, val: u32) {
    let Some(device) = device_from_code(dev) else {
        return;
    };
    SIM.with(|s| {
        if let Some(h) = s.borrow().as_ref() {
            let _ = h.memory.write_bit(device, idx as u16, val != 0);
        }
    });
}

/// 1 스캔 실행 (입력 평가 → 출력 코일 구동).
#[no_mangle]
pub extern "C" fn sim_scan() {
    SIM.with(|s| {
        if let Some(h) = s.borrow().as_ref() {
            let _ = h.executor.execute_program(&h.program);
        }
    });
}

/// canonical memory에서 비트 읽기 (1/0). 예: P0 출력 관찰.
#[no_mangle]
pub extern "C" fn sim_read_bit(dev: u32, idx: u32) -> u32 {
    let Some(device) = device_from_code(dev) else {
        return 0;
    };
    SIM.with(|s| {
        s.borrow()
            .as_ref()
            .and_then(|h| h.memory.read_bit(device, idx as u16).ok())
            .map(|b| b as u32)
            .unwrap_or(0)
    })
}
