# Wire Segment-First Movement Model

## TL;DR

> **Quick Summary**: Replace the current handle-pair based wire dragging with a segment-first movement model that leverages existing `wireSimplifier.ts` polyline API. H segments move Y only, V segments move X only — Manhattan routing is structurally guaranteed. Port-connected ends auto-generate compensation segments.
> 
> **Deliverables**:
> - Enhanced `wireSimplifier.ts` with segment decomposition and endpoint-state aware compensation
> - Refactored `canvasStore.moveWireSegment` using polyline-based flow
> - Updated `HitTester` returning actual orientation in segment hit results
> - Simplified `InteractionController` segment drag using geometry-based orientation
> - Unit tests for all segment movement logic
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 6

---

## Context

### Original Request
Replace wire's handle-pair movement system with a segment-first model. Wires are either H-direction or V-direction segments. Movement is constrained perpendicular to segment direction. Port-connected ends auto-generate compensation segments to maintain connectivity. This gives 18 cases (2 directions × 3 start states × 3 end states).

### Interview Summary
**Key Discussions**:
- Wire segments categorized by direction (H/V) and endpoint states (free/wire/port)
- H segments move Y only, V segments move X only → structural Manhattan guarantee
- Port-connected end → perpendicular compensation segment auto-generated
- Wire-connected end → neighbor segment length adjusts
- SegmentView is a virtual/ephemeral concept, not stored in state

**Research Findings**:
- **Critical Discovery**: `wireSimplifier.ts` already contains most of the needed logic:
  - `getSegmentOrientation(poly, segIndex)` → actual geometry-based H/V detection
  - `ensureMovableSegment(poly, segIndex)` → inserts stub segments at endpoint-connected ends
  - `dragSegment(poly, segIndex, perpDelta)` → moves segment perpendicularly
  - `buildWirePolyline(wire, geom)` → constructs [fromPos, ...handles, toPos]
  - `simplifyOrthogonal()` → merges collinear, removes zero-length points
  - `polylineToHandles()` → converts polyline back to WireHandle[]
- These functions are NOT currently used by InteractionController segment drag path
- Current flow uses raw handle-pair delta application instead of this higher-level API
- `inferSegmentOrientation(target)` in InteractionController uses broken `subIndex % 2` heuristic

### Metis Review
**Identified Gaps** (addressed):
- `wireSimplifier.ts` already has 80% of the needed logic — plan restructured to leverage it instead of building from scratch
- Junction endpoints need different compensation than port endpoints — covered in task design
- `routingMode: 'auto' → 'manual'` transition needed after segment drag — included in Task 5
- Facade layer (6 files propagate `moveWireSegment`) — signature kept compatible to avoid cascade changes
- `wire_handle_dragging` mode untouched — separate concern

---

## Work Objectives

### Core Objective
Replace raw handle-pair wire segment dragging with a polyline-based segment movement flow that structurally guarantees Manhattan routing and auto-generates compensation segments when port-connected wires are moved.

### Concrete Deliverables
- `wireSimplifier.ts` enhanced with endpoint-state aware decomposition
- `canvasStore.ts::moveWireSegment` refactored to use polyline-based flow
- `HitTester.ts` returning actual orientation in segment hit results
- `InteractionController.ts` simplified segment drag using geometry-based orientation
- New test files validating segment movement logic
- All existing tests pass without regression

### Definition of Done
- [ ] `pnpm run test` → all tests pass (0 failures)
- [ ] `pnpm run build` → succeeds with 0 type errors
- [ ] Existing `wireSegmentDrag.test.ts` passes without modification
- [ ] Port-connected segment drag creates compensation segment (tested)
- [ ] H segments move Y only, V segments move X only (tested)

### Must Have
- Segment direction detection via actual geometry (not `subIndex % 2`)
- Constrained movement: H→Y only, V→X only
- Port-connected end compensation (auto-generated perpendicular segment)
- Junction-connected end compensation (neighbor segment length adjusts)
- Zero-length segment collapse after drag
- Undo/redo as single transaction
- Grid snap preserved
- `routingMode` set to `'manual'` after user segment drag

### Must NOT Have (Guardrails)
- Do NOT change `Wire`, `WireHandle`, or `WireEndpoint` types in types.ts
- Do NOT touch `rubberBand.ts` or unify it with segment drag
- Do NOT store `SegmentView` objects in state — compute ephemerally
- Do NOT touch `wire_handle_dragging` mode in InteractionController
- Do NOT add visual/rendering changes (wire renderer, overlays, UI indicators)
- Do NOT add multi-segment selection/drag capability
- Do NOT add wire splitting/merging during segment drag
- Do NOT modify the facade interface signature — keep `moveWireSegment(wireId, handleIndexA, handleIndexB, delta, isFirstMove)` compatible
- Do NOT refactor `inferSegmentOrientation` to fix other callers — the new system bypasses it entirely

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Vitest via `vite.config.ts`)
- **Automated tests**: YES (tests-after) — pure logic functions get unit tests
- **Framework**: Vitest
- **Test command**: `pnpm run test`

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Pure logic**: Use Bash (pnpm run test) — run unit tests, assert pass/fail
- **Integration**: Use Bash (pnpm run build) — verify no type errors

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation, MAX PARALLEL):
├── Task 1: Enhance wireSimplifier.ts with endpoint-state decomposition [deep]
└── Task 2: Segment orientation tests (validate geometry inference) [quick]

Wave 2 (After Wave 1 — core refactoring, MAX PARALLEL):
├── Task 3: Refactor canvasStore.moveWireSegment to polyline flow [deep]
└── Task 4: Update HitTester to include orientation in results [quick]

Wave 3 (After Wave 2 — integration):
└── Task 5: Update InteractionController to use new segment flow [unspecified-high]

Wave 4 (After Wave 3 — verification):
└── Task 6: Full regression + build verification [quick]

Critical Path: Task 1 → Task 3 → Task 5 → Task 6
Parallel Speedup: ~35% faster than sequential
Max Concurrent: 2 (Waves 1 & 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1    | —         | 3, 4   | 1    |
| 2    | —         | 3      | 1    |
| 3    | 1, 2      | 5      | 2    |
| 4    | 1         | 5      | 2    |
| 5    | 3, 4      | 6      | 3    |
| 6    | 5         | —      | 4    |

### Agent Dispatch Summary

- **Wave 1**: **2** — T1 → `deep`, T2 → `quick`
- **Wave 2**: **2** — T3 → `deep`, T4 → `quick`
- **Wave 3**: **1** — T5 → `unspecified-high`
- **Wave 4**: **1** — T6 → `quick`

---

## TODOs

- [ ] 1. Enhance wireSimplifier.ts with Endpoint-State Aware Segment Decomposition

  **What to do**:
  - Add a `decomposeWireToSegments(wire: Wire, geom: GeomApi)` function to `wireSimplifier.ts` that returns an array of `SegmentView` objects. Each `SegmentView` contains: `wireId`, `segmentIndex` (in the polyline), `direction` ('H'|'V'), `start`/`end` positions, `startState`/`endState` ('free'|'port'|'junction'), and mapping back to handle indices.
  - The `SegmentView` type should be defined in `wireSimplifier.ts` (NOT in types.ts — it's an internal utility type, not a domain type).
  - Enhance `ensureMovableSegment` to handle junction endpoints correctly (currently only handles port endpoints via `insertStubAfterStart`/`insertStubBeforeEnd`). For junctions, the neighbor segment should adjust length rather than insert a new stub.
  - Add a higher-level function `moveSegmentInPolyline(wire: Wire, segIndex: number, perpDelta: number, geom: GeomApi): { handles: WireHandle[] | undefined }` that orchestrates the full flow: `buildWirePolyline → ensureMovableSegment → dragSegment → simplifyOrthogonal → polylineToHandles`.
  - Write comprehensive unit tests in `src/components/OneCanvas/utils/__tests__/wireSegmentMovement.test.ts` covering:
    - Port-connected H segment dragged Y → compensation V segment created
    - Port-connected V segment dragged X → compensation H segment created
    - Both ends port-connected → double compensation (wire becomes 3+ segments)
    - Junction-connected end → neighbor segment length adjusts
    - Free end → no compensation needed
    - Zero-length segment after drag → collapsed/removed by simplifyOrthogonal
    - Wire with no handles (2-point wire) → ensureMovableSegment creates handles
    - Wire with 1 handle (2-segment wire) → correct segment index handling

  **Must NOT do**:
  - Do NOT add types to `types.ts`
  - Do NOT modify the `Wire` or `WireHandle` type definitions
  - Do NOT touch `rubberBand.ts`
  - Do NOT add rendering or visual changes

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Pure function development with complex geometric edge cases requiring careful analysis
  - **Skills**: []
    - No special skills needed — this is pure TypeScript logic
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser automation needed
    - `frontend-ui-ux`: No UI changes

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/components/OneCanvas/utils/wireSimplifier.ts:307-319` — `getSegmentOrientation`: returns H/V based on actual geometry. Use this for direction classification.
  - `src/components/OneCanvas/utils/wireSimplifier.ts:321-360` — `ensureMovableSegment`: inserts stub segments at start/end of polyline. This is the existing compensation pattern — enhance it, don't rewrite.
  - `src/components/OneCanvas/utils/wireSimplifier.ts:362-383` — `dragSegment`: moves a segment perpendicularly. This is the core movement logic — already correct.
  - `src/components/OneCanvas/utils/wireSimplifier.ts:221-252` — `polylineToHandles`: converts polyline back to WireHandle[]. Preserves IDs and sources from previous handles.
  - `src/components/OneCanvas/utils/wireSimplifier.ts:167-219` — `buildWirePolyline` / `buildCanonicalWirePolyline`: constructs polyline from wire. Use `buildWirePolyline` for the simple case.
  - `src/components/OneCanvas/utils/wireSimplifier.ts:87-163` — `simplifyOrthogonal`: merges collinear points, removes zero-length. Call after dragSegment.
  - `src/components/OneCanvas/utils/wireSimplifier.ts:254-264` — `simplifyWireHandles`: full pipeline example (build→simplify→toHandles). Follow this pattern.

  **API/Type References** (contracts to implement against):
  - `src/components/OneCanvas/types.ts:675-684` — `WireHandle` interface: `position`, `constraint`, `source`, optional `id`
  - `src/components/OneCanvas/types.ts:629-659` — `WireEndpoint` = `PortEndpoint | JunctionEndpoint`. Use `isPortEndpoint()` and `isJunctionEndpoint()` type guards.
  - `src/components/OneCanvas/types.ts:726-729` — `GeomApi` interface: `components: Map<string, Block>`, `junctions: Map<string, Junction>`
  - `src/components/OneCanvas/types.ts:687-716` — `Wire` interface: `from`, `to`, `handles?`, `routingMode?`

  **Test References** (testing patterns to follow):
  - `src/components/OneCanvas/interaction/__tests__/wireSegmentDrag.test.ts` — Follow this test structure: `makeWire()` helper, `makeHandle()` helper, direct store state setup
  - `src/components/OneCanvas/utils/__tests__/buildCanonicalWirePolyline.test.ts` — Follow this for wireSimplifier function testing patterns

  **WHY Each Reference Matters**:
  - `wireSimplifier.ts` functions are the FOUNDATION — the new code orchestrates these existing functions into a higher-level flow, it does NOT rewrite them
  - `WireHandle` type defines the output contract — `polylineToHandles` produces these
  - `WireEndpoint` discriminated union determines endpoint state classification (port vs junction)
  - Existing test patterns ensure consistency with the codebase's test conventions

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Port-connected H segment moved Y
    Tool: Bash (pnpm run test)
    Preconditions: Test file created at src/components/OneCanvas/utils/__tests__/wireSegmentMovement.test.ts
    Steps:
      1. Create a wire connecting two ports with H segment between them
      2. Call moveSegmentInPolyline with perpDelta=40 on the H segment
      3. Assert: resulting handles contain compensation V segments at port ends
      4. Assert: the H segment's Y position shifted by 40
      5. Assert: resulting polyline is fully orthogonal
    Expected Result: All assertions pass, handles array reflects compensation + movement
    Failure Indicators: Non-orthogonal output, missing compensation, incorrect delta
    Evidence: .sisyphus/evidence/task-1-port-h-segment-move.txt

  Scenario: Wire with no handles (2-point wire) gets movable
    Tool: Bash (pnpm run test)
    Preconditions: Same test file
    Steps:
      1. Create a wire with no handles (from/to endpoints only)
      2. Call moveSegmentInPolyline on segment 0
      3. Assert: ensureMovableSegment creates interior handles
      4. Assert: movement applied correctly
    Expected Result: 2-point wire correctly decomposed and moved
    Failure Indicators: Error thrown, handles not created
    Evidence: .sisyphus/evidence/task-1-two-point-wire.txt

  Scenario: Zero-length segment collapses
    Tool: Bash (pnpm run test)
    Preconditions: Same test file
    Steps:
      1. Create wire with compensation segment
      2. Move segment back to original position (perpDelta reverses)
      3. Assert: simplifyOrthogonal removes the zero-length segment
    Expected Result: No zero-length segments in output
    Failure Indicators: Zero-length segments remain
    Evidence: .sisyphus/evidence/task-1-zero-length-collapse.txt
  ```

  **Evidence to Capture:**
  - [ ] Each evidence file named: task-1-{scenario-slug}.txt
  - [ ] Terminal output from pnpm run test showing pass/fail per test case

  **Commit**: YES (groups with Task 2)
  - Message: `refactor(wire): enhance wireSimplifier with endpoint-state segment decomposition`
  - Files: `src/components/OneCanvas/utils/wireSimplifier.ts`, `src/components/OneCanvas/utils/__tests__/wireSegmentMovement.test.ts`
  - Pre-commit: `pnpm run test -- --run src/components/OneCanvas/utils/__tests__/wireSegmentMovement.test.ts`

- [ ] 2. Validate Segment Orientation Geometry Inference

  **What to do**:
  - Write unit tests in `src/components/OneCanvas/utils/__tests__/segmentOrientation.test.ts` that prove `getSegmentOrientation` (from wireSimplifier.ts) returns correct results for all relevant wire shapes:
    - Standard L-shaped wire (one H, one V segment)
    - Wire with 3+ consecutive same-direction segments in a row
    - Wire with only 2 points (single segment, no handles)
    - Near-zero-length segment (degenerate case)
    - 45° diagonal-ish segment (should still pick dominant axis)
  - These tests validate that the geometry-based inference in `getSegmentOrientation` is reliable enough to replace `inferSegmentOrientation`'s broken `subIndex % 2` heuristic.
  - If any test reveals a bug in `getSegmentOrientation`, fix it.

  **Must NOT do**:
  - Do NOT modify `inferSegmentOrientation` in InteractionController — that's Task 5's job
  - Do NOT change the function signature of `getSegmentOrientation`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single test file creation, straightforward assertions
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `src/components/OneCanvas/utils/wireSimplifier.ts:307-319` — `getSegmentOrientation` function being tested. Uses `Math.abs(a.y - b.y) < Math.abs(a.x - b.x)` to determine H vs V.

  **Test References**:
  - `src/components/OneCanvas/utils/__tests__/buildCanonicalWirePolyline.test.ts` — Follow this test file structure and import patterns

  **WHY Each Reference Matters**:
  - The function being tested is the replacement for the broken `subIndex % 2` heuristic — its correctness is critical for the entire segment movement model

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All orientation tests pass
    Tool: Bash (pnpm run test)
    Preconditions: Test file created at src/components/OneCanvas/utils/__tests__/segmentOrientation.test.ts
    Steps:
      1. Run pnpm run test -- --run src/components/OneCanvas/utils/__tests__/segmentOrientation.test.ts
      2. Assert: all tests pass
    Expected Result: 0 failures, 5+ test cases covering all wire shapes
    Failure Indicators: Any test failure, or fewer than 5 test cases
    Evidence: .sisyphus/evidence/task-2-orientation-tests.txt

  Scenario: getSegmentOrientation handles degenerate case
    Tool: Bash (pnpm run test)
    Preconditions: Same test file includes degenerate case test
    Steps:
      1. Test a polyline where segment start and end are the same point
      2. Assert: function returns 'vertical' (or doesn't crash)
    Expected Result: No exception thrown for degenerate input
    Failure Indicators: Unhandled exception
    Evidence: .sisyphus/evidence/task-2-degenerate-case.txt
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from test run

  **Commit**: YES (groups with Task 1)
  - Message: `test(wire): validate geometry-based segment orientation inference`
  - Files: `src/components/OneCanvas/utils/__tests__/segmentOrientation.test.ts`
  - Pre-commit: `pnpm run test -- --run src/components/OneCanvas/utils/__tests__/segmentOrientation.test.ts`

- [ ] 3. Refactor canvasStore.moveWireSegment to Polyline-Based Flow

  **What to do**:
  - Refactor `canvasStore.ts::moveWireSegment` (lines 1045-1077) to use the new polyline-based flow instead of raw handle delta application.
  - The new internal flow: `buildWirePolyline(wire, geom) → ensureMovableSegment(poly, segIndex) → dragSegment(ensured.poly, ensured.segIndex, perpDelta) → simplifyOrthogonal(dragged) → polylineToHandles(simplified, wire.handles, 'user')`.
  - **Keep the existing function signature**: `moveWireSegment(wireId, handleIndexA, handleIndexB, delta, isFirstMove)`. Internally convert the `handleIndexA` to a polyline `segIndex`. The `handleIndexA` maps to `segIndex = handleIndexA + 1` in the polyline (since polyline[0] is the `from` endpoint position, not a handle).
  - Convert `delta: Position` (which has both x and y) to `perpDelta: number` using the segment orientation: if H segment, perpDelta = delta.y; if V segment, perpDelta = delta.x.
  - Preserve the `isFirstMove` history snapshot pattern (pushHistorySnapshot only on first move).
  - Set `wire.routingMode = 'manual'` after a user segment drag.
  - After setting new handles, call `simplifyOrthogonal` to remove zero-length segments.
  - Write unit tests in `src/stores/__tests__/moveWireSegmentPolyline.test.ts` covering:
    - Single segment drag with known delta → handles at expected positions
    - Multiple incremental drags → no delta amplification (regression check)
    - Port-connected wire → compensation handles created
    - Zero delta → no-op (handles unchanged)
    - routingMode set to 'manual' after drag
  - Also verify existing `wireSegmentDrag.test.ts` tests still pass (they test the store action directly).

  **Must NOT do**:
  - Do NOT change the function signature of `moveWireSegment`
  - Do NOT change the facade interface (6 files propagate this action)
  - Do NOT modify other store actions (insertEndpointHandle, cleanupOverlappingHandles)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Core store refactoring with complex delta-to-perpDelta conversion and history management
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 2

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `src/stores/canvasStore.ts:1045-1077` — Current `moveWireSegment` implementation. Replace the body but keep the signature and `set()` wrapper pattern.
  - `src/stores/canvasStore.ts:1079-1105` — `insertEndpointHandle`: this may no longer be needed for segment drag (since `ensureMovableSegment` handles compensation internally). But keep it as a public action — other callers may use it.
  - `src/stores/canvasStore.ts:1107-1123` — `cleanupOverlappingHandles`: calls `simplifyWireHandles`. The new flow already simplifies, but InteractionController._handleSegmentDraggingUp still calls this, so keep it.
  - `src/components/OneCanvas/utils/wireSimplifier.ts:254-264` — `simplifyWireHandles`: pipeline pattern to follow (build→simplify→toHandles).

  **API/Type References**:
  - `src/components/OneCanvas/utils/wireSimplifier.ts` — All functions from Task 1: `buildWirePolyline`, `ensureMovableSegment`, `dragSegment`, `simplifyOrthogonal`, `polylineToHandles`, `getSegmentOrientation`
  - `src/components/OneCanvas/types.ts:726-729` — `GeomApi` interface needed for buildWirePolyline

  **Test References**:
  - `src/components/OneCanvas/interaction/__tests__/wireSegmentDrag.test.ts` — MUST PASS after refactoring (regression)

  **WHY Each Reference Matters**:
  - The store action is the single point of truth for wire mutation — all UI flows go through it
  - The facade propagation chain means ANY signature change requires updating 6 files — avoid this
  - Existing regression tests catch the delta amplification bug that was fixed before — must not regress

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Existing wireSegmentDrag regression tests pass
    Tool: Bash (pnpm run test)
    Preconditions: canvasStore.moveWireSegment refactored to polyline flow
    Steps:
      1. Run pnpm run test -- --run src/components/OneCanvas/interaction/__tests__/wireSegmentDrag.test.ts
      2. Assert: all 8 existing tests pass
    Expected Result: 0 failures, all existing tests green
    Failure Indicators: Any test failure indicates regression
    Evidence: .sisyphus/evidence/task-3-regression-tests.txt

  Scenario: New polyline-flow store tests pass
    Tool: Bash (pnpm run test)
    Preconditions: New test file created
    Steps:
      1. Run pnpm run test -- --run src/stores/__tests__/moveWireSegmentPolyline.test.ts
      2. Assert: all new tests pass
    Expected Result: Tests for delta conversion, compensation, routingMode transition all pass
    Failure Indicators: Any new test failure
    Evidence: .sisyphus/evidence/task-3-polyline-flow-tests.txt

  Scenario: No facade signature change
    Tool: Bash (pnpm run build)
    Preconditions: moveWireSegment signature unchanged
    Steps:
      1. Run pnpm run build
      2. Assert: 0 type errors
    Expected Result: Build succeeds — proves facade chain intact
    Failure Indicators: Type errors in facade files
    Evidence: .sisyphus/evidence/task-3-build-check.txt
  ```

  **Evidence to Capture:**
  - [ ] Regression test output
  - [ ] New test output
  - [ ] Build output

  **Commit**: YES
  - Message: `refactor(wire): replace moveWireSegment with polyline-based segment flow`
  - Files: `src/stores/canvasStore.ts`, `src/stores/__tests__/moveWireSegmentPolyline.test.ts`
  - Pre-commit: `pnpm run test -- --run src/components/OneCanvas/interaction/__tests__/wireSegmentDrag.test.ts`

- [ ] 4. Update HitTester to Include Segment Orientation in Results

  **What to do**:
  - Modify `HitTester._testWireSegments` (lines 290-328 of HitTester.ts) to compute and include actual segment orientation in the returned `HitTestResult`.
  - After finding the nearest segment (existing logic), compute its orientation using the two endpoint positions: `Math.abs(a.y - b.y) < Math.abs(a.x - b.x) ? 'horizontal' : 'vertical'`. This is the same logic as `getSegmentOrientation` but applied inline without importing it (HitTester operates on handle positions directly, not polylines).
  - Add a new optional field to `HitTestResult` in `types.ts`: `segmentOrientation?: 'horizontal' | 'vertical'`. This is the ONLY types.ts change allowed.
  - Set this field when returning a segment hit result.
  - This allows InteractionController to read the orientation directly from the hit test result instead of using the broken `subIndex % 2` heuristic.

  **Must NOT do**:
  - Do NOT change the hit testing algorithm or radius
  - Do NOT import `wireSimplifier.ts` into `HitTester.ts` — compute orientation inline from the two handle positions
  - Do NOT add any other fields to HitTestResult

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, targeted change — add ~5 lines of orientation computation + 1 field to type
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `src/components/OneCanvas/core/HitTester.ts:290-328` — `_testWireSegments` method. Add orientation computation after line 313 (where `nearestSegIndex` is set).
  - `src/components/OneCanvas/core/HitTester.ts:321-327` — Return object. Add `segmentOrientation` field here.

  **API/Type References**:
  - `src/components/OneCanvas/types.ts:1047-1056` — `HitTestResult` interface. Add `segmentOrientation?: 'horizontal' | 'vertical'` field.

  **WHY Each Reference Matters**:
  - HitTester is the source of truth for what the user clicked — adding orientation here eliminates the need for the broken `subIndex % 2` inference downstream
  - HitTestResult is the contract between HitTester and InteractionController — adding one optional field is backward-compatible

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Build succeeds with new HitTestResult field
    Tool: Bash (pnpm run build)
    Preconditions: segmentOrientation field added to HitTestResult
    Steps:
      1. Run pnpm run build
      2. Assert: 0 type errors
    Expected Result: Build succeeds — new optional field is backward-compatible
    Failure Indicators: Type errors in files reading HitTestResult
    Evidence: .sisyphus/evidence/task-4-build-check.txt

  Scenario: Existing tests pass
    Tool: Bash (pnpm run test)
    Preconditions: HitTester modified
    Steps:
      1. Run pnpm run test
      2. Assert: no regressions
    Expected Result: All tests pass
    Failure Indicators: Any test failure related to hit testing
    Evidence: .sisyphus/evidence/task-4-test-check.txt
  ```

  **Evidence to Capture:**
  - [ ] Build output
  - [ ] Test output

  **Commit**: YES (groups with Task 3)
  - Message: `refactor(wire): add segment orientation to HitTestResult`
  - Files: `src/components/OneCanvas/types.ts`, `src/components/OneCanvas/core/HitTester.ts`
  - Pre-commit: `pnpm run build`

- [ ] 5. Update InteractionController to Use New Segment Flow

  **What to do**:
  - Refactor `InteractionController._startWireSegmentDragging` (lines 820-877):
    - Replace `inferSegmentOrientation(target)` with `target.segmentOrientation` (from HitTester, Task 4). Fall back to computing from polyline if undefined.
    - Remove the manual `insertEndpointHandle` calls (lines 845-861). Compensation is now handled inside `canvasStore.moveWireSegment` via `ensureMovableSegment`.
    - Simplify handle index tracking: the store now receives the original `subIndex` from the hit test and handles the polyline-level indexing internally.
  - Refactor `_handleSegmentDraggingMove` (lines 879-904):
    - Keep `snapDelta` and `constrainSegmentDelta` logic (these are correct).
    - Keep the incremental delta pattern (computing `incrementalDelta` from `_segmentPrevDelta`).
    - The store action now correctly interprets delta based on segment orientation.
  - Refactor `_handleSegmentDraggingUp` (lines 906-920):
    - Keep calling `cleanupOverlappingHandles` (it's harmless and catches edge cases).
    - Reset all tracking state (same as current).
  - Remove the `inferSegmentOrientation` helper function (lines 1132-1137). It's dead code after this change.
  - Remove the `resolvePortEndpointPosition` helper function (lines 1139-1155) if it becomes dead code (it was only used for `insertEndpointHandle` calls).
  - Verify `constrainSegmentDelta` helper still works correctly with the new orientation source.

  **Must NOT do**:
  - Do NOT touch `wire_handle_dragging` mode (lines 926-993)
  - Do NOT touch wire drawing mode (`_handleWireDrawingDown`, `_handleWireDrawingMove`, `_handleWireDrawingUp`)
  - Do NOT change EventBridge or KeyboardShortcuts
  - Do NOT add new interaction states to the state machine
  - Do NOT add visual feedback or overlays

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Integration work connecting multiple subsystems (HitTester, store, interaction controller). Requires understanding the full flow.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser automation needed
    - `frontend-ui-ux`: No UI changes

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (solo)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 3, 4

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `src/components/OneCanvas/interaction/InteractionController.ts:820-877` — `_startWireSegmentDragging`: Remove `insertEndpointHandle` calls, use `target.segmentOrientation` instead of `inferSegmentOrientation(target)`
  - `src/components/OneCanvas/interaction/InteractionController.ts:879-904` — `_handleSegmentDraggingMove`: Keep incremental delta pattern, store handles polyline internally
  - `src/components/OneCanvas/interaction/InteractionController.ts:906-920` — `_handleSegmentDraggingUp`: Keep cleanupOverlappingHandles call, reset tracking state
  - `src/components/OneCanvas/interaction/InteractionController.ts:1132-1137` — `inferSegmentOrientation`: DELETE this function (replaced by HitTestResult.segmentOrientation)
  - `src/components/OneCanvas/interaction/InteractionController.ts:1139-1155` — `resolvePortEndpointPosition`: DELETE if dead code after removing insertEndpointHandle calls

  **API/Type References**:
  - `src/components/OneCanvas/types.ts:HitTestResult` — Now includes `segmentOrientation?: 'horizontal' | 'vertical'` from Task 4
  - `src/types/canvasFacade.ts` — `moveWireSegment` signature (must remain compatible)

  **Test References**:
  - `src/components/OneCanvas/interaction/__tests__/wireSegmentDrag.test.ts` — MUST PASS. These test the store action directly, which is unchanged in signature.

  **WHY Each Reference Matters**:
  - InteractionController is the bridge between user input and store mutations — it must correctly translate pointer events to the store API
  - The `insertEndpointHandle` removal is safe because compensation now lives inside the store action via `ensureMovableSegment`
  - `resolvePortEndpointPosition` deletion is safe only if no other code uses it — use `lsp_find_references` to verify before deleting

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full test suite passes after InteractionController refactoring
    Tool: Bash (pnpm run test)
    Preconditions: InteractionController refactored
    Steps:
      1. Run pnpm run test
      2. Assert: 0 failures
    Expected Result: All tests pass including wireSegmentDrag regression tests
    Failure Indicators: Any test failure
    Evidence: .sisyphus/evidence/task-5-full-test.txt

  Scenario: Build succeeds with no type errors
    Tool: Bash (pnpm run build)
    Preconditions: Dead code removed, orientation source changed
    Steps:
      1. Run pnpm run build
      2. Assert: 0 type errors
    Expected Result: Clean build — all type contracts satisfied
    Failure Indicators: Type errors in InteractionController or consuming files
    Evidence: .sisyphus/evidence/task-5-build-check.txt

  Scenario: inferSegmentOrientation is fully removed
    Tool: Bash (grep)
    Preconditions: InteractionController refactored
    Steps:
      1. Search for 'inferSegmentOrientation' in the entire src/ directory
      2. Assert: 0 matches found
    Expected Result: Function fully removed, no dead references
    Failure Indicators: Any remaining reference
    Evidence: .sisyphus/evidence/task-5-dead-code-check.txt
  ```

  **Evidence to Capture:**
  - [ ] Full test output
  - [ ] Build output
  - [ ] Dead code grep output

  **Commit**: YES
  - Message: `refactor(wire): update InteractionController to segment-first model`
  - Files: `src/components/OneCanvas/interaction/InteractionController.ts`
  - Pre-commit: `pnpm run test && pnpm run build`

- [ ] 6. Full Regression and Build Verification

  **What to do**:
  - Run the complete test suite: `pnpm run test`
  - Run the full build: `pnpm run build`
  - Verify no facade signature changes leaked by checking `pnpm run build` succeeds without type errors.
  - Verify Wire/WireHandle/WireEndpoint types are unchanged by diffing types.ts (only allowed change: `segmentOrientation` optional field on `HitTestResult`).
  - Run a targeted check: `pnpm run test -- --run src/components/OneCanvas/interaction/__tests__/wireSegmentDrag.test.ts` to confirm the most critical regression tests pass.

  **Must NOT do**:
  - Do NOT make any code changes — this is verification only

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure verification — run commands, check output
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (solo)
  - **Blocks**: None (final task before verification wave)
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - All files modified in Tasks 1-5

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full test suite passes
    Tool: Bash
    Steps:
      1. Run pnpm run test
      2. Assert: 0 failures
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-6-full-test.txt

  Scenario: Full build succeeds
    Tool: Bash
    Steps:
      1. Run pnpm run build
      2. Assert: 0 type errors
    Expected Result: Clean build
    Evidence: .sisyphus/evidence/task-6-build.txt

  Scenario: types.ts diff is minimal
    Tool: Bash (git diff)
    Steps:
      1. Run git diff HEAD -- src/components/OneCanvas/types.ts
      2. Assert: only change is segmentOrientation field on HitTestResult
    Expected Result: No unauthorized type changes
    Evidence: .sisyphus/evidence/task-6-types-diff.txt
  ```

  **Evidence to Capture:**
  - [ ] Full test output
  - [ ] Full build output
  - [ ] types.ts diff

  **Commit**: NO (verification only)

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm run build` + `pnpm run test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `refactor(wire): enhance wireSimplifier with endpoint-state decomposition` — wireSimplifier.ts, new test file
- **Wave 2**: `refactor(wire): replace moveWireSegment with polyline-based flow` — canvasStore.ts, HitTester.ts, new test file
- **Wave 3**: `refactor(wire): update InteractionController to segment-first model` — InteractionController.ts
- **Wave 4**: No commit (verification only)

---

## Success Criteria

### Verification Commands
```bash
pnpm run test   # Expected: all tests pass, 0 failures
pnpm run build  # Expected: success, 0 type errors
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (existing + new)
- [ ] Build succeeds with zero type errors
- [ ] Facade interface unchanged (moveWireSegment signature compatible)
- [ ] No changes to Wire/WireHandle/WireEndpoint types
