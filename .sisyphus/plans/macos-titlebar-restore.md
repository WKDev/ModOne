# macOS Native Titlebar & Menu Restoration

## TL;DR

> **Quick Summary**: 직전 세션(Hephaestus)에서 작업했으나 커밋되지 않아 유실된 macOS titlebar 성능 개선을 재적용. `decorations: false` + 커스텀 타이틀바 조합이 macOS 창 jank의 근본 원인이었으며, `titleBarStyle: "Overlay"` + 네이티브 traffic lights + 네이티브 macOS 메뉴 + MacWindowBar로 전환.
> 
> **Deliverables**:
> - macOS에서 `titleBarStyle: Overlay` 기반 네이티브 창 제어 (traffic lights)
> - Rust 네이티브 macOS 앱 메뉴 (commandRegistry 연동)
> - MacWindowBar 컴포넌트 (`ModOne - <프로젝트명>` + 드래그 영역)
> - MenuBar 플랫폼 분기 (Windows/Linux: 기존 유지, macOS: 네이티브)
> - useWindowBoundary rAF 코얼레싱 최적화
> 
> **Estimated Effort**: Short (반나절)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 3 → Task 4 → Task 5 → Task 6

---

## Context

### Original Request
직전 Hephaestus 세션(ses_3730288c8ffeQHFe4GcoKqHQEJ)에서 macOS 창 최대화/최소화/resize 동작이 매끄럽지 않은 문제를 분석하고 해결함. 사용자가 작동 확인했으나 변경 사항이 커밋되지 않은 채 후속 세션에서 유실됨. 동일 수정 재적용 요청.

### Interview Summary
**Key Discussions**:
- Phase 1 (useWindowBoundary rAF 코얼레싱): 사용자가 "전혀 개선된 바 없다" 피드백 → 하지만 best practice라 유지
- Phase 2 (네이티브 타이틀바 전환): "이제 좀 제대로 되었는데" — 근본 원인 해결 확인
- Phase 3 (네이티브 macOS 메뉴): 메뉴는 macOS 상단 상태바 활용 요청
- Phase 4 (MacWindowBar): "상단바를 통으로 날려버리면 안 됨" — 드래그 바 + 프로그램명/프로젝트명 필요

**Research Findings**:
- `decorations: false` + 커스텀 타이틀바 = macOS jank 근본 원인 (Tauri/WRY 이슈 확인)
- `titleBarStyle: "Overlay"` + 네이티브 traffic lights = 프로덕션 권장 패턴
- Tauri v2에서 `trafficLightPosition`은 programmatic API로 설정이 더 안정적

### Metis Review
**Identified Gaps** (addressed):
- **CRITICAL**: 크로스플랫폼 window config — `decorations: true`를 전역 적용하면 Windows/Linux에서 이중 타이틀바 발생 → **해결**: macOS에서만 programmatic하게 `#[cfg(target_os = "macos")]`로 적용
- Phase 1 skip 여부 — 사용자가 "효과 없다" 했지만 best practice이므로 유지 (Metis 동의)
- 네이티브 메뉴 항목과 JS 메뉴 항목 동기화 divergence 위험 → 명시적 매핑 필요
- `tauri-plugin-window-state`와 titlebar 변경 충돌 가능성 → fresh state 테스트 필요

---

## Work Objectives

### Core Objective
macOS에서 네이티브 타이틀바(Overlay) + 네이티브 메뉴 + MacWindowBar로 전환하여 창 제어 jank를 해결하고, Windows/Linux 동작은 100% 보존한다.

### Concrete Deliverables
- `src-tauri/tauri.conf.json` — macOS 전용 설정은 programmatic 처리
- `src-tauri/src/lib.rs` — macOS 네이티브 타이틀바 + 메뉴 setup
- `src-tauri/src/commands/menu.rs` — 신규: Rust 네이티브 macOS 메뉴 빌더
- `src/components/layout/MenuBar.tsx` — macOS 플랫폼 가드 + 최적화
- `src/hooks/useWindowBoundary.ts` — rAF 코얼레싱 최적화
- `src/hooks/useMacosNativeMenu.ts` — 신규: 네이티브 메뉴 이벤트 브리지
- `src/components/layout/MacWindowBar.tsx` — 신규: macOS 타이틀 바
- `src/components/layout/MainLayout.tsx` — 플랫폼 조건부 렌더링
- `src/App.tsx` — useMacosNativeMenu 훅 연결

### Definition of Done
- [ ] `pnpm run build` — 0 errors
- [ ] `cd src-tauri && cargo check` — 0 errors
- [ ] `pnpm run test` — no new failures (662 pass, 1 pre-existing fail 유지)
- [ ] macOS: `tauri.conf.json`에 `decorations: false` 유지 (programmatic override)
- [ ] 신규 파일 3개 존재: `menu.rs`, `useMacosNativeMenu.ts`, `MacWindowBar.tsx`

### Must Have
- macOS에서 네이티브 traffic lights (닫기/최소화/최대화) 동작
- macOS에서 네이티브 메뉴바 (File, Edit, View, Simulation, Modbus, Help)
- macOS 인앱 타이틀바에 `ModOne - <프로젝트명>` 표시 + 드래그 영역
- Windows/Linux에서 기존 커스텀 MenuBar + WindowControls 100% 보존
- 네이티브 메뉴 클릭 → commandRegistry 연동

### Must NOT Have (Guardrails)
- ❌ `tauri.conf.json`에서 `decorations: true`로 전역 변경 (Windows/Linux 깨짐)
- ❌ Windows/Linux MenuBar 렌더링 변경
- ❌ 플로팅 윈도우 동작 변경
- ❌ 기존 commandRegistry 구조 변경
- ❌ 메뉴 항목 추가/제거 (기존 baseMenus 그대로 미러링만)
- ❌ 새로운 npm 의존성 추가

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest, 기존 테스트 28개 파일)
- **Automated tests**: NO (이 작업은 주로 config/UI 변경이라 unit test 불필요)
- **Framework**: vitest (기존 테스트 regression 검증만)

### QA Policy
Every task MUST include agent-executed QA scenarios.
- **Build check**: `pnpm run build` — 0 errors
- **Rust check**: `cd src-tauri && cargo check` — 0 errors
- **Test regression**: `pnpm run test -- --run` — no new failures
- **File verification**: grep/read로 변경 사항 확인

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — no dependencies, PARALLEL):
├── Task 1: macOS native titlebar setup in Rust [deep]
├── Task 2: Guard MenuBar for macOS + optimize [unspecified-high]
└── Task 3: Optimize useWindowBoundary with rAF coalescing [quick]

Wave 2 (After Wave 1 — native menu, SEQUENTIAL):
├── Task 4: Create Rust native macOS app menu (depends: 1) [deep]
└── Task 5: Create useMacosNativeMenu hook (depends: 4) [unspecified-high]

Wave 3 (After Wave 2 — UI + wiring):
├── Task 6: Create MacWindowBar + wire MainLayout + App.tsx (depends: 2, 5) [visual-engineering]
└── Task 7: Final verification and commit (depends: 6) [quick]

Wave FINAL (After ALL tasks — review):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Cross-platform QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 4 → Task 5 → Task 6 → Task 7
Parallel Speedup: ~30% (Wave 1 parallelizes Tasks 1+2+3)
Max Concurrent: 3 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 4, 6 | 1 |
| 2 | — | 6 | 1 |
| 3 | — | — | 1 |
| 4 | 1 | 5 | 2 |
| 5 | 4 | 6 | 2 |
| 6 | 2, 5 | 7 | 3 |
| 7 | 6 | F1-F4 | 3 |
| F1-F4 | 7 | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: **3 tasks** — T1 → `deep`, T2 → `unspecified-high`, T3 → `quick`
- **Wave 2**: **2 tasks** — T4 → `deep`, T5 → `unspecified-high`
- **Wave 3**: **2 tasks** — T6 → `visual-engineering`, T7 → `quick`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs


- [x] 1. macOS Native Titlebar Setup in Rust

  **What to do**:
  - In `src-tauri/src/lib.rs` `setup()` closure: Add `#[cfg(target_os = "macos")]` block that:
    1. Gets the main window via `app.get_webview_window("main")`
    2. Calls `set_decorations(true)` to enable native chrome on macOS only
    3. Sets `title_bar_style(TitleBarStyle::Overlay)` for content-under-titlebar
    4. Sets `set_traffic_light_position(LogicalPosition::new(12.0, 12.0))` for proper traffic light placement
    5. Optionally sets `set_title_bar_hidden_title(true)` to hide the window title text (MacWindowBar shows it instead)
  - Keep `tauri.conf.json` `decorations: false` unchanged — this is the default for Windows/Linux
  - Add necessary imports: `use tauri::TitleBarStyle;` and platform-conditional imports

  **Must NOT do**:
  - ❌ Change `decorations` in `tauri.conf.json` (would break Windows/Linux)
  - ❌ Modify floating window creation logic
  - ❌ Change any existing command registrations

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 6
  - **Blocked By**: None

  **References**:
  - `src-tauri/src/lib.rs:104-167` — Current `run()` function with `setup()` closure
  - `src-tauri/tauri.conf.json:13-25` — Current window config (`decorations: false`, `shadow: true`)
  - `src-tauri/src/commands/window.rs:100` — Floating window creation (DO NOT TOUCH)
  - Tauri v2 docs: `WebviewWindow::set_title_bar_style()`, `set_traffic_light_position()`

  **Acceptance Criteria**:
  - [ ] `cd src-tauri && cargo check` — 0 errors
  - [ ] `pnpm run build` — 0 errors
  - [ ] `grep 'decorations.*false' src-tauri/tauri.conf.json` — still matches (not changed)
  - [ ] `grep 'TitleBarStyle\|title_bar_style\|Overlay' src-tauri/src/lib.rs` — matches found
  - [ ] `grep 'cfg.*target_os.*macos' src-tauri/src/lib.rs` — platform guard exists

  **QA Scenarios:**
  ```
  Scenario: Rust compilation succeeds with macOS titlebar setup
    Tool: Bash
    Steps:
      1. Run `cd src-tauri && cargo check 2>&1`
      2. Assert exit code 0
      3. Run `pnpm run build 2>&1`
      4. Assert exit code 0
    Expected Result: Both commands exit 0 with no errors
    Evidence: .sisyphus/evidence/task-1-cargo-check.txt

  Scenario: tauri.conf.json NOT globally changed
    Tool: Bash
    Steps:
      1. Run `grep 'decorations' src-tauri/tauri.conf.json`
      2. Assert output contains 'false'
    Expected Result: `decorations: false` still present
    Evidence: .sisyphus/evidence/task-1-config-check.txt
  ```

  **Commit**: YES (groups with all tasks)
  - Message: `feat(macos): restore native titlebar and menu for smooth window behavior`

---

- [x] 2. Guard MenuBar for macOS Platform + Optimize

  **What to do**:
  - In `MenuBar.tsx`:
    1. Remove macOS-specific `WindowControls` rendering (lines 470-477, `IS_MAC && <WindowControls .../>`) — macOS now uses native traffic lights
    2. On macOS, disable drag-region `onDoubleClick` handler (line 519) — the OS handles this natively with Overlay
    3. Replace `toggleMaximize()` (line 320) with explicit `isMaximized()` check → `maximize()`/`unmaximize()` flow
    4. Replace immediate `isMaximized()` call in `onResized` handler (line 354) with 150ms debounce
    5. Add action-id based stale reconcile defense for rapid consecutive maximize/minimize clicks
  - Keep all Windows/Linux behavior unchanged — `!IS_MAC && <WindowControls .../>` still renders

  **Must NOT do**:
  - ❌ Remove MenuBar component entirely
  - ❌ Change menu item definitions (baseMenus array)
  - ❌ Change Windows/Linux WindowControls rendering

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:
  - `src/components/layout/MenuBar.tsx:16` — `IS_MAC` platform detection constant
  - `src/components/layout/MenuBar.tsx:35-61` — WindowControls component
  - `src/components/layout/MenuBar.tsx:310-335` — handleMinimize/handleMaximize/handleClose
  - `src/components/layout/MenuBar.tsx:344-372` — useEffect for isMaximized sync via onResized
  - `src/components/layout/MenuBar.tsx:470-477` — Mac WindowControls render (REMOVE)
  - `src/components/layout/MenuBar.tsx:516-520` — Drag region with onDoubleClick
  - `src/components/layout/MenuBar.tsx:523-530` — Windows/Linux WindowControls render (KEEP)

  **Acceptance Criteria**:
  - [ ] `pnpm run build` — 0 errors
  - [ ] `grep -c 'IS_MAC.*WindowControls' src/components/layout/MenuBar.tsx` — returns 0 (removed)
  - [ ] `grep 'IS_MAC.*WindowControls\|!IS_MAC.*WindowControls' src/components/layout/MenuBar.tsx` — only `!IS_MAC` variant exists
  - [ ] `grep -c 'toggleMaximize' src/components/layout/MenuBar.tsx` — returns 0 (replaced)

  **QA Scenarios:**
  ```
  Scenario: MenuBar builds without mac WindowControls
    Tool: Bash
    Steps:
      1. Run `pnpm run build`
      2. Assert exit code 0
      3. Run `grep -n 'IS_MAC' src/components/layout/MenuBar.tsx`
      4. Verify no line renders WindowControls for IS_MAC (only !IS_MAC)
    Expected Result: Build passes, only !IS_MAC WindowControls exists
    Evidence: .sisyphus/evidence/task-2-menubar-guard.txt
  ```

  **Commit**: YES (groups with all tasks)

---

- [x] 3. Optimize useWindowBoundary with rAF Coalescing

  **What to do**:
  - In `useWindowBoundary.ts`:
    1. Add `requestAnimationFrame` coalescing for `onMoved`/`onResized` callbacks
    2. Add in-flight request tracking — don't call `outerPosition()`/`innerSize()` if a previous call is still pending
    3. Add queued flag — if events arrive while in-flight, queue ONE refresh (not every event)
    4. Only call `setMainWindowBounds()` when bounds actually changed (shallow compare x/y/width/height)
  - This reduces IPC backlog during rapid window resize/move

  **Must NOT do**:
  - ❌ Change the public API of `useWindowBoundary` hook
  - ❌ Remove any exports (`isPointInBounds`, `calculateFloatingWindowPosition`)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/hooks/useWindowBoundary.ts:28-52` — Current `refreshBounds` without coalescing
  - `src/hooks/useWindowBoundary.ts:55-85` — Current useEffect with `onMoved`/`onResized` listeners

  **Acceptance Criteria**:
  - [ ] `pnpm run build` — 0 errors
  - [ ] `grep 'requestAnimationFrame\|rAF\|inFlight\|queued' src/hooks/useWindowBoundary.ts` — coalescing patterns found

  **QA Scenarios:**
  ```
  Scenario: useWindowBoundary builds with optimization
    Tool: Bash
    Steps:
      1. Run `pnpm run build`
      2. Assert exit code 0
    Expected Result: Build passes
    Evidence: .sisyphus/evidence/task-3-build.txt
  ```

  **Commit**: YES (groups with all tasks)

---

- [x] 4. Create Rust Native macOS App Menu

  **What to do**:
  - Create `src-tauri/src/commands/menu.rs` with:
    1. `pub fn build_macos_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>>` function
    2. Menu items mirroring JS `baseMenus` array in `MenuBar.tsx:82-293`:
       - File: New Project, Open Project, Save, Save As, Save All, Add (New Canvas/Ladder/Scenario), Import (XG5000), Recent Projects, Exit
       - Edit: Undo, Redo, Cut, Copy, Paste, Preferences
       - View: Toggle Sidebar, Toggle Panel (Output/Problems/Terminal), Layouts, Zoom In/Out
       - Simulation: Start, Stop, Pause, Step, Reset
       - Modbus: Server Settings, Start/Stop TCP, Start/Stop RTU, Connection Status
       - Help: Documentation, About
    3. Use Tauri v2 menu API: `Menu::with_items()`, `Submenu::with_items()`, `MenuItem::with_id()`
    4. Menu item IDs should match `commandRegistry` command IDs (e.g., `"file.save"`, `"simulation.start"`)
  - In `src-tauri/src/commands/mod.rs`: Add `pub mod menu;`
  - In `src-tauri/src/lib.rs`:
    1. Inside the `#[cfg(target_os = "macos")]` setup block: Build menu via `build_macos_menu()` and set on app
    2. Add `on_menu_event` handler that emits `"native-menu-command"` event to frontend with menu item ID
  - Wrap all menu code in `#[cfg(target_os = "macos")]`

  **Must NOT do**:
  - ❌ Add menu items not in the current JS baseMenus
  - ❌ Change any existing Rust command registrations
  - ❌ Modify `invoke_handler` list

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:
  - `src/components/layout/MenuBar.tsx:82-293` — JS `baseMenus` array (THE source of truth for menu items)
  - `src-tauri/src/commands/mod.rs` — Commands module index (add `pub mod menu;`)
  - `src-tauri/src/lib.rs:138-167` — Builder chain where menu should be registered
  - `src/components/CommandPalette/commandRegistry.ts` — Command IDs for mapping
  - Tauri v2 menu API: `tauri::menu::{Menu, Submenu, MenuItem, PredefinedMenuItem}`

  **Acceptance Criteria**:
  - [ ] `test -f src-tauri/src/commands/menu.rs` — file exists
  - [ ] `cd src-tauri && cargo check` — 0 errors
  - [ ] `grep 'pub mod menu' src-tauri/src/commands/mod.rs` — module registered
  - [ ] `grep 'native-menu-command' src-tauri/src/lib.rs` — event emission exists

  **QA Scenarios:**
  ```
  Scenario: Rust native menu compiles and registers
    Tool: Bash
    Steps:
      1. Run `cd src-tauri && cargo check 2>&1`
      2. Assert exit code 0
      3. Verify `menu.rs` contains File/Edit/View/Simulation/Modbus/Help submenus
    Expected Result: Cargo check passes, all 6 menu sections present
    Evidence: .sisyphus/evidence/task-4-cargo-check.txt
  ```

  **Commit**: YES (groups with all tasks)

---

- [x] 5. Create useMacosNativeMenu Event Bridge Hook

  **What to do**:
  - Create `src/hooks/useMacosNativeMenu.ts`:
    1. Import `listen` from `@tauri-apps/api/event`
    2. Listen for `"native-menu-command"` events
    3. Map received menu item IDs to actions:
       - Direct `commandRegistry.execute(commandId)` calls for most items
       - Special cases: `"file.newProject"` → `projectDialogService.requestNewProject()`, `"file.openProject"` → `projectDialogService.requestOpenProject()`, etc.
    4. Return cleanup unlisten function in useEffect
  - Follow pattern of `src/hooks/useWindowClose.ts` (event listener + cleanup)
  - Only activate on macOS (`if (!IS_MAC) return;` early exit)

  **Must NOT do**:
  - ❌ Modify commandRegistry itself
  - ❌ Add new service files

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (after Task 4)
  - **Blocks**: Task 6
  - **Blocked By**: Task 4

  **References**:
  - `src/hooks/useWindowClose.ts` — Pattern reference for Tauri event listener hooks
  - `src/components/CommandPalette/commandRegistry.ts` — `commandRegistry.execute()` API
  - `src/services/projectDialogService.ts` — `requestNewProject()`, `requestOpenProject()`
  - `src/services/fileDialogService.ts` — `requestNewCanvas()`, `requestNewLadder()`, `requestNewScenario()`
  - `src/components/layout/MenuBar.tsx:82-293` — Menu item actions (the JS implementations to mirror)

  **Acceptance Criteria**:
  - [ ] `test -f src/hooks/useMacosNativeMenu.ts` — file exists
  - [ ] `pnpm run build` — 0 errors
  - [ ] `grep 'native-menu-command' src/hooks/useMacosNativeMenu.ts` — event name present
  - [ ] `grep 'commandRegistry' src/hooks/useMacosNativeMenu.ts` — command execution present

  **QA Scenarios:**
  ```
  Scenario: Hook compiles and bridges events
    Tool: Bash
    Steps:
      1. Run `pnpm run build`
      2. Assert exit code 0
      3. Verify hook listens for native-menu-command and calls commandRegistry
    Expected Result: Build passes, hook correctly bridges events
    Evidence: .sisyphus/evidence/task-5-build.txt
  ```

  **Commit**: YES (groups with all tasks)

---

- [x] 6. Create MacWindowBar + Wire MainLayout + App.tsx

  **What to do**:
  - Create `src/components/layout/MacWindowBar.tsx`:
    1. Display `ModOne - <projectName>` centered (with `*` when modified)
    2. Set entire bar as `data-tauri-drag-region` for window dragging
    3. Left padding ~70px to avoid overlapping native traffic lights
    4. Height matches existing MenuBar (h-8, 32px)
    5. Style: `bg-[var(--color-bg-secondary)]`, `border-b border-[var(--color-border)]`, matching existing theme
    6. Get project name from existing store (check `projectDialogService` or relevant store)
  - In `MainLayout.tsx`:
    1. Add `const IS_MAC = navigator.userAgent.includes('Mac');`
    2. Conditional render: `{IS_MAC ? <MacWindowBar /> : <MenuBar />}`
    3. Import both components
  - In `App.tsx`:
    1. Import `useMacosNativeMenu` from `src/hooks/useMacosNativeMenu`
    2. Call `useMacosNativeMenu()` inside the main app component (likely `MainWindowContent` or similar)

  **Must NOT do**:
  - ❌ Remove MenuBar component or its file
  - ❌ Change Toolbar/StatusBar rendering
  - ❌ Add new state management for project name (use existing)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 2, 5

  **References**:
  - `src/components/layout/MainLayout.tsx` — Current layout (unconditional MenuBar render)
  - `src/components/layout/MenuBar.tsx:16` — `IS_MAC` detection pattern to reuse
  - `src/components/layout/MenuBar.tsx:467` — Current header structure
  - `src/App.tsx` — Where to connect useMacosNativeMenu hook
  - `src/services/projectDialogService.ts` — Project name state source
  - `src/components/floating/FloatingWindowHeader.tsx` — Reference for similar header component pattern

  **Acceptance Criteria**:
  - [ ] `test -f src/components/layout/MacWindowBar.tsx` — file exists
  - [ ] `pnpm run build` — 0 errors
  - [ ] `grep 'MacWindowBar' src/components/layout/MainLayout.tsx` — imported and used
  - [ ] `grep 'IS_MAC' src/components/layout/MainLayout.tsx` — platform conditional exists
  - [ ] `grep 'useMacosNativeMenu' src/App.tsx` — hook connected

  **QA Scenarios:**
  ```
  Scenario: MacWindowBar renders and MainLayout conditionally switches
    Tool: Bash
    Steps:
      1. Run `pnpm run build`
      2. Assert exit code 0
      3. Verify MainLayout has IS_MAC conditional
      4. Verify MacWindowBar has data-tauri-drag-region
      5. Verify App.tsx calls useMacosNativeMenu
    Expected Result: Build passes, all wiring in place
    Evidence: .sisyphus/evidence/task-6-build.txt
  ```

  **Commit**: YES (groups with all tasks)

---

- [ ] 7. Final Verification and Commit

  **What to do**:
  - Run full verification:
    1. `pnpm run build` — must pass
    2. `cd src-tauri && cargo check` — must pass
    3. `pnpm run test -- --run` — no new failures (662 pass, 1 pre-existing)
    4. Verify all 3 new files exist
    5. Verify `tauri.conf.json` still has `decorations: false`
    6. Verify `MainLayout.tsx` has platform conditional
  - Create single atomic commit:
    `feat(macos): restore native titlebar and menu for smooth window behavior`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 6)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 6

  **References**:
  - All files modified in Tasks 1-6

  **Acceptance Criteria**:
  - [ ] All verification commands pass
  - [ ] Commit created successfully
  - [ ] `git log -1 --oneline` shows the commit

  **QA Scenarios:**
  ```
  Scenario: Full build + test + commit
    Tool: Bash
    Steps:
      1. Run `pnpm run build` — assert exit 0
      2. Run `cd src-tauri && cargo check` — assert exit 0
      3. Run `pnpm run test -- --run` — assert 662 pass
      4. Create commit
    Expected Result: All pass, commit created
    Evidence: .sisyphus/evidence/task-7-final.txt
  ```

  **Commit**: YES
  - Message: `feat(macos): restore native titlebar and menu for smooth window behavior`
  - Files: all changed/new files from Tasks 1-6
---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check all deliverables.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm run build` + `cargo check` + `pnpm run test`. Review all changed/new files for type safety, error handling, unused imports. Check for AI slop.
  Output: `Build [PASS/FAIL] | Cargo [PASS/FAIL] | Tests [N pass/N fail] | VERDICT`

- [ ] F3. **Cross-Platform QA** — `unspecified-high`
  Verify: (1) `tauri.conf.json` still has `decorations: false` (not globally changed), (2) MenuBar.tsx still renders WindowControls for non-Mac, (3) MainLayout conditionally renders MacWindowBar vs MenuBar, (4) No `#[cfg(target_os = "macos")]` leaks outside menu/titlebar setup.
  Output: `Platform checks [N/N pass] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 compliance. Check "Must NOT do". Detect unaccounted changes.
  Output: `Tasks [N/N compliant] | VERDICT`

---

## Commit Strategy

- **Single atomic commit after all tasks**: `feat(macos): restore native titlebar and menu for smooth window behavior`
  - Files: tauri.conf.json, lib.rs, menu.rs, mod.rs, MenuBar.tsx, useWindowBoundary.ts, useMacosNativeMenu.ts, MacWindowBar.tsx, MainLayout.tsx, App.tsx
  - Pre-commit: `pnpm run build && cd src-tauri && cargo check`

---

## Success Criteria

### Verification Commands
```bash
pnpm run build                    # Expected: 0 errors
cd src-tauri && cargo check       # Expected: 0 errors
pnpm run test -- --run            # Expected: 662 pass, 1 pre-existing fail
test -f src-tauri/src/commands/menu.rs   # Expected: exists
test -f src/hooks/useMacosNativeMenu.ts  # Expected: exists
test -f src/components/layout/MacWindowBar.tsx  # Expected: exists
grep 'decorations.*false' src-tauri/tauri.conf.json  # Expected: still false (not globally changed)
grep 'MacWindowBar\|IS_MAC' src/components/layout/MainLayout.tsx  # Expected: match found
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] macOS: native Overlay titlebar with traffic lights
- [ ] macOS: native app menu mirroring baseMenus
- [ ] macOS: MacWindowBar with project name + drag region
- [ ] Windows/Linux: unchanged MenuBar + WindowControls
- [ ] Build + Cargo + Tests all pass
