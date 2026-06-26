<!-- 3개 워크트리 분담/브랜치/의존순서/통합 프로토콜을 정의하는 문서 -->
# 워크트리 분담 (3-worktree 병렬 개발)

> 목적은 **개발 병렬성**이다. 런타임은 단일 wasm 아티팩트 + native 셸로 통합된다.
> 셋 다 [`00-CONTRACT.md`](./00-CONTRACT.md)를 공유 계약으로 따른다.

## 선행 조건 (Phase 0, 이 main 세션이 끝냄)

1. `modone-contract` 크레이트가 main에 존재하고 빌드 green.
2. 이 두 문서가 main에 커밋됨.

→ 완료 후 세 워크트리는 **갱신된 main에서 분기**해야 계약 크레이트를 공유한다.

## 워크트리 A — sim-engine + wasm 하니스

- **브랜치**: `feat/wasm-sim-core`
- **소유 크레이트**: `crates/sim-engine`, wasm 빌드 하니스
- **scope**:
  - 기존 `src-tauri/src/sim/*`(engine, executor, debugger, runtime_host 등)에서
    전송/Tauri 비의존 코어를 `sim-engine` 크레이트로 추출.
  - `modone-contract`를 wasm으로 컴파일되게 만든다 (계약 §3 부채 상환:
    chrono/uuid/tokio 처리). **계약 표면 불변.**
  - wasm 빌드 하니스: `wasm-pack`/`wasm-bindgen`, `wasm32-unknown-unknown` 타깃,
    JS 루프백 전송 stub (브라우저에서 sim 실행 → canonical memory 관찰).
  - 검증: `cargo check -p sim-engine --target wasm32-unknown-unknown` green.
- **계약 건드림**: §3 wasm-purity 한정. 시그니처 바꾸면 B/C와 합의.

## 워크트리 B — modbus-codec

- **브랜치**: `feat/wasm-modbus`
- **소유 크레이트**: `crates/modbus-codec`
- **scope**:
  - Modbus 매핑 정책 타입(`ModbusMappingPolicy/Rule/AddressSpace/Source`)을
    `src-tauri/src/plc_runtime/profile.rs`에서 `modbus-codec`로 이전.
    (src-tauri/profile.rs의 resolve 함수는 잔류, B에서 import.)
  - PDU 인코딩/디코딩 + `ModbusAdapter`(canonical↔modbus 동기화) +
    `DirtyPublishWindow::intersects_rule`(modbus 전용)을 `modbus-codec`로.
  - **소켓은 제외** — `TcpListener`/`tokio-serial`은 `src-tauri/src/modbus`에
    native 전송 셸로 잔류, codec 크레이트를 호출.
  - 검증: `cargo check -p modbus-codec --target wasm32-unknown-unknown` green,
    기존 modbus adapter 테스트 통과.
- **계약 건드림**: 없음 (계약을 소비만 함).

## 워크트리 C — opcua-codec + 백엔드 어댑터

- **브랜치**: `feat/wasm-opcua`
- **소유 크레이트**: `crates/opcua-codec`
- **scope**:
  - 계약 §4의 `OpcUaServerBackend` trait 정의 + `RustOpcUaBackend` 구현
    (기존 `src-tauri/src/opcua/*`, `opcua` crate v0.12 래핑).
  - `OpcUaAdapter`(canonical↔opcua)는 trait에만 의존하도록 리팩터.
  - **.NET 교체 가능성을 trait 경계로 보장** — 구체 백엔드는 src-tauri 조립
    지점 한 곳에서 선택.
  - codec/주소공간 등 순수 로직과 native 전용(소켓/TLS/세션) 분리. native
    백엔드는 feature-gate (`opcua-server`).
  - 검증: 순수 로직 부분 `cargo check --target wasm32-unknown-unknown` green,
    기존 opcua 테스트 통과.
- **계약 건드림**: 없음 (계약 §4 trait는 opcua-codec/경계 소유).

## 통합 순서 & 충돌 회피

- 세 워크트리가 동시에 건드릴 수 있는 유일 파일: `src-tauri/Cargo.toml`,
  워크스페이스 root `Cargo.toml`, `src-tauri`의 조립 지점(lib.rs). 머지 시
  여기서 충돌 가능 → **작은 PR로 자주 머지**하고 root Cargo.toml 멤버 추가는
  Phase 0에서 미리 다 등록해 둔다.
- A의 계약 §3 변경(wasm-purity)은 내부 구현 한정 → B/C 영향 최소. 시그니처
  변경 필요 시 즉시 공유.
- 권장: **워크트리당 Claude 세션 1개.** 각 세션은 자기 워크트리 디렉터리에서
  자기 브리프(`WORKTREE-BRIEF.md`)와 checklist/context-notes로 독립 진행.

## 운영 메모

- 워크트리 위치: `git worktree add ../ModOne-<name> <branch>`.
- 머지 타깃: main. 각 워크트리는 계약 변경 외에는 독립이므로 순서 무관하게 머지.
