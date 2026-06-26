<!-- 워크트리 B(modbus-codec) 추출 작업 체크리스트 -->
# 워크트리 B — modbus-codec 체크리스트

## 1. 크레이트 스캐폴드
- [x] `crates/modbus-codec` 생성 (Cargo.toml: modone-contract + bitvec/parking_lot/serde/serde_json/thiserror)
- [x] 루트 Cargo.toml 멤버는 `crates/*` 글롭으로 이미 포함됨 → 확인 완료
- [x] src-tauri Cargo.toml에 `modbus-codec = { path = ... }` 추가

## 2. 코드 이전 (codec로)
- [x] 정책 타입 이전: `ModbusAddressSpace`, `ModbusMappingRule`, `ModbusMappingPolicy`,
      `ModbusMappingSource` (profile.rs → modbus-codec/policy.rs)
      - `profile_id: VendorProfileId` → `profile_id: String` (결합 끊기)
- [x] 메모리 타입 이전: `MemoryError`, `MemoryMapSettings`, `MemoryType`, `ChangeSource`,
      `MemoryChangeEvent`, `MemoryBatchChangeEvent` (types.rs → modbus-codec/types.rs)
- [x] `ModbusMemory` 이전 (memory.rs → modbus-codec/memory.rs)
      - `tauri::AppHandle` → `MemoryEventSink` trait 추상화
- [x] `pdu.rs` 이전 (그대로)
- [x] `ModbusAdapter` + `window_intersects_rule` + `ModbusAdapterError` 이전 (adapter.rs)
- [x] codec lib.rs에서 공개 표면 재노출

## 3. native 셸 재배선 (src-tauri 잔류)
- [x] `modbus/types.rs` 슬림화: 전송 타입(ModbusError, TcpConfig, ConnectionInfo,
      ConnectionEvent) 잔류 + codec 타입 재노출 (경로 호환)
- [x] `modbus/tauri_sink.rs` 신규: `TauriEventSink` (MemoryEventSink 구현)
- [x] `modbus/memory.rs`, `pdu.rs`, `adapter.rs` 삭제
- [x] `modbus/mod.rs` 재노출 codec 기준으로 갱신
- [x] `tcp.rs`/`rtu.rs`: `super::memory` → `super::ModbusMemory` (pdu는 재노출 유지)
- [x] `profile.rs`: 정책 타입 import를 modbus-codec로, profile_id String화
- [x] `commands/modbus.rs`: `set_app_handle` → `set_event_sink(TauriEventSink)` (3곳)
- [x] 기타 import 사이트 갱신 (executor.rs)

## 4. 검증 게이트
- [x] `cargo check -p modbus-codec --target wasm32-unknown-unknown` green
- [x] `cargo test -p modbus-codec` 통과 (27/27)
- [x] `cargo check --workspace` green (9m 18s, exit 0)
- [x] 커밋
