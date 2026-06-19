//! NodeSet2 XML export for OPC UA tag information models.
//!
//! Generates OPC UA NodeSet2 XML documents conforming to the
//! `http://opcfoundation.org/UA/2011/03/UANodeSet.xsd` schema.
//! This is export-only — no NodeSet2 XML import is supported.
//!
//! The generated XML includes:
//! - Proper OPC UA namespace declarations (namespace index 0 = OPC UA, 1 = application)
//! - Standard type/reference aliases
//! - Root folder hierarchy (Objects → ModOne → Tags → user folders)
//! - UAVariable nodes for each semantic tag with correct DataType and AccessLevel
//! - ModellingRule references where appropriate

use std::collections::{BTreeSet, HashMap};
use std::fmt::Write as FmtWrite;

use crate::opcua::{MappingAccessLevel, OpcUaDataType, OpcUaMappingConfig};
use crate::sim::types::{TagAccessLevel, TagDefinition};

// ============================================================================
// Constants — OPC UA well-known NodeIds
// ============================================================================

/// OPC UA Objects folder (i=85) — root container for all object instances.
const OBJECTS_FOLDER_NODE_ID: &str = "i=85";

/// OPC UA well-known reference type NodeIds.
const ORGANIZES_REF: &str = "i=35";
const HAS_TYPE_DEFINITION_REF: &str = "i=40";
const HAS_COMPONENT_REF: &str = "i=47";
const HAS_MODELLING_RULE_REF: &str = "i=37";

/// OPC UA well-known type definition NodeIds.
const FOLDER_TYPE_NODE_ID: &str = "i=61";
const BASE_DATA_VARIABLE_TYPE_NODE_ID: &str = "i=63";

/// ModellingRule — Mandatory (i=78): the node must exist in every instance.
const MODELLING_RULE_MANDATORY: &str = "i=78";

/// OPC UA DataType NodeIds for the Aliases section.
const DATA_TYPE_ALIASES: &[(&str, &str)] = &[
    ("Boolean", "i=1"),
    ("SByte", "i=2"),
    ("Byte", "i=3"),
    ("Int16", "i=4"),
    ("UInt16", "i=5"),
    ("Int32", "i=6"),
    ("UInt32", "i=7"),
    ("Int64", "i=8"),
    ("UInt64", "i=9"),
    ("Float", "i=10"),
    ("Double", "i=11"),
    ("String", "i=12"),
];

/// OPC UA reference/type aliases for the Aliases section.
const REF_TYPE_ALIASES: &[(&str, &str)] = &[
    ("Organizes", ORGANIZES_REF),
    ("HasComponent", HAS_COMPONENT_REF),
    ("HasTypeDefinition", HAS_TYPE_DEFINITION_REF),
    ("HasModellingRule", HAS_MODELLING_RULE_REF),
    ("FolderType", FOLDER_TYPE_NODE_ID),
    ("BaseDataVariableType", BASE_DATA_VARIABLE_TYPE_NODE_ID),
    ("ModellingRule_Mandatory", MODELLING_RULE_MANDATORY),
];

/// Default application namespace URI.
const DEFAULT_NAMESPACE_URI: &str = "urn:modone:opcua:tags";

// ============================================================================
// Public API
// ============================================================================

/// Configuration for NodeSet2 XML generation.
#[derive(Debug, Clone)]
pub struct NodeSet2ExportConfig {
    /// Application namespace URI (ns=1). Defaults to `urn:modone:opcua:tags`.
    pub namespace_uri: String,
    /// Whether to include ModellingRule references on variable nodes.
    pub include_modelling_rules: bool,
}

impl Default for NodeSet2ExportConfig {
    fn default() -> Self {
        Self {
            namespace_uri: DEFAULT_NAMESPACE_URI.to_string(),
            include_modelling_rules: true,
        }
    }
}

/// Generates a complete NodeSet2 XML document for the given tags and their OPC UA mappings.
///
/// The document structure:
/// ```text
/// <UANodeSet>
///   <NamespaceUris>
///     <Uri>urn:modone:opcua:tags</Uri>
///   </NamespaceUris>
///   <Aliases>...</Aliases>
///   <UAObject> ModOne (root folder under Objects) </UAObject>
///   <UAObject> ModOne/Tags </UAObject>
///   <UAObject> ... sub-folders from tag folder_path ... </UAObject>
///   <UAVariable> ... tag nodes ... </UAVariable>
/// </UANodeSet>
/// ```
pub fn generate_nodeset2_xml(
    tags: &[TagDefinition],
    mapping_snapshot: &HashMap<String, OpcUaMappingConfig>,
    config: &NodeSet2ExportConfig,
) -> Result<String, String> {
    let mut xml = String::with_capacity(4096 + tags.len() * 512);

    // XML declaration
    writeln!(xml, r#"<?xml version="1.0" encoding="utf-8"?>"#).unwrap();

    // UANodeSet root element with namespace declarations
    write_nodeset_open(&mut xml);

    // NamespaceUris — only our application namespace (ns=1)
    write_namespace_uris(&mut xml, &config.namespace_uri);

    // Aliases — standard OPC UA data type and reference type aliases
    write_aliases(&mut xml);

    // Collect all unique folder paths from tags to build the folder hierarchy
    let folder_paths = collect_folder_paths(tags);

    // Root folder: ModOne (organized under Objects i=85)
    write_root_folder(&mut xml);

    // Tags folder: ModOne/Tags
    write_tags_folder(&mut xml);

    // Sub-folders derived from tag folder_path values
    for path in &folder_paths {
        write_sub_folder(&mut xml, path);
    }

    // UAVariable nodes for each tag
    for tag in tags {
        let mapping = mapping_snapshot
            .get(&tag.tag_id)
            .cloned()
            .unwrap_or_else(|| OpcUaMappingConfig::default_for_address(tag.canonical_address));

        write_variable_node(&mut xml, tag, &mapping, config.include_modelling_rules);
    }

    // Close UANodeSet
    writeln!(xml, "</UANodeSet>").unwrap();

    Ok(xml)
}

/// Generates just the document skeleton (namespaces, aliases, root folders)
/// without any tag variable nodes. Useful for testing the structure.
pub fn generate_nodeset2_skeleton(config: &NodeSet2ExportConfig) -> String {
    let mut xml = String::with_capacity(2048);

    writeln!(xml, r#"<?xml version="1.0" encoding="utf-8"?>"#).unwrap();
    write_nodeset_open(&mut xml);
    write_namespace_uris(&mut xml, &config.namespace_uri);
    write_aliases(&mut xml);
    write_root_folder(&mut xml);
    write_tags_folder(&mut xml);
    writeln!(xml, "</UANodeSet>").unwrap();

    xml
}

// ============================================================================
// XML Writing Helpers
// ============================================================================

/// Writes the opening `<UANodeSet>` tag with all required XML namespace declarations.
fn write_nodeset_open(xml: &mut String) {
    writeln!(
        xml,
        r#"<UANodeSet xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd"
           xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xmlns:xsd="http://www.w3.org/2001/XMLSchema">"#
    )
    .unwrap();
}

/// Writes the `<NamespaceUris>` element declaring the application namespace (ns=1).
///
/// Namespace index 0 is implicitly the OPC UA standard namespace
/// (`http://opcfoundation.org/UA/`). The first URI listed becomes ns=1.
fn write_namespace_uris(xml: &mut String, namespace_uri: &str) {
    writeln!(xml, "  <NamespaceUris>").unwrap();
    writeln!(xml, "    <Uri>{}</Uri>", xml_escape(namespace_uri)).unwrap();
    writeln!(xml, "  </NamespaceUris>").unwrap();
}

/// Writes the `<Aliases>` element with standard OPC UA NodeId aliases.
///
/// These aliases allow the rest of the document to use human-readable names
/// (e.g. `Boolean`, `Organizes`) instead of raw NodeId strings.
fn write_aliases(xml: &mut String) {
    writeln!(xml, "  <Aliases>").unwrap();

    for (alias, node_id) in DATA_TYPE_ALIASES {
        writeln!(
            xml,
            r#"    <Alias Alias="{}">{}</Alias>"#,
            alias, node_id
        )
        .unwrap();
    }

    for (alias, node_id) in REF_TYPE_ALIASES {
        writeln!(
            xml,
            r#"    <Alias Alias="{}">{}</Alias>"#,
            alias, node_id
        )
        .unwrap();
    }

    writeln!(xml, "  </Aliases>").unwrap();
}

/// Writes the root `ModOne` folder node organized under the OPC UA Objects folder (i=85).
fn write_root_folder(xml: &mut String) {
    writeln!(xml, r#"  <UAObject NodeId="ns=1;s=ModOne" BrowseName="1:ModOne" ParentNodeId="{OBJECTS_FOLDER_NODE_ID}">"#).unwrap();
    writeln!(xml, "    <DisplayName>ModOne</DisplayName>").unwrap();
    writeln!(xml, "    <References>").unwrap();
    writeln!(
        xml,
        r#"      <Reference ReferenceType="Organizes" IsForward="false">{OBJECTS_FOLDER_NODE_ID}</Reference>"#
    )
    .unwrap();
    writeln!(
        xml,
        r#"      <Reference ReferenceType="HasTypeDefinition">{FOLDER_TYPE_NODE_ID}</Reference>"#
    )
    .unwrap();
    writeln!(xml, "    </References>").unwrap();
    writeln!(xml, "  </UAObject>").unwrap();
}

/// Writes the `Tags` folder node under the `ModOne` root folder.
fn write_tags_folder(xml: &mut String) {
    writeln!(
        xml,
        r#"  <UAObject NodeId="ns=1;s=ModOne.Tags" BrowseName="1:Tags" ParentNodeId="ns=1;s=ModOne">"#
    )
    .unwrap();
    writeln!(xml, "    <DisplayName>Tags</DisplayName>").unwrap();
    writeln!(xml, "    <References>").unwrap();
    writeln!(
        xml,
        r#"      <Reference ReferenceType="Organizes" IsForward="false">ns=1;s=ModOne</Reference>"#
    )
    .unwrap();
    writeln!(
        xml,
        r#"      <Reference ReferenceType="HasTypeDefinition">{FOLDER_TYPE_NODE_ID}</Reference>"#
    )
    .unwrap();
    writeln!(xml, "    </References>").unwrap();
    writeln!(xml, "  </UAObject>").unwrap();
}

/// Writes a sub-folder `UAObject` node for a dot-separated folder path.
///
/// For example, folder_path `"Plant.Area1.Motors"` generates three folder nodes:
/// - `ModOne.Tags.Plant` (parent: `ModOne.Tags`)
/// - `ModOne.Tags.Plant.Area1` (parent: `ModOne.Tags.Plant`)
/// - `ModOne.Tags.Plant.Area1.Motors` (parent: `ModOne.Tags.Plant.Area1`)
///
/// Note: `collect_folder_paths` already expands these, so this function writes
/// exactly one folder for the given full path.
fn write_sub_folder(xml: &mut String, folder_path: &str) {
    let node_id = format!("ns=1;s=ModOne.Tags.{}", folder_path);
    let parent_node_id = parent_folder_node_id(folder_path);

    // BrowseName is the last segment of the path
    let browse_name = folder_path
        .rsplit('.')
        .next()
        .unwrap_or(folder_path);

    writeln!(
        xml,
        r#"  <UAObject NodeId="{}" BrowseName="1:{}" ParentNodeId="{}">"#,
        xml_escape(&node_id),
        xml_escape(browse_name),
        xml_escape(&parent_node_id),
    )
    .unwrap();
    writeln!(
        xml,
        "    <DisplayName>{}</DisplayName>",
        xml_escape(browse_name)
    )
    .unwrap();
    writeln!(xml, "    <References>").unwrap();
    writeln!(
        xml,
        r#"      <Reference ReferenceType="Organizes" IsForward="false">{}</Reference>"#,
        xml_escape(&parent_node_id),
    )
    .unwrap();
    writeln!(
        xml,
        r#"      <Reference ReferenceType="HasTypeDefinition">{FOLDER_TYPE_NODE_ID}</Reference>"#,
    )
    .unwrap();
    writeln!(xml, "    </References>").unwrap();
    writeln!(xml, "  </UAObject>").unwrap();
}

/// Writes a `UAVariable` node for a single tag.
fn write_variable_node(
    xml: &mut String,
    tag: &TagDefinition,
    mapping: &OpcUaMappingConfig,
    include_modelling_rules: bool,
) {
    let node_id = format!("ns=1;s={}", tag.tag_id);
    let data_type = opcua_data_type_alias(&mapping.opcua_data_type);
    let access_level = opcua_access_level_value(&mapping.access_level, &tag.access);

    // Determine the parent folder for this tag
    let parent_node_id = match &tag.folder_path {
        Some(fp) if !fp.is_empty() => format!("ns=1;s=ModOne.Tags.{}", fp),
        _ => "ns=1;s=ModOne.Tags".to_string(),
    };

    write!(
        xml,
        r#"  <UAVariable NodeId="{}" BrowseName="1:{}" DataType="{}" AccessLevel="{}" ParentNodeId="{}">"#,
        xml_escape(&node_id),
        xml_escape(&tag.tag_id),
        data_type,
        access_level,
        xml_escape(&parent_node_id),
    )
    .unwrap();
    writeln!(xml).unwrap();

    writeln!(
        xml,
        "    <DisplayName>{}</DisplayName>",
        xml_escape(&tag.display_name)
    )
    .unwrap();

    // Optional description
    if let Some(ref desc) = tag.description {
        if !desc.is_empty() {
            writeln!(
                xml,
                "    <Description>{}</Description>",
                xml_escape(desc)
            )
            .unwrap();
        }
    }

    // References
    writeln!(xml, "    <References>").unwrap();

    // Inverse Organizes reference to parent folder
    writeln!(
        xml,
        r#"      <Reference ReferenceType="HasComponent" IsForward="false">{}</Reference>"#,
        xml_escape(&parent_node_id),
    )
    .unwrap();

    // HasTypeDefinition → BaseDataVariableType
    writeln!(
        xml,
        r#"      <Reference ReferenceType="HasTypeDefinition">{BASE_DATA_VARIABLE_TYPE_NODE_ID}</Reference>"#,
    )
    .unwrap();

    // Optional ModellingRule reference
    if include_modelling_rules {
        writeln!(
            xml,
            r#"      <Reference ReferenceType="HasModellingRule">{MODELLING_RULE_MANDATORY}</Reference>"#,
        )
        .unwrap();
    }

    writeln!(xml, "    </References>").unwrap();
    writeln!(xml, "  </UAVariable>").unwrap();
}

// ============================================================================
// Utility Functions
// ============================================================================

/// Collects all unique folder paths (including intermediate segments) from tags.
///
/// For example, if a tag has `folder_path = "Plant.Area1.Motors"`, this returns:
/// `["Plant", "Plant.Area1", "Plant.Area1.Motors"]`.
///
/// The result is sorted to ensure parent folders appear before children.
fn collect_folder_paths(tags: &[TagDefinition]) -> Vec<String> {
    let mut paths = BTreeSet::new();

    for tag in tags {
        if let Some(ref fp) = tag.folder_path {
            if fp.is_empty() {
                continue;
            }
            // Expand intermediate paths: "A.B.C" → ["A", "A.B", "A.B.C"]
            let segments: Vec<&str> = fp.split('.').collect();
            let mut accumulated = String::new();
            for (i, seg) in segments.iter().enumerate() {
                if seg.is_empty() {
                    continue;
                }
                if i > 0 && !accumulated.is_empty() {
                    accumulated.push('.');
                }
                accumulated.push_str(seg);
                paths.insert(accumulated.clone());
            }
        }
    }

    paths.into_iter().collect()
}

/// Determines the parent folder NodeId for a given dot-separated folder path.
///
/// - `"Plant"` → `"ns=1;s=ModOne.Tags"` (parent is Tags root)
/// - `"Plant.Area1"` → `"ns=1;s=ModOne.Tags.Plant"`
fn parent_folder_node_id(folder_path: &str) -> String {
    match folder_path.rsplit_once('.') {
        Some((parent, _)) => format!("ns=1;s=ModOne.Tags.{}", parent),
        None => "ns=1;s=ModOne.Tags".to_string(),
    }
}

/// Maps `OpcUaDataType` enum to its NodeSet2 alias name.
fn opcua_data_type_alias(dt: &OpcUaDataType) -> &'static str {
    match dt {
        OpcUaDataType::Boolean => "Boolean",
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
    }
}

/// Computes the OPC UA AccessLevel attribute value (a bitmask).
///
/// - Bit 0 (0x01) = CurrentRead
/// - Bit 1 (0x02) = CurrentWrite
///
/// ReadOnly  → 1 (read)
/// ReadWrite → 3 (read + write)
fn opcua_access_level_value(mapping_level: &MappingAccessLevel, tag_level: &TagAccessLevel) -> u8 {
    // Mapping config takes priority if it specifies ReadWrite
    let is_writable = match mapping_level {
        MappingAccessLevel::ReadWrite => true,
        MappingAccessLevel::ReadOnly => match tag_level {
            TagAccessLevel::ReadWrite => false, // mapping explicitly restricts
            TagAccessLevel::ReadOnly => false,
        },
    };

    if is_writable {
        3 // CurrentRead | CurrentWrite
    } else {
        1 // CurrentRead only
    }
}

/// Minimal XML escaping for attribute values and text content.
fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plc_runtime::{CanonicalAddress, CanonicalAreaKind};
    use crate::sim::types::{RuntimeBinding, TagClass};

    fn make_tag(
        tag_id: &str,
        display_name: &str,
        area: CanonicalAreaKind,
        index: u32,
        folder_path: Option<&str>,
        description: Option<&str>,
    ) -> TagDefinition {
        let addr = CanonicalAddress::new(area, index);
        TagDefinition {
            tag_id: tag_id.to_string(),
            class: TagClass::Semantic,
            display_name: display_name.to_string(),
            binding: RuntimeBinding::canonical(addr),
            canonical_address: addr,
            access: TagAccessLevel::ReadOnly,
            vendor_aliases: Vec::new(),
            description: description.map(|s| s.to_string()),
            engineering_unit: None,
            folder_path: folder_path.map(|s| s.to_string()),
        }
    }

    // ---- Document Structure Tests ----

    #[test]
    fn test_skeleton_has_xml_declaration() {
        let config = NodeSet2ExportConfig::default();
        let xml = generate_nodeset2_skeleton(&config);
        assert!(xml.starts_with(r#"<?xml version="1.0" encoding="utf-8"?>"#));
    }

    #[test]
    fn test_skeleton_has_uanodeset_root() {
        let config = NodeSet2ExportConfig::default();
        let xml = generate_nodeset2_skeleton(&config);
        assert!(xml.contains("<UANodeSet"));
        assert!(xml.contains("</UANodeSet>"));
    }

    #[test]
    fn test_skeleton_has_opcua_namespace_declaration() {
        let config = NodeSet2ExportConfig::default();
        let xml = generate_nodeset2_skeleton(&config);
        assert!(xml.contains(
            r#"xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd""#
        ));
        assert!(xml.contains(
            r#"xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd""#
        ));
        assert!(xml.contains(r#"xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance""#));
        assert!(xml.contains(r#"xmlns:xsd="http://www.w3.org/2001/XMLSchema""#));
    }

    #[test]
    fn test_skeleton_has_namespace_uris() {
        let config = NodeSet2ExportConfig::default();
        let xml = generate_nodeset2_skeleton(&config);
        assert!(xml.contains("<NamespaceUris>"));
        assert!(xml.contains("<Uri>urn:modone:opcua:tags</Uri>"));
        assert!(xml.contains("</NamespaceUris>"));
    }

    #[test]
    fn test_skeleton_custom_namespace_uri() {
        let config = NodeSet2ExportConfig {
            namespace_uri: "urn:myapp:custom:ns".to_string(),
            ..Default::default()
        };
        let xml = generate_nodeset2_skeleton(&config);
        assert!(xml.contains("<Uri>urn:myapp:custom:ns</Uri>"));
    }

    #[test]
    fn test_skeleton_has_aliases() {
        let config = NodeSet2ExportConfig::default();
        let xml = generate_nodeset2_skeleton(&config);
        assert!(xml.contains("<Aliases>"));
        assert!(xml.contains("</Aliases>"));

        // Data type aliases
        assert!(xml.contains(r#"<Alias Alias="Boolean">i=1</Alias>"#));
        assert!(xml.contains(r#"<Alias Alias="UInt16">i=5</Alias>"#));
        assert!(xml.contains(r#"<Alias Alias="Int32">i=6</Alias>"#));
        assert!(xml.contains(r#"<Alias Alias="Float">i=10</Alias>"#));
        assert!(xml.contains(r#"<Alias Alias="Double">i=11</Alias>"#));
        assert!(xml.contains(r#"<Alias Alias="String">i=12</Alias>"#));

        // Reference type aliases
        assert!(xml.contains(r#"<Alias Alias="Organizes">i=35</Alias>"#));
        assert!(xml.contains(r#"<Alias Alias="HasComponent">i=47</Alias>"#));
        assert!(xml.contains(r#"<Alias Alias="HasTypeDefinition">i=40</Alias>"#));
        assert!(xml.contains(r#"<Alias Alias="HasModellingRule">i=37</Alias>"#));
        assert!(xml.contains(r#"<Alias Alias="FolderType">i=61</Alias>"#));
        assert!(xml.contains(r#"<Alias Alias="BaseDataVariableType">i=63</Alias>"#));
        assert!(xml.contains(r#"<Alias Alias="ModellingRule_Mandatory">i=78</Alias>"#));
    }

    #[test]
    fn test_skeleton_has_root_folder() {
        let config = NodeSet2ExportConfig::default();
        let xml = generate_nodeset2_skeleton(&config);

        // ModOne root folder under Objects (i=85)
        assert!(xml.contains(r#"NodeId="ns=1;s=ModOne""#));
        assert!(xml.contains(r#"BrowseName="1:ModOne""#));
        assert!(xml.contains(r#"ParentNodeId="i=85""#));
        assert!(xml.contains("<DisplayName>ModOne</DisplayName>"));

        // Reverse Organizes reference to Objects folder
        assert!(xml.contains(
            r#"<Reference ReferenceType="Organizes" IsForward="false">i=85</Reference>"#
        ));
        // HasTypeDefinition → FolderType
        assert!(xml.contains(
            r#"<Reference ReferenceType="HasTypeDefinition">i=61</Reference>"#
        ));
    }

    #[test]
    fn test_skeleton_has_tags_folder() {
        let config = NodeSet2ExportConfig::default();
        let xml = generate_nodeset2_skeleton(&config);

        assert!(xml.contains(r#"NodeId="ns=1;s=ModOne.Tags""#));
        assert!(xml.contains(r#"BrowseName="1:Tags""#));
        assert!(xml.contains(r#"ParentNodeId="ns=1;s=ModOne""#));
        assert!(xml.contains("<DisplayName>Tags</DisplayName>"));
    }

    // ---- Folder Path Tests ----

    #[test]
    fn test_collect_folder_paths_empty() {
        let tags: Vec<TagDefinition> = vec![];
        let paths = collect_folder_paths(&tags);
        assert!(paths.is_empty());
    }

    #[test]
    fn test_collect_folder_paths_single_level() {
        let tags = vec![make_tag("t1", "T1", CanonicalAreaKind::DataWord, 0, Some("Sensors"), None)];
        let paths = collect_folder_paths(&tags);
        assert_eq!(paths, vec!["Sensors"]);
    }

    #[test]
    fn test_collect_folder_paths_multi_level() {
        let tags = vec![make_tag(
            "t1",
            "T1",
            CanonicalAreaKind::DataWord,
            0,
            Some("Plant.Area1.Motors"),
            None,
        )];
        let paths = collect_folder_paths(&tags);
        assert_eq!(paths, vec!["Plant", "Plant.Area1", "Plant.Area1.Motors"]);
    }

    #[test]
    fn test_collect_folder_paths_deduplication() {
        let tags = vec![
            make_tag("t1", "T1", CanonicalAreaKind::DataWord, 0, Some("Plant.Sensors"), None),
            make_tag("t2", "T2", CanonicalAreaKind::DataWord, 1, Some("Plant.Sensors"), None),
            make_tag("t3", "T3", CanonicalAreaKind::DataWord, 2, Some("Plant.Motors"), None),
        ];
        let paths = collect_folder_paths(&tags);
        assert_eq!(
            paths,
            vec!["Plant", "Plant.Motors", "Plant.Sensors"]
        );
    }

    #[test]
    fn test_collect_folder_paths_skips_empty() {
        let tags = vec![
            make_tag("t1", "T1", CanonicalAreaKind::DataWord, 0, Some(""), None),
            make_tag("t2", "T2", CanonicalAreaKind::DataWord, 1, None, None),
        ];
        let paths = collect_folder_paths(&tags);
        assert!(paths.is_empty());
    }

    // ---- Sub-folder Generation Tests ----

    #[test]
    fn test_sub_folder_top_level() {
        let mut xml = String::new();
        write_sub_folder(&mut xml, "Sensors");
        assert!(xml.contains(r#"NodeId="ns=1;s=ModOne.Tags.Sensors""#));
        assert!(xml.contains(r#"BrowseName="1:Sensors""#));
        assert!(xml.contains(r#"ParentNodeId="ns=1;s=ModOne.Tags""#));
        assert!(xml.contains("<DisplayName>Sensors</DisplayName>"));
    }

    #[test]
    fn test_sub_folder_nested() {
        let mut xml = String::new();
        write_sub_folder(&mut xml, "Plant.Area1.Motors");
        assert!(xml.contains(r#"NodeId="ns=1;s=ModOne.Tags.Plant.Area1.Motors""#));
        assert!(xml.contains(r#"BrowseName="1:Motors""#));
        assert!(xml.contains(r#"ParentNodeId="ns=1;s=ModOne.Tags.Plant.Area1""#));
        assert!(xml.contains("<DisplayName>Motors</DisplayName>"));
    }

    // ---- Variable Node Tests ----

    #[test]
    fn test_variable_node_basic() {
        let tag = make_tag("temp_sensor", "Temperature", CanonicalAreaKind::DataWord, 100, None, None);
        let mapping = OpcUaMappingConfig::default_for_address(tag.canonical_address);

        let mut xml = String::new();
        write_variable_node(&mut xml, &tag, &mapping, false);

        assert!(xml.contains(r#"NodeId="ns=1;s=temp_sensor""#));
        assert!(xml.contains(r#"BrowseName="1:temp_sensor""#));
        assert!(xml.contains(r#"DataType="UInt16""#));
        assert!(xml.contains(r#"AccessLevel="1""#)); // ReadOnly
        assert!(xml.contains("<DisplayName>Temperature</DisplayName>"));
        assert!(xml.contains(r#"ParentNodeId="ns=1;s=ModOne.Tags""#));
    }

    #[test]
    fn test_variable_node_boolean() {
        let tag = make_tag("motor_run", "Motor Running", CanonicalAreaKind::OutputBit, 0, None, None);
        let mapping = OpcUaMappingConfig::default_for_address(tag.canonical_address);

        let mut xml = String::new();
        write_variable_node(&mut xml, &tag, &mapping, false);

        assert!(xml.contains(r#"DataType="Boolean""#));
    }

    #[test]
    fn test_variable_node_with_folder_path() {
        let tag = make_tag(
            "valve1",
            "Valve 1",
            CanonicalAreaKind::OutputBit,
            5,
            Some("Plant.Actuators"),
            None,
        );
        let mapping = OpcUaMappingConfig::default_for_address(tag.canonical_address);

        let mut xml = String::new();
        write_variable_node(&mut xml, &tag, &mapping, false);

        assert!(xml.contains(r#"ParentNodeId="ns=1;s=ModOne.Tags.Plant.Actuators""#));
    }

    #[test]
    fn test_variable_node_with_description() {
        let tag = make_tag(
            "pressure",
            "Pressure",
            CanonicalAreaKind::DataWord,
            50,
            None,
            Some("Main boiler pressure"),
        );
        let mapping = OpcUaMappingConfig::default_for_address(tag.canonical_address);

        let mut xml = String::new();
        write_variable_node(&mut xml, &tag, &mapping, false);

        assert!(xml.contains("<Description>Main boiler pressure</Description>"));
    }

    #[test]
    fn test_variable_node_with_modelling_rule() {
        let tag = make_tag("t1", "Tag1", CanonicalAreaKind::DataWord, 0, None, None);
        let mapping = OpcUaMappingConfig::default_for_address(tag.canonical_address);

        let mut xml = String::new();
        write_variable_node(&mut xml, &tag, &mapping, true);

        assert!(xml.contains(r#"<Reference ReferenceType="HasModellingRule">i=78</Reference>"#));
    }

    #[test]
    fn test_variable_node_without_modelling_rule() {
        let tag = make_tag("t1", "Tag1", CanonicalAreaKind::DataWord, 0, None, None);
        let mapping = OpcUaMappingConfig::default_for_address(tag.canonical_address);

        let mut xml = String::new();
        write_variable_node(&mut xml, &tag, &mapping, false);

        assert!(!xml.contains("HasModellingRule"));
    }

    #[test]
    fn test_variable_node_readwrite_access() {
        let mut tag = make_tag("rw_tag", "RW Tag", CanonicalAreaKind::DataWord, 0, None, None);
        tag.access = TagAccessLevel::ReadWrite;
        let mut mapping = OpcUaMappingConfig::default_for_address(tag.canonical_address);
        mapping.access_level = MappingAccessLevel::ReadWrite;

        let mut xml = String::new();
        write_variable_node(&mut xml, &tag, &mapping, false);

        assert!(xml.contains(r#"AccessLevel="3""#)); // Read + Write
    }

    #[test]
    fn test_variable_node_has_type_definition() {
        let tag = make_tag("t1", "Tag1", CanonicalAreaKind::DataWord, 0, None, None);
        let mapping = OpcUaMappingConfig::default_for_address(tag.canonical_address);

        let mut xml = String::new();
        write_variable_node(&mut xml, &tag, &mapping, false);

        assert!(xml.contains(
            r#"<Reference ReferenceType="HasTypeDefinition">i=63</Reference>"#
        ));
    }

    // ---- Full Document Tests ----

    #[test]
    fn test_generate_full_document_empty_tags() {
        let config = NodeSet2ExportConfig::default();
        let xml = generate_nodeset2_xml(&[], &HashMap::new(), &config).unwrap();

        // Should have structure but no UAVariable nodes
        assert!(xml.contains("<UANodeSet"));
        assert!(xml.contains("</UANodeSet>"));
        assert!(xml.contains("<NamespaceUris>"));
        assert!(xml.contains("<Aliases>"));
        assert!(xml.contains(r#"NodeId="ns=1;s=ModOne""#));
        assert!(xml.contains(r#"NodeId="ns=1;s=ModOne.Tags""#));
        assert!(!xml.contains("<UAVariable"));
    }

    #[test]
    fn test_generate_full_document_with_tags() {
        let tags = vec![
            make_tag("temp", "Temperature", CanonicalAreaKind::DataWord, 100, Some("Sensors"), None),
            make_tag("motor", "Motor", CanonicalAreaKind::OutputBit, 0, Some("Sensors"), None),
        ];
        let mappings = HashMap::new();
        let config = NodeSet2ExportConfig::default();

        let xml = generate_nodeset2_xml(&tags, &mappings, &config).unwrap();

        // Should have the Sensors folder
        assert!(xml.contains(r#"NodeId="ns=1;s=ModOne.Tags.Sensors""#));
        // Should have both tag variables
        assert!(xml.contains(r#"NodeId="ns=1;s=temp""#));
        assert!(xml.contains(r#"NodeId="ns=1;s=motor""#));
        // DataWord → UInt16, OutputBit → Boolean
        assert!(xml.contains(r#"DataType="UInt16""#));
        assert!(xml.contains(r#"DataType="Boolean""#));
    }

    #[test]
    fn test_generate_full_document_nested_folders() {
        let tags = vec![make_tag(
            "deep_tag",
            "Deep Tag",
            CanonicalAreaKind::DataWord,
            0,
            Some("Plant.Area1.Motors"),
            None,
        )];
        let config = NodeSet2ExportConfig::default();

        let xml = generate_nodeset2_xml(&tags, &HashMap::new(), &config).unwrap();

        // All intermediate folders should be present
        assert!(xml.contains(r#"NodeId="ns=1;s=ModOne.Tags.Plant""#));
        assert!(xml.contains(r#"NodeId="ns=1;s=ModOne.Tags.Plant.Area1""#));
        assert!(xml.contains(r#"NodeId="ns=1;s=ModOne.Tags.Plant.Area1.Motors""#));
    }

    // ---- Utility Tests ----

    #[test]
    fn test_parent_folder_node_id_root_level() {
        assert_eq!(parent_folder_node_id("Sensors"), "ns=1;s=ModOne.Tags");
    }

    #[test]
    fn test_parent_folder_node_id_nested() {
        assert_eq!(
            parent_folder_node_id("Plant.Area1.Motors"),
            "ns=1;s=ModOne.Tags.Plant.Area1"
        );
    }

    #[test]
    fn test_xml_escape() {
        assert_eq!(xml_escape("hello"), "hello");
        assert_eq!(xml_escape("a & b"), "a &amp; b");
        assert_eq!(xml_escape("<tag>"), "&lt;tag&gt;");
        assert_eq!(xml_escape(r#"a"b"#), "a&quot;b");
    }

    #[test]
    fn test_opcua_access_level_readonly() {
        assert_eq!(
            opcua_access_level_value(&MappingAccessLevel::ReadOnly, &TagAccessLevel::ReadOnly),
            1
        );
    }

    #[test]
    fn test_opcua_access_level_readwrite() {
        assert_eq!(
            opcua_access_level_value(&MappingAccessLevel::ReadWrite, &TagAccessLevel::ReadWrite),
            3
        );
    }

    #[test]
    fn test_opcua_data_type_alias_mapping() {
        assert_eq!(opcua_data_type_alias(&OpcUaDataType::Boolean), "Boolean");
        assert_eq!(opcua_data_type_alias(&OpcUaDataType::UInt16), "UInt16");
        assert_eq!(opcua_data_type_alias(&OpcUaDataType::Float), "Float");
        assert_eq!(opcua_data_type_alias(&OpcUaDataType::String), "String");
    }
}
