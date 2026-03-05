# Custom Symbol Infrastructure for OneCanvas

## TL;DR

> **Quick Summary**: OneCanvas에 사용자 정의 심볼 생성/편집/관리 인프라를 추가하고, 기존 22개 빌트인 블록을 점진적으로 심볼 시스템으로 마이그레이션. KiCad Symbol Editor를 벤치마크한 전용 캔버스 에디터, 2-tier 라이브러리 (프로젝트+글로벌), JSON 기반 심볼 포맷, 20px 그리드 스냅 핀 좌표계를 구축.
> 
> **Deliverables**:
> - 심볼 데이터 모델 + TypeScript 타입 시스템 + JSON 스키마
> - 심볼 렌더러 (벡터 프리미티브 → SVG 렌더링)
> - 전용 심볼 에디터 캔버스 (드로잉 + 핀 배치 + 프로퍼티)
> - 2-tier 라이브러리 관리 시스템 (프로젝트/글로벌 + 브라우저 UI)
> - Tauri 백엔드 심볼 CRUD 커맨드
> - 기존 22개 빌트인 블록의 심볼 시스템 마이그레이션
> - 직렬화/역직렬화 + 레거시 프로젝트 호환성
> 
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 8 waves
> **Critical Path**: Cleanup → Data Model → Symbol Renderer → Editor UI → Library → Port Migration → Built-in Migration → Verification

---

## Context

### Original Request
OneCanvas에서 사용할 심볼들에 대해 유저가 생성 및 편집, 관리할 수 있도록 하는 인프라 추가. KiCad Symbol Editor를 벤치마크.

### Interview Summary
**Key Discussions**:
- **에디터 형태**: 전용 캔버스 에디터 (KiCad 패턴)
- **저장 범위**: 프로젝트 + 글로벌 2-tier
- **심볼 상속**: v2로 연기 (Metis 권고 반영)
- **핀 전기 타입**: 5종 (Input, Output, Bidirectional, Power, Passive)
- **빌트인 마이그레이션**: 점진적 (심볼 시스템 → custom 블록 → 빌트인 순차)
- **멀티유닛**: 포함 (릴레이 coil+contact 패턴)
- **시뮬레이션**: 제외 (별도 계획)
- **그리드**: 20px (OneCanvas와 동일), 핀은 KiCad 방식 절대 좌표
- **테스트**: Tests-after (Vitest) + Playwright QA

**Research Findings**:
- KiCad: 전용 서브앱, 벡터 프리미티브, 12 핀 타입 (→ 5종 단순화), sym-lib-table 2-tier, extends 상속
- 현재 OneCanvas: 22 하드코딩 블록, 6곳 수정 필요, offset 비율 포트 (그리드 미정렬 위험)
- 기존 `symbolEditor.ts` 553줄 — 완전 데드코드 (import 0, localStorage 사용)
- 두 개의 BlockRenderer.tsx 존재 (components/ + content/)
- 기존 블록 크기 중 20px 배수가 아닌 것 다수 (50, 70, 24, 32 등)

### Metis Review
**Identified Gaps** (addressed):
- **기존 프로젝트 호환성**: forward migration in serialization.ts 필수 → Phase 1에 포함
- **Properties Panel**: 빌트인은 전용 패널 유지, 커스텀만 제네릭 → 마이그레이션 가드레일에 반영
- **Port 좌표계 변경**: 9+ 파일 영향 → 블록 마이그레이션과 별도 phase로 분리
- **BlockType 타입 안전성**: additive approach (기존 union 유지 + 'custom_symbol' 추가)
- **Dead code**: symbolEditor.ts 삭제, BlockRenderer 통합을 Phase 0으로
- **심볼 상속**: 복잡도 높음 → v2 연기
- **블록 크기 제약**: 기존 크기 유지 (20px 배수 강제하지 않음), 커스텀 심볼만 20px 배수 제약
- **런타임 상태**: 시뮬레이션 제외하되, 데이터 모델에 runtimeStateSchema 슬롯 확보

---

## Work Objectives

### Core Objective
사용자가 OneCanvas 심볼을 시각적으로 생성/편집하고, 라이브러리로 관리하며, 캔버스에 배치하여 와이어링할 수 있는 완전한 인프라 구축. 기존 빌트인 블록을 점진적으로 이 시스템으로 마이그레이션.

### Concrete Deliverables
- `src/types/symbol.ts` — 심볼 데이터 모델 + TypeScript 타입
- `src/components/SymbolEditor/` — 전용 캔버스 에디터 컴포넌트
- `src/components/OneCanvas/components/SymbolRenderer.tsx` — 제네릭 심볼 렌더러
- `src/services/symbolService.ts` — Tauri 커맨드 래퍼
- `src/stores/symbolStore.ts` — Zustand 심볼 라이브러리 스토어
- `src/hooks/useSymbolLibrary.ts` — 심볼 라이브러리 lifecycle 훅
- `src-tauri/src/commands/symbols.rs` — Tauri 백엔드 CRUD
- `src-tauri/src/symbols/` — Rust 심볼 관리 모듈
- 22개 빌트인 블록의 심볼 정의 JSON 파일들
- 라이브러리 브라우저 UI 컴포넌트

### Definition of Done
- [ ] 사용자가 심볼 에디터에서 새 심볼을 만들 수 있음
- [ ] 만든 심볼이 Toolbox/라이브러리에 나타남
- [ ] 심볼을 캔버스에 드래그&드롭으로 배치 가능
- [ ] 심볼의 핀에 와이어 연결 가능 (직교 라우팅)
- [ ] 프로젝트 저장/로드 시 커스텀 심볼 포함 블록 정상 작동
- [ ] 기존 프로젝트 파일(.mop)이 마이그레이션 후에도 정상 로드
- [ ] `pnpm run build` 성공 + `pnpm run test` 통과

### Must Have
- 심볼 데이터 모델 (JSON 스키마)
- 벡터 프리미티브 기반 심볼 렌더러
- 전용 캔버스 에디터 (드로잉 + 핀 배치)
- 2-tier 라이브러리 (프로젝트 + 글로벌)
- Tauri 백엔드 CRUD
- 기존 프로젝트 호환성 (forward migration)
- 빌트인 블록 점진적 마이그레이션 경로
- 멀티유닛 지원 (coil+contact)
- 20px 그리드 스냅 (핀 배치)

### Must NOT Have (Guardrails)
- ❌ `localStorage` 사용 금지 — Tauri 파일시스템 파이프라인만 사용
- ❌ 기존 `BlockType` union에서 타입 제거 금지 — additive only
- ❌ Port offset→absolute 변환을 블록 마이그레이션과 동시 진행 금지
- ❌ 기존 블록 크기를 20px 배수로 강제 리사이즈 금지
- ❌ 심볼 에디터에 undo/redo 이외의 고급 기능 (레이어, 그라디언트, 그루핑 등) 추가 금지
- ❌ 프로퍼티 시스템에 조건부 로직, 연산 필드, 그루핑 추가 금지
- ❌ JSON 외 다른 심볼 포맷 (SVG, KiCad .kicad_sym) 임포트/익스포트 금지
- ❌ 멀티유닛 최대 4유닛 초과 금지
- ❌ 핀 배치 시 "스마트" 자동 연결 금지 — 핀은 단순 연결점
- ❌ 시뮬레이션 로직 구현 금지 (별도 계획)
- ❌ 심볼 상속(extends) 구현 금지 (v2 연기)
- ❌ `as any`, `@ts-ignore`, 빈 catch 블록 사용 금지

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Vitest in vite.config.ts)
- **Automated tests**: Tests-after
- **Framework**: Vitest (unit/integration) + Playwright (E2E)
- **Strategy**: 데이터 모델, 직렬화, 검증 로직 위주 유닛 테스트 + 에디터 E2E

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright — Navigate, interact, assert DOM, screenshot
- **Backend/Tauri**: Use Bash (cargo test) — Run Rust tests, assert pass
- **Data Model/Logic**: Use Bash (pnpm test) — Run Vitest, assert pass
- **Integration**: Use Playwright — Full workflow (create symbol → place → wire → save → reload)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (Cleanup — foundation prerequisites):
├── Task 1: Audit & de-duplicate BlockRenderer.tsx files [quick]
├── Task 2: Delete dead symbolEditor.ts + audit block sizes [quick]
└── Task 3: Audit Port position consumers (lsp_find_references) [quick]

Wave 1 (Data Model — all independent):
├── Task 4: Symbol data model TypeScript types + JSON schema [deep]
├── Task 5: Tauri backend symbol module + CRUD commands [unspecified-high]
├── Task 6: Symbol service layer (frontend) + Zustand store [unspecified-high]
└── Task 7: Symbol serialization + project integration [deep]

Wave 2 (Rendering — depends on Wave 1):
├── Task 8: Generic SymbolRenderer component (SVG from primitives) [deep]
├── Task 9: 'custom_symbol' BlockType + dual rendering path [deep]
├── Task 10: Toolbox/Library browser integration [visual-engineering]
└── Task 11: Symbol validation engine [unspecified-high]

Wave 3 (Editor UI — depends on Wave 2):
├── Task 12: Symbol Editor canvas shell (view + grid + coordinate system) [deep]
├── Task 13: Drawing tools (rect, circle, polyline, arc, text) [visual-engineering]
├── Task 14: Pin placement tool + grid snap [deep]
└── Task 15: Symbol properties panel + save workflow [visual-engineering]

Wave 4 (Library Management — depends on Wave 2):
├── Task 16: 2-tier library manager (project + global) [deep]
├── Task 17: Library browser UI (categories, search, preview) [visual-engineering]
├── Task 18: Multi-unit symbol support [deep]
└── Task 19: Symbol editor undo/redo [unspecified-high]

Wave 5 (Port System Migration — isolated, depends on Wave 2):
├── Task 20: Port position equivalence tests (old vs new for all 22 blocks) [deep]
├── Task 21: Port coordinate system migration (offset→absolute) [deep]
└── Task 22: Wire routing verification after port migration [deep]

Wave 6 (Built-in Migration — depends on Waves 5):
├── Task 23: Built-in migration batch 1 (fuse, terminal_block, emergency_stop, pilot_lamp) [unspecified-high]
├── Task 24: Built-in migration batch 2 (led, button, text, net_label) [unspecified-high]
├── Task 25: Built-in migration batch 3 (relay, contactor, motor, overload_relay) [unspecified-high]
├── Task 26: Built-in migration batch 4 (sensor, selector_switch, solenoid_valve, disconnect_switch) [unspecified-high]
├── Task 27: Built-in migration batch 5 (powersource, transformer, plc_in, plc_out, scope, off_page_connector) [unspecified-high]
└── Task 28: Migration tests + legacy project compatibility [deep]

Wave 7 (Tests + Integration):
├── Task 29: Vitest unit test suite (data model, serialization, validation) [unspecified-high]
├── Task 30: Playwright E2E test suite (symbol CRUD, editor, placement, wiring) [unspecified-high]
└── Task 31: Integration test: full workflow (create → place → wire → save → reload) [deep]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: T1→T4→T8→T9→T12→T20→T21→T23→T28→F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 4 (Waves 1, 2, 6)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1-3 | — | 4-31 |
| 4 | 1-3 | 5,6,7,8,9,11,18 |
| 5 | 4 | 6,7,16 |
| 6 | 4,5 | 10,12,15,16,17 |
| 7 | 4,5 | 9,28 |
| 8 | 4 | 9,10,12,13 |
| 9 | 4,7,8 | 10,23-27 |
| 10 | 6,8,9 | 17 |
| 11 | 4 | 15,19 |
| 12 | 6,8 | 13,14,15 |
| 13 | 12 | 15 |
| 14 | 12 | 15 |
| 15 | 6,11,13,14 | 30 |
| 16 | 5,6 | 17 |
| 17 | 6,10,16 | 30 |
| 18 | 4 | 25 |
| 19 | 11 | — |
| 20 | 3 | 21 |
| 21 | 20 | 22,23-27 |
| 22 | 21 | 23-27 |
| 23-27 | 9,21,22 | 28 |
| 28 | 23-27 | 29 |
| 29 | 28 | F1-F4 |
| 30 | 15,17 | F1-F4 |
| 31 | 29,30 | F1-F4 |

### Agent Dispatch Summary

- **Wave 0**: **3** — T1-T3 → `quick`
- **Wave 1**: **4** — T4,T7 → `deep`, T5-T6 → `unspecified-high`
- **Wave 2**: **4** — T8-T9 → `deep`, T10 → `visual-engineering`, T11 → `unspecified-high`
- **Wave 3**: **4** — T12,T14 → `deep`, T13,T15 → `visual-engineering`
- **Wave 4**: **4** — T16,T18 → `deep`, T17 → `visual-engineering`, T19 → `unspecified-high`
- **Wave 5**: **3** — T20-T22 → `deep`
- **Wave 6**: **6** — T23-T27 → `unspecified-high`, T28 → `deep`
- **Wave 7**: **3** — T29-T30 → `unspecified-high`, T31 → `deep`
- **FINAL**: **4** — F1 → `oracle`, F2-F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.
> **A task WITHOUT QA Scenarios is INCOMPLETE. No exceptions.**

### Wave 0 — Cleanup (Foundation Prerequisites)

 [x] 1. Audit & De-duplicate BlockRenderer.tsx Files

  **What to do**:
  - Run `lsp_find_references` on both `src/components/OneCanvas/components/BlockRenderer.tsx` and `src/components/OneCanvas/content/BlockRenderer.tsx` to map all consumers
  - Determine which is the canonical BlockRenderer (components/ version is primary based on Toolbox/Canvas imports)
  - If content/BlockRenderer.tsx is unused or a stale copy: delete it
  - If both are used: merge into a single canonical file, update all import paths
  - Verify no broken imports after cleanup

  **Must NOT do**:
  - Change any BlockRenderer rendering logic — only file deduplication
  - Touch any block component internals

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: File dedup is a mechanical task — find refs, delete/merge, fix imports
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser interaction needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0 (with Tasks 2, 3)
  - **Blocks**: Tasks 4-31 (all subsequent tasks)
  - **Blocked By**: None (can start immediately)

  **References**:
  **Pattern References**:
  - `src/components/OneCanvas/components/BlockRenderer.tsx` — Primary block rendering switch/case dispatcher
  - `src/components/OneCanvas/content/BlockRenderer.tsx` — Potential duplicate/stale copy to investigate

  **API/Type References**:
  - `src/components/OneCanvas/types.ts:Block` — The discriminated union consumed by BlockRenderer

  **WHY Each Reference Matters**:
  - The two BlockRenderer files may cause confusion for future tasks that modify the rendering pipeline. Deduplication ensures a single source of truth.

  **Acceptance Criteria**:
  - [ ] Only ONE BlockRenderer.tsx exists in the codebase
  - [ ] `grep -r 'BlockRenderer' src/` shows all imports point to the canonical file
  - [ ] `pnpm run build` succeeds with 0 errors

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Single BlockRenderer after cleanup
    Tool: Bash
    Preconditions: Both BlockRenderer.tsx files currently exist
    Steps:
      1. Run: find src -name 'BlockRenderer.tsx' -type f
      2. Assert: exactly 1 result returned
      3. Run: grep -rn 'from.*BlockRenderer' src/ --include='*.ts' --include='*.tsx'
      4. Assert: all imports resolve to the single canonical path
      5. Run: pnpm run build
      6. Assert: exit code 0, no 'Cannot find module' errors
    Expected Result: One BlockRenderer.tsx, all imports valid, build passes
    Failure Indicators: Multiple BlockRenderer files, broken imports, build errors
    Evidence: .sisyphus/evidence/task-1-single-blockrenderer.txt

  Scenario: Existing blocks render identically after cleanup
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running (pnpm tauri dev or pnpm run dev)
    Steps:
      1. Navigate to http://localhost:1420
      2. Open an existing canvas or create new one
      3. Drag a 'relay' block from Toolbox onto canvas
      4. Drag a 'button' block from Toolbox onto canvas
      5. Assert: both blocks render visually (no blank/error placeholders)
      6. Screenshot the canvas
    Expected Result: Blocks render correctly, no visual regression
    Failure Indicators: Blank block, error boundary triggered, missing SVG elements
    Evidence: .sisyphus/evidence/task-1-block-render-visual.png
  ```

  **Commit**: YES (groups with T2, T3)
  - Message: `chore(canvas): cleanup dead code and de-duplicate BlockRenderer`
  - Files: `src/components/OneCanvas/components/BlockRenderer.tsx`, `src/components/OneCanvas/content/BlockRenderer.tsx`
  - Pre-commit: `pnpm run build`

---

 [x] 2. Delete Dead symbolEditor.ts + Audit Block Sizes

  **What to do**:
  - Delete `src/components/OneCanvas/utils/symbolEditor.ts` (553 lines, 0 imports, uses localStorage — confirmed dead code)
  - Run `grep -rn 'symbolEditor' src/` to triple-confirm no imports exist
  - Audit all 22 block sizes in `blockDefinitions.ts` — document which are 20px multiples and which aren't
  - Create a reference document listing all block sizes in `.sisyphus/evidence/task-2-block-size-audit.md`
  - Do NOT change any block sizes — just document them

  **Must NOT do**:
  - Modify any block sizes or dimensions
  - Change any blockDefinitions.ts logic
  - Use localStorage anywhere

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: File deletion + grep audit is trivial mechanical work
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser interaction needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0 (with Tasks 1, 3)
  - **Blocks**: Tasks 4-31
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `src/components/OneCanvas/utils/symbolEditor.ts` — The dead code file to delete (553 lines, localStorage-based, 0 imports)
  - `src/components/OneCanvas/blockDefinitions.ts` — Block registry with all 22 block definitions including sizes

  **WHY Each Reference Matters**:
  - symbolEditor.ts is confirmed dead code that will confuse future symbol system work. Must be removed before new symbol infrastructure.
  - blockDefinitions.ts contains the block size data needed for the audit. Non-20px sizes affect port migration planning.

  **Acceptance Criteria**:
  - [ ] `symbolEditor.ts` deleted from filesystem
  - [ ] `grep -rn 'symbolEditor' src/` returns 0 results
  - [ ] Block size audit documented in `.sisyphus/evidence/task-2-block-size-audit.md`
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Dead code removed, no orphan references
    Tool: Bash
    Preconditions: symbolEditor.ts exists at src/components/OneCanvas/utils/symbolEditor.ts
    Steps:
      1. Run: ls src/components/OneCanvas/utils/symbolEditor.ts 2>&1
      2. Assert: 'No such file' (deleted)
      3. Run: grep -rn 'symbolEditor' src/ --include='*.ts' --include='*.tsx'
      4. Assert: 0 matches
      5. Run: grep -rn 'localStorage' src/ --include='*.ts' --include='*.tsx'
      6. Assert: 0 matches in production code (test files OK)
      7. Run: pnpm run build
      8. Assert: exit code 0
    Expected Result: File deleted, no orphan imports, no localStorage in prod code, build passes
    Failure Indicators: File still exists, import errors, localStorage usage found
    Evidence: .sisyphus/evidence/task-2-dead-code-cleanup.txt

  Scenario: Block size audit document exists
    Tool: Bash
    Steps:
      1. Run: cat .sisyphus/evidence/task-2-block-size-audit.md
      2. Assert: file exists and contains all 22 block types with their width/height values
      3. Assert: each block is marked as '20px-aligned' or 'non-20px-aligned'
    Expected Result: Complete audit of all 22 block sizes
    Failure Indicators: Missing blocks, incomplete data
    Evidence: .sisyphus/evidence/task-2-block-size-audit.md
  ```

  **Commit**: YES (groups with T1, T3)
  - Message: `chore(canvas): cleanup dead code and de-duplicate BlockRenderer`
  - Files: `src/components/OneCanvas/utils/symbolEditor.ts`
  - Pre-commit: `pnpm run build`

---

 [x] 3. Audit Port Position Consumers

  **What to do**:
  - Use `lsp_find_references` on the `offset` field in Port interface (`src/components/OneCanvas/types.ts`)
  - Map every file that reads `port.offset` or computes port position using the offset-ratio formula
  - Document each consumer with: file path, line number, what it does with offset, and risk level for future migration
  - Create a structured report in `.sisyphus/evidence/task-3-port-consumers.md`
  - Files to specifically check: `Port.tsx`, `wireGeometry.ts`, `useDragDrop.ts`, `canvasCoordinates.ts`, `serialization.ts`, `useWireCreation.ts`
  - Do NOT change any code — this is a read-only audit

  **Must NOT do**:
  - Modify any port position logic
  - Change the Port interface
  - Touch any rendering code

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: LSP reference lookup + documentation is straightforward
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser interaction needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0 (with Tasks 1, 2)
  - **Blocks**: Tasks 20, 21, 22 (Port migration wave)
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `src/components/OneCanvas/types.ts:Port` — Port interface with `offset?: number` field (0-1 ratio)
  - `src/components/OneCanvas/components/Port.tsx` — Port rendering, position calculation from offset
  - `src/components/OneCanvas/geometry/wireGeometry.ts` — Wire path calculation using port positions
  - `src/components/OneCanvas/hooks/useDragDrop.ts` — Block placement with grid snapping
  - `src/components/OneCanvas/utils/canvasCoordinates.ts` — `snapToGrid()` utility
  - `src/components/OneCanvas/utils/serialization.ts` — Port serialization/deserialization

  **WHY Each Reference Matters**:
  - This audit maps the blast radius of the future offset→absolute coordinate migration (Task 21). Every consumer of `port.offset` must be updated during migration. Missing a consumer would cause runtime bugs.

  **Acceptance Criteria**:
  - [ ] `.sisyphus/evidence/task-3-port-consumers.md` exists
  - [ ] Report lists every file/line that reads port.offset or computes port position
  - [ ] Each consumer has: file path, line number, what it does, risk level (high/medium/low)
  - [ ] At minimum covers: Port.tsx, wireGeometry.ts, useDragDrop.ts, serialization.ts

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Port consumer audit is complete and accurate
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: cat .sisyphus/evidence/task-3-port-consumers.md
      2. Assert: file exists and is non-empty
      3. Assert: contains entries for at least Port.tsx, wireGeometry.ts, serialization.ts
      4. Assert: each entry has file path, line number, description, risk level
      5. Run: grep -rn 'offset' src/components/OneCanvas/types.ts
      6. Cross-reference: audit covers all offset-related type definitions
    Expected Result: Comprehensive audit document with all port.offset consumers mapped
    Failure Indicators: Missing known consumers, no risk levels, incomplete file
    Evidence: .sisyphus/evidence/task-3-port-consumers.md

  Scenario: No code was modified during audit
    Tool: Bash
    Steps:
      1. Run: git diff --stat src/
      2. Assert: 0 files changed (read-only audit)
    Expected Result: Clean git status for src/ (no modifications)
    Failure Indicators: Any modified source files
    Evidence: .sisyphus/evidence/task-3-no-code-changes.txt
  ```

  **Commit**: YES (groups with T1, T2)
  - Message: `chore(canvas): cleanup dead code and de-duplicate BlockRenderer`
  - Files: `.sisyphus/evidence/task-3-port-consumers.md`
  - Pre-commit: `pnpm run build`

### Wave 1 — Data Model (All Independent After Wave 0)

- [ ] 4. Symbol Data Model — TypeScript Types + JSON Schema

  **What to do**:
  - Create `src/types/symbol.ts` with complete symbol type system:
    - `SymbolDefinition`: id, name, version, description, category, author, createdAt, updatedAt
    - `GraphicPrimitive` union: `RectPrimitive | CirclePrimitive | PolylinePrimitive | ArcPrimitive | TextPrimitive`
    - Each primitive: stroke, fill, strokeWidth, plus geometry-specific fields
    - `SymbolPin`: id, name, number, type (PinElectricalType), shape (PinShape), position {x,y} (grid-snapped), orientation, length, hidden?
    - `PinElectricalType`: 'input' | 'output' | 'bidirectional' | 'power' | 'passive'
    - `PinShape`: 'line' | 'inverted' | 'clock'
    - `MultiUnit`: units array, each with unitId, name, graphics[], pins[]
    - `SymbolProperty`: key, value, type ('string'|'number'|'boolean'|'enum'), visible?, editorType?
    - `runtimeStateSchema?: Record<string, unknown>` (slot for future simulation)
    - Body bounding box: width, height (must be 20px multiples)
  - Create JSON schema file `src/types/symbol.schema.json` for validation
  - Add `'custom_symbol'` to the existing BlockType union in `types.ts` (additive only)
  - Create `CustomSymbolBlock` interface extending BaseBlock with symbolId reference
  - Export all types from `src/types/index.ts` barrel

  **Must NOT do**:
  - Remove any existing BlockType union members
  - Implement rendering logic (that's Task 8)
  - Implement serialization (that's Task 7)
  - Add simulation/runtime logic beyond the schema slot

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex type design with multiple intersecting concerns (graphics, pins, multi-unit, properties)
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser interaction needed
    - `frontend-ui-ux`: Pure type design, no UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 5, 6, 7 — but T5/6/7 depend on T4)
  - **Blocks**: Tasks 5, 6, 7, 8, 9, 11, 18
  - **Blocked By**: Tasks 1, 2, 3 (Wave 0)

  **References**:
  **Pattern References**:
  - `src/components/OneCanvas/types.ts` — Existing Block discriminated union, BaseBlock<T>, Port interface. Follow this pattern for CustomSymbolBlock.
  - `src/components/OneCanvas/blockDefinitions.ts` — Block registration pattern to understand what data the renderer needs

  **API/Type References**:
  - `src/components/OneCanvas/types.ts:BlockType` — Union to extend with 'custom_symbol'
  - `src/components/OneCanvas/types.ts:Port` — Current port interface (offset-based) for reference

  **External References**:
  - KiCad .kicad_sym format: `https://dev-docs.kicad.org/en/file-formats/sexpr-symbol-lib/` — Reference for pin model, graphic primitives, multi-unit naming
  - Draft notes: `.sisyphus/drafts/custom-symbol-infra.md:67-78` — Grid/pin coordinate design decisions

  **WHY Each Reference Matters**:
  - types.ts shows the existing pattern for discriminated unions and BaseBlock — new CustomSymbolBlock must fit seamlessly
  - blockDefinitions.ts shows what data the rendering pipeline expects — symbol definition must provide equivalent data
  - KiCad format is the benchmark for pin model design — adapt (not copy) for PLC context

  **Acceptance Criteria**:
  - [ ] `src/types/symbol.ts` exists with all types exported
  - [ ] `src/types/symbol.schema.json` exists and is valid JSON Schema
  - [ ] `'custom_symbol'` added to BlockType union in `types.ts`
  - [ ] `CustomSymbolBlock` interface exists and extends BaseBlock
  - [ ] All existing block types still present in union (additive only)
  - [ ] `pnpm run build` succeeds (no type errors)
  - [ ] Pin position type is `{ x: number, y: number }` (not offset ratio)

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Type system compiles and is consistent
    Tool: Bash
    Steps:
      1. Run: pnpm run build
      2. Assert: exit code 0, 0 type errors
      3. Run: grep -n 'custom_symbol' src/components/OneCanvas/types.ts
      4. Assert: 'custom_symbol' appears in BlockType union
      5. Run: grep -n 'PinElectricalType' src/types/symbol.ts
      6. Assert: contains exactly 5 members: input, output, bidirectional, power, passive
      7. Run: node -e "const s = require('./src/types/symbol.schema.json'); console.log(typeof s)"
      8. Assert: outputs 'object' (valid JSON)
    Expected Result: All types compile, 5 pin types, valid JSON schema
    Failure Indicators: Type errors, missing pin types, invalid JSON
    Evidence: .sisyphus/evidence/task-4-type-system.txt

  Scenario: Existing BlockType union unchanged (additive only)
    Tool: Bash
    Steps:
      1. Run: grep -A 50 'type BlockType' src/components/OneCanvas/types.ts
      2. Assert: all 22 existing block types still present
      3. Assert: 'custom_symbol' is the ONLY new addition
    Expected Result: Union is additive only — 22 old + 1 new
    Failure Indicators: Any existing type removed or renamed
    Evidence: .sisyphus/evidence/task-4-blocktype-additive.txt
  ```

  **Commit**: YES (groups with T5, T6, T7)
  - Message: `feat(symbols): add symbol data model, Tauri CRUD, and serialization`
  - Files: `src/types/symbol.ts`, `src/types/symbol.schema.json`, `src/components/OneCanvas/types.ts`
  - Pre-commit: `pnpm run build`

---

- [ ] 5. Tauri Backend Symbol Module + CRUD Commands

  **What to do**:
  - Create `src-tauri/src/symbols/mod.rs` — Rust module for symbol management
  - Create `src-tauri/src/symbols/types.rs` — Rust struct mirroring TS SymbolDefinition (serde)
  - Create `src-tauri/src/symbols/storage.rs` — File-based symbol library storage:
    - Global library: `~/.modone/symbols/` (or app data dir)
    - Project library: `{project_dir}/symbols/`
    - Each symbol: `{library_dir}/{category}/{symbol_name}.json`
  - Create `src-tauri/src/commands/symbols.rs` — Tauri commands:
    - `list_symbols(scope: LibraryScope)` → Vec<SymbolSummary>
    - `get_symbol(id: String, scope: LibraryScope)` → SymbolDefinition
    - `save_symbol(symbol: SymbolDefinition, scope: LibraryScope)` → Result<()>
    - `delete_symbol(id: String, scope: LibraryScope)` → Result<()>
    - `copy_symbol(id: String, from: LibraryScope, to: LibraryScope)` → Result<()>
  - Register commands in `src-tauri/src/lib.rs` using `generate_handler!`
  - Add proper error variants to `ModOneError` in `error.rs`

  **Must NOT do**:
  - Use any database — file-based storage only
  - Implement symbol rendering (Rust side doesn't render)
  - Use localStorage or any browser API

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Rust backend work requires understanding Tauri command patterns + file I/O
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: Backend only, no browser

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T4 for types)
  - **Parallel Group**: Wave 1 (after T4 completes)
  - **Blocks**: Tasks 6, 7, 16
  - **Blocked By**: Task 4 (needs type definitions)

  **References**:
  **Pattern References**:
  - `src-tauri/src/commands/project.rs` — Existing Tauri command pattern (error handling, invoke pattern, return types)
  - `src-tauri/src/project/folder_project.rs` — Folder-based project structure pattern to mirror for symbol libraries
  - `src-tauri/src/lib.rs:generate_handler!` — Command registration macro — add new symbol commands here
  - `src-tauri/src/error.rs:ModOneError` — Error enum to extend with symbol-specific variants

  **WHY Each Reference Matters**:
  - project.rs shows how existing Tauri commands handle errors, serialize Rust structs to JSON, and integrate with the invoke pipeline
  - folder_project.rs shows the file-based storage pattern (directories, naming, YAML/JSON read/write)
  - lib.rs is where commands are registered — missing registration = command not available
  - error.rs ensures consistent error handling across the app

  **Acceptance Criteria**:
  - [ ] `src-tauri/src/symbols/` module exists with mod.rs, types.rs, storage.rs
  - [ ] `src-tauri/src/commands/symbols.rs` exists with 5 commands
  - [ ] Commands registered in `lib.rs`
  - [ ] `cargo build` succeeds
  - [ ] `cargo test` passes (if tests exist)
  - [ ] Global library path uses app data directory (not hardcoded)

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Rust backend compiles with new symbol module
    Tool: Bash
    Preconditions: Task 4 types exist
    Steps:
      1. Run: cargo build --manifest-path src-tauri/Cargo.toml 2>&1
      2. Assert: exit code 0, no compilation errors
      3. Run: grep -n 'symbols' src-tauri/src/lib.rs
      4. Assert: symbol commands registered in generate_handler!
      5. Run: grep -rn 'pub async fn' src-tauri/src/commands/symbols.rs
      6. Assert: at least 5 command functions (list, get, save, delete, copy)
    Expected Result: Backend compiles, commands registered, 5 CRUD operations
    Failure Indicators: Compile errors, missing command registration, < 5 commands
    Evidence: .sisyphus/evidence/task-5-rust-build.txt

  Scenario: Error variants added to ModOneError
    Tool: Bash
    Steps:
      1. Run: grep -n 'Symbol' src-tauri/src/error.rs
      2. Assert: at least 2 symbol-related error variants (not found, IO error)
    Expected Result: Symbol errors integrated into global error enum
    Failure Indicators: No symbol error variants, or unwrap() calls instead
    Evidence: .sisyphus/evidence/task-5-error-variants.txt
  ```

  **Commit**: YES (groups with T4, T6, T7)
  - Message: `feat(symbols): add symbol data model, Tauri CRUD, and serialization`
  - Files: `src-tauri/src/symbols/`, `src-tauri/src/commands/symbols.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/error.rs`
  - Pre-commit: `cargo build --manifest-path src-tauri/Cargo.toml`

---

- [ ] 6. Symbol Service Layer (Frontend) + Zustand Store

  **What to do**:
  - Create `src/services/symbolService.ts` — Tauri invoke wrappers:
    - `listSymbols(scope)`, `getSymbol(id, scope)`, `saveSymbol(symbol, scope)`
    - `deleteSymbol(id, scope)`, `copySymbol(id, from, to)`
    - Follow `canvasService.ts` pattern (invoke + error handling)
  - Create `src/stores/symbolStore.ts` — Zustand store:
    - State: `symbols: Map<string, SymbolSummary>`, `selectedSymbol: SymbolDefinition | null`, `loading`, `error`
    - Actions: `loadLibrary(scope)`, `selectSymbol(id)`, `saveSymbol(symbol)`, `deleteSymbol(id)`
    - Separate selectors for project vs global symbols
  - Create `src/hooks/useSymbolLibrary.ts` — React hook wrapping store:
    - Auto-load library on mount
    - Filter/search capabilities
    - Category grouping

  **Must NOT do**:
  - Implement UI components (that's Waves 3-4)
  - Use localStorage for any state
  - Bypass Tauri invoke (no direct filesystem access from frontend)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Service/store/hook pattern requires understanding existing patterns in depth
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T4 types + T5 backend)
  - **Parallel Group**: Wave 1 (after T4+T5)
  - **Blocks**: Tasks 10, 12, 15, 16, 17
  - **Blocked By**: Tasks 4, 5

  **References**:
  **Pattern References**:
  - `src/services/canvasService.ts` — Existing Tauri invoke wrapper pattern (error handling, return types)
  - `src/services/projectService.ts` — Alternative service pattern for reference
  - `src/stores/projectStore.ts` — Zustand store pattern (state shape, actions, selectors)
  - `src/hooks/useProject.ts` — Hook wrapping store + service pattern

  **WHY Each Reference Matters**:
  - canvasService.ts shows the exact invoke() pattern used in this project — copy the error handling and typing approach
  - projectStore.ts shows Zustand conventions (immer, devtools, computed selectors) — follow same structure
  - useProject.ts shows how hooks wrap stores with lifecycle (auto-load, cleanup) — mirror for symbol library

  **Acceptance Criteria**:
  - [ ] `src/services/symbolService.ts` exists with 5 invoke wrappers
  - [ ] `src/stores/symbolStore.ts` exists with Zustand store
  - [ ] `src/hooks/useSymbolLibrary.ts` exists with React hook
  - [ ] `pnpm run build` succeeds
  - [ ] No localStorage usage

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Service/store/hook layer compiles
    Tool: Bash
    Steps:
      1. Run: pnpm run build
      2. Assert: exit code 0
      3. Run: grep -rn 'invoke' src/services/symbolService.ts
      4. Assert: at least 5 invoke calls (one per CRUD operation)
      5. Run: grep -rn 'create(' src/stores/symbolStore.ts
      6. Assert: Zustand create() call exists
      7. Run: grep -rn 'localStorage' src/services/symbolService.ts src/stores/symbolStore.ts src/hooks/useSymbolLibrary.ts
      8. Assert: 0 matches
    Expected Result: All 3 files compile, 5 invoke calls, Zustand store, no localStorage
    Failure Indicators: Build errors, missing invoke calls, localStorage usage
    Evidence: .sisyphus/evidence/task-6-service-store-hook.txt
  ```

  **Commit**: YES (groups with T4, T5, T7)
  - Message: `feat(symbols): add symbol data model, Tauri CRUD, and serialization`
  - Files: `src/services/symbolService.ts`, `src/stores/symbolStore.ts`, `src/hooks/useSymbolLibrary.ts`
  - Pre-commit: `pnpm run build`

---

- [ ] 7. Symbol Serialization + Project Integration

  **What to do**:
  - Extend `src/components/OneCanvas/utils/serialization.ts`:
    - Add `custom_symbol` block type to serialize/deserialize pipeline
    - Serialize: CustomSymbolBlock → YAML with symbolId reference + instance properties
    - Deserialize: YAML → CustomSymbolBlock, resolve symbolId from library
    - Add forward migration: detect old format (no symbol references) → load as-is, no crash
  - Handle missing symbol gracefully: if symbolId not found in library, render placeholder block
  - Ensure existing .mop project files load without modification (backward compatibility)
  - Add version field to canvas YAML if not present (for future migration detection)

  **Must NOT do**:
  - Change how existing 22 block types serialize (backward compatibility)
  - Remove any serialization logic for current blocks
  - Import symbols at serialization time (lazy-load from store)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Serialization with backward compatibility requires careful analysis of edge cases
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T4 types + T5 backend)
  - **Parallel Group**: Wave 1 (after T4+T5)
  - **Blocks**: Tasks 9, 28
  - **Blocked By**: Tasks 4, 5

  **References**:
  **Pattern References**:
  - `src/components/OneCanvas/utils/serialization.ts` — Current serialize/deserialize pipeline. This is THE file to extend.
  - `src/stores/projectStore.ts` — Where serialization results are consumed

  **WHY Each Reference Matters**:
  - serialization.ts is the single source for canvas data format — all changes must maintain backward compatibility with existing .mop files
  - projectStore.ts shows how deserialized data flows into the app — custom_symbol blocks must flow identically

  **Acceptance Criteria**:
  - [ ] `custom_symbol` blocks can be serialized to YAML and deserialized back
  - [ ] Existing .mop files without custom symbols load correctly (no crash)
  - [ ] Missing symbolId renders a placeholder (not a crash)
  - [ ] Round-trip test: serialize → deserialize → compare (identity)
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Existing project backward compatibility
    Tool: Bash
    Steps:
      1. Find an existing .mop project: ls -la tests/ or find . -name '*.yaml' -path '*/canvas/*'
      2. Run: pnpm run build
      3. Assert: build succeeds
      4. If test project exists: load via dev server and verify no console errors
    Expected Result: Old projects load without any changes
    Failure Indicators: Parse errors, missing type handlers, crash on load
    Evidence: .sisyphus/evidence/task-7-backward-compat.txt

  Scenario: Custom symbol serialization round-trip
    Tool: Bash (Vitest)
    Steps:
      1. Run: pnpm test -- --grep 'custom_symbol serialization' (if test exists)
      2. Or manually: create a CustomSymbolBlock object, serialize to YAML, deserialize, deep-equal compare
    Expected Result: Serialized and deserialized objects are identical
    Failure Indicators: Fields lost, types changed, symbolId missing
    Evidence: .sisyphus/evidence/task-7-round-trip.txt
  ```

  **Commit**: YES (groups with T4, T5, T6)
  - Message: `feat(symbols): add symbol data model, Tauri CRUD, and serialization`
  - Files: `src/components/OneCanvas/utils/serialization.ts`
  - Pre-commit: `pnpm run build`

### Wave 2 — Rendering (Depends on Wave 1)

- [ ] 8. Generic SymbolRenderer Component (SVG from Primitives)

  **What to do**:
  - Create `src/components/OneCanvas/components/SymbolRenderer.tsx`
  - Accept `SymbolDefinition` prop → render as SVG `<g>` group:
    - `RectPrimitive` → `<rect>`
    - `CirclePrimitive` → `<circle>`
    - `PolylinePrimitive` → `<polyline>`
    - `ArcPrimitive` → `<path>` (SVG arc command)
    - `TextPrimitive` → `<text>`
  - Render pins as small circles (r=3) at pin.position {x,y} with direction indicators
  - Pin labels (name/number) rendered as `<text>` near pin position
  - Support `rotation` prop (0/90/180/270) via SVG `transform`
  - Support `scale` prop for thumbnail previews
  - Body bounding box rendered as lightweight dashed rect when selected

  **Must NOT do**:
  - Handle block placement/drag logic (that’s Canvas responsibility)
  - Implement interactivity (click/hover) — pure render component
  - Use HTML elements inside SVG — SVG-only rendering

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (first task in Wave 2)
  - **Parallel Group**: Wave 2 (with T11)
  - **Blocks**: Tasks 9, 10, 12, 13
  - **Blocked By**: Task 4

  **References**:
  - `src/components/OneCanvas/components/blocks/` — Existing block SVG components. Each uses inline SVG. SymbolRenderer replaces this with data-driven approach.
  - `src/components/OneCanvas/components/blocks/BlockWrapper.tsx` — Common wrapper pattern (position, selection, ports). SymbolRenderer sits INSIDE this wrapper.
  - `src/types/symbol.ts:GraphicPrimitive` — The union type to map to SVG elements.
  - `src/types/symbol.ts:SymbolPin` — Pin data for rendering pin marks/labels.

  **Acceptance Criteria**:
  - [ ] `SymbolRenderer.tsx` exists and exports a React component
  - [ ] Given a SymbolDefinition with rect+circle+pins, renders correct SVG elements
  - [ ] `pnpm run build` succeeds
  - [ ] Pin positions rendered at exact {x,y} coordinates from definition

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: SymbolRenderer produces correct SVG elements
    Tool: Bash
    Steps:
      1. Run: pnpm run build
      2. Assert: exit code 0
      3. Run: grep -n 'GraphicPrimitive\|<rect\|<circle\|<polyline\|<path\|<text' src/components/OneCanvas/components/SymbolRenderer.tsx
      4. Assert: all 5 primitive types handled
    Expected Result: Component compiles, handles all primitive types
    Evidence: .sisyphus/evidence/task-8-symbol-renderer.txt

  Scenario: SymbolRenderer visual output
    Tool: Playwright
    Preconditions: Dev server running, test symbol loaded
    Steps:
      1. Navigate to a page rendering a test SymbolDefinition
      2. Assert: SVG `<g>` group exists with correct child elements
      3. Assert: pin circles visible at expected positions
      4. Screenshot
    Expected Result: Symbol renders visually with correct shapes and pins
    Evidence: .sisyphus/evidence/task-8-renderer-visual.png
  ```

  **Commit**: YES (groups with T9, T10, T11)
  - Message: `feat(canvas): add generic SymbolRenderer and dual rendering path`
  - Pre-commit: `pnpm run build`

---

- [ ] 9. 'custom_symbol' BlockType + Dual Rendering Path

  **What to do**:
  - Modify `BlockRenderer.tsx`: add `case 'custom_symbol':` branch
  - In that branch: read `block.symbolId`, look up from symbolStore, pass to `<SymbolRenderer>`
  - If symbolId not found in store: render `<MissingSymbolPlaceholder>` (red dashed rect + warning icon + text)
  - Create `src/components/OneCanvas/components/MissingSymbolPlaceholder.tsx`
  - Ensure existing 22 block types flow through original switch unchanged

  **Must NOT do**:
  - Change rendering of any existing block type
  - Remove any case from the switch statement
  - Make SymbolRenderer the default path for existing blocks

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Tasks 10, 23-27
  - **Blocked By**: Tasks 4, 7, 8

  **References**:
  - `src/components/OneCanvas/components/BlockRenderer.tsx` — THE switch/case dispatcher to modify. Add ONE new case, nothing else.
  - `src/stores/symbolStore.ts` — Where to look up symbol definitions by ID.
  - `src/components/OneCanvas/components/SymbolRenderer.tsx` — The renderer to delegate to (Task 8).

  **Acceptance Criteria**:
  - [ ] `BlockRenderer.tsx` has `custom_symbol` case
  - [ ] Missing symbol shows placeholder (not crash)
  - [ ] All 22 existing block types still render correctly
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Dual rendering path works
    Tool: Bash
    Steps:
      1. Run: pnpm run build
      2. Run: grep -n "custom_symbol" src/components/OneCanvas/components/BlockRenderer.tsx
      3. Assert: case branch exists
      4. Run: grep -n "MissingSymbolPlaceholder" src/components/OneCanvas/components/BlockRenderer.tsx
      5. Assert: placeholder import and usage exists
    Expected Result: New case added, placeholder handled
    Evidence: .sisyphus/evidence/task-9-dual-path.txt

  Scenario: Existing blocks unaffected
    Tool: Playwright
    Steps:
      1. Navigate to app, create canvas with relay + button + motor blocks
      2. Assert: all three render correctly (no blank/error)
      3. Screenshot
    Expected Result: Existing blocks render identically to pre-change
    Evidence: .sisyphus/evidence/task-9-existing-blocks.png
  ```

  **Commit**: YES (groups with T8, T10, T11)
  - Message: `feat(canvas): add generic SymbolRenderer and dual rendering path`
  - Pre-commit: `pnpm run build`

---

- [ ] 10. Toolbox / Library Browser Integration

  **What to do**:
  - Extend `src/components/OneCanvas/Toolbox.tsx` with new "Custom Symbols" category section
  - Read symbols from `useSymbolLibrary()` hook, group by `category` field
  - Each symbol entry: thumbnail (SymbolRenderer at 0.3 scale) + name
  - Drag-and-drop: create `CustomSymbolBlock` with `symbolId` reference, place on canvas at drop position
  - Empty state: show "No custom symbols yet. Create one in Symbol Editor." message
  - Add "Open Symbol Editor" button in the section header

  **Must NOT do**:
  - Change existing built-in block categories in Toolbox
  - Remove or reorder existing Toolbox sections
  - Implement the Symbol Editor itself (that’s Wave 3)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 6, 8, 9

  **References**:
  - `src/components/OneCanvas/Toolbox.tsx` — Existing categorized block palette. Add new section following same pattern.
  - `src/hooks/useSymbolLibrary.ts` — Hook providing symbol list with category grouping (Task 6).
  - `src/components/OneCanvas/hooks/useDragDrop.ts` — Existing drag-and-drop logic for block placement.

  **Acceptance Criteria**:
  - [ ] "Custom Symbols" section appears in Toolbox
  - [ ] Symbols from store displayed with thumbnails
  - [ ] Drag-and-drop places CustomSymbolBlock on canvas
  - [ ] Empty state message when no symbols exist
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Custom Symbols section in Toolbox
    Tool: Playwright
    Steps:
      1. Navigate to app, open canvas view
      2. Assert: Toolbox contains "Custom Symbols" section
      3. Assert: section shows empty state message (no symbols yet)
      4. Screenshot
    Expected Result: New section visible with empty state
    Evidence: .sisyphus/evidence/task-10-toolbox-section.png

  Scenario: Existing Toolbox sections unchanged
    Tool: Playwright
    Steps:
      1. Assert: all original block categories still present
      2. Assert: built-in blocks still draggable
    Expected Result: No regression in existing Toolbox
    Evidence: .sisyphus/evidence/task-10-toolbox-existing.png
  ```

  **Commit**: YES (groups with T8, T9, T11)
  - Message: `feat(canvas): add generic SymbolRenderer and dual rendering path`
  - Pre-commit: `pnpm run build`

---

- [ ] 11. Symbol Validation Engine

  **What to do**:
  - Create `src/utils/symbolValidation.ts`
  - `validateSymbol(symbol: SymbolDefinition): ValidationError[]`
  - Rules:
    - Required fields: name (non-empty), category, at least 1 pin
    - Pin IDs unique within symbol
    - Pin numbers unique within symbol
    - Pin positions on 20px grid (`x % 20 === 0 && y % 20 === 0`)
    - Body width/height are 20px multiples
    - No overlapping pins (same {x,y})
    - Multi-unit: max 4 units
    - Property keys unique
  - `ValidationError`: `{ rule: string, message: string, field?: string, severity: 'error' | 'warning' }`

  **Must NOT do**:
  - Implement UI for showing errors (that’s Task 15)
  - Throw exceptions — return error array
  - Validate rendering (only data validation)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T8)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 15, 19
  - **Blocked By**: Task 4

  **References**:
  - `src/types/symbol.ts` — All types to validate against (Task 4).
  - KiCad validation rules: `https://klc.kicad.org/` — Pin uniqueness, grid discipline concepts (adapted for 20px).

  **Acceptance Criteria**:
  - [ ] `symbolValidation.ts` exists with `validateSymbol()` function
  - [ ] Returns empty array for valid symbol
  - [ ] Returns errors for: missing name, duplicate pin IDs, off-grid pins, non-20px body size
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Validation catches invalid symbols
    Tool: Bash
    Steps:
      1. Run: pnpm run build
      2. Assert: exit code 0
      3. Run: grep -c 'ValidationError' src/utils/symbolValidation.ts
      4. Assert: > 0 (type is used)
      5. Run: grep -c 'rule:' src/utils/symbolValidation.ts
      6. Assert: >= 6 (at least 6 validation rules)
    Expected Result: Validation module with 6+ rules
    Evidence: .sisyphus/evidence/task-11-validation.txt

  Scenario: Valid symbol passes validation
    Tool: Bash (Vitest)
    Steps:
      1. Run: pnpm test -- --grep 'symbolValidation' (if test exists)
      2. Or: code review that validateSymbol returns [] for well-formed input
    Expected Result: No false positives on valid symbols
    Evidence: .sisyphus/evidence/task-11-valid-pass.txt
  ```

  **Commit**: YES (groups with T8, T9, T10)
  - Message: `feat(canvas): add generic SymbolRenderer and dual rendering path`
  - Pre-commit: `pnpm run build`

### Wave 3 — Editor UI (Depends on Wave 2)

- [ ] 12. Symbol Editor Canvas Shell

  **What to do**:
  - Create `src/components/SymbolEditor/SymbolEditor.tsx` — main editor page/modal
  - Create `src/components/SymbolEditor/EditorCanvas.tsx` — SVG canvas with:
    - 20px grid background (reuse GridBackground pattern from OneCanvas)
    - Zoom (wheel) and pan (middle-click drag)
    - Origin marker at center
    - Snap-to-grid on all mouse interactions
  - Create `src/components/SymbolEditor/EditorToolbar.tsx` — tool selection: select, rect, circle, polyline, arc, text, pin
  - State management: local `useReducer` for editor state (current tool, selected items, symbol-in-progress)
  - Entry point: accessible from Library Browser "New Symbol" button or "Edit" on existing symbol

  **Must NOT do**:
  - Implement individual drawing tools (that’s T13)
  - Implement pin placement (that’s T14)
  - Implement properties panel (that’s T15)
  - Reuse OneCanvas directly — separate canvas with simpler interaction model

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Blocks**: Tasks 13, 14, 15
  - **Blocked By**: Tasks 6, 8

  **References**:
  - `src/components/OneCanvas/Canvas.tsx` — Main canvas pattern (SVG container, zoom/pan). Adapt, don’t copy.
  - `src/components/OneCanvas/GridBackground.tsx` — 20px grid rendering. Reuse or adapt for editor.
  - `src/components/OneCanvas/coordinate-system/useCoordinateSystem.ts` — Zoom/pan coordinate transforms.

  **Acceptance Criteria**:
  - [ ] `src/components/SymbolEditor/` directory with 3 components
  - [ ] Canvas renders 20px grid with zoom/pan
  - [ ] Toolbar shows tool buttons (even if not yet functional)
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Symbol Editor canvas renders
    Tool: Playwright
    Steps:
      1. Navigate to Symbol Editor route/modal
      2. Assert: SVG canvas element exists
      3. Assert: grid lines visible at 20px intervals
      4. Assert: toolbar with at least 7 tool buttons visible
      5. Screenshot
    Expected Result: Editor shell with grid and toolbar
    Evidence: .sisyphus/evidence/task-12-editor-shell.png
  ```

  **Commit**: YES (groups with T13, T14, T15)
  - Message: `feat(symbol-editor): add dedicated canvas editor with drawing tools`
  - Pre-commit: `pnpm run build`

---

- [ ] 13. Drawing Tools (rect, circle, polyline, arc, text)

  **What to do**:
  - Implement 5 drawing tools in `src/components/SymbolEditor/tools/`:
    - `RectTool.ts`: click-drag → RectPrimitive (snap corners to 20px grid)
    - `CircleTool.ts`: click center + drag radius → CirclePrimitive
    - `PolylineTool.ts`: click points → PolylinePrimitive (double-click to finish)
    - `ArcTool.ts`: 3-point arc (start, through, end) → ArcPrimitive
    - `TextTool.ts`: click position + text input → TextPrimitive
  - Each tool: ghost preview during drawing, grid snap, stroke/fill from current settings
  - Selection tool: click to select, drag to move, handles to resize
  - Delete selected: backspace/delete key

  **Must NOT do**:
  - Implement bezier curves (v2)
  - Implement grouping or layering
  - Add color picker UI (use preset colors for now)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Blocks**: Task 15
  - **Blocked By**: Task 12

  **References**:
  - `src/components/OneCanvas/machines/interactionMachine.ts` — State machine for canvas interactions. Understand the pattern, but editor uses simpler tool-based model.
  - `src/types/symbol.ts:GraphicPrimitive` — Target data structures each tool must produce.

  **Acceptance Criteria**:
  - [ ] 5 tool files exist in `tools/` directory
  - [ ] Each tool produces correct GraphicPrimitive type
  - [ ] All vertices snap to 20px grid
  - [ ] Selection + move + delete works
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Drawing tools create correct primitives
    Tool: Playwright
    Steps:
      1. Open Symbol Editor
      2. Select rect tool, draw rectangle on canvas
      3. Assert: <rect> SVG element appears
      4. Select circle tool, draw circle
      5. Assert: <circle> SVG element appears
      6. Screenshot
    Expected Result: Each tool creates its corresponding SVG element
    Evidence: .sisyphus/evidence/task-13-drawing-tools.png
  ```

  **Commit**: YES (groups with T12, T14, T15)
  - Message: `feat(symbol-editor): add dedicated canvas editor with drawing tools`
  - Pre-commit: `pnpm run build`

---

- [ ] 14. Pin Placement Tool + Grid Snap

  **What to do**:
  - Create `src/components/SymbolEditor/tools/PinTool.ts`
  - Click on canvas → open pin config popover: name, number, type (dropdown), shape (dropdown), orientation (4-way)
  - Confirm → place pin at grid-snapped position
  - Pin visual: line extending outward from body boundary + name/number labels
  - Pin orientation: Left/Right/Top/Bottom (determines line direction)
  - Edit existing pin: double-click to reopen config
  - Validation feedback: warn if pin not near body boundary

  **Must NOT do**:
  - Auto-connect pins to wires (manual only)
  - Implement "smart" pin placement suggestions
  - Allow off-grid pin positions

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Blocks**: Task 15
  - **Blocked By**: Task 12

  **References**:
  - `src/types/symbol.ts:SymbolPin` — Pin data structure with position, type, shape, orientation.
  - `src/components/OneCanvas/components/Port.tsx` — How pins render on the main canvas. Editor pin visual should be consistent.

  **Acceptance Criteria**:
  - [ ] Pin tool places pins at 20px grid positions
  - [ ] Pin config popover with name, number, type, shape, orientation
  - [ ] 5 electrical types available in dropdown
  - [ ] Pin visual shows direction + labels
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Pin placement on grid
    Tool: Playwright
    Steps:
      1. Open Symbol Editor, select Pin tool
      2. Click at approximate position (125, 85) on canvas
      3. Assert: pin config popover appears
      4. Fill: name="IN1", number="1", type="input"
      5. Confirm
      6. Assert: pin placed at snapped position (120, 80)
      7. Assert: pin visual shows line + "IN1" label
    Expected Result: Pin at grid-snapped position with correct properties
    Evidence: .sisyphus/evidence/task-14-pin-placement.png
  ```

  **Commit**: YES (groups with T12, T13, T15)
  - Message: `feat(symbol-editor): add dedicated canvas editor with drawing tools`
  - Pre-commit: `pnpm run build`

---

- [ ] 15. Symbol Properties Panel + Save Workflow

  **What to do**:
  - Create `src/components/SymbolEditor/PropertiesPanel.tsx` — sidebar:
    - Symbol metadata: name, description, category (dropdown), version, author
    - Custom properties table: add/remove rows, key-value-type per row
    - Body size display (auto-calculated from bounding box)
  - Save button workflow:
    1. Run `validateSymbol()` (Task 11)
    2. If errors: display in error list with severity icons
    3. If valid: call `symbolService.saveSymbol()` (Task 6)
    4. Show success toast, update library store
  - "Save As" for duplicating symbols
  - Dirty state indicator (unsaved changes marker)

  **Must NOT do**:
  - Add conditional logic or computed properties
  - Implement property groups or sections
  - Add undo for property changes (that’s T19)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Blocks**: Task 30
  - **Blocked By**: Tasks 6, 11, 13, 14

  **References**:
  - `src/utils/symbolValidation.ts` — Validation function to call before save (Task 11).
  - `src/services/symbolService.ts` — saveSymbol() invoke wrapper (Task 6).
  - `src/components/OneCanvas/components/CircuitLibraryPanel.tsx` — Existing library/panel pattern for reference.

  **Acceptance Criteria**:
  - [ ] Properties panel shows symbol metadata fields
  - [ ] Custom properties table with add/remove
  - [ ] Save runs validation first
  - [ ] Validation errors displayed in UI
  - [ ] Successful save updates library store
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Save with validation errors
    Tool: Playwright
    Steps:
      1. Open Symbol Editor, draw a shape but add NO pins
      2. Click Save
      3. Assert: validation error shown ("at least 1 pin required")
      4. Assert: symbol NOT saved (library unchanged)
    Expected Result: Validation prevents saving invalid symbol
    Evidence: .sisyphus/evidence/task-15-save-validation.png

  Scenario: Successful save flow
    Tool: Playwright
    Steps:
      1. Create valid symbol (shape + pin + name)
      2. Click Save
      3. Assert: success toast appears
      4. Assert: symbol appears in library browser
    Expected Result: Symbol saved and visible in library
    Evidence: .sisyphus/evidence/task-15-save-success.png
  ```

  **Commit**: YES (groups with T12, T13, T14)
  - Message: `feat(symbol-editor): add dedicated canvas editor with drawing tools`
  - Pre-commit: `pnpm run build`

### Wave 4 — Library Management (Depends on Wave 2)

- [ ] 16. 2-Tier Library Manager (Project + Global)

  **What to do**:
  - Create `src/components/SymbolLibrary/LibraryManager.tsx`
  - Two tabs/sections: "Project Library" and "Global Library"
  - Operations per scope: list, delete, rename
  - Cross-scope: copy project→global, copy global→project
  - Confirmation dialogs for destructive actions (delete)
  - Scope indicator badge on each symbol (P/G)

  **Must NOT do**:
  - Implement import/export from external formats
  - Add library versioning or sync

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 5, 6

  **References**:
  - `src/services/symbolService.ts` — copySymbol(), deleteSymbol() invoke wrappers.
  - `src/stores/symbolStore.ts` — Store actions for library operations.

  **Acceptance Criteria**:
  - [ ] LibraryManager shows project and global scopes
  - [ ] Delete with confirmation dialog
  - [ ] Copy between scopes works
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Library scope operations
    Tool: Playwright
    Steps:
      1. Open Library Manager
      2. Assert: two scope sections visible (Project, Global)
      3. Assert: scope badge (P/G) on each symbol
    Expected Result: Dual-scope library UI
    Evidence: .sisyphus/evidence/task-16-library-manager.png
  ```

  **Commit**: YES (groups with T17, T18, T19)
  - Message: `feat(symbol-library): add 2-tier library management and browser UI`
  - Pre-commit: `pnpm run build`

---

- [ ] 17. Library Browser UI (Categories, Search, Preview)

  **What to do**:
  - Create `src/components/SymbolLibrary/LibraryBrowser.tsx`
  - Left panel: category tree navigation
  - Main area: symbol cards grid with SymbolRenderer thumbnail + name + scope badge
  - Search bar: real-time filter by name/category/description
  - Interactions: double-click → open in editor, drag → place on canvas
  - Empty category: "No symbols in this category" message

  **Must NOT do**:
  - Add favorites/recently-used (v2)
  - Implement symbol import/export

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Blocks**: Task 30
  - **Blocked By**: Tasks 6, 10, 16

  **References**:
  - `src/components/OneCanvas/Toolbox.tsx` — Existing categorized palette. Browser is richer version.
  - `src/components/OneCanvas/components/SymbolRenderer.tsx` — Thumbnail rendering (Task 8).

  **Acceptance Criteria**:
  - [ ] Category tree navigation works
  - [ ] Search filters symbols in real-time
  - [ ] Thumbnails rendered via SymbolRenderer
  - [ ] Drag-to-canvas places CustomSymbolBlock
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Search and browse
    Tool: Playwright
    Steps:
      1. Open Library Browser
      2. Type "relay" in search bar
      3. Assert: only relay-related symbols shown
      4. Clear search, click a category
      5. Assert: filtered to that category
    Expected Result: Search and category navigation work
    Evidence: .sisyphus/evidence/task-17-library-browser.png
  ```

  **Commit**: YES (groups with T16, T18, T19)
  - Message: `feat(symbol-library): add 2-tier library management and browser UI`
  - Pre-commit: `pnpm run build`

---

- [ ] 18. Multi-Unit Symbol Support

  **What to do**:
  - Extend `SymbolDefinition` data model: `units?: SymbolUnit[]`
  - Each `SymbolUnit`: `{ unitId: number, name: string, graphics: GraphicPrimitive[], pins: SymbolPin[] }`
  - If `units` is empty/undefined: single-unit symbol (current behavior)
  - Editor: unit selector tabs to switch between units while editing
  - Canvas placement: when placing multi-unit symbol, prompt for which unit to place
  - Toolbox: multi-unit symbols show unit count badge
  - Max 4 units enforced in validation (Task 11)

  **Must NOT do**:
  - Implement cross-unit references
  - Add common/shared graphics across units
  - Exceed 4 units

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Blocks**: Task 25 (relay migration needs multi-unit)
  - **Blocked By**: Task 4

  **References**:
  - `src/types/symbol.ts:MultiUnit` — Type definition for multi-unit support (Task 4).
  - KiCad multi-unit: `https://docs.kicad.org/9.0/en/symbol_editor/` — `_U_S` naming convention for units.

  **Acceptance Criteria**:
  - [ ] Multi-unit data model works
  - [ ] Editor shows unit tabs for multi-unit symbols
  - [ ] Canvas placement allows unit selection
  - [ ] Max 4 units validated
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Multi-unit symbol creation
    Tool: Playwright
    Steps:
      1. Open Symbol Editor, create symbol with 2 units (coil + contact)
      2. Assert: unit tabs visible in editor
      3. Switch between units, add graphics/pins to each
      4. Save
      5. Assert: symbol saved with 2 units
    Expected Result: Multi-unit symbol created successfully
    Evidence: .sisyphus/evidence/task-18-multi-unit.png
  ```

  **Commit**: YES (groups with T16, T17, T19)
  - Message: `feat(symbol-library): add 2-tier library management and browser UI`
  - Pre-commit: `pnpm run build`

---

- [ ] 19. Symbol Editor Undo/Redo

  **What to do**:
  - Implement command pattern in `src/components/SymbolEditor/history/`
  - `EditorCommand` interface: `execute()`, `undo()`, `description`
  - Commands for: addPrimitive, removePrimitive, movePrimitive, resizePrimitive, addPin, removePin, movePin, editProperties
  - `HistoryManager`: push commands, undo/redo stacks, max depth 50
  - Keyboard: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
  - UI: undo/redo buttons in toolbar with tooltip showing action description

  **Must NOT do**:
  - Implement branching undo (linear only)
  - Persist history across editor sessions
  - Add undo for save/load operations

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Blocks**: None
  - **Blocked By**: Task 11

  **References**:
  - `src/components/OneCanvas/machines/interactionMachine.ts` — State machine pattern. Editor uses command pattern instead, but understand the existing interaction model.

  **Acceptance Criteria**:
  - [ ] Ctrl+Z undoes last action
  - [ ] Ctrl+Shift+Z redoes
  - [ ] 50 action depth limit
  - [ ] Works for all drawing and pin operations
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Undo/redo drawing actions
    Tool: Playwright
    Steps:
      1. Open Symbol Editor, draw a rectangle
      2. Press Ctrl+Z
      3. Assert: rectangle removed
      4. Press Ctrl+Shift+Z
      5. Assert: rectangle restored
    Expected Result: Undo removes, redo restores
    Evidence: .sisyphus/evidence/task-19-undo-redo.png
  ```

  **Commit**: YES (groups with T16, T17, T18)
  - Message: `feat(symbol-library): add 2-tier library management and browser UI`
  - Pre-commit: `pnpm run build`

### Wave 5 — Port System Migration (Isolated)

- [ ] 20. Port Position Equivalence Tests (Golden File)

  **What to do**:
  - For all 22 block types in `blockDefinitions.ts`:
    - Compute exact port positions using current offset formula: `blockPos + (blockSize × offset)`
    - Record in fixture file: `src/__tests__/fixtures/port-positions.json`
  - Write Vitest tests that assert these exact positions (golden file pattern)
  - This creates the safety net for Task 21’s migration

  **Must NOT do**:
  - Change any port position logic
  - Modify block definitions

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Blocks**: Task 21
  - **Blocked By**: Task 3

  **References**:
  - `src/components/OneCanvas/blockDefinitions.ts` — All 22 block definitions with ports and offsets.
  - `src/components/OneCanvas/components/Port.tsx` — Port position calculation formula.
  - `.sisyphus/evidence/task-3-port-consumers.md` — Port consumer audit from Task 3.

  **Acceptance Criteria**:
  - [ ] `port-positions.json` fixture with all 22 block types
  - [ ] Vitest tests pass for all blocks
  - [ ] `pnpm run test` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Golden file tests pass
    Tool: Bash
    Steps:
      1. Run: pnpm test -- --grep 'port position'
      2. Assert: all tests pass, 0 failures
      3. Run: cat src/__tests__/fixtures/port-positions.json | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(Object.keys(JSON.parse(d)).length)"
      4. Assert: outputs 22 (all block types covered)
    Expected Result: 22 block types with golden port positions
    Evidence: .sisyphus/evidence/task-20-golden-ports.txt
  ```

  **Commit**: YES (groups with T21, T22)
  - Message: `refactor(canvas): migrate port coordinates from offset to absolute`
  - Pre-commit: `pnpm run test`

---

- [ ] 21. Port Coordinate System Migration (offset→absolute)

  **What to do**:
  - Extend `Port` interface: add `absolutePosition?: { x: number, y: number }`
  - Modify `Port.tsx`: if `absolutePosition` exists, use it; else fall back to offset calculation
  - Update `serialization.ts`: serialize `absolutePosition` for custom_symbol blocks, read both formats
  - Convert all 22 block definitions: compute absolutePosition from current offset values, add to definitions
  - Run Task 20 golden file tests → must pass identically (pixel-perfect)

  **Must NOT do**:
  - Remove the `offset` field (backward compat)
  - Change port positions for any existing block (must be pixel-identical)
  - Run this simultaneously with built-in migration (guardrail)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Blocks**: Tasks 22, 23-27
  - **Blocked By**: Task 20

  **References**:
  - `src/components/OneCanvas/types.ts:Port` — Interface to extend.
  - `src/components/OneCanvas/components/Port.tsx` — Position calculation to make dual-mode.
  - `.sisyphus/evidence/task-3-port-consumers.md` — Full list of files to update.
  - `src/__tests__/fixtures/port-positions.json` — Golden file from Task 20 for regression testing.

  **Acceptance Criteria**:
  - [ ] Port interface has `absolutePosition` field
  - [ ] Port.tsx uses absolutePosition when available
  - [ ] Task 20 golden tests still pass (pixel-identical)
  - [ ] Serialization handles both formats
  - [ ] `pnpm run build && pnpm run test` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Port positions unchanged after migration
    Tool: Bash
    Steps:
      1. Run: pnpm test -- --grep 'port position'
      2. Assert: ALL golden file tests pass (0 failures)
    Expected Result: Pixel-identical port positions
    Evidence: .sisyphus/evidence/task-21-port-migration.txt

  Scenario: Backward compat — old projects load
    Tool: Playwright
    Steps:
      1. Load existing canvas with wired blocks
      2. Assert: all wires still connected at correct positions
      3. Assert: no visual displacement of ports
    Expected Result: Old projects render identically
    Evidence: .sisyphus/evidence/task-21-backward-compat.png
  ```

  **Commit**: YES (groups with T20, T22)
  - Message: `refactor(canvas): migrate port coordinates from offset to absolute`
  - Pre-commit: `pnpm run test`

---

- [ ] 22. Wire Routing Verification After Port Migration

  **What to do**:
  - Create test canvas with multiple block types connected by wires
  - Assert all wire paths are orthogonal (no diagonal segments)
  - Assert wire endpoints exactly match port positions
  - Compare before/after screenshots
  - Test with: relay→button, motor→overload_relay, plc_in→plc_out connections

  **Must NOT do**:
  - Modify wire routing algorithm
  - Change any block or port code

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Blocks**: Tasks 23-27
  - **Blocked By**: Task 21

  **References**:
  - `src/components/OneCanvas/geometry/wireGeometry.ts` — Wire path calculation.
  - `tests/e2e/` — Existing Playwright test patterns.

  **Acceptance Criteria**:
  - [ ] Test canvas with 3+ connected block pairs
  - [ ] All wires orthogonal (verified programmatically)
  - [ ] Wire endpoints match port positions
  - [ ] Visual QA screenshots saved

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Wires remain orthogonal after port migration
    Tool: Playwright
    Steps:
      1. Open canvas with pre-wired blocks
      2. Assert: all wire path segments are horizontal or vertical
      3. Assert: no wire endpoint gaps (endpoints touch ports)
      4. Screenshot full canvas
    Expected Result: Perfect orthogonal wiring, no displacement
    Evidence: .sisyphus/evidence/task-22-wire-verification.png
  ```

  **Commit**: YES (groups with T20, T21)
  - Message: `refactor(canvas): migrate port coordinates from offset to absolute`
  - Pre-commit: `pnpm run test`

### Wave 6 — Built-in Migration (Depends on Wave 5)

- [ ] 23. Built-in Migration Batch 1 (fuse, terminal_block, emergency_stop, pilot_lamp)

  **What to do**:
  - For each block: create `.json` symbol definition matching current SVG rendering exactly
  - Save to `src/assets/builtin-symbols/{block_name}.json`
  - Register in built-in symbol library (loaded at app startup)
  - BlockRenderer: when built-in symbol definition exists for a block type, use SymbolRenderer path
  - Before/after screenshot comparison for each block

  **Must NOT do**:
  - Change the visual appearance of any block
  - Remove the original block component files (keep as fallback)
  - Modify specialized properties panels for these blocks

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T24-T27)
  - **Blocks**: Task 28
  - **Blocked By**: Tasks 9, 21, 22

  **References**:
  - `src/components/OneCanvas/components/blocks/FuseBlock.tsx`, `TerminalBlockComp.tsx`, `EmergencyStopBlock.tsx`, `PilotLampBlock.tsx` — Current SVG rendering to replicate in JSON.
  - `src/components/OneCanvas/blockDefinitions.ts` — Block sizes and port definitions to convert.

  **Acceptance Criteria**:
  - [ ] 4 JSON symbol definitions created
  - [ ] Each renders identically to original component
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Batch 1 visual identity
    Tool: Playwright
    Steps:
      1. Place each migrated block on canvas
      2. Assert: renders correctly (not blank/error)
      3. Screenshot each block
      4. Compare with pre-migration reference
    Expected Result: Visually identical blocks
    Evidence: .sisyphus/evidence/task-23-batch1-visual.png
  ```

  **Commit**: YES (individual batch commit)
  - Message: `refactor(blocks): migrate fuse, terminal_block, emergency_stop, pilot_lamp to symbol system`
  - Pre-commit: `pnpm run build`

---

- [ ] 24. Built-in Migration Batch 2 (led, button, text, net_label)

  **What to do**: Same as T23 for this batch of 4 blocks.

  **Recommended Agent Profile**: `unspecified-high`, Skills: []
  **Parallelization**: Parallel with T23,T25-T27. Blocks: T28. Blocked By: T9,T21,T22

  **References**:
  - `src/components/OneCanvas/components/blocks/LedBlock.tsx`, `ButtonBlock.tsx`, `TextBlock.tsx`, `NetLabelBlock.tsx`
  - `src/components/OneCanvas/blockDefinitions.ts`

  **Acceptance Criteria**:
  - [ ] 4 JSON symbol definitions created
  - [ ] Visual identity maintained
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Batch 2 visual identity
    Tool: Playwright
    Steps:
      1. Place led, button, text, net_label on canvas
      2. Assert: all render correctly
      3. Screenshot comparison
    Expected Result: Visually identical
    Evidence: .sisyphus/evidence/task-24-batch2-visual.png
  ```

  **Commit**: YES — `refactor(blocks): migrate led, button, text, net_label to symbol system`

---

- [ ] 25. Built-in Migration Batch 3 (relay, contactor, motor, overload_relay)

  **What to do**: Same as T23. relay/contactor use multi-unit support (Task 18) for coil+contact.

  **Recommended Agent Profile**: `unspecified-high`, Skills: []
  **Parallelization**: Parallel with T23-T24,T26-T27. Blocks: T28. Blocked By: T9,T18,T21,T22

  **References**:
  - `src/components/OneCanvas/components/blocks/RelayBlock.tsx`, `ContactorBlock.tsx`, `MotorBlock.tsx`, `OverloadRelayBlock.tsx`
  - Task 18 multi-unit support for relay/contactor coil+contact pattern

  **Acceptance Criteria**:
  - [ ] 4 JSON definitions (relay/contactor as multi-unit)
  - [ ] Relay coil and contact render as separate units
  - [ ] `pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Batch 3 with multi-unit
    Tool: Playwright
    Steps:
      1. Place relay (coil unit) and relay (contact unit) on canvas
      2. Assert: both units render correctly with distinct graphics
      3. Place motor, overload_relay
      4. Assert: all render correctly
    Expected Result: Multi-unit relay works, all blocks identical
    Evidence: .sisyphus/evidence/task-25-batch3-visual.png
  ```

  **Commit**: YES — `refactor(blocks): migrate relay, contactor, motor, overload_relay to symbol system`

---

- [ ] 26. Built-in Migration Batch 4 (sensor, selector_switch, solenoid_valve, disconnect_switch)

  **What to do**: Same as T23 for this batch.

  **Recommended Agent Profile**: `unspecified-high`, Skills: []
  **Parallelization**: Parallel with T23-T25,T27. Blocks: T28. Blocked By: T9,T21,T22

  **References**:
  - `src/components/OneCanvas/components/blocks/SensorBlock.tsx`, `SelectorSwitchBlock.tsx`, `SolenoidValveBlock.tsx`, `DisconnectSwitchBlock.tsx`

  **Acceptance Criteria**:
  - [ ] 4 JSON symbol definitions, visual identity maintained, build succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Batch 4 visual identity
    Tool: Playwright
    Steps: Place all 4 blocks, assert visual identity, screenshot
    Evidence: .sisyphus/evidence/task-26-batch4-visual.png
  ```

  **Commit**: YES — `refactor(blocks): migrate sensor, selector_switch, solenoid_valve, disconnect_switch`

---

- [ ] 27. Built-in Migration Batch 5 (powersource, transformer, plc_in, plc_out, scope, off_page_connector)

  **What to do**: Same as T23 for this batch of 6 blocks.

  **Recommended Agent Profile**: `unspecified-high`, Skills: []
  **Parallelization**: Parallel with T23-T26. Blocks: T28. Blocked By: T9,T21,T22

  **References**:
  - `src/components/OneCanvas/components/blocks/PowerBlock.tsx`, `TransformerBlock.tsx`, `PlcInBlock.tsx`, `PlcOutBlock.tsx`, `ScopeBlock.tsx`, `OffPageConnectorBlock.tsx`

  **Acceptance Criteria**:
  - [ ] 6 JSON symbol definitions, visual identity maintained, build succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Batch 5 visual identity
    Tool: Playwright
    Steps: Place all 6 blocks, assert visual identity, screenshot
    Evidence: .sisyphus/evidence/task-27-batch5-visual.png
  ```

  **Commit**: YES — `refactor(blocks): migrate powersource, transformer, plc_in, plc_out, scope, off_page_connector`

---

- [ ] 28. Migration Tests + Legacy Project Compatibility

  **What to do**:
  - Create comprehensive test suite verifying ALL 22 migrated blocks
  - Test: load old .mop file (pre-migration format) → all blocks display correctly
  - Test: save migrated project → reload → no data loss
  - Test: port positions unchanged for all 22 blocks (reuse Task 20 golden file)
  - Test: wire connections preserved after migration
  - Test: specialized properties panels still work for each block type

  **Must NOT do**:
  - Delete original block components (keep as fallback)
  - Change test expectations from golden file

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Blocks**: Task 29
  - **Blocked By**: Tasks 23-27

  **References**:
  - `src/__tests__/fixtures/port-positions.json` — Golden port positions from Task 20.
  - `tests/e2e/` — Existing E2E test patterns.

  **Acceptance Criteria**:
  - [ ] All 22 blocks render correctly post-migration
  - [ ] Legacy .mop files load without error
  - [ ] Port positions match golden file
  - [ ] Wire connections preserved
  - [ ] `pnpm run test && pnpm run build` succeeds

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Full migration verification
    Tool: Playwright
    Steps:
      1. Load pre-migration .mop project with all 22 block types
      2. Assert: all blocks render (no blanks/errors)
      3. Assert: all wires connected at correct positions
      4. Save project, reload, verify no data loss
    Expected Result: Complete backward compatibility
    Evidence: .sisyphus/evidence/task-28-migration-verify.png
  ```

  **Commit**: YES — `test(blocks): verify all 22 built-in block migrations`
  - Pre-commit: `pnpm run test`

### Wave 7 — Tests + Integration

- [ ] 29. Vitest Unit Test Suite

  **What to do**:
  - `src/__tests__/symbol-model.test.ts`: SymbolDefinition creation, field validation
  - `src/__tests__/symbol-serialization.test.ts`: round-trip, backward compat, missing symbol
  - `src/__tests__/symbol-validation.test.ts`: all validation rules, edge cases
  - `src/__tests__/pin-grid-alignment.test.ts`: 20px snap math verification

  **Recommended Agent Profile**: `unspecified-high`, Skills: []
  **Parallelization**: Blocks: F1-F4. Blocked By: T28

  **Acceptance Criteria**:
  - [ ] 4+ test files created
  - [ ] `pnpm run test` passes all new tests
  - [ ] Coverage: data model, serialization, validation, grid math

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Unit tests pass
    Tool: Bash
    Steps:
      1. Run: pnpm run test
      2. Assert: 0 failures
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-29-unit-tests.txt
  ```

  **Commit**: YES — `test(symbols): add unit and E2E test suites`

---

- [ ] 30. Playwright E2E Test Suite

  **What to do**:
  - `tests/e2e/symbol-crud.spec.ts`: create symbol in editor, verify in library
  - `tests/e2e/symbol-editor.spec.ts`: draw shapes, place pins, set properties, save
  - `tests/e2e/symbol-placement.spec.ts`: drag symbol from library to canvas
  - `tests/e2e/symbol-wiring.spec.ts`: connect wires to custom symbol pins

  **Recommended Agent Profile**: `unspecified-high`, Skills: [`playwright`]
  **Parallelization**: Blocks: F1-F4. Blocked By: T15, T17

  **Acceptance Criteria**:
  - [ ] 4 E2E test files created
  - [ ] `pnpm run test:e2e` passes

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: E2E tests pass
    Tool: Bash
    Steps:
      1. Run: pnpm run test:e2e
      2. Assert: 0 failures
    Expected Result: All E2E tests pass
    Evidence: .sisyphus/evidence/task-30-e2e-tests.txt
  ```

  **Commit**: YES — `test(symbols): add unit and E2E test suites`

---

- [ ] 31. Integration Test: Full Workflow

  **What to do**:
  - End-to-end Playwright test: create symbol → save → find in library → drag to canvas → connect wires → save project → reload → verify everything preserved
  - This is the ultimate acceptance test for the entire feature
  - Test file: `tests/e2e/symbol-full-workflow.spec.ts`

  **Recommended Agent Profile**: `deep`, Skills: [`playwright`]
  **Parallelization**: Blocks: F1-F4. Blocked By: T29, T30

  **Acceptance Criteria**:
  - [ ] Full workflow test passes end-to-end
  - [ ] Symbol persists across save/reload cycle
  - [ ] Wire connections to custom symbol pins survive reload

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Complete lifecycle
    Tool: Playwright
    Steps:
      1. Open Symbol Editor, create symbol with rect + 2 pins (input, output)
      2. Save as "TestSymbol" in project library
      3. Open canvas, drag TestSymbol from library
      4. Connect wire from built-in block to TestSymbol input pin
      5. Save project
      6. Reload project
      7. Assert: TestSymbol still on canvas with correct graphics
      8. Assert: wire still connected to input pin
      9. Assert: no console errors during entire flow
    Expected Result: Complete lifecycle works without data loss
    Evidence: .sisyphus/evidence/task-31-full-workflow.png
  ```

  **Commit**: YES — `test(symbols): add integration test for full symbol lifecycle`
  - Pre-commit: `pnpm run test:e2e`
---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm run build` + `pnpm run test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-task integration. Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 0**: `chore(canvas): cleanup dead code and de-duplicate BlockRenderer`
- **Wave 1**: `feat(symbols): add symbol data model, Tauri CRUD, and serialization`
- **Wave 2**: `feat(canvas): add generic SymbolRenderer and dual rendering path`
- **Wave 3**: `feat(symbol-editor): add dedicated canvas editor with drawing tools`
- **Wave 4**: `feat(symbol-library): add 2-tier library management and browser UI`
- **Wave 5**: `refactor(canvas): migrate port coordinates from offset to absolute`
- **Wave 6 batch**: `refactor(blocks): migrate {batch_name} to symbol system`
- **Wave 7**: `test(symbols): add unit and E2E test suites`

---

## Success Criteria

### Verification Commands
```bash
pnpm run build           # Expected: success, 0 errors
pnpm run test            # Expected: all tests pass
pnpm run test:e2e        # Expected: all Playwright tests pass
pnpm tauri build         # Expected: Rust + frontend build success
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (Vitest + Playwright)
- [ ] Existing .mop projects load correctly
- [ ] Custom symbols can be created, placed, wired, saved, reloaded
- [ ] Built-in blocks render identically before and after migration
- [ ] Port positions are grid-aligned (20px) for all symbols
- [ ] No console errors during normal operation
