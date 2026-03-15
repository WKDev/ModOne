use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// OPC UA server configuration for runtime use.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpcUaConfig {
    /// Bind address ("0.0.0.0" or specific plc_ip)
    pub bind_address: String,
    /// TCP port (default 4840)
    pub port: u16,
    /// Server display name
    pub server_name: String,
    /// Security policy
    pub security_policy: OpcUaSecurityPolicy,
    /// Allow anonymous access
    pub anonymous_access: bool,
    /// Optional custom certificate path
    pub certificate_path: Option<PathBuf>,
    /// Optional custom private key path
    pub private_key_path: Option<PathBuf>,
}

impl Default for OpcUaConfig {
    fn default() -> Self {
        Self {
            bind_address: "0.0.0.0".to_string(),
            port: 4840,
            server_name: "ModOne PLC Simulator".to_string(),
            security_policy: OpcUaSecurityPolicy::None,
            anonymous_access: true,
            certificate_path: None,
            private_key_path: None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OpcUaSecurityPolicy {
    None,
    Basic256Sha256,
}

impl Default for OpcUaSecurityPolicy {
    fn default() -> Self {
        Self::None
    }
}

/// OPC UA server status reported to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpcUaStatus {
    pub running: bool,
    pub port: u16,
    pub endpoint: String,
    pub session_count: u32,
}

impl Default for OpcUaStatus {
    fn default() -> Self {
        Self {
            running: false,
            port: 4840,
            endpoint: String::new(),
            session_count: 0,
        }
    }
}

/// Errors specific to OPC UA operations.
#[derive(Debug, thiserror::Error)]
pub enum OpcUaError {
    #[error("OPC UA server error: {0}")]
    Server(String),
    #[error("OPC UA configuration error: {0}")]
    Config(String),
    #[error("OPC UA address space error: {0}")]
    AddressSpace(String),
    #[error("OPC UA node not found: {0}")]
    NodeNotFound(String),
}
