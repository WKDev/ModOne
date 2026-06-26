//! Project configuration types and YAML schema
//!
//! Defines the structure for config.yml files in project packages.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize};

use crate::opcua::{OpcUaMappingConfig, OpcUaSecurityPolicy, UserAccount};

/// Main project configuration structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    /// Configuration schema version
    pub version: String,

    /// Project metadata settings
    pub project: ProjectSettings,

    /// PLC configuration
    pub plc: PlcSettings,

    /// Modbus communication settings
    pub modbus: ModbusSettings,

    /// Memory map configuration
    pub memory_map: MemoryMapSettings,

    /// Auto-save configuration
    #[serde(default)]
    pub auto_save: AutoSaveSettings,

    /// Canvas settings
    #[serde(default)]
    pub canvas: CanvasSettings,

    /// Network settings for PLC IP simulation
    #[serde(default)]
    pub network: NetworkSettings,

    /// OPC UA server settings
    #[serde(default)]
    pub opcua: OpcUaSettings,

    /// IDs of tags pinned to the watch list in the Tag Browser.
    /// Persisted so the watch list survives project close/reopen.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub watched_tag_ids: Vec<String>,

    /// Per-tag OPC UA mapping configurations, keyed by tag ID.
    /// Persisted so that custom OPC UA type mappings survive project close/reopen.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub opcua_mappings: HashMap<String, OpcUaMappingConfig>,
}

impl Default for ProjectConfig {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            project: ProjectSettings::default(),
            plc: PlcSettings::default(),
            modbus: ModbusSettings::default(),
            memory_map: MemoryMapSettings::default(),
            auto_save: AutoSaveSettings::default(),
            canvas: CanvasSettings::default(),
            network: NetworkSettings::default(),
            opcua: OpcUaSettings::default(),
            watched_tag_ids: Vec::new(),
            opcua_mappings: HashMap::new(),
        }
    }
}

/// Network settings for PLC IP simulation.
///
/// When `plc_ip` is set, the simulator will bind Modbus TCP (and future OPC UA)
/// servers to this IP address instead of the default `127.0.0.1`. The IP can be
/// assigned to a network interface as an alias using OS-level commands
/// (e.g., `netsh interface ip add address` on Windows).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkSettings {
    /// IP address that the simulated PLC should use on the network.
    /// When set, protocol servers (Modbus TCP, OPC UA) bind to this IP.
    /// When None, servers bind to 127.0.0.1.
    pub plc_ip: Option<String>,

    /// Network interface name for IP alias assignment.
    /// Used when automatically managing IP aliases.
    pub interface_name: Option<String>,

    /// Subnet mask for the PLC IP (e.g., "255.255.255.0").
    pub subnet_mask: Option<String>,
}

impl Default for NetworkSettings {
    fn default() -> Self {
        Self {
            plc_ip: None,
            interface_name: None,
            subnet_mask: None,
        }
    }
}

/// OPC UA server settings for the project.
#[derive(Debug, Clone, Serialize)]
pub struct OpcUaSettings {
    /// Whether the OPC UA server is enabled during simulation.
    pub enabled: bool,
    /// TCP port for the OPC UA server.
    pub port: u16,
    /// Display name for the OPC UA server.
    pub server_name: String,
    /// Optional username for UA user/password authentication.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    /// Optional password for UA user/password authentication.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// Enabled OPC UA security policies for the server.
    /// Persisted to project config; used to generate server endpoints on start.
    #[serde(default = "OpcUaSecurityPolicy::default_enabled")]
    pub security_policies: Vec<OpcUaSecurityPolicy>,
    /// Whether anonymous (unauthenticated) client connections are allowed.
    /// Defaults to `false` — disabled for security.
    #[serde(default)]
    pub allow_anonymous: bool,
    /// Multiple user accounts for OPC UA authentication.
    /// Each entry stores a username and bcrypt-hashed password.
    /// Replaces the legacy single `username`/`password` fields.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub user_accounts: Vec<UserAccount>,
    /// Number of days to retain audit log entries before automatic deletion.
    /// Defaults to 90 days. Minimum 1 day.
    #[serde(default = "default_audit_retention_days")]
    pub audit_retention_days: u32,
    /// True when an old `security_policy: None` value was migrated on load.
    #[serde(skip)]
    pub legacy_insecure_policy_seen: bool,
    /// True when an old `anonymous_access: true` value was migrated on load.
    #[serde(skip)]
    pub legacy_anonymous_access_seen: bool,
}

impl Default for OpcUaSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            port: 4840,
            server_name: "ModOne PLC Simulator".to_string(),
            username: None,
            password: None,
            security_policies: OpcUaSecurityPolicy::default_enabled(),
            allow_anonymous: false,
            user_accounts: Vec::new(),
            audit_retention_days: default_audit_retention_days(),
            legacy_insecure_policy_seen: false,
            legacy_anonymous_access_seen: false,
        }
    }
}

impl<'de> Deserialize<'de> for OpcUaSettings {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct RawOpcUaSettings {
            #[serde(default)]
            enabled: bool,
            #[serde(default = "default_opcua_port")]
            port: u16,
            #[serde(default = "default_opcua_server_name")]
            server_name: String,
            #[serde(default)]
            security_policy: Option<LegacyOpcUaSecurityPolicySetting>,
            #[serde(default)]
            anonymous_access: Option<bool>,
            #[serde(default)]
            username: Option<String>,
            #[serde(default)]
            password: Option<String>,
            #[serde(default = "default_security_policies")]
            security_policies: Vec<OpcUaSecurityPolicy>,
            #[serde(default)]
            allow_anonymous: bool,
            #[serde(default)]
            user_accounts: Vec<UserAccount>,
            #[serde(default = "default_audit_retention_days")]
            audit_retention_days: u32,
        }

        let raw = RawOpcUaSettings::deserialize(deserializer)?;
        Ok(Self {
            enabled: raw.enabled,
            port: raw.port,
            server_name: raw.server_name,
            username: raw.username,
            password: raw.password,
            security_policies: raw.security_policies,
            allow_anonymous: raw.allow_anonymous,
            user_accounts: raw.user_accounts,
            audit_retention_days: raw.audit_retention_days.max(1),
            legacy_insecure_policy_seen: matches!(
                raw.security_policy,
                Some(LegacyOpcUaSecurityPolicySetting::None)
            ),
            legacy_anonymous_access_seen: raw.anonymous_access.unwrap_or(false),
        })
    }
}

fn default_security_policies() -> Vec<OpcUaSecurityPolicy> {
    OpcUaSecurityPolicy::default_enabled()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OpcUaSecurityPolicySetting {
    Basic256Sha256,
}

impl Default for OpcUaSecurityPolicySetting {
    fn default() -> Self {
        Self::Basic256Sha256
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
enum LegacyOpcUaSecurityPolicySetting {
    None,
    Basic256Sha256,
}

fn default_audit_retention_days() -> u32 {
    90
}

fn default_opcua_port() -> u16 {
    4840
}

fn default_opcua_server_name() -> String {
    "ModOne PLC Simulator".to_string()
}

/// Canvas grid and interaction settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasSettings {
    /// Grid spacing in pixels
    pub grid_size: u32,
    /// Whether to snap to grid
    pub snap_to_grid: bool,
    /// Whether to show the grid
    pub show_grid: bool,
    /// Grid style ("dots" | "lines")
    pub grid_style: String,
}

impl Default for CanvasSettings {
    fn default() -> Self {
        Self {
            grid_size: 20,
            snap_to_grid: true,
            show_grid: true,
            grid_style: "dots".to_string(),
        }
    }
}

impl ProjectConfig {
    /// Create a new project config with the given name
    pub fn new(name: &str) -> Self {
        let mut config = Self::default();
        config.project.name = name.to_string();
        config
    }

    /// Validate the configuration values using the validation module
    ///
    /// This is a convenience method that delegates to the comprehensive
    /// validation in the validation module.
    pub fn validate(&self) -> Result<(), ConfigValidationError> {
        use super::validation::validate_project_config;
        use crate::error::ModOneError;

        match validate_project_config(self) {
            Ok(()) => Ok(()),
            Err(ModOneError::ConfigValidationError { field, message }) => {
                // Map to legacy ConfigValidationError for backward compatibility
                match field.as_str() {
                    "project.name" => Err(ConfigValidationError::EmptyProjectName),
                    "plc.scan_time_ms" => Err(ConfigValidationError::InvalidScanTime),
                    f if f.contains("port") => Err(ConfigValidationError::InvalidPort),
                    f if f.contains("baud_rate") => Err(ConfigValidationError::InvalidBaudRate),
                    _ => Err(ConfigValidationError::Other { field, message }),
                }
            }
            Err(_) => Err(ConfigValidationError::Other {
                field: "unknown".to_string(),
                message: "Validation failed".to_string(),
            }),
        }
    }
}

/// Project metadata settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSettings {
    /// Project name
    pub name: String,

    /// Project description
    pub description: String,

    /// Project creation timestamp
    pub created_at: DateTime<Utc>,

    /// Last modification timestamp
    pub updated_at: DateTime<Utc>,
}

impl Default for ProjectSettings {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            name: String::new(),
            description: String::new(),
            created_at: now,
            updated_at: now,
        }
    }
}

// PLC 하드웨어 모델 타입은 plc-model 크레이트로 이전됨 (vendor-neutral 추상화).
// 기존 `crate::project::Plc*` 경로 호환을 위해 재노출한다. 설계:
// docs/wasm-migration/02-PLC-MODEL.md
pub use plc_model::{
    PlcAddressWindow, PlcHardwareModule, PlcHardwareTopology, PlcIoDirection, PlcManufacturer,
    PlcModuleKind, PlcRackKind, PlcRackTopology, PlcSettings,
};

/// Modbus communication settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusSettings {
    /// TCP server settings
    pub tcp: ModbusTcpSettings,

    /// RTU settings
    pub rtu: ModbusRtuSettings,

    /// Project-level Modbus server simulation preferences.
    #[serde(default)]
    pub simulation: ModbusServerSimulationSettings,

    /// Vendor-facing register exposure policy.
    #[serde(default)]
    pub exposure: ModbusExposureSettings,
}

impl Default for ModbusSettings {
    fn default() -> Self {
        Self {
            tcp: ModbusTcpSettings::default(),
            rtu: ModbusRtuSettings::default(),
            simulation: ModbusServerSimulationSettings::default(),
            exposure: ModbusExposureSettings::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusServerSimulationSettings {
    /// Whether project simulation should expose a Modbus server surface.
    pub enabled: bool,
    /// Transport/protocol flavor for the simulated server.
    #[serde(default)]
    pub transport: ModbusSimulationTransport,
    /// IP address/host:port for TCP variants.
    #[serde(default)]
    pub address: String,
    /// COM path/device path for RTU variants.
    #[serde(default)]
    pub com_port: String,
    /// Unit/slave identifier.
    pub unit_id: u8,
    /// Baud rate for serial variants.
    pub baud_rate: u32,
    /// Parity for serial variants.
    #[serde(default)]
    pub parity: Parity,
    /// Stop bits for serial variants.
    pub stop_bits: u8,
    /// Coil exposure base address chosen by the user.
    pub coil_start_address: u16,
    /// Word/register exposure base address chosen by the user.
    pub word_start_address: u16,
}

impl Default for ModbusServerSimulationSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            transport: ModbusSimulationTransport::Tcp,
            address: "127.0.0.1:502".to_string(),
            com_port: String::new(),
            unit_id: 1,
            baud_rate: 9600,
            parity: Parity::None,
            stop_bits: 1,
            coil_start_address: 0,
            word_start_address: 0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModbusSimulationTransport {
    Tcp,
    Rtu,
    TcpAscii,
    RtuAscii,
}

impl Default for ModbusSimulationTransport {
    fn default() -> Self {
        Self::Tcp
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusExposureSettings {
    /// Policy mode used to materialize effective mapping rules.
    #[serde(default)]
    pub mode: ModbusExposureMode,
    /// Explicit mapping rules used when mode is `Custom`.
    #[serde(default)]
    pub rules: Vec<ModbusExposureRule>,
}

impl Default for ModbusExposureSettings {
    fn default() -> Self {
        Self {
            mode: ModbusExposureMode::Recommended,
            rules: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModbusExposureMode {
    Recommended,
    LegacyWide,
    Custom,
}

impl Default for ModbusExposureMode {
    fn default() -> Self {
        Self::Recommended
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusExposureRule {
    /// Vendor family name such as `M`, `P`, `X`, `Y`, or `D`.
    pub family: String,
    /// Modbus space that should expose the family.
    pub address_space: ModbusExposureAddressSpace,
    /// Modbus offset where the family begins.
    pub offset: u16,
    /// Number of exposed points/registers.
    pub count: u16,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModbusExposureAddressSpace {
    Coil,
    DiscreteInput,
    HoldingRegister,
    InputRegister,
}

/// Modbus TCP server settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusTcpSettings {
    /// Enable TCP server
    pub enabled: bool,

    /// TCP port to listen on
    pub port: u16,

    /// Modbus unit ID
    pub unit_id: u8,
}

impl Default for ModbusTcpSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            port: 502,
            unit_id: 1,
        }
    }
}

/// Modbus RTU settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusRtuSettings {
    /// Enable RTU communication
    pub enabled: bool,

    /// COM port name (e.g., "COM1" on Windows, "/dev/ttyUSB0" on Linux)
    pub com_port: String,

    /// Baud rate
    pub baud_rate: u32,

    /// Parity setting
    pub parity: Parity,

    /// Number of stop bits
    pub stop_bits: u8,
}

impl Default for ModbusRtuSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            com_port: String::new(),
            baud_rate: 9600,
            parity: Parity::None,
            stop_bits: 1,
        }
    }
}

/// Serial parity settings
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Parity {
    None,
    Even,
    Odd,
}

impl Default for Parity {
    fn default() -> Self {
        Self::None
    }
}

/// Auto-save configuration settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoSaveSettings {
    /// Whether auto-save is enabled
    pub enabled: bool,

    /// Auto-save interval in seconds
    pub interval_secs: u64,

    /// Number of backup files to keep
    pub backup_count: u32,
}

impl Default for AutoSaveSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_secs: 300, // 5 minutes
            backup_count: 3,
        }
    }
}

/// Memory map configuration settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMapSettings {
    /// Starting address for coils
    pub coil_start: u16,

    /// Number of coils
    pub coil_count: u16,

    /// Starting address for discrete inputs
    pub discrete_input_start: u16,

    /// Number of discrete inputs
    pub discrete_input_count: u16,

    /// Starting address for holding registers
    pub holding_register_start: u16,

    /// Number of holding registers
    pub holding_register_count: u16,

    /// Starting address for input registers
    pub input_register_start: u16,

    /// Number of input registers
    pub input_register_count: u16,
}

impl Default for MemoryMapSettings {
    fn default() -> Self {
        Self {
            coil_start: 0,
            coil_count: 1000,
            discrete_input_start: 0,
            discrete_input_count: 1000,
            holding_register_start: 0,
            holding_register_count: 1000,
            input_register_start: 0,
            input_register_count: 1000,
        }
    }
}

/// Configuration validation errors
#[derive(Debug, thiserror::Error)]
pub enum ConfigValidationError {
    #[error("Project name cannot be empty")]
    EmptyProjectName,

    #[error("Scan time must be greater than 0")]
    InvalidScanTime,

    #[error("TCP port must be greater than 0")]
    InvalidPort,

    #[error("Baud rate must be greater than 0")]
    InvalidBaudRate,

    #[error("Validation error in {field}: {message}")]
    Other { field: String, message: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = ProjectConfig::default();
        assert_eq!(config.version, "1.0");
        assert_eq!(config.plc.scan_time_ms, 10);
        assert_eq!(config.modbus.tcp.port, 502);
        assert!(config.modbus.tcp.enabled);
        assert!(!config.modbus.rtu.enabled);
        // Auto-save defaults
        assert!(config.auto_save.enabled);
        assert_eq!(config.auto_save.interval_secs, 300);
        assert_eq!(config.auto_save.backup_count, 3);
        assert!(config.plc.hardware_topology.racks.is_empty());
        assert_eq!(config.modbus.exposure.mode, ModbusExposureMode::Recommended);
    }

    #[test]
    fn test_auto_save_settings_default() {
        let settings = AutoSaveSettings::default();
        assert!(settings.enabled);
        assert_eq!(settings.interval_secs, 300);
        assert_eq!(settings.backup_count, 3);
    }

    #[test]
    fn test_config_new() {
        let config = ProjectConfig::new("Test Project");
        assert_eq!(config.project.name, "Test Project");
    }

    #[test]
    fn test_yaml_roundtrip() {
        let config = ProjectConfig::new("Test Project");
        let yaml = serde_yaml::to_string(&config).unwrap();
        let parsed: ProjectConfig = serde_yaml::from_str(&yaml).unwrap();

        assert_eq!(parsed.version, config.version);
        assert_eq!(parsed.project.name, config.project.name);
        assert_eq!(parsed.plc.scan_time_ms, config.plc.scan_time_ms);
        assert_eq!(parsed.modbus.tcp.port, config.modbus.tcp.port);
        assert!(!yaml.contains("security_policy"));
        assert!(!yaml.contains("anonymous_access"));
    }

    #[test]
    fn test_opcua_legacy_security_fields_migrate_to_secure_defaults() {
        let yaml = r#"
enabled: true
port: 4840
server_name: Legacy OPC UA
security_policy: None
anonymous_access: true
username: legacy-user
password: legacy-pass
"#;

        let parsed: OpcUaSettings = serde_yaml::from_str(yaml).unwrap();

        assert!(parsed.enabled);
        assert_eq!(parsed.port, 4840);
        assert_eq!(parsed.server_name, "Legacy OPC UA");
        assert_eq!(parsed.username.as_deref(), Some("legacy-user"));
        assert_eq!(parsed.password.as_deref(), Some("legacy-pass"));
        assert!(parsed.legacy_insecure_policy_seen);
        assert!(parsed.legacy_anonymous_access_seen);
    }

    #[test]
    fn test_validation_empty_name() {
        let config = ProjectConfig::default();
        let result = config.validate();
        assert!(matches!(
            result,
            Err(ConfigValidationError::EmptyProjectName)
        ));
    }

    #[test]
    fn test_validation_success() {
        let config = ProjectConfig::new("Valid Project");
        let result = config.validate();
        assert!(result.is_ok());
    }

    #[test]
    fn test_topology_and_modbus_exposure_yaml_roundtrip() {
        let mut config = ProjectConfig::new("Topology Project");
        config.plc.hardware_topology.racks.push(PlcRackTopology {
            rack_id: "main".to_string(),
            rack_kind: PlcRackKind::MainBase,
            modules: vec![PlcHardwareModule {
                slot: 0,
                module_kind: PlcModuleKind::DigitalInput,
                model: "XBF-DI16".to_string(),
                point_count: Some(16),
                address_windows: vec![PlcAddressWindow {
                    family: "P".to_string(),
                    start: 0,
                    count: 16,
                    io_direction: Some(PlcIoDirection::Input),
                }],
            }],
        });
        config.modbus.exposure = ModbusExposureSettings {
            mode: ModbusExposureMode::Custom,
            rules: vec![ModbusExposureRule {
                family: "D".to_string(),
                address_space: ModbusExposureAddressSpace::HoldingRegister,
                offset: 0,
                count: 200,
            }],
        };

        let yaml = serde_yaml::to_string(&config).unwrap();
        let parsed: ProjectConfig = serde_yaml::from_str(&yaml).unwrap();

        assert_eq!(parsed.plc.hardware_topology.racks.len(), 1);
        assert_eq!(parsed.plc.hardware_topology.racks[0].modules[0].slot, 0);
        assert_eq!(parsed.modbus.exposure.mode, ModbusExposureMode::Custom);
        assert_eq!(parsed.modbus.exposure.rules[0].family, "D");
    }

    #[test]
    fn test_plc_manufacturer_from_str() {
        assert_eq!(
            "ls".parse::<PlcManufacturer>().unwrap(),
            PlcManufacturer::LS
        );
        assert_eq!(
            "Mitsubishi".parse::<PlcManufacturer>().unwrap(),
            PlcManufacturer::Mitsubishi
        );
        assert_eq!(
            "SIEMENS".parse::<PlcManufacturer>().unwrap(),
            PlcManufacturer::Siemens
        );
        assert!("Unknown".parse::<PlcManufacturer>().is_err());
    }

    #[test]
    fn test_plc_manufacturer_display() {
        assert_eq!(PlcManufacturer::LS.to_string(), "LS");
        assert_eq!(PlcManufacturer::Mitsubishi.to_string(), "Mitsubishi");
        assert_eq!(PlcManufacturer::Siemens.to_string(), "Siemens");
    }
}
