use crate::project::{PlcHardwareTopology, PlcIoDirection, PlcManufacturer};

use super::super::{
    profile::{
        format_vendor_address, split_vendor_address, ModbusAddressSpace, ModbusMappingPolicy,
        ModbusMappingRule, ModbusMappingSource, OpcUaAliasPolicy, VendorAddress,
        VendorAddressMetadata, VendorAddressNumberBase, VendorDataKind, VendorProfile,
        VendorProfileError, VendorProfileId,
    },
    types::{CanonicalAddress, CanonicalAreaKind},
};

const LS_FAMILIES: [&str; 12] = ["TD", "CD", "P", "M", "K", "F", "T", "C", "D", "R", "Z", "N"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LsIoTopology {
    LegacyUnifiedP,
    FixedCpuSplit {
        input_end_exclusive: u32,
        output_end_exclusive: u32,
    },
    DynamicSlotP,
}

#[derive(Debug, Clone)]
pub struct LsProfile {
    model: String,
    io_topology: LsIoTopology,
    hardware_topology: PlcHardwareTopology,
}

impl LsProfile {
    pub fn new(model: String, hardware_topology: PlcHardwareTopology) -> Self {
        let lowered = model.to_ascii_lowercase();
        let io_topology = if lowered.starts_with("xbc") || lowered.starts_with("xec") {
            // Current parser/runtime treats P as decimal, so the first compatibility cut keeps the
            // CPU-local fixed split in decimal buckets until slot/module topology is available.
            LsIoTopology::FixedCpuSplit {
                input_end_exclusive: 20,
                output_end_exclusive: 40,
            }
        } else if lowered.starts_with("xgt") || lowered.starts_with("xgi") {
            LsIoTopology::DynamicSlotP
        } else {
            LsIoTopology::LegacyUnifiedP
        };

        Self {
            model,
            io_topology,
            hardware_topology,
        }
    }

    fn canonical_area_for_p(&self, index: u32) -> CanonicalAreaKind {
        for rack in &self.hardware_topology.racks {
            for module in &rack.modules {
                for window in &module.address_windows {
                    if !window.family.eq_ignore_ascii_case("P") {
                        continue;
                    }

                    let end = window.start.saturating_add(window.count);
                    if index >= window.start && index < end {
                        return match window.io_direction {
                            Some(PlcIoDirection::Output) => CanonicalAreaKind::OutputBit,
                            _ => CanonicalAreaKind::InputBit,
                        };
                    }
                }
            }
        }

        match self.io_topology {
            LsIoTopology::FixedCpuSplit {
                input_end_exclusive,
                output_end_exclusive,
            } => {
                if index < input_end_exclusive {
                    CanonicalAreaKind::InputBit
                } else if index < output_end_exclusive {
                    CanonicalAreaKind::OutputBit
                } else {
                    CanonicalAreaKind::InputBit
                }
            }
            // XGT/XGI really need module-slot topology to do this correctly. Until the project
            // model stores that topology, preserve the legacy P behavior instead of guessing.
            LsIoTopology::DynamicSlotP | LsIoTopology::LegacyUnifiedP => {
                CanonicalAreaKind::InputBit
            }
        }
    }

    fn supports_p_output_alias(&self, canonical_index: u32) -> bool {
        for rack in &self.hardware_topology.racks {
            for module in &rack.modules {
                for window in &module.address_windows {
                    if window.family.eq_ignore_ascii_case("P")
                        && matches!(window.io_direction, Some(PlcIoDirection::Output))
                    {
                        let end = window.start.saturating_add(window.count);
                        if canonical_index >= window.start && canonical_index < end {
                            return true;
                        }
                    }
                }
            }
        }

        match self.io_topology {
            LsIoTopology::FixedCpuSplit {
                input_end_exclusive: _,
                output_end_exclusive,
            } => canonical_index < output_end_exclusive,
            LsIoTopology::DynamicSlotP | LsIoTopology::LegacyUnifiedP => true,
        }
    }

    fn metadata_for(
        &self,
        family: &str,
        index: Option<u32>,
    ) -> Result<VendorAddressMetadata, VendorProfileError> {
        let metadata = match family {
            "P" => VendorAddressMetadata {
                canonical_area: self.canonical_area_for_p(index.unwrap_or_default()),
                access: self
                    .canonical_area_for_p(index.unwrap_or_default())
                    .default_access(),
                retained: false,
                data_kind: VendorDataKind::Bit,
                supports_bit_index: false,
                max_index: 2047,
                number_base: VendorAddressNumberBase::Decimal,
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
            "K" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::RetentiveBit,
                access: CanonicalAreaKind::RetentiveBit.default_access(),
                retained: true,
                data_kind: VendorDataKind::Bit,
                supports_bit_index: false,
                max_index: 2047,
                number_base: VendorAddressNumberBase::Decimal,
            },
            "F" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::SpecialBit,
                access: CanonicalAreaKind::SpecialBit.default_access(),
                retained: false,
                data_kind: VendorDataKind::Bit,
                supports_bit_index: false,
                max_index: 2047,
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
            "R" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::RetentiveWord,
                access: CanonicalAreaKind::RetentiveWord.default_access(),
                retained: true,
                data_kind: VendorDataKind::Word,
                supports_bit_index: true,
                max_index: 9999,
                number_base: VendorAddressNumberBase::Decimal,
            },
            "Z" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::IndexWord,
                access: CanonicalAreaKind::IndexWord.default_access(),
                retained: false,
                data_kind: VendorDataKind::Word,
                supports_bit_index: false,
                max_index: 15,
                number_base: VendorAddressNumberBase::Decimal,
            },
            "N" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::SystemWord,
                access: CanonicalAreaKind::SystemWord.default_access(),
                retained: false,
                data_kind: VendorDataKind::Word,
                supports_bit_index: false,
                max_index: 8191,
                number_base: VendorAddressNumberBase::Decimal,
            },
            "TD" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::TimerValueWord,
                access: CanonicalAreaKind::TimerValueWord.default_access(),
                retained: false,
                data_kind: VendorDataKind::Word,
                supports_bit_index: false,
                max_index: 2047,
                number_base: VendorAddressNumberBase::Decimal,
            },
            "CD" => VendorAddressMetadata {
                canonical_area: CanonicalAreaKind::CounterValueWord,
                access: CanonicalAreaKind::CounterValueWord.default_access(),
                retained: false,
                data_kind: VendorDataKind::Word,
                supports_bit_index: false,
                max_index: 2047,
                number_base: VendorAddressNumberBase::Decimal,
            },
            _ => {
                return Err(VendorProfileError::UnsupportedFamily {
                    profile_id: VendorProfileId::LsXg5000,
                    family: family.to_string(),
                });
            }
        };

        Ok(metadata)
    }
}

impl VendorProfile for LsProfile {
    fn id(&self) -> VendorProfileId {
        VendorProfileId::LsXg5000
    }

    fn display_name(&self) -> &'static str {
        "LS XG5000 Compatibility Profile"
    }

    fn manufacturer(&self) -> PlcManufacturer {
        PlcManufacturer::LS
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
            split_vendor_address(input, &LS_FAMILIES)?;
        let number_base = match family.as_str() {
            "P" => VendorAddressNumberBase::Decimal,
            "M" | "K" | "F" | "T" | "C" | "D" | "R" | "Z" | "N" | "TD" | "CD" => {
                self.metadata_for(&family, None)?.number_base
            }
            _ => {
                return Err(VendorProfileError::UnsupportedFamily {
                    profile_id: VendorProfileId::LsXg5000,
                    family,
                });
            }
        };
        let index = number_base.parse(&number_part)?;

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
        Ok(format_vendor_address(address, metadata.number_base, 4))
    }

    fn validate_address(
        &self,
        address: &VendorAddress,
    ) -> Result<VendorAddressMetadata, VendorProfileError> {
        let metadata = self.metadata_for(&address.family, Some(address.index))?;

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

        if address.index_register.is_some()
            && !matches!(address.family.as_str(), "D" | "R" | "Z" | "N")
        {
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

        if address.index_register.is_some() {
            return Err(VendorProfileError::IndexedAddressNotSupported {
                profile_id: self.id(),
                family: address.family.clone(),
            });
        }

        let mut canonical = CanonicalAddress::new(metadata.canonical_area, address.index);
        canonical.bit_index = address.bit_index;
        Ok(canonical)
    }

    fn canonical_aliases(&self, canonical: &CanonicalAddress) -> Vec<VendorAddress> {
        let family = match canonical.area {
            CanonicalAreaKind::InputBit => Some("P"),
            CanonicalAreaKind::OutputBit if self.supports_p_output_alias(canonical.index) => {
                Some("P")
            }
            CanonicalAreaKind::InternalBit => Some("M"),
            CanonicalAreaKind::RetentiveBit => Some("K"),
            CanonicalAreaKind::SpecialBit => Some("F"),
            CanonicalAreaKind::DataWord => Some("D"),
            CanonicalAreaKind::RetentiveWord => Some("R"),
            CanonicalAreaKind::IndexWord => Some("Z"),
            CanonicalAreaKind::TimerDoneBit => Some("T"),
            CanonicalAreaKind::TimerValueWord => Some("TD"),
            CanonicalAreaKind::CounterDoneBit => Some("C"),
            CanonicalAreaKind::CounterValueWord => Some("CD"),
            CanonicalAreaKind::SystemWord => Some("N"),
            CanonicalAreaKind::OutputBit | CanonicalAreaKind::SystemBit => None,
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
            profile_id: self.id().as_str().to_string(),
            source: ModbusMappingSource::Recommended,
            rules: vec![
                ModbusMappingRule {
                    family: "M".to_string(),
                    canonical_area: CanonicalAreaKind::InternalBit,
                    address_space: ModbusAddressSpace::Coil,
                    offset: 0,
                    count: 8192,
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
            profile_id: self.id().as_str().to_string(),
            source: ModbusMappingSource::LegacyWide,
            rules: vec![
                ModbusMappingRule {
                    family: "M".to_string(),
                    canonical_area: CanonicalAreaKind::InternalBit,
                    address_space: ModbusAddressSpace::Coil,
                    offset: 0,
                    count: 8192,
                },
                ModbusMappingRule {
                    family: "K".to_string(),
                    canonical_area: CanonicalAreaKind::RetentiveBit,
                    address_space: ModbusAddressSpace::Coil,
                    offset: 8192,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "T".to_string(),
                    canonical_area: CanonicalAreaKind::TimerDoneBit,
                    address_space: ModbusAddressSpace::Coil,
                    offset: 10240,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "C".to_string(),
                    canonical_area: CanonicalAreaKind::CounterDoneBit,
                    address_space: ModbusAddressSpace::Coil,
                    offset: 12288,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "P".to_string(),
                    canonical_area: CanonicalAreaKind::InputBit,
                    address_space: ModbusAddressSpace::DiscreteInput,
                    offset: 0,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "F".to_string(),
                    canonical_area: CanonicalAreaKind::SpecialBit,
                    address_space: ModbusAddressSpace::DiscreteInput,
                    offset: 2048,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "D".to_string(),
                    canonical_area: CanonicalAreaKind::DataWord,
                    address_space: ModbusAddressSpace::HoldingRegister,
                    offset: 0,
                    count: 10000,
                },
                ModbusMappingRule {
                    family: "R".to_string(),
                    canonical_area: CanonicalAreaKind::RetentiveWord,
                    address_space: ModbusAddressSpace::HoldingRegister,
                    offset: 10000,
                    count: 10000,
                },
                ModbusMappingRule {
                    family: "Z".to_string(),
                    canonical_area: CanonicalAreaKind::IndexWord,
                    address_space: ModbusAddressSpace::HoldingRegister,
                    offset: 20000,
                    count: 16,
                },
                ModbusMappingRule {
                    family: "N".to_string(),
                    canonical_area: CanonicalAreaKind::SystemWord,
                    address_space: ModbusAddressSpace::HoldingRegister,
                    offset: 20016,
                    count: 8192,
                },
                ModbusMappingRule {
                    family: "TD".to_string(),
                    canonical_area: CanonicalAreaKind::TimerValueWord,
                    address_space: ModbusAddressSpace::HoldingRegister,
                    offset: 28208,
                    count: 2048,
                },
                ModbusMappingRule {
                    family: "CD".to_string(),
                    canonical_area: CanonicalAreaKind::CounterValueWord,
                    address_space: ModbusAddressSpace::HoldingRegister,
                    offset: 30256,
                    count: 2048,
                },
            ],
        }
    }

    fn opcua_alias_policy(&self) -> OpcUaAliasPolicy {
        OpcUaAliasPolicy {
            expose_vendor_aliases: true,
            namespace_segment: "LS".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_formats_ls_addresses() {
        let profile = LsProfile::new("XGK".to_string(), PlcHardwareTopology::default());

        let bit = profile
            .parse_address("M100")
            .expect("M address should parse");
        assert_eq!(bit.family, "M");
        assert_eq!(profile.format_address(&bit).unwrap(), "M0100");

        let word_bit = profile
            .parse_address("D0100.5")
            .expect("word bit address should parse");
        assert_eq!(word_bit.bit_index, Some(5));
        assert_eq!(profile.format_address(&word_bit).unwrap(), "D0100.5");

        let indexed = profile
            .parse_address("D0100[Z3]")
            .expect("indexed address should parse");
        assert_eq!(indexed.index_register, Some(3));
        assert_eq!(profile.format_address(&indexed).unwrap(), "D0100[Z3]");

        let td = profile
            .parse_address("TD1")
            .expect("TD address should parse");
        assert_eq!(profile.format_address(&td).unwrap(), "TD0001");
    }

    #[test]
    fn translates_ls_addresses_to_canonical() {
        let profile = LsProfile::new(String::new(), PlcHardwareTopology::default());

        let p = profile.to_canonical(&VendorAddress::new("P", 7)).unwrap();
        assert_eq!(p.area, CanonicalAreaKind::InputBit);

        let n = profile.to_canonical(&VendorAddress::new("N", 12)).unwrap();
        assert_eq!(n.area, CanonicalAreaKind::SystemWord);

        let cd = profile.to_canonical(&VendorAddress::new("CD", 3)).unwrap();
        assert_eq!(cd.area, CanonicalAreaKind::CounterValueWord);
    }

    #[test]
    fn projects_xbc_xec_p_ranges_onto_split_io_areas() {
        let profile = LsProfile::new("XBC-DN32H".to_string(), PlcHardwareTopology::default());

        let p_in = profile.to_canonical(&VendorAddress::new("P", 5)).unwrap();
        assert_eq!(p_in.area, CanonicalAreaKind::InputBit);

        let p_out = profile.to_canonical(&VendorAddress::new("P", 25)).unwrap();
        assert_eq!(p_out.area, CanonicalAreaKind::OutputBit);
    }

    #[test]
    fn preserves_legacy_p_projection_for_slot_based_ls_models() {
        let profile = LsProfile::new("XGT-CPUH".to_string(), PlcHardwareTopology::default());

        let p = profile.to_canonical(&VendorAddress::new("P", 25)).unwrap();
        assert_eq!(p.area, CanonicalAreaKind::InputBit);

        let aliases =
            profile.canonical_aliases(&CanonicalAddress::new(CanonicalAreaKind::OutputBit, 25));
        assert_eq!(aliases, vec![VendorAddress::new("P", 25)]);
    }

    #[test]
    fn uses_topology_windows_for_slot_based_ls_p_projection() {
        let profile = LsProfile::new(
            "XGT-CPUH".to_string(),
            PlcHardwareTopology {
                racks: vec![crate::project::PlcRackTopology {
                    rack_id: "main".to_string(),
                    rack_kind: crate::project::PlcRackKind::MainBase,
                    modules: vec![crate::project::PlcHardwareModule {
                        slot: 3,
                        module_kind: crate::project::PlcModuleKind::DigitalOutput,
                        model: "XBF-DO16A".to_string(),
                        point_count: Some(16),
                        address_windows: vec![crate::project::PlcAddressWindow {
                            family: "P".to_string(),
                            start: 64,
                            count: 16,
                            io_direction: Some(crate::project::PlcIoDirection::Output),
                        }],
                    }],
                }],
            },
        );

        let p = profile.to_canonical(&VendorAddress::new("P", 70)).unwrap();
        assert_eq!(p.area, CanonicalAreaKind::OutputBit);
    }

    #[test]
    fn rejects_out_of_range_ls_addresses() {
        let profile = LsProfile::new(String::new(), PlcHardwareTopology::default());
        let error = profile
            .parse_address("Z16")
            .expect_err("Z16 should be out of range");

        assert!(matches!(
            error,
            VendorProfileError::AddressOutOfRange { .. }
        ));
    }
}
