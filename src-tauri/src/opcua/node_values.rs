// OPC UA 노드의 타입 매핑 변환(레지스터↔MappedValue↔Variant)과 publish dirty 판정 헬퍼
//
// server.rs 비대화를 막기 위해, 매핑 설정(OpcUaMappingConfig)을 라이브 서버에
// 적용하는 변환 로직을 이 모듈로 분리한다. 순수(비-opcua) 함수는 단위테스트가
// 가능하며, opcua 타입(Variant/DataTypeId)에 의존하는 부분만 feature gate 한다.

use crate::modbus::DirtyPublishWindow;
use crate::plc_runtime::{CanonicalAddress, CanonicalMemory, CanonicalMemoryError, CanonicalValue};

use super::{
    read_registers_to_mapped, write_mapped_to_registers, MappedValue, MappingError, OpcUaDataType,
    OpcUaMappingConfig,
};

/// Error reading a node's typed value from canonical memory.
#[derive(Debug)]
pub enum NodeValueError {
    Memory(CanonicalMemoryError),
    Mapping(MappingError),
}

/// Reads the register span backing a node and produces a typed [`MappedValue`]
/// according to its mapping config.
///
/// - Boolean nodes read a single canonical value (bool, or `U16 != 0`).
/// - All other types read `word_count` consecutive registers and decode them
///   via [`read_registers_to_mapped`] (respecting byte order).
pub fn read_node_mapped(
    memory: &CanonicalMemory,
    base: CanonicalAddress,
    mapping: &OpcUaMappingConfig,
) -> Result<MappedValue, NodeValueError> {
    if mapping.opcua_data_type == OpcUaDataType::Boolean {
        let v = memory.read(base).map_err(NodeValueError::Memory)?;
        return Ok(MappedValue::Boolean(canonical_truthy(v)));
    }

    let range = mapping.register_range(base);
    let mut regs = Vec::with_capacity(range.word_count as usize);
    for addr in range.addresses() {
        let word = match memory.read(addr).map_err(NodeValueError::Memory)? {
            CanonicalValue::U16(w) => w,
            CanonicalValue::Bool(b) => b as u16,
        };
        regs.push(word);
    }
    read_registers_to_mapped(mapping, &regs).map_err(NodeValueError::Mapping)
}

/// Decomposes a written [`MappedValue`] into the canonical register writes it
/// implies, starting at `base`.
///
/// - Boolean writes a single bool at `base`.
/// - Multi-register types are encoded via [`write_mapped_to_registers`] (byte
///   order applied) and zipped onto consecutive canonical addresses.
pub fn mapped_to_register_writes(
    value: &MappedValue,
    base: CanonicalAddress,
    mapping: &OpcUaMappingConfig,
) -> Result<Vec<(CanonicalAddress, CanonicalValue)>, MappingError> {
    if let MappedValue::Boolean(b) = value {
        return Ok(vec![(base, CanonicalValue::Bool(*b))]);
    }
    let regs = write_mapped_to_registers(mapping, value)?;
    let addrs = mapping.register_range(base).addresses();
    Ok(addrs
        .into_iter()
        .zip(regs)
        .map(|(addr, word)| (addr, CanonicalValue::U16(word)))
        .collect())
}

/// Returns `true` when any register in this node's span lies inside a dirty
/// publish window. Window `end_index` is inclusive (see [`DirtyPublishWindow`]).
pub fn node_dirty(
    base: CanonicalAddress,
    mapping: &OpcUaMappingConfig,
    windows: &[DirtyPublishWindow],
) -> bool {
    let range = mapping.register_range(base);
    let node_first = range.start_index;
    let node_last = range.start_index + range.word_count.max(1) as u32 - 1;
    windows.iter().any(|w| {
        w.area == base.area && w.start_index <= node_last && node_first <= w.end_index
    })
}

fn canonical_truthy(v: CanonicalValue) -> bool {
    match v {
        CanonicalValue::Bool(b) => b,
        CanonicalValue::U16(w) => w != 0,
    }
}

/// A type-correct zero/empty [`MappedValue`] for the given data type. Used to
/// seed a node's initial value at address-space construction.
pub fn zero_mapped(data_type: OpcUaDataType) -> MappedValue {
    match data_type {
        OpcUaDataType::Boolean => MappedValue::Boolean(false),
        OpcUaDataType::SByte => MappedValue::SByte(0),
        OpcUaDataType::Byte => MappedValue::Byte(0),
        OpcUaDataType::Int16 => MappedValue::Int16(0),
        OpcUaDataType::UInt16 => MappedValue::UInt16(0),
        OpcUaDataType::Int32 => MappedValue::Int32(0),
        OpcUaDataType::UInt32 => MappedValue::UInt32(0),
        OpcUaDataType::Int64 => MappedValue::Int64(0),
        OpcUaDataType::UInt64 => MappedValue::UInt64(0),
        OpcUaDataType::Float => MappedValue::Float(0.0),
        OpcUaDataType::Double => MappedValue::Double(0.0),
        OpcUaDataType::String => MappedValue::String(String::new()),
    }
}

// ───────────────────────── opcua bridge (feature-gated) ─────────────────────
// Variant/DataTypeId 변환만 opcua 크레이트에 의존한다.

#[cfg(feature = "opcua-server")]
pub fn data_type_id_for(data_type: OpcUaDataType) -> opcua::server::prelude::DataTypeId {
    use opcua::server::prelude::DataTypeId;
    match data_type {
        OpcUaDataType::Boolean => DataTypeId::Boolean,
        OpcUaDataType::SByte => DataTypeId::SByte,
        OpcUaDataType::Byte => DataTypeId::Byte,
        OpcUaDataType::Int16 => DataTypeId::Int16,
        OpcUaDataType::UInt16 => DataTypeId::UInt16,
        OpcUaDataType::Int32 => DataTypeId::Int32,
        OpcUaDataType::UInt32 => DataTypeId::UInt32,
        OpcUaDataType::Int64 => DataTypeId::Int64,
        OpcUaDataType::UInt64 => DataTypeId::UInt64,
        OpcUaDataType::Float => DataTypeId::Float,
        OpcUaDataType::Double => DataTypeId::Double,
        OpcUaDataType::String => DataTypeId::String,
    }
}

#[cfg(feature = "opcua-server")]
pub fn mapped_value_to_variant(value: &MappedValue) -> opcua::server::prelude::Variant {
    use opcua::server::prelude::Variant;
    match value {
        MappedValue::Boolean(v) => Variant::Boolean(*v),
        MappedValue::SByte(v) => Variant::SByte(*v),
        MappedValue::Byte(v) => Variant::Byte(*v),
        MappedValue::Int16(v) => Variant::Int16(*v),
        MappedValue::UInt16(v) => Variant::UInt16(*v),
        MappedValue::Int32(v) => Variant::Int32(*v),
        MappedValue::UInt32(v) => Variant::UInt32(*v),
        MappedValue::Int64(v) => Variant::Int64(*v),
        MappedValue::UInt64(v) => Variant::UInt64(*v),
        MappedValue::Float(v) => Variant::Float(*v),
        MappedValue::Double(v) => Variant::Double(*v),
        MappedValue::String(v) => Variant::String(v.as_str().into()),
    }
}

/// Type-correct initial Variant (zero / empty string) for node construction.
#[cfg(feature = "opcua-server")]
pub fn initial_variant_for(data_type: OpcUaDataType) -> opcua::server::prelude::Variant {
    mapped_value_to_variant(&zero_mapped(data_type))
}

/// Reads a node's typed value from canonical memory and wraps it in a
/// timestamped [`DataValue`], mapping read errors onto OPC UA status codes.
/// Used by the live node value getter.
#[cfg(feature = "opcua-server")]
pub fn read_node_data_value(
    memory: &CanonicalMemory,
    base: CanonicalAddress,
    mapping: &OpcUaMappingConfig,
    timestamps_to_return: opcua::server::prelude::TimestampsToReturn,
) -> opcua::server::prelude::DataValue {
    use opcua::server::prelude::{DataValue, DateTime, StatusCode};
    let now = DateTime::now();
    match read_node_mapped(memory, base, mapping) {
        Ok(mapped) => {
            let mut dv = DataValue::from((mapped_value_to_variant(&mapped), StatusCode::Good));
            dv.set_timestamps(timestamps_to_return, now, now);
            dv
        }
        Err(err) => {
            let status = match err {
                NodeValueError::Memory(_) => StatusCode::BadNodeIdUnknown,
                NodeValueError::Mapping(_) => StatusCode::BadUnexpectedError,
            };
            let mut dv = DataValue {
                value: None,
                status: Some(status),
                source_timestamp: None,
                source_picoseconds: None,
                server_timestamp: None,
                server_picoseconds: None,
            };
            dv.set_timestamps(timestamps_to_return, now, now);
            dv
        }
    }
}

/// Converts a client-written Variant into a [`MappedValue`] of the node's target
/// type, with lenient numeric coercion and range checking. Returns
/// `BadOutOfRange` when the value does not fit the target integer type, or
/// `BadTypeMismatch` when the Variant kind is incompatible.
#[cfg(feature = "opcua-server")]
pub fn variant_to_mapped(
    variant: &opcua::server::prelude::Variant,
    target: OpcUaDataType,
) -> Result<MappedValue, opcua::server::prelude::StatusCode> {
    use opcua::server::prelude::{StatusCode, Variant};

    let mismatch = StatusCode::BadTypeMismatch;
    let oob = StatusCode::BadOutOfRange;

    match target {
        OpcUaDataType::Boolean => match variant {
            Variant::Boolean(b) => Ok(MappedValue::Boolean(*b)),
            _ => Err(mismatch),
        },
        OpcUaDataType::SByte => {
            let n = variant_int(variant).ok_or(mismatch)?;
            i8::try_from(n).map(MappedValue::SByte).map_err(|_| oob)
        }
        OpcUaDataType::Byte => {
            let n = variant_int(variant).ok_or(mismatch)?;
            u8::try_from(n).map(MappedValue::Byte).map_err(|_| oob)
        }
        OpcUaDataType::Int16 => {
            let n = variant_int(variant).ok_or(mismatch)?;
            i16::try_from(n).map(MappedValue::Int16).map_err(|_| oob)
        }
        OpcUaDataType::UInt16 => {
            let n = variant_int(variant).ok_or(mismatch)?;
            u16::try_from(n).map(MappedValue::UInt16).map_err(|_| oob)
        }
        OpcUaDataType::Int32 => {
            let n = variant_int(variant).ok_or(mismatch)?;
            i32::try_from(n).map(MappedValue::Int32).map_err(|_| oob)
        }
        OpcUaDataType::UInt32 => {
            let n = variant_int(variant).ok_or(mismatch)?;
            u32::try_from(n).map(MappedValue::UInt32).map_err(|_| oob)
        }
        OpcUaDataType::Int64 => {
            let n = variant_int(variant).ok_or(mismatch)?;
            i64::try_from(n).map(MappedValue::Int64).map_err(|_| oob)
        }
        OpcUaDataType::UInt64 => {
            let n = variant_int(variant).ok_or(mismatch)?;
            u64::try_from(n).map(MappedValue::UInt64).map_err(|_| oob)
        }
        OpcUaDataType::Float => Ok(MappedValue::Float(variant_float(variant).ok_or(mismatch)? as f32)),
        OpcUaDataType::Double => Ok(MappedValue::Double(variant_float(variant).ok_or(mismatch)?)),
        OpcUaDataType::String => match variant {
            Variant::String(s) => Ok(MappedValue::String(s.to_string())),
            _ => Err(mismatch),
        },
    }
}

#[cfg(feature = "opcua-server")]
fn variant_int(variant: &opcua::server::prelude::Variant) -> Option<i128> {
    use opcua::server::prelude::Variant;
    match variant {
        Variant::SByte(x) => Some(*x as i128),
        Variant::Byte(x) => Some(*x as i128),
        Variant::Int16(x) => Some(*x as i128),
        Variant::UInt16(x) => Some(*x as i128),
        Variant::Int32(x) => Some(*x as i128),
        Variant::UInt32(x) => Some(*x as i128),
        Variant::Int64(x) => Some(*x as i128),
        Variant::UInt64(x) => Some(*x as i128),
        _ => None,
    }
}

#[cfg(feature = "opcua-server")]
fn variant_float(variant: &opcua::server::prelude::Variant) -> Option<f64> {
    use opcua::server::prelude::Variant;
    match variant {
        Variant::Float(x) => Some(*x as f64),
        Variant::Double(x) => Some(*x),
        other => variant_int(other).map(|n| n as f64),
    }
}
