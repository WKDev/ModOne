//! Modbus Tauri command handlers
//!
//! This module provides Tauri commands for controlling Modbus TCP/RTU servers
//! and accessing Modbus memory (coils and registers).

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::Mutex;

use crate::commands::network::NetworkState;
use crate::modbus::{
    list_available_ports, MemoryMapSettings, ModbusMemory, ModbusRtuServer, ModbusTcpServer,
    PortInfo, RtuConfig, RtuDataBits, RtuParity, RtuStopBits, TcpConfig,
};
use crate::project::{ModbusSimulationTransport, Parity as ProjectParity, ProjectConfig};

/// Managed state for Modbus functionality
pub struct ModbusState {
    /// Shared Modbus memory (coils, discrete inputs, holding/input registers)
    pub memory: Arc<ModbusMemory>,
    /// TCP server instance (if running)
    pub tcp_server: Mutex<Option<ModbusTcpServer>>,
    /// RTU server instance (if running)
    pub rtu_server: Mutex<Option<ModbusRtuServer>>,
    /// Transport currently owned by project-driven simulation lifecycle.
    project_owned_transport: Mutex<Option<ProjectOwnedTransport>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProjectOwnedTransport {
    Tcp,
    Rtu,
}

impl Default for ModbusState {
    fn default() -> Self {
        Self {
            memory: Arc::new(ModbusMemory::new(&MemoryMapSettings::default())),
            tcp_server: Mutex::new(None),
            rtu_server: Mutex::new(None),
            project_owned_transport: Mutex::new(None),
        }
    }
}

fn build_project_memory_map(project_config: &ProjectConfig) -> MemoryMapSettings {
    MemoryMapSettings {
        coil_start: project_config.modbus.simulation.coil_start_address,
        coil_count: project_config.memory_map.coil_count,
        discrete_input_start: project_config.modbus.simulation.coil_start_address,
        discrete_input_count: project_config.memory_map.discrete_input_count,
        holding_register_start: project_config.modbus.simulation.word_start_address,
        holding_register_count: project_config.memory_map.holding_register_count,
        input_register_start: project_config.modbus.simulation.word_start_address,
        input_register_count: project_config.memory_map.input_register_count,
    }
}

fn parse_tcp_bind_address(endpoint: &str) -> Result<(String, u16), String> {
    let endpoint = endpoint.trim();
    if endpoint.is_empty() {
        return Err("Modbus TCP simulation address is empty".to_string());
    }

    if let Ok(socket_addr) = endpoint.parse::<std::net::SocketAddr>() {
        return Ok((socket_addr.ip().to_string(), socket_addr.port()));
    }

    if let Some((host, port)) = endpoint.rsplit_once(':') {
        let port = port
            .parse::<u16>()
            .map_err(|_| format!("Invalid Modbus TCP port in address: {}", endpoint))?;
        let host = host.trim();
        if host.is_empty() {
            return Err(format!("Invalid Modbus TCP address: {}", endpoint));
        }
        return Ok((host.to_string(), port));
    }

    Ok((endpoint.to_string(), 502))
}

fn map_project_parity(parity: ProjectParity) -> RtuParity {
    match parity {
        ProjectParity::None => RtuParity::None,
        ProjectParity::Even => RtuParity::Even,
        ProjectParity::Odd => RtuParity::Odd,
    }
}

fn map_project_stop_bits(stop_bits: u8) -> Result<RtuStopBits, String> {
    match stop_bits {
        1 => Ok(RtuStopBits::One),
        2 => Ok(RtuStopBits::Two),
        other => Err(format!(
            "Unsupported Modbus RTU stop bit count for simulation: {}",
            other
        )),
    }
}

async fn stop_tcp_server_internal(state: &ModbusState) -> Result<(), String> {
    let mut tcp_server = state.tcp_server.lock().await;
    if let Some(mut server) = tcp_server.take() {
        server.stop().await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

async fn stop_rtu_server_internal(state: &ModbusState) -> Result<(), String> {
    let mut rtu_server = state.rtu_server.lock().await;
    if let Some(mut server) = rtu_server.take() {
        server.stop().await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub(crate) async fn modbus_start_project_simulation(
    state: &ModbusState,
    network_state: &NetworkState,
    app_handle: tauri::AppHandle,
    project_config: &ProjectConfig,
) -> Result<(), String> {
    let simulation = &project_config.modbus.simulation;
    if !simulation.enabled {
        return Ok(());
    }

    state
        .memory
        .reconfigure(&build_project_memory_map(project_config));
    state.memory.set_app_handle(app_handle.clone());

    // If plc_ip is configured, ensure the IP alias is set up
    let network = &project_config.network;
    let plc_bind_ip = {
        let mut net_mgr = network_state.manager.lock().await;
        net_mgr
            .ensure_alias(
                network.plc_ip.as_deref(),
                network.interface_name.as_deref(),
                network.subnet_mask.as_deref(),
            )
            .await
            .map_err(|e| e.to_string())?
    };

    match simulation.transport {
        ModbusSimulationTransport::Tcp => {
            let owner = *state.project_owned_transport.lock().await;
            let rtu_running = state.rtu_server.lock().await.is_some();
            if rtu_running {
                if owner == Some(ProjectOwnedTransport::Rtu) {
                    stop_rtu_server_internal(state).await?;
                } else {
                    return Err(
                        "RTU server is already running manually. Stop it before enabling project-owned Modbus TCP simulation."
                            .to_string(),
                    );
                }
            }

            if state.tcp_server.lock().await.is_some() {
                if owner == Some(ProjectOwnedTransport::Tcp) {
                    return Ok(());
                }
                return Err(
                    "TCP server is already running manually. Stop it before enabling project-owned Modbus TCP simulation."
                        .to_string(),
                );
            }

            let (mut bind_address, port) = parse_tcp_bind_address(&simulation.address)?;

            // Override bind address with PLC IP if configured
            if let Some(ref plc_ip) = plc_bind_ip {
                bind_address = plc_ip.clone();
            }

            let mut server = ModbusTcpServer::new(
                TcpConfig {
                    bind_address,
                    port,
                    unit_id: simulation.unit_id,
                    max_connections: 10,
                    timeout_ms: 3000,
                },
                Arc::clone(&state.memory),
            );
            server.set_app_handle(app_handle);

            // If TCP bind fails after alias was added, clean up the alias
            if let Err(e) = server.start().await {
                if plc_bind_ip.is_some() {
                    let mut net_mgr = network_state.manager.lock().await;
                    let _ = net_mgr.cleanup().await;
                }
                return Err(e.to_string());
            }

            *state.tcp_server.lock().await = Some(server);
            *state.project_owned_transport.lock().await = Some(ProjectOwnedTransport::Tcp);
            Ok(())
        }
        ModbusSimulationTransport::Rtu => {
            let owner = *state.project_owned_transport.lock().await;
            let tcp_running = state.tcp_server.lock().await.is_some();
            if tcp_running {
                if owner == Some(ProjectOwnedTransport::Tcp) {
                    stop_tcp_server_internal(state).await?;
                } else {
                    return Err(
                        "TCP server is already running manually. Stop it before enabling project-owned Modbus RTU simulation."
                            .to_string(),
                    );
                }
            }

            if state.rtu_server.lock().await.is_some() {
                if owner == Some(ProjectOwnedTransport::Rtu) {
                    return Ok(());
                }
                return Err(
                    "RTU server is already running manually. Stop it before enabling project-owned Modbus RTU simulation."
                        .to_string(),
                );
            }

            let mut server = ModbusRtuServer::new(
                RtuConfig {
                    com_port: simulation.com_port.clone(),
                    baud_rate: simulation.baud_rate,
                    parity: map_project_parity(simulation.parity),
                    stop_bits: map_project_stop_bits(simulation.stop_bits)?,
                    data_bits: RtuDataBits::Eight,
                    unit_id: simulation.unit_id,
                },
                Arc::clone(&state.memory),
            );
            server.set_app_handle(app_handle);
            server.start().await.map_err(|e| e.to_string())?;
            *state.rtu_server.lock().await = Some(server);
            *state.project_owned_transport.lock().await = Some(ProjectOwnedTransport::Rtu);
            Ok(())
        }
        ModbusSimulationTransport::TcpAscii => Err(
            "Modbus TCP over ASCII simulation is not implemented yet. Use TCP or RTU for now."
                .to_string(),
        ),
        ModbusSimulationTransport::RtuAscii => Err(
            "Modbus RTU over ASCII simulation is not implemented yet. Use RTU or TCP for now."
                .to_string(),
        ),
    }
}

pub(crate) async fn modbus_stop_project_simulation(
    state: &ModbusState,
    network_state: &NetworkState,
) -> Result<(), String> {
    match *state.project_owned_transport.lock().await {
        Some(ProjectOwnedTransport::Tcp) => stop_tcp_server_internal(state).await?,
        Some(ProjectOwnedTransport::Rtu) => stop_rtu_server_internal(state).await?,
        None => return Ok(()),
    }

    *state.project_owned_transport.lock().await = None;

    // Clean up any IP aliases that were set up for this simulation
    let warnings = {
        let mut net_mgr = network_state.manager.lock().await;
        net_mgr.cleanup().await
    };
    for warning in &warnings {
        log::warn!("Network cleanup: {}", warning);
    }

    Ok(())
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
    app_handle: tauri::AppHandle,
    config: Option<TcpServerConfig>,
) -> Result<(), String> {
    let mut tcp_server = state.tcp_server.lock().await;

    if tcp_server.is_some() {
        return Err("TCP server is already running".to_string());
    }

    // Set app handle on memory for event emission
    state.memory.set_app_handle(app_handle.clone());

    let tcp_config: TcpConfig = config.unwrap_or_default().into();
    let mut server = ModbusTcpServer::new(tcp_config, Arc::clone(&state.memory));

    // Set app handle on server for connection events
    server.set_app_handle(app_handle);

    server.start().await.map_err(|e| e.to_string())?;

    *tcp_server = Some(server);
    *state.project_owned_transport.lock().await = None;
    Ok(())
}

/// Stop the Modbus TCP server
#[tauri::command]
pub async fn modbus_stop_tcp(state: State<'_, ModbusState>) -> Result<(), String> {
    let was_owned = *state.project_owned_transport.lock().await == Some(ProjectOwnedTransport::Tcp);
    let mut tcp_server = state.tcp_server.lock().await;

    match tcp_server.take() {
        Some(mut server) => {
            server.stop().await.map_err(|e| e.to_string())?;
            if was_owned {
                *state.project_owned_transport.lock().await = None;
            }
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
    app_handle: tauri::AppHandle,
    config: RtuConfig,
) -> Result<(), String> {
    let mut rtu_server = state.rtu_server.lock().await;

    if rtu_server.is_some() {
        return Err("RTU server is already running".to_string());
    }

    // Set app handle on memory for event emission
    state.memory.set_app_handle(app_handle.clone());

    let mut server = ModbusRtuServer::new(config, Arc::clone(&state.memory));

    // Set app handle on server for connection events
    server.set_app_handle(app_handle);

    server.start().await.map_err(|e| e.to_string())?;

    *rtu_server = Some(server);
    *state.project_owned_transport.lock().await = None;
    Ok(())
}

/// Stop the Modbus RTU server
#[tauri::command]
pub async fn modbus_stop_rtu(state: State<'_, ModbusState>) -> Result<(), String> {
    let was_owned = *state.project_owned_transport.lock().await == Some(ProjectOwnedTransport::Rtu);
    let mut rtu_server = state.rtu_server.lock().await;

    match rtu_server.take() {
        Some(mut server) => {
            server.stop().await.map_err(|e| e.to_string())?;
            if was_owned {
                *state.project_owned_transport.lock().await = None;
            }
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
