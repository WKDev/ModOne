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
- [ ] `crates/opcua-codec` 생성 + Cargo.toml(modone-contract 의존)
- [ ] 순수 모듈 이전 + 임포트 경로 재작성(crate::plc_runtime→modone_contract 등)
- [ ] `OpcUaServerBackend` trait는 crate, `impl for OpcUaServer`는 src-tauri
- [ ] `crate::opcua`에서 crate 항목 re-export(경로 호환)
- [ ] 검증: `cargo check -p opcua-codec --target wasm32-unknown-unknown` green,
      workspace green, 테스트 컴파일 green
