<!-- 워크트리 A 작업을 체크박스로 추적하는 진행 목록 -->
# 워크트리 A — Checklist (sim-engine + wasm)

## Phase 0 — 설계 (현재)
- [x] sim/* 의존성 맵 작성, executor↔VendorProfile 얽힘 진단
- [x] Plc* 타입 순수성 확인 (project/config.rs)
- [x] VendorProfile 소비처(A/B/C) 영향 분석
- [x] 설계문서 `02-PLC-MODEL.md` 작성
- [ ] **설계 합의 (사용자 리뷰) ← 현재 게이트**

## Phase 1 — plc-model 크레이트 (무중단, B·C 영향 0) ✅ 완료
- [x] `crates/plc-model` 생성 (Cargo.toml, lib.rs), `cargo check -p plc-model` green
- [x] Plc* 하드웨어 타입 config.rs → plc-model/hardware.rs 이전 + 재노출
- [x] Vendor*/VendorProfileError/VendorProfile core 트레이트 이전
- [x] profiles/{ls,melsec} 이전. resolve_vendor_profile은 plc-model(순수),
      resolve_modbus_mapping_policy(project 의존)는 src-tauri/modbus_policy.rs 신설로 잔류
- [x] `crate::plc_runtime`·`crate::project::config` 하위호환 re-export, workspace check green
- [x] `cargo test -p plc-model`(11)·`cargo test -p modone-contract`(11) 통과
- [x] `cargo check -p plc-model --target wasm32-unknown-unknown` green
      (계약 §3 부채 일부 선상환: contract Cargo.toml에 wasm32 타깃 한정
       uuid `js` / chrono `wasmbind` feature 추가 — 네이티브·B·C 무영향)
- [ ] ⚠ src-tauri 전체 lib 테스트는 **기존 버그**로 빌드 불가:
      `symbols/project_block_loader.rs:579` raw string(`"#888888"`) 조기 종료
      — 내 변경과 무관(HEAD와 동일). 별도 수정 필요. modbus_policy 이전 테스트는
      이 버그로 실행 차단됨(로직은 plc-model 11개 테스트가 커버).

## Phase 2 — sim-engine 크레이트 ✅ 구조 완료
- [x] `crates/sim-engine` 생성 (deps: modone-contract, plc-model, serde,
      serde_json, chrono, uuid, parking_lot, thiserror + wasm32 타깃 feature)
- [x] **7개 순수 파일** 이전: types/counter/timer/tag_registry/memory/debugger/
      executor (tokio 무사용). 외부 import만 재작성, 내부 super:: 경로 유지.
- [x] **engine.rs는 src-tauri 잔류** — tokio::time::interval/select! 사용하는
      native 비동기 드라이버라 wasm 부적합(계약 §5). 순수 스캔 로직은 executor가
      이미 보유. wasm tier 동기 펌프는 Phase 4 신규 작성.
- [x] src-tauri sim/mod.rs: `pub use sim_engine::{모듈들}` 재노출 → 기존
      `crate::sim::<module>::...` 경로·native 파일 super:: 전부 무변경 동작
- [x] `cargo check --workspace`·`--tests` green
- [x] `cargo check -p sim-engine --target wasm32-unknown-unknown` green
- [x] `cargo test -p sim-engine`: **77 통과 / 0 실패**. 처음 노출된 기존 버그
      6종 전부 수정 완료:
        · debugger 2종(rename_all_fields, remove_watch 에러) — 27ef36d
        · executor P-bit coil 3종 — LS profile P→OutputBit 도메인 결정, db803fb
        · test_program_execution 1종 — **프로덕션 스캔 버그**: gridToAst는 rung을
          block_series([contact, coil])로 내보내는데 evaluate_node가 코일을
          파워플로우 AND에 포함(코일=false)해 코일이 절대 구동 안 됨. 출력 노드를
          파워플로우 평가에서 제외 + 블록 입력 파워로 출력 구동하도록 수정.

## Phase 3 — 계약 wasm-purity (00-CONTRACT §3 부채) ✅ 완료
- [x] 시간/ID를 `modone-contract::runtime_env`로 중앙화 + cfg 분기:
      native=chrono/uuid, wasm=자기완결 카운터(JS 환경 의존 0). chrono/uuid를
      wasm에서 제거(`cfg(not(wasm32))` 의존). wasmbind/js feature 폐기.
- [x] memory.rs `Utc::now()`/`Uuid::new_v4()` + sim-engine 호출부 전부 헬퍼로 대체,
      직접 chrono/uuid 의존 제거.
- [x] executor `std::time::Instant`(wasm 트랩) → cfg 분기 StopWatch(wasm=0).
- [x] `cargo check -p modone-contract -p sim-engine --target wasm32-unknown-unknown` green.
- [~] 동기 루프백 펌프: sim-wasm이 execute_program을 동기 호출로 구동(스캔 펌프).
      protocol_runtime 비동기 루프는 여전히 native 전용.

## Phase 4 — wasm 하니스 ✅ 완료
- [x] `crates/sim-wasm` (cdylib) — raw `extern "C"` ABI 하니스. wasm-bindgen 불필요.
- [x] `cargo build -p sim-wasm --target wasm32-unknown-unknown --release` → 자기완결
      .wasm(import 0개).
- [x] Node 루프백 데모(`demo/run.mjs`): **PASS** — 초기 P0=0, M0=1+scan→P0=1,
      M0=0+scan→P0=0. 브라우저/Node wasm에서 PLC 스캔 → canonical memory 관찰.
- [x] README(빌드/실행/ABI).

## Phase 5 — main reconcile ✅ 완료 (계획: 05-RECONCILE-PLAN.md)
B(modbus-codec)·C(opcua-codec) 병합된 main을 feat/wasm-sim-core에 머지·해소.
- [x] `git merge main` — rename 감지로 B/C의 profile/ls/melsec 수정이 plc-model에
      자동 적용. 충돌 4파일 수동 해소.
- [x] contract: main `clock.rs` 채택, 내 `runtime_env.rs` 폐기, sim-engine 호출부를
      clock으로 교체. clock에 `now_millis()` 추가(sim 스캔 타이밍용).
- [x] plc-model: Modbus 정책 타입을 `modbus-codec`에서 import(profile_id String),
      modbus-codec 의존 추가. contract는 default-features=false(코어 크레이트 규약).
      project 의존 `modbus_mapping_policy(exposure)` 메서드는 trait에서 제거 유지.
- [x] modbus_policy.rs profile_id → String. src-tauri Cargo.toml 4개 크레이트 통합.
- [x] **modbus-codec 임시 hack 정리**: contract default-features=false + wasm uuid js
      제거(B가 "A 상환 전까지 임시"로 남긴 것 → 정식 상환 완료). sim-wasm import 0개 복원.
- [x] 검증: workspace check green · contract11/plc-model11/sim-engine77/modbus-codec27
      통과 · sim-wasm wasm 빌드(import 0) · node 데모 PASS.
- [~] 트레이트 분할은 불필요(plc-model이 codec 타입 import로 해결). 깔끔한 분할은
      선택적 후속(원하면 ModbusPolicyProfile/OpcUaAliasProfile로 plc-model을 leaf화).
