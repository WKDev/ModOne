// 레지스터 ↔ MappedValue 변환(read/write 경로) 및 독립형 f32/f64↔레지스터 헬퍼

use crate::mapping::{
    registers_to_string, string_to_registers, ByteOrder, MappedValue, MappingError, OpcUaDataType,
    OpcUaMappingConfig,
};

// ---------------------------------------------------------------------------
// Core conversion: registers → MappedValue (read path)
// ---------------------------------------------------------------------------

/// Read U16 register(s) and produce a [`MappedValue`] according to the
/// mapping config.
///
/// `regs` must contain at least `config.opcua_data_type.default_word_count()`
/// elements in address order. Only the first N required words are consumed.
/// For String types, `config.word_count` registers are expected instead, since
/// the string length is user-specified.
///
/// For `Boolean` type, use [`read_bool_mapped`] instead.
pub fn read_registers_to_mapped(
    config: &OpcUaMappingConfig,
    regs: &[u16],
) -> Result<MappedValue, MappingError> {
    // For String types, use the configured word_count (user-specified register count).
    // For all other types, use the type's default_word_count.
    let needed = if config.opcua_data_type == OpcUaDataType::String {
        config.word_count as usize
    } else {
        config.opcua_data_type.default_word_count() as usize
    };
    if regs.len() < needed {
        return Err(MappingError::InsufficientRegisters {
            expected: needed,
            actual: regs.len(),
        });
    }
    let regs = &regs[..needed];

    match config.opcua_data_type {
        OpcUaDataType::Boolean => Err(MappingError::BooleanTypeMismatch),

        // --- 8-bit types (single register, low byte) ---
        OpcUaDataType::SByte => {
            let raw = regs[0] & 0xFF;
            Ok(MappedValue::SByte(raw as u8 as i8))
        }
        OpcUaDataType::Byte => {
            let raw = regs[0] & 0xFF;
            Ok(MappedValue::Byte(raw as u8))
        }

        // --- 16-bit types (single register) ---
        OpcUaDataType::Int16 => Ok(MappedValue::Int16(regs[0] as i16)),
        OpcUaDataType::UInt16 => Ok(MappedValue::UInt16(regs[0])),

        // --- 32-bit integer types (2 registers) ---
        OpcUaDataType::Int32 => {
            let words = config.byte_order.to_logical_order(regs);
            let raw = ((words[0] as u32) << 16) | (words[1] as u32);
            Ok(MappedValue::Int32(raw as i32))
        }
        OpcUaDataType::UInt32 => {
            let words = config.byte_order.to_logical_order(regs);
            let raw = ((words[0] as u32) << 16) | (words[1] as u32);
            Ok(MappedValue::UInt32(raw))
        }

        // --- 64-bit integer types (4 registers) ---
        OpcUaDataType::Int64 => {
            let words = config.byte_order.to_logical_order(regs);
            let raw = ((words[0] as u64) << 48)
                | ((words[1] as u64) << 32)
                | ((words[2] as u64) << 16)
                | (words[3] as u64);
            Ok(MappedValue::Int64(raw as i64))
        }
        OpcUaDataType::UInt64 => {
            let words = config.byte_order.to_logical_order(regs);
            let raw = ((words[0] as u64) << 48)
                | ((words[1] as u64) << 32)
                | ((words[2] as u64) << 16)
                | (words[3] as u64);
            Ok(MappedValue::UInt64(raw))
        }

        // --- IEEE 754 floating-point types ---
        OpcUaDataType::Float => {
            let words = config.byte_order.to_logical_order(regs);
            let raw = ((words[0] as u32) << 16) | (words[1] as u32);
            Ok(MappedValue::Float(f32::from_bits(raw)))
        }
        OpcUaDataType::Double => {
            let words = config.byte_order.to_logical_order(regs);
            let raw = ((words[0] as u64) << 48)
                | ((words[1] as u64) << 32)
                | ((words[2] as u64) << 16)
                | (words[3] as u64);
            Ok(MappedValue::Double(f64::from_bits(raw)))
        }

        // String — uses string_config from the mapping config
        OpcUaDataType::String => {
            let sc = config.string_config.as_ref().cloned().unwrap_or_default();
            let effective_wc = sc.effective_word_count(config.word_count) as usize;
            let slice = if regs.len() >= effective_wc {
                &regs[..effective_wc]
            } else {
                regs
            };
            registers_to_string(slice, config.byte_order, &sc)
                .map(MappedValue::String)
                .map_err(|e| MappingError::TypeMismatch {
                    type_name: "String",
                    detail: e,
                })
        }
    }
}

/// Convenience: read a boolean canonical value as a [`MappedValue::Boolean`].
pub fn read_bool_mapped(value: bool) -> MappedValue {
    MappedValue::Boolean(value)
}

// ---------------------------------------------------------------------------
// Core conversion: MappedValue → registers (write path)
// ---------------------------------------------------------------------------

/// Convert a [`MappedValue`] back into U16 register(s) in address order
/// according to the mapping config's byte order.
///
/// Returns a `Vec<u16>` with exactly `default_word_count()` elements.
///
/// For `Boolean` type, use [`write_bool_mapped`] instead.
pub fn write_mapped_to_registers(
    config: &OpcUaMappingConfig,
    value: &MappedValue,
) -> Result<Vec<u16>, MappingError> {
    match (config.opcua_data_type, value) {
        (OpcUaDataType::Boolean, _) => Err(MappingError::BooleanTypeMismatch),

        // --- 8-bit types ---
        (OpcUaDataType::SByte, MappedValue::SByte(v)) => Ok(vec![(*v as u8) as u16]),
        (OpcUaDataType::Byte, MappedValue::Byte(v)) => Ok(vec![*v as u16]),

        // --- 16-bit types ---
        (OpcUaDataType::Int16, MappedValue::Int16(v)) => Ok(vec![*v as u16]),
        (OpcUaDataType::UInt16, MappedValue::UInt16(v)) => Ok(vec![*v]),

        // --- 32-bit integer types ---
        (OpcUaDataType::Int32, MappedValue::Int32(v)) => {
            let raw = *v as u32;
            let logical = [(raw >> 16) as u16, raw as u16];
            Ok(config.byte_order.from_logical_order(&logical))
        }
        (OpcUaDataType::UInt32, MappedValue::UInt32(v)) => {
            let logical = [(*v >> 16) as u16, *v as u16];
            Ok(config.byte_order.from_logical_order(&logical))
        }

        // --- 64-bit integer types ---
        (OpcUaDataType::Int64, MappedValue::Int64(v)) => {
            let raw = *v as u64;
            let logical = [
                (raw >> 48) as u16,
                (raw >> 32) as u16,
                (raw >> 16) as u16,
                raw as u16,
            ];
            Ok(config.byte_order.from_logical_order(&logical))
        }
        (OpcUaDataType::UInt64, MappedValue::UInt64(v)) => {
            let logical = [
                (*v >> 48) as u16,
                (*v >> 32) as u16,
                (*v >> 16) as u16,
                *v as u16,
            ];
            Ok(config.byte_order.from_logical_order(&logical))
        }

        // --- IEEE 754 floating-point types ---
        (OpcUaDataType::Float, MappedValue::Float(v)) => {
            let bits = v.to_bits();
            let logical = [(bits >> 16) as u16, bits as u16];
            Ok(config.byte_order.from_logical_order(&logical))
        }
        (OpcUaDataType::Double, MappedValue::Double(v)) => {
            let bits = v.to_bits();
            let logical = [
                (bits >> 48) as u16,
                (bits >> 32) as u16,
                (bits >> 16) as u16,
                bits as u16,
            ];
            Ok(config.byte_order.from_logical_order(&logical))
        }

        // String — uses string_config from the mapping config
        (OpcUaDataType::String, MappedValue::String(s)) => {
            let sc = config.string_config.as_ref().cloned().unwrap_or_default();
            let effective_wc = sc.effective_word_count(config.word_count);
            string_to_registers(s, effective_wc, config.byte_order, &sc)
                .map_err(|e| MappingError::TypeMismatch {
                    type_name: "String",
                    detail: e,
                })
        }

        // Type mismatch between config data type and provided MappedValue variant
        (dt, val) => Err(MappingError::TypeMismatch {
            type_name: match dt {
                OpcUaDataType::SByte => "SByte",
                OpcUaDataType::Byte => "Byte",
                OpcUaDataType::Int16 => "Int16",
                OpcUaDataType::UInt16 => "UInt16",
                OpcUaDataType::Int32 => "Int32",
                OpcUaDataType::UInt32 => "UInt32",
                OpcUaDataType::Int64 => "Int64",
                OpcUaDataType::UInt64 => "UInt64",
                OpcUaDataType::Float => "Float",
                OpcUaDataType::Double => "Double",
                OpcUaDataType::String => "String",
                _ => "Unknown",
            },
            detail: format!("expected matching MappedValue variant, got {:?}", val),
        }),
    }
}

/// Convenience: extract a boolean from a [`MappedValue::Boolean`].
pub fn write_bool_mapped(value: &MappedValue) -> Result<bool, MappingError> {
    match value {
        MappedValue::Boolean(v) => Ok(*v),
        _ => Err(MappingError::BooleanTypeMismatch),
    }
}

// ---------------------------------------------------------------------------
// Standalone IEEE 754 Float / Double ↔ U16 register helpers
// ---------------------------------------------------------------------------

/// Reads an IEEE 754 **single-precision** (32-bit) float from two U16
/// registers, respecting the given byte order.
///
/// This is a lower-level helper; prefer [`read_registers_to_mapped`] with a
/// `Float` config for the full mapping pipeline.
pub fn registers_to_f32(regs: &[u16], byte_order: ByteOrder) -> f32 {
    let words = byte_order.to_logical_order(regs);
    let raw = ((words[0] as u32) << 16) | (words[1] as u32);
    f32::from_bits(raw)
}

/// Encodes an IEEE 754 **single-precision** float into two U16 registers,
/// respecting the given byte order.
pub fn f32_to_registers(val: f32, byte_order: ByteOrder) -> [u16; 2] {
    let bits = val.to_bits();
    let logical = [(bits >> 16) as u16, bits as u16];
    let out = byte_order.from_logical_order(&logical);
    [out[0], out[1]]
}

/// Reads an IEEE 754 **double-precision** (64-bit) float from four U16
/// registers, respecting the given byte order.
pub fn registers_to_f64(regs: &[u16], byte_order: ByteOrder) -> f64 {
    let words = byte_order.to_logical_order(regs);
    let raw = ((words[0] as u64) << 48)
        | ((words[1] as u64) << 32)
        | ((words[2] as u64) << 16)
        | (words[3] as u64);
    f64::from_bits(raw)
}

/// Encodes an IEEE 754 **double-precision** float into four U16 registers,
/// respecting the given byte order.
pub fn f64_to_registers(val: f64, byte_order: ByteOrder) -> [u16; 4] {
    let bits = val.to_bits();
    let logical = [
        (bits >> 48) as u16,
        (bits >> 32) as u16,
        (bits >> 16) as u16,
        bits as u16,
    ];
    let out = byte_order.from_logical_order(&logical);
    [out[0], out[1], out[2], out[3]]
}
