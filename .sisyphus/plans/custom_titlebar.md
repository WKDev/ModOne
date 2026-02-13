# Plan: Custom Seamless Titlebar (VS Code Style)

## TL;DR
> **Quick Summary**: Replace the native Windows titlebar with a custom, seamless React-based titlebar integrated into the main application layout.
> 
> **Deliverables**:
> - Updated `tauri.conf.json` to disable native decorations.
> - Enhanced `MenuBar` component acting as the main window titlebar with window controls.
> - Drag regions and window management logic (min/max/close).
> - Platform-aware layout (Mac controls on left, Windows on right).
> - Theme integration via CSS variables.
> 
> **Estimated Effort**: Quick (1-2 files modified)
> **Parallel Execution**: Sequential

---

## Context
User wants a "VS Code-style" seamless titlebar. Currently, the app uses native Windows decorations.
We identified:
- **Framework**: Tauri v2.9.6
- **Frontend**: React 19 + Tailwind CSS
- **Layout**: `MainLayout` -> `MenuBar` (top)
- **Existing**: `FloatingWindowHeader` has custom controls; `MenuBar` does not.
- **Mac Support**: Mac native controls are lost with `decorations: false`. We will implement custom controls on the left for Mac to maintain consistency.
- **Theme**: Titlebar must respect dark mode via CSS variables (`--color-bg-secondary`).
- **Zoom**: Existing `view.zoomIn` command uses `document.body.style.zoom`. Ensure shortcuts (`Ctrl++`, `Ctrl+-`) work globally.

---

## Work Objectives

### Core Objective
Make the titlebar part of the app UI (HTML/CSS) instead of the OS frame.

### Concrete Deliverables
- [x] `src-tauri/tauri.conf.json`: Set `decorations: false`.
- [x] `src/components/layout/MenuBar.tsx`: Add window controls and drag region.
- [x] Ensure Mac compatibility (controls on left) and Theme support (CSS variables).

### Must Have
- [x] Minimize, Maximize/Restore, Close buttons.
- [x] Draggable area (`data-tauri-drag-region`).
- [x] Integrated Menu (File, Edit, etc.) on the left (or right on Mac).
- [x] Theme-aware background (`var(--color-bg-secondary)`).

---

## Verification Strategy

### Agent-Executed QA Scenarios

> **Note**: I cannot visually see the window frame, but I can verify the code changes and element existence.

**Scenario 1: Verify Configuration**
  Tool: `read`
  Steps:
    1. Read `src-tauri/tauri.conf.json`.
    2. Assert `windows[0].decorations` is `false`.
  Status: ✅ PASSED

**Scenario 2: Verify Titlebar UI**
  Tool: `grep`
  Steps:
    1. Search `src/components/layout/MenuBar.tsx` for `data-tauri-drag-region`.
    2. Search for `minimize`, `maximize`, `close` logic.
    3. Search for Lucide icons (`Minus`, `Square`, `X`).
    4. Search for OS detection logic (`navigator.userAgent`).
  Status: ✅ PASSED

---

## TODOs

- [x] 1. **Disable Native Decorations**
  **What to do**:
  - Edit `src-tauri/tauri.conf.json`.
  - Find the main window configuration in `app.windows`.
  - Set `"decorations": false`.
  - Set `"transparent": false` (keep opaque for VS Code style).
  - Add `"shadow": true` (if supported/needed for borderless).

- [x] 2. **Implement Window Controls in MenuBar**
  **What to do**:
  - Modify `src/components/layout/MenuBar.tsx`.
  - Import `Window` from `@tauri-apps/api/window`.
  - Import icons (`Minus`, `Square`, `X`, `Copy` or `Maximize` icon) from `lucide-react`.
  - Add state for `isMaximized` (check on mount/resize).
  - Add handlers: `handleMinimize`, `handleMaximize`, `handleClose`.
  - **Platform Logic**: Detect Mac (`navigator.userAgent`).
  - **Layout**:
    - If Mac: Controls (Left) -> Menus -> Drag Region.
    - If Windows: Menus -> Drag Region -> Controls (Right).
  - **Crucial**: Add `<div className="flex-1" data-tauri-drag-region />` between Menus and Controls to allow dragging.
  - **Theme**: Change `bg-gray-800` to `bg-[var(--color-bg-secondary)]`.
  - Style buttons to match `FloatingWindowHeader` (hover effects, red for close).

  **References**:
  - `src/components/floating/FloatingWindowHeader.tsx` (Reuse logic from here).

---

## Status: ✅ COMPLETE

All tasks completed successfully:
- ✅ Native decorations disabled in Tauri config
- ✅ Window controls implemented in MenuBar component
- ✅ Platform-aware layout (Mac/Windows)
- ✅ Theme integration with CSS variables
- ✅ Drag region for frameless window

**Files Modified:**
1. `src-tauri/tauri.conf.json` - Added `decorations: false`
2. `src/components/layout/MenuBar.tsx` - Added window controls, drag region, and theme support
