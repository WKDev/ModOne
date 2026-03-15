use std::collections::HashMap;

use crate::plc_runtime::{
    CanonicalAddress, CanonicalAreaKind, CanonicalMemory, VendorProfile,
};
use crate::project::PlcSettings;

use super::memory::OpcUaNodeId;

/// OPC UA namespace index for application nodes.
pub const APP_NAMESPACE: u16 = 2;

/// Access level for OPC UA variable nodes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpcUaAccessLevel {
    ReadOnly,
    ReadWrite,
}

/// Metadata for a single OPC UA variable node.
#[derive(Debug, Clone)]
pub struct OpcUaNodeSpec {
    pub node_id: OpcUaNodeId,
    pub display_name: String,
    pub canonical_address: CanonicalAddress,
    pub access_level: OpcUaAccessLevel,
    pub is_bool: bool,
}

/// Result of building the OPC UA address space: a flat list of node specs
/// and the canonical→NodeId mapping.
pub struct AddressSpaceSpec {
    pub nodes: Vec<OpcUaNodeSpec>,
    pub node_map: HashMap<CanonicalAddress, OpcUaNodeId>,
}

/// Determine the access level for a canonical area kind.
fn access_level_for(area: CanonicalAreaKind) -> OpcUaAccessLevel {
    match area {
        // Writable areas (external protocol clients can write)
        CanonicalAreaKind::InputBit
        | CanonicalAreaKind::OutputBit
        | CanonicalAreaKind::InternalBit
        | CanonicalAreaKind::RetentiveBit
        | CanonicalAreaKind::DataWord
        | CanonicalAreaKind::RetentiveWord
        | CanonicalAreaKind::IndexWord => OpcUaAccessLevel::ReadWrite,

        // Read-only areas (internal/system use only)
        CanonicalAreaKind::SpecialBit
        | CanonicalAreaKind::TimerDoneBit
        | CanonicalAreaKind::CounterDoneBit
        | CanonicalAreaKind::SystemBit
        | CanonicalAreaKind::TimerValueWord
        | CanonicalAreaKind::CounterValueWord
        | CanonicalAreaKind::SystemWord => OpcUaAccessLevel::ReadOnly,
    }
}

/// Whether a canonical area stores boolean or word values.
fn is_bool_area(area: CanonicalAreaKind) -> bool {
    matches!(
        area,
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

/// Compute the number of nodes to expose for a given area.
///
/// For now, we expose a fixed subset to avoid creating 50k+ nodes.
/// Future versions can use hardware topology / vendor profile to refine.
fn exposure_count(area: CanonicalAreaKind) -> u32 {
    match area {
        // Primary data areas: expose a reasonable default
        CanonicalAreaKind::InputBit | CanonicalAreaKind::OutputBit => 64,
        CanonicalAreaKind::InternalBit => 256,
        CanonicalAreaKind::RetentiveBit => 128,
        CanonicalAreaKind::DataWord => 256,
        CanonicalAreaKind::RetentiveWord => 128,
        CanonicalAreaKind::IndexWord => 16,
        // System/timer/counter: expose smaller windows
        CanonicalAreaKind::SpecialBit => 32,
        CanonicalAreaKind::TimerDoneBit | CanonicalAreaKind::CounterDoneBit => 64,
        CanonicalAreaKind::SystemBit => 16,
        CanonicalAreaKind::TimerValueWord | CanonicalAreaKind::CounterValueWord => 64,
        CanonicalAreaKind::SystemWord => 16,
    }
}

/// Build the OPC UA address space specification from canonical memory layout.
///
/// This generates the node hierarchy and mapping without depending on the
/// opcua crate, so it can be used for both building the actual server address
/// space and for testing.
pub fn build_address_space_spec(
    _canonical_memory: &CanonicalMemory,
    vendor_profile: &dyn VendorProfile,
    _plc_settings: &PlcSettings,
) -> AddressSpaceSpec {
    let mut nodes = Vec::new();
    let mut node_map = HashMap::new();

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

    // Create nodes for each canonical memory area
    for area in &all_areas {
        let count = exposure_count(*area).min(area.default_size() as u32);
        let access = access_level_for(*area);
        let is_bool = is_bool_area(*area);
        let area_name = format!("{:?}", area);

        for index in 0..count {
            let canonical_addr = CanonicalAddress::new(*area, index);
            let node_id_str = format!("{:?}.{}", area, index);
            let node_id = OpcUaNodeId::new(APP_NAMESPACE, &node_id_str);
            let display_name = format!("{}[{}]", area_name, index);

            nodes.push(OpcUaNodeSpec {
                node_id: node_id.clone(),
                display_name,
                canonical_address: canonical_addr,
                access_level: access,
                is_bool,
            });

            node_map.insert(canonical_addr, node_id);
        }
    }

    // Add vendor aliases if the policy allows it
    let alias_policy = vendor_profile.opcua_alias_policy();
    if alias_policy.expose_vendor_aliases {
        let namespace_segment = &alias_policy.namespace_segment;

        // For each mapped node, look up vendor aliases
        let mapped_addresses: Vec<CanonicalAddress> = node_map.keys().copied().collect();
        for canonical_addr in &mapped_addresses {
            let vendor_aliases = vendor_profile.canonical_aliases(canonical_addr);
            for alias in &vendor_aliases {
                let alias_str = vendor_profile
                    .format_address(alias)
                    .unwrap_or_else(|_| format!("{}{}", alias.family, alias.index));
                let alias_node_id_str = format!("{}.{}", namespace_segment, alias_str);
                let alias_node_id = OpcUaNodeId::new(APP_NAMESPACE, &alias_node_id_str);

                // Alias nodes point to the same canonical address but have
                // a different NodeId. We don't add them to the node_map
                // (canonical→NodeId is 1:1), but we do add them to the nodes list.
                nodes.push(OpcUaNodeSpec {
                    node_id: alias_node_id,
                    display_name: alias_str,
                    canonical_address: *canonical_addr,
                    access_level: access_level_for(canonical_addr.area),
                    is_bool: is_bool_area(canonical_addr.area),
                });
            }
        }
    }

    AddressSpaceSpec { nodes, node_map }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plc_runtime::{resolve_vendor_profile, CanonicalMemory};
    use crate::project::{PlcManufacturer, PlcSettings, PlcHardwareTopology};

    fn ls_settings() -> PlcSettings {
        PlcSettings {
            manufacturer: PlcManufacturer::LS,
            model: "XGK".to_string(),
            scan_time_ms: 10,
            hardware_topology: PlcHardwareTopology::default(),
        }
    }

    #[test]
    fn builds_nodes_for_all_canonical_areas() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let spec = build_address_space_spec(&memory, profile.as_ref(), &settings);

        // Should have nodes for all 14 area kinds
        assert!(!spec.nodes.is_empty());
        assert!(!spec.node_map.is_empty());

        // DataWord should have 256 nodes
        let dw_count = spec.nodes.iter()
            .filter(|n| n.canonical_address.area == CanonicalAreaKind::DataWord)
            .count();
        assert!(dw_count >= 256, "Expected >=256 DataWord nodes, got {}", dw_count);
    }

    #[test]
    fn access_levels_match_canonical_constraints() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let spec = build_address_space_spec(&memory, profile.as_ref(), &settings);

        for node in &spec.nodes {
            match node.canonical_address.area {
                CanonicalAreaKind::DataWord | CanonicalAreaKind::InternalBit => {
                    assert_eq!(node.access_level, OpcUaAccessLevel::ReadWrite);
                }
                CanonicalAreaKind::SpecialBit | CanonicalAreaKind::SystemWord => {
                    assert_eq!(node.access_level, OpcUaAccessLevel::ReadOnly);
                }
                _ => {}
            }
        }
    }

    #[test]
    fn vendor_aliases_included_when_policy_allows() {
        let memory = CanonicalMemory::new();
        let settings = ls_settings();
        let profile = resolve_vendor_profile(&settings).unwrap();
        let policy = profile.opcua_alias_policy();

        let spec = build_address_space_spec(&memory, profile.as_ref(), &settings);

        if policy.expose_vendor_aliases {
            // Should have vendor alias nodes (more nodes than unique canonical addresses)
            let unique_canonical = spec.node_map.len();
            let total_nodes = spec.nodes.len();
            assert!(
                total_nodes > unique_canonical,
                "Expected vendor alias nodes, got {} total vs {} unique",
                total_nodes,
                unique_canonical
            );
        }
    }
}
