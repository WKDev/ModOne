//! Configuration validation module
//!
//! Provides comprehensive validation for project configuration values.

use super::config::{
    AutoSaveSettings, MemoryMapSettings, ModbusExposureMode, ModbusExposureSettings,
    ModbusRtuSettings, ModbusServerSimulationSettings, ModbusSimulationTransport,
    ModbusTcpSettings, NetworkSettings, OpcUaSettings, PlcHardwareTopology, ProjectConfig,
};
use crate::error::ModOneError;
use std::net::IpAddr;

/// Standard baud rates supported for serial communication
const STANDARD_BAUD_RATES: &[u32] = &[
    300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, 115200, 230400, 460800,
];

/// Minimum scan time in milliseconds
const MIN_SCAN_TIME_MS: u32 = 1;

/// Maximum scan time in milliseconds
const MAX_SCAN_TIME_MS: u32 = 10000;

/// Minimum auto-save interval in seconds
const MIN_AUTO_SAVE_INTERVAL_SECS: u64 = 30;

/// Maximum auto-save interval in seconds (24 hours)
const MAX_AUTO_SAVE_INTERVAL_SECS: u64 = 86400;

/// Maximum number of backup files
const MAX_BACKUP_COUNT: u32 = 100;

/// Collects multiple validation errors
#[derive(Debug, Default)]
pub struct ValidationResult {
    /// List of (field, message) pairs
    errors: Vec<(String, String)>,
}

impl ValidationResult {
    /// Create a new empty validation result
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if validation passed (no errors)
    pub fn is_valid(&self) -> bool {
        self.errors.is_empty()
    }

    /// Add a validation error
    pub fn add_error(&mut self, field: impl Into<String>, message: impl Into<String>) {
        self.errors.push((field.into(), message.into()));
    }

    /// Get all errors
    pub fn errors(&self) -> &[(String, String)] {
        &self.errors
    }

    /// Convert to ModOneError if there are validation errors
    pub fn to_error(&self) -> Option<ModOneError> {
        if self.errors.is_empty() {
            return None;
        }

        if self.errors.len() == 1 {
            let (field, message) = &self.errors[0];
            return Some(ModOneError::ConfigValidationError {
                field: field.clone(),
                message: message.clone(),
            });
        }

        // Multiple errors - combine into a single message
        let combined_message = self
            .errors
            .iter()
            .map(|(field, msg)| format!("{}: {}", field, msg))
            .collect::<Vec<_>>()
            .join("; ");

        Some(ModOneError::ConfigValidationError {
            field: "multiple".to_string(),
            message: combined_message,
        })
    }

    /// Convert to Result - Ok if valid, Err if any validation errors
    pub fn into_result(self) -> Result<(), ModOneError> {
        match self.to_error() {
            Some(err) => Err(err),
            None => Ok(()),
        }
    }
}

// ============================================================================
// Individual Validators
// ============================================================================

/// Validate a TCP/UDP port number
pub fn validate_port(port: u16, field: &str) -> Option<(String, String)> {
    if port == 0 {
        return Some((field.to_string(), "Port must be greater than 0".to_string()));
    }
    // Note: port is u16 so max is already 65535
    None
}

/// Validate a baud rate for serial communication
pub fn validate_baud_rate(rate: u32, field: &str) -> Option<(String, String)> {
    if rate == 0 {
        return Some((
            field.to_string(),
            "Baud rate must be greater than 0".to_string(),
        ));
    }

    if !STANDARD_BAUD_RATES.contains(&rate) {
        return Some((
            field.to_string(),
            format!(
                "Non-standard baud rate {}. Standard rates: {}",
                rate,
                STANDARD_BAUD_RATES
                    .iter()
                    .map(|r| r.to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
        ));
    }

    None
}

/// Validate a memory range (start + count must not overflow u16)
pub fn validate_memory_range(start: u16, count: u16, field: &str) -> Option<(String, String)> {
    if count == 0 {
        return Some((
            field.to_string(),
            "Count must be greater than 0".to_string(),
        ));
    }

    // Check for overflow: start + count > 65535
    if (start as u32) + (count as u32) > 65535 {
        return Some((
            field.to_string(),
            format!(
                "Memory range overflow: start ({}) + count ({}) exceeds maximum address 65535",
                start, count
            ),
        ));
    }

    None
}

/// Validate scan time in milliseconds
pub fn validate_scan_time(ms: u32, field: &str) -> Option<(String, String)> {
    if ms < MIN_SCAN_TIME_MS {
        return Some((
            field.to_string(),
            format!("Scan time must be at least {} ms", MIN_SCAN_TIME_MS),
        ));
    }

    if ms > MAX_SCAN_TIME_MS {
        return Some((
            field.to_string(),
            format!("Scan time must be at most {} ms", MAX_SCAN_TIME_MS),
        ));
    }

    None
}

/// Validate stop bits for serial communication
pub fn validate_stop_bits(bits: u8, field: &str) -> Option<(String, String)> {
    if bits != 1 && bits != 2 {
        return Some((
            field.to_string(),
            format!("Stop bits must be 1 or 2, got {}", bits),
        ));
    }

    None
}

/// Validate Modbus unit ID (slave address)
pub fn validate_unit_id(id: u8, field: &str) -> Option<(String, String)> {
    // Unit ID 0 is broadcast (write-only), 1-247 are valid slave addresses
    // 248-255 are reserved
    if id > 247 {
        return Some((
            field.to_string(),
            format!("Unit ID must be 0-247, got {}", id),
        ));
    }

    None
}

/// Validate auto-save interval
pub fn validate_auto_save_interval(secs: u64, field: &str) -> Option<(String, String)> {
    if secs < MIN_AUTO_SAVE_INTERVAL_SECS {
        return Some((
            field.to_string(),
            format!(
                "Auto-save interval must be at least {} seconds",
                MIN_AUTO_SAVE_INTERVAL_SECS
            ),
        ));
    }

    if secs > MAX_AUTO_SAVE_INTERVAL_SECS {
        return Some((
            field.to_string(),
            format!(
                "Auto-save interval must be at most {} seconds (24 hours)",
                MAX_AUTO_SAVE_INTERVAL_SECS
            ),
        ));
    }

    None
}

/// Validate backup count
pub fn validate_backup_count(count: u32, field: &str) -> Option<(String, String)> {
    if count > MAX_BACKUP_COUNT {
        return Some((
            field.to_string(),
            format!("Backup count must be at most {}", MAX_BACKUP_COUNT),
        ));
    }

    None
}

// ============================================================================
// Composite Validators
// ============================================================================

/// Validate TCP settings
pub fn validate_tcp_settings(settings: &ModbusTcpSettings, result: &mut ValidationResult) {
    if !settings.enabled {
        return;
    }

    if let Some((field, msg)) = validate_port(settings.port, "modbus.tcp.port") {
        result.add_error(field, msg);
    }

    if let Some((field, msg)) = validate_unit_id(settings.unit_id, "modbus.tcp.unit_id") {
        result.add_error(field, msg);
    }
}

/// Validate RTU settings
pub fn validate_rtu_settings(settings: &ModbusRtuSettings, result: &mut ValidationResult) {
    if !settings.enabled {
        return;
    }

    if settings.com_port.trim().is_empty() {
        result.add_error(
            "modbus.rtu.com_port",
            "COM port must not be empty when RTU is enabled",
        );
    }

    if let Some((field, msg)) = validate_baud_rate(settings.baud_rate, "modbus.rtu.baud_rate") {
        result.add_error(field, msg);
    }

    if let Some((field, msg)) = validate_stop_bits(settings.stop_bits, "modbus.rtu.stop_bits") {
        result.add_error(field, msg);
    }
}

/// Validate memory map settings
pub fn validate_memory_map(settings: &MemoryMapSettings, result: &mut ValidationResult) {
    if let Some((field, msg)) =
        validate_memory_range(settings.coil_start, settings.coil_count, "memory_map.coils")
    {
        result.add_error(field, msg);
    }

    if let Some((field, msg)) = validate_memory_range(
        settings.discrete_input_start,
        settings.discrete_input_count,
        "memory_map.discrete_inputs",
    ) {
        result.add_error(field, msg);
    }

    if let Some((field, msg)) = validate_memory_range(
        settings.holding_register_start,
        settings.holding_register_count,
        "memory_map.holding_registers",
    ) {
        result.add_error(field, msg);
    }

    if let Some((field, msg)) = validate_memory_range(
        settings.input_register_start,
        settings.input_register_count,
        "memory_map.input_registers",
    ) {
        result.add_error(field, msg);
    }
}

/// Validate auto-save settings
pub fn validate_auto_save(settings: &AutoSaveSettings, result: &mut ValidationResult) {
    if !settings.enabled {
        return;
    }

    if let Some((field, msg)) =
        validate_auto_save_interval(settings.interval_secs, "auto_save.interval_secs")
    {
        result.add_error(field, msg);
    }

    if let Some((field, msg)) =
        validate_backup_count(settings.backup_count, "auto_save.backup_count")
    {
        result.add_error(field, msg);
    }
}

/// Validate PLC hardware topology settings
pub fn validate_hardware_topology(settings: &PlcHardwareTopology, result: &mut ValidationResult) {
    for (rack_idx, rack) in settings.racks.iter().enumerate() {
        if rack.rack_id.trim().is_empty() {
            result.add_error(
                format!("plc.hardware_topology.racks[{rack_idx}].rack_id"),
                "Rack ID must not be empty",
            );
        }

        let mut seen_slots = std::collections::BTreeSet::new();
        for (module_idx, module) in rack.modules.iter().enumerate() {
            if !seen_slots.insert(module.slot) {
                result.add_error(
                    format!("plc.hardware_topology.racks[{rack_idx}].modules[{module_idx}].slot"),
                    format!("Duplicate slot {} in rack {}", module.slot, rack.rack_id),
                );
            }

            if matches!(module.point_count, Some(0)) {
                result.add_error(
                    format!(
                        "plc.hardware_topology.racks[{rack_idx}].modules[{module_idx}].point_count"
                    ),
                    "Point count must be greater than 0 when provided",
                );
            }

            for (window_idx, window) in module.address_windows.iter().enumerate() {
                if window.family.trim().is_empty() {
                    result.add_error(
                        format!("plc.hardware_topology.racks[{rack_idx}].modules[{module_idx}].address_windows[{window_idx}].family"),
                        "Address window family must not be empty",
                    );
                }

                if window.count == 0 {
                    result.add_error(
                        format!("plc.hardware_topology.racks[{rack_idx}].modules[{module_idx}].address_windows[{window_idx}].count"),
                        "Address window count must be greater than 0",
                    );
                }

                if window.io_direction.is_none() && window.family.eq_ignore_ascii_case("P") {
                    result.add_error(
                        format!("plc.hardware_topology.racks[{rack_idx}].modules[{module_idx}].address_windows[{window_idx}].io_direction"),
                        "Ambiguous P-address windows must declare io_direction",
                    );
                }
            }
        }
    }
}

/// Validate Modbus exposure settings
pub fn validate_modbus_exposure(settings: &ModbusExposureSettings, result: &mut ValidationResult) {
    if settings.mode != ModbusExposureMode::Custom {
        return;
    }

    if settings.rules.is_empty() {
        result.add_error(
            "modbus.exposure.rules",
            "Custom Modbus exposure mode requires at least one rule",
        );
        return;
    }

    for (idx, rule) in settings.rules.iter().enumerate() {
        if rule.family.trim().is_empty() {
            result.add_error(
                format!("modbus.exposure.rules[{idx}].family"),
                "Family must not be empty",
            );
        }

        if rule.count == 0 {
            result.add_error(
                format!("modbus.exposure.rules[{idx}].count"),
                "Count must be greater than 0",
            );
        }

        if rule.offset as u32 + rule.count as u32 > 65535 {
            result.add_error(
                format!("modbus.exposure.rules[{idx}].offset"),
                "Offset + count exceeds Modbus 16-bit address space",
            );
        }
    }
}

/// Validate project-level Modbus server simulation settings
pub fn validate_modbus_simulation(
    settings: &ModbusServerSimulationSettings,
    result: &mut ValidationResult,
) {
    if !settings.enabled {
        return;
    }

    if let Some((field, msg)) = validate_unit_id(settings.unit_id, "modbus.simulation.unit_id") {
        result.add_error(field, msg);
    }

    match settings.transport {
        ModbusSimulationTransport::Tcp | ModbusSimulationTransport::TcpAscii => {
            if settings.address.trim().is_empty() {
                result.add_error(
                    "modbus.simulation.address",
                    "Address must not be empty for TCP simulation",
                );
            }
        }
        ModbusSimulationTransport::Rtu | ModbusSimulationTransport::RtuAscii => {
            if settings.com_port.trim().is_empty() {
                result.add_error(
                    "modbus.simulation.com_port",
                    "COM port must not be empty for RTU simulation",
                );
            }

            if let Some((field, msg)) =
                validate_baud_rate(settings.baud_rate, "modbus.simulation.baud_rate")
            {
                result.add_error(field, msg);
            }

            if let Some((field, msg)) =
                validate_stop_bits(settings.stop_bits, "modbus.simulation.stop_bits")
            {
                result.add_error(field, msg);
            }
        }
    }
}

/// Validate OPC UA settings against the v1 security baseline.
pub fn validate_opcua_settings(
    settings: &OpcUaSettings,
    network: &NetworkSettings,
    result: &mut ValidationResult,
) {
    if !settings.enabled {
        return;
    }

    if let Some((field, msg)) = validate_port(settings.port, "opcua.port") {
        result.add_error(field, msg);
    }

    if settings.server_name.trim().is_empty() {
        result.add_error(
            "opcua.server_name",
            "Server name must not be empty when OPC UA is enabled",
        );
    }

    let username = settings
        .username
        .as_deref()
        .map(str::trim)
        .unwrap_or_default();
    if username.is_empty() {
        result.add_error(
            "opcua.username",
            "Username is required when OPC UA is enabled",
        );
    }

    let password = settings
        .password
        .as_deref()
        .map(str::trim)
        .unwrap_or_default();
    if password.is_empty() {
        result.add_error(
            "opcua.password",
            "Password is required when OPC UA is enabled",
        );
    }

    if username.eq_ignore_ascii_case("modone") && password == "modone" {
        result.add_error(
            "opcua.password",
            "Default OPC UA credentials are not allowed; choose a project-specific username and password",
        );
    }

    if let Some(plc_ip) = network
        .plc_ip
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        match plc_ip.parse::<IpAddr>() {
            Ok(ip) => {
                if ip.is_unspecified() {
                    result.add_error(
                        "network.plc_ip",
                        "PLC IP must not be an unspecified address",
                    );
                }
            }
            Err(_) => {
                result.add_error(
                    "network.plc_ip",
                    "PLC IP must be a valid IPv4 or IPv6 address",
                );
            }
        }
    }
}

// ============================================================================
// Main Validation Function
// ============================================================================

/// Validate an entire project configuration
///
/// Returns Ok(()) if the configuration is valid, or Err with details
/// about all validation failures.
pub fn validate_project_config(config: &ProjectConfig) -> Result<(), ModOneError> {
    let mut result = ValidationResult::new();

    // Validate project name
    if config.project.name.trim().is_empty() {
        result.add_error("project.name", "Project name cannot be empty");
    }

    // Validate scan time
    if let Some((field, msg)) = validate_scan_time(config.plc.scan_time_ms, "plc.scan_time_ms") {
        result.add_error(field, msg);
    }

    // Validate Modbus TCP settings
    validate_tcp_settings(&config.modbus.tcp, &mut result);

    // Validate Modbus RTU settings
    validate_rtu_settings(&config.modbus.rtu, &mut result);

    // Validate PLC topology
    validate_hardware_topology(&config.plc.hardware_topology, &mut result);

    // Validate Modbus exposure
    validate_modbus_exposure(&config.modbus.exposure, &mut result);

    // Validate Modbus simulation preferences
    validate_modbus_simulation(&config.modbus.simulation, &mut result);

    // Validate OPC UA preferences
    validate_opcua_settings(&config.opcua, &config.network, &mut result);

    // Validate memory map
    validate_memory_map(&config.memory_map, &mut result);

    // Validate auto-save settings
    validate_auto_save(&config.auto_save, &mut result);

    result.into_result()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::config::{
        ModbusExposureAddressSpace, ModbusExposureRule, Parity, PlcAddressWindow,
        PlcHardwareModule, PlcIoDirection, PlcModuleKind, PlcRackKind, PlcRackTopology,
    };

    #[test]
    fn test_validate_port() {
        assert!(validate_port(502, "tcp.port").is_none());
        assert!(validate_port(65535, "tcp.port").is_none());
        assert!(validate_port(1, "tcp.port").is_none());

        let err = validate_port(0, "tcp.port");
        assert!(err.is_some());
        assert!(err.unwrap().1.contains("greater than 0"));
    }

    #[test]
    fn test_validate_baud_rate() {
        assert!(validate_baud_rate(9600, "baud").is_none());
        assert!(validate_baud_rate(115200, "baud").is_none());

        let err = validate_baud_rate(0, "baud");
        assert!(err.is_some());

        let err = validate_baud_rate(12345, "baud");
        assert!(err.is_some());
        assert!(err.unwrap().1.contains("Non-standard"));
    }

    #[test]
    fn test_validate_memory_range() {
        assert!(validate_memory_range(0, 1000, "coils").is_none());
        assert!(validate_memory_range(65000, 535, "coils").is_none());

        // Overflow case
        let err = validate_memory_range(65000, 1000, "coils");
        assert!(err.is_some());
        assert!(err.unwrap().1.contains("overflow"));

        // Zero count
        let err = validate_memory_range(0, 0, "coils");
        assert!(err.is_some());
    }

    #[test]
    fn test_validate_scan_time() {
        assert!(validate_scan_time(10, "scan").is_none());
        assert!(validate_scan_time(1000, "scan").is_none());

        let err = validate_scan_time(0, "scan");
        assert!(err.is_some());

        let err = validate_scan_time(100000, "scan");
        assert!(err.is_some());
    }

    #[test]
    fn test_validate_stop_bits() {
        assert!(validate_stop_bits(1, "stop").is_none());
        assert!(validate_stop_bits(2, "stop").is_none());

        let err = validate_stop_bits(0, "stop");
        assert!(err.is_some());

        let err = validate_stop_bits(3, "stop");
        assert!(err.is_some());
    }

    #[test]
    fn test_validate_unit_id() {
        assert!(validate_unit_id(0, "unit").is_none());
        assert!(validate_unit_id(1, "unit").is_none());
        assert!(validate_unit_id(247, "unit").is_none());

        let err = validate_unit_id(248, "unit");
        assert!(err.is_some());
    }

    #[test]
    fn test_validation_result() {
        let mut result = ValidationResult::new();
        assert!(result.is_valid());

        result.add_error("field1", "error1");
        assert!(!result.is_valid());

        let err = result.to_error().unwrap();
        match err {
            ModOneError::ConfigValidationError { field, message } => {
                assert_eq!(field, "field1");
                assert_eq!(message, "error1");
            }
            _ => panic!("Expected ConfigValidationError"),
        }
    }

    #[test]
    fn test_validation_result_multiple_errors() {
        let mut result = ValidationResult::new();
        result.add_error("field1", "error1");
        result.add_error("field2", "error2");

        let err = result.to_error().unwrap();
        match err {
            ModOneError::ConfigValidationError { field, message } => {
                assert_eq!(field, "multiple");
                assert!(message.contains("field1"));
                assert!(message.contains("field2"));
            }
            _ => panic!("Expected ConfigValidationError"),
        }
    }

    #[test]
    fn test_validate_project_config_valid() {
        let config = ProjectConfig::new("Valid Project");
        let result = validate_project_config(&config);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_project_config_empty_name() {
        let mut config = ProjectConfig::new("Test");
        config.project.name = "  ".to_string();

        let result = validate_project_config(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_project_config_invalid_memory_map() {
        let mut config = ProjectConfig::new("Test");
        config.memory_map.coil_start = 65000;
        config.memory_map.coil_count = 1000;

        let result = validate_project_config(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_tcp_disabled() {
        let settings = ModbusTcpSettings {
            enabled: false,
            port: 0, // Invalid but ignored because disabled
            unit_id: 1,
        };
        let mut result = ValidationResult::new();
        validate_tcp_settings(&settings, &mut result);
        assert!(result.is_valid());
    }

    #[test]
    fn test_validate_rtu_settings() {
        let settings = ModbusRtuSettings {
            enabled: true,
            com_port: "COM1".to_string(),
            baud_rate: 9600,
            parity: Parity::None,
            stop_bits: 1,
        };
        let mut result = ValidationResult::new();
        validate_rtu_settings(&settings, &mut result);
        assert!(result.is_valid());
    }

    #[test]
    fn test_validate_rtu_empty_port() {
        let settings = ModbusRtuSettings {
            enabled: true,
            com_port: "".to_string(),
            baud_rate: 9600,
            parity: Parity::None,
            stop_bits: 1,
        };
        let mut result = ValidationResult::new();
        validate_rtu_settings(&settings, &mut result);
        assert!(!result.is_valid());
    }

    #[test]
    fn test_validate_auto_save() {
        let settings = AutoSaveSettings {
            enabled: true,
            interval_secs: 300,
            backup_count: 3,
        };
        let mut result = ValidationResult::new();
        validate_auto_save(&settings, &mut result);
        assert!(result.is_valid());
    }

    #[test]
    fn test_validate_auto_save_interval_too_short() {
        let settings = AutoSaveSettings {
            enabled: true,
            interval_secs: 10, // Too short
            backup_count: 3,
        };
        let mut result = ValidationResult::new();
        validate_auto_save(&settings, &mut result);
        assert!(!result.is_valid());
    }

    #[test]
    fn test_validate_hardware_topology_rejects_ambiguous_p_window() {
        let topology = PlcHardwareTopology {
            racks: vec![PlcRackTopology {
                rack_id: "main".to_string(),
                rack_kind: PlcRackKind::MainBase,
                modules: vec![PlcHardwareModule {
                    slot: 0,
                    module_kind: PlcModuleKind::DigitalIo,
                    model: "XBF-DI16DO16".to_string(),
                    point_count: Some(32),
                    address_windows: vec![PlcAddressWindow {
                        family: "P".to_string(),
                        start: 0,
                        count: 16,
                        io_direction: None,
                    }],
                }],
            }],
        };

        let mut result = ValidationResult::new();
        validate_hardware_topology(&topology, &mut result);
        assert!(!result.is_valid());
    }

    #[test]
    fn test_validate_hardware_topology_accepts_explicit_window_direction() {
        let topology = PlcHardwareTopology {
            racks: vec![PlcRackTopology {
                rack_id: "main".to_string(),
                rack_kind: PlcRackKind::MainBase,
                modules: vec![PlcHardwareModule {
                    slot: 0,
                    module_kind: PlcModuleKind::DigitalOutput,
                    model: "QY42P".to_string(),
                    point_count: Some(16),
                    address_windows: vec![PlcAddressWindow {
                        family: "Y".to_string(),
                        start: 0,
                        count: 16,
                        io_direction: Some(PlcIoDirection::Output),
                    }],
                }],
            }],
        };

        let mut result = ValidationResult::new();
        validate_hardware_topology(&topology, &mut result);
        assert!(result.is_valid());
    }

    #[test]
    fn test_validate_custom_modbus_exposure_requires_rules() {
        let mut result = ValidationResult::new();
        validate_modbus_exposure(
            &ModbusExposureSettings {
                mode: ModbusExposureMode::Custom,
                rules: vec![],
            },
            &mut result,
        );
        assert!(!result.is_valid());
    }

    #[test]
    fn test_validate_custom_modbus_exposure_rule_range() {
        let mut result = ValidationResult::new();
        validate_modbus_exposure(
            &ModbusExposureSettings {
                mode: ModbusExposureMode::Custom,
                rules: vec![ModbusExposureRule {
                    family: "D".to_string(),
                    address_space: ModbusExposureAddressSpace::HoldingRegister,
                    offset: 65530,
                    count: 10,
                }],
            },
            &mut result,
        );
        assert!(!result.is_valid());
    }

    #[test]
    fn test_validate_opcua_requires_credentials_when_enabled() {
        let settings = OpcUaSettings {
            enabled: true,
            username: None,
            password: None,
            ..OpcUaSettings::default()
        };
        let mut result = ValidationResult::new();

        validate_opcua_settings(&settings, &NetworkSettings::default(), &mut result);

        assert!(!result.is_valid());
        let errors = result.errors();
        assert!(errors.iter().any(|(field, _)| field == "opcua.username"));
        assert!(errors.iter().any(|(field, _)| field == "opcua.password"));
    }

    #[test]
    fn test_validate_opcua_rejects_default_credentials() {
        let settings = OpcUaSettings {
            enabled: true,
            username: Some("modone".to_string()),
            password: Some("modone".to_string()),
            ..OpcUaSettings::default()
        };
        let mut result = ValidationResult::new();

        validate_opcua_settings(&settings, &NetworkSettings::default(), &mut result);

        assert!(!result.is_valid());
        assert!(result
            .errors()
            .iter()
            .any(|(field, message)| field == "opcua.password"
                && message.contains("Default OPC UA credentials")));
    }

    #[test]
    fn test_validate_opcua_rejects_invalid_network_bind_address() {
        let settings = OpcUaSettings {
            enabled: true,
            username: Some("user".to_string()),
            password: Some("secret".to_string()),
            ..OpcUaSettings::default()
        };
        let network = NetworkSettings {
            plc_ip: Some("not-an-ip".to_string()),
            interface_name: None,
            subnet_mask: None,
        };
        let mut result = ValidationResult::new();

        validate_opcua_settings(&settings, &network, &mut result);

        assert!(!result.is_valid());
        assert!(result
            .errors()
            .iter()
            .any(|(field, message)| field == "network.plc_ip"
                && message.contains("valid IP address")));
    }
}
