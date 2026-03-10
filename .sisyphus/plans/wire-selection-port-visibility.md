# Wire Selection Visual + Port Visibility + Rubber-Band Segment Drag

## TL;DR

> **Quick Summary**: Improve wire selection color contrast, make symbol ports always visible, and fix port-connected wire segment dragging with rubber-band behavior.
> 
> **Deliverables**:
> - Darker default wire color for clear selected/unselected distinction
> - Port circles always rendered on all blocks (EDA standard)
> - Port-connected wire segments draggable with automatic new-segment creation
> 
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Tasks 1-3 (parallel) → F1-F3 (parallel verification)

---

## Context

### Original Request
유저가 wire를 클릭하거나 drag selection box 안에 들어왔을 때 활성화/비활성화를 wire 색상으로 구분할 수 있게 하고, symbol의 port를 상시 표시되게 하라.

### Interview Summary
**Key Discussions**:
- **Wire color**: 기본 wire 색상(0xd0d4da)과 선택 색상(0x4dabf7)의 대비가 약함 → 기본색을 더 어둡게 (~0x555555)
- **Port visibility**: 현재 wire-drawing mode에서만 port 보임 → 항상 표시 (EDA 표준)
- **Wire segment drag bug**: port에 연결된 선분은 드래그 불가 → rubber-band 방식으로 새 선분 생성
- **Test strategy**: 단위 테스트 없이 시각적 QA로 검증

**Research Findings**:
- `WireRenderer.ts`: PixiJS Graphics 기반, `DEFAULT_WIRE_STYLE.color = 0xd0d4da`로 대비 약함
- `PortRenderer.ts`: `_showAll = false` 기본값, `setShowAll()` → `_layer.visible` 토글
- `InteractionController.ts`: `wire_segment_dragging` 상태에서 `moveWireSegment()` 호출하지만 port-connected segment는 handle이 없어서 실패
- `canvasStore.ts`: `moveWireSegment()`는 기존 handle만 이동 — handle이 없으면 무시
- `insertEndpointHandle()` facade 메서드가 이미 존재 — rubber-band 구현에 활용 가능

---

## Work Objectives

### Core Objective
OneCanvas의 wire 선택 시각 피드백을 강화하고, port를 상시 표시하고, port-connected wire segment의 rubber-band 드래그를 구현한다.

### Concrete Deliverables
- `WireRenderer.ts`: 더 어두운 기본 wire 색상
- `PortRenderer.ts`: port layer 항상 visible
- `InteractionController.ts`: port-connected segment 드래그 시 rubber-band handle 삽입

### Definition of Done
- [ ] 캔버스에서 wire 미선택 vs 선택 상태의 색상 차이가 뚜렷하게 구분됨
- [ ] 모든 블록의 port circle이 wire-drawing mode가 아닐 때도 항상 보임
- [ ] port에 연결된 wire 선분을 수직 방향으로 드래그하면 새로운 bend가 생성됨
- [ ] `pnpm run build` 성공

### Must Have
- Wire 기본색 어둡게 변경 (selected color와 명확한 대비)
- Port circle 상시 렌더링
- Port-connected segment rubber-band 드래그

### Must NOT Have (Guardrails)
- Simulation overlay의 wire 색상 로직 변경 금지 (SimulationRenderer.ts는 별도 색상 시스템)
- Port 크기/스타일 변경 금지 (기존 PortStyle 유지)
- Wire routing algorithm (pathFinder) 변경 금지
- 기존 wire_handle_dragging 동작 변경 금지
- Box selection 로직 변경 금지 (이미 정상 동작)

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **Automated tests**: None (rendering + interaction 변경, 시각적 QA가 더 적절)
- **Framework**: vitest (사용 안 함)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **Verification**: `pnpm run build` — 빌드 성공 확인

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — all 3 tasks are independent):
├── Task 1: Wire selection color contrast [quick]
├── Task 2: Port always visible [quick]
└── Task 3: Port-connected segment rubber-band drag [deep]

Wave FINAL (After ALL tasks):
├── Task F1: Build verification [quick]
├── Task F2: Visual QA — wire selection [unspecified-high]
└── Task F3: Visual QA — port visibility + segment drag [unspecified-high]

Critical Path: Tasks 1-3 (parallel) → F1-F3 (parallel)
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 3 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1    | —         | F1, F2 |
| 2    | —         | F1, F3 |
| 3    | —         | F1, F3 |
| F1   | 1, 2, 3   | —      |
| F2   | 1         | —      |
| F3   | 2, 3      | —      |

### Agent Dispatch Summary

- **Wave 1**: **3** — T1 → `quick`, T2 → `quick`, T3 → `deep`
- **FINAL**: **3** — F1 → `quick`, F2 → `unspecified-high` + `playwright`, F3 → `unspecified-high` + `playwright`

---

## TODOs

- [x] 1. Wire Selection Color Contrast

  **What to do**:
  - In `src/components/OneCanvas/renderers/WireRenderer.ts`, change `DEFAULT_WIRE_STYLE.color` from `0xd0d4da` (light gray) to `0x4a4f57` (dark gray) for clear contrast against the white canvas background
  - Keep `selectedColor` at `0x4dabf7` (blue) — this already works
  - Keep `hoverColor` at `0x74c0fc` (lighter blue) — this already works
  - Verify `_renderWire()` method correctly applies color based on `isSelected` / `isHovered` state (currently working)
  - Note: `_renderWire()` draws the actual color directly via `g.stroke({ color, width })` and resets `g.tint = 0xffffff`, so changing `DEFAULT_WIRE_STYLE.color` is sufficient

  **Must NOT do**:
  - Do NOT modify SimulationRenderer.ts or SimulationOverlay.ts wire coloring
  - Do NOT change selectedColor or hoverColor values
  - Do NOT alter wire rendering logic beyond the color constant

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single constant change in one file
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: F1, F2
  - **Blocked By**: None

  **References**:
  - `src/components/OneCanvas/renderers/WireRenderer.ts:48-56` — `DEFAULT_WIRE_STYLE` object with current color constants. THE only place to change.
  - `src/components/OneCanvas/renderers/WireRenderer.ts:229-271` — `_renderWire()` method showing how style colors are applied. Confirms no other override needed.

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Selected wire clearly distinct from unselected
    Tool: Playwright
    Preconditions: App running, circuit with multiple wires
    Steps:
      1. Navigate to schematic canvas
      2. Click on a wire to select it
      3. Screenshot canvas showing selected (blue) vs unselected (dark gray) wires
    Expected Result: Selected wire is bright blue (#4dabf7), unselected wires are dark gray (#4a4f57)
    Failure Indicators: Colors look similar or indistinguishable
    Evidence: .sisyphus/evidence/task-1-wire-selected-contrast.png
  ```

  **Commit**: YES (groups with Tasks 2, 3)
  - Message: `feat(canvas): enhance wire selection contrast, always-visible ports, rubber-band segment drag`
  - Files: `src/components/OneCanvas/renderers/WireRenderer.ts`
  - Pre-commit: `pnpm run build`

- [x] 2. Port Always Visible

  **What to do**:
  - In `src/components/OneCanvas/renderers/PortRenderer.ts`:
    - Change `private _showAll = false;` (line 100) to `private _showAll = true;`
    - In the constructor, after `this._snapContext = ...` (line 116), add `this._layer.visible = true;`
  - In `src/components/OneCanvas/interaction/InteractionController.ts`:
    - In `cancel()` method (line ~211): remove `this._visuals.setPortsVisible(false);`
    - In `_startWireDrawing()` (line ~693): remove `this._visuals.setPortsVisible(true);`
    - Search for and remove any other `setPortsVisible(false)` calls

  **Must NOT do**:
  - Do NOT change port circle radius, colors, or stroke style
  - Do NOT modify port snap highlight behavior

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Default value change + removing visibility toggle calls
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: F1, F3
  - **Blocked By**: None

  **References**:
  - `src/components/OneCanvas/renderers/PortRenderer.ts:100` — `private _showAll = false;` — the default to change
  - `src/components/OneCanvas/renderers/PortRenderer.ts:184-187` — `setShowAll()` method
  - `src/components/OneCanvas/interaction/InteractionController.ts:211` — `setPortsVisible(false)` in cancel()
  - `src/components/OneCanvas/interaction/InteractionController.ts:693` — `setPortsVisible(true)` in _startWireDrawing()

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Ports visible without entering wire-drawing mode
    Tool: Playwright
    Preconditions: App running, circuit with blocks that have ports
    Steps:
      1. Navigate to schematic canvas (idle mode, NOT wire-drawing)
      2. Observe block port circles — should be visible
    Expected Result: Colored circles visible at port positions on all blocks
    Failure Indicators: No port circles visible in idle mode
    Evidence: .sisyphus/evidence/task-2-ports-always-visible.png

  Scenario: Ports remain visible after exiting wire-drawing mode
    Tool: Playwright
    Preconditions: App running, circuit with blocks
    Steps:
      1. Enter wire-drawing mode (click a port)
      2. Press Escape to cancel
      3. Observe ports — still visible
    Expected Result: Port circles remain visible after Escape
    Evidence: .sisyphus/evidence/task-2-ports-after-escape.png
  ```

  **Commit**: YES (groups with Tasks 1, 3)
  - Files: `src/components/OneCanvas/renderers/PortRenderer.ts`, `src/components/OneCanvas/interaction/InteractionController.ts`

- [x] 3. Port-Connected Wire Segment Rubber-Band Drag

  **What to do**:
  - In `src/components/OneCanvas/interaction/InteractionController.ts`, modify `_startWireSegmentDragging()`:
    1. After getting `segHandleA` from `target.subIndex`, get the wire from facade
    2. Detect if this is a port-connected segment:
       - **From-end segment**: The hit segment is between the `from` port and `handles[0]`. This means `segHandleA === 0` AND this is the first segment in the wire. The HitTester returns `subIndex === 0` for this segment. Check if the wire has no handles OR if `subIndex === 0` means the first visible segment from the `from` endpoint.
       - **To-end segment**: The hit segment is between `handles[last]` and the `to` port. Check `subIndex >= handles.length`.
    3. For a port-connected segment, resolve the port endpoint position (use `_resolveEndpointPosition` pattern from WireRenderer or access via facade components/junctions).
    4. Call `facade.insertEndpointHandle(wireId, 'from'|'to', [...])` to insert two handles at the port endpoint position:
       - Handle 1: at port position, constrained to the segment's orientation
       - Handle 2: at port position, constrained to the perpendicular direction
    5. Update `_segmentHandleA` and `_segmentHandleB` to point to the newly created draggable handle indices
  - In `_handleSegmentDraggingUp()`, add `facade.cleanupOverlappingHandles(wireId)` call to remove zero-length segments after drag

  **Key insight**: `canvasStore.moveWireSegment()` has guard `if (!wire?.handles?.[handleIndexA] || !wire?.handles?.[handleIndexB]) return;`. Port-connected segments fail because port positions aren't in the handles array. By inserting handles BEFORE the drag starts, the existing move logic works unchanged.

  **Must NOT do**:
  - Do NOT modify `moveWireSegment()` in canvasStore
  - Do NOT modify `updateWireHandle()` or handle drag logic
  - Do NOT change HitTester segment detection
  - Do NOT modify wire auto-routing

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires understanding wire topology, handle indexing, and interaction state machine flow
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: F1, F3
  - **Blocked By**: None

  **References**:
  - `src/components/OneCanvas/interaction/InteractionController.ts:820-833` — `_startWireSegmentDragging()` — THE method to modify
  - `src/components/OneCanvas/interaction/InteractionController.ts:835-860` — `_handleSegmentDraggingMove()` — calls `facade.moveWireSegment()`. Works as-is once handles inserted
  - `src/components/OneCanvas/interaction/InteractionController.ts:862-873` — `_handleSegmentDraggingUp()` — needs `cleanupOverlappingHandles()` call
  - `src/types/canvasFacade.ts:107-119` — `moveWireSegment()` and `insertEndpointHandle()` signatures
  - `src/types/canvasFacade.ts:121` — `cleanupOverlappingHandles()` signature
  - `src/stores/canvasStore.ts:1045-1077` — `moveWireSegment` store implementation — shows the guard clause that causes the bug
  - `src/stores/canvasStore.ts:1079-1099` — `insertEndpointHandle` store implementation — shows prepend/append
  - `src/components/OneCanvas/types.ts:675-716` — `WireHandle` and `Wire` type definitions
  - `src/components/OneCanvas/renderers/WireRenderer.ts:276-331` — `_resolveEndpointPosition()` — pattern for resolving port world position from block+port data

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Port-connected segment can be dragged perpendicular
    Tool: Playwright
    Preconditions: Two blocks connected by a wire with at least one bend
    Steps:
      1. Identify a wire segment directly connected to a port (first or last segment)
      2. Click and drag that segment perpendicular to its direction
      3. Observe new bend/segment created near the port
      4. Release mouse
    Expected Result: New orthogonal bend at port side, segment moves perpendicular
    Failure Indicators: Segment doesn't move, wire disappears, or endpoint disconnects
    Evidence: .sisyphus/evidence/task-3-rubber-band-drag.png

  Scenario: Middle segment drag still works (regression)
    Tool: Playwright
    Preconditions: Wire with multiple bends (3+ segments)
    Steps:
      1. Drag a middle segment (not connected to port) perpendicular
      2. Release mouse
    Expected Result: Segment moves normally, no extra handles inserted
    Evidence: .sisyphus/evidence/task-3-middle-segment-regression.png
  ```

  **Commit**: YES (groups with Tasks 1, 2)
  - Files: `src/components/OneCanvas/interaction/InteractionController.ts`

---

## Final Verification Wave

- [x] F1. **Build Verification** — `quick`
  Run `pnpm run build`. Ensure zero TypeScript errors and zero build warnings related to changed files.
  Output: `Build [PASS/FAIL] | VERDICT: APPROVE/REJECT`

- [x] F2. **Visual QA — Wire Selection** — `unspecified-high` + `playwright` skill
  Start the dev server (`pnpm tauri dev` or `pnpm run dev`). Open a circuit with wires. Click a wire — verify color changes from dark gray to blue. Use marquee selection to select multiple wires — verify all change color. Deselect — verify all return to dark gray. Screenshot evidence.
  Output: `Scenarios [N/N pass] | VERDICT`

- [x] F3. **Visual QA — Port Visibility + Segment Drag** — `unspecified-high` + `playwright` skill
  Verify port circles visible on all blocks without entering wire-drawing mode. Place two blocks, wire them. Drag a port-connected wire segment perpendicular — verify new bend created. Screenshot evidence.
  Output: `Scenarios [N/N pass] | VERDICT`

---

## Commit Strategy

- **1**: `feat(canvas): enhance wire selection contrast, always-visible ports, rubber-band segment drag` — all changed files, `pnpm run build`

---

## Success Criteria

### Verification Commands
```bash
pnpm run build  # Expected: Build succeeded
```

### Final Checklist
- [x] Wire 기본색 어둡게 변경됨
- [x] Wire 선택 시 파란색으로 명확하게 구분됨
- [x] Port circle이 모든 블록에 상시 표시됨
- [x] Port-connected wire segment 드래그 시 rubber-band 동작
- [x] 빌드 성공
