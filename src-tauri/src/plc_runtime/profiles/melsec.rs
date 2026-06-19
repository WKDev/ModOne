use crate::project::{PlcHardwareTopology, PlcManufacturer};

use super::super::{
    profile::{
        format_vendor_address, split_vendor_address, ModbusAddressSpace, ModbusMappingPolicy,
        ModbusMappingRule, ModbusMappingSource, OpcUaAliasPolicy, VendorAddress,
        VendorAddressMetadata, VendorAddressNumberBase, VendorDataKind, VendorProfile,
        VendorProfileError, VendorProfileId,
    },
    types::{CanonicalAddress, CanonicalAreaKind},
};

const MELSEC_FAMILIES: [&str; 7] = ["X", "Y", "M", "L", "T", "C", "D"];

#[derive(Debug, Clone)]
pub struct MelsecFxQProfile {
    model: String,
    io_number_base: VendorAddressNumberBase,
    hardware_topology: PlcHardwareTopology,
}

impl MelsecFxQProfile {
    pub fn new(model: String, hardware_topology: PlcHardwareTopology) -> Self {
        let lowered = model.to_ascii_lowercase();
        let io_number_base = if lowered.contains('q') {
            VendorAddressNumberBase::Hexadecimal
        } else {
            VendorAddressNumberBase::Octal
        };

        Self {
            model,
            io_number_base,
            hardware_topology,
        }
    }

    fn metadata_for(&self, family: &str) -> Result<VendorAddressMetadata, VendorProfileError> {
        let metadata = match family {
            "X" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::InputBit,
                access: CanonicalAreaKind::InputBit.default_access(),
                retained: false,
                data_kind: VendorDataKind::Bit,
                supports_bit_index: false,
                max_index: 0x7FFF,
                number_base: self.io_number_base,
            },
            "Y" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::OutputBit,
                access: CanonicalAreaKind::OutputBit.default_access(),
                retained: false,
                data_kind: VendorDataKind::Bit,
                supports_bit_index: false,
                max_index: 0x7FFF,
                number_base: self.io_number_base,
            },
            "M" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::InternalBit,
                access: CanonicalAreaKind::InternalBit.default_access(),
                retained: false,
                data_kind: VendorDataKind::Bit,
                supports_bit_index: false,
                max_index: 8191,
                number_base: VendorAddressNumberBase::Decimal,
            },
            "L" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::RetentiveBit,
                access: CanonicalAreaKind::RetentiveBit.default_access(),
                retained: true,
                data_kind: VendorDataKind::Bit,
                supports_bit_index: false,
                max_index: 8191,
                number_base: VendorAddressNumberBase::Decimal,
            },
            "T" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::TimerDoneBit,
                access: CanonicalAreaKind::TimerDoneBit.default_access(),
                retained: false,
                data_kind: VendorDataKind::Bit,
                supports_bit_index: false,
                max_index: 2047,
                number_base: VendorAddressNumberBase::Decimal,
            },
            "C" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::CounterDoneBit,
                access: CanonicalAreaKind::CounterDoneBit.default_access(),
                retained: false,
                data_kind: VendorDataKind::Bit,
                supports_bit_index: false,
                max_index: 2047,
                number_base: VendorAddressNumberBase::Decimal,
            },
            "D" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::DataWord,
                access: CanonicalAreaKind::DataWord.default_access(),
                retained: false,
                data_kind: VendorDataKind::Word,
                supports_bit_index: true,
                max_index: 9999,
                number_base: VendorAddressNumberBase::Decimal,
            },
            _ => {
                return Err(VendorProfileError::UnsupportedFamily {
                    profile_id: VendorProfileId::MelsecFxQCommon,
                    family: family.to_string(),
                });
            }
        };

        Ok(metadata)
    }
}

impl VendorProfile for MelsecFxQProfile {
    fn id(&self) -> VendorProfileId {
        VendorProfileId::MelsecFxQCommon
    }

    fn display_name(&self) -> &'static str {
        "MELSEC FX/Q Common-Core Profile"
    }

    fn manufacturer(&self) -> PlcManufacturer {
        PlcManufacturer::Mitsubishi
    }

    fn hardware_topology(&self) -> &PlcHardwareTopology {
        &self.hardware_topology
    }

    fn model_hint(&self) -> Option<&str> {
        if self.model.is_empty() {
            None
        } else {
            Some(&self.model)
        }
    }

    fn parse_address(&self, input: &str) -> Result<VendorAddress, VendorProfileError> {
        let (family, number_part, bit_index, index_register) =
            split_vendor_address(input, &MELSEC_FAMILIES)?;
        let metadata = self.metadata_for(&family)?;
        let index = metadata.number_base.parse(&number_part)?;

        let mut address = VendorAddress::new(family, index);
        if let Some(bit_index) = bit_index {
            address = address.with_bit_index(bit_index);
        }
        if let Some(index_register) = index_register {
            address = address.with_index_register(index_register);
        }

        self.validate_address(&address)?;
        Ok(address)
    }

    fn format_address(&self, address: &VendorAddress) -> Result<String, VendorProfileError> {
        let metadata = self.validate_address(address)?;
        Ok(format_vendor_address(address, metadata.number_base, 1))
    }

    fn validate_address(
        &self,
        address: &VendorAddress,
    ) -> Result<VendorAddressMetadata, VendorProfileError> {
        let metadata = self.metadata_for(&address.family)?;

        if address.index > metadata.max_index {
            return Err(VendorProfileError::AddressOutOfRange {
                profile_id: self.id(),
                family: address.family.clone(),
                index: address.index,
                max_index: metadata.max_index,
            });
        }

        if let Some(bit_index) = address.bit_index {
            if !metadata.supports_bit_index {
                return Err(VendorProfileError::BitIndexNotSupported {
                    profile_id: self.id(),
                    family: address.family.clone(),
                });
            }
            if bit_index >= 16 {
                return Err(VendorProfileError::BitIndexOutOfRange { bit_index });
            }
        }

        if address.index_register.is_some() {
            return Err(VendorProfileError::IndexedAddressNotSupported {
                profile_id: self.id(),
                family: address.family.clone(),
            });
        }

        Ok(metadata)
    }

    fn to_canonical(
        &self,
        address: &VendorAddress,
    ) -> Result<CanonicalAddress, VendorProfileError> {
        let metadata = self.validate_address(address)?;

        let mut canonical = CanonicalAddress::new(metadata.canonical_area, address.index);
        canonical.bit_index = address.bit_index;
        Ok(canonical)
    }

    fn canonical_aliases(&self, canonical: &CanonicalAddress) -> Vec<VendorAddress> {
        let family = match canonical.area {
            CanonicalAreaKind::InputBit => Some("X"),
            CanonicalAreaKind::OutputBit => Some("Y"),
            CanonicalAreaKind::InternalBit => Some("M"),
            CanonicalAreaKind::RetentiveBit => Some("L"),
            CanonicalAreaKind::TimerDoneBit => Some("T"),
            CanonicalAreaKind::CounterDoneBit => Some("C"),
            CanonicalAreaKind::DataWord => Some("D"),
            CanonicalAreaKind::SpecialBit
            | CanonicalAreaKind::RetentiveWord
            | CanonicalAreaKind::IndexWord
            | CanonicalAreaKind::TimerValueWord
            | CanonicalAreaKind::CounterValueWord
            | CanonicalAreaKind::SystemBit
            | CanonicalAreaKind::SystemWord => None,
        };

        family
            .map(|family| VendorAddress {
                family: family.to_string(),
                index: canonical.index,
                bit_index: canonical.bit_index,
                index_register: None,
            })
            .into_iter()
            .collect()
    }

    fn recommended_modbus_mapping_policy(&self) -> ModbusMappingPolicy {
        ModbusMappingPolicy {
            profile_id: self.id(),
            source: ModbusMappingSource::Recommended,
            rules: vec![
                ModbusMappingRule {
                    family: "Y".to_string(),
                    canonical_area: CanonicalAreaKind::OutputBit,
                    address_space: ModbusAddressSpace::Coil,
                    offset: 0,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "X".to_string(),
                    canonical_area: CanonicalAreaKind::InputBit,
                    address_space: ModbusAddressSpace::DiscreteInput,
                    offset: 0,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "D".to_string(),
                    canonical_area: CanonicalAreaKind::DataWord,
                    address_space: ModbusAddressSpace::HoldingRegister,
                    offset: 0,
                    count: 10000,
                },
            ],
        }
    }

    fn legacy_modbus_mapping_policy(&self) -> ModbusMappingPolicy {
        ModbusMappingPolicy {
            profile_id: self.id(),
            source: ModbusMappingSource::LegacyWide,
            rules: vec![
                ModbusMappingRule {
                    family: "X".to_string(),
                    canonical_area: CanonicalAreaKind::InputBit,
                    address_space: ModbusAddressSpace::DiscreteInput,
                    offset: 0,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "Y".to_string(),
                    canonical_area: CanonicalAreaKind::OutputBit,
                    address_space: ModbusAddressSpace::Coil,
                    offset: 0,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "M".to_string(),
                    canonical_area: CanonicalAreaKind::InternalBit,
                    address_space: ModbusAddressSpace::Coil,
                    offset: 2048,
                    count: 8192,
                },
                ModbusMappingRule {
                    family: "L".to_string(),
                    canonical_area: CanonicalAreaKind::RetentiveBit,
                    address_space: ModbusAddressSpace::Coil,
                    offset: 10240,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "T".to_string(),
                    canonical_area: CanonicalAreaKind::TimerDoneBit,
                    address_space: ModbusAddressSpace::DiscreteInput,
                    offset: 2048,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "C".to_string(),
                    canonical_area: CanonicalAreaKind::CounterDoneBit,
                    address_space: ModbusAddressSpace::DiscreteInput,
                    offset: 4096,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "D".to_string(),
                    canonical_area: CanonicalAreaKind::DataWord,
                    address_space: ModbusAddressSpace::HoldingRegister,
                    offset: 0,
                    count: 10000,
                },
            ],
        }
    }

    fn opcua_alias_policy(&self) -> OpcUaAliasPolicy {
        OpcUaAliasPolicy {
            expose_vendor_aliases: true,
            namespace_segment: "MELSEC".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_fx_addresses_with_octal_io() {
        let profile = MelsecFxQProfile::new("FX5U".to_string(), PlcHardwareTopology::default());

        let x = profile
            .parse_address("X17")
            .expect("X address should parse");
        assert_eq!(x.index, 0o17);
        assert_eq!(profile.format_address(&x).unwrap(), "X17");

        let d = profile.parse_address("D100.3").expect("D bit should parse");
        assert_eq!(d.bit_index, Some(3));
        assert_eq!(
            profile.to_canonical(&d).unwrap().area,
            CanonicalAreaKind::DataWord
        );
    }

    #[test]
    fn parses_q_addresses_with_hex_io() {
        let profile = MelsecFxQProfile::new("Q03UDE".to_string(), PlcHardwareTopology::default());

        let y = profile
            .parse_address("Y1F")
            .expect("Y address should parse");
        assert_eq!(y.index, 0x1F);
        assert_eq!(profile.format_address(&y).unwrap(), "Y1F");
    }

    #[test]
    fn rejects_unsupported_melsec_family() {
        let profile = MelsecFxQProfile::new(String::new(), PlcHardwareTopology::default());
        let error = profile
            .parse_address("R100")
            .expect_err("R should be out of scope");

        assert!(matches!(
            error,
            VendorProfileError::MalformedAddress { .. }
                | VendorProfileError::UnsupportedFamily { .. }
        ));
    }
}
