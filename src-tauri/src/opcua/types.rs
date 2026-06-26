use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::auth::VerifiedCredential;

/// OPC UA server configuration for runtime use.
///
/// `#[serde(default)]` lets the frontend send a partial config (only the
/// user-editable fields: credentials, security policies, anonymous access);
/// infra fields (bind_address, port, server_name, PKI paths) fall back to the
/// `Default` impl and are then resolved/overridden by `finalize_opcua_config`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
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
    /// Legacy single-user username (used as fallback when no accounts are configured).
    pub username: Option<String>,
    /// Legacy single-user password (used as fallback when no accounts are configured).
    pub password: Option<String>,
    /// Verified multi-account credentials resolved from the [`UserAccountStore`]
    /// and [`CredentialCache`]. Each entry has been bcrypt-verified and carries
    /// the plaintext password needed by the opcua crate for runtime registration.
    ///
    /// When non-empty, these take precedence over `username`/`password`.
    #[serde(skip)]
    pub verified_credentials: Vec<VerifiedCredential>,
    /// Enabled security policies for the server.
    /// When empty, defaults to [None, Basic256Sha256].
    #[serde(default = "OpcUaSecurityPolicy::default_enabled")]
    pub security_policies: Vec<OpcUaSecurityPolicy>,
    /// Whether anonymous (unauthenticated) client connections are allowed.
    /// Defaults to `false` — disabled for security.
    #[serde(default)]
    pub allow_anonymous: bool,
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
            verified_credentials: Vec::new(),
            security_policies: OpcUaSecurityPolicy::default_enabled(),
            allow_anonymous: false,
        }
    }
}

/// OPC UA security policies supported by the server.
///
/// Each variant corresponds to an OPC UA-defined security policy URI.
/// `None` provides no encryption (testing/development only).
/// The remaining policies provide increasing levels of cryptographic security.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum OpcUaSecurityPolicy {
    /// No security — plaintext transport (development/testing only)
    None,
    /// Basic128Rsa15 (deprecated but still used by legacy clients)
    Basic128Rsa15,
    /// Basic256 (deprecated but still used by legacy clients)
    Basic256,
    /// Basic256Sha256 — recommended minimum for production
    Basic256Sha256,
    /// Aes128-Sha256-RsaOaep — modern policy
    Aes128Sha256RsaOaep,
    /// Aes256-Sha256-RsPss — strongest available policy
    Aes256Sha256RsPss,
}

impl OpcUaSecurityPolicy {
    /// Returns all available security policy variants.
    pub fn all() -> &'static [OpcUaSecurityPolicy] {
        &[
            OpcUaSecurityPolicy::None,
            OpcUaSecurityPolicy::Basic128Rsa15,
            OpcUaSecurityPolicy::Basic256,
            OpcUaSecurityPolicy::Basic256Sha256,
            OpcUaSecurityPolicy::Aes128Sha256RsaOaep,
            OpcUaSecurityPolicy::Aes256Sha256RsPss,
        ]
    }

    /// Returns the default set of enabled security policies for new projects.
    /// Includes Basic256Sha256 and a None/discovery endpoint.
    pub fn default_enabled() -> Vec<OpcUaSecurityPolicy> {
        vec![
            OpcUaSecurityPolicy::None,
            OpcUaSecurityPolicy::Basic256Sha256,
        ]
    }

    /// Returns the OPC UA standard policy URI string.
    pub fn policy_uri(&self) -> &'static str {
        match self {
            OpcUaSecurityPolicy::None => "http://opcfoundation.org/UA/SecurityPolicy#None",
            OpcUaSecurityPolicy::Basic128Rsa15 => {
                "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15"
            }
            OpcUaSecurityPolicy::Basic256 => {
                "http://opcfoundation.org/UA/SecurityPolicy#Basic256"
            }
            OpcUaSecurityPolicy::Basic256Sha256 => {
                "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256"
            }
            OpcUaSecurityPolicy::Aes128Sha256RsaOaep => {
                "http://opcfoundation.org/UA/SecurityPolicy#Aes128_Sha256_RsaOaep"
            }
            OpcUaSecurityPolicy::Aes256Sha256RsPss => {
                "http://opcfoundation.org/UA/SecurityPolicy#Aes256_Sha256_RsPss"
            }
        }
    }

    /// Human-readable display name for the policy.
    pub fn display_name(&self) -> &'static str {
        match self {
            OpcUaSecurityPolicy::None => "None (No Security)",
            OpcUaSecurityPolicy::Basic128Rsa15 => "Basic128Rsa15",
            OpcUaSecurityPolicy::Basic256 => "Basic256",
            OpcUaSecurityPolicy::Basic256Sha256 => "Basic256Sha256",
            OpcUaSecurityPolicy::Aes128Sha256RsaOaep => "Aes128-Sha256-RsaOaep",
            OpcUaSecurityPolicy::Aes256Sha256RsPss => "Aes256-Sha256-RsPss",
        }
    }

    /// Whether this policy requires encryption (i.e., is not `None`).
    pub fn requires_encryption(&self) -> bool {
        !matches!(self, OpcUaSecurityPolicy::None)
    }

    /// The message security mode auto-determined for this policy.
    /// `None` policy → no security mode; all others → SignAndEncrypt.
    pub fn auto_message_security_mode(&self) -> &'static str {
        match self {
            OpcUaSecurityPolicy::None => "None",
            _ => "SignAndEncrypt",
        }
    }
}

impl Default for OpcUaSecurityPolicy {
    fn default() -> Self {
        Self::Basic256Sha256
    }
}

impl std::fmt::Display for OpcUaSecurityPolicy {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.display_name())
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
    /// Security policies that the server is currently advertising.
    #[serde(default)]
    pub active_security_policies: Vec<OpcUaSecurityPolicy>,
    /// Whether the running server allows anonymous (unauthenticated) connections.
    #[serde(default)]
    pub allow_anonymous: bool,
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
            active_security_policies: Vec::new(),
            allow_anonymous: false,
        }
    }
}

/// Detailed information about an active OPC UA client session.
///
/// Returned by the `opcua_get_sessions` command for the session monitoring UI.
/// Modelled after the Prosys OPC UA Simulation Server session table with columns:
/// Session Name, Session ID, Client Description, Server URI, Connection Time,
/// Last Contact Time, Client Address, Secure Channel ID, State.
///
/// Fields are best-effort: the underlying crate may not expose all details,
/// in which case sensible defaults or empty strings are used.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpcUaSessionInfo {
    /// Unique identifier for this session (opaque string).
    pub session_id: String,
    /// Client application name / session name as reported during session creation.
    pub client_name: String,
    /// Client application description (e.g. product URI or application URI).
    /// May be empty when the crate does not expose `ApplicationDescription`.
    pub client_description: String,
    /// Remote IP address of the connected client (e.g. "192.168.1.10").
    pub client_ip: String,
    /// The server's own endpoint URI that this session connected to.
    pub server_uri: String,
    /// Security policy URI active on this session's channel.
    pub security_policy: String,
    /// Message security mode ("None", "Sign", "SignAndEncrypt").
    pub security_mode: String,
    /// ISO 8601 timestamp when the session was created / connected.
    pub connected_at: String,
    /// ISO 8601 timestamp of the last known activity on this session.
    /// Updated each time the session monitor observes the session.
    pub last_contact_time: String,
    /// Secure channel identifier for this session's transport channel.
    /// Derived from the connection's client address when the crate does not
    /// expose a discrete channel ID.
    pub secure_channel_id: String,
    /// Session lifecycle state: "Created", "Activated", or "Closing".
    pub state: String,
    /// Number of active subscriptions on this session.
    pub subscription_count: u32,
}

// OpcUaError는 opcua-codec 크레이트로 이전됨. 기존 `crate::opcua::types::OpcUaError`
// 및 `super::types::OpcUaError` 경로 호환을 위해 재노출한다.
pub use opcua_codec::OpcUaError;
