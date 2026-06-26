<!-- 워크트리 C(opcua-codec + 백엔드 어댑터) 담당 세션용 작업 브리프 -->
# 워크트리 C 브리프 — opcua-codec + 백엔드 어댑터

**브랜치**: `feat/wasm-opcua` · **위치**: `../ModOne-opcua`
**먼저 읽기**: [`00-CONTRACT.md`](./00-CONTRACT.md) (§4 필수), [`01-WORKTREES.md`](./01-WORKTREES.md)

## 너의 목표
1. `crates/opcua-codec` 크레이트 생성.
2. **백엔드 어댑터 패턴 (계약 §4) — 최우선.** OPC UA 서버를 trait 뒤에 숨겨
   나중에 .NET 데몬으로 무중단 교체 가능하게.
   ```rust
   pub trait OpcUaServerBackend: Send + Sync {
       fn start(&self, cfg: OpcUaStartConfig) -> Result<(), OpcUaError>;
       fn stop(&self) -> Result<(), OpcUaError>;
       fn update_node_values(&self, updates: &[NodeValueUpdate]) -> Result<(), OpcUaError>;
       fn take_external_writes(&self) -> Vec<NodeValueUpdate>;
   }
   ```
   - `RustOpcUaBackend`: 기존 `src-tauri/src/opcua/*` + `opcua` crate v0.12 래핑.
   - 구체 백엔드 선택은 `src-tauri` 조립 지점 한 곳(config 플래그 분기).
   - `OpcUaAdapter`(canonical↔opcua)는 `OpcUaServerBackend`에만 의존하도록 리팩터.
     구체 구현을 몰라야 한다.
3. 순수 로직(codec/주소공간/매핑)과 native 전용(소켓/TLS/세션/SQLite audit)을
   분리. native 백엔드는 `opcua-server` feature-gate 유지.

## 현실 제약 (계약 §4)
- `opcua` crate v0.12는 tokio+TLS 풀 async 서버라 **wasm 컴파일 불가.**
- → **OPC UA 실서빙은 native 전용**으로 확정. wasm/브라우저 tier는 OPC UA를
  제공하지 않는다. wasm 게이트는 codec/주소공간 같은 순수 로직에만 적용.
- .NET 재구현 부담 회피 — 지금은 Rust 백엔드만. trait 경계만 깔끔히.

## 검증 게이트 (머지 전)
- `cargo check --workspace` green (default features 포함, `opcua-server` on)
- 순수 로직 부분 `cargo check -p opcua-codec --no-default-features
  --target wasm32-unknown-unknown` green
- 기존 opcua 테스트 통과

## 주의
- 계약(`modone-contract`)은 소비만. §4 `OpcUaServerBackend` trait는 opcua-codec/
  경계 소유. 변경 시 A·B와 합의 불필요(계약 본체 아님)하나 공유는 권장.
- `checklist.md` / `context-notes.md` 생성 후 진행 (전역 규칙).
