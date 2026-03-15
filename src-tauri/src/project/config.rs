//! Project configuration types and YAML schema
//!
//! Defines the structure for config.yml files in project packages.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpcUaSettings {
    /// Whether the OPC UA server is enabled during simulation.
    pub enabled: bool,
    /// TCP port for the OPC UA server.
    pub port: u16,
    /// Display name for the OPC UA server.
    pub server_name: String,
    /// Security policy.
    pub security_policy: OpcUaSecurityPolicySetting,
    /// Allow anonymous access.
    pub anonymous_access: bool,
    /// Optional username for UA user/password authentication.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    /// Optional password for UA user/password authentication.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
}

impl Default for OpcUaSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            port: 4840,
            server_name: "ModOne PLC Simulator".to_string(),
            security_policy: OpcUaSecurityPolicySetting::Basic256Sha256,
            anonymous_access: false,
            username: Some("modone".to_string()),
            password: Some("modone".to_string()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OpcUaSecurityPolicySetting {
    None,
    Basic256Sha256,
}

impl Default for OpcUaSecurityPolicySetting {
    fn default() -> Self {
        Self::Basic256Sha256
    }
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

/// PLC manufacturer enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlcManufacturer {
    LS,
    Mitsubishi,
    Siemens,
}

impl Default for PlcManufacturer {
    fn default() -> Self {
        Self::LS
    }
}

impl std::fmt::Display for PlcManufacturer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PlcManufacturer::LS => write!(f, "LS"),
            PlcManufacturer::Mitsubishi => write!(f, "Mitsubishi"),
            PlcManufacturer::Siemens => write!(f, "Siemens"),
        }
    }
}

impl std::str::FromStr for PlcManufacturer {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "ls" => Ok(PlcManufacturer::LS),
            "mitsubishi" => Ok(PlcManufacturer::Mitsubishi),
            "siemens" => Ok(PlcManufacturer::Siemens),
            _ => Err(format!("Unknown PLC manufacturer: {}", s)),
        }
    }
}

/// PLC configuration settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlcSettings {
    /// PLC manufacturer
    pub manufacturer: PlcManufacturer,

    /// PLC model name
    pub model: String,

    /// Scan time in milliseconds
    pub scan_time_ms: u32,

    /// Hardware topology for rack/base/module oriented PLC families.
    #[serde(default)]
    pub hardware_topology: PlcHardwareTopology,
}

impl Default for PlcSettings {
    fn default() -> Self {
        Self {
            manufacturer: PlcManufacturer::default(),
            model: String::new(),
            scan_time_ms: 10,
            hardware_topology: PlcHardwareTopology::default(),
        }
    }
}

/// Generic PLC hardware topology shared across vendor profiles.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PlcHardwareTopology {
    /// Rack/base definitions in installation order.
    #[serde(default)]
    pub racks: Vec<PlcRackTopology>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlcRackTopology {
    /// Stable rack/base identifier within the project.
    pub rack_id: String,
    /// Rack role in the hardware layout.
    #[serde(default)]
    pub rack_kind: PlcRackKind,
    /// Installed modules on this rack/base.
    #[serde(default)]
    pub modules: Vec<PlcHardwareModule>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlcRackKind {
    MainBase,
    ExpansionBase,
    RemoteBase,
}

impl Default for PlcRackKind {
    fn default() -> Self {
        Self::MainBase
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlcHardwareModule {
    /// Slot number within the rack/base.
    pub slot: u16,
    /// Hardware role.
    pub module_kind: PlcModuleKind,
    /// Vendor model identifier.
    #[serde(default)]
    pub model: String,
    /// Optional channel/point count for the module.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub point_count: Option<u16>,
    /// Address windows exposed by this module in vendor notation.
    #[serde(default)]
    pub address_windows: Vec<PlcAddressWindow>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlcModuleKind {
    Power,
    Cpu,
    DigitalInput,
    DigitalOutput,
    DigitalIo,
    AnalogInput,
    AnalogOutput,
    AnalogIo,
    Communication,
    Special,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlcAddressWindow {
    /// Vendor family name such as `P`, `X`, `Y`, or `D`.
    pub family: String,
    /// Start index within the family.
    pub start: u32,
    /// Number of points/words in the window.
    pub count: u32,
    /// Optional I/O direction for ambiguous vendor families.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub io_direction: Option<PlcIoDirection>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlcIoDirection {
    Input,
    Output,
    Bidirectional,
}

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
    }

    #[test]
    fn test_validation_empty_name() {
        let config = ProjectConfig::default();
        let result = config.validate();
        assert!(matches!(result, Err(ConfigValidationError::EmptyProjectName)));
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
        assert_eq!("ls".parse::<PlcManufacturer>().unwrap(), PlcManufacturer::LS);
        assert_eq!("Mitsubishi".parse::<PlcManufacturer>().unwrap(), PlcManufacturer::Mitsubishi);
        assert_eq!("SIEMENS".parse::<PlcManufacturer>().unwrap(), PlcManufacturer::Siemens);
        assert!("Unknown".parse::<PlcManufacturer>().is_err());
    }

    #[test]
    fn test_plc_manufacturer_display() {
        assert_eq!(PlcManufacturer::LS.to_string(), "LS");
        assert_eq!(PlcManufacturer::Mitsubishi.to_string(), "Mitsubishi");
        assert_eq!(PlcManufacturer::Siemens.to_string(), "Siemens");
    }
}
