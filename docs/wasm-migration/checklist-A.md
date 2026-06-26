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

## Phase 2 — sim-engine 크레이트
- [ ] `crates/sim-engine` 생성
- [ ] types/counter/timer/memory/debugger/tag_registry/executor/engine 이전
      (plc-model + contract 만 의존)
- [ ] src-tauri sim/* 는 native 셸(runtime_host/monitoring/protocol_runtime/
      canvas_sync/tag_events)만 잔류, sim-engine 소비
- [ ] `cargo check -p sim-engine --target wasm32-unknown-unknown` green
- [ ] `cargo test -p sim-engine` 통과

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
