//! vendor-neutral PLC 모델 — 제조사별 PLC를 canonical 주소/메모리로 변환하는 추상화
//!
//! LS·Mitsubishi·(추후 Siemens 등) PLC를 하나의 vendor-neutral 모델로 다룬다.
//! `modone-contract`의 canonical 타입에만 의존하고 `project`/`tauri`/소켓은 모른다.
//! sim-engine·modbus-codec·opcua-codec 가 공유한다. 설계는
//! docs/wasm-migration/02-PLC-MODEL.md 참조.

pub mod hardware;
pub mod profile;
pub mod profiles;

pub use hardware::{
    PlcAddressWindow, PlcHardwareModule, PlcHardwareTopology, PlcIoDirection, PlcManufacturer,
    PlcModuleKind, PlcRackKind, PlcRackTopology, PlcSettings,
};
pub use profile::{
    resolve_vendor_profile, ModbusAddressSpace, ModbusMappingPolicy, ModbusMappingRule,
    ModbusMappingSource, OpcUaAliasPolicy, VendorAddress, VendorAddressMetadata,
    VendorAddressNumberBase, VendorDataKind, VendorProfile, VendorProfileError, VendorProfileId,
};
pub use profiles::{LsProfile, MelsecFxQProfile};
