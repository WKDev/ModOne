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

## 열린 질문
- `plc-model` 위치를 신규 크레이트로 할지, modone-contract 안 모듈로 할지 —
  현재 신규 크레이트 권장(책임 분리/벤더 확장 명확). 합의 대기.
- Phase 1에서 정책 메서드를 core 트레이트에 잠시 남길지(무중단) vs 즉시 분할 —
  무중단 위해 남기는 쪽 권장.
