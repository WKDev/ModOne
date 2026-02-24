# Learnings — macos-titlebar-restore

## [2026-02-24] Session Start: ses_372db0440ffe8KOMVvfZUfhjSA

### Project Context
- **Tauri v2** macOS app, `/Users/chson/Projects/ModOne`
- **Package manager**: pnpm ALWAYS (never npm)
- **Build command**: `pnpm run build` (tsc + vite) 
- **Rust check**: `cd src-tauri && cargo check`
- **Test command**: `pnpm run test -- --run` → baseline: 662 pass, 1 pre-existing fail (useLadderKeyboardShortcuts)
- **Git state**: HEAD `f4c5a19`, working tree CLEAN

### Platform Detection Pattern
- `IS_MAC` constant defined in `MenuBar.tsx:16` — pattern to reuse everywhere
- `navigator.userAgent.includes('Mac')` OR `import { platform } from '@tauri-apps/api/os'`

### Tauri v2 Key APIs for macOS Titlebar
- `window.set_decorations(true)` — enable native chrome (call programmatically only for macOS)
- `window.set_title_bar_style(TitleBarStyle::Overlay)` — content-under-titlebar
- `window.set_traffic_light_position(LogicalPosition::new(12.0, 12.0))` — position traffic lights
- `window.set_title_bar_hidden_title(true)` — hide macOS title text (MacWindowBar shows it)
- **CRITICAL**: Do NOT set `decorations: true` in `tauri.conf.json` globally — Windows/Linux break

### Root Cause (from Hephaestus session analysis)
- `decorations: false` + custom titlebar = macOS jank ROOT CAUSE (WRY/Tauri issue)
- Fix: `titleBarStyle: "Overlay"` + programmatic `#[cfg(target_os = "macos")]` setup block

### Tauri v2 Native Menu API
- `Menu::with_items()`, `Submenu::with_items()`, `MenuItem::with_id()`
- `app.on_menu_event(|app, event| {...})` — handle menu clicks
- `app.set_menu(menu)` — set the app-level menu (macOS shows it in the system menu bar)
- Menu IDs should match commandRegistry command IDs

### Event Bridge Pattern
- Rust → Frontend: `app_handle.emit("native-menu-command", command_id)` 
- Frontend: `listen("native-menu-command", handler)` via `@tauri-apps/api/event`
- Reference: `src/hooks/useWindowClose.ts` — pattern for Tauri event listener hooks

### Key File Locations
- `src-tauri/src/lib.rs:104-167` — run() + setup() closure
- `src-tauri/tauri.conf.json:13-25` — window config (keep decorations: false)
- `src/components/layout/MenuBar.tsx` — baseMenus (82-293), IS_MAC (line 16), WindowControls render (470-477)
- `src/components/layout/MainLayout.tsx` — unconditional MenuBar render (to add IS_MAC conditional)
- `src/App.tsx` — where to call useMacosNativeMenu()
- `src/hooks/useWindowBoundary.ts:28-85` — refreshBounds + event listeners (add rAF coalescing)
- `src/services/projectDialogService.ts` — project name state

## [2026-02-24] Task 1 completion notes

- Added `#[cfg(target_os = "macos")]` block inside `setup()` in `src-tauri/src/lib.rs`.
- Programmatic macOS override now uses `app.get_webview_window("main").unwrap()`, `set_decorations(true)`, and `set_title_bar_style(TitleBarStyle::Overlay)`.
- Kept `src-tauri/tauri.conf.json` unchanged with `"decorations": false` for Windows/Linux behavior.
- `cargo check` and `pnpm run build` both pass after change.
- In current locked Tauri API, runtime methods `set_traffic_light_position` and `set_title_bar_hidden_title` are not exposed on `WebviewWindow`; these require a follow-up approach if strict traffic-light positioning is needed.

## [2026-02-24] Task 3: useWindowBoundary rAF Coalescing

### Implementation Complete ✅
- **File**: `src/hooks/useWindowBoundary.ts`
- **Pattern**: requestAnimationFrame coalescing with pending retry logic
- **Key refs added**:
  - `rafRef`: tracks scheduled rAF ID (null when idle)
  - `pendingRef`: boolean flag for queued events during rAF execution

### rAF Coalescing Logic
1. **First call**: `refreshBounds()` schedules `requestAnimationFrame()`
2. **Rapid events**: Subsequent calls set `pendingRef = true` and return early
3. **rAF fires**: Executes `doActualRefresh()` (IPC calls), then checks `pendingRef`
4. **Retry if needed**: If `pendingRef` was true, recursively calls `refreshBounds()`
5. **Cleanup**: `cancelAnimationFrame()` on unmount

### Optimization Details
- **Shallow bounds compare**: Only calls `setMainWindowBounds()` if x/y/width/height actually changed
- **IPC reduction**: Coalesces rapid onMoved/onResized events into at most 1 IPC call per animation frame
- **Public API preserved**: `isPointInBounds` and `calculateFloatingWindowPosition` exports unchanged
- **Return type fixed**: Changed `refreshBounds: () => Promise<void>` → `() => void` (non-blocking schedule)

### Build Status
- ✅ `pnpm run build` passed (exit 0)
- ✅ TypeScript compilation clean
- ✅ No new errors introduced
- Evidence: `.sisyphus/evidence/task-3-build.txt`

### Wave 1 Independence
- Task 3 works independently of T1 (lib.rs) and T2 (MenuBar.tsx)
- Ready for parallel execution with other agents


## [2026-02-24] Task 2: MenuBar macOS Guard + Optimize

### Changes Applied to MenuBar.tsx
 **Removed IS_MAC WindowControls block**: macOS uses native traffic lights via Overlay titlebar — custom controls caused double-buttons on macOS
 **onDoubleClick guard**: `IS_MAC ? undefined : handleDragRegionDoubleClick` — OS handles double-click-to-maximize with Overlay
 **toggleMaximize() replaced**: Use explicit `isMaximized()` + `maximize()`/`unmaximize()` for precise control without toggle ambiguity
 **150ms debounce on onResized**: Uses `resizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)` to coalesce rapid resize events before querying `isMaximized()`
 **actionIdRef stale guard**: `const actionId = ++actionIdRef.current; ... if (actionId !== actionIdRef.current) return;` — prevents stale async maximize callbacks from setting wrong state on rapid clicks

### Patterns Confirmed
 `useRef(0)` as incrementing action counter is a clean stale-check pattern (no external libs needed)
 Cleanup of debounce: `if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current)` in the useEffect return
 `ReturnType<typeof setTimeout>` is correct TS type for cross-env timeout handles

### Build & Test
 Build: EXIT 0 (tsc + vite, no new TS errors)
 Tests: 662 pass, 1 fail (pre-existing useLadderKeyboardShortcuts failure unchanged)

## [2026-02-24] Task 4: Native macOS App Menu (Rust)

### Implementation Complete
- Added `src-tauri/src/commands/menu.rs` with `build_macos_menu(app: &tauri::AppHandle)` returning `tauri::menu::Menu<tauri::Wry>`.
- Built 6 top-level submenus mirroring `baseMenus`: `File`, `Edit`, `View`, `Simulation`, `Modbus`, `Help`.
- Mapped command-backed items to existing command IDs used by the command palette (`file.save`, `file.saveAs`, `settings.open`, `view.zoomIn`, `simulation.start`, `modbus.startTcp`, `help.documentation`, etc.).
- Registered module in `src-tauri/src/commands/mod.rs` via `pub mod menu;`.

### lib.rs Integration Pattern
- Inside existing macOS setup block (after titlebar overlay), call:
  - `let menu = build_macos_menu(&app.handle())?;`
  - `app.set_menu(menu)?;`
- Added builder-level `.on_menu_event(...)` bridge that emits `native-menu-command` with `event.id()` to frontend.

### Verification
- `cargo check` passed; evidence saved to `.sisyphus/evidence/task-4-cargo-check.txt`.
- `pnpm run build` passed (vite chunk-size warnings only, non-blocking).
- Grep checks passed for:
  - `pub mod menu` in `src-tauri/src/commands/mod.rs`
  - `native-menu-command` in `src-tauri/src/lib.rs`

## [2026-02-24] Task 5: useMacosNativeMenu Event Bridge Hook

### Implementation Complete ✅
- **File**: `src/hooks/useMacosNativeMenu.ts`
- **Pattern**: Mirrors `useWindowClose.ts` — async `setup()` inside `useEffect`, stores `unlisten`, returns cleanup.
- **Event**: `listen<string>('native-menu-command', ...)` from `@tauri-apps/api/event`
- **Platform guard**: `const IS_MAC = navigator.userAgent.includes('Mac'); if (!IS_MAC) return;`

### Command ID Mapping (Rust menu.rs IDs → JS handlers)
Special service calls (bypass commandRegistry):
- `file.new` → `projectDialogService.requestNewProject()`
- `file.open` → `projectDialogService.requestOpenProject()`
- `file.add.newCanvas/Ladder/Scenario` → `fileDialogService.request*()`
- `file.import.xg5000` → `importService.requestImportXG5000()`
- `file.exit` → `getCurrentWindow().destroy()`
- `view.panel.output/problems/terminal` → `useLayoutStore.getState().setPanelType() + togglePanel()`

Silent no-ops (disabled/informational items):
- `file.recent.none`, `view.layouts.placeholder`, `help.documentation`, `help.about`, `modbus.serverSettings`

Default (commandRegistry.execute(id)):
- All file save/saveAs/saveAll, edit.*, settings.open, view.toggleLeftPanel, view.zoom*, simulation.*, modbus.start/stop*

### Key Rust ID Discrepancies (menu.rs vs. MenuBar.tsx)
- Rust uses `file.new` (not `file.newProject`) and `file.open` (not `file.openProject`)
- Rust uses `settings.open` for Preferences (not `edit.preferences`) — matches commandRegistry ID
- View panel IDs: `view.panel.output`, `view.panel.problems`, `view.panel.terminal`

### Import Path (from src/hooks/)
- `../components/CommandPalette/commandRegistry`
- `../services/projectDialogService`
- `../services/fileDialogService`
- `../services/importService`
- `../stores/layoutStore` (for useLayoutStore.getState())
- `@tauri-apps/api/window` (getCurrentWindow)
- `@tauri-apps/api/event` (listen)

### Build Status
- ✅ `pnpm run build` passed (exit 0, tsc + vite)
- ✅ `grep 'native-menu-command'` matched
- ✅ `grep 'commandRegistry'` matched
- Evidence: `.sisyphus/evidence/task-5-build.txt`

### Note for T6
- Hook is NOT wired into App.tsx yet — T6 will call `useMacosNativeMenu()` there


## Task 6: Create MacWindowBar + Wire MainLayout + App.tsx

### Learnings
 **Tauri Drag Region**: `data-tauri-drag-region` is essential for custom title bars to allow window dragging.
 **MacOS Traffic Lights**: On macOS, the traffic lights (close, minimize, maximize) are overlayed on the top-left. A padding of ~70px (`pl-[70px]`) is required to avoid overlapping with them.
 **Conditional Rendering**: Used `navigator.userAgent.includes('Mac')` to conditionally render the custom `MacWindowBar` on macOS and the standard `MenuBar` on other platforms.
 **Zustand Store Access**: Accessed `projectStore` to display the current project name in the title bar.
 **Native Menu Hook**: Integrated `useMacosNativeMenu` hook in `App.tsx` to ensure the native macOS menu bar is updated.

### Implementation Details
 Created `src/components/layout/MacWindowBar.tsx` with project name display and drag region.
 Modified `src/components/layout/MainLayout.tsx` to switch between `MacWindowBar` and `MenuBar`.
 Modified `src/App.tsx` to initialize the native menu hook.
