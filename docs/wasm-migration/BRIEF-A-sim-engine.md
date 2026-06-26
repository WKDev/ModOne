<!-- 워크트리 A(sim-engine + wasm 하니스) 담당 세션용 작업 브리프 -->
# 워크트리 A 브리프 — sim-engine + wasm 하니스

**브랜치**: `feat/wasm-sim-core` · **위치**: `../ModOne-sim`
**먼저 읽기**: [`00-CONTRACT.md`](./00-CONTRACT.md), [`01-WORKTREES.md`](./01-WORKTREES.md)

## 너의 목표
1. `crates/sim-engine` 크레이트 생성. `src-tauri/src/sim/*` 중 전송/Tauri 비의존
   코어(engine, executor, debugger, runtime_host 등)를 추출. `modone-contract`에
   의존, `src-tauri`/`tauri`/`tokio runtime`/소켓에는 **절대 의존 금지**.
2. `modone-contract`를 wasm으로 컴파일되게 만든다 (계약 §3 부채 상환). **계약
   표면(타입/시그니처) 불변.** 내부만 수정.
   - `chrono::Utc::now()` → `wasmbind` feature 또는 시간 주입 콜백
   - `uuid::v4` → `js` feature 또는 ID 주입
   - `tokio::sync::broadcast`는 wasm OK. `protocol_runtime`(interval/spawn/
     select)는 native 전용 → wasm용 동기 루프백 펌프를 별도 작성.
3. wasm 빌드 하니스: `wasm32-unknown-unknown` 타깃 추가, `wasm-bindgen`/
   `wasm-pack`, JS 루프백 전송 stub (브라우저에서 sim 실행 → canonical memory
   관찰하는 최소 데모).

## 검증 게이트 (머지 전)
- `cargo check --workspace` green
- `cargo check -p modone-contract --target wasm32-unknown-unknown` green
- `cargo check -p sim-engine --target wasm32-unknown-unknown` green
- `cargo test -p modone-contract`, `cargo test -p sim-engine` 통과

## 주의
- 계약 시그니처를 바꿔야 하면 B·C 담당과 합의 후 PR. 내부 구현 변경은 자유.
- root `Cargo.toml`은 `crates/*` glob이라 크레이트 추가 시 멤버 등록 불필요.
- 시작 시 `checklist.md` / `context-notes.md`를 이 워크트리에 생성하고 진행상황
  기록 (전역 규칙).
