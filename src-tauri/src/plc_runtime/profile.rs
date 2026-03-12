use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::project::{PlcManufacturer, PlcSettings};

use super::types::{CanonicalAccess, CanonicalAddress, CanonicalAreaKind};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VendorProfileId {
    LsXg5000,
    MelsecFxQCommon,
}

impl VendorProfileId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::LsXg5000 => "ls-xg5000",
            Self::MelsecFxQCommon => "melsec-fx-q-common",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VendorDataKind {
    Bit,
    Word,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VendorAddressNumberBase {
    Decimal,
    Octal,
    Hexadecimal,
}

impl VendorAddressNumberBase {
    pub fn parse(&self, text: &str) -> Result<u32, VendorProfileError> {
        let radix = match self {
            Self::Decimal => 10,
            Self::Octal => 8,
            Self::Hexadecimal => 16,
        };

        u32::from_str_radix(text, radix).map_err(|_| VendorProfileError::MalformedAddress {
            input: text.to_string(),
            reason: format!("failed to parse {} value", self.label()),
        })
    }

    pub fn format(&self, value: u32) -> String {
        match self {
            Self::Decimal => value.to_string(),
            Self::Octal => format!("{value:o}"),
            Self::Hexadecimal => format!("{value:X}"),
        }
    }

    fn label(&self) -> &'static str {
        match self {
            Self::Decimal => "decimal",
            Self::Octal => "octal",
            Self::Hexadecimal => "hexadecimal",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VendorAddress {
    pub family: String,
    pub index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bit_index: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index_register: Option<u8>,
}

impl VendorAddress {
    pub fn new(family: impl Into<String>, index: u32) -> Self {
        Self {
            family: family.into(),
            index,
            bit_index: None,
            index_register: None,
        }
    }

    pub fn with_bit_index(mut self, bit_index: u8) -> Self {
        self.bit_index = Some(bit_index);
        self
    }

    pub fn with_index_register(mut self, index_register: u8) -> Self {
        self.index_register = Some(index_register);
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VendorAddressMetadata {
    pub canonical_area: CanonicalAreaKind,
    pub access: CanonicalAccess,
    pub retained: bool,
    pub data_kind: VendorDataKind,
    pub supports_bit_index: bool,
    pub max_index: u32,
    pub number_base: VendorAddressNumberBase,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModbusAddressSpace {
    Coil,
    DiscreteInput,
    HoldingRegister,
    InputRegister,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModbusMappingRule {
    pub family: String,
    pub canonical_area: CanonicalAreaKind,
    pub address_space: ModbusAddressSpace,
    pub offset: u16,
    pub count: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModbusMappingPolicy {
    pub profile_id: VendorProfileId,
    pub rules: Vec<ModbusMappingRule>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OpcUaAliasPolicy {
    pub expose_vendor_aliases: bool,
    pub namespace_segment: String,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum VendorProfileError {
    #[error("unsupported PLC manufacturer for vendor profiles: {manufacturer}")]
    UnsupportedManufacturer { manufacturer: String },
    #[error("unsupported PLC model for manufacturer {manufacturer}: {model}")]
    UnsupportedModel {
        manufacturer: String,
        model: String,
    },
    #[error("malformed address `{input}`: {reason}")]
    MalformedAddress { input: String, reason: String },
    #[error("unsupported device family `{family}` for profile {profile_id:?}")]
    UnsupportedFamily {
        profile_id: VendorProfileId,
        family: String,
    },
    #[error("address `{family}{index}` exceeds max index {max_index} for profile {profile_id:?}")]
    AddressOutOfRange {
        profile_id: VendorProfileId,
        family: String,
        index: u32,
        max_index: u32,
    },
    #[error("bit index {bit_index} is out of range")]
    BitIndexOutOfRange { bit_index: u8 },
    #[error("bit index is not supported for family `{family}` in profile {profile_id:?}")]
    BitIndexNotSupported {
        profile_id: VendorProfileId,
        family: String,
    },
    #[error("indexed addressing is not supported for family `{family}` in profile {profile_id:?}")]
    IndexedAddressNotSupported {
        profile_id: VendorProfileId,
        family: String,
    },
}

pub trait VendorProfile: Send + Sync {
    fn id(&self) -> VendorProfileId;
    fn display_name(&self) -> &'static str;
    fn manufacturer(&self) -> PlcManufacturer;
    fn model_hint(&self) -> Option<&str>;
    fn parse_address(&self, input: &str) -> Result<VendorAddress, VendorProfileError>;
    fn format_address(&self, address: &VendorAddress) -> Result<String, VendorProfileError>;
    fn validate_address(
        &self,
        address: &VendorAddress,
    ) -> Result<VendorAddressMetadata, VendorProfileError>;
    fn to_canonical(
        &self,
        address: &VendorAddress,
    ) -> Result<CanonicalAddress, VendorProfileError>;
    fn canonical_aliases(&self, canonical: &CanonicalAddress) -> Vec<VendorAddress>;
    fn modbus_mapping_policy(&self) -> ModbusMappingPolicy;
    fn opcua_alias_policy(&self) -> OpcUaAliasPolicy;

    fn preferred_alias(&self, canonical: &CanonicalAddress) -> Option<VendorAddress> {
        self.canonical_aliases(canonical).into_iter().next()
    }
}

pub fn resolve_vendor_profile(
    settings: &PlcSettings,
) -> Result<Box<dyn VendorProfile>, VendorProfileError> {
    match settings.manufacturer {
        PlcManufacturer::LS => Ok(Box::new(super::profiles::LsProfile::new(
            settings.model.clone(),
        ))),
        PlcManufacturer::Mitsubishi => Ok(Box::new(super::profiles::MelsecFxQProfile::new(
            settings.model.clone(),
        ))),
        PlcManufacturer::Siemens => Err(VendorProfileError::UnsupportedManufacturer {
            manufacturer: settings.manufacturer.to_string(),
        }),
    }
}

pub(crate) fn split_vendor_address(
    input: &str,
    family_candidates: &[&str],
) -> Result<(String, String, Option<u8>, Option<u8>), VendorProfileError> {
    let trimmed = input.trim().to_uppercase();
    if trimmed.is_empty() {
        return Err(VendorProfileError::MalformedAddress {
            input: input.to_string(),
            reason: "address is empty".to_string(),
        });
    }

    let (without_index_register, index_register) = if let Some(start) = trimmed.rfind("[Z") {
        let suffix = &trimmed[start + 2..];
        let suffix = suffix
            .strip_suffix(']')
            .ok_or_else(|| VendorProfileError::MalformedAddress {
                input: input.to_string(),
                reason: "invalid indexed-address suffix".to_string(),
            })?;
        let index_register = suffix
            .parse::<u8>()
            .map_err(|_| VendorProfileError::MalformedAddress {
                input: input.to_string(),
                reason: "invalid index-register value".to_string(),
            })?;
        (&trimmed[..start], Some(index_register))
    } else {
        (trimmed.as_str(), None)
    };

    let (without_bit, bit_index) = if let Some(dot) = without_index_register.rfind('.') {
        let suffix = &without_index_register[dot + 1..];
        let bit_index = suffix
            .parse::<u8>()
            .map_err(|_| VendorProfileError::MalformedAddress {
                input: input.to_string(),
                reason: "invalid bit-index suffix".to_string(),
            })?;
        (&without_index_register[..dot], Some(bit_index))
    } else {
        (without_index_register, None)
    };

    let family = family_candidates
        .iter()
        .find(|candidate| without_bit.starts_with(**candidate))
        .ok_or_else(|| VendorProfileError::MalformedAddress {
            input: input.to_string(),
            reason: "missing or unsupported family prefix".to_string(),
        })?;

    let number_part = without_bit[family.len()..].trim();
    if number_part.is_empty() {
        return Err(VendorProfileError::MalformedAddress {
            input: input.to_string(),
            reason: "missing numeric address".to_string(),
        });
    }

    Ok(((*family).to_string(), number_part.to_string(), bit_index, index_register))
}

pub(crate) fn format_vendor_address(
    address: &VendorAddress,
    number_base: VendorAddressNumberBase,
    min_digits: usize,
) -> String {
    let mut result = format!(
        "{}{:0>width$}",
        address.family,
        number_base.format(address.index),
        width = min_digits
    );

    if let Some(bit_index) = address.bit_index {
        result.push('.');
        result.push_str(&bit_index.to_string());
    }

    if let Some(index_register) = address.index_register {
        result.push_str(&format!("[Z{index_register}]"));
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_profile_from_plc_settings() {
        let ls = resolve_vendor_profile(&PlcSettings {
            manufacturer: PlcManufacturer::LS,
            model: "XGK".to_string(),
            scan_time_ms: 10,
        })
        .expect("ls profile should resolve");
        assert_eq!(ls.id(), VendorProfileId::LsXg5000);

        let melsec = resolve_vendor_profile(&PlcSettings {
            manufacturer: PlcManufacturer::Mitsubishi,
            model: "FX5U".to_string(),
            scan_time_ms: 10,
        })
        .expect("melsec profile should resolve");
        assert_eq!(melsec.id(), VendorProfileId::MelsecFxQCommon);
    }

    #[test]
    fn rejects_unsupported_manufacturer() {
        let result = resolve_vendor_profile(&PlcSettings {
            manufacturer: PlcManufacturer::Siemens,
            model: "S7".to_string(),
            scan_time_ms: 10,
        });

        assert!(matches!(
            result,
            Err(
            VendorProfileError::UnsupportedManufacturer { .. }
            )
        ));
    }
}
