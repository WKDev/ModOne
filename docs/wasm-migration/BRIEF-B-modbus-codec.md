<!-- 워크트리 B(modbus-codec) 담당 세션용 작업 브리프 -->
# 워크트리 B 브리프 — modbus-codec

**브랜치**: `feat/wasm-modbus` · **위치**: `../ModOne-modbus`
**먼저 읽기**: [`00-CONTRACT.md`](./00-CONTRACT.md), [`01-WORKTREES.md`](./01-WORKTREES.md)

## 너의 목표
1. `crates/modbus-codec` 크레이트 생성. `modone-contract`에만 의존.
2. Modbus 매핑 정책 타입을 `src-tauri/src/plc_runtime/profile.rs`에서 이전.
   - 이전 대상: `ModbusAddressSpace`, `ModbusMappingPolicy`, `ModbusMappingRule`,
     `ModbusMappingSource` (+ 필요한 보조 타입). 단 `VendorProfileId` 등 vendor/
     project 의존 타입은 src-tauri에 잔류 — 정책 구조체가 그걸 참조하면 제네릭/
     ID 분리로 결합을 끊어라.
   - `src-tauri/src/plc_runtime/profile.rs`의 `resolve_modbus_mapping_policy`는
     잔류하고 `modbus-codec`의 정책 타입을 import.
3. PDU 인코딩/디코딩 + `ModbusAdapter`(canonical↔modbus 동기화) +
   `window_intersects_rule`(현재 `src-tauri/src/modbus/adapter.rs`의 modbus 전용
   자유함수)를 `modbus-codec`로 이전.
4. **소켓 제외** — `TcpListener`/`tokio-serial`은 `src-tauri/src/modbus`에 native
   전송 셸로 잔류하고 codec 크레이트를 호출하도록 재배선.

## 현재 상태 (Phase 0에서 이미 됨)
- `ProtocolAdapter` trait, `DirtyPublishWindow`는 `modone-contract`에 있음.
  `src-tauri/src/modbus/adapter.rs`가 이를 재노출 중. `ModbusAdapter`는
  `impl ProtocolAdapter` 그대로.

## 검증 게이트 (머지 전)
- `cargo check --workspace` green
- `cargo check -p modbus-codec --target wasm32-unknown-unknown` green
- 기존 modbus adapter 테스트(`src-tauri/src/modbus/adapter.rs`의 #[test]들) 통과

## 주의
- 계약(`modone-contract`)은 소비만. 변경 금지(필요 시 A·C와 합의 PR).
- `checklist.md` / `context-notes.md` 생성 후 진행 (전역 규칙).
