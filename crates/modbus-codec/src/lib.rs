// modbus-codec: 전송 비의존 Modbus 코덱/메모리/어댑터 (wasm·native 공용)
//!
//! 소켓(TcpListener/serial)은 이 크레이트 **밖**(src-tauri native 셸)에 둔다.
//! 이 크레이트는 `modone-contract` 만 의존하며 wasm32 로 컴파일된다.

pub mod adapter;
pub mod memory;
pub mod pdu;
pub mod policy;
pub mod types;

pub use adapter::{
    DirtyPublishWindow, ModbusAdapter, ModbusAdapterError, ModbusAdapterResult, ProtocolAdapter,
};
pub use memory::ModbusMemory;
pub use policy::{
    ModbusAddressSpace, ModbusMappingPolicy, ModbusMappingRule, ModbusMappingSource,
};
pub use types::{
    ChangeSource, MemoryBatchChangeEvent, MemoryChangeEvent, MemoryError, MemoryEventSink,
    MemoryMapSettings, MemoryType,
};
