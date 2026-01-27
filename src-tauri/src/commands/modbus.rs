//! Modbus Tauri command handlers
//!
//! This module provides Tauri commands for controlling Modbus TCP/RTU servers
//! and accessing Modbus memory (coils and registers).

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::Mutex;

use crate::modbus::{
    list_available_ports, MemoryMapSettings, ModbusMemory, ModbusRtuServer, ModbusTcpServer,
    PortInfo, RtuConfig, TcpConfig,
};

/// Managed state for Modbus functionality
pub struct ModbusState {
    /// Shared Modbus memory (coils, discrete inputs, holding/input registers)
    pub memory: Arc<ModbusMemory>,
    /// TCP server instance (if running)
    pub tcp_server: Mutex<Option<ModbusTcpServer>>,
    /// RTU server instance (if running)
    pub rtu_server: Mutex<Option<ModbusRtuServer>>,
}

impl Default for ModbusState {
    fn default() -> Self {
        Self {
            memory: Arc::new(ModbusMemory::new(&MemoryMapSettings::default())),
            tcp_server: Mutex::new(None),
            rtu_server: Mutex::new(None),
        }
    }
}

/// Status information for Modbus servers
#[derive(Debug, Clone, Serialize)]
pub struct ModbusStatus {
    /// Whether TCP server is running
    pub tcp_running: bool,
    /// TCP server port (if running)
    pub tcp_port: Option<u16>,
    /// Number of active TCP connections
    pub tcp_connections: usize,
    /// Whether RTU server is running
    pub rtu_running: bool,
    /// RTU serial port name (if running)
    pub rtu_port: Option<String>,
    /// RTU baud rate (if running)
    pub rtu_baud_rate: Option<u32>,
}

/// A single write operation for bulk writes
#[derive(Debug, Clone, Deserialize)]
pub struct WriteOperation {
    /// Type of memory to write: "coil", "holding"
    pub memory_type: String,
    /// Address to write to
    pub address: u16,
    /// Value to write (for coils: 0 = false, non-zero = true)
    pub value: u16,
}

/// TCP server configuration from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct TcpServerConfig {
    /// Port to listen on (default: 502)
    #[serde(default = "default_tcp_port")]
    pub port: u16,
    /// Address to bind to (default: "0.0.0.0")
    #[serde(default = "default_bind_address")]
    pub bind_address: String,
    /// Modbus unit ID (default: 1)
    #[serde(default = "default_unit_id")]
    pub unit_id: u8,
    /// Maximum connections (default: 10)
    #[serde(default = "default_max_connections")]
    pub max_connections: usize,
}

fn default_tcp_port() -> u16 {
    502
}
fn default_bind_address() -> String {
    "0.0.0.0".to_string()
}
fn default_unit_id() -> u8 {
    1
}
fn default_max_connections() -> usize {
    10
}

impl Default for TcpServerConfig {
    fn default() -> Self {
        Self {
            port: default_tcp_port(),
            bind_address: default_bind_address(),
            unit_id: default_unit_id(),
            max_connections: default_max_connections(),
        }
    }
}

impl From<TcpServerConfig> for TcpConfig {
    fn from(config: TcpServerConfig) -> Self {
        TcpConfig {
            bind_address: config.bind_address,
            port: config.port,
            unit_id: config.unit_id,
            max_connections: config.max_connections,
            timeout_ms: 3000,
        }
    }
}

// ============================================================================
// TCP Server Commands
// ============================================================================

/// Start the Modbus TCP server
#[tauri::command]
pub async fn modbus_start_tcp(
    state: State<'_, ModbusState>,
    config: Option<TcpServerConfig>,
) -> Result<(), String> {
    let mut tcp_server = state.tcp_server.lock().await;

    if tcp_server.is_some() {
        return Err("TCP server is already running".to_string());
    }

    let tcp_config: TcpConfig = config.unwrap_or_default().into();
    let mut server = ModbusTcpServer::new(tcp_config, Arc::clone(&state.memory));

    server.start().await.map_err(|e| e.to_string())?;

    *tcp_server = Some(server);
    Ok(())
}

/// Stop the Modbus TCP server
#[tauri::command]
pub async fn modbus_stop_tcp(state: State<'_, ModbusState>) -> Result<(), String> {
    let mut tcp_server = state.tcp_server.lock().await;

    match tcp_server.take() {
        Some(mut server) => {
            server.stop().await.map_err(|e| e.to_string())?;
            Ok(())
        }
        None => Err("TCP server is not running".to_string()),
    }
}

// ============================================================================
// RTU Server Commands
// ============================================================================

/// Start the Modbus RTU server
#[tauri::command]
pub async fn modbus_start_rtu(
    state: State<'_, ModbusState>,
    config: RtuConfig,
) -> Result<(), String> {
    let mut rtu_server = state.rtu_server.lock().await;

    if rtu_server.is_some() {
        return Err("RTU server is already running".to_string());
    }

    let mut server = ModbusRtuServer::new(config, Arc::clone(&state.memory));

    server.start().await.map_err(|e| e.to_string())?;

    *rtu_server = Some(server);
    Ok(())
}

/// Stop the Modbus RTU server
#[tauri::command]
pub async fn modbus_stop_rtu(state: State<'_, ModbusState>) -> Result<(), String> {
    let mut rtu_server = state.rtu_server.lock().await;

    match rtu_server.take() {
        Some(mut server) => {
            server.stop().await.map_err(|e| e.to_string())?;
            Ok(())
        }
        None => Err("RTU server is not running".to_string()),
    }
}

/// List available serial ports
#[tauri::command]
pub async fn modbus_list_serial_ports() -> Result<Vec<PortInfo>, String> {
    list_available_ports().map_err(|e| e.to_string())
}

// ============================================================================
// Status Commands
// ============================================================================

/// Get the current status of Modbus servers
#[tauri::command]
pub async fn modbus_get_status(state: State<'_, ModbusState>) -> Result<ModbusStatus, String> {
    let tcp_server = state.tcp_server.lock().await;
    let rtu_server = state.rtu_server.lock().await;

    let (tcp_running, tcp_port, tcp_connections) = match &*tcp_server {
        Some(server) => (
            server.is_running(),
            Some(server.config().port),
            server.get_connection_count(),
        ),
        None => (false, None, 0),
    };

    let (rtu_running, rtu_port, rtu_baud_rate) = match &*rtu_server {
        Some(server) => (
            server.is_running(),
            Some(server.config().com_port.clone()),
            Some(server.config().baud_rate),
        ),
        None => (false, None, None),
    };

    Ok(ModbusStatus {
        tcp_running,
        tcp_port,
        tcp_connections,
        rtu_running,
        rtu_port,
        rtu_baud_rate,
    })
}

// ============================================================================
// Memory Access Commands - Coils
// ============================================================================

/// Read coils from Modbus memory
#[tauri::command]
pub async fn modbus_read_coils(
    state: State<'_, ModbusState>,
    start: u16,
    count: u16,
) -> Result<Vec<bool>, String> {
    if count == 0 {
        return Err("Count must be greater than 0".to_string());
    }

    state
        .memory
        .read_coils(start, count)
        .map_err(|e| e.to_string())
}

/// Write a single coil
#[tauri::command]
pub async fn modbus_write_coil(
    state: State<'_, ModbusState>,
    address: u16,
    value: bool,
) -> Result<(), String> {
    state
        .memory
        .write_coil(address, value)
        .map_err(|e| e.to_string())
}

/// Write multiple coils
#[tauri::command]
pub async fn modbus_write_coils(
    state: State<'_, ModbusState>,
    start: u16,
    values: Vec<bool>,
) -> Result<(), String> {
    if values.is_empty() {
        return Err("Values array cannot be empty".to_string());
    }

    state
        .memory
        .write_coils(start, &values)
        .map_err(|e| e.to_string())
}

// ============================================================================
// Memory Access Commands - Discrete Inputs
// ============================================================================

/// Read discrete inputs from Modbus memory
#[tauri::command]
pub async fn modbus_read_discrete_inputs(
    state: State<'_, ModbusState>,
    start: u16,
    count: u16,
) -> Result<Vec<bool>, String> {
    if count == 0 {
        return Err("Count must be greater than 0".to_string());
    }

    state
        .memory
        .read_discrete_inputs(start, count)
        .map_err(|e| e.to_string())
}

/// Write a discrete input (internal use for simulation)
#[tauri::command]
pub async fn modbus_write_discrete_input(
    state: State<'_, ModbusState>,
    address: u16,
    value: bool,
) -> Result<(), String> {
    state
        .memory
        .write_discrete_input(address, value)
        .map_err(|e| e.to_string())
}

// ============================================================================
// Memory Access Commands - Holding Registers
// ============================================================================

/// Read holding registers from Modbus memory
#[tauri::command]
pub async fn modbus_read_holding_registers(
    state: State<'_, ModbusState>,
    start: u16,
    count: u16,
) -> Result<Vec<u16>, String> {
    if count == 0 {
        return Err("Count must be greater than 0".to_string());
    }

    state
        .memory
        .read_holding_registers(start, count)
        .map_err(|e| e.to_string())
}

/// Write a single holding register
#[tauri::command]
pub async fn modbus_write_holding_register(
    state: State<'_, ModbusState>,
    address: u16,
    value: u16,
) -> Result<(), String> {
    state
        .memory
        .write_holding_register(address, value)
        .map_err(|e| e.to_string())
}

/// Write multiple holding registers
#[tauri::command]
pub async fn modbus_write_holding_registers(
    state: State<'_, ModbusState>,
    start: u16,
    values: Vec<u16>,
) -> Result<(), String> {
    if values.is_empty() {
        return Err("Values array cannot be empty".to_string());
    }

    state
        .memory
        .write_holding_registers(start, &values)
        .map_err(|e| e.to_string())
}

// ============================================================================
// Memory Access Commands - Input Registers
// ============================================================================

/// Read input registers from Modbus memory
#[tauri::command]
pub async fn modbus_read_input_registers(
    state: State<'_, ModbusState>,
    start: u16,
    count: u16,
) -> Result<Vec<u16>, String> {
    if count == 0 {
        return Err("Count must be greater than 0".to_string());
    }

    state
        .memory
        .read_input_registers(start, count)
        .map_err(|e| e.to_string())
}

/// Write an input register (internal use for simulation)
#[tauri::command]
pub async fn modbus_write_input_register(
    state: State<'_, ModbusState>,
    address: u16,
    value: u16,
) -> Result<(), String> {
    state
        .memory
        .write_input_register(address, value)
        .map_err(|e| e.to_string())
}

// ============================================================================
// Bulk Operations
// ============================================================================

/// Perform multiple write operations in bulk
#[tauri::command]
pub async fn modbus_bulk_write(
    state: State<'_, ModbusState>,
    operations: Vec<WriteOperation>,
) -> Result<(), String> {
    if operations.is_empty() {
        return Ok(());
    }

    for op in operations {
        match op.memory_type.as_str() {
            "coil" => {
                state
                    .memory
                    .write_coil(op.address, op.value != 0)
                    .map_err(|e| e.to_string())?;
            }
            "discrete" => {
                state
                    .memory
                    .write_discrete_input(op.address, op.value != 0)
                    .map_err(|e| e.to_string())?;
            }
            "holding" => {
                state
                    .memory
                    .write_holding_register(op.address, op.value)
                    .map_err(|e| e.to_string())?;
            }
            "input" => {
                state
                    .memory
                    .write_input_register(op.address, op.value)
                    .map_err(|e| e.to_string())?;
            }
            _ => {
                return Err(format!(
                    "Invalid memory type: {}. Expected 'coil', 'discrete', 'holding', or 'input'",
                    op.memory_type
                ));
            }
        }
    }

    Ok(())
}

// ============================================================================
// Memory CSV Snapshot Commands
// ============================================================================

/// Save memory snapshot to CSV file
#[tauri::command]
pub async fn modbus_save_memory_csv(
    state: State<'_, ModbusState>,
    path: String,
) -> Result<(), String> {
    use std::path::Path;
    state
        .memory
        .save_to_csv(Path::new(&path))
        .map_err(|e| e.to_string())
}

/// Load memory snapshot from CSV file
#[tauri::command]
pub async fn modbus_load_memory_csv(
    state: State<'_, ModbusState>,
    path: String,
) -> Result<(), String> {
    use std::path::Path;
    state
        .memory
        .load_from_csv(Path::new(&path))
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tcp_server_config_default() {
        let config = TcpServerConfig::default();
        assert_eq!(config.port, 502);
        assert_eq!(config.bind_address, "0.0.0.0");
        assert_eq!(config.unit_id, 1);
        assert_eq!(config.max_connections, 10);
    }

    #[test]
    fn test_modbus_state_default() {
        let state = ModbusState::default();
        // Verify memory is initialized
        assert!(state
            .memory
            .read_holding_registers(0, 1)
            .unwrap()
            .iter()
            .all(|&v| v == 0));
    }
}
