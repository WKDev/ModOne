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

## P2 — 노드스펙 경계
- [ ] `start()` 시그니처를 사전 빌드 `AddressSpaceSpec`+config로 변경
- [ ] `build_address_space_spec`(project 의존) 호출부를 src-tauri로 이동
- [ ] 검증 green

## P3 — 라이프사이클 trait 확장
- [ ] trait에 start/stop/status/sessions/security 추가
- [ ] `commands` 호출부를 `Arc<dyn OpcUaServerBackend>` 경유로
- [ ] `RustOpcUaBackend` 명시(또는 OpcUaServer가 곧 backend)
- [ ] 검증 green

## P4 — opcua-codec 크레이트 추출
- [ ] `crates/opcua-codec` 생성, 순수 모듈 이전
- [ ] address_space 순수/프로젝트 분리
- [ ] native(server/auth/audit) `opcua-server` feature-gate
- [ ] `crate::opcua` 경로 호환 re-export
- [ ] 검증: `cargo check -p opcua-codec --target wasm32-unknown-unknown` green, workspace green, 테스트 통과
