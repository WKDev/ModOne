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
- [~] `cargo test -p sim-engine`: **71 통과 / 6 실패** — 6개는 **기존 버그**
      (내 이전은 순수 경로 재작성이라 동작 불변; create_executor는 profile 미사용).
      그동안 symbols 컴파일 버그+Tauri 테스트 DLL 0xC0000139로 실행 불가라 잠복.
      ⚠ 별도 처리 필요:
        · executor P-bit coil 4종(P0 write 후 read 불일치)
        · debugger 직렬화 1종(networkId camelCase 미포함)
        · debugger 에러포맷 1종(Display가 Debug처럼 출력)

## Phase 3 — 계약 wasm-purity (00-CONTRACT §3 부채)
- [ ] memory.rs `chrono::Utc::now()` → 시간 주입/wasmbind feature
- [ ] event_bus `uuid::v4` → js feature/ID 주입
- [ ] wasm용 동기 루프백 펌프 (protocol_runtime 대체)
- [ ] `cargo check -p modone-contract --target wasm32-unknown-unknown` green

## Phase 4 — wasm 하니스
- [ ] wasm-bindgen/wasm-pack 빌드 하니스
- [ ] JS 루프백 stub: 브라우저에서 sim 실행 → canonical memory 관찰 최소 데모

## Phase 5 — 트레이트 분할 (B·C 합의 후, 별도 PR)
- [ ] ModbusPolicyProfile(B)/OpcUaAliasProfile(C) 확장 트레이트 분리
- [ ] B·C 호출부 조정, 3자 합의
