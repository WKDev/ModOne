// mapping(코덱)의 serde 라운드트립 + 프로젝트 설정 통합 테스트.
// 이 테스트들은 crate::project(src-tauri 내부)에 의존하므로 opcua-codec가
// 아니라 native 셸(src-tauri)에 둔다. mapping 코어는 opcua-codec로 이전됨.

#[cfg(test)]
mod project_serde_tests {
    use crate::opcua::mapping::*;

    #[test]
    fn mapping_store_snapshot_json_round_trip() {
        let store = OpcUaMappingStore::new();
        store.insert(
            "tag-bool".to_string(),
            OpcUaMappingConfig::default_for_bool(),
        );
        store.insert(
            "tag-float".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Float,
                word_count: 2,
                byte_order: ByteOrder::LittleEndian,
                access_level: MappingAccessLevel::ReadWrite,
                description: Some("Temperature".to_string()),
                string_config: None,
            },
        );
        store.insert(
            "tag-i64".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Int64,
                word_count: 4,
                byte_order: ByteOrder::BigEndianWordSwap,
                access_level: MappingAccessLevel::ReadOnly,
                description: None,
                string_config: None,
            },
        );

        let snapshot = store.snapshot();
        let json = serde_json::to_string_pretty(&snapshot).unwrap();
        let restored: HashMap<String, OpcUaMappingConfig> =
            serde_json::from_str(&json).unwrap();

        assert_eq!(restored.len(), 3);
        assert_eq!(restored["tag-bool"], OpcUaMappingConfig::default_for_bool());
        assert_eq!(restored["tag-float"].opcua_data_type, OpcUaDataType::Float);
        assert_eq!(restored["tag-float"].word_count, 2);
        assert_eq!(
            restored["tag-float"].description.as_deref(),
            Some("Temperature")
        );
        assert_eq!(restored["tag-i64"].opcua_data_type, OpcUaDataType::Int64);

        let store2 = OpcUaMappingStore::new();
        store2.load_from(restored);
        assert_eq!(store2.len(), 3);
        assert_eq!(
            store2.get("tag-bool").unwrap(),
            OpcUaMappingConfig::default_for_bool()
        );
    }

    #[test]
    fn mapping_config_json_camel_case_keys_in_map() {
        let mut map: HashMap<String, OpcUaMappingConfig> = HashMap::new();
        map.insert(
            "sensor-1".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::UInt32,
                word_count: 2,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadOnly,
                description: None,
                string_config: None,
            },
        );

        let json = serde_json::to_string(&map).unwrap();
        assert!(json.contains("opcuaDataType"));
        assert!(json.contains("wordCount"));
        assert!(json.contains("byteOrder"));
        assert!(json.contains("accessLevel"));
    }

    #[test]
    fn mapping_config_deserialize_from_explicit_json() {
        let json = r#"{
            "opcuaDataType": "Double",
            "wordCount": 4,
            "byteOrder": "LittleEndianWordSwap",
            "accessLevel": "ReadWrite",
            "description": "Pressure reading"
        }"#;

        let cfg: OpcUaMappingConfig = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.opcua_data_type, OpcUaDataType::Double);
        assert_eq!(cfg.word_count, 4);
        assert_eq!(cfg.byte_order, ByteOrder::LittleEndianWordSwap);
        assert_eq!(cfg.access_level, MappingAccessLevel::ReadWrite);
        assert_eq!(cfg.description.as_deref(), Some("Pressure reading"));
    }

    #[test]
    fn empty_mapping_store_serializes_to_empty_json_object() {
        let store = OpcUaMappingStore::new();
        let json = serde_json::to_string(&store.snapshot()).unwrap();
        assert_eq!(json, "{}");
    }

    #[test]
    fn mapping_hashmap_deserialize_from_empty_json() {
        let map: HashMap<String, OpcUaMappingConfig> =
            serde_json::from_str("{}").unwrap();
        assert!(map.is_empty());
    }

    #[test]
    fn project_config_opcua_mappings_json_round_trip() {
        use crate::project::ProjectConfig;

        let mut config = ProjectConfig::new("Mapping Test");
        config.opcua_mappings.insert(
            "motor-speed".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Int32,
                word_count: 2,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadWrite,
                description: Some("Motor speed RPM".to_string()),
                string_config: None,
            },
        );
        config.opcua_mappings.insert(
            "run-bit".to_string(),
            OpcUaMappingConfig::default_for_bool(),
        );

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("motor-speed"));
        assert!(json.contains("run-bit"));

        let restored: ProjectConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.opcua_mappings.len(), 2);
        assert_eq!(
            restored.opcua_mappings["motor-speed"].opcua_data_type,
            OpcUaDataType::Int32
        );
        assert_eq!(
            restored.opcua_mappings["run-bit"].opcua_data_type,
            OpcUaDataType::Boolean
        );
    }

    #[test]
    fn project_config_without_mappings_deserializes_to_empty() {
        use crate::project::ProjectConfig;

        let config = ProjectConfig::new("Legacy Project");
        let mut json_val = serde_json::to_value(&config).unwrap();
        json_val.as_object_mut().unwrap().remove("opcua_mappings");
        let json = serde_json::to_string(&json_val).unwrap();

        let restored: ProjectConfig = serde_json::from_str(&json).unwrap();
        assert!(restored.opcua_mappings.is_empty());
    }

    #[test]
    fn project_config_yaml_round_trip_with_mappings() {
        use crate::project::ProjectConfig;

        let mut config = ProjectConfig::new("YAML Mapping Test");
        config.opcua_mappings.insert(
            "valve-pos".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Float,
                word_count: 2,
                byte_order: ByteOrder::LittleEndian,
                access_level: MappingAccessLevel::ReadOnly,
                description: Some("Valve position %".to_string()),
                string_config: None,
            },
        );

        let yaml = serde_yaml::to_string(&config).unwrap();
        let restored: ProjectConfig = serde_yaml::from_str(&yaml).unwrap();

        assert_eq!(restored.opcua_mappings.len(), 1);
        assert_eq!(
            restored.opcua_mappings["valve-pos"].opcua_data_type,
            OpcUaDataType::Float
        );
        assert_eq!(
            restored.opcua_mappings["valve-pos"].description.as_deref(),
            Some("Valve position %")
        );
    }

    #[test]
    fn project_config_yaml_without_mappings_is_backward_compatible() {
        use crate::project::ProjectConfig;

        let yaml = r#"
version: "1.0"
project:
  name: Old Project
  description: ""
  created_at: "2024-01-01T00:00:00Z"
  updated_at: "2024-01-01T00:00:00Z"
plc:
  manufacturer: LS
  model: ""
  scan_time_ms: 10
modbus:
  tcp:
    enabled: true
    port: 502
    unit_id: 1
  rtu:
    enabled: false
    com_port: ""
    baud_rate: 9600
    parity: None
    stop_bits: 1
  simulation:
    enabled: false
    transport: Tcp
    address: "127.0.0.1:502"
    com_port: ""
    unit_id: 1
    baud_rate: 9600
    parity: None
    stop_bits: 1
    coil_start_address: 0
    word_start_address: 0
  exposure:
    mode: Recommended
    rules: []
memory_map:
  coil_start: 0
  coil_count: 1000
  discrete_input_start: 0
  discrete_input_count: 1000
  holding_register_start: 0
  holding_register_count: 1000
  input_register_start: 0
  input_register_count: 1000
"#;

        let config: ProjectConfig = serde_yaml::from_str(yaml).unwrap();
        assert!(config.opcua_mappings.is_empty());
        assert_eq!(config.project.name, "Old Project");
    }

    #[test]
    fn manifest_round_trip_with_mappings() {
        use crate::project::manifest::ProjectManifest;

        let mut manifest = ProjectManifest::new("Manifest Test");
        manifest.opcua_mappings.insert(
            "tag-1".to_string(),
            OpcUaMappingConfig::default_for_word(),
        );
        manifest.opcua_mappings.insert(
            "tag-2".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::UInt64,
                word_count: 4,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadOnly,
                description: Some("Counter".to_string()),
                string_config: None,
            },
        );

        let yaml = serde_yaml::to_string(&manifest).unwrap();
        let restored: ProjectManifest = serde_yaml::from_str(&yaml).unwrap();

        assert_eq!(restored.opcua_mappings.len(), 2);
        assert_eq!(
            restored.opcua_mappings["tag-1"],
            OpcUaMappingConfig::default_for_word()
        );
        assert_eq!(
            restored.opcua_mappings["tag-2"].opcua_data_type,
            OpcUaDataType::UInt64
        );
    }

    #[test]
    fn manifest_legacy_conversion_preserves_mappings() {
        use crate::project::config::ProjectConfig;
        use crate::project::manifest::ProjectManifest;

        let mut config = ProjectConfig::new("Convert Test");
        config.opcua_mappings.insert(
            "pressure".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Float,
                word_count: 2,
                byte_order: ByteOrder::LittleEndian,
                access_level: MappingAccessLevel::ReadWrite,
                description: Some("Pressure bar".to_string()),
                string_config: None,
            },
        );

        let manifest = ProjectManifest::from_legacy_config(&config);
        assert_eq!(manifest.opcua_mappings.len(), 1);
        assert_eq!(
            manifest.opcua_mappings["pressure"].opcua_data_type,
            OpcUaDataType::Float
        );

        let restored = manifest.to_legacy_config();
        assert_eq!(restored.opcua_mappings.len(), 1);
        assert_eq!(
            restored.opcua_mappings["pressure"],
            config.opcua_mappings["pressure"]
        );
    }

    #[test]
    fn all_data_types_serialize_deserialize_in_hashmap() {
        let all_types = [
            (OpcUaDataType::Boolean, 1),
            (OpcUaDataType::SByte, 1),
            (OpcUaDataType::Byte, 1),
            (OpcUaDataType::Int16, 1),
            (OpcUaDataType::UInt16, 1),
            (OpcUaDataType::Int32, 2),
            (OpcUaDataType::UInt32, 2),
            (OpcUaDataType::Int64, 4),
            (OpcUaDataType::UInt64, 4),
            (OpcUaDataType::Float, 2),
            (OpcUaDataType::Double, 4),
            (OpcUaDataType::String, 5),
        ];

        let mut map: HashMap<String, OpcUaMappingConfig> = HashMap::new();
        for (dt, wc) in &all_types {
            map.insert(
                format!("tag-{}", dt),
                OpcUaMappingConfig {
                    opcua_data_type: *dt,
                    word_count: *wc,
                    byte_order: ByteOrder::BigEndian,
                    access_level: MappingAccessLevel::ReadOnly,
                    description: None,
                    string_config: None,
                },
            );
        }

        let json = serde_json::to_string(&map).unwrap();
        let restored: HashMap<String, OpcUaMappingConfig> =
            serde_json::from_str(&json).unwrap();

        assert_eq!(restored.len(), all_types.len());
        for (dt, wc) in &all_types {
            let key = format!("tag-{}", dt);
            let cfg = &restored[&key];
            assert_eq!(cfg.opcua_data_type, *dt);
            assert_eq!(cfg.word_count, *wc);
        }
    }

    #[test]
    fn project_config_empty_mappings_skipped_in_serialization() {
        use crate::project::ProjectConfig;

        let config = ProjectConfig::new("No Mappings");
        // With skip_serializing_if = "HashMap::is_empty", the field should be absent
        let json = serde_json::to_string(&config).unwrap();
        // The key should not appear when the map is empty
        assert!(!json.contains("opcua_mappings"));
    }

    #[test]
    fn folder_project_save_reload_preserves_mappings() {
        use crate::project::folder_project::FolderProject;
        use crate::project::config::PlcSettings;

        let temp_dir = tempfile::tempdir().unwrap();
        let project_dir = temp_dir.path().join("MappingSaveTest");

        let mut project = FolderProject::create_new(
            &project_dir,
            "MappingSaveTest",
            PlcSettings::default(),
        )
        .unwrap();

        // Add mappings to the manifest
        project.manifest_mut().opcua_mappings.insert(
            "pump-flow".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Float,
                word_count: 2,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadWrite,
                description: Some("Flow rate L/min".to_string()),
                string_config: None,
            },
        );
        project.manifest_mut().opcua_mappings.insert(
            "alarm-bit".to_string(),
            OpcUaMappingConfig::default_for_bool(),
        );

        project.save().unwrap();

        // Reopen and verify
        let manifest_path = project.manifest_path().to_path_buf();
        let reopened = FolderProject::open(&manifest_path).unwrap();

        assert_eq!(reopened.manifest().opcua_mappings.len(), 2);
        assert_eq!(
            reopened.manifest().opcua_mappings["pump-flow"].opcua_data_type,
            OpcUaDataType::Float
        );
        assert_eq!(
            reopened.manifest().opcua_mappings["pump-flow"]
                .description
                .as_deref(),
            Some("Flow rate L/min")
        );
        assert_eq!(
            reopened.manifest().opcua_mappings["alarm-bit"],
            OpcUaMappingConfig::default_for_bool()
        );
    }
}

// ========================================================================
// AC 3: Per-tag byte order correctly applied during read conversion
// ========================================================================

// sim(TagRegistry/TagDefinition) 의존 mapping 테스트. opcua-codec(순수)에서
// 분리해 native 셸에 둔다. 크레이트의 test-only `default_for_tag`(프로덕션
// 호출처 없던 thin wrapper)는 제거하고 default_for_address로 직접 검증한다.
#[cfg(test)]
mod sim_mapping_tests {
    use crate::opcua::mapping::{
        ByteOrder, MappingAccessLevel, OpcUaDataType, OpcUaMappingConfig, OpcUaMappingStore,
    };
    use crate::sim::tag_registry::TagRegistry;
    use crate::sim::types::{
        RegisterTagRequest, RuntimeBinding, TagAccessLevel, TagClass, TagDefinition,
    };
    use modone_contract::{CanonicalAddress, CanonicalAreaKind};

    #[test]
    fn default_for_tag_bool_tag() {
        let tag = TagDefinition {
            tag_id: "motor-run".to_string(),
            class: TagClass::Semantic,
            display_name: "Motor Run".to_string(),
            binding: RuntimeBinding::tag("motor-run"),
            canonical_address: CanonicalAddress::new(CanonicalAreaKind::OutputBit, 3),
            access: TagAccessLevel::ReadWrite,
            vendor_aliases: vec!["Y3".to_string()],
            description: Some("Motor run command".to_string()),
            engineering_unit: None,
            folder_path: None,
        };
        let cfg = OpcUaMappingConfig::default_for_address(tag.canonical_address);
        assert_eq!(cfg.opcua_data_type, OpcUaDataType::Boolean);
        assert_eq!(cfg.word_count, 1);
        assert_eq!(cfg.byte_order, ByteOrder::BigEndian);
        assert_eq!(cfg.access_level, MappingAccessLevel::ReadOnly);
    }

    #[test]
    fn default_for_tag_word_tag() {
        let tag = TagDefinition {
            tag_id: "temperature".to_string(),
            class: TagClass::Semantic,
            display_name: "Temperature".to_string(),
            binding: RuntimeBinding::tag("temperature"),
            canonical_address: CanonicalAddress::new(CanonicalAreaKind::DataWord, 100),
            access: TagAccessLevel::ReadOnly,
            vendor_aliases: Vec::new(),
            description: None,
            engineering_unit: Some("\u{00B0}C".to_string()),
            folder_path: Some("Plant.Sensors".to_string()),
        };
        let cfg = OpcUaMappingConfig::default_for_address(tag.canonical_address);
        assert_eq!(cfg.opcua_data_type, OpcUaDataType::UInt16);
        assert_eq!(cfg.word_count, 1);
        assert_eq!(cfg.byte_order, ByteOrder::BigEndian);
        assert_eq!(cfg.access_level, MappingAccessLevel::ReadOnly);
    }

    #[test]
    fn store_synchronized_deletion_simulation() {
        let registry = TagRegistry::new();
        let store = OpcUaMappingStore::new();
        let tag = registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("pump-speed".to_string()),
                display_name: "Pump Speed".to_string(),
                binding: None,
                canonical_address: Some(CanonicalAddress::new(CanonicalAreaKind::DataWord, 50)),
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: None,
                folder_path: None,
            })
            .unwrap();
        let cfg = OpcUaMappingConfig::default_for_address(tag.canonical_address);
        store.insert(tag.tag_id.clone(), cfg);
        assert!(store.contains("pump-speed"));
        assert!(registry.resolve("pump-speed").is_ok());
        registry.remove("pump-speed").unwrap();
        store.remove("pump-speed");
        assert!(!store.contains("pump-speed"));
        assert!(registry.resolve("pump-speed").is_err());
    }

    #[test]
    fn store_batch_deletion_simulation() {
        let registry = TagRegistry::new();
        let store = OpcUaMappingStore::new();
        for (id, area, idx) in [
            ("tag-1", CanonicalAreaKind::OutputBit, 0),
            ("tag-2", CanonicalAreaKind::DataWord, 10),
            ("tag-3", CanonicalAreaKind::InternalBit, 5),
        ] {
            let tag = registry
                .register_semantic(RegisterTagRequest {
                    tag_id: Some(id.to_string()),
                    display_name: id.to_string(),
                    binding: None,
                    canonical_address: Some(CanonicalAddress::new(area, idx)),
                    vendor_aliases: Vec::new(),
                    description: None,
                    engineering_unit: None,
                    access: None,
                    folder_path: None,
                })
                .unwrap();
            store.insert(
                tag.tag_id.clone(),
                OpcUaMappingConfig::default_for_address(tag.canonical_address),
            );
        }
        assert_eq!(store.len(), 3);
        let to_delete = vec!["tag-1".to_string(), "tag-3".to_string()];
        for id in &to_delete {
            registry.remove(id).unwrap();
        }
        store.remove_many(&to_delete);
        assert_eq!(store.len(), 1);
        assert!(store.contains("tag-2"));
        assert!(!store.contains("tag-1"));
        assert!(!store.contains("tag-3"));
    }
}
