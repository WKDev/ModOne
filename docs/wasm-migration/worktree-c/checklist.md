<!-- 워크트리 C(opcua-codec + 백엔드 어댑터) 작업 체크리스트 -->
# 워크트리 C — checklist

브랜치: `feat/wasm-opcua` · 계약: [00-CONTRACT.md](../00-CONTRACT.md) §4

## 의존성 지도 (조사 완료)
- 순수(→ opcua-codec): `types.rs`, `memory.rs`, `mapping.rs`, `dirty_tracker.rs`
- 혼합: `address_space.rs` — `crate::project`/`crate::sim` 의존 → spec 빌더는 src-tauri 잔류
- 어댑터: `adapter.rs` — 구체 `OpcUaServer` 직접 의존(리팩터 대상)
- native(feature `opcua-server`): `server.rs`(opcua crate 유일 사용처), `auth.rs`(bcrypt), `audit.rs`(rusqlite)
- 조립 지점: `commands/sim.rs:212`(adapter), `commands/opcua.rs:398`(server)

## P1 — 어댑터-trait 경계 (§4 핵심)
- [x] `opcua/backend.rs`: `OpcUaServerBackend` trait 정의(publish 경로)
- [x] `impl OpcUaServerBackend for OpcUaServer`
- [x] `OpcUaAdapter`가 `Arc<dyn OpcUaServerBackend>` 의존하도록 변경
- [x] `mod.rs` re-export, 조립 지점 coercion 확인 (sim.rs:212 무변경, 통합 테스트는 `server.clone()`로 수정)
- [x] 검증: `cargo check --workspace` green + 모든 test 바이너리 컴파일 green
      (테스트 *실행*은 환경 DLL 오류로 이 샌드박스 불가 — context-notes 참조)

## P2 — 노드스펙 경계 ✅
- [x] `start()` 시그니처를 사전 빌드 `AddressSpaceSpec` 수신으로 변경
- [x] `build_address_space_spec`(project 의존) 호출부를 src-tauri로 이동
- [x] 검증: workspace check + test 컴파일 green

## P3 — address_space 순수/프로젝트 분리 ✅ (계획 조정: 아래 참조)
- [x] 순수 타입/헬퍼를 `address_space_spec.rs`로 분리(crate 이전 대상)
- [x] `build_address_space_spec` + project 결합 helper는 `address_space.rs` 잔류
- [x] `crate::opcua::address_space::*` 경로 호환 re-export
- [x] 검증 green

> **계획 조정**: 원래 P3은 "라이프사이클 trait 확장(start/stop/status/sessions)"
> 이었으나, start()가 native `AuditLoggerState`에 결합돼 순수 크레이트 경계와
> 충돌한다. §4의 "어댑터는 trait에만 의존"은 P1로 이미 충족. 라이프사이클-trait
> 기반 .NET 교체는 audit 싱크 재설계가 필요한 후속 과제로 분리. P3을 크레이트
> 추출의 선행 분리 작업으로 재정의함.

## P4 — opcua-codec 크레이트 추출
크레이트 구성(순수): error(OpcUaError) · memory · mapping · dirty_tracker ·
address_space_spec · backend(trait) · adapter. native(server/auth/audit +
build_address_space_spec + trait impl)는 src-tauri 잔류.
- [x] `crates/opcua-codec` 생성 + Cargo.toml(modone-contract 의존)
- [x] 순수 모듈 이전(error/memory/mapping/dirty_tracker/address_space_spec/
      backend/adapter) + 임포트 경로 재작성(crate::plc_runtime/modbus→modone_contract)
- [x] `OpcUaServerBackend` trait는 crate, `impl for OpcUaServer`는 src-tauri(backend_impl)
- [x] `crate::opcua`에서 crate 모듈/항목 re-export(경로 호환, sibling 무수정)
- [x] src-tauri/sim 의존 테스트 재배치(adapter_backend_tests/mapping_project_tests)
- [x] 검증: `cargo check --workspace` green, `cargo test -p modone --no-run` green
- [x] 검증: `cargo check -p opcua-codec --target wasm32-unknown-unknown` **green**
      (단 modone-contract에 uuid `js`+chrono `wasmbind` 피처 추가 필요 — §3/A 소관,
      아래 참조. opcua-codec 소스 자체는 wasm-hostile 의존 전무.)

## 워크트리 C 완료. 잔여 메모
- §6 wasm 게이트 green은 modone-contract의 §3 wasm-purity 피처(uuid js,
  chrono wasmbind)에 의존. 이는 계약상 **워크트리 A 소관**이라 별도 커밋으로
  분리하고 플래그함(추가/네이티브 무해). A가 ID-주입 방식을 택하면 이 피처는
  무해하거나 대체 가능.
- 라이프사이클(start/stop/status/sessions) trait화 + .NET 프로세스 백엔드는
  audit 싱크 재설계가 필요한 후속 과제(§4 심화). P1으로 어댑터-trait 의존은 충족.
