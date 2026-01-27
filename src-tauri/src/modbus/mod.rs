//! Modbus protocol implementation module
//!
//! This module provides Modbus memory management and protocol handling
//! for the ModOne PLC simulator.

pub mod memory;
pub mod rtu;
pub mod tcp;
pub mod types;

pub use memory::ModbusMemory;
pub use rtu::{
    list_available_ports, ModbusRtuServer, PortInfo, RtuConfig, RtuDataBits, RtuParity,
    RtuStopBits,
};
pub use tcp::ModbusTcpServer;
pub use types::{
    ChangeSource, ConnectionEvent, ConnectionInfo, MemoryBatchChangeEvent, MemoryChangeEvent,
    MemoryError, MemoryMapSettings, ModbusError, TcpConfig,
};
