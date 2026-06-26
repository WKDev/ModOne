<!-- 워크트리 A 진행 중 내려진 설계 결정과 근거를 누적 기록하는 노트 -->
# 워크트리 A — Context Notes (sim-engine + wasm)

## 핵심 발견 (2026-06-26)
- `sim/executor.rs`는 `VendorProfile` 트레이트(`&dyn VendorProfile`)에 의존 →
  순수 추출 불가. 트레이트가 핵심 추상화 경계라 단순 코드 이동이 아님.
- `VendorProfile`(profile.rs:183)는 두 책임 혼재:
  - 순수 모델: 주소변환/토폴로지 (Plc* + Canonical* 의존)
  - 프로토콜 정책 누수: `*_modbus_mapping_policy`, `opcua_alias_policy` (B/C 타입 반환)
- Plc* 하드웨어 타입은 `project/config.rs:338-486`에 있으나 **순수 serde** (opcua/
  modbus/crate 참조 없음 확인). fs 모듈에 갇힌 incidental coupling.
- VendorProfile 소비처: A=executor, B=modbus/adapter, C=opcua/{address_space,
  server}+commands/opcua. **3 워크트리 공유 추상화.**

## 결정 (사용자 합의)
- 우선순위: **vendor-neutral PLC 모델의 구조화된 아키텍처 설계가 먼저** (spec-first).
- 산출물: 설계문서 `02-PLC-MODEL.md` 먼저 작성 → 합의 후 구현.
- 해법: 신규 `crates/plc-model` 크레이트 = 추상화의 집. Plc* + VendorProfile core
  이전. 정책 메서드는 확장 트레이트(`ModbusPolicyProfile`/`OpcUaAliasProfile`)로
  분리하되 **Phase 2(B·C 합의 후)** 로 미룸.

## B·C 조정 상태
- B·C 워크트리 진행 중. **Phase 1은 무중단**(하위호환 re-export, API 변화 0).
- Phase 2(트레이트 분할)에서만 3자 합의 필요 → 그때 사용자에게 재요청.
- 현재 사용자에게 멈춤 요청 **불필요**.

## Phase 1 구현 결과 (2026-06-26)
- `crates/plc-model` 신설: hardware.rs(Plc* 이전), profile.rs(Vendor*/트레이트),
  profiles/{ls,melsec}. lib.rs에서 공개 표면 재노출. 의존: modone-contract만.
- 트레이트 정리: `modbus_mapping_policy(exposure)` default 메서드는 project
  타입(ModbusExposureSettings) 의존 → 트레이트에서 제거하고 src-tauri
  `plc_runtime/modbus_policy.rs`의 `resolve_modbus_mapping_policy`로 흡수.
  외부 호출처 없어 무중단. 트레이트엔 recommended_/legacy_/opcua_alias_만 잔류
  (Phase 2에서 이들도 확장 트레이트로 분리 예정).
- 하위호환: `crate::project::config`가 `pub use plc_model::{Plc*}`,
  `crate::plc_runtime`가 `pub use plc_model::{...}` + `profiles` 재노출.
  → 기존 경로 전부 그대로 동작. **B·C 코드 변경 0.**
- 계약 §3 부채 선상환(최소): contract Cargo.toml에 wasm32 타깃 한정 feature
  (uuid `js`, chrono `wasmbind`) 추가. API 표면 불변, 네이티브 무영향.
  → plc-model·contract 둘 다 wasm32 check green.
- **기존 버그 발견(내 변경 무관)**: `symbols/project_block_loader.rs:579`의
  raw string이 `"#888888"`에서 조기 종료돼 src-tauri lib 테스트 빌드 실패.
  `cargo check`는 test 모듈 미컴파일이라 그동안 잠복. 별도 PR로 수정 권장.

## Phase 2 구현 결과 (2026-06-26)
- `crates/sim-engine` 신설. 순수 7파일(types/counter/timer/tag_registry/memory/
  debugger/executor) git mv. 의존: modone-contract + plc-model + serde/serde_json/
  chrono/uuid/parking_lot/thiserror. wasm32 타깃 feature(chrono wasmbind, uuid js).
- **engine.rs 잔류 결정(설계 갱신)**: 02-PLC-MODEL/체크리스트는 engine까지 이전
  예정이었으나, engine.rs가 `tokio::time::interval`+`tokio::select!` 비동기 스캔
  드라이버라 wasm 부적합. 계약 §5 "비동기 루프는 native 전용, wasm은 동기 펌프"에
  따라 engine은 native 셸 잔류. PLC 로직 본체(ProgramExecutor)는 executor에 있어
  이미 wasm-buildable. wasm 동기 펌프는 Phase 4 신규.
- 모듈 경로 호환: sim/mod.rs가 `pub use sim_engine::{counter,debugger,executor,
  memory,tag_registry,timer,types}`. 덕분에 외부 `crate::sim::types::X` 와 native
  파일들의 `super::memory` 등이 전부 무변경. 이전 파일 내부 `super::types`도
  sim-engine 루트 기준이라 그대로 동작(추가 재작성 0).
- 검증: workspace check+tests green, sim-engine wasm32 green, sim-engine 단위
  테스트 71 통과.

## 발견: 기존 테스트 실패 6종 (내 변경 무관, 신규 노출)
sim-engine을 독립 크레이트로 분리하니 처음으로 테스트 실행 가능해졌고 6개 실패
노출. 이전은 순수 경로 재작성(동작 불변)이고 executor 테스트의 create_executor는
VendorProfile조차 안 쓰므로 plc-model 경로와 무관 → **기존 잠복 버그 확정**.
그동안 (1)symbols raw string 컴파일 버그 (2)Tauri app_lib 테스트 DLL
0xC0000139 STATUS_ENTRYPOINT_NOT_FOUND 로 src-tauri 테스트 자체가 실행 불가였음.
- executor::tests P-bit coil 4종: P0에 coil write 후 read_bit(P,0) 불일치.
- debugger::tests::test_breakpoint_hit_serialization: json에 "networkId":5 없음.
- debugger::tests::test_remove_nonexistent_watch: 에러가 Display 대신 Debug
  포맷("Tag { tag_id: ... }")으로 나옴.
→ 도메인/테스트 정합성 문제. 사용자 판단 대기(별도 수정 권장).

## 기존 버그 6종 처리 결과 (2026-06-26)
- debugger 2종 수정(커밋 27ef36d): BreakpointHit rename_all_fields=camelCase,
  remove_watch 에러가 원래 주소 보고.
- executor P-bit coil 4종 중 3종 수정: **사용자 도메인 결정 — LS profile의
  P 기본을 OutputBit로 변경**(topology 없을 때). 변경 위치:
  · ls.rs canonical_area_for_p 폴백 InputBit→OutputBit
  · ls.rs legacy_modbus_mapping_policy P 규칙 canonical_area InputBit→OutputBit
    (address_space DiscreteInput vs Coil은 B 도메인 — 합의 필요, 주석 플래그)
  · ls.rs P 영역 단언 테스트 2종 갱신(translates_/defaults_slot_based_)
  ⚠ **B/C 영향**: 공유 profile의 P 영역·Modbus 노출 변경. B(modbus-codec)는 P의
    Modbus address_space 정책 재확인 필요, C(opcua)는 canonical_aliases가
    OutputBit→P 자동 처리(무영향). 사용자(코디네이터)가 B/C에 통지 필요.
- **남은 1종(executor::tests::test_program_execution) — 별개 버그**:
  evaluate_node가 코일에 대해 항상 false 반환(line 839 "outputs don't contribute
  to power flow"). 테스트가 rung을 series([contact, coil])로 구성하는데
  execute_output의 BlockSeries 분기가 각 child를 독립 evaluate → 코일 input이
  항상 false → P0 미반영. P-area와 무관한 래더 파워플로우 모델 이슈(또는 테스트
  프로그램 구조 오류). 실 컴파일러(gridConverter)의 네트워크 구조 확인 필요 →
  사용자 판단 대기.

## Phase 3+4 구현 결과 (2026-06-27)
- **wasm-purity 완성(주입 방식)**: 처음엔 contract Cargo.toml에 wasmbind/js feature로
  땜빵했으나, 그러면 wasm이 JS 환경(Date/crypto) import를 요구해 자기완결 로드가
  불가했다. → `modone-contract::runtime_env`로 시간/ID를 중앙화하고 cfg 분기:
  native=chrono/uuid, wasm=단조 카운터. chrono/uuid는 `cfg(not(wasm32))` 의존으로
  내려 wasm 빌드에서 완전 제거. sim-engine의 chrono/uuid 호출부도 전부 헬퍼로 대체.
  → wasm 모듈 import 0개(자기완결).
- **executor Instant 트랩**: `std::time::Instant::now()`가 wasm32-unknown-unknown에서
  런타임 트랩(unreachable). cfg 분기 StopWatch로 wasm은 0 반환(성능지표라 무해).
  ※ cargo check는 통과하나 런타임에 터지는 류 — wasm은 반드시 실제 실행 검증 필요.
- **sim-wasm 하니스**: cdylib + raw `extern "C"` ABI(sim_init/set_bit/scan/read_bit).
  wasm-bindgen/wasm-pack 미설치 환경이라 raw ABI 선택 — 추가 툴체인 0. Node가
  `WebAssembly.instantiate`로 직접 로드. demo/run.mjs로 M0→P0 스캔 검증 PASS.
- engine.rs(native 셸)는 여전히 Instant/tokio 사용(정상). wasm tier의 "동기 펌프"는
  sim-wasm이 execute_program을 동기 호출하는 것으로 충족.

## 열린 질문
- `plc-model` 위치를 신규 크레이트로 할지, modone-contract 안 모듈로 할지 —
  현재 신규 크레이트 권장(책임 분리/벤더 확장 명확). 합의 대기.
- Phase 1에서 정책 메서드를 core 트레이트에 잠시 남길지(무중단) vs 즉시 분할 —
  무중단 위해 남기는 쪽 권장.
