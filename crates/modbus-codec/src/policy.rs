// Modbus 노출 매핑 정책 타입 (canonical 영역 ↔ modbus 주소공간 규칙)
//!
//! Vendor profile 에 의존하지 않는 순수 modbus 정책 표현. `profile_id` 는 어떤
//! vendor profile 이 이 정책을 만들었는지 나타내는 라벨(문자열)일 뿐이며, codec
//! 은 그 값을 해석하지 않는다.

use serde::{Deserialize, Serialize};

/// Modbus 표준 4개 주소공간.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModbusAddressSpace {
    Coil,
    DiscreteInput,
    HoldingRegister,
    InputRegister,
}

/// canonical 영역 한 구간을 modbus 주소공간으로 노출하는 단일 규칙.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModbusMappingRule {
    pub family: String,
    pub canonical_area: modone_contract::types::CanonicalAreaKind,
    pub address_space: ModbusAddressSpace,
    pub offset: u16,
    pub count: u16,
}

/// 한 PLC 프로파일에 대한 전체 modbus 노출 정책.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModbusMappingPolicy {
    /// 이 정책을 만든 vendor profile 식별 라벨 (codec 은 해석하지 않음).
    pub profile_id: String,
    pub source: ModbusMappingSource,
    pub rules: Vec<ModbusMappingRule>,
}

/// 정책이 어떻게 결정되었는지.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModbusMappingSource {
    Recommended,
    LegacyWide,
    Custom,
}
