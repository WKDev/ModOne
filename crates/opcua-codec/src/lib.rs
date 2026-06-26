//! opcua-codec — OPC UA 코덱·주소공간 스펙·어댑터의 순수(wasm 호환) 코어
//!
//! 전송/소켓/TLS/opcua-crate/project 에 의존하지 않는다. canonical 모델은
//! `modone-contract`에서 가져온다. 실제 OPC UA 서빙(소켓/세션/세보안)은 native
//! 셸(src-tauri)이 `OpcUaServerBackend` trait를 구현해 제공한다.
//! 계약: docs/wasm-migration/00-CONTRACT.md §1,§4.

pub mod adapter;
pub mod address_space_spec;
pub mod backend;
pub mod dirty_tracker;
pub mod error;
pub mod mapping;
pub mod memory;

pub use adapter::OpcUaAdapter;
pub use backend::OpcUaServerBackend;
pub use error::OpcUaError;
