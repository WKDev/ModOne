# OneCanvas Wire Interaction Fixes

## TL;DR

> **Quick Summary**: Fix two wire interaction bugs — segment drag amplification (exponential drift from additive delta accumulation) and diagonal wire preview during drawing (should show orthogonal/Manhattan path). Both root causes are confirmed and fixes leverage existing working patterns in the codebase.
> 
> **Deliverables**:
> - Wire segment drag moves 1:1 with mouse (no amplification)
> - Wire drawing preview shows orthogonal path (not invisible/diagonal)
> - Regression tests for both fixes
> 
> **Estimated Effort**: Short
> **Parallel Execution**: YES — 2 waves + final verification
> **Critical Path**: Task 1 → Task 3 → Final Verification

---

## Context

### Original Request
User reported two bugs after Bug 1 (mouse unresponsive after wire connection) was already fixed:
1. Wire segment drag moves MORE than actual mouse distance — exponential amplification
2. Wires should route orthogonal/Manhattan (no diagonals), and bend points should be user-draggable

### Interview Summary
**Key Discussions**:
- Bug 2 root cause confirmed by 2 independent explore agents — additive delta accumulation in `moveWireSegment` plus duplicate application on mouseup
- Bug 3 investigation revealed orthogonal routing infrastructure ALREADY EXISTS — the issue is wire PREVIEW during drawing doesn't use it (preview is actually invisible, not diagonal)
- Wire bend point dragging (handle dragging) already works correctly via `updateWireHandle` — no fix needed

**Research Findings**:
- `moveWireSegment` in both `canvasStore.ts` AND `useSchematicCanvasDocument.ts` applies delta additively — both need fixing
- `updateWireHandle` (handle drag) uses absolute positioning — this is the correct pattern to follow
- `calculateOrthogonalPath` and `computeWireBendPoints` already produce orthogonal paths — just not used during preview
- Wire preview passes single point `[worldPos]` → `WireRenderer` requires ≥2 points → preview is INVISIBLE (not diagonal)
- Test infrastructure: Vitest (986 tests pass), Playwright E2E, 20 wire-specific tests

### Metis Review
**Identified Gaps** (addressed):
- TWO `moveWireSegment` implementations must be fixed (canvasStore + useSchematicCanvasDocument) — included in Task 1
- No stored original positions for segment drag start — fix adds `_segmentHandleAStartPos`/`_segmentHandleBStartPos`
- Wire preview symptom mischaracterized (invisible, not diagonal) — corrected in Task 2 description
- Undo/redo stack corruption risk if only one sub-bug fixed — both fixed atomically in Task 1
- Edge cases: collinear endpoints, rapid movement, endpoint handles — covered in Task 3 tests

---

## Work Objectives

### Core Objective
Fix wire segment drag amplification and wire drawing preview to show orthogonal paths, using existing proven patterns in the codebase.

### Concrete Deliverables
- `InteractionController.ts` — segment drag uses absolute positioning (matching handle drag pattern)
- `InteractionController.ts` — wire preview computes orthogonal path from existing utilities
- `canvasStore.ts` + `useSchematicCanvasDocument.ts` — `moveWireSegment` signature/behavior updated
- New Vitest test files validating both fixes

### Definition of Done
- [ ] `pnpm run test` — all tests pass (986+ including new ones), 0 failures
- [ ] Wire segment drag produces 1:1 movement (verified via unit test)
- [ ] Wire preview shows orthogonal points (verified via unit test)
- [ ] No LSP errors in modified files

### Must Have
- Wire segment drag moves exactly as far as the mouse (1:1, no amplification)
- Wire drawing preview displays orthogonal path from start port to mouse position
- Both `moveWireSegment` implementations fixed (canvasStore + useSchematicCanvasDocument)
- All 986+ existing tests continue to pass
- Undo/redo not broken by the changes

### Must NOT Have (Guardrails)
- DO NOT modify `WireRenderer.ts` — it already handles multi-point preview correctly
- DO NOT modify `wirePathCalculator.ts` — pure utilities, already correct
- DO NOT modify `wireSimplifier.ts` — post-finalization, not relevant
- DO NOT modify `canvasHelpers.ts` — `computeWireBendPoints` works correctly
- DO NOT modify `EventBridge.ts` — event plumbing, not relevant
- DO NOT modify `CanvasHost.tsx` — visuals wiring, interface is compatible
- DO NOT touch wire finalization logic (`addWire`, `computeWireBendPoints`)
- DO NOT refactor unrelated wire interaction code (context menus, wire mode toggle, junction handling)
- DO NOT over-abstract — no new utility classes, no new abstraction layers
- DO NOT add excessive comments beyond what's needed to explain the fix

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Vitest v4.0.18 + Playwright v1.58.0)
- **Automated tests**: YES (tests-after)
- **Framework**: Vitest (existing, 986 tests pass)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Unit tests**: Use Bash (`pnpm run test`) — run tests, assert pass counts
- **LSP diagnostics**: Use `lsp_diagnostics` — verify 0 errors in modified files
- **Build verification**: Use Bash (`pnpm run build`) — verify no new build errors

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — independent bug fixes):
├── Task 1: Fix wire segment drag amplification [deep]
└── Task 2: Fix wire drawing preview to show orthogonal path [deep]

Wave 2 (After Wave 1 — regression tests):
└── Task 3: Add regression tests and verify all wire interactions [unspecified-high]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review [unspecified-high]
├── Task F3: Real manual QA [unspecified-high]
└── Task F4: Scope fidelity check [deep]

Critical Path: Task 1 → Task 3 → Final Verification
Parallel Speedup: ~40% faster than sequential
Max Concurrent: 2 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 3 | 1 |
| 2 | — | 3 | 1 |
| 3 | 1, 2 | F1-F4 | 2 |
| F1-F4 | 3 | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: **2** — T1 → `deep`, T2 → `deep`
- **Wave 2**: **1** — T3 → `unspecified-high`
- **Wave FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Fix wire segment drag amplification (Bug 2)

  **What to do**:
  1. Add two new state fields to `InteractionController` (near lines 132-137):
     - `_segmentHandleAStartPos: Position = { x: 0, y: 0 }` — original position of handle A at drag start
     - `_segmentHandleBStartPos: Position = { x: 0, y: 0 }` — original position of handle B at drag start
  2. In `_startWireSegmentDragging()` (called from `_handlePointerDown`, line 811-823): After storing `_segmentWireId`, `_segmentHandleA`, `_segmentHandleB` — read the current handle positions from the wire data via the facade and store them in `_segmentHandleAStartPos` and `_segmentHandleBStartPos`. The wire data is accessible via `this._facade` — look at how `_handleHandleDraggingMove` accesses handle positions at line 887 for the pattern.
  3. In `_handleSegmentDraggingMove()` (line 825-847): Change from additive delta to absolute positioning:
     - Keep the existing `constrained` delta computation (lines 828-831) — this correctly computes total snapped/constrained delta from drag start
     - Instead of calling `facade.moveWireSegment(wireId, handleA, handleB, constrained, true)`, compute absolute new positions:
       ```typescript
       const newPosA = add(this._segmentHandleAStartPos, constrained);
       const newPosB = add(this._segmentHandleBStartPos, constrained);
       ```
     - Then call `facade.updateWireHandle(wireId, handleA, newPosA, isFirstMove)` and `facade.updateWireHandle(wireId, handleB, newPosB, false)` — using `updateWireHandle` which sets absolute positions (the working pattern from handle dragging)
     - Track `isFirstMove` properly: only `true` on the very first move call, `false` for subsequent frames (add a `_segmentIsFirstMove: boolean = true` field, set to `false` after first call)
  4. In `_handleSegmentDraggingUp()` (line 849-870): Remove the duplicate delta re-application at lines 851-859. The handles are already at the correct final position from the move handler. Only keep:
     - The state transition back to `'idle'`
     - The `_resetTransient()` call
     - Any wire simplification / history finalization that happens after
  5. Clean up new state fields in `_resetTransient()` (line ~1006) — reset `_segmentHandleAStartPos`, `_segmentHandleBStartPos`, `_segmentIsFirstMove`

  **Must NOT do**:
  - DO NOT modify `WireRenderer.ts`
  - DO NOT modify `wirePathCalculator.ts` or `wireSimplifier.ts`
  - DO NOT modify the `moveWireSegment` store method signature (we're switching to `updateWireHandle` calls instead)
  - DO NOT touch wire finalization logic
  - DO NOT change `updateWireHandle` in canvasStore or useSchematicCanvasDocument — it already works correctly

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires understanding interaction state machine patterns and applying correct coordinate math. Must trace through facade→store call chain.
  - **Skills**: `[]`
    - No special skills needed — pure TypeScript logic in interaction controller
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed — this is an internal logic fix, not UI testing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3 (regression tests)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL — executor has NO context from interview):

  **Pattern References** (existing code to follow):
  - `src/components/OneCanvas/interaction/InteractionController.ts:887-909` — `_handleHandleDraggingMove` is the CORRECT pattern to follow. It stores `_handleStartPosition` at drag start, computes `newPos = add(_handleStartPosition, constrained)`, then calls `facade.updateWireHandle(wireId, index, newPos, isFirstMove)`. Your segment drag fix should mirror this exact pattern but for TWO handles simultaneously.
  - `src/components/OneCanvas/interaction/InteractionController.ts:130-137` — existing segment drag state fields. Add new fields here.
  - `src/components/OneCanvas/interaction/InteractionController.ts:811-823` — `_startWireSegmentDragging` where handle indices are stored. Add position reading here.

  **API/Type References** (contracts to implement against):
  - `src/types/canvasFacade.ts:101` — `updateWireHandle(wireId, handleIndex, position, isFirstMove)` signature — this is the absolute-position API you'll use instead of `moveWireSegment`
  - `src/components/OneCanvas/types.ts:675-684` — `WireHandle` type with `position: Position` (absolute world coordinates)
  - `src/stores/canvasStore.ts:975-1007` — `updateWireHandle` implementation — sets position absolutely (correct behavior)
  - `src/stores/hooks/useSchematicCanvasDocument.ts:481-515` — document-mode `updateWireHandle` implementation — also absolute

  **Bug References** (the code that's broken):
  - `src/components/OneCanvas/interaction/InteractionController.ts:825-847` — `_handleSegmentDraggingMove` — THIS IS THE BUGGY CODE. Computes total delta and passes to additive `moveWireSegment`
  - `src/components/OneCanvas/interaction/InteractionController.ts:849-870` — `_handleSegmentDraggingUp` — re-applies delta on mouseup (duplicate)
  - `src/stores/canvasStore.ts:1045-1077` — `moveWireSegment` — applies delta ADDITIVELY: `handle.position.x += delta.x` (the root cause of amplification)
  - `src/stores/hooks/useSchematicCanvasDocument.ts:557-590` — document-mode `moveWireSegment` — same additive bug

  **Utility References**:
  - `src/components/OneCanvas/utils/geometry.ts` — `add()`, `subtract()` functions for Position math
  - `src/components/OneCanvas/interaction/InteractionController.ts:1006-1011` — `_resetTransient()` — where to clean up new state fields

  **WHY Each Reference Matters**:
  - Lines 887-909 (`_handleHandleDraggingMove`): This is your TEMPLATE. Copy this pattern for segment drag but adapt for two handles.
  - Lines 975-1007 (`updateWireHandle`): This is the store method you'll call instead of `moveWireSegment`. It sets absolute positions.
  - Lines 825-847 (`_handleSegmentDraggingMove`): This is what you're REPLACING. Understand the current broken flow before changing it.
  - Lines 1045-1077 (`moveWireSegment`): You do NOT need to modify this — you're switching away from calling it. But understand why it's broken (additive delta).

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Wire segment drag produces 1:1 movement (no amplification)
    Tool: Bash (pnpm run test)
    Preconditions: Test file exists with segment drag test case
    Steps:
      1. Run `pnpm run test -- --grep "segment drag"` 
      2. Test creates a wire with known handle positions (e.g., handleA at {x:100, y:100}, handleB at {x:200, y:100})
      3. Test simulates drag: total delta = {x:50, y:0}
      4. Test asserts handleA is at {x:150, y:100} and handleB at {x:250, y:100} — NOT amplified values
    Expected Result: Test passes — handle positions are original + delta, no amplification
    Failure Indicators: Handle positions exceed expected values (e.g., {x:200, y:100} instead of {x:150, y:100})
    Evidence: .sisyphus/evidence/task-1-segment-drag-no-amplification.txt

  Scenario: Wire segment drag then mouseup doesn't double-apply
    Tool: Bash (pnpm run test)
    Preconditions: Test file exists
    Steps:
      1. Run `pnpm run test -- --grep "segment drag mouseup"` 
      2. Test simulates: drag move with delta {x:50, y:0}, then mouseup
      3. Test asserts final handle positions are original + {x:50, y:0} — NOT original + {x:100, y:0}
    Expected Result: Test passes — mouseup doesn't re-apply the delta
    Failure Indicators: Handle positions are double the expected delta
    Evidence: .sisyphus/evidence/task-1-segment-drag-no-double-apply.txt

  Scenario: All existing tests still pass after changes
    Tool: Bash
    Preconditions: All source changes committed
    Steps:
      1. Run `pnpm run test`
      2. Assert exit code 0
      3. Assert test count ≥ 986
    Expected Result: 0 failures, all existing tests pass
    Failure Indicators: Any test failure or reduced test count
    Evidence: .sisyphus/evidence/task-1-all-tests-pass.txt

  Scenario: LSP diagnostics clean on modified files
    Tool: lsp_diagnostics
    Preconditions: Source changes saved
    Steps:
      1. Run lsp_diagnostics on `src/components/OneCanvas/interaction/InteractionController.ts` with severity="error"
      2. Assert 0 errors
    Expected Result: No TypeScript errors in modified file
    Failure Indicators: Any error diagnostic reported
    Evidence: .sisyphus/evidence/task-1-lsp-clean.txt
  ```

  **Evidence to Capture:**
  - [ ] task-1-segment-drag-no-amplification.txt — test output proving 1:1 movement
  - [ ] task-1-segment-drag-no-double-apply.txt — test output proving no mouseup duplication
  - [ ] task-1-all-tests-pass.txt — full test suite output
  - [ ] task-1-lsp-clean.txt — LSP diagnostics output

  **Commit**: YES
  - Message: `fix(canvas): resolve wire segment drag amplification from additive delta accumulation`
  - Files: `src/components/OneCanvas/interaction/InteractionController.ts`
  - Pre-commit: `pnpm run test`


- [x] 2. Fix wire drawing preview to show orthogonal path (Bug 3)

  **What to do**:
  1. Add a new state field to `InteractionController` (near lines 128-130 where `_wireFrom` etc. are stored):
     - `_wireDrawingFromPos: Position = { x: 0, y: 0 }` — world position of the start port when wire drawing begins
  2. In `_startWireDrawing()` (line 677-691): The `worldPos` parameter is already available (it's the snapped port position). Store it in `_wireDrawingFromPos`. This is the position the wire starts from. Also note `_wireFromExitDirection` is already stored (line 687).
  3. In `_handleWireDrawingMove()` (line 693-734): Replace line 726:
     ```typescript
     // BEFORE (broken — passes single point, preview is invisible):
     this._visuals.renderWirePreview([worldPos]);
     
     // AFTER (fixed — compute orthogonal path from start to mouse):
     const previewPath = computeWireBendPoints(
       this._wireDrawingFromPos, worldPos,
       /* fromDirection */ this._wireFromExitDirection,
       /* toDirection */ undefined  // unknown during drawing
     );
     // prepend start position, append current mouse position
     this._visuals.renderWirePreview([this._wireDrawingFromPos, ...previewPath, worldPos]);
     ```
     **IMPORTANT**: Look at how `computeWireBendPoints` is called in `canvasStore.ts:754` (`addWire`) for the exact signature. The function may take additional parameters (components map, junctions). Import it from `src/components/OneCanvas/utils/canvasHelpers.ts` where it's exported.
     **ALTERNATIVE**: If `computeWireBendPoints` requires too many dependencies (component map, junctions), use a simpler approach: compute a 2-segment L-shaped orthogonal path directly:
     ```typescript
     // Simple L-route based on exit direction:
     const mid = this._wireFromExitDirection === 'left' || this._wireFromExitDirection === 'right'
       ? { x: worldPos.x, y: this._wireDrawingFromPos.y }  // horizontal first
       : { x: this._wireDrawingFromPos.x, y: worldPos.y }; // vertical first
     this._visuals.renderWirePreview([this._wireDrawingFromPos, mid, worldPos]);
     ```
  4. Clean up `_wireDrawingFromPos` in `_handleWireDrawingUp()` (line 736+) and `_resetTransient()` — reset to `{ x: 0, y: 0 }`
  5. The `InteractionVisuals.renderWirePreview(points: Position[])` interface ALREADY accepts multi-point arrays — no change needed
  6. `WireRenderer.renderPreview()` ALREADY draws polylines from point arrays (lines 207-210) — no change needed

  **Must NOT do**:
  - DO NOT modify `WireRenderer.ts` — it already handles multi-point preview correctly
  - DO NOT modify `wirePathCalculator.ts` — use it as-is via `computeWireBendPoints`
  - DO NOT modify the `InteractionVisuals.renderWirePreview` interface signature
  - DO NOT touch wire finalization logic in `_handleWireDrawingUp`
  - DO NOT add complex routing algorithms — use existing utilities or simple L-route

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires understanding wire drawing state flow and correctly integrating existing path calculation utilities. Must verify the preview renders correctly through the existing rendering pipeline.
  - **Skills**: `[]`
    - No special skills needed — TypeScript logic in interaction controller
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed for this task — verification is through unit tests and build check

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3 (regression tests)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL — executor has NO context from interview):

  **Pattern References** (existing code to follow):
  - `src/stores/canvasStore.ts:750-760` — How `computeWireBendPoints` is called during wire finalization in `addWire`. Shows exact parameter order: `from, to, components, fromExitDirection, toExitDirection, junctions`. This is the REFERENCE for how to call the same utility during preview.
  - `src/components/OneCanvas/utils/canvasHelpers.ts:340` — `computeWireBendPoints` wrapper function. Check its exact export signature and parameter requirements.

  **API/Type References** (contracts to implement against):
  - `src/components/OneCanvas/interaction/InteractionController.ts:677-691` — `_startWireDrawing(worldPos, endpoint, exitDirection)` — where to store `_wireDrawingFromPos`. `worldPos` is the snapped port position.
  - `src/components/OneCanvas/interaction/InteractionController.ts:693-734` — `_handleWireDrawingMove(worldPos)` — where to compute orthogonal preview. Line 726 is the specific line to replace.
  - `src/components/OneCanvas/interaction/InteractionController.ts:128-130` — Existing wire drawing state fields (`_wireFrom`, `_wireFromExitDirection`). Add `_wireDrawingFromPos` here.

  **Bug References** (the code that's broken):
  - `src/components/OneCanvas/interaction/InteractionController.ts:726` — `this._visuals.renderWirePreview([worldPos])` — passes SINGLE point. `WireRenderer.renderPreview` requires ≥2 points to be visible (checks `points.length < 2` at line 201 and hides with `g.visible = false`). Result: preview is INVISIBLE during wire drawing.

  **Rendering Pipeline References** (verify no changes needed):
  - `src/components/OneCanvas/renderers/WireRenderer.ts:190-215` — `renderPreview()` method. Already draws polylines via `g.moveTo` + `g.lineTo` loop. Already checks `points.length < 2` and hides if insufficient. Passing 3+ points (start, bend, end) will render a visible orthogonal preview WITHOUT any changes to this file.
  - `src/components/OneCanvas/types.ts` — `InteractionVisuals` interface, `renderWirePreview(points: Position[]): void` — already accepts arrays.

  **Path Calculation References** (utilities available):
  - `src/components/OneCanvas/utils/wirePathCalculator.ts:92` — `calculateOrthogonalPath(from, to, fromDir, toDir)` — produces L-shaped orthogonal routes
  - `src/components/OneCanvas/utils/wirePathCalculator.ts:455-493` — `calculateWireBendPoints` — main function producing orthogonal bend points from port directions

  **WHY Each Reference Matters**:
  - canvasStore.ts:750-760: Shows how `computeWireBendPoints` is ACTUALLY called in production — copy this calling pattern for preview
  - InteractionController.ts:726: This is the ONE LINE causing the bug — change from `[worldPos]` to a multi-point orthogonal path
  - WireRenderer.ts:190-215: Proves you do NOT need to change the renderer — it already works with multi-point arrays
  - wirePathCalculator.ts: These are the utilities available — use them, don't reinvent

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Wire preview shows orthogonal path (not invisible)
    Tool: Bash (pnpm run test)
    Preconditions: Test file exists with preview path test case
    Steps:
      1. Run `pnpm run test -- --grep "wire preview orthogonal"`
      2. Test computes preview path from {x:100, y:100} to {x:300, y:250} with exitDirection='right'
      3. Test asserts the returned points array has ≥3 points (start, at least one bend, end)
      4. Test asserts every consecutive point pair is axis-aligned:
         For each pair (points[i], points[i+1]): points[i].x === points[i+1].x OR points[i].y === points[i+1].y
    Expected Result: Test passes — preview produces orthogonal multi-point path
    Failure Indicators: Points array has <3 elements, or consecutive points are neither horizontally nor vertically aligned
    Evidence: .sisyphus/evidence/task-2-preview-orthogonal.txt

  Scenario: Wire preview is visible (not hidden)
    Tool: Bash (pnpm run test)
    Preconditions: Test file exists
    Steps:
      1. Run `pnpm run test -- --grep "wire preview visible"`
      2. Test verifies that `renderWirePreview` is called with ≥2 points (so WireRenderer doesn't hide it)
    Expected Result: Preview receives sufficient points to be rendered
    Failure Indicators: renderWirePreview called with 0 or 1 points
    Evidence: .sisyphus/evidence/task-2-preview-visible.txt

  Scenario: All existing tests still pass
    Tool: Bash
    Preconditions: All source changes committed
    Steps:
      1. Run `pnpm run test`
      2. Assert exit code 0
      3. Assert test count ≥ 986
    Expected Result: 0 failures
    Failure Indicators: Any test failure
    Evidence: .sisyphus/evidence/task-2-all-tests-pass.txt

  Scenario: LSP diagnostics clean
    Tool: lsp_diagnostics
    Steps:
      1. Run lsp_diagnostics on `src/components/OneCanvas/interaction/InteractionController.ts` with severity="error"
      2. Assert 0 errors
    Expected Result: No TypeScript errors
    Evidence: .sisyphus/evidence/task-2-lsp-clean.txt
  ```

  **Evidence to Capture:**
  - [ ] task-2-preview-orthogonal.txt — test output proving orthogonal path generation
  - [ ] task-2-preview-visible.txt — test output proving preview has ≥2 points
  - [ ] task-2-all-tests-pass.txt — full test suite output
  - [ ] task-2-lsp-clean.txt — LSP diagnostics output

  **Commit**: YES
  - Message: `fix(canvas): show orthogonal preview path during wire drawing`
  - Files: `src/components/OneCanvas/interaction/InteractionController.ts`
  - Pre-commit: `pnpm run test`


- [x] 3. Add comprehensive regression tests and verify all wire interactions

  **What to do**:
  1. Create or extend test file for wire segment drag behavior (e.g., `src/components/OneCanvas/interaction/__tests__/wireSegmentDrag.test.ts` or add to existing test file):
     - Test: Segment drag with delta {x:50, y:0} results in handle positions = original + {x:50, y:0}
     - Test: Multiple frame moves (simulating drag) result in correct final position (no accumulation)
     - Test: Mouseup after drag does NOT re-apply delta (final position same as last move position)
     - Test: Segment drag on horizontal segment constrains to horizontal movement only
     - Test: Segment drag on vertical segment constrains to vertical movement only
     - Edge case: Very large delta (e.g., {x:1000, y:0}) still produces correct position
     - Edge case: Zero-length drag (mousedown then immediate mouseup) leaves handles unchanged
  2. Create or extend test file for wire preview path generation (e.g., `src/components/OneCanvas/utils/__tests__/wirePreviewPath.test.ts`):
     - Test: Preview from {x:100, y:100} to {x:300, y:250} with exitDirection='right' produces ≥3 orthogonal points
     - Test: Every consecutive point pair is axis-aligned (shares x or y coordinate)
     - Test: Preview from same position (start == end) produces valid path (not crash)
     - Test: Preview with various exitDirections ('left', 'right', 'up', 'down') all produce orthogonal paths
     - Test: Preview path starts at start position and ends at mouse position
  3. Verify existing handle drag tests still pass — run `pnpm run test -- --grep "handle"` and verify no regressions
  4. Verify existing wire routing tests still pass — run `pnpm run test -- --grep "wire"` 
  5. Run full test suite: `pnpm run test` — all tests pass

  **Must NOT do**:
  - DO NOT modify source code (InteractionController, canvasStore, etc.) — only test files
  - DO NOT create tests that require running the full application or UI interaction
  - DO NOT create flaky tests (no timers, no random data, deterministic only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Writing comprehensive tests requires understanding the interaction patterns from Tasks 1 and 2, but the actual code changes are standard Vitest test files.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed — these are unit tests, not E2E

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential after Wave 1)
  - **Blocks**: Final Verification (F1-F4)
  - **Blocked By**: Task 1, Task 2 (tests validate the fixes from both tasks)

  **References** (CRITICAL):

  **Pattern References** (existing test patterns to follow):
  - `src/components/OneCanvas/utils/__tests__/buildCanonicalWirePolyline.test.ts` — 8 wire geometry tests showing test structure, import patterns, and assertion style for wire-related code. Follow this file's structure.
  - `src/components/OneCanvas/utils/__tests__/wireGeometryRoundtrip.test.ts` — 8 tests including `enforceOrthogonalPolyline` assertions. Shows how to test orthogonal path generation.
  - `src/__tests__/wire-routing-verification.test.ts` — 4 routing tests with `assertOrthogonalPath` helper that verifies consecutive points are axis-aligned. REUSE this helper.
  - `src/stores/__tests__/canvasFacade.contract.test.ts` — 29 tests covering `addWire`/`removeWire` through the facade. Shows how to set up facade test fixtures.

  **Source References** (the code being tested):
  - `src/components/OneCanvas/interaction/InteractionController.ts` — the fixed segment drag and preview code from Tasks 1 and 2
  - `src/stores/canvasStore.ts:975-1007` — `updateWireHandle` — the absolute-position API now used by segment drag

  **WHY Each Reference Matters**:
  - `buildCanonicalWirePolyline.test.ts`: Template for test file structure and imports
  - `wire-routing-verification.test.ts`: Contains `assertOrthogonalPath` helper — reuse instead of reimplementing
  - `canvasFacade.contract.test.ts`: Shows how to create mock wires and facades for testing wire operations

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All new regression tests pass
    Tool: Bash
    Preconditions: Test files created
    Steps:
      1. Run `pnpm run test -- --grep "wire" --reporter verbose`
      2. Count total wire-related tests
      3. Assert ≥30 wire tests (20 existing + 10+ new)
      4. Assert 0 failures
    Expected Result: All wire tests pass including new regression tests
    Failure Indicators: Any test failure, or fewer than 30 wire tests found
    Evidence: .sisyphus/evidence/task-3-wire-tests-pass.txt

  Scenario: Full test suite passes with new tests
    Tool: Bash
    Steps:
      1. Run `pnpm run test`
      2. Assert exit code 0
      3. Assert total test count > 986 (new tests added)
    Expected Result: All tests pass, test count increased
    Failure Indicators: Any failure or test count ≤ 986
    Evidence: .sisyphus/evidence/task-3-full-suite-pass.txt

  Scenario: No source code was modified (only test files)
    Tool: Bash
    Steps:
      1. Run `git diff --name-only HEAD~1` (after Task 3 commit)
      2. Assert all changed files are in `__tests__/` directories or are `.test.ts` files
      3. Assert NO changes to InteractionController.ts, canvasStore.ts, etc.
    Expected Result: Only test files changed
    Failure Indicators: Any non-test source file modified
    Evidence: .sisyphus/evidence/task-3-scope-check.txt
  ```

  **Evidence to Capture:**
  - [ ] task-3-wire-tests-pass.txt — verbose wire test output
  - [ ] task-3-full-suite-pass.txt — full test suite output
  - [ ] task-3-scope-check.txt — git diff showing only test files

  **Commit**: YES
  - Message: `test(canvas): add regression tests for wire drag and preview fixes`
  - Files: new test file(s) in `__tests__/` directories
  - Pre-commit: `pnpm run test`

---
## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read `.sisyphus/plans/wire-fixes.md` end-to-end. For each "Must Have": verify implementation exists (read file, run test command). For each "Must NOT Have": search codebase for forbidden modifications using `git diff` — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm run test` + `lsp_diagnostics` on all modified files. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Verify TypeScript strict mode compliance.
  Output: `Tests [PASS/FAIL] | LSP [N errors] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration: draw wire (should show orthogonal preview), finalize, then drag segment (should move 1:1). Test edge cases: rapid dragging, very short wires, collinear endpoints. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (`git diff`). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance — verify NO changes to WireRenderer.ts, wirePathCalculator.ts, wireSimplifier.ts, canvasHelpers.ts, EventBridge.ts, CanvasHost.tsx. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Forbidden Files [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Task 1**: `fix(canvas): resolve wire segment drag amplification from additive delta accumulation`
  - Files: `InteractionController.ts`, `canvasStore.ts`, `useSchematicCanvasDocument.ts`
  - Pre-commit: `pnpm run test`

- **Task 2**: `fix(canvas): show orthogonal preview path during wire drawing`
  - Files: `InteractionController.ts`
  - Pre-commit: `pnpm run test`

- **Task 3**: `test(canvas): add regression tests for wire drag and preview fixes`
  - Files: new test file(s)
  - Pre-commit: `pnpm run test`

---

## Success Criteria

### Verification Commands
```bash
pnpm run test          # Expected: all tests pass (986+ including new), 0 failures
pnpm run test -- --grep "wire"  # Expected: all wire tests pass (20+ including new)
```

### Final Checklist
- [x] All "Must Have" present and verified
- [x] All "Must NOT Have" absent (no forbidden file modifications)
- [x] All tests pass (`pnpm run test` → 0 failures)
- [x] LSP diagnostics clean on all modified files
- [x] Wire segment drag: 1:1 mouse movement (unit test proves it)
- [x] Wire preview: orthogonal path displayed (unit test proves it)
- [x] Undo/redo not broken (existing tests cover this)
