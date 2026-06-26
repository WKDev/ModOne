// project Modbus 노출 설정(ModbusExposure*)을 vendor 프로파일의 Modbus 매핑 정책으로
// 해석하는 native 셸 글루. plc-model(프로토콜 무지)과 project 설정의 경계 함수.

use plc_model::{
    resolve_vendor_profile, ModbusAddressSpace, ModbusMappingPolicy, ModbusMappingRule,
    ModbusMappingSource, PlcSettings, VendorAddress, VendorProfileError,
};

use crate::project::{ModbusExposureAddressSpace, ModbusExposureMode, ModbusExposureSettings};

/// PLC 설정 + (선택) Modbus 노출 설정으로부터 최종 Modbus 매핑 정책을 해석한다.
///
/// 노출 설정이 없으면 프로파일 권장 정책을 쓴다. `Custom` 모드는 노출 규칙을
/// 프로파일의 주소 메타데이터로 검증해 canonical 영역으로 매핑한다.
pub fn resolve_modbus_mapping_policy(
    plc_settings: &PlcSettings,
    exposure: Option<&ModbusExposureSettings>,
) -> Result<ModbusMappingPolicy, VendorProfileError> {
    let profile = resolve_vendor_profile(plc_settings)?;

    let Some(exposure) = exposure else {
        return Ok(profile.recommended_modbus_mapping_policy());
    };

    match exposure.mode {
        ModbusExposureMode::Recommended => Ok(profile.recommended_modbus_mapping_policy()),
        ModbusExposureMode::LegacyWide => Ok(profile.legacy_modbus_mapping_policy()),
        ModbusExposureMode::Custom => {
            let mut rules = Vec::with_capacity(exposure.rules.len());
            for rule in &exposure.rules {
                let family = rule.family.trim().to_uppercase();
                let metadata = profile.validate_address(&VendorAddress::new(&family, 0))?;
                rules.push(ModbusMappingRule {
                    family,
                    canonical_area: metadata.canonical_area,
                    address_space: map_exposure_space(rule.address_space),
                    offset: rule.offset,
                    count: rule.count,
                });
            }

            Ok(ModbusMappingPolicy {
                profile_id: profile.id(),
                source: ModbusMappingSource::Custom,
                rules,
            })
        }
    }
}

fn map_exposure_space(space: ModbusExposureAddressSpace) -> ModbusAddressSpace {
    match space {
        ModbusExposureAddressSpace::Coil => ModbusAddressSpace::Coil,
        ModbusExposureAddressSpace::DiscreteInput => ModbusAddressSpace::DiscreteInput,
        ModbusExposureAddressSpace::HoldingRegister => ModbusAddressSpace::HoldingRegister,
        ModbusExposureAddressSpace::InputRegister => ModbusAddressSpace::InputRegister,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::ModbusExposureRule;
    use modone_contract::CanonicalAreaKind;
    use plc_model::{PlcHardwareTopology, PlcManufacturer};

    #[test]
    fn uses_recommended_ls_modbus_exposure_by_default() {
        let policy = resolve_modbus_mapping_policy(
            &PlcSettings {
                manufacturer: PlcManufacturer::LS,
                model: "XBC-DN32H".to_string(),
                scan_time_ms: 10,
                hardware_topology: PlcHardwareTopology::default(),
            },
            None,
        )
        .expect("policy");

        assert_eq!(policy.source, ModbusMappingSource::Recommended);
        assert_eq!(policy.rules.len(), 2);
        assert_eq!(policy.rules[0].family, "M");
        assert_eq!(policy.rules[1].family, "D");
    }

    #[test]
    fn supports_custom_modbus_exposure_rules() {
        let policy = resolve_modbus_mapping_policy(
            &PlcSettings {
                manufacturer: PlcManufacturer::LS,
                model: "XGK".to_string(),
                scan_time_ms: 10,
                hardware_topology: PlcHardwareTopology::default(),
            },
            Some(&ModbusExposureSettings {
                mode: ModbusExposureMode::Custom,
                rules: vec![
                    ModbusExposureRule {
                        family: "P".to_string(),
                        address_space: ModbusExposureAddressSpace::DiscreteInput,
                        offset: 100,
                        count: 20,
                    },
                    ModbusExposureRule {
                        family: "D".to_string(),
                        address_space: ModbusExposureAddressSpace::HoldingRegister,
                        offset: 0,
                        count: 200,
                    },
                ],
            }),
        )
        .expect("custom policy");

        assert_eq!(policy.source, ModbusMappingSource::Custom);
        assert_eq!(policy.rules[0].offset, 100);
        assert_eq!(policy.rules[1].canonical_area, CanonicalAreaKind::DataWord);
    }
}
