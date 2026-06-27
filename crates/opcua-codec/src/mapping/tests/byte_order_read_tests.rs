// 동일 레지스터에 대한 바이트 순서별 read 결과와 문자열 maxStringLength 테스트
use crate::mapping::*;


    fn cfg(dt: OpcUaDataType, bo: ByteOrder) -> OpcUaMappingConfig {
        OpcUaMappingConfig {
            opcua_data_type: dt,
            word_count: dt.default_word_count(),
            byte_order: bo,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
            scaling: ScalingConfig::default(),
        }
    }

    // -- Same registers, different byte orders produce different values --

    #[test]
    fn same_registers_different_byte_order_uint32() {
        let regs = [0x0001u16, 0x0002];

        let be = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::BigEndian), &regs,
        ).unwrap();
        assert_eq!(be, MappedValue::UInt32(0x0001_0002));

        let le = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(le, MappedValue::UInt32(0x0002_0001));

        let bews = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(bews, MappedValue::UInt32(0x0002_0001));

        let lews = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::LittleEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(lews, MappedValue::UInt32(0x0001_0002));

        assert_ne!(be, le);
    }

    #[test]
    fn same_registers_different_byte_order_int32() {
        let regs = [0xFFFFu16, 0xFFFE];

        let be = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int32, ByteOrder::BigEndian), &regs,
        ).unwrap();
        assert_eq!(be, MappedValue::Int32(-2));

        let le = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int32, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(le, MappedValue::Int32(-65537));
    }

    #[test]
    fn same_registers_different_byte_order_uint64() {
        let regs = [0x0001u16, 0x0002, 0x0003, 0x0004];

        let be = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt64, ByteOrder::BigEndian), &regs,
        ).unwrap();
        assert_eq!(be, MappedValue::UInt64(0x0001_0002_0003_0004));

        let le = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt64, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(le, MappedValue::UInt64(0x0004_0003_0002_0001));

        assert_ne!(be, le);
    }

    #[test]
    fn same_registers_different_byte_order_float() {
        let regs = [0x3F80u16, 0x0000];

        let be = read_registers_to_mapped(
            &cfg(OpcUaDataType::Float, ByteOrder::BigEndian), &regs,
        ).unwrap();
        assert_eq!(be, MappedValue::Float(1.0));

        let le = read_registers_to_mapped(
            &cfg(OpcUaDataType::Float, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_ne!(le, MappedValue::Float(1.0));
    }

    #[test]
    fn same_registers_different_byte_order_double() {
        let regs = [0x3FF0u16, 0x0000, 0x0000, 0x0000];

        let be = read_registers_to_mapped(
            &cfg(OpcUaDataType::Double, ByteOrder::BigEndian), &regs,
        ).unwrap();
        assert_eq!(be, MappedValue::Double(1.0));

        let le = read_registers_to_mapped(
            &cfg(OpcUaDataType::Double, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_ne!(le, MappedValue::Double(1.0));
    }

    // -- BigEndianWordSwap (BA-DC pattern) --

    #[test]
    fn big_endian_word_swap_uint32_known_value() {
        let regs = [0x5678u16, 0x1234];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::UInt32(0x12345678));
    }

    #[test]
    fn big_endian_word_swap_int32_negative() {
        let regs = [0xFFFFu16, 0xFFFF];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int32, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::Int32(-1));
    }

    #[test]
    fn big_endian_word_swap_uint64_known_value() {
        let regs = [0x2222u16, 0x1111, 0x4444, 0x3333];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt64, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::UInt64(0x1111222233334444));
    }

    #[test]
    fn big_endian_word_swap_float_pi() {
        let regs = [0x0FDBu16, 0x4049];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::Float, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::Float(std::f32::consts::PI));
    }

    #[test]
    fn big_endian_word_swap_double_pi() {
        let regs = [0x21FBu16, 0x4009, 0x2D18, 0x5444];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::Double, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::Double(std::f64::consts::PI));
    }

    // -- LittleEndianWordSwap (CD-AB pattern) --

    #[test]
    fn little_endian_word_swap_uint32_known_value() {
        let regs = [0x1234u16, 0x5678];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::LittleEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::UInt32(0x12345678));
    }

    #[test]
    fn little_endian_word_swap_uint64_known_value() {
        let regs = [0x3333u16, 0x4444, 0x1111, 0x2222];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt64, ByteOrder::LittleEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::UInt64(0x1111222233334444));
    }

    // -- LittleEndian specific tests --

    #[test]
    fn little_endian_uint32_known_value() {
        let regs = [0x5678u16, 0x1234];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::UInt32(0x12345678));
    }

    #[test]
    fn little_endian_uint64_known_value() {
        let regs = [0x4444u16, 0x3333, 0x2222, 0x1111];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt64, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::UInt64(0x1111222233334444));
    }

    #[test]
    fn little_endian_float_pi() {
        let regs = [0x0FDBu16, 0x4049];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::Float, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::Float(std::f32::consts::PI));
    }

    #[test]
    fn little_endian_double_pi() {
        let regs = [0x2D18u16, 0x5444, 0x21FB, 0x4009];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::Double, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::Double(std::f64::consts::PI));
    }

    // -- Single-register types unaffected by byte order --

    #[test]
    fn single_register_types_unaffected_by_byte_order() {
        let all_orders = [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ];
        let reg = [0xABCDu16];

        for order in all_orders {
            let result =
                read_registers_to_mapped(&cfg(OpcUaDataType::UInt16, order), &reg).unwrap();
            assert_eq!(result, MappedValue::UInt16(0xABCD),
                "UInt16 unaffected by {:?}", order);

            let result =
                read_registers_to_mapped(&cfg(OpcUaDataType::Int16, order), &reg).unwrap();
            assert_eq!(result, MappedValue::Int16(0xABCDu16 as i16),
                "Int16 unaffected by {:?}", order);

            let result =
                read_registers_to_mapped(&cfg(OpcUaDataType::Byte, order), &reg).unwrap();
            assert_eq!(result, MappedValue::Byte(0xCD),
                "Byte unaffected by {:?}", order);

            let result =
                read_registers_to_mapped(&cfg(OpcUaDataType::SByte, order), &reg).unwrap();
            assert_eq!(result, MappedValue::SByte(0xCDu8 as i8),
                "SByte unaffected by {:?}", order);
        }
    }

    // -- Per-tag: two tags with different byte orders on same data --

    #[test]
    fn per_tag_byte_order_two_tags_same_registers() {
        let regs = [0xAAAAu16, 0xBBBB];

        let tag_a_cfg = cfg(OpcUaDataType::UInt32, ByteOrder::BigEndian);
        let tag_b_cfg = cfg(OpcUaDataType::UInt32, ByteOrder::LittleEndian);

        let val_a = read_registers_to_mapped(&tag_a_cfg, &regs).unwrap();
        let val_b = read_registers_to_mapped(&tag_b_cfg, &regs).unwrap();

        assert_eq!(val_a, MappedValue::UInt32(0xAAAABBBB));
        assert_eq!(val_b, MappedValue::UInt32(0xBBBBAAAA));
        assert_ne!(val_a, val_b);
    }

    #[test]
    fn per_tag_byte_order_four_tags_int64() {
        let regs = [0x0011u16, 0x0022, 0x0033, 0x0044];

        let be = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int64, ByteOrder::BigEndian), &regs,
        ).unwrap();
        let le = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int64, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        let bews = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int64, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        let lews = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int64, ByteOrder::LittleEndianWordSwap), &regs,
        ).unwrap();

        let values = [&be, &le, &bews, &lews];
        for i in 0..values.len() {
            for j in (i + 1)..values.len() {
                assert_ne!(values[i], values[j],
                    "byte orders {} and {} should differ", i, j);
            }
        }
    }

    // -- Round-trip: write then read with each byte order --

    #[test]
    fn round_trip_all_byte_orders_all_multi_register_types() {
        let orders = [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ];

        for order in orders {
            let c = cfg(OpcUaDataType::Int32, order);
            let regs = write_mapped_to_registers(&c, &MappedValue::Int32(-123456)).unwrap();
            let read = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read, MappedValue::Int32(-123456), "Int32 {:?}", order);

            let c = cfg(OpcUaDataType::UInt32, order);
            let regs = write_mapped_to_registers(&c, &MappedValue::UInt32(0xDEADBEEF)).unwrap();
            let read = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read, MappedValue::UInt32(0xDEADBEEF), "UInt32 {:?}", order);

            let c = cfg(OpcUaDataType::Int64, order);
            let regs = write_mapped_to_registers(&c, &MappedValue::Int64(-9876543210)).unwrap();
            let read = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read, MappedValue::Int64(-9876543210), "Int64 {:?}", order);

            let c = cfg(OpcUaDataType::UInt64, order);
            let regs = write_mapped_to_registers(&c, &MappedValue::UInt64(0x123456789ABCDEF0)).unwrap();
            let read = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read, MappedValue::UInt64(0x123456789ABCDEF0), "UInt64 {:?}", order);

            let c = cfg(OpcUaDataType::Float, order);
            let regs = write_mapped_to_registers(&c, &MappedValue::Float(42.5)).unwrap();
            let read = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read, MappedValue::Float(42.5), "Float {:?}", order);

            let c = cfg(OpcUaDataType::Double, order);
            let regs = write_mapped_to_registers(&c, &MappedValue::Double(std::f64::consts::E)).unwrap();
            let read = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read, MappedValue::Double(std::f64::consts::E), "Double {:?}", order);
        }
    }

    // -- Verify to_logical_order correctness --

    #[test]
    fn to_logical_order_big_endian_is_identity() {
        let regs = [0xAAAAu16, 0xBBBB, 0xCCCC, 0xDDDD];
        assert_eq!(ByteOrder::BigEndian.to_logical_order(&regs), regs.to_vec());
    }

    #[test]
    fn to_logical_order_little_endian_reverses() {
        let regs = [0xAAAAu16, 0xBBBB, 0xCCCC, 0xDDDD];
        assert_eq!(
            ByteOrder::LittleEndian.to_logical_order(&regs),
            vec![0xDDDD, 0xCCCC, 0xBBBB, 0xAAAA]
        );
    }

    #[test]
    fn to_logical_order_big_endian_word_swap_swaps_pairs() {
        let regs = [0xAAAAu16, 0xBBBB, 0xCCCC, 0xDDDD];
        assert_eq!(
            ByteOrder::BigEndianWordSwap.to_logical_order(&regs),
            vec![0xBBBB, 0xAAAA, 0xDDDD, 0xCCCC]
        );
    }

    #[test]
    fn to_logical_order_little_endian_word_swap() {
        let regs = [0xAAAAu16, 0xBBBB, 0xCCCC, 0xDDDD];
        assert_eq!(
            ByteOrder::LittleEndianWordSwap.to_logical_order(&regs),
            vec![0xCCCC, 0xDDDD, 0xAAAA, 0xBBBB]
        );
    }

    // -- Boolean read unaffected by byte order --

    #[test]
    fn boolean_read_unaffected_by_byte_order() {
        assert_eq!(read_bool_mapped(true), MappedValue::Boolean(true));
        assert_eq!(read_bool_mapped(false), MappedValue::Boolean(false));
    }

    // -- Word swap equivalences for 2-register types --

    #[test]
    fn word_swap_equivalences_for_two_registers() {
        let regs = [0x1234u16, 0x5678];

        let bews = ByteOrder::BigEndianWordSwap.to_logical_order(&regs);
        let le = ByteOrder::LittleEndian.to_logical_order(&regs);
        assert_eq!(bews, le);

        let lews = ByteOrder::LittleEndianWordSwap.to_logical_order(&regs);
        let be = ByteOrder::BigEndian.to_logical_order(&regs);
        assert_eq!(lews, be);
    }

    // -- 4-register types: all byte orders produce distinct results --

    #[test]
    fn four_register_all_orders_distinct() {
        let regs = [0x0001u16, 0x0002, 0x0003, 0x0004];

        let be = ByteOrder::BigEndian.to_logical_order(&regs);
        let le = ByteOrder::LittleEndian.to_logical_order(&regs);
        let bews = ByteOrder::BigEndianWordSwap.to_logical_order(&regs);
        let lews = ByteOrder::LittleEndianWordSwap.to_logical_order(&regs);

        assert_eq!(be, vec![0x0001, 0x0002, 0x0003, 0x0004]);
        assert_eq!(le, vec![0x0004, 0x0003, 0x0002, 0x0001]);
        assert_eq!(bews, vec![0x0002, 0x0001, 0x0004, 0x0003]);
        assert_eq!(lews, vec![0x0003, 0x0004, 0x0001, 0x0002]);

        let all = [&be, &le, &bews, &lews];
        for i in 0..all.len() {
            for j in (i + 1)..all.len() {
                assert_ne!(all[i], all[j]);
            }
        }
    }

    // ========================================================================
    // Sub-AC 2 of AC 4: Per-tag byte order applied when packing typed
    //   values into U16 registers during write operations
    // ========================================================================

    // --- Explicit write register layout for all byte orders (32-bit) ---

    #[test]
    fn write_int32_all_byte_orders_exact_layout() {
        // 0x12345678 → logical [0x1234, 0x5678]
        let val = MappedValue::Int32(0x12345678);

        let c = cfg(OpcUaDataType::Int32, ByteOrder::BigEndian);
        assert_eq!(write_mapped_to_registers(&c, &val).unwrap(), vec![0x1234, 0x5678]);

        let c = cfg(OpcUaDataType::Int32, ByteOrder::LittleEndian);
        assert_eq!(write_mapped_to_registers(&c, &val).unwrap(), vec![0x5678, 0x1234]);

        let c = cfg(OpcUaDataType::Int32, ByteOrder::BigEndianWordSwap);
        assert_eq!(write_mapped_to_registers(&c, &val).unwrap(), vec![0x5678, 0x1234]);

        let c = cfg(OpcUaDataType::Int32, ByteOrder::LittleEndianWordSwap);
        assert_eq!(write_mapped_to_registers(&c, &val).unwrap(), vec![0x1234, 0x5678]);
    }

    // --- Explicit write register layout for all byte orders (64-bit) ---

    #[test]
    fn write_uint64_all_byte_orders_exact_layout() {
        // 0x0001000200030004 → logical [0x0001, 0x0002, 0x0003, 0x0004]
        let val = MappedValue::UInt64(0x0001000200030004u64);

        let c = cfg(OpcUaDataType::UInt64, ByteOrder::BigEndian);
        assert_eq!(
            write_mapped_to_registers(&c, &val).unwrap(),
            vec![0x0001, 0x0002, 0x0003, 0x0004]
        );

        let c = cfg(OpcUaDataType::UInt64, ByteOrder::LittleEndian);
        assert_eq!(
            write_mapped_to_registers(&c, &val).unwrap(),
            vec![0x0004, 0x0003, 0x0002, 0x0001]
        );

        let c = cfg(OpcUaDataType::UInt64, ByteOrder::BigEndianWordSwap);
        assert_eq!(
            write_mapped_to_registers(&c, &val).unwrap(),
            vec![0x0002, 0x0001, 0x0004, 0x0003]
        );

        let c = cfg(OpcUaDataType::UInt64, ByteOrder::LittleEndianWordSwap);
        assert_eq!(
            write_mapped_to_registers(&c, &val).unwrap(),
            vec![0x0003, 0x0004, 0x0001, 0x0002]
        );
    }

    #[test]
    fn write_int64_all_byte_orders_exact_layout() {
        // -1i64 = 0xFFFFFFFFFFFFFFFF → logical [0xFFFF; 4]
        // All byte orders produce the same result for uniform words
        let val = MappedValue::Int64(-1);
        for order in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let c = cfg(OpcUaDataType::Int64, order);
            assert_eq!(
                write_mapped_to_registers(&c, &val).unwrap(),
                vec![0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF],
                "Int64(-1) should be all 0xFFFF regardless of {:?}",
                order
            );
        }

        // Non-uniform value: 0x0A0B0C0D0E0F1011
        let val2 = MappedValue::Int64(0x0A0B0C0D0E0F1011);
        let c = cfg(OpcUaDataType::Int64, ByteOrder::LittleEndianWordSwap);
        assert_eq!(
            write_mapped_to_registers(&c, &val2).unwrap(),
            vec![0x0E0F, 0x1011, 0x0A0B, 0x0C0D]
        );
    }

    // --- Explicit write register layout for Float with word-swap ---

    #[test]
    fn write_float_big_endian_word_swap() {
        // 1.0f32 = 0x3F800000 → logical [0x3F80, 0x0000]
        // BigEndianWordSwap swaps pairs → [0x0000, 0x3F80]
        let c = cfg(OpcUaDataType::Float, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(regs, vec![0x0000, 0x3F80]);
    }

    #[test]
    fn write_float_little_endian_word_swap() {
        // 1.0f32 → logical [0x3F80, 0x0000]
        // LittleEndianWordSwap for 2 regs = identity (same as BigEndian)
        let c = cfg(OpcUaDataType::Float, ByteOrder::LittleEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(regs, vec![0x3F80, 0x0000]);
    }

    // --- Explicit write register layout for Double with word-swap ---

    #[test]
    fn write_double_big_endian_word_swap() {
        // 1.0f64 = 0x3FF0000000000000 → logical [0x3FF0, 0x0000, 0x0000, 0x0000]
        // BigEndianWordSwap swaps pairs → [0x0000, 0x3FF0, 0x0000, 0x0000]
        let c = cfg(OpcUaDataType::Double, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Double(1.0)).unwrap();
        assert_eq!(regs, vec![0x0000, 0x3FF0, 0x0000, 0x0000]);
    }

    #[test]
    fn write_double_little_endian_word_swap() {
        // 1.0f64 → logical [0x3FF0, 0x0000, 0x0000, 0x0000]
        // LittleEndianWordSwap: reverse → [0x0000, 0x0000, 0x0000, 0x3FF0]
        //   then swap pairs → [0x0000, 0x0000, 0x3FF0, 0x0000]
        let c = cfg(OpcUaDataType::Double, ByteOrder::LittleEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Double(1.0)).unwrap();
        assert_eq!(regs, vec![0x0000, 0x0000, 0x3FF0, 0x0000]);
    }

    // --- from_logical_order explicit tests for 4-register values ---

    #[test]
    fn from_logical_order_big_endian_word_swap_4regs() {
        let logical = [0x0001u16, 0x0002, 0x0003, 0x0004];
        assert_eq!(
            ByteOrder::BigEndianWordSwap.from_logical_order(&logical),
            vec![0x0002, 0x0001, 0x0004, 0x0003]
        );
    }

    #[test]
    fn from_logical_order_little_endian_word_swap_4regs() {
        let logical = [0x0001u16, 0x0002, 0x0003, 0x0004];
        // from_logical_order for LEWS: reverse → [4,3,2,1], swap pairs → [3,4,1,2]
        assert_eq!(
            ByteOrder::LittleEndianWordSwap.from_logical_order(&logical),
            vec![0x0003, 0x0004, 0x0001, 0x0002]
        );
    }

    #[test]
    fn from_logical_order_round_trip_is_inverse_of_to_logical_order() {
        let address_order = [0xAAAAu16, 0xBBBB, 0xCCCC, 0xDDDD];
        for order in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let logical = order.to_logical_order(&address_order);
            let back = order.from_logical_order(&logical);
            assert_eq!(
                back, address_order.to_vec(),
                "from_logical_order should invert to_logical_order for {:?}",
                order
            );
        }
    }

    // --- Write then read round-trip for all multi-register types × all byte orders ---

    #[test]
    fn write_read_round_trip_all_types_all_byte_orders() {
        let orders = [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ];

        for order in orders {
            // Int32
            let c = cfg(OpcUaDataType::Int32, order);
            let v = MappedValue::Int32(-987654);
            let regs = write_mapped_to_registers(&c, &v).unwrap();
            assert_eq!(regs.len(), 2);
            assert_eq!(read_registers_to_mapped(&c, &regs).unwrap(), v, "Int32 {:?}", order);

            // UInt32
            let c = cfg(OpcUaDataType::UInt32, order);
            let v = MappedValue::UInt32(0xCAFEBABE);
            let regs = write_mapped_to_registers(&c, &v).unwrap();
            assert_eq!(regs.len(), 2);
            assert_eq!(read_registers_to_mapped(&c, &regs).unwrap(), v, "UInt32 {:?}", order);

            // Int64
            let c = cfg(OpcUaDataType::Int64, order);
            let v = MappedValue::Int64(i64::MIN + 42);
            let regs = write_mapped_to_registers(&c, &v).unwrap();
            assert_eq!(regs.len(), 4);
            assert_eq!(read_registers_to_mapped(&c, &regs).unwrap(), v, "Int64 {:?}", order);

            // UInt64
            let c = cfg(OpcUaDataType::UInt64, order);
            let v = MappedValue::UInt64(0xFEDCBA9876543210);
            let regs = write_mapped_to_registers(&c, &v).unwrap();
            assert_eq!(regs.len(), 4);
            assert_eq!(read_registers_to_mapped(&c, &regs).unwrap(), v, "UInt64 {:?}", order);

            // Float
            let c = cfg(OpcUaDataType::Float, order);
            let v = MappedValue::Float(-273.15);
            let regs = write_mapped_to_registers(&c, &v).unwrap();
            assert_eq!(regs.len(), 2);
            assert_eq!(read_registers_to_mapped(&c, &regs).unwrap(), v, "Float {:?}", order);

            // Double
            let c = cfg(OpcUaDataType::Double, order);
            let v = MappedValue::Double(std::f64::consts::TAU);
            let regs = write_mapped_to_registers(&c, &v).unwrap();
            assert_eq!(regs.len(), 4);
            assert_eq!(read_registers_to_mapped(&c, &regs).unwrap(), v, "Double {:?}", order);
        }
    }

    // --- Verify different byte orders produce different register layouts for writes ---

    #[test]
    fn write_different_byte_orders_produce_different_registers_4word() {
        let val = MappedValue::UInt64(0x0A0B0C0D0E0F1011);
        let orders = [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ];
        let results: Vec<Vec<u16>> = orders
            .iter()
            .map(|&o| {
                let c = cfg(OpcUaDataType::UInt64, o);
                write_mapped_to_registers(&c, &val).unwrap()
            })
            .collect();

        // All 4 byte orders should produce distinct register layouts for 4-word types
        for i in 0..results.len() {
            for j in (i + 1)..results.len() {
                assert_ne!(
                    results[i], results[j],
                    "byte orders {:?} and {:?} should produce different write layouts",
                    orders[i], orders[j]
                );
            }
        }
    }

    // ========================================================================
    // AC 5: String type supports user-specified max register count
    //        (maxStringLength field)
    // ========================================================================

    #[test]
    fn ac5_string_max_string_length_defaults_to_none() {
        let cfg = StringMappingConfig::default();
        assert_eq!(cfg.max_string_length, None);
    }

    #[test]
    fn ac5_validation_accepts_word_count_within_limit() {
        let cfg = StringMappingConfig {
            max_string_length: Some(10),
            ..Default::default()
        };
        assert!(cfg.validate(10).is_ok());
        assert!(cfg.validate(5).is_ok());
        assert!(cfg.validate(1).is_ok());
    }

    #[test]
    fn ac5_validation_rejects_word_count_exceeding_limit() {
        let cfg = StringMappingConfig {
            max_string_length: Some(4),
            ..Default::default()
        };
        let err = cfg.validate(5).unwrap_err();
        assert!(err.contains("exceeds maxStringLength"));
    }

    #[test]
    fn ac5_validation_rejects_zero_max_string_length() {
        let cfg = StringMappingConfig {
            max_string_length: Some(0),
            ..Default::default()
        };
        let err = cfg.validate(1).unwrap_err();
        assert!(err.contains("maxStringLength must be > 0"));
    }

    #[test]
    fn ac5_none_imposes_no_extra_constraint() {
        let cfg = StringMappingConfig {
            max_string_length: None,
            ..Default::default()
        };
        assert!(cfg.validate(1).is_ok());
        assert!(cfg.validate(100).is_ok());
        assert!(cfg.validate(u16::MAX).is_ok());
    }

    #[test]
    fn ac5_effective_word_count_clamped() {
        let cfg = StringMappingConfig {
            max_string_length: Some(8),
            ..Default::default()
        };
        assert_eq!(cfg.effective_word_count(4), 4);
        assert_eq!(cfg.effective_word_count(8), 8);
        assert_eq!(cfg.effective_word_count(16), 8);
    }

    #[test]
    fn ac5_effective_word_count_no_max() {
        let cfg = StringMappingConfig {
            max_string_length: None,
            ..Default::default()
        };
        assert_eq!(cfg.effective_word_count(4), 4);
        assert_eq!(cfg.effective_word_count(100), 100);
    }

    #[test]
    fn ac5_string_with_max_length_constructor() {
        let cfg = OpcUaMappingConfig::string_with_max_length(8, 16);
        assert_eq!(cfg.opcua_data_type, OpcUaDataType::String);
        assert_eq!(cfg.word_count, 8);
        let sc = cfg.string_config.as_ref().unwrap();
        assert_eq!(sc.max_string_length, Some(16));
        assert!(cfg.validate().is_ok());
    }

    #[test]
    fn ac5_opcua_mapping_validate_delegates_to_string_config() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::String,
            word_count: 20,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: Some(StringMappingConfig {
                max_string_length: Some(10),
                ..Default::default()
            }),
            scaling: ScalingConfig::default(),
        };
        let err = cfg.validate().unwrap_err();
        assert!(err.contains("exceeds maxStringLength"));
    }

    #[test]
    fn ac5_serde_camel_case_field_names() {
        let cfg = OpcUaMappingConfig::string_with_max_length(4, 8);
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"stringConfig\""));
        assert!(json.contains("\"maxStringLength\""));
    }

    #[test]
    fn ac5_serde_round_trip_with_max_string_length() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::String,
            word_count: 10,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadWrite,
            description: Some("Device name".to_string()),
            string_config: Some(StringMappingConfig {
                encoding: StringEncoding::Ascii,
                max_byte_length: Some(16),
                null_terminated: true,
                max_string_length: Some(10),
            }),
            scaling: ScalingConfig::default(),
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let de: OpcUaMappingConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(cfg, de);
    }

    #[test]
    fn ac5_string_config_none_omitted() {
        let cfg = OpcUaMappingConfig::default_for_word();
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(!json.contains("stringConfig"));
    }

    #[test]
    fn ac5_max_string_length_none_omitted() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::String,
            word_count: 4,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: Some(StringMappingConfig::default()),
            scaling: ScalingConfig::default(),
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(!json.contains("maxStringLength"));
    }

    #[test]
    fn ac5_read_string_with_max_string_length() {
        let cfg = OpcUaMappingConfig::string_with_max_length(4, 4);
        let regs = [0x4865u16, 0x6C6C, 0x6F00, 0x0000];
        let result = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(result, MappedValue::String("Hello".to_string()));
    }

    #[test]
    fn ac5_write_string_with_max_string_length() {
        let cfg = OpcUaMappingConfig::string_with_max_length(4, 8);
        let value = MappedValue::String("Hi".to_string());
        let regs = write_mapped_to_registers(&cfg, &value).unwrap();
        assert_eq!(regs.len(), 4);
        assert_eq!(regs[0], 0x4869);
        assert_eq!(regs[1], 0x0000);
    }

    #[test]
    fn ac5_string_round_trip_with_max_string_length() {
        let cfg = OpcUaMappingConfig::string_with_max_length(8, 16);
        let original = "Test123";
        let value = MappedValue::String(original.to_string());
        let regs = write_mapped_to_registers(&cfg, &value).unwrap();
        assert_eq!(regs.len(), 8);
        let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(read_back, MappedValue::String(original.to_string()));
    }

    #[test]
    fn ac5_string_insufficient_registers_rejected() {
        let cfg = OpcUaMappingConfig::string_with_max_length(4, 4);
        let regs = [0x4100u16, 0x0000];
        let err = read_registers_to_mapped(&cfg, &regs).unwrap_err();
        match err {
            MappingError::InsufficientRegisters { expected, actual } => {
                assert_eq!(expected, 4);
                assert_eq!(actual, 2);
            }
            _ => panic!("unexpected error: {:?}", err),
        }
    }

    #[test]
    fn ac5_string_write_type_mismatch() {
        let cfg = OpcUaMappingConfig::string_with_max_length(4, 4);
        let value = MappedValue::UInt16(42);
        let err = write_mapped_to_registers(&cfg, &value).unwrap_err();
        match err {
            MappingError::TypeMismatch { type_name, .. } => {
                assert_eq!(type_name, "String");
            }
            _ => panic!("unexpected error: {:?}", err),
        }
    }

    #[test]
    fn ac5_string_utf16_with_max_string_length() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::String,
            word_count: 4,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadWrite,
            description: None,
            string_config: Some(StringMappingConfig {
                encoding: StringEncoding::Utf16,
                max_string_length: Some(4),
                null_terminated: true,
                max_byte_length: None,
            }),
            scaling: ScalingConfig::default(),
        };
        assert!(cfg.validate().is_ok());

        let value = MappedValue::String("Hi".to_string());
        let regs = write_mapped_to_registers(&cfg, &value).unwrap();
        assert_eq!(regs[0], 0x0048);
        assert_eq!(regs[1], 0x0069);

        let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(read_back, MappedValue::String("Hi".to_string()));
    }

    #[test]
    fn ac5_both_max_byte_and_max_string_length() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::String,
            word_count: 8,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: Some(StringMappingConfig {
                encoding: StringEncoding::Utf8,
                max_byte_length: Some(10),
                null_terminated: true,
                max_string_length: Some(8),
            }),
            scaling: ScalingConfig::default(),
        };
        assert!(cfg.validate().is_ok());
    }

    #[test]
    fn ac5_string_no_config_defaults_work() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::String,
            word_count: 2,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
            scaling: ScalingConfig::default(),
        };
        assert!(cfg.validate().is_ok());

        let regs = [0x4142u16, 0x0000];
        let result = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(result, MappedValue::String("AB".to_string()));
    }
