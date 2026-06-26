//! Modbus 전송(소켓) 전용 타입과 에러
//!
//! 데이터 모델 타입(메모리/변경이벤트/매핑정책)은 `modbus-codec` 로 이전됨.
//! 여기엔 native 전송 셸 전용 타입(TCP/RTU 서버 설정, 연결 이벤트)만 남는다.
//! 이전된 타입들은 `crate::modbus::types::X` 경로 호환을 위해 재노출한다.

use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use thiserror::Error;

// codec 로 이전된 메모리 데이터 모델 타입 재노출 (경로 호환).
pub use modbus_codec::{
    ChangeSource, MemoryBatchChangeEvent, MemoryChangeEvent, MemoryError, MemoryMapSettings,
    MemoryType,
};

/// Errors that can occur during Modbus TCP/RTU server operations
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
// Event Types for Tauri Event System (전송 계층 전용)
// ============================================================================

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
