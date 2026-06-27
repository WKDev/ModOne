// OPC UA 매핑 레이어의 모듈 선언과 공개 API 재노출 진입점
//! OPC UA data type mapping layer.
//!
//! Converts between PLC core types ([`CanonicalValue`] Bool/U16) and all OPC UA
//! standard basic types. Each tag can carry its own [`OpcUaMappingConfig`] that
//! specifies the target OPC UA data type, register span (word count), byte
//! order, access level, and an optional description.

mod byte_order;
mod config;
mod convert;
mod deadband;
mod scaling;
mod store;
mod string_codec;
mod types;

#[cfg(test)]
mod tests;

pub use byte_order::ByteOrder;
pub use config::{OpcUaMappingConfig, StringEncoding, StringMappingConfig};
pub use deadband::{passes_deadband, DeadbandConfig, DeadbandKind};
pub use scaling::{eng_to_raw, raw_to_eng, ScalingConfig, ScalingKind};
pub use convert::{
    f32_to_registers, f64_to_registers, read_bool_mapped, read_registers_to_mapped,
    registers_to_f32, registers_to_f64, write_bool_mapped, write_mapped_to_registers,
};
pub use store::{OpcUaMappingStore, SharedMappingStore};
pub use string_codec::{registers_to_string, string_to_registers};
pub use types::{MappedValue, MappingAccessLevel, MappingError, OpcUaDataType, RegisterRange};
