//! OneSim Module
//!
//! PLC simulation engine for LS Electric PLCs.

pub mod canvas_sync;
pub mod counter;
pub mod debugger;
pub mod engine;
pub mod executor;
pub mod memory;
pub mod modserver_sync;
pub mod timer;
pub mod types;

pub use canvas_sync::{
    CanvasSync, CanvasSyncError, CanvasSyncResult, PlcBlockMapping, PlcBlockType,
    PlcInputChange, PlcOutputUpdate, PlcOutputsEvent,
};
pub use counter::CounterManager;
pub use engine::{
    EngineError, EngineResult, OneSimEngine, ScanCompleteEvent, StateChangeEvent, WatchdogEvent,
};
pub use executor::{
    DeviceAddress, ExecutionError, ExecutionResult, LadderNetwork, LadderNode, LadderProgram,
    NetworkExecutionResult, NodeType, ProgramExecutionResult, ProgramExecutor,
};
pub use memory::{DeviceMemory, SimMemoryError, SimMemoryResult};
pub use modserver_sync::{ModServerSync, SyncError, SyncResult};
pub use timer::TimerManager;
pub use types::*;
