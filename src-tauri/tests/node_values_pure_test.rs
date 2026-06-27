// node_values 순수 변환(레지스터↔MappedValue, 멀티레지스터 분해, dirty 판정) 검증.
// opcua-server feature(=openssl)가 필요 없는 순수 경로만 다루므로 --no-default-features로 실행된다.

use app_lib::modbus::DirtyPublishWindow;
use app_lib::opcua::node_values::{mapped_to_register_writes, node_dirty, read_node_mapped};
use app_lib::opcua::{ByteOrder, MappedValue, OpcUaDataType, OpcUaMappingConfig};
use app_lib::plc_runtime::{
    CanonicalAddress, CanonicalAreaKind, CanonicalMemory, CanonicalValue, CanonicalWriteSource,
};

fn int32_be_config() -> OpcUaMappingConfig {
    OpcUaMappingConfig {
        opcua_data_type: OpcUaDataType::Int32,
        word_count: 2,
        byte_order: ByteOrder::BigEndian,
        ..Default::default()
    }
}

#[test]
fn reads_int32_across_two_registers() {
    let mut mem = CanonicalMemory::new();
    let base = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
    // 0x0001_0002 = 65538, big-endian: high word at base, low word at base+1.
    mem.write(base, CanonicalValue::U16(0x0001), CanonicalWriteSource::Simulation)
        .unwrap();
    mem.write(
        CanonicalAddress::new(CanonicalAreaKind::DataWord, 101),
        CanonicalValue::U16(0x0002),
        CanonicalWriteSource::Simulation,
    )
    .unwrap();

    let mapped = read_node_mapped(&mem, base, &int32_be_config()).expect("read should succeed");
    assert_eq!(mapped, MappedValue::Int32(65538));
}

#[test]
fn decomposes_int32_write_into_two_registers() {
    let base = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
    let writes = mapped_to_register_writes(&MappedValue::Int32(65538), base, &int32_be_config())
        .expect("decompose should succeed");

    assert_eq!(
        writes,
        vec![
            (
                CanonicalAddress::new(CanonicalAreaKind::DataWord, 100),
                CanonicalValue::U16(0x0001)
            ),
            (
                CanonicalAddress::new(CanonicalAreaKind::DataWord, 101),
                CanonicalValue::U16(0x0002)
            ),
        ]
    );
}

#[test]
fn int32_write_then_read_round_trips() {
    let mut mem = CanonicalMemory::new();
    let base = CanonicalAddress::new(CanonicalAreaKind::DataWord, 10);
    let cfg = int32_be_config();

    for (addr, value) in
        mapped_to_register_writes(&MappedValue::Int32(-12345), base, &cfg).unwrap()
    {
        mem.write(addr, value, CanonicalWriteSource::Simulation).unwrap();
    }

    assert_eq!(read_node_mapped(&mem, base, &cfg).unwrap(), MappedValue::Int32(-12345));
}

#[test]
fn boolean_node_reads_bit() {
    let mut mem = CanonicalMemory::new();
    let base = CanonicalAddress::new(CanonicalAreaKind::InternalBit, 1);
    mem.write(base, CanonicalValue::Bool(true), CanonicalWriteSource::Simulation)
        .unwrap();

    let cfg = OpcUaMappingConfig::default_for_address(base);
    assert_eq!(read_node_mapped(&mem, base, &cfg).unwrap(), MappedValue::Boolean(true));
}

#[test]
fn node_dirty_covers_full_register_span() {
    let base = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
    let cfg = int32_be_config(); // span = [100, 101]

    let dirty = |start, end| {
        node_dirty(
            base,
            &cfg,
            &[DirtyPublishWindow {
                area: CanonicalAreaKind::DataWord,
                start_index: start,
                end_index: end,
            }],
        )
    };

    assert!(dirty(100, 100), "base register dirty");
    assert!(dirty(101, 101), "second register of the span dirty");
    assert!(dirty(95, 105), "window spanning the node");
    assert!(!dirty(99, 99), "register just before the span");
    assert!(!dirty(102, 103), "registers just after the span");

    // A window in a different area must not mark the node dirty.
    assert!(!node_dirty(
        base,
        &cfg,
        &[DirtyPublishWindow {
            area: CanonicalAreaKind::InternalBit,
            start_index: 100,
            end_index: 101,
        }]
    ));
}
