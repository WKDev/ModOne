//! Modbus type definitions and error types

use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use thiserror::Error;

/// Errors that can occur during Modbus memory operations
#[derive(Error, Debug)]
pub enum MemoryError {
    #[error("Address out of range: {address} (valid: {start}-{end})")]
    AddressOutOfRange { address: u16, start: u16, end: u16 },

    #[error("Count exceeds available range: requested {count} from {address}, available {available}")]
    CountExceedsRange {
        address: u16,
        count: u16,
        available: u16,
    },

    #[error("Invalid count: {count} (must be > 0)")]
    InvalidCount { count: u16 },

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("CSV parse error at line {line}: {message}")]
    CsvParseError { line: usize, message: String },
}

/// Errors that can occur during Modbus TCP server operations
#[derive(Error, Debug)]
pub enum ModbusError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Server already running")]
    AlreadyRunning,

    #[error("Server not running")]
    NotRunning,

    #[error("Failed to bind to address: {0}")]
    BindFailed(String),

    #[error("Connection limit reached: {current}/{max}")]
    ConnectionLimitReached { current: usize, max: usize },

    #[error("Memory error: {0}")]
    MemoryError(#[from] MemoryError),

    #[error("Shutdown timeout")]
    ShutdownTimeout,
}

/// Configuration for Modbus memory map sizes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMapSettings {
    /// Number of coils (read/write bits, function codes 0x01, 0x05, 0x0F)
    pub coil_count: u16,

    /// Number of discrete inputs (read-only bits, function code 0x02)
    pub discrete_input_count: u16,

    /// Number of holding registers (read/write 16-bit, function codes 0x03, 0x06, 0x10)
    pub holding_register_count: u16,

    /// Number of input registers (read-only 16-bit, function code 0x04)
    pub input_register_count: u16,
}

impl Default for MemoryMapSettings {
    fn default() -> Self {
        Self {
            coil_count: 10000,
            discrete_input_count: 10000,
            holding_register_count: 10000,
            input_register_count: 10000,
        }
    }
}

impl MemoryMapSettings {
    /// Create settings with maximum 16-bit address space
    pub fn max() -> Self {
        Self {
            coil_count: 65535,
            discrete_input_count: 65535,
            holding_register_count: 65535,
            input_register_count: 65535,
        }
    }

    /// Create settings with minimum sizes (1 element each)
    pub fn min() -> Self {
        Self {
            coil_count: 1,
            discrete_input_count: 1,
            holding_register_count: 1,
            input_register_count: 1,
        }
    }
}

/// Memory type identifiers for CSV export/import
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemoryType {
    Coil,
    DiscreteInput,
    HoldingRegister,
    InputRegister,
}

impl MemoryType {
    pub fn as_str(&self) -> &'static str {
        match self {
            MemoryType::Coil => "coil",
            MemoryType::DiscreteInput => "discrete",
            MemoryType::HoldingRegister => "holding",
            MemoryType::InputRegister => "input",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "coil" => Some(MemoryType::Coil),
            "discrete" => Some(MemoryType::DiscreteInput),
            "holding" => Some(MemoryType::HoldingRegister),
            "input" => Some(MemoryType::InputRegister),
            _ => None,
        }
    }
}

/// Configuration for Modbus TCP server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TcpConfig {
    /// Address to bind to (default: "0.0.0.0")
    pub bind_address: String,

    /// Port to listen on (default: 502)
    pub port: u16,

    /// Modbus unit ID (default: 1)
    pub unit_id: u8,

    /// Maximum number of concurrent connections (default: 10)
    pub max_connections: usize,

    /// Connection timeout in milliseconds (default: 3000)
    pub timeout_ms: u64,
}

impl Default for TcpConfig {
    fn default() -> Self {
        Self {
            bind_address: "0.0.0.0".to_string(),
            port: 502,
            unit_id: 1,
            max_connections: 10,
            timeout_ms: 3000,
        }
    }
}

impl TcpConfig {
    /// Create a new TcpConfig with specified port
    pub fn with_port(port: u16) -> Self {
        Self {
            port,
            ..Default::default()
        }
    }

    /// Get the socket address for binding
    pub fn socket_addr(&self) -> String {
        format!("{}:{}", self.bind_address, self.port)
    }
}

/// Information about a connected Modbus client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    /// Client socket address
    pub address: String,

    /// Connection timestamp (ISO 8601 format)
    pub connected_at: String,
}

impl ConnectionInfo {
    /// Create a new ConnectionInfo for a socket address
    pub fn new(address: SocketAddr) -> Self {
        Self {
            address: address.to_string(),
            connected_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

// ============================================================================
// Event Types for Tauri Event System
// ============================================================================

/// Event emitted when a memory value changes
#[derive(Debug, Clone, Serialize)]
pub struct MemoryChangeEvent {
    /// Type of memory: "coil", "discrete", "holding", or "input"
    pub register_type: String,
    /// Address that changed
    pub address: u16,
    /// Previous value (bool for coils/discrete, u16 for registers)
    pub old_value: serde_json::Value,
    /// New value (bool for coils/discrete, u16 for registers)
    pub new_value: serde_json::Value,
    /// Source of the change: "internal", "external", or "simulation"
    pub source: String,
}

impl MemoryChangeEvent {
    /// Create a coil change event
    pub fn coil(address: u16, old_value: bool, new_value: bool, source: &str) -> Self {
        Self {
            register_type: "coil".to_string(),
            address,
            old_value: serde_json::json!(old_value),
            new_value: serde_json::json!(new_value),
            source: source.to_string(),
        }
    }

    /// Create a discrete input change event
    pub fn discrete(address: u16, old_value: bool, new_value: bool, source: &str) -> Self {
        Self {
            register_type: "discrete".to_string(),
            address,
            old_value: serde_json::json!(old_value),
            new_value: serde_json::json!(new_value),
            source: source.to_string(),
        }
    }

    /// Create a holding register change event
    pub fn holding(address: u16, old_value: u16, new_value: u16, source: &str) -> Self {
        Self {
            register_type: "holding".to_string(),
            address,
            old_value: serde_json::json!(old_value),
            new_value: serde_json::json!(new_value),
            source: source.to_string(),
        }
    }

    /// Create an input register change event
    pub fn input(address: u16, old_value: u16, new_value: u16, source: &str) -> Self {
        Self {
            register_type: "input".to_string(),
            address,
            old_value: serde_json::json!(old_value),
            new_value: serde_json::json!(new_value),
            source: source.to_string(),
        }
    }
}

/// Event emitted when multiple memory values change (batch operation)
#[derive(Debug, Clone, Serialize)]
pub struct MemoryBatchChangeEvent {
    /// All changes in the batch
    pub changes: Vec<MemoryChangeEvent>,
}

/// Event emitted when a client connects or disconnects
#[derive(Debug, Clone, Serialize)]
pub struct ConnectionEvent {
    /// Type of event: "connected" or "disconnected"
    pub event_type: String,
    /// Protocol: "tcp" or "rtu"
    pub protocol: String,
    /// Client address (IP:port for TCP, port name for RTU)
    pub client_addr: String,
    /// ISO 8601 timestamp
    pub timestamp: String,
}

impl ConnectionEvent {
    /// Create a TCP connected event
    pub fn tcp_connected(client_addr: &str) -> Self {
        Self {
            event_type: "connected".to_string(),
            protocol: "tcp".to_string(),
            client_addr: client_addr.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Create a TCP disconnected event
    pub fn tcp_disconnected(client_addr: &str) -> Self {
        Self {
            event_type: "disconnected".to_string(),
            protocol: "tcp".to_string(),
            client_addr: client_addr.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Create an RTU connected event
    pub fn rtu_connected(port_name: &str) -> Self {
        Self {
            event_type: "connected".to_string(),
            protocol: "rtu".to_string(),
            client_addr: port_name.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Create an RTU disconnected event
    pub fn rtu_disconnected(port_name: &str) -> Self {
        Self {
            event_type: "disconnected".to_string(),
            protocol: "rtu".to_string(),
            client_addr: port_name.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}

/// Source of a memory change
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeSource {
    /// Change from internal API (Tauri commands)
    Internal,
    /// Change from external Modbus client
    External,
    /// Change from simulation engine
    Simulation,
}

impl ChangeSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            ChangeSource::Internal => "internal",
            ChangeSource::External => "external",
            ChangeSource::Simulation => "simulation",
        }
    }
}
