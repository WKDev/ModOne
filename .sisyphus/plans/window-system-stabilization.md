# Window System Stabilization — Cross-Platform Reliability

## TL;DR

> **Quick Summary**: ModOne의 floating window 시스템이 기본 틀만 잡혀있고 제대로 동작하지 않는 상태. DPI/좌표계 혼용, 윈도우 수명주기 관리 부재, 상태 동기화 race condition, Mutex poisoning 위험 등 총 10개 이슈를 수정하여 Windows + macOS에서 안정적으로 동작하도록 전면 안정화.
>
> **Deliverables**:
> - Rust backend: 좌표계 통일, OS close 이벤트 핸들러, 메인 윈도우 close시 floating cleanup, UUID 전체 사용
> - TypeScript frontend: 단일 cleanup 경로, bounds 전달 수정, state sync race fix, loading state
> - Tests: 기존 테스트 업데이트 + 새 테스트 추가
>
> **Estimated Effort**: Medium (8 tasks across 3 waves)
> **Parallel Execution**: YES — 3 waves, max 3 concurrent in Wave 1
> **Critical Path**: Task 2 → Task 4 → Task 6 → Task 7 → Task 8

---

## Context

### Original Request
윈도우 시스템이 안정적인지, 크로스 플랫폼 환경에서 더 안정적으로 잘 동작하게 개선이 필요한지 분석 및 개선 계획 수립.

### Interview Summary
**Key Discussions**:
- **타겟 플랫폼**: Windows + macOS (Linux 추후)
- **Floating window 상태**: 틀만 잡혀있고 거의 제대로 동작하지 않음 → 전면 안정화 필요
- **스코프**: 원래 8개 이슈 발견 + Metis 리뷰에서 2개 추가 → 총 10개 이슈 수정
- **테스트 전략**: tests-after (구현 후 테스트 업데이트 + 추가)

**Research Findings**:
- `useWindowClose.ts`에 이미 WebView2 HRESULT 0x8007139F 방지를 위한 grace period 패턴이 있음 (Windows 실전 경험 반영)
- `screenUtils.ts`에 multi-monitor 지원 코드가 있지만 physical pixel을 반환 → logical coordinate 변환 필요
- `stateSync.ts`의 `mergeState` 옵션이 dead code (line 112-114에서 실제로 무시됨)
- `floating-window-created` 이벤트에 bounds 정보가 없어서 FloatingWindowRenderer가 하드코딩된 값 사용

### Metis Review
**Identified Gaps** (all addressed):
- `tauri-plugin-window-state`가 floating windows도 추적하여 재시작 시 phantom window 발생 가능 → Task 3에서 수정
- OS close 버튼 클릭 시 registry 미업데이트 → Task 2에서 수정
- `FloatingWindowContent.handleClose`와 `FloatingWindowRenderer` 이벤트 핸들러의 double-unregister race → Task 4에서 수정
- `dockPanel` flow에서 React tree 파괴와 Tauri window close의 race → Task 4에서 고려
- `mergeState` dead code in stateSync.ts → Task 6에서 수정

---

## Work Objectives

### Core Objective
ModOne의 floating window 시스템을 Windows + macOS에서 안정적으로 동작하도록 10개 이슈를 수정. 새 기능 추가 없이 기존 코드의 안정화에만 집중.

### Concrete Deliverables
- `src-tauri/src/commands/window.rs` — 좌표계 수정, bounds 이벤트 포함, UUID 전체 사용
- `src-tauri/src/lib.rs` — OS close 이벤트 핸들러 추가, floating window cleanup, window-state plugin 설정
- `src/services/windowService.ts` — WindowCreatedPayload에 bounds 추가
- `src/components/floating/FloatingWindowRenderer.tsx` — 실제 bounds 사용, 단일 cleanup 경로
- `src/components/floating/FloatingWindowContent.tsx` — cleanup 단순화, loading state 추가
- `src/utils/stateSync.ts` — mergeState fix, error handling 개선
- `src/hooks/useStateSync.ts` — requestStateFromMain 에러 처리
- 테스트 파일들: windowStore.test.ts, panelStore.floating.test.ts 업데이트 + 신규

### Definition of Done
- [ ] `pnpm test -- --run` — 모든 테스트 통과 (기존 + 신규)
- [ ] `cd src-tauri && cargo check` — 컴파일 성공
- [ ] `cd src-tauri && cargo clippy -- -D warnings` — warning 없음
- [ ] Floating window 생성 → 닫기 → 재생성이 에러 없이 동작
- [ ] 메인 윈도우 닫기 시 모든 floating window도 정리됨

### Must Have
- Logical coordinates 일관 사용 (HiDPI 정상 동작)
- 메인 윈도우 close 시 floating windows 정리
- OS close 버튼으로 floating window 닫아도 state 정리
- Double-close/double-unregister 방어
- State sync 완료 전 loading state 표시
- 기존 테스트 통과 + 신규 테스트

### Must NOT Have (Guardrails)
- ❌ 메인 윈도우 동작 변경 (custom titlebar, MainLayout, sidebar 등)
- ❌ Floating window 상태 persist/restore 시스템 구현 (scope 외)
- ❌ State sync 아키텍처 재설계 (기존 구조 활용하여 수정만)
- ❌ 새로운 Tauri command 추가 (기존 command 수정만)
- ❌ 새로운 UI 컴포넌트나 기능 추가
- ❌ Linux 지원 코드 추가 (추후 별도)
- ❌ E2E/Playwright 테스트 추가 (별도 task)
- ❌ `parking_lot::Mutex`로 전환 (std::sync::Mutex에서 poisoning 처리만 추가)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: vitest (frontend), cargo test (Rust)
- **Each task**: 구현 후 관련 테스트 업데이트/추가

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Rust**: Use Bash — `cargo check`, `cargo clippy`, `cargo test`
- **TypeScript**: Use Bash — `pnpm test -- --run <file>`
- **Integration**: Use Bash — combined test suite run

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — Rust backend foundation, 3 PARALLEL):
├── Task 1: Fix Physical vs Logical coordinates in Rust [deep]
├── Task 2: Add OS-level window close handler + main window cleanup [deep]
└── Task 3: Window ID uniqueness + window-state plugin config [unspecified-high]

Wave 2 (After Wave 1 — Frontend state fixes, MIXED parallel):
├── Task 4: Fix double-unregister + single cleanup path (depends: 2) [unspecified-high]
├── Task 5: Include bounds in created event (depends: 1, 2) [quick]
├── Task 6: Fix stateSync race + "Panel not found" (depends: 4, 5) [unspecified-high]
└── Task 7: Fix close rollback protection (depends: 4, 6) [quick]

Wave 3 (After Wave 2 — Tests):
└── Task 8: Update and add comprehensive tests (depends: 4,5,6,7) [unspecified-high]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 2 → Task 4 → Task 6 → Task 7 → Task 8
Parallel Speedup: ~40% faster than sequential
Max Concurrent: 3 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 5 | 1 |
| 2 | — | 4, 5 | 1 |
| 3 | — | — | 1 |
| 4 | 2 | 6, 7 | 2 |
| 5 | 1, 2 | 6 | 2 |
| 6 | 4, 5 | 7 | 2 |
| 7 | 4, 6 | 8 | 2 |
| 8 | 4, 5, 6, 7 | — | 3 |

### Agent Dispatch Summary

- **Wave 1**: **3 tasks** — T1 → `deep`, T2 → `deep`, T3 → `unspecified-high`
- **Wave 2**: **4 tasks** — T4 → `unspecified-high`, T5 → `quick`, T6 → `unspecified-high`, T7 → `quick`
- **Wave 3**: **1 task** — T8 → `unspecified-high`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [ ] 1. Fix Physical vs Logical Coordinates in Rust Window Commands

  **What to do**:
  - In `src-tauri/src/commands/window.rs`, change `window_update_bounds` (lines 174-177) from `PhysicalPosition`/`PhysicalSize` to `LogicalPosition`/`LogicalSize`
  - Fix `window_get_floating_info` (lines 226-237): `outer_position()` and `outer_size()` return physical values. Get the window's `scale_factor()` and convert to logical coordinates before updating the registry
  - Verify `window_create_floating` (line 91-103): `.inner_size()` and `.position()` already accept logical values in Tauri v2 — confirm this is correct and document with a comment
  - Add Mutex poisoning handling: replace bare `.lock().map_err(...)` with `.lock().unwrap_or_else(|e| e.into_inner())` pattern throughout the file (addresses HIGH issue #4)
  - Ensure all `f64 as i32` and `f64 as u32` casts are replaced with proper `LogicalPosition::new(bounds.x, bounds.y)` and `LogicalSize::new(bounds.width, bounds.height)` that accept f64 directly

  **Must NOT do**:
  - Do NOT change the `WindowBounds` struct or its fields — only change how they're used in Tauri API calls
  - Do NOT add new commands or modify command signatures
  - Do NOT switch to `parking_lot::Mutex` — only add poisoning recovery to existing `std::sync::Mutex`

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires understanding Tauri v2 coordinate system semantics (LogicalPosition vs PhysicalPosition) and potential API research
  - **Skills**: []
    - No browser/frontend skills needed — pure Rust backend work
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser automation involved
    - `frontend-ui-ux`: No UI work — this is Rust code

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 5
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src-tauri/src/commands/window.rs:91-103` — `window_create_floating` uses `.inner_size()` and `.position()` which accept logical values. This is the CORRECT pattern to follow
  - `src-tauri/src/commands/window.rs:174-177` — `window_update_bounds` uses PhysicalPosition/PhysicalSize — THIS IS THE BUG to fix
  - `src-tauri/src/commands/window.rs:226-237` — `window_get_floating_info` reads outer_position/outer_size (physical) — needs scale_factor conversion

  **API/Type References** (contracts to implement against):
  - `src-tauri/src/commands/window.rs:12-19` — `WindowBounds` struct definition (x, y, width, height as f64) — do NOT change
  - Tauri v2 API: `tauri::LogicalPosition`, `tauri::LogicalSize` — use these instead of Physical variants
  - Tauri v2 API: `window.scale_factor()` — returns f64 scale factor for coordinate conversion

  **WHY Each Reference Matters**:
  - `window.rs:91-103`: Shows the correct Tauri v2 pattern — `.inner_size(w, h)` takes logical f64 directly
  - `window.rs:174-177`: This is the exact bug — `PhysicalPosition::new(bounds.x as i32, ...)` loses precision AND uses wrong coordinate space
  - `window.rs:226-237`: Reading back position also needs fixing — `outer_position()` returns Physical, needs `/scale_factor` for logical

  **Acceptance Criteria**:

  - [ ] `cd src-tauri && cargo check` — compiles successfully
  - [ ] `cd src-tauri && cargo clippy -- -D warnings` — zero warnings
  - [ ] No `PhysicalPosition` or `PhysicalSize` usage remains in window.rs (except in clearly documented physical-to-logical conversion code)
  - [ ] All Mutex `.lock()` calls use poisoning recovery pattern

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Rust compilation with logical coordinates
    Tool: Bash
    Preconditions: Tauri v2 project with updated window.rs
    Steps:
      1. Run `cd src-tauri && cargo check 2>&1`
      2. Assert exit code 0
      3. Run `cd src-tauri && cargo clippy -- -D warnings 2>&1`
      4. Assert exit code 0
    Expected Result: Zero compilation errors, zero clippy warnings
    Failure Indicators: Any `error[E...]` or `warning:` in output
    Evidence: .sisyphus/evidence/task-1-cargo-check.txt

  Scenario: No Physical coordinate types remain in window commands
    Tool: Bash (grep)
    Preconditions: window.rs updated
    Steps:
      1. Run `grep -n 'PhysicalPosition\|PhysicalSize' src-tauri/src/commands/window.rs`
      2. Assert output is empty OR only in comments/documentation
    Expected Result: No active usage of Physical coordinate types
    Failure Indicators: Any non-comment line containing PhysicalPosition or PhysicalSize
    Evidence: .sisyphus/evidence/task-1-no-physical-types.txt
  ```

  **Evidence to Capture:**
  - [ ] task-1-cargo-check.txt — cargo check + clippy output
  - [ ] task-1-no-physical-types.txt — grep results confirming no Physical types

  **Commit**: YES
  - Message: `fix(window): use logical coordinates in Rust window commands`
  - Files: `src-tauri/src/commands/window.rs`
  - Pre-commit: `cd src-tauri && cargo check && cargo clippy -- -D warnings`

---

- [ ] 2. Add OS-Level Window Close Event Handler + Main Window Floating Cleanup

  **What to do**:
  - In `src-tauri/src/lib.rs` `.setup()` closure, add an `app.on_window_event()` handler that:
    - Detects when a floating window (label starts with `floating-`) receives `WindowEvent::Destroyed` event
    - Unregisters it from `FloatingWindowRegistry` (access via `app.state::<FloatingWindowState>()`)
    - Emits `floating-window-closed` event with `{"windowId": label}` so the frontend can clean up
    - Detects when the main window (default label) is being closed/destroyed
    - Before main window destruction: iterates all registered floating windows and closes them using `window.close()`
  - Ensure the `on_window_event` handler is added BEFORE the existing `Ok(())` return in `.setup()`
  - Add a helper function `close_all_floating_windows(app: &AppHandle, state: &FloatingWindowState)` in window.rs for reuse

  **Must NOT do**:
  - Do NOT modify `useWindowClose.ts` or the main window's close behavior
  - Do NOT add new Tauri commands — only use internal Rust event handling
  - Do NOT change the main window configuration in tauri.conf.json

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex Tauri lifecycle management — requires understanding the event system and window lifecycle ordering
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - All frontend/browser skills: This is pure Rust/Tauri backend work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `src-tauri/src/lib.rs:151-161` — Existing `.setup()` closure where the event handler should be added
  - `src-tauri/src/commands/window.rs:131-159` — `window_close_floating` command shows the pattern for closing + unregistering + emitting
  - `src-tauri/src/commands/window.rs:30-68` — `FloatingWindowRegistry` methods (unregister, list) to use in cleanup

  **API/Type References**:
  - `src-tauri/src/commands/window.rs:71` — `FloatingWindowState = Mutex<FloatingWindowRegistry>` — the state type to access
  - Tauri v2 API: `app.on_window_event(|window, event| { ... })` — the API to use
  - Tauri v2 API: `WindowEvent::Destroyed` — the event to watch for
  - Tauri v2 API: `window.label()` — returns the window label string

  **WHY Each Reference Matters**:
  - `lib.rs:151-161`: This is WHERE to add the code — inside the existing `.setup()` closure before `Ok(())`
  - `window.rs:131-159`: Shows the exact unregister+emit pattern to replicate in the event handler
  - `window.rs:30-68`: The registry API — `unregister()` returns `Option<FloatingWindowInfo>` confirming removal

  **Acceptance Criteria**:

  - [ ] `cd src-tauri && cargo check` — compiles successfully
  - [ ] `cd src-tauri && cargo clippy -- -D warnings` — zero warnings
  - [ ] `on_window_event` handler present in `lib.rs` setup closure
  - [ ] Handler filters for floating window labels (starts with `floating-`)
  - [ ] Handler emits `floating-window-closed` event on floating window destroy
  - [ ] Main window close triggers all floating windows to close first

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Rust compilation with window event handler
    Tool: Bash
    Preconditions: lib.rs updated with on_window_event handler
    Steps:
      1. Run `cd src-tauri && cargo check 2>&1`
      2. Assert exit code 0
      3. Run `cd src-tauri && cargo clippy -- -D warnings 2>&1`
      4. Assert exit code 0
    Expected Result: Zero errors, zero warnings
    Failure Indicators: Compilation errors related to window event types
    Evidence: .sisyphus/evidence/task-2-cargo-check.txt

  Scenario: Event handler code exists and is correct
    Tool: Bash (grep)
    Preconditions: lib.rs updated
    Steps:
      1. Run `grep -n 'on_window_event' src-tauri/src/lib.rs`
      2. Assert at least 1 match found
      3. Run `grep -n 'floating-window-closed' src-tauri/src/lib.rs`
      4. Assert at least 1 match found (event emission in handler)
      5. Run `grep -n 'close_all_floating' src-tauri/src/commands/window.rs`
      6. Assert helper function exists
    Expected Result: All grep patterns found
    Failure Indicators: Any grep returning empty
    Evidence: .sisyphus/evidence/task-2-event-handler-check.txt
  ```

  **Evidence to Capture:**
  - [ ] task-2-cargo-check.txt
  - [ ] task-2-event-handler-check.txt

  **Commit**: YES
  - Message: `fix(window): handle OS-level close and main window floating cleanup`
  - Files: `src-tauri/src/lib.rs`, `src-tauri/src/commands/window.rs`
  - Pre-commit: `cd src-tauri && cargo check && cargo clippy -- -D warnings`

---

- [ ] 3. Window ID Uniqueness + Window-State Plugin Configuration

  **What to do**:
  - In `src-tauri/src/commands/window.rs` line 83, change window ID from first 8 chars to full UUID:
    - FROM: `format!("floating-{}", Uuid::new_v4().to_string().split('-').next().unwrap_or("0000"))`
    - TO: `format!("floating-{}", Uuid::new_v4())`
  - In `src-tauri/src/lib.rs` line 141, configure `tauri-plugin-window-state` to exclude floating windows:
    - Research the exact Tauri v2 API: check if `Builder` has `.with_denylist()`, `.skip_initial_state()`, or window label filtering
    - If denylist API exists: use pattern matching to exclude `floating-*` labels
    - If no denylist API: add logic in `on_window_event` (from Task 2) to detect restored phantom floating windows and close them immediately on startup
    - Document the chosen approach with a comment explaining why

  **Must NOT do**:
  - Do NOT remove `tauri-plugin-window-state` entirely — main window needs it
  - Do NOT implement floating window state persistence — just prevent interference

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Needs plugin API research for window-state exclusion
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - All: Pure Rust config work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: None
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `src-tauri/src/commands/window.rs:83` — Current window ID generation (the line to change)
  - `src-tauri/src/lib.rs:141` — Current window-state plugin registration (the line to modify)

  **External References**:
  - `tauri-plugin-window-state` crate docs — check for `with_denylist`, `WindowStateFlags`, label filtering options
  - Cargo.toml line 27: `tauri-plugin-window-state = "2"` — current version

  **WHY Each Reference Matters**:
  - `window.rs:83`: The exact line generating short IDs — needs full UUID
  - `lib.rs:141`: The exact plugin registration — needs exclusion config

  **Acceptance Criteria**:

  - [ ] `cd src-tauri && cargo check` — compiles
  - [ ] Window ID format is now `floating-{full-uuid}` (36 chars after `floating-`)
  - [ ] `tauri-plugin-window-state` does not save/restore state for floating windows

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full UUID in window ID generation
    Tool: Bash (grep)
    Preconditions: window.rs updated
    Steps:
      1. Run `grep -n 'split.*-.*next' src-tauri/src/commands/window.rs`
      2. Assert output is empty (old truncation pattern removed)
      3. Run `grep -n 'Uuid::new_v4()' src-tauri/src/commands/window.rs`
      4. Assert the UUID is used without truncation
    Expected Result: Full UUID used, no truncation
    Failure Indicators: `split('-').next()` still present
    Evidence: .sisyphus/evidence/task-3-uuid-check.txt

  Scenario: Window-state plugin configuration
    Tool: Bash (grep)
    Preconditions: lib.rs updated
    Steps:
      1. Run `grep -A5 'window_state' src-tauri/src/lib.rs`
      2. Assert configuration includes floating window exclusion (denylist, filter, or comment explaining approach)
    Expected Result: Plugin configured to exclude floating windows
    Evidence: .sisyphus/evidence/task-3-plugin-config.txt
  ```

  **Evidence to Capture:**
  - [ ] task-3-uuid-check.txt
  - [ ] task-3-plugin-config.txt

  **Commit**: YES
  - Message: `fix(window): use full UUID and configure window-state plugin`
  - Files: `src-tauri/src/commands/window.rs`, `src-tauri/src/lib.rs`
  - Pre-commit: `cd src-tauri && cargo check`

---

- [ ] 4. Fix Double-Unregister Race + Single Cleanup Path for Floating Window Close

  **What to do**:
  - Remove manual `unregisterFloatingWindow(windowId)` and `removePanel(panelId)` calls from `FloatingWindowContent.handleClose()` (lines 88-96). The close should ONLY call `await windowService.closeFloatingWindow(windowId)` -- the cleanup will happen via the Rust `on_window_event` handler (Task 2) which emits `floating-window-closed`, received by `FloatingWindowRenderer`
  - In `FloatingWindowRenderer.tsx` close event handler (lines 52-59): keep `unregisterFloatingWindow` but change `removePanel` to `setPanelFloating(panelId, false, null)` -- closing a floating window should dock the panel back, not delete it entirely
  - Ensure `handleDock` in `FloatingWindowContent` also goes through the same single cleanup path (call `windowService.closeFloatingWindow` instead of separate state updates)
  - Add null-check guards: if `windowStore.floatingWindows.get(windowId)` returns undefined (already cleaned up), skip cleanup silently -- this handles double-close scenarios

  **Must NOT do**:
  - Do NOT modify the Rust close command logic (that was handled in Task 2)
  - Do NOT change how panels are stored in panelStore -- only change the floating flag
  - Do NOT add new event types

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Careful analysis of event flow between multiple components
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 5)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 6, 7
  - **Blocked By**: Task 2

  **References**:
  - `src/components/floating/FloatingWindowContent.tsx:88-96` -- `handleClose` with manual cleanup (THE CODE TO SIMPLIFY)
  - `src/components/floating/FloatingWindowContent.tsx:57-63` -- `handleDock` (also needs single path)
  - `src/components/floating/FloatingWindowRenderer.tsx:52-59` -- event handler for `floating-window-closed` (keep this as THE cleanup point)
  - `src/stores/panelStore.ts` -- `setPanelFloating` action (use instead of `removePanel` for floating close)
  - `src/stores/windowStore.ts:77-91` -- `unregisterFloatingWindow` (check for idempotency)

  **Acceptance Criteria**:
  - [ ] `FloatingWindowContent.handleClose` only calls `windowService.closeFloatingWindow(windowId)`
  - [ ] No direct `unregisterFloatingWindow` or `removePanel` calls in FloatingWindowContent close handler
  - [ ] `FloatingWindowRenderer` is the SINGLE cleanup point for window close events
  - [ ] Double-close on same windowId does not throw errors
  - [ ] `pnpm test -- --run src/stores/__tests__/panelStore.floating` passes

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Single cleanup path verified
    Tool: Bash (grep)
    Steps:
      1. Run `grep -n 'unregisterFloatingWindow\|removePanel' src/components/floating/FloatingWindowContent.tsx`
      2. Assert: `unregisterFloatingWindow` does NOT appear in handleClose function
      3. Run `grep -n 'closeFloatingWindow' src/components/floating/FloatingWindowContent.tsx`
      4. Assert: appears in handleClose
    Expected Result: handleClose only calls closeFloatingWindow
    Evidence: .sisyphus/evidence/task-4-single-cleanup-path.txt
  ```

  **Commit**: YES
  - Message: `fix(window): single cleanup path for floating window close`
  - Files: `src/components/floating/FloatingWindowContent.tsx`, `src/components/floating/FloatingWindowRenderer.tsx`

---

- [ ] 5. Include Bounds in `floating-window-created` Event

  **What to do**:
  - In `src-tauri/src/commands/window.rs` line 120-124, add bounds to the `floating-window-created` event payload:
    - Add `"x": bounds.x, "y": bounds.y, "width": bounds.width, "height": bounds.height` to the JSON
  - In `src/services/windowService.ts`, update `WindowCreatedPayload` interface to include `x`, `y`, `width`, `height` fields
  - In `src/components/floating/FloatingWindowRenderer.tsx` lines 41-46, replace hardcoded `{x: 0, y: 0, width: 600, height: 400}` with actual bounds from event payload

  **Must NOT do**:
  - Do NOT change the floating-window-closed or floating-window-focused event formats
  - Do NOT modify the Rust command signature

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, well-defined data plumbing across Rust + TS
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 4)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src-tauri/src/commands/window.rs:120-124` -- Current event emission (missing bounds)
  - `src/services/windowService.ts:14-18` -- `WindowCreatedPayload` to update
  - `src/components/floating/FloatingWindowRenderer.tsx:41-46` -- Hardcoded bounds to replace

  **Acceptance Criteria**:
  - [ ] Rust event includes bounds fields
  - [ ] TS payload type matches
  - [ ] FloatingWindowRenderer uses actual bounds from event
  - [ ] `cd src-tauri && cargo check` compiles

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Bounds included in event payload
    Tool: Bash (grep)
    Steps:
      1. Run `grep -A10 'floating-window-created' src-tauri/src/commands/window.rs`
      2. Assert: output contains `"x"` and `"width"` in the JSON payload
      3. Run `grep -n 'x: 0.*y: 0.*width: 600' src/components/floating/FloatingWindowRenderer.tsx`
      4. Assert: output is EMPTY (hardcoded bounds removed)
    Expected Result: Real bounds used everywhere
    Evidence: .sisyphus/evidence/task-5-bounds-in-event.txt
  ```

  **Commit**: YES
  - Message: `fix(window): include bounds in window-created event`
  - Files: `src-tauri/src/commands/window.rs`, `src/services/windowService.ts`, `src/components/floating/FloatingWindowRenderer.tsx`

---

- [ ] 6. Fix StateSync Race Conditions + "Panel Not Found" Loading State

  **What to do**:
  - In `src/components/floating/FloatingWindowContent.tsx`: when `panel` is undefined, show a loading spinner with retry logic -- poll `usePanelStore` every 100ms for up to 3 seconds before showing "Panel not found" error
  - In `src/utils/stateSync.ts` line 112-114: fix the `mergeState` dead code -- when `mergeState` callback is provided, actually call it: `setState(mergeState(currentState, state))` instead of ignoring it. If no merge needed, remove the option entirely to avoid confusion
  - In `src/hooks/useStateSync.ts` lines 154-156: wrap `requestStateFromMain` calls in try-catch with timeout (3 second timeout). If request fails or times out, log warning but don't crash
  - In `stateSync.ts` broadcastState: add a guard for `isActive` check + ensure emit errors are caught (already done at line 94, verify)

  **Must NOT do**:
  - Do NOT redesign the state sync architecture
  - Do NOT add new event channels or sync mechanisms
  - Do NOT change how main window handles state

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Async race conditions require careful analysis
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential after 4, 5)
  - **Parallel Group**: Wave 2 (after Tasks 4, 5 complete)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 4, 5

  **References**:
  - `src/components/floating/FloatingWindowContent.tsx:98-104` -- Current "Panel not found" display (needs loading state)
  - `src/utils/stateSync.ts:110-121` -- `handleStateReceived` with dead `mergeState` code
  - `src/hooks/useStateSync.ts:152-157` -- `requestStateFromMain` calls (need error handling)
  - `src/utils/stateSync.ts:76-97` -- `broadcastState` (verify error handling)

  **Acceptance Criteria**:
  - [ ] Floating window shows loading state before "Panel not found"
  - [ ] `mergeState` dead code is fixed or removed
  - [ ] `requestStateFromMain` has error handling with timeout
  - [ ] `pnpm test -- --run` passes

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Loading state exists in floating window content
    Tool: Bash (grep)
    Steps:
      1. Run `grep -n 'loading\|Loading\|spinner\|Spinner' src/components/floating/FloatingWindowContent.tsx`
      2. Assert: loading indicator code exists
      3. Run `grep -n 'mergeState.*state.*as.*T' src/utils/stateSync.ts`
      4. Assert: dead code pattern is gone (either fixed or removed)
    Expected Result: Loading state added, dead code fixed
    Evidence: .sisyphus/evidence/task-6-loading-and-sync-fix.txt
  ```

  **Commit**: YES
  - Message: `fix(window): resolve state sync race conditions and loading state`
  - Files: `src/utils/stateSync.ts`, `src/hooks/useStateSync.ts`, `src/components/floating/FloatingWindowContent.tsx`

---

- [ ] 7. Fix Close Operation Rollback Protection

  **What to do**:
  - In `src/stores/panelStore.ts` `dockPanel` action: ensure that if `windowService.closeFloatingWindow(windowId)` throws, the panel's `isFloating` state is NOT changed. Use try-catch: attempt close first, only update state on success
  - In `FloatingWindowContent.handleDock` (already simplified in Task 4): verify the dock operation awaits the close before updating UI state
  - Add idempotency: if `windowService.closeFloatingWindow` is called for a window that doesn't exist, catch the "Window not found" error gracefully instead of propagating

  **Must NOT do**:
  - Do NOT change the panel data model
  - Do NOT add undo/redo functionality

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused error handling fix
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (after Task 6)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 4, 6

  **References**:
  - `src/stores/panelStore.ts` -- `dockPanel` action (find via grep for `dockPanel`)
  - `src/stores/__tests__/panelStore.floating.test.ts` -- Existing test that verifies dock failure returns false
  - `src/components/floating/FloatingWindowContent.tsx:57-63` -- `handleDock` callback

  **Acceptance Criteria**:
  - [ ] `dockPanel` catches close failure and does not change panel state
  - [ ] Closing non-existent window is handled gracefully
  - [ ] `pnpm test -- --run src/stores/__tests__/panelStore.floating` passes

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Error handling in dock operation
    Tool: Bash
    Steps:
      1. Run `pnpm test -- --run src/stores/__tests__/panelStore.floating 2>&1`
      2. Assert: all tests pass
    Expected Result: Zero failures
    Evidence: .sisyphus/evidence/task-7-dock-tests.txt
  ```

  **Commit**: YES
  - Message: `fix(window): add close operation rollback protection`
  - Files: `src/stores/panelStore.ts`, `src/components/floating/FloatingWindowContent.tsx`

---

- [ ] 8. Update and Add Comprehensive Tests for All Stabilization Fixes

  **What to do**:
  - Update `src/stores/__tests__/windowStore.test.ts` for any API changes (bounds format from events, etc)
  - Update `src/stores/__tests__/panelStore.floating.test.ts` for changed close behavior (single cleanup path, no direct removePanel on close)
  - Add new test file `src/utils/__tests__/stateSync.test.ts` covering: broadcast filtering, debounce, state request/response, mergeState fix/removal
  - Update `src/test/tauriMocks.ts` if new Tauri APIs are used (scale_factor, on_window_event)
  - Run full test suite and fix any failures

  **Must NOT do**:
  - Do NOT add E2E or Playwright tests
  - Do NOT test unrelated stores or services

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Comprehensive test coverage across multiple files
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after all Wave 2 tasks)
  - **Blocks**: None
  - **Blocked By**: Tasks 4, 5, 6, 7

  **References**:
  - `src/stores/__tests__/windowStore.test.ts` -- Existing window store tests to update
  - `src/stores/__tests__/panelStore.floating.test.ts` -- Existing floating panel tests to update
  - `src/test/tauriMocks.ts` -- Mock setup that may need new APIs
  - `src/utils/stateSync.ts` -- State sync utility to write tests for

  **Acceptance Criteria**:
  - [ ] `pnpm test -- --run` -- ALL tests pass with zero failures
  - [ ] Existing tests updated for API changes
  - [ ] New stateSync tests exist and pass
  - [ ] Test coverage includes: window registration, close cleanup, bounds handling, sync race

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Full test suite passes
    Tool: Bash
    Steps:
      1. Run `pnpm test -- --run 2>&1`
      2. Assert: exit code 0, zero failures
      3. Count test files: `find src -name '*.test.ts' -o -name '*.test.tsx' | wc -l`
      4. Assert: count is >= previous count (no tests deleted)
    Expected Result: All tests pass, no regressions
    Evidence: .sisyphus/evidence/task-8-test-suite.txt
  ```

  **Commit**: YES
  - Message: `test(window): comprehensive tests for window stabilization`
  - Files: `src/stores/__tests__/windowStore.test.ts`, `src/stores/__tests__/panelStore.floating.test.ts`, `src/utils/__tests__/stateSync.test.ts`, `src/test/tauriMocks.ts`
  - Pre-commit: `pnpm test -- --run`
---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `cd src-tauri && cargo clippy -- -D warnings` + `pnpm test -- --run`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (floating window full lifecycle). Test edge cases: rapid create/close, double-close, main window close with floating open. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Task 1**: `fix(window): use logical coordinates in Rust window commands` — `src-tauri/src/commands/window.rs`
- **Task 2**: `fix(window): handle OS-level close and main window floating cleanup` — `src-tauri/src/lib.rs`, `src-tauri/src/commands/window.rs`
- **Task 3**: `fix(window): use full UUID and configure window-state plugin` — `src-tauri/src/commands/window.rs`, `src-tauri/src/lib.rs`
- **Task 4**: `fix(window): single cleanup path for floating window close` — `src/components/floating/FloatingWindowContent.tsx`, `src/components/floating/FloatingWindowRenderer.tsx`
- **Task 5**: `fix(window): include bounds in window-created event` — `src-tauri/src/commands/window.rs`, `src/services/windowService.ts`, `src/components/floating/FloatingWindowRenderer.tsx`
- **Task 6**: `fix(window): resolve state sync race conditions and loading state` — `src/utils/stateSync.ts`, `src/hooks/useStateSync.ts`, `src/components/floating/FloatingWindowContent.tsx`
- **Task 7**: `fix(window): add close operation rollback protection` — `src/stores/panelStore.ts`, `src/components/floating/FloatingWindowContent.tsx`
- **Task 8**: `test(window): comprehensive tests for window stabilization` — `src/stores/__tests__/*.ts`, `src/utils/*.test.ts`

---

## Success Criteria

### Verification Commands
```bash
# All frontend tests pass
pnpm test -- --run

# Rust compiles and passes checks
cd src-tauri && cargo check && cargo clippy -- -D warnings

# No regressions in main window
pnpm test -- --run src/stores/__tests__/windowStore.test.ts
pnpm test -- --run src/stores/__tests__/panelStore.floating.test.ts
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (existing + new)
- [ ] Rust compiles with zero warnings
- [ ] Floating window lifecycle works end-to-end
