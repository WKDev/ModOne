//! Modbus Address Mapper
//!
//! Converts LS PLC device addresses to Modbus addresses according to the
//! defined mapping rules. This mapping aligns with the modserver_sync
//! module for consistent address translation.

use super::types::{BitDeviceType, DeviceAddress, DeviceType, ModbusAddress, ModbusAddressType, WordDeviceType};
use std::collections::HashMap;

// ============================================================================
// Address Mapping Constants (matching modserver_sync.rs)
// ============================================================================

/// M relay → Coil offset (8192 M relays at offset 0)
pub const M_COIL_OFFSET: u16 = 0;
/// K relay → Coil offset (2048 K relays at offset 8192)
pub const K_COIL_OFFSET: u16 = 8192;
/// T contact → Coil offset (2048 T contacts at offset 10240)
pub const T_COIL_OFFSET: u16 = 10240;
/// C contact → Coil offset (2048 C contacts at offset 12288)
pub const C_COIL_OFFSET: u16 = 12288;

/// P relay → Discrete Input offset
pub const P_DISCRETE_OFFSET: u16 = 0;
/// F relay → Discrete Input offset
pub const F_DISCRETE_OFFSET: u16 = 2048;

/// D register → Holding Register offset
pub const D_HR_OFFSET: u16 = 0;
/// R register → Holding Register offset
pub const R_HR_OFFSET: u16 = 10000;
/// Z register → Holding Register offset
pub const Z_HR_OFFSET: u16 = 20000;
/// N register → Holding Register offset
pub const N_HR_OFFSET: u16 = 20016;

/// TD (Timer Current Value) → Holding Register offset
pub const TD_HR_OFFSET: u16 = 28208;
/// CD (Counter Current Value) → Holding Register offset
pub const CD_HR_OFFSET: u16 = 30256;

// ============================================================================
// Mapping Rule Structure
// ============================================================================

/// Device to Modbus mapping rule
#[derive(Debug, Clone)]
pub struct MappingRule {
    /// PLC device type
    pub device: DeviceType,
    /// Modbus memory type to map to
    pub modbus_type: ModbusAddressType,
    /// Address offset for mapping
    pub offset: u16,
}

impl MappingRule {
    /// Get default mapping rules for LS PLC devices (matching modserver_sync.rs)
    pub fn defaults() -> Vec<Self> {
        vec![
            // Bit devices to Coils/Discrete
            MappingRule {
                device: DeviceType::Bit(BitDeviceType::P),
                modbus_type: ModbusAddressType::Discrete,
                offset: P_DISCRETE_OFFSET,
            },
            MappingRule {
                device: DeviceType::Bit(BitDeviceType::M),
                modbus_type: ModbusAddressType::Coil,
                offset: M_COIL_OFFSET,
            },
            MappingRule {
                device: DeviceType::Bit(BitDeviceType::K),
                modbus_type: ModbusAddressType::Coil,
                offset: K_COIL_OFFSET,
            },
            MappingRule {
                device: DeviceType::Bit(BitDeviceType::T),
                modbus_type: ModbusAddressType::Coil,
                offset: T_COIL_OFFSET,
            },
            MappingRule {
                device: DeviceType::Bit(BitDeviceType::C),
                modbus_type: ModbusAddressType::Coil,
                offset: C_COIL_OFFSET,
            },
            MappingRule {
                device: DeviceType::Bit(BitDeviceType::F),
                modbus_type: ModbusAddressType::Discrete,
                offset: F_DISCRETE_OFFSET,
            },
            // Word devices to Holding Registers
            MappingRule {
                device: DeviceType::Word(WordDeviceType::D),
                modbus_type: ModbusAddressType::Holding,
                offset: D_HR_OFFSET,
            },
            MappingRule {
                device: DeviceType::Word(WordDeviceType::R),
                modbus_type: ModbusAddressType::Holding,
                offset: R_HR_OFFSET,
            },
            MappingRule {
                device: DeviceType::Word(WordDeviceType::Z),
                modbus_type: ModbusAddressType::Holding,
                offset: Z_HR_OFFSET,
            },
            MappingRule {
                device: DeviceType::Word(WordDeviceType::N),
                modbus_type: ModbusAddressType::Holding,
                offset: N_HR_OFFSET,
            },
        ]
    }
}

// ============================================================================
// Modbus Mapper
// ============================================================================

/// Modbus Address Mapper
///
/// Provides bidirectional mapping between LS PLC device addresses and
/// Modbus addresses according to configurable mapping rules.
pub struct ModbusMapper {
    rules: HashMap<String, MappingRule>,
}

impl Default for ModbusMapper {
    fn default() -> Self {
        Self::new()
    }
}

impl ModbusMapper {
    /// Create a new ModbusMapper with default rules
    pub fn new() -> Self {
        let mut rules = HashMap::new();
        for rule in MappingRule::defaults() {
            rules.insert(rule.device.as_str().to_string(), rule);
        }
        Self { rules }
    }

    /// Create a ModbusMapper with custom rules
    pub fn with_rules(custom_rules: Vec<MappingRule>) -> Self {
        let mut mapper = Self::new();
        for rule in custom_rules {
            mapper.rules.insert(rule.device.as_str().to_string(), rule);
        }
        mapper
    }

    /// Map device address to Modbus address
    pub fn map_to_modbus(&self, device_addr: &DeviceAddress) -> Option<ModbusAddress> {
        // Cannot map indexed addresses statically
        if device_addr.index_register.is_some() {
            log::warn!(
                "Indexed address {}[Z{}] cannot be mapped statically",
                device_addr.device.as_str(),
                device_addr.index_register.unwrap()
            );
            return None;
        }

        let rule = self.rules.get(device_addr.device.as_str())?;

        // Handle bit access on word devices
        if let Some(bit_index) = device_addr.bit_index {
            if device_addr.device.is_word_device() {
                // Word device bit access maps to coil area
                // Address = (rule.offset + word_address) * 16 + bit_index
                let word_offset = rule.offset as u32 + device_addr.address;
                return Some(ModbusAddress {
                    address_type: ModbusAddressType::Coil,
                    address: (word_offset * 16 + bit_index as u32) as u16,
                });
            }
        }

        Some(ModbusAddress {
            address_type: rule.modbus_type,
            address: rule.offset + device_addr.address as u16,
        })
    }

    /// Map Modbus address back to device address(es)
    ///
    /// Returns multiple matches for overlapping ranges.
    pub fn map_from_modbus(&self, modbus_addr: &ModbusAddress) -> Vec<DeviceAddress> {
        let mut matches = Vec::new();

        for rule in self.rules.values() {
            if rule.modbus_type == modbus_addr.address_type {
                if modbus_addr.address >= rule.offset {
                    let device_address = modbus_addr.address - rule.offset;
                    matches.push(DeviceAddress::new(rule.device, device_address as u32));
                }
            }
        }

        matches
    }

    /// Map timer current value address (TD) to Modbus
    pub fn map_timer_data_to_modbus(&self, timer_number: u16) -> ModbusAddress {
        ModbusAddress {
            address_type: ModbusAddressType::Holding,
            address: TD_HR_OFFSET + timer_number,
        }
    }

    /// Map counter current value address (CD) to Modbus
    pub fn map_counter_data_to_modbus(&self, counter_number: u16) -> ModbusAddress {
        ModbusAddress {
            address_type: ModbusAddressType::Holding,
            address: CD_HR_OFFSET + counter_number,
        }
    }

    /// Check if a device address is read-only
    pub fn is_read_only(&self, device_addr: &DeviceAddress) -> bool {
        match device_addr.device {
            DeviceType::Bit(BitDeviceType::F)
            | DeviceType::Bit(BitDeviceType::T)
            | DeviceType::Bit(BitDeviceType::C) => true,
            _ => false,
        }
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/// Format Modbus address for display
pub fn format_modbus_address(addr: &ModbusAddress) -> String {
    let prefix = match addr.address_type {
        ModbusAddressType::Coil => "C",
        ModbusAddressType::Discrete => "DI",
        ModbusAddressType::Holding => "HR",
        ModbusAddressType::Input => "IR",
    };
    format!("{}:{}", prefix, addr.address)
}

/// Parse Modbus address string
pub fn parse_modbus_address(s: &str) -> Option<ModbusAddress> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 2 {
        return None;
    }

    let address_type = match parts[0].to_uppercase().as_str() {
        "C" => ModbusAddressType::Coil,
        "DI" => ModbusAddressType::Discrete,
        "HR" => ModbusAddressType::Holding,
        "IR" => ModbusAddressType::Input,
        _ => return None,
    };

    let address: u16 = parts[1].parse().ok()?;

    Some(ModbusAddress {
        address_type,
        address,
    })
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_m_to_coil() {
        let mapper = ModbusMapper::new();
        let addr = DeviceAddress::bit(BitDeviceType::M, 100);
        let result = mapper.map_to_modbus(&addr);

        assert_eq!(
            result,
            Some(ModbusAddress {
                address_type: ModbusAddressType::Coil,
                address: 100
            })
        );
    }

    #[test]
    fn test_map_k_to_coil_with_offset() {
        let mapper = ModbusMapper::new();
        let addr = DeviceAddress::bit(BitDeviceType::K, 0);
        let result = mapper.map_to_modbus(&addr);

        assert_eq!(
            result,
            Some(ModbusAddress {
                address_type: ModbusAddressType::Coil,
                address: 8192
            })
        );
    }

    #[test]
    fn test_map_d_to_holding() {
        let mapper = ModbusMapper::new();
        let addr = DeviceAddress::word(WordDeviceType::D, 100);
        let result = mapper.map_to_modbus(&addr);

        assert_eq!(
            result,
            Some(ModbusAddress {
                address_type: ModbusAddressType::Holding,
                address: 100
            })
        );
    }

    #[test]
    fn test_map_word_bit_to_coil() {
        let mapper = ModbusMapper::new();
        let addr = DeviceAddress::word_bit(WordDeviceType::D, 1, 5);
        let result = mapper.map_to_modbus(&addr);

        // (0 + 1) * 16 + 5 = 21
        assert_eq!(
            result,
            Some(ModbusAddress {
                address_type: ModbusAddressType::Coil,
                address: 21
            })
        );
    }

    #[test]
    fn test_map_timer_data() {
        let mapper = ModbusMapper::new();
        let result = mapper.map_timer_data_to_modbus(0);

        assert_eq!(
            result,
            ModbusAddress {
                address_type: ModbusAddressType::Holding,
                address: 28208
            }
        );
    }

    #[test]
    fn test_map_counter_data() {
        let mapper = ModbusMapper::new();
        let result = mapper.map_counter_data_to_modbus(100);

        assert_eq!(
            result,
            ModbusAddress {
                address_type: ModbusAddressType::Holding,
                address: 30356
            }
        );
    }

    #[test]
    fn test_format_modbus_address() {
        let addr = ModbusAddress {
            address_type: ModbusAddressType::Holding,
            address: 1000,
        };
        assert_eq!(format_modbus_address(&addr), "HR:1000");
    }

    #[test]
    fn test_parse_modbus_address() {
        let result = parse_modbus_address("HR:1000");
        assert_eq!(
            result,
            Some(ModbusAddress {
                address_type: ModbusAddressType::Holding,
                address: 1000
            })
        );

        assert_eq!(parse_modbus_address("INVALID"), None);
    }

    #[test]
    fn test_is_read_only() {
        let mapper = ModbusMapper::new();
        assert!(mapper.is_read_only(&DeviceAddress::bit(BitDeviceType::F, 0)));
        assert!(mapper.is_read_only(&DeviceAddress::bit(BitDeviceType::T, 0)));
        assert!(mapper.is_read_only(&DeviceAddress::bit(BitDeviceType::C, 0)));
        assert!(!mapper.is_read_only(&DeviceAddress::bit(BitDeviceType::M, 0)));
        assert!(!mapper.is_read_only(&DeviceAddress::word(WordDeviceType::D, 0)));
    }
}
