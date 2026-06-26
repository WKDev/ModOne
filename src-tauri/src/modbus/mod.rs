//! Modbus protocol implementation module (native 전송 셸)
//!
//! 코덱/메모리/어댑터/매핑정책은 `modbus-codec` 크레이트로 이전됨. 이 모듈은
//! native 전송 셸(TCP/RTU 소켓 서버)과 Tauri 이벤트 싱크만 보유하고, codec 의
//! 공개 표면을 `crate::modbus::X` 경로로 재노출한다.

pub mod rtu;
pub mod tauri_sink;
pub mod tcp;
pub mod types;

// codec 데이터 모델/코덱/어댑터/정책 재노출 (기존 `crate::modbus::X` 경로 호환).
pub use modbus_codec::{
    pdu, ChangeSource, DirtyPublishWindow, MemoryBatchChangeEvent, MemoryChangeEvent, MemoryError,
    MemoryEventSink, MemoryMapSettings, MemoryType, ModbusAdapter, ModbusAdapterError,
    ModbusAdapterResult, ModbusAddressSpace, ModbusMappingPolicy, ModbusMappingRule,
    ModbusMappingSource, ModbusMemory, ProtocolAdapter,
};

pub use rtu::{
    list_available_ports, ModbusRtuServer, PortInfo, RtuConfig, RtuDataBits, RtuParity, RtuStopBits,
};
pub use tauri_sink::TauriEventSink;
pub use tcp::ModbusTcpServer;
pub use types::{ConnectionEvent, ConnectionInfo, ModbusError, TcpConfig};
