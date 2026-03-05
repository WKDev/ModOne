# Fix clearActiveTool Test Failure

## TL;DR

> **Quick Summary**: Fix the pre-existing unit test failure in `useLadderKeyboardShortcuts.test.tsx` caused by an incomplete Zustand store mock missing `clearActiveTool` and `activeTool`.
> 
> **Deliverables**:
> - Fixed test mock in `useLadderKeyboardShortcuts.test.tsx`
> - Updated test to cover both Escape paths (active tool vs no active tool)
> 
> **Estimated Effort**: Quick
> **Parallel Execution**: NO — single task
> **Critical Path**: Task 1 only

---

## Context

### Original Request
Fix the 1 pre-existing unit test failure: `store.clearActiveTool is not a function` in `useLadderKeyboardShortcuts.test.tsx`.

### Root Cause Analysis
The test mock for `useLadderUIStore` (lines 24-35) is incomplete:
1. `getState()` return is missing `clearActiveTool` function
2. `getState()` return is missing `activeTool` property
3. The hook's `handleEscape` (line 335) calls `useLadderUIStore.getState()` then checks `if (store.activeTool !== null)` → calls `store.clearActiveTool()` vs `store.clearSelection()`
4. Since mock doesn't provide `activeTool`, it's `undefined`, and `undefined !== null` is `true`, so it tries to call `clearActiveTool()` which doesn't exist → crash

### Key Files
- **Test file**: `src/components/LadderEditor/hooks/__tests__/useLadderKeyboardShortcuts.test.tsx`
- **Hook under test**: `src/components/LadderEditor/hooks/useLadderKeyboardShortcuts.ts`
- **Store**: `src/stores/ladderUIStore.ts`

---

## Work Objectives

### Core Objective
Make the failing test pass by completing the mock AND adding proper test coverage for both Escape key paths.

### Concrete Deliverables
- Updated `useLadderKeyboardShortcuts.test.tsx` with complete mock + 2 Escape test cases

### Definition of Done
 [x] `pnpm test` → 680/680 passing, 0 failures

### Must Have
- `clearActiveTool` mock function in `getState()` return
- `activeTool` property in mock state (default `null`)
- Test case: Escape when `activeTool === null` → calls `clearSelection()`
- Test case: Escape when `activeTool !== null` → calls `clearActiveTool()`

### Must NOT Have (Guardrails)
- Do NOT modify the hook implementation (`useLadderKeyboardShortcuts.ts`)
- Do NOT modify the store implementation (`ladderUIStore.ts`)
- Do NOT add unnecessary mock functions beyond what's needed
- Do NOT restructure or rewrite existing passing tests

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **Automated tests**: YES (Tests-after — fixing existing test)
- **Framework**: Vitest via `pnpm test`

### QA Policy
Evidence saved to `.sisyphus/evidence/task-1-*.txt`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Single task):
└── Task 1: Fix test mock + add Escape path coverage [quick]

Wave FINAL (After Task 1):
└── Task F1: Run full test suite to verify no regressions [quick]
```

### Dependency Matrix
- **1**: None — —
- **F1**: 1 — —

### Agent Dispatch Summary
- **1**: **1** — T1 → `quick`
- **FINAL**: **1** — F1 → `quick`

---

## TODOs

 [x] 1. Fix useLadderKeyboardShortcuts test mock and add Escape path coverage

  **What to do**:
  - Add `const mockClearActiveTool = vi.fn();` near the other mock declarations (line ~16)
  - Add `activeTool: null` to `getState()` return object (line ~27)
  - Add `clearActiveTool: mockClearActiveTool` to `getState()` return object (line ~28)
  - Also add `activeTool: null` to `uiStoreState` initial value OR spread it into `getState()` (it's already spread via `...uiStoreState`, so adding `activeTool: null` to the explicit properties after the spread is sufficient)
  - Split the existing "should clear selection on Escape" test into TWO tests:
    1. `should clear selection on Escape when no active tool` — keep `activeTool: null` (default), press Escape, expect `mockClearSelection` called once
    2. `should clear active tool on Escape when tool is active` — set `uiStoreState.activeTool = 'contact_no'` in a `beforeEach` or inline, press Escape, expect `mockClearActiveTool` called once, expect `mockClearSelection` NOT called
  - Add `mockClearActiveTool.mockClear()` to the `beforeEach` block (line ~100)

  **Must NOT do**:
  - Do NOT touch `useLadderKeyboardShortcuts.ts` or `ladderUIStore.ts`
  - Do NOT restructure other tests
  - Do NOT add unrelated mock methods

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-file test fix, well-understood root cause, minimal scope
  - **Skills**: `[]`
    - No special skills needed — pure TypeScript/Vitest test editing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (solo)
  - **Blocks**: F1
  - **Blocked By**: None

  **References**:

  **Pattern References** (existing code to follow):
  - `src/components/LadderEditor/hooks/__tests__/useLadderKeyboardShortcuts.test.tsx:13-16` — Existing mock fn declarations (follow this pattern for `mockClearActiveTool`)
  - `src/components/LadderEditor/hooks/__tests__/useLadderKeyboardShortcuts.test.tsx:24-35` — The incomplete mock to fix
  - `src/components/LadderEditor/hooks/__tests__/useLadderKeyboardShortcuts.test.tsx:257-265` — The failing test to split into two

  **API/Type References** (contracts to implement against):
  - `src/stores/ladderUIStore.ts:33` — `LadderUIActions` interface shows `clearActiveTool: () => void`
  - `src/stores/ladderUIStore.ts:156-165` — `clearActiveTool` implementation (sets `activeTool = null`, `lastWireVPlacement = null`)

  **Behavioral References** (the hook logic being tested):
  - `src/components/LadderEditor/hooks/useLadderKeyboardShortcuts.ts:335-342` — `handleEscape` callback: checks `activeTool !== null` to decide between `clearActiveTool()` vs `clearSelection()`

  **WHY Each Reference Matters**:
  - Lines 13-16: Follow exact same `vi.fn()` pattern for the new mock
  - Lines 24-35: This is THE code to fix — add `activeTool` and `clearActiveTool`
  - Lines 257-265: This is THE failing test — split into two cases
  - Store line 33: Confirms the method signature the mock must match
  - Hook lines 335-342: Confirms the branching logic the tests must cover

  **Acceptance Criteria**:

  - [x] `mockClearActiveTool` declared alongside other mock fns
  - [x] `activeTool: null` and `clearActiveTool: mockClearActiveTool` in `getState()` return
  - [x] Test: "should clear selection on Escape when no active tool" passes
  - [x] Test: "should clear active tool on Escape when tool is active" passes
  - [x] `pnpm test src/components/LadderEditor/hooks/__tests__/useLadderKeyboardShortcuts.test.tsx` → ALL PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All tests in file pass
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: pnpm test src/components/LadderEditor/hooks/__tests__/useLadderKeyboardShortcuts.test.tsx
      2. Assert: exit code 0
      3. Assert: output contains "0 failed"
      4. Assert: output shows both new Escape test names passing
    Expected Result: All tests pass including the two new Escape tests
    Failure Indicators: Any test failure, non-zero exit code
    Evidence: .sisyphus/evidence/task-1-unit-tests-pass.txt

  Scenario: Full test suite regression check
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: pnpm test
      2. Assert: exit code 0
      3. Assert: output shows 0 failed (previously was 1 failed)
      4. Assert: total test count is 680 (was 679 passing + 1 failing, now all 680 pass)
    Expected Result: 680/680 passing, 0 failures
    Failure Indicators: Any failure count > 0
    Evidence: .sisyphus/evidence/task-1-full-suite-regression.txt
  ```

  **Evidence to Capture:**
  - [ ] task-1-unit-tests-pass.txt — output of targeted test run
  - [ ] task-1-full-suite-regression.txt — output of full `pnpm test`

  **Commit**: YES
  - Message: `fix(test): complete useLadderKeyboardShortcuts mock with clearActiveTool`
  - Files: `src/components/LadderEditor/hooks/__tests__/useLadderKeyboardShortcuts.test.tsx`
  - Pre-commit: `pnpm test src/components/LadderEditor/hooks/__tests__/useLadderKeyboardShortcuts.test.tsx`

---

## Final Verification Wave

 [x] F1. **Full Test Suite Regression** — `quick`
  Run `pnpm test` and `pnpm run build`. Verify 0 failures in both. Compare test count (should be 680+ vs previous 679 passing).
  Output: `Tests [N pass/0 fail] | Build [PASS/FAIL] | VERDICT: APPROVE/REJECT`

---

## Commit Strategy

- **1**: `fix(test): complete useLadderKeyboardShortcuts mock with clearActiveTool` — `src/components/LadderEditor/hooks/__tests__/useLadderKeyboardShortcuts.test.tsx`, `pnpm test`

---

## Success Criteria

### Verification Commands
```bash
pnpm test  # Expected: 680 passed, 0 failed
pnpm run build  # Expected: 0 errors
```

### Final Checklist
 [x] `clearActiveTool` mock added to test
 [x] `activeTool` property in mock state
 [x] Both Escape paths tested
 [x] 0 test failures in full suite
 [x] Build still clean