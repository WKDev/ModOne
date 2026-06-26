// MappedValue→U16 레지스터 분해를 모든 바이트 순서에 대해 검증하는 테스트
use crate::mapping::*;


    /// Helper to create a config for a given data type, word count, and byte order.
    fn cfg(dt: OpcUaDataType, wc: u16, bo: ByteOrder) -> OpcUaMappingConfig {
        OpcUaMappingConfig {
            opcua_data_type: dt,
            word_count: wc,
            byte_order: bo,
            access_level: MappingAccessLevel::ReadWrite,
            description: None,
            string_config: None,
        }
    }

    // -----------------------------------------------------------------------
    // 8-bit types: SByte / Byte — single register, byte order irrelevant
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_sbyte_positive() {
        let c = cfg(OpcUaDataType::SByte, 1, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::SByte(42)).unwrap();
        assert_eq!(regs, vec![42u16]);
    }

    #[test]
    fn decompose_sbyte_negative() {
        let c = cfg(OpcUaDataType::SByte, 1, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::SByte(-1)).unwrap();
        // -1i8 as u8 = 0xFF, as u16 = 0x00FF
        assert_eq!(regs, vec![0x00FFu16]);
    }

    #[test]
    fn decompose_sbyte_min_max() {
        let c = cfg(OpcUaDataType::SByte, 1, ByteOrder::BigEndian);
        let min_regs = write_mapped_to_registers(&c, &MappedValue::SByte(i8::MIN)).unwrap();
        assert_eq!(min_regs, vec![0x0080u16]); // -128 as u8 = 0x80
        let max_regs = write_mapped_to_registers(&c, &MappedValue::SByte(i8::MAX)).unwrap();
        assert_eq!(max_regs, vec![0x007Fu16]); // 127
    }

    #[test]
    fn decompose_byte_zero_and_max() {
        let c = cfg(OpcUaDataType::Byte, 1, ByteOrder::BigEndian);
        assert_eq!(
            write_mapped_to_registers(&c, &MappedValue::Byte(0)).unwrap(),
            vec![0u16]
        );
        assert_eq!(
            write_mapped_to_registers(&c, &MappedValue::Byte(255)).unwrap(),
            vec![255u16]
        );
    }

    // -----------------------------------------------------------------------
    // 16-bit types: Int16 / UInt16 — single register, byte order irrelevant
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_int16_positive_and_negative() {
        let c = cfg(OpcUaDataType::Int16, 1, ByteOrder::BigEndian);
        assert_eq!(
            write_mapped_to_registers(&c, &MappedValue::Int16(1234)).unwrap(),
            vec![1234u16]
        );
        // -1i16 as u16 = 0xFFFF
        assert_eq!(
            write_mapped_to_registers(&c, &MappedValue::Int16(-1)).unwrap(),
            vec![0xFFFFu16]
        );
    }

    #[test]
    fn decompose_uint16_boundary() {
        let c = cfg(OpcUaDataType::UInt16, 1, ByteOrder::BigEndian);
        assert_eq!(
            write_mapped_to_registers(&c, &MappedValue::UInt16(0)).unwrap(),
            vec![0u16]
        );
        assert_eq!(
            write_mapped_to_registers(&c, &MappedValue::UInt16(0xFFFF)).unwrap(),
            vec![0xFFFFu16]
        );
    }

    // -----------------------------------------------------------------------
    // 32-bit integers: Int32 / UInt32 — 2 registers, all 4 byte orders
    // -----------------------------------------------------------------------

    /// Test value: 0x12345678 → logical order [0x1234, 0x5678]
    const TEST_I32: i32 = 0x12345678_i32;
    const TEST_U32: u32 = 0x12345678_u32;

    #[test]
    fn decompose_int32_big_endian() {
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int32(TEST_I32)).unwrap();
        // BigEndian: address order = logical order → [0x1234, 0x5678]
        assert_eq!(regs, vec![0x1234, 0x5678]);
    }

    #[test]
    fn decompose_int32_little_endian() {
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::LittleEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int32(TEST_I32)).unwrap();
        // LittleEndian: reversed → [0x5678, 0x1234]
        assert_eq!(regs, vec![0x5678, 0x1234]);
    }

    #[test]
    fn decompose_int32_big_endian_word_swap() {
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int32(TEST_I32)).unwrap();
        // BigEndianWordSwap: swap pairs → [0x5678, 0x1234]
        assert_eq!(regs, vec![0x5678, 0x1234]);
    }

    #[test]
    fn decompose_int32_little_endian_word_swap() {
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::LittleEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int32(TEST_I32)).unwrap();
        // LittleEndianWordSwap: reverse then swap pairs → [0x1234, 0x5678]
        assert_eq!(regs, vec![0x1234, 0x5678]);
    }

    #[test]
    fn decompose_uint32_all_byte_orders() {
        let orders_and_expected: &[(ByteOrder, Vec<u16>)] = &[
            (ByteOrder::BigEndian, vec![0x1234, 0x5678]),
            (ByteOrder::LittleEndian, vec![0x5678, 0x1234]),
            (ByteOrder::BigEndianWordSwap, vec![0x5678, 0x1234]),
            (ByteOrder::LittleEndianWordSwap, vec![0x1234, 0x5678]),
        ];
        for (bo, expected) in orders_and_expected {
            let c = cfg(OpcUaDataType::UInt32, 2, *bo);
            let regs = write_mapped_to_registers(&c, &MappedValue::UInt32(TEST_U32)).unwrap();
            assert_eq!(regs, *expected, "UInt32 with {:?}", bo);
        }
    }

    #[test]
    fn decompose_int32_negative_value() {
        // -1 → 0xFFFFFFFF → logical [0xFFFF, 0xFFFF]
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int32(-1)).unwrap();
        assert_eq!(regs, vec![0xFFFF, 0xFFFF]);
    }

    #[test]
    fn decompose_int32_min_value() {
        // i32::MIN = 0x80000000 → logical [0x8000, 0x0000]
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int32(i32::MIN)).unwrap();
        assert_eq!(regs, vec![0x8000, 0x0000]);
    }

    // -----------------------------------------------------------------------
    // 64-bit integers: Int64 / UInt64 — 4 registers, all 4 byte orders
    // -----------------------------------------------------------------------

    /// Test value: 0x0011_2233_4455_6677
    /// Logical order: [0x0011, 0x2233, 0x4455, 0x6677]
    const TEST_I64: i64 = 0x0011_2233_4455_6677_i64;
    const TEST_U64: u64 = 0x0011_2233_4455_6677_u64;

    #[test]
    fn decompose_int64_big_endian() {
        let c = cfg(OpcUaDataType::Int64, 4, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int64(TEST_I64)).unwrap();
        assert_eq!(regs, vec![0x0011, 0x2233, 0x4455, 0x6677]);
    }

    #[test]
    fn decompose_int64_little_endian() {
        let c = cfg(OpcUaDataType::Int64, 4, ByteOrder::LittleEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int64(TEST_I64)).unwrap();
        // Reversed: [0x6677, 0x4455, 0x2233, 0x0011]
        assert_eq!(regs, vec![0x6677, 0x4455, 0x2233, 0x0011]);
    }

    #[test]
    fn decompose_int64_big_endian_word_swap() {
        let c = cfg(OpcUaDataType::Int64, 4, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int64(TEST_I64)).unwrap();
        // Swap pairs: [0x2233, 0x0011, 0x6677, 0x4455]
        assert_eq!(regs, vec![0x2233, 0x0011, 0x6677, 0x4455]);
    }

    #[test]
    fn decompose_int64_little_endian_word_swap() {
        let c = cfg(OpcUaDataType::Int64, 4, ByteOrder::LittleEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int64(TEST_I64)).unwrap();
        // Reverse then swap pairs: [0x4455, 0x6677, 0x0011, 0x2233]
        assert_eq!(regs, vec![0x4455, 0x6677, 0x0011, 0x2233]);
    }

    #[test]
    fn decompose_uint64_all_byte_orders() {
        let orders_and_expected: &[(ByteOrder, Vec<u16>)] = &[
            (ByteOrder::BigEndian, vec![0x0011, 0x2233, 0x4455, 0x6677]),
            (ByteOrder::LittleEndian, vec![0x6677, 0x4455, 0x2233, 0x0011]),
            (ByteOrder::BigEndianWordSwap, vec![0x2233, 0x0011, 0x6677, 0x4455]),
            (ByteOrder::LittleEndianWordSwap, vec![0x4455, 0x6677, 0x0011, 0x2233]),
        ];
        for (bo, expected) in orders_and_expected {
            let c = cfg(OpcUaDataType::UInt64, 4, *bo);
            let regs = write_mapped_to_registers(&c, &MappedValue::UInt64(TEST_U64)).unwrap();
            assert_eq!(regs, *expected, "UInt64 with {:?}", bo);
        }
    }

    #[test]
    fn decompose_int64_negative_one() {
        let c = cfg(OpcUaDataType::Int64, 4, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int64(-1)).unwrap();
        assert_eq!(regs, vec![0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF]);
    }

    // -----------------------------------------------------------------------
    // Float (IEEE 754 single) — 2 registers, all 4 byte orders
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_float_big_endian() {
        // 1.0f32 = 0x3F800000 → logical [0x3F80, 0x0000]
        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(regs, vec![0x3F80, 0x0000]);
    }

    #[test]
    fn decompose_float_little_endian() {
        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::LittleEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(regs, vec![0x0000, 0x3F80]);
    }

    #[test]
    fn decompose_float_big_endian_word_swap() {
        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(regs, vec![0x0000, 0x3F80]);
    }

    #[test]
    fn decompose_float_little_endian_word_swap() {
        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::LittleEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(regs, vec![0x3F80, 0x0000]);
    }

    #[test]
    fn decompose_float_known_value() {
        // 12345.6789 ≈ 0x4640E6B7 → logical [0x4640, 0xE6B7]
        let val: f32 = 12345.6789;
        let bits = val.to_bits();
        let hi = (bits >> 16) as u16;
        let lo = bits as u16;

        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(val)).unwrap();
        assert_eq!(regs, vec![hi, lo]);
    }

    #[test]
    fn decompose_float_negative_infinity() {
        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(f32::NEG_INFINITY)).unwrap();
        let bits = f32::NEG_INFINITY.to_bits();
        assert_eq!(regs, vec![(bits >> 16) as u16, bits as u16]);
    }

    // -----------------------------------------------------------------------
    // Double (IEEE 754 double) — 4 registers, all 4 byte orders
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_double_big_endian() {
        // 1.0f64 = 0x3FF0000000000000 → logical [0x3FF0, 0x0000, 0x0000, 0x0000]
        let c = cfg(OpcUaDataType::Double, 4, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Double(1.0)).unwrap();
        assert_eq!(regs, vec![0x3FF0, 0x0000, 0x0000, 0x0000]);
    }

    #[test]
    fn decompose_double_little_endian() {
        let c = cfg(OpcUaDataType::Double, 4, ByteOrder::LittleEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Double(1.0)).unwrap();
        assert_eq!(regs, vec![0x0000, 0x0000, 0x0000, 0x3FF0]);
    }

    #[test]
    fn decompose_double_big_endian_word_swap() {
        let c = cfg(OpcUaDataType::Double, 4, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Double(1.0)).unwrap();
        // Swap pairs: [0x0000, 0x3FF0, 0x0000, 0x0000]
        assert_eq!(regs, vec![0x0000, 0x3FF0, 0x0000, 0x0000]);
    }

    #[test]
    fn decompose_double_little_endian_word_swap() {
        let c = cfg(OpcUaDataType::Double, 4, ByteOrder::LittleEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Double(1.0)).unwrap();
        // Reverse [0x0000, 0x0000, 0x0000, 0x3FF0] then swap pairs: [0x0000, 0x0000, 0x3FF0, 0x0000]
        assert_eq!(regs, vec![0x0000, 0x0000, 0x3FF0, 0x0000]);
    }

    #[test]
    fn decompose_double_all_byte_orders() {
        // π ≈ 3.141592653589793 → 0x400921FB54442D18
        let val = std::f64::consts::PI;
        let bits = val.to_bits();
        let logical = [
            (bits >> 48) as u16,
            (bits >> 32) as u16,
            (bits >> 16) as u16,
            bits as u16,
        ];

        let orders_and_expected: Vec<(ByteOrder, Vec<u16>)> = vec![
            (ByteOrder::BigEndian, logical.to_vec()),
            (ByteOrder::LittleEndian, {
                let mut v = logical.to_vec();
                v.reverse();
                v
            }),
            (ByteOrder::BigEndianWordSwap, vec![logical[1], logical[0], logical[3], logical[2]]),
            (ByteOrder::LittleEndianWordSwap, {
                // reverse then swap pairs
                let mut v = logical.to_vec();
                v.reverse();
                for chunk in v.chunks_exact_mut(2) {
                    chunk.swap(0, 1);
                }
                v
            }),
        ];

        for (bo, expected) in &orders_and_expected {
            let c = cfg(OpcUaDataType::Double, 4, *bo);
            let regs = write_mapped_to_registers(&c, &MappedValue::Double(val)).unwrap();
            assert_eq!(regs, *expected, "Double(π) with {:?}", bo);
        }
    }

    // -----------------------------------------------------------------------
    // Boolean — should error (must use write_bool_mapped instead)
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_boolean_returns_error() {
        let c = cfg(OpcUaDataType::Boolean, 1, ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&c, &MappedValue::Boolean(true));
        assert!(matches!(result, Err(MappingError::BooleanTypeMismatch)));
    }

    // -----------------------------------------------------------------------
    // Type mismatch — wrong MappedValue variant for config type
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_type_mismatch_int32_with_uint32_value() {
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&c, &MappedValue::UInt32(42));
        assert!(matches!(result, Err(MappingError::TypeMismatch { .. })));
    }

    #[test]
    fn decompose_type_mismatch_float_with_double_value() {
        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&c, &MappedValue::Double(1.0));
        assert!(matches!(result, Err(MappingError::TypeMismatch { .. })));
    }

    // -----------------------------------------------------------------------
    // Round-trip: decompose then reassemble preserves value for all byte orders
    // -----------------------------------------------------------------------

    #[test]
    fn roundtrip_int32_all_byte_orders() {
        let value = MappedValue::Int32(0x7ABCDEF0_u32 as i32);
        for bo in &[
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let c = cfg(OpcUaDataType::Int32, 2, *bo);
            let regs = write_mapped_to_registers(&c, &value).unwrap();
            let read_back = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read_back, value, "Int32 roundtrip with {:?}", bo);
        }
    }

    #[test]
    fn roundtrip_uint64_all_byte_orders() {
        let value = MappedValue::UInt64(0xDEADBEEF_CAFEBABE);
        for bo in &[
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let c = cfg(OpcUaDataType::UInt64, 4, *bo);
            let regs = write_mapped_to_registers(&c, &value).unwrap();
            let read_back = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read_back, value, "UInt64 roundtrip with {:?}", bo);
        }
    }

    #[test]
    fn roundtrip_float_all_byte_orders() {
        let value = MappedValue::Float(-273.15);
        for bo in &[
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let c = cfg(OpcUaDataType::Float, 2, *bo);
            let regs = write_mapped_to_registers(&c, &value).unwrap();
            let read_back = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read_back, value, "Float roundtrip with {:?}", bo);
        }
    }

    #[test]
    fn roundtrip_double_all_byte_orders() {
        let value = MappedValue::Double(std::f64::consts::E);
        for bo in &[
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let c = cfg(OpcUaDataType::Double, 4, *bo);
            let regs = write_mapped_to_registers(&c, &value).unwrap();
            let read_back = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read_back, value, "Double roundtrip with {:?}", bo);
        }
    }

    #[test]
    fn roundtrip_uint16_single_register() {
        let value = MappedValue::UInt16(0xABCD);
        let c = cfg(OpcUaDataType::UInt16, 1, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &value).unwrap();
        assert_eq!(regs, vec![0xABCD]);
        let read_back = read_registers_to_mapped(&c, &regs).unwrap();
        assert_eq!(read_back, value);
    }

    #[test]
    fn roundtrip_sbyte_all_values_preserve() {
        let c = cfg(OpcUaDataType::SByte, 1, ByteOrder::BigEndian);
        for v in [i8::MIN, -1, 0, 1, i8::MAX] {
            let value = MappedValue::SByte(v);
            let regs = write_mapped_to_registers(&c, &value).unwrap();
            let read_back = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read_back, value, "SByte roundtrip for {}", v);
        }
    }

    // -----------------------------------------------------------------------
    // Verify different byte orders produce distinct register layouts
    // -----------------------------------------------------------------------

    #[test]
    fn byte_orders_produce_distinct_layouts_for_uint32() {
        let c_be = cfg(OpcUaDataType::UInt32, 2, ByteOrder::BigEndian);
        let c_le = cfg(OpcUaDataType::UInt32, 2, ByteOrder::LittleEndian);
        let val = MappedValue::UInt32(0xAAAA_BBBBu32);

        let regs_be = write_mapped_to_registers(&c_be, &val).unwrap();
        let regs_le = write_mapped_to_registers(&c_le, &val).unwrap();

        // BE: [0xAAAA, 0xBBBB], LE: [0xBBBB, 0xAAAA]
        assert_ne!(regs_be, regs_le, "BE and LE should produce different register layouts");
        assert_eq!(regs_be, vec![0xAAAA, 0xBBBB]);
        assert_eq!(regs_le, vec![0xBBBB, 0xAAAA]);
    }

    #[test]
    fn byte_orders_produce_distinct_layouts_for_int64() {
        let val = MappedValue::Int64(0x1111_2222_3333_4444_i64);
        let mut all_regs: Vec<Vec<u16>> = Vec::new();
        for bo in &[
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let c = cfg(OpcUaDataType::Int64, 4, *bo);
            let regs = write_mapped_to_registers(&c, &val).unwrap();
            all_regs.push(regs);
        }
        // All 4 byte orders should produce distinct register layouts
        for i in 0..all_regs.len() {
            for j in (i + 1)..all_regs.len() {
                assert_ne!(
                    all_regs[i], all_regs[j],
                    "Byte orders {} and {} should produce different layouts",
                    i, j
                );
            }
        }
    }

    // -----------------------------------------------------------------------
    // Edge cases: zero values
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_zero_values_all_types() {
        // Zero produces all-zero registers regardless of byte order
        let test_cases: Vec<(OpcUaDataType, u16, MappedValue, usize)> = vec![
            (OpcUaDataType::SByte, 1, MappedValue::SByte(0), 1),
            (OpcUaDataType::Byte, 1, MappedValue::Byte(0), 1),
            (OpcUaDataType::Int16, 1, MappedValue::Int16(0), 1),
            (OpcUaDataType::UInt16, 1, MappedValue::UInt16(0), 1),
            (OpcUaDataType::Int32, 2, MappedValue::Int32(0), 2),
            (OpcUaDataType::UInt32, 2, MappedValue::UInt32(0), 2),
            (OpcUaDataType::Int64, 4, MappedValue::Int64(0), 4),
            (OpcUaDataType::UInt64, 4, MappedValue::UInt64(0), 4),
            (OpcUaDataType::Float, 2, MappedValue::Float(0.0), 2),
            (OpcUaDataType::Double, 4, MappedValue::Double(0.0), 4),
        ];

        for (dt, wc, val, expected_len) in &test_cases {
            for bo in &[
                ByteOrder::BigEndian,
                ByteOrder::LittleEndian,
                ByteOrder::BigEndianWordSwap,
                ByteOrder::LittleEndianWordSwap,
            ] {
                let c = cfg(*dt, *wc, *bo);
                let regs = write_mapped_to_registers(&c, val).unwrap();
                assert_eq!(regs.len(), *expected_len, "{:?} register count", dt);
                assert!(
                    regs.iter().all(|&r| r == 0),
                    "Zero {:?} with {:?} should produce all-zero registers, got {:?}",
                    dt,
                    bo,
                    regs
                );
            }
        }
    }
