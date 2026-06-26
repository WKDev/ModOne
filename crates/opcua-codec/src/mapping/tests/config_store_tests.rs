// 매핑 설정/스토어/문자열/레지스터 범위/부동소수 변환에 대한 통합 테스트
use crate::mapping::*;
use modone_contract::{CanonicalAddress, CanonicalAreaKind};
use std::collections::HashMap;


    #[test]
    fn default_for_bool_produces_boolean_type() {
        let cfg = OpcUaMappingConfig::default_for_bool();
        assert_eq!(cfg.opcua_data_type, OpcUaDataType::Boolean);
        assert_eq!(cfg.word_count, 1);
        assert_eq!(cfg.byte_order, ByteOrder::BigEndian);
        assert_eq!(cfg.access_level, MappingAccessLevel::ReadOnly);
        assert!(cfg.description.is_none());
    }

    #[test]
    fn default_for_word_produces_uint16_type() {
        let cfg = OpcUaMappingConfig::default_for_word();
        assert_eq!(cfg.opcua_data_type, OpcUaDataType::UInt16);
        assert_eq!(cfg.word_count, 1);
        assert_eq!(cfg.byte_order, ByteOrder::BigEndian);
        assert_eq!(cfg.access_level, MappingAccessLevel::ReadOnly);
    }

    #[test]
    fn default_from_is_bool_dispatches_correctly() {
        let bool_cfg = OpcUaMappingConfig::default_from_is_bool(true);
        assert_eq!(bool_cfg.opcua_data_type, OpcUaDataType::Boolean);

        let word_cfg = OpcUaMappingConfig::default_from_is_bool(false);
        assert_eq!(word_cfg.opcua_data_type, OpcUaDataType::UInt16);
    }

    #[test]
    fn validate_accepts_valid_configs() {
        assert!(OpcUaMappingConfig::default_for_bool().validate().is_ok());
        assert!(OpcUaMappingConfig::default_for_word().validate().is_ok());

        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 2,
            byte_order: ByteOrder::LittleEndian,
            access_level: MappingAccessLevel::ReadWrite,
            description: Some("Motor speed".to_string()),
            string_config: None,
        };
        assert!(cfg.validate().is_ok());
    }

    #[test]
    fn validate_rejects_insufficient_word_count() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 1, // needs 2
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validate_rejects_boolean_with_wrong_word_count() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Boolean,
            word_count: 2,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn data_type_default_word_counts() {
        assert_eq!(OpcUaDataType::Boolean.default_word_count(), 1);
        assert_eq!(OpcUaDataType::SByte.default_word_count(), 1);
        assert_eq!(OpcUaDataType::Byte.default_word_count(), 1);
        assert_eq!(OpcUaDataType::Int16.default_word_count(), 1);
        assert_eq!(OpcUaDataType::UInt16.default_word_count(), 1);
        assert_eq!(OpcUaDataType::Int32.default_word_count(), 2);
        assert_eq!(OpcUaDataType::UInt32.default_word_count(), 2);
        assert_eq!(OpcUaDataType::Int64.default_word_count(), 4);
        assert_eq!(OpcUaDataType::UInt64.default_word_count(), 4);
        assert_eq!(OpcUaDataType::Float.default_word_count(), 2);
        assert_eq!(OpcUaDataType::Double.default_word_count(), 4);
        assert_eq!(OpcUaDataType::String.default_word_count(), 1);
    }

    #[test]
    fn serde_round_trip() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Float,
            word_count: 2,
            byte_order: ByteOrder::LittleEndianWordSwap,
            access_level: MappingAccessLevel::ReadWrite,
            description: Some("Temperature sensor".to_string()),
            string_config: None,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let deserialized: OpcUaMappingConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(cfg, deserialized);
    }

    #[test]
    fn serde_camel_case_field_names() {
        let cfg = OpcUaMappingConfig::default_for_word();
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("opcuaDataType"));
        assert!(json.contains("wordCount"));
        assert!(json.contains("byteOrder"));
        assert!(json.contains("accessLevel"));
        // description is None and skipped
        assert!(!json.contains("description"));
    }

    #[test]
    fn all_byte_orders_display() {
        assert_eq!(ByteOrder::BigEndian.to_string(), "BigEndian");
        assert_eq!(ByteOrder::LittleEndian.to_string(), "LittleEndian");
        assert_eq!(ByteOrder::BigEndianWordSwap.to_string(), "BigEndianWordSwap");
        assert_eq!(
            ByteOrder::LittleEndianWordSwap.to_string(),
            "LittleEndianWordSwap"
        );
    }

    #[test]
    fn validate_accepts_larger_word_count() {
        // It's valid to use more words than the minimum (e.g., padding)
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 4, // min is 2, but 4 is fine
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        };
        assert!(cfg.validate().is_ok());
    }

    // ========================================================================
    // AC 7: Default mapping auto-generated on tag creation using is_bool
    // ========================================================================

    #[test]
    fn default_for_address_bool_areas_produce_boolean() {
        // All bit-type areas should produce Boolean mapping
        let bool_areas = [
            CanonicalAreaKind::InputBit,
            CanonicalAreaKind::OutputBit,
            CanonicalAreaKind::InternalBit,
            CanonicalAreaKind::RetentiveBit,
            CanonicalAreaKind::SpecialBit,
            CanonicalAreaKind::TimerDoneBit,
            CanonicalAreaKind::CounterDoneBit,
            CanonicalAreaKind::SystemBit,
        ];
        for area in bool_areas {
            let addr = CanonicalAddress::new(area, 0);
            let cfg = OpcUaMappingConfig::default_for_address(addr);
            assert_eq!(
                cfg.opcua_data_type,
                OpcUaDataType::Boolean,
                "area {:?} should produce Boolean",
                area
            );
            assert_eq!(cfg.word_count, 1);
            assert_eq!(cfg.byte_order, ByteOrder::BigEndian);
            assert_eq!(cfg.access_level, MappingAccessLevel::ReadOnly);
            assert!(cfg.description.is_none());
            assert!(cfg.validate().is_ok());
        }
    }

    #[test]
    fn default_for_address_word_areas_produce_uint16() {
        // All word-type areas should produce UInt16 mapping
        let word_areas = [
            CanonicalAreaKind::DataWord,
            CanonicalAreaKind::RetentiveWord,
            CanonicalAreaKind::IndexWord,
            CanonicalAreaKind::TimerValueWord,
            CanonicalAreaKind::CounterValueWord,
            CanonicalAreaKind::SystemWord,
        ];
        for area in word_areas {
            let addr = CanonicalAddress::new(area, 0);
            let cfg = OpcUaMappingConfig::default_for_address(addr);
            assert_eq!(
                cfg.opcua_data_type,
                OpcUaDataType::UInt16,
                "area {:?} should produce UInt16",
                area
            );
            assert_eq!(cfg.word_count, 1);
            assert_eq!(cfg.byte_order, ByteOrder::BigEndian);
            assert_eq!(cfg.access_level, MappingAccessLevel::ReadOnly);
            assert!(cfg.description.is_none());
            assert!(cfg.validate().is_ok());
        }
    }

    #[test]
    fn default_for_address_with_bit_index_produces_boolean() {
        // A word address with a bit_index should still be detected as boolean
        let addr = CanonicalAddress::with_bit_index(CanonicalAreaKind::DataWord, 5, 3);
        let cfg = OpcUaMappingConfig::default_for_address(addr);
        assert_eq!(cfg.opcua_data_type, OpcUaDataType::Boolean);
    }


    #[test]
    fn default_for_address_various_indices() {
        // Ensure the index value doesn't affect type detection
        for idx in [0, 1, 100, 9999] {
            let bool_cfg =
                OpcUaMappingConfig::default_for_address(CanonicalAddress::new(
                    CanonicalAreaKind::InternalBit,
                    idx,
                ));
            assert_eq!(bool_cfg.opcua_data_type, OpcUaDataType::Boolean);

            let word_cfg =
                OpcUaMappingConfig::default_for_address(CanonicalAddress::new(
                    CanonicalAreaKind::DataWord,
                    idx,
                ));
            assert_eq!(word_cfg.opcua_data_type, OpcUaDataType::UInt16);
        }
    }

    // ========================================================================
    // Sub-AC 3: String mapping — encoding, null termination, multi-register
    // ========================================================================

    // ── StringMappingConfig defaults & validation ──

    #[test]
    fn string_config_defaults() {
        let cfg = StringMappingConfig::default();
        assert_eq!(cfg.encoding, StringEncoding::Utf8);
        assert!(cfg.null_terminated);
        assert!(cfg.max_byte_length.is_none());
    }

    #[test]
    fn string_config_effective_max_bytes_default() {
        let cfg = StringMappingConfig::default();
        assert_eq!(cfg.effective_max_bytes(5), 10); // 5 words × 2
    }

    #[test]
    fn string_config_effective_max_bytes_explicit() {
        let cfg = StringMappingConfig {
            max_byte_length: Some(6),
            ..Default::default()
        };
        assert_eq!(cfg.effective_max_bytes(5), 6);
    }

    #[test]
    fn string_config_validate_ok() {
        assert!(StringMappingConfig::default().validate(4).is_ok());
        let cfg = StringMappingConfig {
            max_byte_length: Some(8),
            ..Default::default()
        };
        assert!(cfg.validate(4).is_ok()); // 8 == 4*2, exactly fits
    }

    #[test]
    fn string_config_validate_rejects_zero_word_count() {
        assert!(StringMappingConfig::default().validate(0).is_err());
    }

    #[test]
    fn string_config_validate_rejects_overflow_max_bytes() {
        let cfg = StringMappingConfig {
            max_byte_length: Some(10),
            ..Default::default()
        };
        assert!(cfg.validate(4).is_err()); // 10 > 4*2=8
    }

    #[test]
    fn string_config_validate_rejects_zero_max_bytes() {
        let cfg = StringMappingConfig {
            max_byte_length: Some(0),
            ..Default::default()
        };
        assert!(cfg.validate(4).is_err());
    }

    #[test]
    fn string_config_serde_round_trip() {
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Ascii,
            max_byte_length: Some(20),
            null_terminated: false,
            max_string_length: None,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let de: StringMappingConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(cfg, de);
    }

    #[test]
    fn string_config_serde_camel_case() {
        let cfg = StringMappingConfig {
            max_byte_length: Some(10),
            ..Default::default()
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("maxByteLength"));
        assert!(json.contains("nullTerminated"));
    }

    #[test]
    fn string_encoding_display() {
        assert_eq!(StringEncoding::Utf8.to_string(), "UTF-8");
        assert_eq!(StringEncoding::Ascii.to_string(), "ASCII");
        assert_eq!(StringEncoding::Utf16.to_string(), "UTF-16");
    }

    // ── registers_to_string (read direction) ──

    #[test]
    fn read_utf8_big_endian_hello() {
        // "Hello" = [0x48, 0x65, 0x6C, 0x6C, 0x6F]
        // Big-endian: reg0 = 0x4865, reg1 = 0x6C6C, reg2 = 0x6F00
        let regs = [0x4865, 0x6C6C, 0x6F00];
        let cfg = StringMappingConfig::default(); // UTF-8, null_terminated
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "Hello");
    }

    #[test]
    fn read_utf8_little_endian() {
        // "Hi" = [0x48, 0x69]
        // Little-endian: low byte first → reg = 0x6948 stores [0x48, 0x69]
        let regs = [0x6948, 0x0000];
        let cfg = StringMappingConfig::default();
        let s = registers_to_string(&regs, ByteOrder::LittleEndian, &cfg).unwrap();
        assert_eq!(s, "Hi");
    }

    #[test]
    fn read_utf8_no_null_termination() {
        // Without null termination, reads all bytes
        let regs = [0x4100, 0x4200]; // BE: 'A','\0','B','\0'
        let cfg = StringMappingConfig {
            null_terminated: false,
            ..Default::default()
        };
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "A\0B\0");
    }

    #[test]
    fn read_utf8_null_in_middle_stops() {
        // With null_terminated=true, stops at first \0
        let regs = [0x4100, 0x4200]; // BE: 'A','\0' → stops
        let cfg = StringMappingConfig::default();
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "A");
    }

    #[test]
    fn read_utf8_max_byte_length_limits() {
        // "ABCD" in 2 registers, but max_byte_length=3
        let regs = [0x4142, 0x4344]; // BE: A,B,C,D
        let cfg = StringMappingConfig {
            max_byte_length: Some(3),
            null_terminated: false,
            ..Default::default()
        };
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "ABC");
    }

    #[test]
    fn read_empty_registers() {
        let regs: [u16; 0] = [];
        let cfg = StringMappingConfig::default();
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "");
    }

    #[test]
    fn read_ascii_rejects_high_bytes() {
        let regs = [0x41C0]; // BE: 0x41='A', 0xC0 > 0x7F
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Ascii,
            null_terminated: false,
            ..Default::default()
        };
        assert!(registers_to_string(&regs, ByteOrder::BigEndian, &cfg).is_err());
    }

    #[test]
    fn read_utf16_basic() {
        // "Hi" in UTF-16: [0x0048, 0x0069]
        let regs = [0x0048, 0x0069, 0x0000];
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            ..Default::default()
        };
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "Hi");
    }

    #[test]
    fn read_utf16_no_null_termination() {
        let regs = [0x0048, 0x0000, 0x0069];
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            null_terminated: false,
            ..Default::default()
        };
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "H\0i");
    }

    #[test]
    fn read_utf16_emoji() {
        // '😀' = U+1F600, UTF-16 surrogate pair: 0xD83D, 0xDE00
        let regs = [0xD83D, 0xDE00, 0x0000];
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            ..Default::default()
        };
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "\u{1F600}");
    }

    // ── string_to_registers (write direction) ──

    #[test]
    fn write_utf8_big_endian_hello() {
        let cfg = StringMappingConfig {
            null_terminated: true,
            ..Default::default()
        };
        let regs = string_to_registers("Hello", 4, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(regs.len(), 4);
        // "Hello" = 5 bytes + null → 6 bytes → 3 registers used, 4th is padding
        assert_eq!(regs[0], 0x4865); // H, e
        assert_eq!(regs[1], 0x6C6C); // l, l
        assert_eq!(regs[2], 0x6F00); // o, \0
        assert_eq!(regs[3], 0x0000); // padding
    }

    #[test]
    fn write_utf8_little_endian() {
        let cfg = StringMappingConfig {
            null_terminated: false,
            ..Default::default()
        };
        let regs = string_to_registers("AB", 2, ByteOrder::LittleEndian, &cfg).unwrap();
        // LE: b0='A'=0x41 → low byte, b1='B'=0x42 → high byte → 0x4241
        assert_eq!(regs[0], 0x4241);
        assert_eq!(regs[1], 0x0000);
    }

    #[test]
    fn write_utf8_too_long_rejected() {
        let cfg = StringMappingConfig::default(); // null_terminated=true
        // 2 words = 4 bytes capacity, -1 for null = 3 usable
        let result = string_to_registers("ABCD", 2, ByteOrder::BigEndian, &cfg);
        assert!(result.is_err());
    }

    #[test]
    fn write_utf8_exactly_fits_without_null() {
        let cfg = StringMappingConfig {
            null_terminated: false,
            ..Default::default()
        };
        // 2 words = 4 bytes, "ABCD" = 4 bytes — exact fit
        let regs = string_to_registers("ABCD", 2, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(regs[0], 0x4142);
        assert_eq!(regs[1], 0x4344);
    }

    #[test]
    fn write_utf16_basic() {
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            null_terminated: true,
            ..Default::default()
        };
        let regs = string_to_registers("Hi", 4, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(regs.len(), 4);
        assert_eq!(regs[0], 0x0048); // 'H'
        assert_eq!(regs[1], 0x0069); // 'i'
        assert_eq!(regs[2], 0x0000); // null
        assert_eq!(regs[3], 0x0000); // padding
    }

    #[test]
    fn write_utf16_too_long_rejected() {
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            null_terminated: true,
            ..Default::default()
        };
        // 2 words, -1 for null = 1 slot, but "Hi" needs 2
        let result = string_to_registers("Hi", 2, ByteOrder::BigEndian, &cfg);
        assert!(result.is_err());
    }

    #[test]
    fn write_ascii_rejects_non_ascii() {
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Ascii,
            null_terminated: false,
            ..Default::default()
        };
        let result = string_to_registers("café", 4, ByteOrder::BigEndian, &cfg);
        assert!(result.is_err());
    }

    #[test]
    fn write_zero_word_count_rejected() {
        let cfg = StringMappingConfig::default();
        assert!(string_to_registers("A", 0, ByteOrder::BigEndian, &cfg).is_err());
    }

    // ── Round-trip (write then read) ──

    #[test]
    fn round_trip_utf8_big_endian() {
        let cfg = StringMappingConfig::default();
        let original = "Test123";
        let regs = string_to_registers(original, 5, ByteOrder::BigEndian, &cfg).unwrap();
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, original);
    }

    #[test]
    fn round_trip_utf8_little_endian() {
        let cfg = StringMappingConfig::default();
        let original = "LE test";
        let regs = string_to_registers(original, 5, ByteOrder::LittleEndian, &cfg).unwrap();
        let result = registers_to_string(&regs, ByteOrder::LittleEndian, &cfg).unwrap();
        assert_eq!(result, original);
    }

    #[test]
    fn round_trip_utf16() {
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            ..Default::default()
        };
        let original = "UTF16!";
        let regs = string_to_registers(original, 8, ByteOrder::BigEndian, &cfg).unwrap();
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, original);
    }

    #[test]
    fn round_trip_ascii_no_null() {
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Ascii,
            null_terminated: false,
            ..Default::default()
        };
        let original = "ABCDEF";
        let regs = string_to_registers(original, 3, ByteOrder::BigEndian, &cfg).unwrap();
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, original);
    }

    #[test]
    fn round_trip_empty_string() {
        let cfg = StringMappingConfig::default();
        let regs = string_to_registers("", 2, ByteOrder::BigEndian, &cfg).unwrap();
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, "");
    }

    #[test]
    fn round_trip_max_byte_length() {
        let cfg = StringMappingConfig {
            max_byte_length: Some(4),
            null_terminated: false,
            ..Default::default()
        };
        let original = "ABCD";
        let regs = string_to_registers(original, 4, ByteOrder::BigEndian, &cfg).unwrap();
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, original);
    }

    // ── Multi-register combination ──

    #[test]
    fn multi_register_utf8_16_registers() {
        // 16 registers = 32 bytes capacity
        let cfg = StringMappingConfig {
            null_terminated: true,
            ..Default::default()
        };
        let long_str = "This is a long str!"; // 19 chars + null = 20 bytes = 10 regs
        let regs = string_to_registers(long_str, 16, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(regs.len(), 16);
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, long_str);
    }

    #[test]
    fn multi_register_utf16_surrogate_pair() {
        // '😀' needs 2 UTF-16 code units (surrogate pair) = 2 registers + null
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            null_terminated: true,
            ..Default::default()
        };
        let emoji = "\u{1F600}";
        let regs = string_to_registers(emoji, 4, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(regs[0], 0xD83D);
        assert_eq!(regs[1], 0xDE00);
        assert_eq!(regs[2], 0x0000);
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, emoji);
    }

    #[test]
    fn default_for_address_always_validates() {
        // Every auto-generated default should pass validation
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
            let cfg = OpcUaMappingConfig::default_for_address(CanonicalAddress::new(area, 0));
            assert!(
                cfg.validate().is_ok(),
                "auto-generated default for {:?} should validate",
                area
            );
        }
    }

    // ========================================================================
    // AC 8: OpcUaMappingStore — tag deletion triggers synchronized removal
    // ========================================================================

    #[test]
    fn store_insert_and_get() {
        let store = OpcUaMappingStore::new();
        let cfg = OpcUaMappingConfig::default_for_bool();
        store.insert("motor-run".to_string(), cfg.clone());
        assert_eq!(store.get("motor-run"), Some(cfg));
        assert_eq!(store.len(), 1);
    }

    #[test]
    fn store_get_missing_returns_none() {
        let store = OpcUaMappingStore::new();
        assert_eq!(store.get("nonexistent"), None);
    }

    #[test]
    fn store_remove_returns_config() {
        let store = OpcUaMappingStore::new();
        let cfg = OpcUaMappingConfig::default_for_word();
        store.insert("temperature".to_string(), cfg.clone());
        assert_eq!(store.len(), 1);

        let removed = store.remove("temperature");
        assert_eq!(removed, Some(cfg));
        assert!(store.is_empty());
        assert_eq!(store.get("temperature"), None);
    }

    #[test]
    fn store_remove_missing_returns_none() {
        let store = OpcUaMappingStore::new();
        assert_eq!(store.remove("nonexistent"), None);
    }

    #[test]
    fn store_remove_many_batch_deletion() {
        let store = OpcUaMappingStore::new();
        store.insert("tag-a".to_string(), OpcUaMappingConfig::default_for_bool());
        store.insert("tag-b".to_string(), OpcUaMappingConfig::default_for_word());
        store.insert("tag-c".to_string(), OpcUaMappingConfig::default_for_bool());
        assert_eq!(store.len(), 3);

        let removed = store.remove_many(&[
            "tag-a".to_string(),
            "tag-c".to_string(),
            "tag-nonexistent".to_string(),
        ]);

        // Only existing tags are reported as removed
        assert_eq!(removed.len(), 2);
        assert!(removed.contains(&"tag-a".to_string()));
        assert!(removed.contains(&"tag-c".to_string()));

        // tag-b remains
        assert_eq!(store.len(), 1);
        assert!(store.contains("tag-b"));
        assert!(!store.contains("tag-a"));
        assert!(!store.contains("tag-c"));
    }

    #[test]
    fn store_clear_removes_all() {
        let store = OpcUaMappingStore::new();
        store.insert("a".to_string(), OpcUaMappingConfig::default());
        store.insert("b".to_string(), OpcUaMappingConfig::default());
        assert_eq!(store.len(), 2);

        store.clear();
        assert!(store.is_empty());
        assert_eq!(store.len(), 0);
    }

    #[test]
    fn store_contains() {
        let store = OpcUaMappingStore::new();
        store.insert("exists".to_string(), OpcUaMappingConfig::default());
        assert!(store.contains("exists"));
        assert!(!store.contains("missing"));
    }

    #[test]
    fn store_insert_replaces_existing() {
        let store = OpcUaMappingStore::new();
        let bool_cfg = OpcUaMappingConfig::default_for_bool();
        let word_cfg = OpcUaMappingConfig::default_for_word();

        store.insert("tag".to_string(), bool_cfg.clone());
        assert_eq!(store.get("tag").unwrap().opcua_data_type, OpcUaDataType::Boolean);

        let old = store.insert("tag".to_string(), word_cfg.clone());
        assert_eq!(old, Some(bool_cfg));
        assert_eq!(store.get("tag").unwrap().opcua_data_type, OpcUaDataType::UInt16);
        assert_eq!(store.len(), 1); // still just one entry
    }

    #[test]
    fn store_snapshot_returns_clone() {
        let store = OpcUaMappingStore::new();
        store.insert("x".to_string(), OpcUaMappingConfig::default_for_bool());
        store.insert("y".to_string(), OpcUaMappingConfig::default_for_word());

        let snapshot = store.snapshot();
        assert_eq!(snapshot.len(), 2);
        assert!(snapshot.contains_key("x"));
        assert!(snapshot.contains_key("y"));

        // Mutating the store doesn't affect the snapshot
        store.remove("x");
        assert_eq!(snapshot.len(), 2); // snapshot is independent
    }

    #[test]
    fn store_load_from_replaces_all() {
        let store = OpcUaMappingStore::new();
        store.insert("old".to_string(), OpcUaMappingConfig::default());

        let mut new_configs = HashMap::new();
        new_configs.insert("new-a".to_string(), OpcUaMappingConfig::default_for_bool());
        new_configs.insert("new-b".to_string(), OpcUaMappingConfig::default_for_word());

        store.load_from(new_configs);
        assert_eq!(store.len(), 2);
        assert!(!store.contains("old"));
        assert!(store.contains("new-a"));
        assert!(store.contains("new-b"));
    }

    #[test]
    fn store_tag_ids() {
        let store = OpcUaMappingStore::new();
        store.insert("alpha".to_string(), OpcUaMappingConfig::default());
        store.insert("beta".to_string(), OpcUaMappingConfig::default());

        let mut ids = store.tag_ids();
        ids.sort();
        assert_eq!(ids, vec!["alpha", "beta"]);
    }

    #[test]
    fn store_default_is_empty() {
        let store = OpcUaMappingStore::default();
        assert!(store.is_empty());
        assert_eq!(store.len(), 0);
    }


    // ========================================================================
    // IEEE 754 Float/Double register mapping tests
    // ========================================================================

    fn float_config(byte_order: ByteOrder) -> OpcUaMappingConfig {
        OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Float,
            word_count: 2,
            byte_order,
            access_level: MappingAccessLevel::ReadWrite,
            description: None,
            string_config: None,
        }
    }

    fn double_config(byte_order: ByteOrder) -> OpcUaMappingConfig {
        OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Double,
            word_count: 4,
            byte_order,
            access_level: MappingAccessLevel::ReadWrite,
            description: None,
            string_config: None,
        }
    }

    // --- f32 round-trip with all byte orders ---

    #[test]
    fn f32_round_trip_big_endian() {
        let val: f32 = 1.0;
        // IEEE 754: 1.0f32 = 0x3F800000
        let regs = f32_to_registers(val, ByteOrder::BigEndian);
        assert_eq!(regs, [0x3F80, 0x0000]);
        let result = registers_to_f32(&regs, ByteOrder::BigEndian);
        assert_eq!(result, val);
    }

    #[test]
    fn f32_round_trip_little_endian() {
        let val: f32 = 1.0;
        let regs = f32_to_registers(val, ByteOrder::LittleEndian);
        assert_eq!(regs, [0x0000, 0x3F80]); // reversed
        let result = registers_to_f32(&regs, ByteOrder::LittleEndian);
        assert_eq!(result, val);
    }

    #[test]
    fn f32_round_trip_big_endian_word_swap() {
        let val: f32 = 1.0;
        let regs = f32_to_registers(val, ByteOrder::BigEndianWordSwap);
        assert_eq!(regs, [0x0000, 0x3F80]); // adjacent pair swapped
        let result = registers_to_f32(&regs, ByteOrder::BigEndianWordSwap);
        assert_eq!(result, val);
    }

    #[test]
    fn f32_round_trip_little_endian_word_swap() {
        let val: f32 = 1.0;
        let regs = f32_to_registers(val, ByteOrder::LittleEndianWordSwap);
        assert_eq!(regs, [0x3F80, 0x0000]); // reverse then swap = identity for 2 words
        let result = registers_to_f32(&regs, ByteOrder::LittleEndianWordSwap);
        assert_eq!(result, val);
    }

    #[test]
    fn f32_various_values() {
        for val in [0.0f32, -1.0, 3.14, f32::MAX, f32::MIN, f32::INFINITY, f32::NEG_INFINITY] {
            for bo in [
                ByteOrder::BigEndian,
                ByteOrder::LittleEndian,
                ByteOrder::BigEndianWordSwap,
                ByteOrder::LittleEndianWordSwap,
            ] {
                let regs = f32_to_registers(val, bo);
                let result = registers_to_f32(&regs, bo);
                assert_eq!(result, val, "f32 round-trip failed for {} with {:?}", val, bo);
            }
        }
    }

    #[test]
    fn f32_nan_round_trip() {
        let val = f32::NAN;
        let regs = f32_to_registers(val, ByteOrder::BigEndian);
        let result = registers_to_f32(&regs, ByteOrder::BigEndian);
        assert!(result.is_nan());
    }

    // --- f64 round-trip with all byte orders ---

    #[test]
    fn f64_round_trip_big_endian() {
        let val: f64 = 1.0;
        // IEEE 754: 1.0f64 = 0x3FF0000000000000
        let regs = f64_to_registers(val, ByteOrder::BigEndian);
        assert_eq!(regs, [0x3FF0, 0x0000, 0x0000, 0x0000]);
        let result = registers_to_f64(&regs, ByteOrder::BigEndian);
        assert_eq!(result, val);
    }

    #[test]
    fn f64_round_trip_little_endian() {
        let val: f64 = 1.0;
        let regs = f64_to_registers(val, ByteOrder::LittleEndian);
        assert_eq!(regs, [0x0000, 0x0000, 0x0000, 0x3FF0]); // reversed
        let result = registers_to_f64(&regs, ByteOrder::LittleEndian);
        assert_eq!(result, val);
    }

    #[test]
    fn f64_round_trip_big_endian_word_swap() {
        let val: f64 = 1.0;
        let regs = f64_to_registers(val, ByteOrder::BigEndianWordSwap);
        // [0x3FF0, 0x0000, 0x0000, 0x0000] → swap pairs → [0x0000, 0x3FF0, 0x0000, 0x0000]
        assert_eq!(regs, [0x0000, 0x3FF0, 0x0000, 0x0000]);
        let result = registers_to_f64(&regs, ByteOrder::BigEndianWordSwap);
        assert_eq!(result, val);
    }

    #[test]
    fn f64_various_values() {
        for val in [0.0f64, -1.0, std::f64::consts::PI, f64::MAX, f64::MIN, f64::INFINITY] {
            for bo in [
                ByteOrder::BigEndian,
                ByteOrder::LittleEndian,
                ByteOrder::BigEndianWordSwap,
                ByteOrder::LittleEndianWordSwap,
            ] {
                let regs = f64_to_registers(val, bo);
                let result = registers_to_f64(&regs, bo);
                assert_eq!(result, val, "f64 round-trip failed for {} with {:?}", val, bo);
            }
        }
    }

    #[test]
    fn f64_nan_round_trip() {
        let val = f64::NAN;
        let regs = f64_to_registers(val, ByteOrder::BigEndian);
        let result = registers_to_f64(&regs, ByteOrder::BigEndian);
        assert!(result.is_nan());
    }

    // --- read_registers_to_mapped for Float/Double ---

    #[test]
    fn read_registers_float_big_endian() {
        let cfg = float_config(ByteOrder::BigEndian);
        // 1.0f32 = 0x3F800000
        let regs = [0x3F80u16, 0x0000];
        let result = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(result, MappedValue::Float(1.0));
    }

    #[test]
    fn read_registers_float_little_endian() {
        let cfg = float_config(ByteOrder::LittleEndian);
        let regs = [0x0000u16, 0x3F80]; // LE: LSW first
        let result = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(result, MappedValue::Float(1.0));
    }

    #[test]
    fn read_registers_double_big_endian() {
        let cfg = double_config(ByteOrder::BigEndian);
        // 1.0f64 = 0x3FF0000000000000
        let regs = [0x3FF0u16, 0x0000, 0x0000, 0x0000];
        let result = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(result, MappedValue::Double(1.0));
    }

    #[test]
    fn read_registers_float_insufficient_regs() {
        let cfg = float_config(ByteOrder::BigEndian);
        let regs = [0x3F80u16]; // only 1, need 2
        let result = read_registers_to_mapped(&cfg, &regs);
        assert!(result.is_err());
        match result.unwrap_err() {
            MappingError::InsufficientRegisters { expected, actual } => {
                assert_eq!(expected, 2);
                assert_eq!(actual, 1);
            }
            other => panic!("unexpected error: {:?}", other),
        }
    }

    #[test]
    fn read_registers_double_insufficient_regs() {
        let cfg = double_config(ByteOrder::BigEndian);
        let regs = [0x3FF0u16, 0x0000]; // only 2, need 4
        let result = read_registers_to_mapped(&cfg, &regs);
        assert!(result.is_err());
    }

    // --- write_mapped_to_registers for Float/Double ---

    #[test]
    fn write_float_big_endian() {
        let cfg = float_config(ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&cfg, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(result, vec![0x3F80, 0x0000]);
    }

    #[test]
    fn write_float_little_endian() {
        let cfg = float_config(ByteOrder::LittleEndian);
        let result = write_mapped_to_registers(&cfg, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(result, vec![0x0000, 0x3F80]);
    }

    #[test]
    fn write_double_big_endian() {
        let cfg = double_config(ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&cfg, &MappedValue::Double(1.0)).unwrap();
        assert_eq!(result, vec![0x3FF0, 0x0000, 0x0000, 0x0000]);
    }

    #[test]
    fn write_double_little_endian() {
        let cfg = double_config(ByteOrder::LittleEndian);
        let result = write_mapped_to_registers(&cfg, &MappedValue::Double(1.0)).unwrap();
        assert_eq!(result, vec![0x0000, 0x0000, 0x0000, 0x3FF0]);
    }

    // --- Float/Double round-trip through read/write mapped ---

    #[test]
    fn float_mapped_round_trip_all_byte_orders() {
        let val = 42.5f32;
        for bo in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let cfg = float_config(bo);
            let regs = write_mapped_to_registers(&cfg, &MappedValue::Float(val)).unwrap();
            assert_eq!(regs.len(), 2);
            let result = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(result, MappedValue::Float(val), "round-trip failed with {:?}", bo);
        }
    }

    #[test]
    fn double_mapped_round_trip_all_byte_orders() {
        let val = std::f64::consts::PI;
        for bo in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let cfg = double_config(bo);
            let regs = write_mapped_to_registers(&cfg, &MappedValue::Double(val)).unwrap();
            assert_eq!(regs.len(), 4);
            let result = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(result, MappedValue::Double(val), "round-trip failed with {:?}", bo);
        }
    }

    // --- Float/Double special values ---

    #[test]
    fn float_special_values_round_trip() {
        let cfg = float_config(ByteOrder::BigEndian);
        for val in [0.0f32, -0.0, f32::INFINITY, f32::NEG_INFINITY, f32::MIN, f32::MAX] {
            let regs = write_mapped_to_registers(&cfg, &MappedValue::Float(val)).unwrap();
            let result = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(result, MappedValue::Float(val));
        }
    }

    #[test]
    fn float_nan_mapped_round_trip() {
        let cfg = float_config(ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::Float(f32::NAN)).unwrap();
        let result = read_registers_to_mapped(&cfg, &regs).unwrap();
        match result {
            MappedValue::Float(v) => assert!(v.is_nan()),
            _ => panic!("expected Float"),
        }
    }

    #[test]
    fn double_special_values_round_trip() {
        let cfg = double_config(ByteOrder::BigEndian);
        for val in [0.0f64, -0.0, f64::INFINITY, f64::NEG_INFINITY, f64::MIN, f64::MAX] {
            let regs = write_mapped_to_registers(&cfg, &MappedValue::Double(val)).unwrap();
            let result = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(result, MappedValue::Double(val));
        }
    }

    // --- Type mismatch: Float config with Double value, etc. ---

    #[test]
    fn write_float_type_mismatch() {
        let cfg = float_config(ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&cfg, &MappedValue::Double(1.0));
        assert!(result.is_err());
        match result.unwrap_err() {
            MappingError::TypeMismatch { type_name, .. } => {
                assert_eq!(type_name, "Float");
            }
            other => panic!("expected TypeMismatch, got {:?}", other),
        }
    }

    #[test]
    fn write_double_type_mismatch() {
        let cfg = double_config(ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&cfg, &MappedValue::Float(1.0));
        assert!(result.is_err());
        match result.unwrap_err() {
            MappingError::TypeMismatch { type_name, .. } => {
                assert_eq!(type_name, "Double");
            }
            other => panic!("expected TypeMismatch, got {:?}", other),
        }
    }

    // --- Known IEEE 754 bit patterns ---

    #[test]
    fn f32_known_bit_pattern_pi() {
        // pi ≈ 3.14159274 as f32 = 0x40490FDB
        let val = std::f32::consts::PI;
        let regs = f32_to_registers(val, ByteOrder::BigEndian);
        assert_eq!(regs[0], 0x4049);
        assert_eq!(regs[1], 0x0FDB);
        let decoded = registers_to_f32(&regs, ByteOrder::BigEndian);
        assert_eq!(decoded, val);
    }

    #[test]
    fn f64_known_bit_pattern_pi() {
        // pi = 0x400921FB54442D18
        let val = std::f64::consts::PI;
        let regs = f64_to_registers(val, ByteOrder::BigEndian);
        assert_eq!(regs[0], 0x4009);
        assert_eq!(regs[1], 0x21FB);
        assert_eq!(regs[2], 0x5444);
        assert_eq!(regs[3], 0x2D18);
        let decoded = registers_to_f64(&regs, ByteOrder::BigEndian);
        assert_eq!(decoded, val);
    }

    // ========================================================================
    // AC 9: deviceAddress as single source of truth — register range derivation
    // ========================================================================

    #[test]
    fn register_range_single_word() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
        let cfg = OpcUaMappingConfig::default_for_word();
        let range = cfg.register_range(addr);

        assert_eq!(range.area, CanonicalAreaKind::DataWord);
        assert_eq!(range.start_index, 100);
        assert_eq!(range.word_count, 1);
        assert_eq!(range.end_index(), 101);
        assert!(range.bit_index.is_none());
        assert!(range.is_single());
    }

    #[test]
    fn register_range_multi_word_int32() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 50);
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 2,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        };
        let range = cfg.register_range(addr);

        assert_eq!(range.start_index, 50);
        assert_eq!(range.word_count, 2);
        assert_eq!(range.end_index(), 52);
        assert!(!range.is_single());
    }

    #[test]
    fn register_range_four_word_double() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 200);
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Double,
            word_count: 4,
            byte_order: ByteOrder::LittleEndian,
            access_level: MappingAccessLevel::ReadWrite,
            description: None,
            string_config: None,
        };
        let range = cfg.register_range(addr);

        assert_eq!(range.start_index, 200);
        assert_eq!(range.end_index(), 204);
        assert_eq!(range.word_count, 4);
    }

    #[test]
    fn register_range_boolean_with_bit_index() {
        let addr = CanonicalAddress::with_bit_index(CanonicalAreaKind::DataWord, 10, 3);
        let cfg = OpcUaMappingConfig::default_for_bool();
        let range = cfg.register_range(addr);

        assert_eq!(range.area, CanonicalAreaKind::DataWord);
        assert_eq!(range.start_index, 10);
        assert_eq!(range.bit_index, Some(3));
        assert!(range.is_single());
    }

    #[test]
    fn register_range_addresses_word_span() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 2,
            ..Default::default()
        };
        let range = cfg.register_range(addr);
        let addrs = range.addresses();

        assert_eq!(addrs.len(), 2);
        assert_eq!(
            addrs[0],
            CanonicalAddress::new(CanonicalAreaKind::DataWord, 100)
        );
        assert_eq!(
            addrs[1],
            CanonicalAddress::new(CanonicalAreaKind::DataWord, 101)
        );
    }

    #[test]
    fn register_range_addresses_bool_with_bit() {
        let addr = CanonicalAddress::with_bit_index(CanonicalAreaKind::DataWord, 5, 7);
        let cfg = OpcUaMappingConfig::default_for_bool();
        let range = cfg.register_range(addr);
        let addrs = range.addresses();

        assert_eq!(addrs.len(), 1);
        assert_eq!(
            addrs[0],
            CanonicalAddress::with_bit_index(CanonicalAreaKind::DataWord, 5, 7)
        );
    }

    #[test]
    fn register_range_addresses_four_word() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::RetentiveWord, 0);
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int64,
            word_count: 4,
            ..Default::default()
        };
        let range = cfg.register_range(addr);
        let addrs = range.addresses();

        assert_eq!(addrs.len(), 4);
        for (i, a) in addrs.iter().enumerate() {
            assert_eq!(a.area, CanonicalAreaKind::RetentiveWord);
            assert_eq!(a.index, i as u32);
            assert!(a.bit_index.is_none());
        }
    }

    #[test]
    fn register_range_overlaps_same_area() {
        let r1 = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 100,
            word_count: 2,
            bit_index: None,
        };
        let r2 = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 101,
            word_count: 2,
            bit_index: None,
        };
        assert!(r1.overlaps(&r2));
        assert!(r2.overlaps(&r1));
    }

    #[test]
    fn register_range_no_overlap_adjacent() {
        let r1 = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 100,
            word_count: 2,
            bit_index: None,
        };
        let r2 = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 102,
            word_count: 2,
            bit_index: None,
        };
        assert!(!r1.overlaps(&r2));
        assert!(!r2.overlaps(&r1));
    }

    #[test]
    fn register_range_no_overlap_different_areas() {
        let r1 = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 100,
            word_count: 2,
            bit_index: None,
        };
        let r2 = RegisterRange {
            area: CanonicalAreaKind::RetentiveWord,
            start_index: 100,
            word_count: 2,
            bit_index: None,
        };
        assert!(!r1.overlaps(&r2));
    }

    #[test]
    fn register_range_validate_bounds_ok() {
        let range = RegisterRange {
            area: CanonicalAreaKind::DataWord, // default_size = 10000
            start_index: 9998,
            word_count: 2,
            bit_index: None,
        };
        assert!(range.validate_bounds().is_ok());
    }

    #[test]
    fn register_range_validate_bounds_exceed() {
        let range = RegisterRange {
            area: CanonicalAreaKind::DataWord, // default_size = 10000
            start_index: 9999,
            word_count: 2,
            bit_index: None,
        };
        assert!(range.validate_bounds().is_err());
    }

    #[test]
    fn validated_register_range_ok() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 2,
            ..Default::default()
        };
        let range = cfg.validated_register_range(addr).unwrap();
        assert_eq!(range.start_index, 100);
        assert_eq!(range.end_index(), 102);
    }

    #[test]
    fn validated_register_range_rejects_bad_word_count() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 1, // needs 2
            ..Default::default()
        };
        assert!(cfg.validated_register_range(addr).is_err());
    }

    #[test]
    fn validated_register_range_rejects_out_of_bounds() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::IndexWord, 15); // default_size = 16
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 2, // 15+2=17 > 16
            ..Default::default()
        };
        assert!(cfg.validated_register_range(addr).is_err());
    }

    #[test]
    fn device_address_is_single_source_of_truth() {
        // The same mapping config applied to different deviceAddresses
        // produces different register ranges — proving deviceAddress is
        // the single source of truth for location.
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Float,
            word_count: 2,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        };

        let addr_a = CanonicalAddress::new(CanonicalAreaKind::DataWord, 0);
        let addr_b = CanonicalAddress::new(CanonicalAreaKind::DataWord, 500);
        let addr_c = CanonicalAddress::new(CanonicalAreaKind::RetentiveWord, 0);

        let range_a = cfg.register_range(addr_a);
        let range_b = cfg.register_range(addr_b);
        let range_c = cfg.register_range(addr_c);

        // Same config, different addresses → different ranges
        assert_eq!(range_a.start_index, 0);
        assert_eq!(range_b.start_index, 500);
        assert_eq!(range_c.start_index, 0);

        // Area comes from deviceAddress, not from config
        assert_eq!(range_a.area, CanonicalAreaKind::DataWord);
        assert_eq!(range_c.area, CanonicalAreaKind::RetentiveWord);

        // word_count comes from config
        assert_eq!(range_a.word_count, 2);
        assert_eq!(range_b.word_count, 2);
        assert_eq!(range_c.word_count, 2);
    }

    #[test]
    fn register_range_preserves_bit_index_from_device_address() {
        // bit_index flows through from deviceAddress, not from config
        let addr =
            CanonicalAddress::with_bit_index(CanonicalAreaKind::InternalBit, 42, 5);
        let cfg = OpcUaMappingConfig::default_for_bool();
        let range = cfg.register_range(addr);

        assert_eq!(range.bit_index, Some(5));
        assert_eq!(range.start_index, 42);
        assert_eq!(range.area, CanonicalAreaKind::InternalBit);
    }
