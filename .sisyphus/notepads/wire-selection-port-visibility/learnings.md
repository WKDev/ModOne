## [2026-03-09] Session Start

### Current state confirmed (pre-implementation)
- `WireRenderer.ts:49` — `DEFAULT_WIRE_STYLE.color = 0xd0d4da` (light gray, needs to be `0x4a4f57`)
- `PortRenderer.ts:100` — `private _showAll = false;` (needs to be `true`)
- `InteractionController.ts:211` — `this._visuals.setPortsVisible(false);` in cancel() (needs removal)
- `InteractionController.ts:693` — `this._visuals.setPortsVisible(true);` in _startWireDrawing() (needs removal)
- `InteractionController.ts:768` — `this._visuals.setPortsVisible(false);` (another call, needs removal)
- `_startWireSegmentDragging()` — no rubber-band logic, port-connected segments fail in moveWireSegment guard

### Wire-fixes.md was COMPLETED before this plan
- Commits: f6132ca, 8055343, 3ef46b3, aa6600d, ad26326
- Wire segment drag amplification is fixed
- Wire preview orthogonal path is fixed
- `_handleSegmentDraggingMove` now uses incremental delta (NOT absolute positioning as originally planned)
- Still uses `facade.moveWireSegment()` — so rubber-band guard issue still exists

### Key APIs
- `facade.insertEndpointHandle(wireId, 'from'|'to', handles[])` — inserts handles at port endpoint
- `facade.cleanupOverlappingHandles(wireId)` — removes zero-length segments after drag
- `facade.moveWireSegment(wireId, handleA, handleB, delta, isFirstMove)` — existing (still used)

### Guardrails from plan
- DO NOT modify SimulationRenderer.ts or SimulationOverlay.ts
- DO NOT change port circle radius, colors, or stroke style
- DO NOT modify moveWireSegment() in canvasStore
- DO NOT change HitTester segment detection
- DO NOT modify wire auto-routing


### [2026-03-09] Task 1 COMPLETED: Wire color constant change
- File: `src/components/OneCanvas/renderers/WireRenderer.ts` line 49
- Changed: `color: 0xd0d4da` → `color: 0x4a4f57` (light gray → dark gray)
- Verification: lsp_diagnostics shows 0 errors ✓
- Other constants unchanged: selectedColor (0x4dabf7), hoverColor (0x74c0fc), previewColor (0x4dabf7)
- No rendering logic modified — constant-only change
- Ready for commit with Tasks 2 & 3

### [2026-03-09] Task 2 COMPLETED: Port visibility always-on
- File: `src/components/OneCanvas/renderers/PortRenderer.ts`
  - Line 100: Changed `private _showAll = false;` → `private _showAll = true;`
  - Line 117: Added `this._layer.visible = true;` in constructor after `_snapContext` initialization
- File: `src/components/OneCanvas/interaction/InteractionController.ts`
  - Line 211 (cancel() method): Removed `this._visuals.setPortsVisible(false);`
  - Line 693 (_startWireDrawing() method): Removed `this._visuals.setPortsVisible(true);`
  - Line 768 (_handleWireDrawingUp() method): Removed `this._visuals.setPortsVisible(false);`
- Verification: lsp_diagnostics on both files shows 0 errors ✓
- Impact: Port circles now always visible; no longer toggled by interaction state
- setPortsVisible() method definition remains in CanvasHost.tsx (interface + implementations) — not removed
- Ready for commit with Tasks 1 & 3

### Implementation Details (Task 2)
- PortRenderer constructor now initializes with `_showAll = true` and `_layer.visible = true`
- This ensures port circles are always rendered and visible from initialization
- InteractionController no longer toggles port visibility during wire drawing or cancellation
- Port snap highlight behavior (_snapContext) remains unchanged
- All changes verified with lsp_diagnostics: 0 errors on both files ✓

### [2026-03-09] Task 3 COMPLETED: Rubber-band segment drag at port-connected ends
- File: `src/components/OneCanvas/interaction/InteractionController.ts`
  - `_startWireSegmentDragging()` now detects first/last segment drags and injects endpoint handles via `facade.insertEndpointHandle()` when connected endpoint is a port.
  - Added `resolvePortEndpointPosition()` helper to resolve port world coordinates from `facade.components` + `port.absolutePosition`.
  - For first-segment drags, active indices are remapped to `0` and `1` after insertion so `moveWireSegment()` can operate on real handle pairs.
  - For last-segment drags, indices are remapped to the final two handles after insertion so port-side rubber-band bend is movable.
  - Zero-handle wires now get both endpoint handles inserted when dragging the only segment, enabling movement without changing store logic.
  - `_handleSegmentDraggingUp()` now calls `facade.cleanupOverlappingHandles(wireId)` before clearing drag state.
- Constraints respected:
  - `moveWireSegment()` untouched.
  - HitTester logic untouched.
  - No routing/handle-drag behavior changed outside segment-drag setup/teardown.
- Verification: `lsp_diagnostics` on `InteractionController.ts` reports 0 errors ✓

## [2026-03-09] Visual QA Session Results

### Testing Approach
- Attempted Playwright-based visual QA via Vite dev server (http://localhost:7017)
- App requires Tauri native window context (`window.__TAURI_INTERNALS__`) — unavailable in plain browser
- Mocking `__TAURI_INTERNALS__` partially worked but deep Tauri APIs (listen, event system, stateSync) still fail
- React app fails to mount: `root` div remains empty, PixiJS canvas never initializes
- Screenshots captured but show blank white page

### Code Review Verification (High Confidence)

**Wire Color (WireRenderer.ts:48-56)**
- `color: 0x4a4f57` ✅ — dark gray (changed from 0xd0d4da light gray)
- `selectedColor: 0x4dabf7` ✅ — Mantine blue-4

**Port Always Visible (PortRenderer.ts:100, 118)**
- `private _showAll = true;` ✅ — default changed from false to true
- `this._layer.visible = true;` ✅ — constructor explicitly sets layer visible
- InteractionController.ts: zero calls to setPortsVisible() remain ✅

**Rubber-Band Segment Drag (InteractionController.ts:820-877)**
- `isFromConnectedSegment = segHandleA === 0` ✅
- `isToConnectedSegment = segHandleA >= handleCount` ✅
- Calls `facade.insertEndpointHandle(wireId, 'from', [{position: fromPos, constraint: 'free'}])` ✅
- Handle indices properly updated after insertion ✅
- `insertEndpointHandle` fully wired: canvasFacade.ts → canvasStore.ts → useCanvasDocument.ts ✅

### Key Gotcha for Future QA
- **ModOne cannot be tested in plain browser** — always requires `pnpm tauri dev` native window
- Visual canvas (PixiJS WebGL) requires Tauri IPC for project data to render
- For headless visual QA, would need a complete Tauri mock including event system, stateSync, window management

### Final Verdict
Wire Color [PASS] | Port Visibility [PASS] | Rubber-Band [PASS] | VERDICT: APPROVE (code review)
