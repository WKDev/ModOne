use std::collections::HashMap;

use crate::plc_runtime::{
    CanonicalAddress, CanonicalAreaKind, CanonicalMemory, VendorProfile,
};
use crate::project::{PlcAddressWindow, PlcHardwareTopology, PlcIoDirection, PlcSettings};
use crate::sim::tag_registry::SharedTagRegistry;
use crate::sim::types::{TagAccessLevel, TagClass, TagDefinition};

use super::mapping::{OpcUaMappingConfig, OpcUaMappingStore};
use super::memory::OpcUaNodeId;

// 순수 노드 스펙 타입/헬퍼는 address_space_spec.rs로 분리(crate 이전 대상).
// 기존 `crate::opcua::address_space::...` 경로 호환을 위해 re-export하고,
// 빌더 코드가 unqualified로 호출할 수 있게 스코프로 가져온다.
pub use super::address_space_spec::*;

fn access_level_from_tag(access: TagAccessLevel) -> OpcUaAccessLevel {
    match access {
        TagAccessLevel::ReadOnly => OpcUaAccessLevel::ReadOnly,
        TagAccessLevel::ReadWrite => OpcUaAccessLevel::ReadWrite,
    }
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

/// Build the OPC UA Address Space path segments for a tag definition.
///
/// If the tag has a `folder_path` (dot-separated, e.g. "Plant.Area1.Motors"),
/// the segments are: `["ModOne", "Tags", "Plant", "Area1", "Motors"]`.
///
/// If `folder_path` is `None` or empty after trimming, the tag's `display_name`
/// is checked for dot separators. A dot-separated display name like
/// "Plant.Area1.Temperature" auto-generates the folder path from all segments
/// except the last: `["ModOne", "Tags", "Plant", "Area1"]`.
///
/// If neither `folder_path` nor dot-separated `display_name` yields segments,
/// falls back to the default flat classification: `["ModOne", "Tags", "Raw"]`
/// or `["ModOne", "Tags", "Semantic"]`.
///
/// Empty segments from consecutive dots (e.g. "Plant..Motors") are filtered out.
fn build_tag_path_segments(tag: &TagDefinition) -> Vec<String> {
    let mut segments = vec!["ModOne".to_string(), "Tags".to_string()];

    if let Some(ref folder_path) = tag.folder_path {
        let trimmed = folder_path.trim();
        if !trimmed.is_empty() {
            // Parse dot-separated path into folder segments, filtering empty parts
            for part in trimmed.split('.') {
                let part = part.trim();
                if !part.is_empty() {
                    segments.push(part.to_string());
                }
            }
            return segments;
        }
    }

    // Auto-generate folder path from dot-separated display_name.
    // All segments except the last become folder segments.
    // e.g. "Plant.Area1.Temperature" -> folders: ["Plant", "Area1"]
    let display_parts: Vec<&str> = tag
        .display_name
        .split('.')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    if display_parts.len() > 1 {
        // All parts except the last are folder segments
        for part in &display_parts[..display_parts.len() - 1] {
            segments.push(part.to_string());
        }
        return segments;
    }

    // Fallback: flat classification by tag class
    let class_segment = match tag.class {
        TagClass::RawBacked => "Raw",
        TagClass::Semantic => "Semantic",
    };
    segments.push(class_segment.to_string());
    segments
}

pub fn build_address_space_spec(
    _canonical_memory: &CanonicalMemory,
    vendor_profile: &dyn VendorProfile,
    plc_settings: &PlcSettings,
    tag_registry: &SharedTagRegistry,
    mapping_store: Option<&OpcUaMappingStore>,
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
                engineering_unit: None,
                description: None,
                mapping: OpcUaMappingConfig::default_for_address(canonical_address),
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
                        engineering_unit: None,
                        description: None,
                        mapping: OpcUaMappingConfig::default_for_address(canonical_address),
                    });
                    push_publish_node(&mut publish_map, canonical_address, alias_node_id);
                }
            }
        }
    }

    for tag in tag_registry.list(true) {
        let node_id = OpcUaNodeId::new(format!("tag/{}", tag.tag_id));
        // Resolve the mapping config for this tag. When an explicit config is in
        // the store, its access_level and description override the tag's own. When
        // absent, fall back to a safe default derived from the canonical address
        // (and the tag's own access level). The live server uses `mapping` for the
        // node's DataType, register-span publish, and write decomposition.
        let explicit_cfg = mapping_store.and_then(|store| store.get(&tag.tag_id));
        let access_level = explicit_cfg
            .as_ref()
            .map(|cfg| access_level_from_mapping(cfg.access_level))
            .unwrap_or_else(|| access_level_from_tag(tag.access));
        let description = explicit_cfg.as_ref().and_then(|cfg| cfg.description.clone());
        let mapping = explicit_cfg
            .unwrap_or_else(|| OpcUaMappingConfig::default_for_address(tag.canonical_address));

        // Build path_segments from folderPath if present, otherwise fall back
        // to the default "Raw" or "Semantic" flat classification.
        let path_segments = build_tag_path_segments(&tag);

        nodes.push(OpcUaNodeSpec {
            node_id: node_id.clone(),
            browse_name: tag.tag_id.clone(),
            display_name: tag.display_name.clone(),
            canonical_address: tag.canonical_address,
            access_level,
            is_bool: is_bool_address(tag.canonical_address),
            path_segments,
            kind: OpcUaNodeKind::Tag,
            engineering_unit: tag.engineering_unit.clone(),
            description,
            mapping,
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
        let spec = build_address_space_spec(&memory, profile.as_ref(), &settings, &tag_registry, None);

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
                folder_path: None,
            })
            .unwrap();

        let spec = build_address_space_spec(&memory, profile.as_ref(), &settings, &tag_registry, None);
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

    #[test]
    fn live_value_getter_targets_tags_and_writable_non_tags_only() {
        use super::super::mapping::OpcUaMappingConfig;
        let address = CanonicalAddress::new(CanonicalAreaKind::DataWord, 0);
        let base = OpcUaNodeSpec {
            node_id: OpcUaNodeId::new("node/example"),
            browse_name: "Example".to_string(),
            display_name: "Example".to_string(),
            canonical_address: address,
            access_level: OpcUaAccessLevel::ReadOnly,
            is_bool: false,
            path_segments: vec!["ModOne".to_string()],
            kind: OpcUaNodeKind::RawPrimary,
            engineering_unit: None,
            description: None,
            mapping: OpcUaMappingConfig::default_for_address(address),
        };

        let raw_readonly = base.clone();
        assert!(!raw_readonly.requires_live_value_getter());

        let raw_writable = OpcUaNodeSpec {
            access_level: OpcUaAccessLevel::ReadWrite,
            ..base.clone()
        };
        assert!(raw_writable.requires_live_value_getter());

        let alias_readonly = OpcUaNodeSpec {
            kind: OpcUaNodeKind::VendorAlias,
            access_level: OpcUaAccessLevel::ReadOnly,
            ..base.clone()
        };
        assert!(!alias_readonly.requires_live_value_getter());

        let alias_writable = OpcUaNodeSpec {
            kind: OpcUaNodeKind::VendorAlias,
            access_level: OpcUaAccessLevel::ReadWrite,
            ..base.clone()
        };
        assert!(alias_writable.requires_live_value_getter());

        let tag_readonly = OpcUaNodeSpec {
            kind: OpcUaNodeKind::Tag,
            access_level: OpcUaAccessLevel::ReadOnly,
            ..base.clone()
        };
        assert!(tag_readonly.requires_live_value_getter());

        let tag_writable = OpcUaNodeSpec {
            kind: OpcUaNodeKind::Tag,
            access_level: OpcUaAccessLevel::ReadWrite,
            ..base
        };
        assert!(tag_writable.requires_live_value_getter());
    }

    #[test]
    fn tag_with_folder_path_creates_nested_hierarchy() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());
        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("pump-speed".to_string()),
                display_name: "Pump Speed".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::DataWord, 10),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: None,
                folder_path: Some("Plant.Area1.Pumps".to_string()),
            })
            .unwrap();

        let spec = build_address_space_spec(&memory, profile.as_ref(), &settings, &tag_registry, None);
        let node = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/pump-speed")
            .expect("pump-speed tag node should exist");

        assert_eq!(
            node.path_segments,
            vec![
                "ModOne".to_string(),
                "Tags".to_string(),
                "Plant".to_string(),
                "Area1".to_string(),
                "Pumps".to_string(),
            ]
        );
    }

    #[test]
    fn tag_without_folder_path_uses_class_fallback() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());
        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("no-folder".to_string()),
                display_name: "No Folder".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::DataWord, 20),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: None,
                folder_path: None,
            })
            .unwrap();

        let spec = build_address_space_spec(&memory, profile.as_ref(), &settings, &tag_registry, None);
        let node = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/no-folder")
            .expect("no-folder tag node should exist");

        assert_eq!(
            node.path_segments,
            vec![
                "ModOne".to_string(),
                "Tags".to_string(),
                "Semantic".to_string(),
            ]
        );
    }

    #[test]
    fn empty_folder_path_uses_class_fallback() {
        let tag = TagDefinition {
            tag_id: "test".to_string(),
            class: TagClass::Semantic,
            display_name: "Test".to_string(),
            binding: crate::sim::types::RuntimeBinding::tag("test"),
            canonical_address: CanonicalAddress::new(CanonicalAreaKind::DataWord, 0),
            access: crate::sim::types::TagAccessLevel::ReadWrite,
            vendor_aliases: Vec::new(),
            description: None,
            engineering_unit: None,
            folder_path: Some("".to_string()),
        };
        assert_eq!(
            build_tag_path_segments(&tag),
            vec!["ModOne", "Tags", "Semantic"]
        );
    }

    #[test]
    fn whitespace_only_folder_path_uses_class_fallback() {
        let tag = TagDefinition {
            tag_id: "test".to_string(),
            class: TagClass::RawBacked,
            display_name: "Test".to_string(),
            binding: crate::sim::types::RuntimeBinding::tag("test"),
            canonical_address: CanonicalAddress::new(CanonicalAreaKind::DataWord, 0),
            access: crate::sim::types::TagAccessLevel::ReadWrite,
            vendor_aliases: Vec::new(),
            description: None,
            engineering_unit: None,
            folder_path: Some("   ".to_string()),
        };
        assert_eq!(
            build_tag_path_segments(&tag),
            vec!["ModOne", "Tags", "Raw"]
        );
    }

    #[test]
    fn folder_path_filters_empty_segments_from_consecutive_dots() {
        let tag = TagDefinition {
            tag_id: "test".to_string(),
            class: TagClass::Semantic,
            display_name: "Test".to_string(),
            binding: crate::sim::types::RuntimeBinding::tag("test"),
            canonical_address: CanonicalAddress::new(CanonicalAreaKind::DataWord, 0),
            access: crate::sim::types::TagAccessLevel::ReadWrite,
            vendor_aliases: Vec::new(),
            description: None,
            engineering_unit: None,
            folder_path: Some("Plant..Area1...Motors".to_string()),
        };
        assert_eq!(
            build_tag_path_segments(&tag),
            vec!["ModOne", "Tags", "Plant", "Area1", "Motors"]
        );
    }

    #[test]
    fn single_segment_folder_path() {
        let tag = TagDefinition {
            tag_id: "test".to_string(),
            class: TagClass::Semantic,
            display_name: "Test".to_string(),
            binding: crate::sim::types::RuntimeBinding::tag("test"),
            canonical_address: CanonicalAddress::new(CanonicalAreaKind::DataWord, 0),
            access: crate::sim::types::TagAccessLevel::ReadWrite,
            vendor_aliases: Vec::new(),
            description: None,
            engineering_unit: None,
            folder_path: Some("Standalone".to_string()),
        };
        assert_eq!(
            build_tag_path_segments(&tag),
            vec!["ModOne", "Tags", "Standalone"]
        );
    }

    #[test]
    fn folder_path_segments_trimmed() {
        let tag = TagDefinition {
            tag_id: "test".to_string(),
            class: TagClass::Semantic,
            display_name: "Test".to_string(),
            binding: crate::sim::types::RuntimeBinding::tag("test"),
            canonical_address: CanonicalAddress::new(CanonicalAreaKind::DataWord, 0),
            access: crate::sim::types::TagAccessLevel::ReadWrite,
            vendor_aliases: Vec::new(),
            description: None,
            engineering_unit: None,
            folder_path: Some(" Plant . Area1 . Motors ".to_string()),
        };
        assert_eq!(
            build_tag_path_segments(&tag),
            vec!["ModOne", "Tags", "Plant", "Area1", "Motors"]
        );
    }

    #[test]
    fn no_folder_path_dot_display_name_auto_generates_folders() {
        let tag = TagDefinition {
            tag_id: "auto-gen".to_string(),
            class: TagClass::Semantic,
            display_name: "Plant.Area1.Temperature".to_string(),
            binding: crate::sim::types::RuntimeBinding::tag("auto-gen"),
            canonical_address: CanonicalAddress::new(CanonicalAreaKind::DataWord, 0),
            access: crate::sim::types::TagAccessLevel::ReadWrite,
            vendor_aliases: Vec::new(),
            description: None,
            engineering_unit: None,
            folder_path: None,
        };
        // All segments except the last ("Temperature") become folder segments
        assert_eq!(
            build_tag_path_segments(&tag),
            vec!["ModOne", "Tags", "Plant", "Area1"]
        );
    }

    #[test]
    fn no_folder_path_single_dot_display_name() {
        let tag = TagDefinition {
            tag_id: "single-dot".to_string(),
            class: TagClass::Semantic,
            display_name: "Pumps.PumpA".to_string(),
            binding: crate::sim::types::RuntimeBinding::tag("single-dot"),
            canonical_address: CanonicalAddress::new(CanonicalAreaKind::DataWord, 0),
            access: crate::sim::types::TagAccessLevel::ReadWrite,
            vendor_aliases: Vec::new(),
            description: None,
            engineering_unit: None,
            folder_path: None,
        };
        assert_eq!(
            build_tag_path_segments(&tag),
            vec!["ModOne", "Tags", "Pumps"]
        );
    }

    #[test]
    fn no_folder_path_no_dots_falls_back_to_class() {
        let tag = TagDefinition {
            tag_id: "plain".to_string(),
            class: TagClass::Semantic,
            display_name: "SimpleTag".to_string(),
            binding: crate::sim::types::RuntimeBinding::tag("plain"),
            canonical_address: CanonicalAddress::new(CanonicalAreaKind::DataWord, 0),
            access: crate::sim::types::TagAccessLevel::ReadWrite,
            vendor_aliases: Vec::new(),
            description: None,
            engineering_unit: None,
            folder_path: None,
        };
        assert_eq!(
            build_tag_path_segments(&tag),
            vec!["ModOne", "Tags", "Semantic"]
        );
    }

    #[test]
    fn explicit_folder_path_overrides_dot_display_name() {
        let tag = TagDefinition {
            tag_id: "override".to_string(),
            class: TagClass::Semantic,
            display_name: "Plant.Area1.Temperature".to_string(),
            binding: crate::sim::types::RuntimeBinding::tag("override"),
            canonical_address: CanonicalAddress::new(CanonicalAreaKind::DataWord, 0),
            access: crate::sim::types::TagAccessLevel::ReadWrite,
            vendor_aliases: Vec::new(),
            description: None,
            engineering_unit: None,
            folder_path: Some("Custom.Folder".to_string()),
        };
        // Explicit folderPath should take precedence over display_name parsing
        assert_eq!(
            build_tag_path_segments(&tag),
            vec!["ModOne", "Tags", "Custom", "Folder"]
        );
    }

    #[test]
    fn no_folder_path_consecutive_dots_in_display_name() {
        let tag = TagDefinition {
            tag_id: "dots".to_string(),
            class: TagClass::Semantic,
            display_name: "Plant..Area1...Temperature".to_string(),
            binding: crate::sim::types::RuntimeBinding::tag("dots"),
            canonical_address: CanonicalAddress::new(CanonicalAreaKind::DataWord, 0),
            access: crate::sim::types::TagAccessLevel::ReadWrite,
            vendor_aliases: Vec::new(),
            description: None,
            engineering_unit: None,
            folder_path: None,
        };
        // Empty segments from consecutive dots filtered out
        assert_eq!(
            build_tag_path_segments(&tag),
            vec!["ModOne", "Tags", "Plant", "Area1"]
        );
    }

    #[test]
    fn multiple_tags_same_folder_share_path_prefix() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());

        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("pump-a".to_string()),
                display_name: "Pump A".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::DataWord, 30),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: None,
                folder_path: Some("Plant.Pumps".to_string()),
            })
            .unwrap();

        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("pump-b".to_string()),
                display_name: "Pump B".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::DataWord, 31),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: None,
                folder_path: Some("Plant.Pumps".to_string()),
            })
            .unwrap();

        let spec = build_address_space_spec(&memory, profile.as_ref(), &settings, &tag_registry, None);

        let pump_a = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/pump-a")
            .unwrap();
        let pump_b = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/pump-b")
            .unwrap();

        // Both tags share the same path prefix
        assert_eq!(pump_a.path_segments, pump_b.path_segments);
        assert_eq!(
            pump_a.path_segments,
            vec![
                "ModOne".to_string(),
                "Tags".to_string(),
                "Plant".to_string(),
                "Pumps".to_string(),
            ]
        );
    }

    #[test]
    fn mapping_config_access_level_overrides_tag_access_level() {
        use super::super::mapping::{MappingAccessLevel, OpcUaMappingConfig, OpcUaMappingStore};

        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());

        // Register a tag with ReadOnly access
        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("override-test".to_string()),
                display_name: "Override Test".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::DataWord, 50),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: Some(TagAccessLevel::ReadOnly),
                folder_path: None,
            })
            .unwrap();

        // Create a mapping config with ReadWrite access level
        let mapping_store = OpcUaMappingStore::new();
        mapping_store.insert(
            "override-test".to_string(),
            OpcUaMappingConfig {
                access_level: MappingAccessLevel::ReadWrite,
                ..OpcUaMappingConfig::default_for_word()
            },
        );

        let spec = build_address_space_spec(
            &memory,
            profile.as_ref(),
            &settings,
            &tag_registry,
            Some(&mapping_store),
        );

        let node = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/override-test")
            .expect("override-test tag node should exist");

        // The mapping config's ReadWrite should override the tag's ReadOnly
        assert_eq!(node.access_level, OpcUaAccessLevel::ReadWrite);
    }

    #[test]
    fn tag_without_mapping_config_uses_tag_access_level() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());

        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("no-mapping".to_string()),
                display_name: "No Mapping".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::DataWord, 60),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: Some(TagAccessLevel::ReadWrite),
                folder_path: None,
            })
            .unwrap();

        // Empty mapping store — no override for this tag
        let mapping_store = super::super::mapping::OpcUaMappingStore::new();

        let spec = build_address_space_spec(
            &memory,
            profile.as_ref(),
            &settings,
            &tag_registry,
            Some(&mapping_store),
        );

        let node = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/no-mapping")
            .expect("no-mapping tag node should exist");

        // Falls back to tag's own access level
        assert_eq!(node.access_level, OpcUaAccessLevel::ReadWrite);
    }

    #[test]
    fn mapping_config_readonly_overrides_tag_readwrite() {
        use super::super::mapping::{MappingAccessLevel, OpcUaMappingConfig, OpcUaMappingStore};

        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());

        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("restrict-test".to_string()),
                display_name: "Restrict Test".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::DataWord, 70),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: Some(TagAccessLevel::ReadWrite),
                folder_path: None,
            })
            .unwrap();

        // Mapping config restricts to ReadOnly
        let mapping_store = OpcUaMappingStore::new();
        mapping_store.insert(
            "restrict-test".to_string(),
            OpcUaMappingConfig {
                access_level: MappingAccessLevel::ReadOnly,
                ..OpcUaMappingConfig::default_for_word()
            },
        );

        let spec = build_address_space_spec(
            &memory,
            profile.as_ref(),
            &settings,
            &tag_registry,
            Some(&mapping_store),
        );

        let node = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/restrict-test")
            .expect("restrict-test tag node should exist");

        // The mapping config's ReadOnly overrides the tag's ReadWrite
        assert_eq!(node.access_level, OpcUaAccessLevel::ReadOnly);
    }

    #[test]
    fn no_mapping_store_uses_tag_access_level() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());

        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("no-store".to_string()),
                display_name: "No Store".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::DataWord, 80),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: Some(TagAccessLevel::ReadWrite),
                folder_path: None,
            })
            .unwrap();

        // Pass None for mapping store
        let spec = build_address_space_spec(
            &memory,
            profile.as_ref(),
            &settings,
            &tag_registry,
            None,
        );

        let node = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/no-store")
            .expect("no-store tag node should exist");

        // Falls back to tag's own access level
        assert_eq!(node.access_level, OpcUaAccessLevel::ReadWrite);
    }

    #[test]
    fn description_from_mapping_config_applied_to_node_spec() {
        use super::super::mapping::{
            ByteOrder, MappingAccessLevel, OpcUaDataType, OpcUaMappingConfig, OpcUaMappingStore,
        };

        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());

        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("temp-sensor".to_string()),
                display_name: "Temperature Sensor".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::DataWord, 50),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: None,
                folder_path: None,
            })
            .unwrap();

        let mapping_store = OpcUaMappingStore::new();
        mapping_store.insert(
            "temp-sensor".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::UInt16,
                word_count: 1,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadOnly,
                description: Some("Ambient temperature reading".to_string()),
                string_config: None,
            },
        );

        let spec = build_address_space_spec(
            &memory,
            profile.as_ref(),
            &settings,
            &tag_registry,
            Some(&mapping_store),
        );

        let node = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/temp-sensor")
            .expect("temp-sensor tag node should exist");

        assert_eq!(
            node.description.as_deref(),
            Some("Ambient temperature reading")
        );
    }

    #[test]
    fn description_is_none_when_mapping_has_no_description() {
        use super::super::mapping::{
            ByteOrder, MappingAccessLevel, OpcUaDataType, OpcUaMappingConfig, OpcUaMappingStore,
        };

        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());

        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("valve-open".to_string()),
                display_name: "Valve Open".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::OutputBit, 10),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: None,
                folder_path: None,
            })
            .unwrap();

        let mapping_store = OpcUaMappingStore::new();
        mapping_store.insert(
            "valve-open".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Boolean,
                word_count: 1,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadWrite,
                description: None,
                string_config: None,
            },
        );

        let spec = build_address_space_spec(
            &memory,
            profile.as_ref(),
            &settings,
            &tag_registry,
            Some(&mapping_store),
        );

        let node = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/valve-open")
            .expect("valve-open tag node should exist");

        assert!(node.description.is_none());
    }

    #[test]
    fn description_is_none_when_no_mapping_store() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());

        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("no-desc-mapping".to_string()),
                display_name: "No Desc Mapping".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::DataWord, 65),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: None,
                folder_path: None,
            })
            .unwrap();

        let spec = build_address_space_spec(
            &memory,
            profile.as_ref(),
            &settings,
            &tag_registry,
            None,
        );

        let node = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/no-desc-mapping")
            .expect("no-desc-mapping tag node should exist");

        assert!(node.description.is_none());
    }

    #[test]
    fn raw_memory_nodes_have_no_description() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());
        let spec = build_address_space_spec(
            &memory,
            profile.as_ref(),
            &settings,
            &tag_registry,
            None,
        );

        // All raw memory and alias nodes should have description = None
        for node in &spec.nodes {
            if node.kind == OpcUaNodeKind::RawPrimary || node.kind == OpcUaNodeKind::VendorAlias {
                assert!(
                    node.description.is_none(),
                    "Raw/alias node {} should have no description",
                    node.node_id.identifier
                );
            }
        }
    }

    #[test]
    fn tag_engineering_unit_propagated_to_node_spec() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let tag_registry = std::sync::Arc::new(TagRegistry::new());

        // Register a tag WITH engineering unit
        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("temp-sensor".to_string()),
                display_name: "Temperature Sensor".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::DataWord, 100),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: Some("°C".to_string()),
                access: None,
                folder_path: None,
            })
            .unwrap();

        // Register a tag WITHOUT engineering unit
        tag_registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("flag-bit".to_string()),
                display_name: "Flag Bit".to_string(),
                binding: Some(crate::sim::types::RuntimeBinding::canonical(
                    CanonicalAddress::new(CanonicalAreaKind::InternalBit, 0),
                )),
                canonical_address: None,
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: None,
                folder_path: None,
            })
            .unwrap();

        let spec =
            build_address_space_spec(&memory, profile.as_ref(), &settings, &tag_registry, None);

        let temp_node = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/temp-sensor")
            .expect("temp-sensor tag node should exist");
        assert_eq!(
            temp_node.engineering_unit.as_deref(),
            Some("°C"),
            "Tag with engineering_unit should have it on the node spec"
        );

        let flag_node = spec
            .nodes
            .iter()
            .find(|n| n.node_id.identifier == "tag/flag-bit")
            .expect("flag-bit tag node should exist");
        assert!(
            flag_node.engineering_unit.is_none(),
            "Tag without engineering_unit should have None on the node spec"
        );

        // All raw memory and alias nodes should have engineering_unit = None
        for node in &spec.nodes {
            if node.kind == OpcUaNodeKind::RawPrimary || node.kind == OpcUaNodeKind::VendorAlias {
                assert!(
                    node.engineering_unit.is_none(),
                    "Raw/alias node {} should have no engineering_unit",
                    node.node_id.identifier
                );
            }
        }
    }
}
