//! Modbus protocol implementation module
//!
//! This module provides Modbus memory management and protocol handling
//! for the ModOne PLC simulator.

pub mod memory;
pub mod tcp;
pub mod types;

pub use memory::ModbusMemory;
pub use tcp::ModbusTcpServer;
pub use types::{ConnectionInfo, MemoryError, MemoryMapSettings, ModbusError, TcpConfig};
