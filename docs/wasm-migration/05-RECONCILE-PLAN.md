<!-- feat/wasm-sim-core(A)를 B/C 병합 후의 main에 통합하는 reconciliation 계획 -->
# Reconciliation 계획 — feat/wasm-sim-core → main (B/C 병합 후)

> **트리거**: C(opcua) 병합으로 main이 안정된 뒤 **한 번에** 실행. (사용자 결정
> 2026-06-27: C 완료 대기 후 reconcile.) 그 전까지 이 브랜치는 green 자기완결로 보존.

## 현 상태 (2026-06-27)
- **A(이 브랜치)**: Phase 1~4 완료 + wasm 루프백 데모 PASS. 자기완결 green.
- **main**(`cb56a67`+): B(modbus-codec) 병합 완료, C(opcua-codec) 상당부 병합 +
  진행 중. 계약 §3 주입 이미 main에 `clock.rs`로 존재.
- **base**: 셋 다 `fce037b`에서 분기.

## 충돌 면 (A ↔ main)

| 영역 | main (B/C) | A (이 브랜치) | 해소 |
|---|---|---|---|
| 시간/ID 주입 | `contract/clock.rs` — `std-clock` feature + `set_clock`/`set_id_source` 콜백 주입 | `contract/runtime_env.rs` — cfg(target_arch) 분기 | **main의 clock.rs 채택**, runtime_env 폐기, 호출부 교체 |
| Modbus 정책 타입 | `modbus-codec/policy.rs`가 소유 (ModbusAddressSpace/MappingRule/MappingPolicy/MappingSource) | `plc-model`이 정의(profile.rs에서 이동) | plc-model이 **modbus-codec에서 import** (중복 정의 제거) |
| `VendorProfile` 트레이트 | src-tauri `plc_runtime/profile.rs` 잔류, `modbus_codec` 타입 import | `plc-model`로 이동 | **plc-model로 재추출** (sim-engine이 src-tauri 의존 불가하므로 필수) |
| `profile.rs`/`profiles/*` | src-tauri에서 수정(B가 modbus_codec import) | src-tauri에서 삭제+plc-model 이동 | main 수정본 기준으로 plc-model 재추출(내 Phase 1 재적용) |
| src-tauri `Cargo.toml` | modbus/opcua-codec 의존 추가 | plc-model/sim-engine 의존 추가 | 양쪽 합치기 |
| `plc_runtime/mod.rs` | (B 미변경 추정) | 재노출로 재작성 | A 버전 + main 변경 합치기 |
| sim/* | (A 도메인, B/C 미변경 추정) | sim-engine 추출 | A 그대로 적용 |

## 목표 위상 (무순환, B/C 크레이트 무수정)
```
contract ← {modbus-codec, opcua-codec} ← plc-model ← sim-engine ← sim-wasm
                                              ↑
                                          src-tauri (조립)
```
- `plc-model`이 `modbus-codec`/`opcua-codec`을 import해 VendorProfile의 정책 메서드
  (recommended_modbus_mapping_policy 등) 반환 타입을 가져온다.
- **이러면 Phase 5(트레이트 분할)는 지금 불필요** — 정책 메서드를 트레이트에 둔 채
  codec 타입만 import. (장기적으로 깔끔한 분할을 원하면 후속 작업으로.)

## main 구조 사실 (참고)
- `contract/clock.rs`: `now_rfc3339()`, `new_batch_id()`. `std-clock` feature on=chrono/uuid,
  off=주입된 콜백(`set_clock`/`set_id_source`, 기본 폴백). → 내 `now_rfc3339/now_millis/
  new_id` 호출부를 clock.rs API로 매핑. (now_millis는 main에 없으면 추가 필요.)
- `modbus-codec`: policy.rs(정책 타입), types.rs, pdu.rs, adapter.rs, memory.rs.
- `opcua-codec`: mapping.rs(대형), adapter.rs, backend.rs, dirty_tracker.rs 등. (C 진행 중 — 확정 전.)
- main `profile.rs`(src-tauri): `pub use modbus_codec::{Modbus*}`, VendorProfile에 정책
  메서드 잔류, `resolve_modbus_mapping_policy` 존재.

## reconcile 절차 (C 안정 후)
1. main 최신 fetch. `git rebase main` (또는 merge) — 충돌 다수 예상.
2. **contract**: main의 clock.rs 채택. 내 runtime_env.rs 삭제. sim-engine/contract
   호출부를 clock API로. (Instant→StopWatch 변경은 충돌 없을 것 — 보존.)
3. **plc-model**: main의 수정된 profile.rs/profiles를 기준으로 plc-model 재구성.
   Modbus 정책 타입은 modbus-codec에서 import(내 plc-model 내 정의 삭제). plc-model
   Cargo.toml에 modbus-codec/opcua-codec 의존 추가. OpcUaAliasPolicy도 opcua-codec에서.
4. **sim-engine/sim-wasm**: 거의 그대로. plc-model API 경로만 점검.
5. **P→OutputBit 변경**: 내 ls.rs 변경이 main의 ls.rs 수정(B의 4줄)과 충돌 가능 →
   수동 병합. P 영역 도메인 결정은 유지하되 B의 Modbus 노출 정책과 정합성 재확인.
6. 검증 게이트 전부: workspace green, 각 crate wasm32 check, 네이티브 테스트,
   sim-wasm 데모 PASS.

## 미해결/주의
- C가 opcua-codec 구조를 더 바꾸면 위 3번(OpcUaAliasPolicy 위치)이 달라질 수 있음 →
  reconcile 시점에 main 재확인.
- main `clock.rs`에 `now_millis` 상당 API 없으면 추가하거나 sim-engine 쪽에서 대체.
