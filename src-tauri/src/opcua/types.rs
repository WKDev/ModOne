use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// OPC UA server configuration for runtime use.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpcUaConfig {
    /// Bind address ("127.0.0.1" or specific plc_ip)
    pub bind_address: String,
    /// TCP port (default 4840)
    pub port: u16,
    /// Server display name
    pub server_name: String,
    /// PKI directory for server-owned certificates and trust stores.
    pub pki_dir: PathBuf,
    /// Optional custom certificate path relative to the PKI directory
    pub certificate_path: PathBuf,
    /// Optional custom private key path relative to the PKI directory
    pub private_key_path: PathBuf,
    /// Optional username for local username/password auth.
    pub username: Option<String>,
    /// Optional password for local username/password auth.
    pub password: Option<String>,
}

impl Default for OpcUaConfig {
    fn default() -> Self {
        Self {
            bind_address: "127.0.0.1".to_string(),
            port: 4840,
            server_name: "ModOne PLC Simulator".to_string(),
            pki_dir: PathBuf::from("pki"),
            certificate_path: PathBuf::from("own/cert.der"),
            private_key_path: PathBuf::from("private/private.pem"),
            username: None,
            password: None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OpcUaSecurityPolicy {
    Basic256Sha256,
}

impl Default for OpcUaSecurityPolicy {
    fn default() -> Self {
        Self::Basic256Sha256
    }
}

/// OPC UA server status reported to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpcUaStatus {
    pub running: bool,
    pub port: u16,
    pub endpoint: String,
    pub endpoint_path: String,
    pub session_count: u32,
    pub session_count_supported: bool,
    pub certificate_fingerprint: Option<String>,
    pub certificate_valid_to: Option<String>,
    pub feature_enabled: bool,
}

impl Default for OpcUaStatus {
    fn default() -> Self {
        Self {
            running: false,
            port: 4840,
            endpoint: String::new(),
            endpoint_path: "/".to_string(),
            session_count: 0,
            session_count_supported: false,
            certificate_fingerprint: None,
            certificate_valid_to: None,
            feature_enabled: cfg!(feature = "opcua-server"),
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
