// 정수형(8/16/32/64bit) 및 바이트 순서 read/write 변환 테스트
use crate::mapping::*;


    fn make_int_config(dt: OpcUaDataType, bo: ByteOrder) -> OpcUaMappingConfig {
        OpcUaMappingConfig {
            opcua_data_type: dt,
            word_count: dt.default_word_count(),
            byte_order: bo,
            access_level: MappingAccessLevel::ReadWrite,
            description: None,
            string_config: None,
            scaling: ScalingConfig::default(),
        }
    }

    // --- Byte order helpers ---

    #[test]
    fn byte_order_big_endian_identity() {
        let regs = [0x1234u16, 0x5678];
        assert_eq!(
            ByteOrder::BigEndian.to_logical_order(&regs),
            vec![0x1234, 0x5678]
        );
        assert_eq!(
            ByteOrder::BigEndian.from_logical_order(&regs),
            vec![0x1234, 0x5678]
        );
    }

    #[test]
    fn byte_order_little_endian_reverses() {
        let regs = [0xAAAAu16, 0xBBBB];
        assert_eq!(
            ByteOrder::LittleEndian.to_logical_order(&regs),
            vec![0xBBBB, 0xAAAA]
        );
        assert_eq!(
            ByteOrder::LittleEndian.from_logical_order(&[0xBBBB, 0xAAAA]),
            vec![0xAAAA, 0xBBBB]
        );
    }

    #[test]
    fn byte_order_big_endian_word_swap_2regs() {
        let regs = [0x0001u16, 0x0002];
        assert_eq!(
            ByteOrder::BigEndianWordSwap.to_logical_order(&regs),
            vec![0x0002, 0x0001]
        );
    }

    #[test]
    fn byte_order_little_endian_word_swap_4regs() {
        let regs = [0x0001u16, 0x0002, 0x0003, 0x0004];
        let logical = ByteOrder::LittleEndianWordSwap.to_logical_order(&regs);
        // 기본 규약(LITTLE_ENDIAN_WORD_SWAP_FULL_REVERSE=false): 워드쌍 스왑 후 반전.
        // (이전 기대값 [4,3,2,1]은 평범한 LittleEndian과 동일해 워드스왑이 무의미
        //  해지는 복붙 오류였다. 규약을 바꾸려면 위 플래그를 토글한다.)
        assert_eq!(logical, vec![0x0003, 0x0004, 0x0001, 0x0002]);
    }

    #[test]
    fn byte_order_round_trip_all_orders() {
        let regs = [0x1111u16, 0x2222, 0x3333, 0x4444];
        for order in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let logical = order.to_logical_order(&regs);
            let back = order.from_logical_order(&logical);
            assert_eq!(back, regs.to_vec(), "round-trip failed for {:?}", order);
        }
    }

    // --- 8-bit read/write ---

    #[test]
    fn read_byte_from_register() {
        let cfg = make_int_config(OpcUaDataType::Byte, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x00AB]).unwrap();
        assert_eq!(result, MappedValue::Byte(0xAB));
    }

    #[test]
    fn read_byte_ignores_high_byte() {
        let cfg = make_int_config(OpcUaDataType::Byte, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0xFF42]).unwrap();
        assert_eq!(result, MappedValue::Byte(0x42));
    }

    #[test]
    fn read_sbyte_positive() {
        let cfg = make_int_config(OpcUaDataType::SByte, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x007F]).unwrap();
        assert_eq!(result, MappedValue::SByte(127));
    }

    #[test]
    fn read_sbyte_negative() {
        let cfg = make_int_config(OpcUaDataType::SByte, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x0080]).unwrap();
        assert_eq!(result, MappedValue::SByte(-128));
    }

    #[test]
    fn read_sbyte_minus_one() {
        let cfg = make_int_config(OpcUaDataType::SByte, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x00FF]).unwrap();
        assert_eq!(result, MappedValue::SByte(-1));
    }

    #[test]
    fn write_byte_to_register() {
        let cfg = make_int_config(OpcUaDataType::Byte, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::Byte(0xAB)).unwrap();
        assert_eq!(regs, vec![0x00AB]);
    }

    #[test]
    fn write_sbyte_negative_to_register() {
        let cfg = make_int_config(OpcUaDataType::SByte, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::SByte(-1)).unwrap();
        assert_eq!(regs, vec![0x00FF]);
    }

    #[test]
    fn sbyte_round_trip() {
        let cfg = make_int_config(OpcUaDataType::SByte, ByteOrder::BigEndian);
        for val in [-128i8, -1, 0, 1, 127] {
            let regs = write_mapped_to_registers(&cfg, &MappedValue::SByte(val)).unwrap();
            let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(read_back, MappedValue::SByte(val));
        }
    }

    // --- 16-bit read/write ---

    #[test]
    fn read_uint16_passthrough() {
        let cfg = make_int_config(OpcUaDataType::UInt16, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0xBEEF]).unwrap();
        assert_eq!(result, MappedValue::UInt16(0xBEEF));
    }

    #[test]
    fn read_int16_positive() {
        let cfg = make_int_config(OpcUaDataType::Int16, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x7FFF]).unwrap();
        assert_eq!(result, MappedValue::Int16(32767));
    }

    #[test]
    fn read_int16_negative() {
        let cfg = make_int_config(OpcUaDataType::Int16, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0xFFFF]).unwrap();
        assert_eq!(result, MappedValue::Int16(-1));
    }

    #[test]
    fn read_int16_min() {
        let cfg = make_int_config(OpcUaDataType::Int16, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x8000]).unwrap();
        assert_eq!(result, MappedValue::Int16(-32768));
    }

    #[test]
    fn write_int16_negative() {
        let cfg = make_int_config(OpcUaDataType::Int16, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::Int16(-1)).unwrap();
        assert_eq!(regs, vec![0xFFFF]);
    }

    #[test]
    fn int16_round_trip() {
        let cfg = make_int_config(OpcUaDataType::Int16, ByteOrder::BigEndian);
        for val in [i16::MIN, -1, 0, 1, i16::MAX] {
            let regs = write_mapped_to_registers(&cfg, &MappedValue::Int16(val)).unwrap();
            let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(read_back, MappedValue::Int16(val));
        }
    }

    // --- 32-bit read/write ---

    #[test]
    fn read_uint32_big_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt32, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x0001, 0x0002]).unwrap();
        assert_eq!(result, MappedValue::UInt32(0x00010002));
    }

    #[test]
    fn read_uint32_little_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt32, ByteOrder::LittleEndian);
        let result = read_registers_to_mapped(&cfg, &[0x0002, 0x0001]).unwrap();
        assert_eq!(result, MappedValue::UInt32(0x00010002));
    }

    #[test]
    fn read_int32_negative_big_endian() {
        let cfg = make_int_config(OpcUaDataType::Int32, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0xFFFF, 0xFFFF]).unwrap();
        assert_eq!(result, MappedValue::Int32(-1));
    }

    #[test]
    fn read_int32_min_value() {
        let cfg = make_int_config(OpcUaDataType::Int32, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x8000, 0x0000]).unwrap();
        assert_eq!(result, MappedValue::Int32(i32::MIN));
    }

    #[test]
    fn write_uint32_big_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt32, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::UInt32(0x12345678)).unwrap();
        assert_eq!(regs, vec![0x1234, 0x5678]);
    }

    #[test]
    fn write_uint32_little_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt32, ByteOrder::LittleEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::UInt32(0x12345678)).unwrap();
        assert_eq!(regs, vec![0x5678, 0x1234]);
    }

    #[test]
    fn uint32_round_trip_all_byte_orders() {
        let value = 0xDEADBEEFu32;
        for order in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let cfg = make_int_config(OpcUaDataType::UInt32, order);
            let regs = write_mapped_to_registers(&cfg, &MappedValue::UInt32(value)).unwrap();
            let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(
                read_back,
                MappedValue::UInt32(value),
                "failed for {:?}",
                order
            );
        }
    }

    #[test]
    fn int32_round_trip_all_byte_orders() {
        for val in [i32::MIN, -1, 0, 1, i32::MAX] {
            for order in [
                ByteOrder::BigEndian,
                ByteOrder::LittleEndian,
                ByteOrder::BigEndianWordSwap,
                ByteOrder::LittleEndianWordSwap,
            ] {
                let cfg = make_int_config(OpcUaDataType::Int32, order);
                let regs = write_mapped_to_registers(&cfg, &MappedValue::Int32(val)).unwrap();
                let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
                assert_eq!(read_back, MappedValue::Int32(val));
            }
        }
    }

    // --- 64-bit read/write ---

    #[test]
    fn read_uint64_big_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt64, ByteOrder::BigEndian);
        let result =
            read_registers_to_mapped(&cfg, &[0x0001, 0x0002, 0x0003, 0x0004]).unwrap();
        assert_eq!(result, MappedValue::UInt64(0x0001000200030004u64));
    }

    #[test]
    fn read_uint64_little_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt64, ByteOrder::LittleEndian);
        let result =
            read_registers_to_mapped(&cfg, &[0x0004, 0x0003, 0x0002, 0x0001]).unwrap();
        assert_eq!(result, MappedValue::UInt64(0x0001000200030004u64));
    }

    #[test]
    fn read_int64_negative() {
        let cfg = make_int_config(OpcUaDataType::Int64, ByteOrder::BigEndian);
        let result =
            read_registers_to_mapped(&cfg, &[0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF]).unwrap();
        assert_eq!(result, MappedValue::Int64(-1));
    }

    #[test]
    fn read_int64_min_value() {
        let cfg = make_int_config(OpcUaDataType::Int64, ByteOrder::BigEndian);
        let result =
            read_registers_to_mapped(&cfg, &[0x8000, 0x0000, 0x0000, 0x0000]).unwrap();
        assert_eq!(result, MappedValue::Int64(i64::MIN));
    }

    #[test]
    fn write_uint64_big_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt64, ByteOrder::BigEndian);
        let regs =
            write_mapped_to_registers(&cfg, &MappedValue::UInt64(0x0001000200030004)).unwrap();
        assert_eq!(regs, vec![0x0001, 0x0002, 0x0003, 0x0004]);
    }

    #[test]
    fn write_int64_negative() {
        let cfg = make_int_config(OpcUaDataType::Int64, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::Int64(-1)).unwrap();
        assert_eq!(regs, vec![0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF]);
    }

    #[test]
    fn uint64_round_trip_all_byte_orders() {
        let value = 0x123456789ABCDEF0u64;
        for order in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let cfg = make_int_config(OpcUaDataType::UInt64, order);
            let regs = write_mapped_to_registers(&cfg, &MappedValue::UInt64(value)).unwrap();
            let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(
                read_back,
                MappedValue::UInt64(value),
                "failed for {:?}",
                order
            );
        }
    }

    #[test]
    fn int64_round_trip_all_byte_orders() {
        for val in [i64::MIN, -1, 0, 1, i64::MAX] {
            for order in [
                ByteOrder::BigEndian,
                ByteOrder::LittleEndian,
                ByteOrder::BigEndianWordSwap,
                ByteOrder::LittleEndianWordSwap,
            ] {
                let cfg = make_int_config(OpcUaDataType::Int64, order);
                let regs = write_mapped_to_registers(&cfg, &MappedValue::Int64(val)).unwrap();
                let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
                assert_eq!(read_back, MappedValue::Int64(val));
            }
        }
    }

    // --- Error cases ---

    #[test]
    fn read_boolean_type_returns_error() {
        let cfg = make_int_config(OpcUaDataType::Boolean, ByteOrder::BigEndian);
        let err = read_registers_to_mapped(&cfg, &[0x0001]).unwrap_err();
        assert_eq!(err, MappingError::BooleanTypeMismatch);
    }

    #[test]
    fn read_insufficient_registers_32bit() {
        let cfg = make_int_config(OpcUaDataType::Int32, ByteOrder::BigEndian);
        let err = read_registers_to_mapped(&cfg, &[0x0001]).unwrap_err();
        assert_eq!(
            err,
            MappingError::InsufficientRegisters {
                expected: 2,
                actual: 1,
            }
        );
    }

    #[test]
    fn read_insufficient_registers_64bit() {
        let cfg = make_int_config(OpcUaDataType::UInt64, ByteOrder::BigEndian);
        let err = read_registers_to_mapped(&cfg, &[0x0001, 0x0002]).unwrap_err();
        assert_eq!(
            err,
            MappingError::InsufficientRegisters {
                expected: 4,
                actual: 2,
            }
        );
    }

    #[test]
    fn write_type_mismatch_returns_error() {
        let cfg = make_int_config(OpcUaDataType::Int32, ByteOrder::BigEndian);
        let err = write_mapped_to_registers(&cfg, &MappedValue::UInt16(42)).unwrap_err();
        match err {
            MappingError::TypeMismatch { type_name, .. } => {
                assert_eq!(type_name, "Int32");
            }
            other => panic!("expected TypeMismatch, got {:?}", other),
        }
    }

    #[test]
    fn write_boolean_type_returns_error() {
        let cfg = make_int_config(OpcUaDataType::Boolean, ByteOrder::BigEndian);
        let err = write_mapped_to_registers(&cfg, &MappedValue::Boolean(true)).unwrap_err();
        assert_eq!(err, MappingError::BooleanTypeMismatch);
    }

    // --- Bool convenience functions ---

    #[test]
    fn read_bool_mapped_values() {
        assert_eq!(read_bool_mapped(true), MappedValue::Boolean(true));
        assert_eq!(read_bool_mapped(false), MappedValue::Boolean(false));
    }

    #[test]
    fn write_bool_mapped_ok() {
        assert!(write_bool_mapped(&MappedValue::Boolean(true)).unwrap());
        assert!(!write_bool_mapped(&MappedValue::Boolean(false)).unwrap());
    }

    #[test]
    fn write_bool_mapped_type_mismatch() {
        let err = write_bool_mapped(&MappedValue::UInt16(42)).unwrap_err();
        assert_eq!(err, MappingError::BooleanTypeMismatch);
    }

    // --- Extra registers are ignored ---

    #[test]
    fn read_extra_registers_ignored() {
        let cfg = make_int_config(OpcUaDataType::UInt16, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x1234, 0x5678, 0x9ABC]).unwrap();
        assert_eq!(result, MappedValue::UInt16(0x1234));
    }

    // --- BigEndianWordSwap specific 32-bit test ---

    #[test]
    fn read_uint32_big_endian_word_swap() {
        let cfg = make_int_config(OpcUaDataType::UInt32, ByteOrder::BigEndianWordSwap);
        let result = read_registers_to_mapped(&cfg, &[0x5678, 0x1234]).unwrap();
        assert_eq!(result, MappedValue::UInt32(0x12345678));
    }

    #[test]
    fn write_uint32_big_endian_word_swap() {
        let cfg = make_int_config(OpcUaDataType::UInt32, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::UInt32(0x12345678)).unwrap();
        assert_eq!(regs, vec![0x5678, 0x1234]);
    }

    // --- MappingError Display ---

    #[test]
    fn mapping_error_display_messages() {
        let e = MappingError::InsufficientRegisters {
            expected: 4,
            actual: 2,
        };
        assert_eq!(e.to_string(), "need 4 registers but got 2");

        let e = MappingError::BooleanTypeMismatch;
        assert!(e.to_string().contains("Boolean"));

        let e = MappingError::UnsupportedType(OpcUaDataType::Float);
        assert!(e.to_string().contains("Float"));
    }

    // --- Float/Double now supported (previously unsupported, updated for AC 2/3) ---

    #[test]
    fn read_float_supported() {
        let cfg = make_int_config(OpcUaDataType::Float, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x3F80, 0x0000]).unwrap();
        assert_eq!(result, MappedValue::Float(1.0));
    }

    #[test]
    fn read_double_supported() {
        let cfg = make_int_config(OpcUaDataType::Double, ByteOrder::BigEndian);
        // 1.0f64 = 0x3FF0_0000_0000_0000
        let result = read_registers_to_mapped(&cfg, &[0x3FF0, 0x0000, 0x0000, 0x0000]).unwrap();
        assert_eq!(result, MappedValue::Double(1.0));
    }
