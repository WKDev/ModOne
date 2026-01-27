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
}

impl Default for PlcSettings {
    fn default() -> Self {
        Self {
            manufacturer: PlcManufacturer::default(),
            model: String::new(),
            scan_time_ms: 10,
        }
    }
}

/// Modbus communication settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusSettings {
    /// TCP server settings
    pub tcp: ModbusTcpSettings,

    /// RTU settings
    pub rtu: ModbusRtuSettings,
}

impl Default for ModbusSettings {
    fn default() -> Self {
        Self {
            tcp: ModbusTcpSettings::default(),
            rtu: ModbusRtuSettings::default(),
        }
    }
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
