// OPC UA 매핑의 핵심 값 타입(데이터 타입/접근 레벨/레지스터 범위/매핑 값/에러) 정의

use serde::{Deserialize, Serialize};

use modone_contract::CanonicalAddress;

/// All OPC UA standard basic data types that the mapping layer can expose.
///
/// The PLC core stores only `Bool` and `U16` registers.  This enum describes
/// the *presented* type on the OPC UA side — the mapping layer handles the
/// conversion between the canonical register(s) and the wider type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum OpcUaDataType {
    /// OPC UA Boolean — maps 1:1 to `CanonicalValue::Bool`.
    Boolean,
    /// OPC UA SByte (Int8) — stored in the low byte of a single U16 register.
    SByte,
    /// OPC UA Byte (UInt8) — stored in the low byte of a single U16 register.
    Byte,
    /// OPC UA Int16 — reinterpret a single U16 register as signed.
    Int16,
    /// OPC UA UInt16 — direct pass-through of a single U16 register.
    UInt16,
    /// OPC UA Int32 — two consecutive U16 registers reinterpreted as signed 32-bit.
    Int32,
    /// OPC UA UInt32 — two consecutive U16 registers as unsigned 32-bit.
    UInt32,
    /// OPC UA Int64 — four consecutive U16 registers as signed 64-bit.
    Int64,
    /// OPC UA UInt64 — four consecutive U16 registers as unsigned 64-bit.
    UInt64,
    /// OPC UA Float (IEEE 754 single) — two consecutive U16 registers.
    Float,
    /// OPC UA Double (IEEE 754 double) — four consecutive U16 registers.
    Double,
    /// OPC UA String — variable-length UTF-8, word count determines max length.
    String,
}

impl OpcUaDataType {
    /// Returns the minimum number of U16 registers required to represent this type.
    pub fn default_word_count(&self) -> u16 {
        match self {
            Self::Boolean => 1,
            Self::SByte | Self::Byte => 1,
            Self::Int16 | Self::UInt16 => 1,
            Self::Int32 | Self::UInt32 => 2,
            Self::Int64 | Self::UInt64 => 4,
            Self::Float => 2,
            Self::Double => 4,
            Self::String => 1, // caller must set actual word count
        }
    }

    /// Returns `true` when the type maps from a boolean canonical value rather
    /// than U16 register(s).
    pub fn is_bool_type(&self) -> bool {
        matches!(self, Self::Boolean)
    }
}

impl std::fmt::Display for OpcUaDataType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Self::Boolean => "Boolean",
            Self::SByte => "SByte",
            Self::Byte => "Byte",
            Self::Int16 => "Int16",
            Self::UInt16 => "UInt16",
            Self::Int32 => "Int32",
            Self::UInt32 => "UInt32",
            Self::Int64 => "Int64",
            Self::UInt64 => "UInt64",
            Self::Float => "Float",
            Self::Double => "Double",
            Self::String => "String",
        };
        write!(f, "{}", name)
    }
}

/// Access level exposed on the OPC UA side for a mapped tag.
///
/// This is separate from [`crate::address_space_spec::OpcUaAccessLevel`] because the
/// mapping config is independent of the address-space builder and can be
/// serialized/deserialized as part of project configuration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MappingAccessLevel {
    /// Read-only — OPC UA clients may read but not write.
    ReadOnly,
    /// Read-write — OPC UA clients may both read and write.
    ReadWrite,
}

impl Default for MappingAccessLevel {
    fn default() -> Self {
        Self::ReadOnly
    }
}

impl std::fmt::Display for MappingAccessLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ReadOnly => write!(f, "ReadOnly"),
            Self::ReadWrite => write!(f, "ReadWrite"),
        }
    }
}

// ─── RegisterRange — deviceAddress as single source of truth ───────────────

/// A contiguous range of register addresses derived from a base
/// [`CanonicalAddress`] (the tag's `deviceAddress`) plus a `word_count`.
///
/// The `deviceAddress` on the tag is the **single source of truth** for
/// register location.  [`crate::mapping::OpcUaMappingConfig`] supplies only the
/// *interpretation* (data type, byte order, access level) and the number of
/// consecutive registers (`word_count`).  This struct materialises the
/// resulting address span so that the bridge / adapter layers can read or
/// write the correct slice of PLC memory.
///
/// For boolean mappings (`word_count == 1`, bool area) the range is a single
/// register or bit.  For multi-word types (Int32, Float, Double, etc.) the
/// range covers `word_count` consecutive registers starting at
/// `device_address.index`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegisterRange {
    /// Memory area of the registers.
    pub area: modone_contract::CanonicalAreaKind,
    /// Start index (inclusive) — copied directly from `deviceAddress.index`.
    pub start_index: u32,
    /// Number of consecutive U16 registers in this range.
    pub word_count: u16,
    /// Optional bit index within the first register (for boolean bit access).
    pub bit_index: Option<u8>,
}

impl RegisterRange {
    /// End index (exclusive): `start_index + word_count`.
    pub fn end_index(&self) -> u32 {
        self.start_index + self.word_count as u32
    }

    /// Returns the sequence of [`CanonicalAddress`]es covered by this range.
    ///
    /// For a single-register boolean with a `bit_index`, the iterator yields
    /// exactly one address with that bit index.  For multi-register word
    /// mappings, it yields `word_count` addresses with consecutive indices and
    /// no bit index.
    pub fn addresses(&self) -> Vec<CanonicalAddress> {
        if let Some(bit) = self.bit_index {
            // Boolean bit access — single address
            vec![CanonicalAddress::with_bit_index(
                self.area,
                self.start_index,
                bit,
            )]
        } else {
            (0..self.word_count as u32)
                .map(|offset| CanonicalAddress::new(self.area, self.start_index + offset))
                .collect()
        }
    }

    /// Returns `true` when the range covers exactly one register or bit.
    pub fn is_single(&self) -> bool {
        self.word_count == 1
    }

    /// Returns `true` when `other` overlaps with this range in the same area.
    ///
    /// Useful for detecting conflicting mappings or validating that two tags
    /// do not claim the same physical registers.
    pub fn overlaps(&self, other: &RegisterRange) -> bool {
        if self.area != other.area {
            return false;
        }
        self.start_index < other.end_index() && other.start_index < self.end_index()
    }

    /// Validates that this range fits within the memory area's default size.
    ///
    /// Returns `Err` if `start_index + word_count` would exceed the area's
    /// `default_size()`.
    pub fn validate_bounds(&self) -> Result<(), String> {
        let area_size = self.area.default_size() as u32;
        let end = self.end_index();
        if end > area_size {
            return Err(format!(
                "register range [{}, {}) exceeds {:?} area size {}",
                self.start_index, end, self.area, area_size,
            ));
        }
        Ok(())
    }
}

/// A mapped OPC UA value produced from raw U16 register(s).
///
/// This is the intermediate representation used between the PLC canonical
/// memory (Bool / U16 registers) and OPC UA `Variant` construction.
#[derive(Debug, Clone, PartialEq)]
pub enum MappedValue {
    Boolean(bool),
    SByte(i8),
    Byte(u8),
    Int16(i16),
    UInt16(u16),
    Int32(i32),
    UInt32(u32),
    Int64(i64),
    UInt64(u64),
    Float(f32),
    Double(f64),
    String(std::string::String),
}

/// Errors that can occur during register ↔ typed-value conversion.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MappingError {
    /// Not enough registers supplied for the configured data type.
    InsufficientRegisters { expected: usize, actual: usize },
    /// The data type is not yet supported by this conversion path.
    UnsupportedType(OpcUaDataType),
    /// The MappedValue variant does not match the config's data type.
    TypeMismatch {
        type_name: &'static str,
        detail: std::string::String,
    },
    /// Boolean mapping requires a bool canonical value, not registers.
    BooleanTypeMismatch,
}

impl std::fmt::Display for MappingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InsufficientRegisters { expected, actual } => {
                write!(f, "need {} registers but got {}", expected, actual)
            }
            Self::UnsupportedType(dt) => write!(f, "unsupported data type: {}", dt),
            Self::TypeMismatch { type_name, detail } => {
                write!(f, "type mismatch for {}: {}", type_name, detail)
            }
            Self::BooleanTypeMismatch => {
                write!(f, "Boolean type requires a bool value, not U16 registers")
            }
        }
    }
}

impl std::error::Error for MappingError {}
