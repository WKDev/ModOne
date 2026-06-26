// OPC UA 주소공간의 순수(전송/프로젝트 비결합) 노드 스펙 타입과 헬퍼
//
// 여기 항목들은 canonical 타입(modone-contract)·매핑·노드ID만 의존하며
// project/sim에 결합되지 않는다. 프로젝트 토폴로지/태그로부터 이 스펙을
// 빌드하는 `build_address_space_spec`은 project 의존이라 `address_space.rs`
// (src-tauri 잔류)에 둔다. 이 파일은 opcua-codec 크레이트로 이전될 순수 코어다.

use std::collections::HashMap;

use crate::plc_runtime::{CanonicalAccess, CanonicalAddress, CanonicalAreaKind};

use super::mapping::MappingAccessLevel;
use super::memory::OpcUaNodeId;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpcUaAccessLevel {
    ReadOnly,
    ReadWrite,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpcUaNodeKind {
    RawPrimary,
    Tag,
    VendorAlias,
}

#[derive(Debug, Clone)]
pub struct OpcUaNodeSpec {
    pub node_id: OpcUaNodeId,
    pub browse_name: String,
    pub display_name: String,
    pub canonical_address: CanonicalAddress,
    pub access_level: OpcUaAccessLevel,
    pub is_bool: bool,
    pub path_segments: Vec<String>,
    pub kind: OpcUaNodeKind,
    /// Optional engineering unit string (e.g. "°C", "bar", "RPM").
    /// When present, exposed as an OPC UA `EngineeringUnits` property
    /// (`EUInformation` extension object) on the Variable node.
    pub engineering_unit: Option<String>,
    /// Optional human-readable description for the OPC UA Variable node's
    /// Description attribute. Sourced from [`OpcUaMappingConfig::description`].
    pub description: Option<String>,
}

impl OpcUaNodeSpec {
    pub fn requires_live_value_getter(&self) -> bool {
        match self.kind {
            OpcUaNodeKind::Tag => true,
            OpcUaNodeKind::RawPrimary | OpcUaNodeKind::VendorAlias => {
                self.access_level == OpcUaAccessLevel::ReadWrite
            }
        }
    }
}

pub struct AddressSpaceSpec {
    pub nodes: Vec<OpcUaNodeSpec>,
    pub primary_node_map: HashMap<CanonicalAddress, OpcUaNodeId>,
    pub publish_map: HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
}

pub(crate) fn access_level_from_canonical(access: CanonicalAccess) -> OpcUaAccessLevel {
    match access {
        CanonicalAccess::ReadWrite => OpcUaAccessLevel::ReadWrite,
        CanonicalAccess::ReadOnly | CanonicalAccess::InternalOnly => OpcUaAccessLevel::ReadOnly,
    }
}

pub(crate) fn access_level_from_mapping(level: MappingAccessLevel) -> OpcUaAccessLevel {
    match level {
        MappingAccessLevel::ReadOnly => OpcUaAccessLevel::ReadOnly,
        MappingAccessLevel::ReadWrite => OpcUaAccessLevel::ReadWrite,
    }
}

/// Returns `true` when the canonical address refers to a boolean (bit) memory area.
///
/// This is the canonical `is_bool` detection used across the OPC UA module to
/// decide whether a register should be presented as `Boolean` or `UInt16`.
pub fn is_bool_address(address: CanonicalAddress) -> bool {
    address.bit_index.is_some()
        || matches!(
            address.area,
            CanonicalAreaKind::InputBit
                | CanonicalAreaKind::OutputBit
                | CanonicalAreaKind::InternalBit
                | CanonicalAreaKind::RetentiveBit
                | CanonicalAreaKind::SpecialBit
                | CanonicalAreaKind::TimerDoneBit
                | CanonicalAreaKind::CounterDoneBit
                | CanonicalAreaKind::SystemBit
        )
}

pub(crate) fn push_publish_node(
    publish_map: &mut HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
    address: CanonicalAddress,
    node_id: OpcUaNodeId,
) {
    publish_map.entry(address).or_default().push(node_id);
}
