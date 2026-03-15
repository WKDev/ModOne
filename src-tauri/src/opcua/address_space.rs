use std::collections::HashMap;

use crate::plc_runtime::{
    CanonicalAccess, CanonicalAddress, CanonicalAreaKind, CanonicalMemory, VendorProfile,
};
use crate::project::{PlcAddressWindow, PlcHardwareTopology, PlcIoDirection, PlcSettings};
use crate::sim::tag_registry::SharedTagRegistry;
use crate::sim::types::{TagAccessLevel, TagClass};

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
}

pub struct AddressSpaceSpec {
    pub nodes: Vec<OpcUaNodeSpec>,
    pub primary_node_map: HashMap<CanonicalAddress, OpcUaNodeId>,
    pub publish_map: HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
}

fn access_level_from_canonical(access: CanonicalAccess) -> OpcUaAccessLevel {
    match access {
        CanonicalAccess::ReadWrite => OpcUaAccessLevel::ReadWrite,
        CanonicalAccess::ReadOnly | CanonicalAccess::InternalOnly => OpcUaAccessLevel::ReadOnly,
    }
}

fn access_level_from_tag(access: TagAccessLevel) -> OpcUaAccessLevel {
    match access {
        TagAccessLevel::ReadOnly => OpcUaAccessLevel::ReadOnly,
        TagAccessLevel::ReadWrite => OpcUaAccessLevel::ReadWrite,
    }
}

fn is_bool_address(address: CanonicalAddress) -> bool {
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

fn documented_default_exposure(area: CanonicalAreaKind) -> u32 {
    match area {
        CanonicalAreaKind::InputBit | CanonicalAreaKind::OutputBit => 256,
        CanonicalAreaKind::InternalBit => 512,
        CanonicalAreaKind::RetentiveBit => 256,
        CanonicalAreaKind::DataWord => 512,
        CanonicalAreaKind::RetentiveWord => 256,
        CanonicalAreaKind::IndexWord => 32,
        CanonicalAreaKind::SpecialBit => 64,
        CanonicalAreaKind::TimerDoneBit | CanonicalAreaKind::CounterDoneBit => 128,
        CanonicalAreaKind::SystemBit => 32,
        CanonicalAreaKind::TimerValueWord | CanonicalAreaKind::CounterValueWord => 128,
        CanonicalAreaKind::SystemWord => 32,
    }
}

fn topology_exposure_limit(area: CanonicalAreaKind, topology: &PlcHardwareTopology) -> Option<u32> {
    let mut max_limit: Option<u32> = None;
    for rack in &topology.racks {
        for module in &rack.modules {
            for window in &module.address_windows {
                if window_matches_area(area, window) {
                    let end = window.start.saturating_add(window.count);
                    max_limit = Some(max_limit.map_or(end, |current| current.max(end)));
                }
            }
        }
    }
    max_limit
}

fn window_matches_area(area: CanonicalAreaKind, window: &PlcAddressWindow) -> bool {
    let family = window.family.trim().to_uppercase();
    match area {
        CanonicalAreaKind::InputBit => {
            family == "X" || (family == "P" && window.io_direction != Some(PlcIoDirection::Output))
        }
        CanonicalAreaKind::OutputBit => {
            family == "Y" || (family == "P" && window.io_direction != Some(PlcIoDirection::Input))
        }
        CanonicalAreaKind::InternalBit => family == "M",
        CanonicalAreaKind::RetentiveBit => family == "K" || family == "L",
        CanonicalAreaKind::SpecialBit => family == "F",
        CanonicalAreaKind::DataWord => family == "D",
        CanonicalAreaKind::RetentiveWord => family == "R",
        CanonicalAreaKind::IndexWord => family == "Z",
        CanonicalAreaKind::TimerDoneBit | CanonicalAreaKind::TimerValueWord => {
            family == "T" || family == "TD"
        }
        CanonicalAreaKind::CounterDoneBit | CanonicalAreaKind::CounterValueWord => {
            family == "C" || family == "CD"
        }
        CanonicalAreaKind::SystemBit => family == "SB",
        CanonicalAreaKind::SystemWord => family == "SW" || family == "N",
    }
}

fn raw_exposure_limit(area: CanonicalAreaKind, plc_settings: &PlcSettings) -> u32 {
    let topology_limit = topology_exposure_limit(area, &plc_settings.hardware_topology);
    topology_limit
        .unwrap_or_else(|| documented_default_exposure(area))
        .min(area.default_size() as u32)
}

fn push_publish_node(
    publish_map: &mut HashMap<CanonicalAddress, Vec<OpcUaNodeId>>,
    address: CanonicalAddress,
    node_id: OpcUaNodeId,
) {
    publish_map.entry(address).or_default().push(node_id);
}

pub fn build_address_space_spec(
    _canonical_memory: &CanonicalMemory,
    vendor_profile: &dyn VendorProfile,
    plc_settings: &PlcSettings,
    tag_registry: &SharedTagRegistry,
) -> AddressSpaceSpec {
    let mut nodes = Vec::new();
    let mut primary_node_map = HashMap::new();
    let mut publish_map: HashMap<CanonicalAddress, Vec<OpcUaNodeId>> = HashMap::new();

    let all_areas = [
        CanonicalAreaKind::InputBit,
        CanonicalAreaKind::OutputBit,
        CanonicalAreaKind::InternalBit,
        CanonicalAreaKind::RetentiveBit,
        CanonicalAreaKind::SpecialBit,
        CanonicalAreaKind::TimerDoneBit,
        CanonicalAreaKind::CounterDoneBit,
        CanonicalAreaKind::SystemBit,
        CanonicalAreaKind::DataWord,
        CanonicalAreaKind::RetentiveWord,
        CanonicalAreaKind::IndexWord,
        CanonicalAreaKind::TimerValueWord,
        CanonicalAreaKind::CounterValueWord,
        CanonicalAreaKind::SystemWord,
    ];

    for area in all_areas {
        let count = raw_exposure_limit(area, plc_settings);
        let access_level = access_level_from_canonical(area.default_access());
        let area_name = format!("{area:?}");

        for index in 0..count {
            let canonical_address = CanonicalAddress::new(area, index);
            let browse_name = format!("{area_name}[{index}]");
            let node_id = OpcUaNodeId::new(format!("raw/{area_name}/{index}"));

            nodes.push(OpcUaNodeSpec {
                node_id: node_id.clone(),
                browse_name: browse_name.clone(),
                display_name: browse_name,
                canonical_address,
                access_level,
                is_bool: is_bool_address(canonical_address),
                path_segments: vec![
                    "ModOne".to_string(),
                    "RawMemory".to_string(),
                    area_name.clone(),
                ],
                kind: OpcUaNodeKind::RawPrimary,
            });

            primary_node_map.insert(canonical_address, node_id.clone());
            push_publish_node(&mut publish_map, canonical_address, node_id.clone());

            let alias_policy = vendor_profile.opcua_alias_policy();
            if alias_policy.expose_vendor_aliases {
                for alias in vendor_profile.canonical_aliases(&canonical_address) {
                    let alias_str = vendor_profile
                        .format_address(&alias)
                        .unwrap_or_else(|_| format!("{}{}", alias.family, alias.index));
                    let alias_node_id = OpcUaNodeId::new(format!(
                        "alias/{}/{}",
                        alias_policy.namespace_segment, alias_str
                    ));
                    nodes.push(OpcUaNodeSpec {
                        node_id: alias_node_id.clone(),
                        browse_name: alias_str.clone(),
                        display_name: alias_str,
                        canonical_address,
                        access_level,
                        is_bool: is_bool_address(canonical_address),
                        path_segments: vec![
                            "ModOne".to_string(),
                            "RawMemory".to_string(),
                            "Aliases".to_string(),
                            alias_policy.namespace_segment.clone(),
                        ],
                        kind: OpcUaNodeKind::VendorAlias,
                    });
                    push_publish_node(&mut publish_map, canonical_address, alias_node_id);
                }
            }
        }
    }

    for tag in tag_registry.list(true) {
        let class_segment = match tag.class {
            TagClass::RawBacked => "Raw",
            TagClass::Semantic => "Semantic",
        };
        let node_id = OpcUaNodeId::new(format!("tag/{}", tag.tag_id));
        let access_level = access_level_from_tag(tag.access);

        nodes.push(OpcUaNodeSpec {
            node_id: node_id.clone(),
            browse_name: tag.tag_id.clone(),
            display_name: tag.display_name.clone(),
            canonical_address: tag.canonical_address,
            access_level,
            is_bool: is_bool_address(tag.canonical_address),
            path_segments: vec![
                "ModOne".to_string(),
                "Tags".to_string(),
                class_segment.to_string(),
            ],
            kind: OpcUaNodeKind::Tag,
        });
        push_publish_node(&mut publish_map, tag.canonical_address, node_id);
    }

    AddressSpaceSpec {
        nodes,
        primary_node_map,
        publish_map,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plc_runtime::{resolve_vendor_profile, CanonicalMemory};
    use crate::project::{PlcHardwareTopology, PlcManufacturer};
    use crate::sim::tag_registry::TagRegistry;
    use crate::sim::types::RegisterTagRequest;

    fn ls_settings() -> PlcSettings {
        PlcSettings {
            manufacturer: PlcManufacturer::LS,
            model: "XGK".to_string(),
            scan_time_ms: 10,
            hardware_topology: PlcHardwareTopology::default(),
        }
    }

    #[test]
    fn builds_primary_raw_memory_nodes() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());
        let spec = build_address_space_spec(&memory, profile.as_ref(), &settings, &tag_registry);

        assert!(spec.nodes.iter().any(|node| node.path_segments
            == vec![
                "ModOne".to_string(),
                "RawMemory".to_string(),
                "DataWord".to_string(),
            ]));
        assert!(spec
            .primary_node_map
            .contains_key(&CanonicalAddress::new(CanonicalAreaKind::DataWord, 0)));
    }

    #[test]
    fn includes_semantic_tags_under_tags_namespace() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());
        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("motor-run".to_string()),
                display_name: "Motor Run".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::OutputBit, 3),
                )),
                canonical_address: None,
                vendor_aliases: vec!["Y3".to_string()],
                description: None,
                engineering_unit: None,
                access: None,
            })
            .unwrap();

        let spec = build_address_space_spec(&memory, profile.as_ref(), &settings, &tag_registry);
        assert!(spec.nodes.iter().any(|node| {
            node.kind == OpcUaNodeKind::Tag
                && node.node_id.identifier == "tag/motor-run"
                && node.path_segments
                    == vec![
                        "ModOne".to_string(),
                        "Tags".to_string(),
                        "Semantic".to_string(),
                    ]
        }));
    }
}
