# Symbol Data Model v2 Migration

## TL;DR

> **Quick Summary**: Unify ModOne's 3 parallel component pipelines (hardcoded BlockType, data-driven SymbolDefinition, circuit templates) into a single KiCad-style SymbolDefinition v2 pipeline. The new model adds 12 KiCad-compatible pin electrical types, PLC functional roles, SPICE model references, symbol inheritance, and IEC 60617 classification.
> 
> **Deliverables**:
> - SymbolPin v2 type definitions (TS + Rust + JSON Schema) with dual type system
> - 30+ builtin SymbolDefinition v2 JSON files covering all canonical block types
> - Unified symbolBridge replacing both SymbolLibrary (hardcoded) and customSymbolBridge
> - Dynamic ComponentInstance type replacing the 27 specialized Block interfaces
> - Data-driven Toolbox reading from SymbolDefinition registry
> - File migration utility for existing .yaml project files
> 
> **Estimated Effort**: XL (10 tasks, ~31 files touched)
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Task 1 -> Task 4 -> Task 6 -> Task 7 -> Task 8 -> Task 10

---

## Context

### Original Request
User wants a KiCad-like symbol library system where built-in symbols and user-created symbols flow through the same pipeline, with proper port types (including PLC-specific roles), pin numbering, and future SPICE support. The symbol data model was collaboratively designed to v2 spec before planning began.

### Interview Summary
**Key Discussions**:
- Pin type structure: dual-field (electricalType + functionalRole) chosen over single-field
- SPICE support: model reference only (Sim.Device/Library/Name/Pins pattern), not full parameter storage
- Pin numbering: number (string, display) + sortOrder (number, internal ordering)
- Electrical types: KiCad full 12 types chosen for ERC compatibility
- Functional roles: 4 types (general, plc_input, plc_output, communication)
- Symbol inheritance: extendsSymbol field included for part variants

**Research Findings**:
- KiCad .kicad_sym uses 12 pin types, 9 shapes, Sim.* properties, extends inheritance
- IEC 60617 provides classification taxonomy (sections 01-13), not rendering spec
- Current codebase has TWO BlockType definitions (circuit.ts: 42 values, OneCanvas/types.ts: 23 values)
- 31 files reference BlockType — blast radius much larger than initially estimated
- 22 builtin symbols already exist in src/assets/builtin-symbols/ using v1 schema
- serialization.ts validates block types on load — file compatibility critical

### Metis Review
**Identified Gaps** (addressed):
- Dual BlockType definition must be resolved FIRST (Phase 0.5 inserted)
- Existing builtin symbols need v1 to v2 upgrade, not just new creation
- serialization.ts has its own hardcoded getDefaultPorts() — a third parallel pipeline
- SimulationRenderer branches on 15+ type strings — must be data-driven
- Project file backward compatibility requires migration function
- SymbolEditor needs v2 output format update
- Custom symbols created by users in v1 format need automatic upgrade

---

## Work Objectives

### Core Objective
Replace 3 parallel component pipelines with a single SymbolDefinition v2-driven pipeline, ensuring zero regression in existing functionality and full backward compatibility with saved project files.

### Concrete Deliverables
- `src/types/symbol.ts` — v2 type definitions (PinElectricalType 12, PinFunctionalRole 4, SpiceModelRef, etc.)
- `src-tauri/src/symbols/types.rs` — Rust mirror of v2 types
- `src/types/symbol.schema.json` — updated JSON schema
- `src/assets/builtin-symbols/*.ts` — 30+ v2 SymbolDefinition files
- `src/components/OneCanvas/renderers/symbols/symbolBridge.ts` — unified bridge
- `src/types/circuit.ts` — ComponentInstance type, file migration utility
- `src/components/OneCanvas/components/Toolbox.tsx` — dynamic symbol loading

### Definition of Done
- [ ] `pnpm run build` — zero TypeScript errors
- [ ] `pnpm run test` — all tests pass
- [ ] `pnpm run test:e2e` — E2E smoke test passes
- [ ] All block types render through unified bridge
- [ ] Existing .yaml project files load correctly (backward compat)
- [ ] Simulation tinting works for all 15 block types
- [ ] Toolbox shows all symbols with correct drag-and-drop
- [ ] SymbolEditor outputs v2 format

### Must Have
- 12 KiCad-compatible PinElectricalType values with ERC-ready classification
- Dual-field pin typing (electricalType + functionalRole)
- Pin number (string, user-editable) + sortOrder (number, auto-increment)
- SpiceModelRef with pin-to-node mapping (structure only, no SPICE simulation)
- extendsSymbol for symbol inheritance
- Full backward compatibility with existing .yaml project files
- No regression in simulation tinting behavior

### Must NOT Have (Guardrails)
- **NO IEC 60617 symbol rendering** — iecSection/iecCategory are metadata fields only, not populated or used in rendering
- **NO SPICE simulation engine** — SpiceModelRef is a schema placeholder, no SPICE rendering or execution
- **NO Toolbox UI redesign** — same visual layout and categories, just data source change
- **NO LadderEditor changes** — it re-exports PortType but is otherwise decoupled
- **NO Rust simulation engine changes** — backend coupling is minimal (CRUD only)
- **NO undo/redo system refactoring** — separate concern
- **NO new design patterns** (factories, registries, DI containers) — follow existing code patterns
- **NO documentation/JSDoc additions** — focus on code changes only
- **NO adjacent code refactoring** — "while we're here" changes are forbidden
- **NO abstract compatibility layers** — do the real migration, don't wrap old types
- **NO removal of LEGACY_BLOCK_TYPE_MAP** — must remain for file compatibility throughout all phases

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Vitest + Playwright)
- **Automated tests**: Tests-after (verify each phase with existing + new tests)
- **Framework**: Vitest (unit/integration), Playwright (E2E)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Type changes**: Use Bash (`pnpm run build`) — verify zero TS errors
- **Test suite**: Use Bash (`pnpm run test`) — verify all pass
- **E2E**: Use Bash (`pnpm run test:e2e`) — canvas loads, blocks place, wires connect
- **Serialization**: Use Bash (node script) — load existing YAML, verify round-trip

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — type foundations, 3 parallel):
+-- Task 1: Define v2 TS types [unspecified-high]
+-- Task 2: Define v2 Rust types [unspecified-high]
+-- Task 3: Update JSON schema [quick]

Wave 2 (After Wave 1 — resolve conflicts + upgrade existing, 2 parallel):
+-- Task 4: Resolve dual BlockType definitions [deep] (CRITICAL)
+-- Task 5: Upgrade 22 existing builtin symbols to v2 [unspecified-high]

Wave 3 (After Wave 2 — complete builtins + unify bridge, sequential):
+-- Task 6: Create missing builtin symbols for canonical types [deep]
+-- Task 7: Unify bridge: customSymbolBridge -> symbolBridge [deep]

Wave 4 (After Wave 3 — highest risk phase):
+-- Task 8: Replace BlockType union with ComponentInstance [ultrabrain]

Wave 5 (After Wave 4 — UI + cleanup, 2 parallel):
+-- Task 9: Update Toolbox/Library UI to dynamic [visual-engineering]
+-- Task 10: Cleanup old types and dead code [unspecified-high]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
+-- Task F1: Plan compliance audit (oracle)
+-- Task F2: Code quality review (unspecified-high)
+-- Task F3: Real manual QA (unspecified-high)
+-- Task F4: Scope fidelity check (deep)

Critical Path: Task 1 -> Task 4 -> Task 6 -> Task 7 -> Task 8 -> Task 10 -> F1-F4
Parallel Speedup: ~40% faster than sequential
Max Concurrent: 3 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 (TS v2 types) | — | 4, 5 | 1 |
| 2 (Rust v2 types) | — | 5 | 1 |
| 3 (JSON schema) | — | 5 | 1 |
| 4 (Dual BlockType fix) | 1 | 6, 7, 8 | 2 |
| 5 (Upgrade builtins) | 1, 2, 3 | 6 | 2 |
| 6 (Create missing builtins) | 4, 5 | 7 | 3 |
| 7 (Unify bridge) | 6 | 8 | 3 |
| 8 (Replace BlockType) | 7 | 9, 10 | 4 |
| 9 (Toolbox UI) | 8 | 10 | 5 |
| 10 (Cleanup) | 8, 9 | — | 5 |

### Agent Dispatch Summary

- **Wave 1**: **3** — T1 -> `unspecified-high`, T2 -> `unspecified-high`, T3 -> `quick`
- **Wave 2**: **2** — T4 -> `deep`, T5 -> `unspecified-high`
- **Wave 3**: **2** — T6 -> `deep`, T7 -> `deep`
- **Wave 4**: **1** — T8 -> `ultrabrain`
- **Wave 5**: **2** — T9 -> `visual-engineering`, T10 -> `unspecified-high`
- **FINAL**: **4** — F1 -> `oracle`, F2 -> `unspecified-high`, F3 -> `unspecified-high`, F4 -> `deep`

---

## TODOs

- [ ] 1. Define v2 Type Definitions (TypeScript)

  **What to do**:
  - Add new v2 types ALONGSIDE existing types in `src/types/symbol.ts` (do NOT modify existing types yet):
    - Expand `PinElectricalType` to 12 values: add `tri_state`, split `power` into `power_in`/`power_out`, add `open_collector`, `open_emitter`, `free`, `unspecified`, `no_connect`
    - Add `PinFunctionalRole = 'general' | 'plc_input' | 'plc_output' | 'communication'`
    - Expand `PinShape` to 9 values: add `inverted_clock`, `input_low`, `clock_low`, `output_low`, `edge_clock_high`, `non_logic`
    - Add `sortOrder: number` and `nameVisible?: boolean`, `numberVisible?: boolean` to `SymbolPin`
    - Rename `type` field to `electricalType` in SymbolPin, add `functionalRole` field
    - Add `SpiceModelRef` interface: `{ device, type?, library?, name?, pinMapping: Array<{pinNumber, spiceNode}>, params? }`
    - Add to `SymbolDefinition`: `extendsSymbol?`, `spice?`, `iecSection?`, `iecCategory?`, `refDesignator?`, `pinNumbersHidden?`, `pinNamesHidden?`, `pinNameOffset?`, `excludeFromSim?`
  - Add `PortV2` interface enriched with `number`, `electricalType`, `functionalRole` (alongside existing `Port`)
  - Keep all existing types intact for backward compatibility during migration

  **Must NOT do**:
  - Do NOT delete or modify existing PinElectricalType/PinShape/SymbolPin types yet
  - Do NOT change any imports in other files
  - Do NOT add factories, registries, or dependency injection patterns

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/types/symbol.ts` — Current SymbolPin, PinElectricalType, PinShape, SymbolDefinition definitions. ADD new types alongside, do not modify.
  - `src/types/circuit.ts:41-51` — Current Port interface. Create PortV2 alongside it.

  **API/Type References**:
  - KiCad pin types: input, output, bidirectional, tri_state, passive, power_in, power_out, open_collector, open_emitter, free, unspecified, no_connect
  - KiCad pin shapes: line, inverted, clock, inverted_clock, input_low, clock_low, output_low, edge_clock_high, non_logic
  - KiCad SPICE model: Sim.Device/Type/Library/Name/Pins/Params pattern

  **Acceptance Criteria**:
  - [ ] `pnpm run build` passes with zero errors
  - [ ] `pnpm run test` all pass (no regressions)
  - [ ] New types exported from `src/types/symbol.ts`
  - [ ] Existing types still present and unchanged

  **QA Scenarios:**

  ```
  Scenario: Build succeeds with new types added alongside old
    Tool: Bash
    Steps:
      1. Run `pnpm run build` — exit code 0
      2. Run `pnpm run test` — exit code 0
    Expected Result: Both commands exit 0 with no errors
    Evidence: .sisyphus/evidence/task-1-build-pass.txt

  Scenario: Existing type imports still work
    Tool: Bash
    Steps:
      1. Run `npx tsc --noEmit` to confirm compilation
      2. Grep for PinElectricalType usage count — verify unchanged
    Expected Result: Zero type errors, import count unchanged
    Evidence: .sisyphus/evidence/task-1-imports-intact.txt
  ```

  **Commit**: YES
  - Message: `feat(types): add SymbolPin v2 type definitions with 12 electrical types`
  - Files: `src/types/symbol.ts`
  - Pre-commit: `pnpm run build && pnpm run test`

- [ ] 2. Define v2 Type Definitions (Rust Backend)

  **What to do**:
  - Mirror all new v2 TS types in `src-tauri/src/symbols/types.rs`:
    - Expand `PinElectricalType` enum to 12 variants matching TS
    - Add `PinFunctionalRole` enum: General, PlcInput, PlcOutput, Communication
    - Expand `PinShape` enum to 9 variants
    - Add `sort_order`, `name_visible`, `number_visible` as Option fields to SymbolPin
    - Add `functional_role` as Option field to SymbolPin
    - Handle serde compat: pin_type field must accept both old `type` key and new `electricalType` key
    - Add `SpiceModelRef` struct with `SpicePinMapping`
    - Add optional v2 fields to `SymbolDefinition`: extends_symbol, spice, iec_section, iec_category, ref_designator, pin_numbers_hidden, pin_names_hidden, pin_name_offset, exclude_from_sim
  - ALL new fields must be Option with serde skip_serializing_if
  - Existing JSON files must still deserialize correctly (backward compat)

  **Must NOT do**:
  - Do NOT change existing field names or remove existing enum variants
  - Do NOT modify Tauri command signatures
  - Do NOT add new Tauri commands

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 5
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src-tauri/src/symbols/types.rs` — Current Rust types. ALL structs use serde rename_all camelCase. New fields use Option with skip_serializing_if.
  - `src-tauri/src/symbols/storage.rs` — JSON file I/O. Must remain compatible.

  **Acceptance Criteria**:
  - [ ] `cargo check` in src-tauri/ compiles without errors
  - [ ] Existing v1 JSON symbol files still deserialize correctly

  **QA Scenarios:**

  ```
  Scenario: Rust backend compiles with v2 types
    Tool: Bash
    Steps:
      1. Run `cargo check` in src-tauri/ — exit code 0
    Expected Result: Zero compilation errors
    Evidence: .sisyphus/evidence/task-2-cargo-check.txt

  Scenario: Existing v1 JSON files still deserialize
    Tool: Bash
    Steps:
      1. Run `cargo test` in src-tauri/
    Expected Result: No deserialization errors
    Evidence: .sisyphus/evidence/task-2-compat.txt
  ```

  **Commit**: YES
  - Message: `feat(backend): mirror v2 symbol types in Rust`
  - Files: `src-tauri/src/symbols/types.rs`
  - Pre-commit: `cargo check` (in src-tauri/)

- [ ] 3. Update JSON Schema

  **What to do**:
  - Update `src/types/symbol.schema.json` to include all v2 fields:
    - Expand PinElectricalType enum to 12 values in SymbolPin.type
    - Add functionalRole enum field (general, plc_input, plc_output, communication) with default general
    - Expand PinShape enum to 9 values
    - Add sortOrder (integer), nameVisible (boolean), numberVisible (boolean) to SymbolPin
    - Add SpiceModelRef definition with pinMapping array
    - Add extendsSymbol, spice, iecSection, iecCategory, refDesignator, pinNumbersHidden, pinNamesHidden, pinNameOffset, excludeFromSim to SymbolDefinition properties
  - ALL new fields must be optional (not in required array) for backward compatibility
  - Existing v1 symbol JSON files must still validate against updated schema

  **Must NOT do**:
  - Do NOT add new required fields (breaks existing data)
  - Do NOT change existing field definitions

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 5
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/types/symbol.schema.json` — Current JSON schema (493 lines). Follow existing pattern: definitions section for sub-types, oneOf for union types.

  **Acceptance Criteria**:
  - [ ] Schema file is valid JSON Schema draft-07
  - [ ] Existing builtin symbol JSON files validate against updated schema

  **QA Scenarios:**

  ```
  Scenario: Schema validates existing v1 symbols
    Tool: Bash
    Steps:
      1. Validate schema is valid JSON
      2. Test existing builtin symbol files against updated schema
    Expected Result: All files valid, zero validation errors
    Evidence: .sisyphus/evidence/task-3-schema-validation.txt
  ```

  **Commit**: YES
  - Message: `chore(schema): update symbol.schema.json for v2 fields`
  - Files: `src/types/symbol.schema.json`
  - Pre-commit: `pnpm run build`

- [ ] 4. Resolve Dual BlockType Definitions (CRITICAL FOUNDATION)

  **What to do**:
  - This is the MOST CRITICAL prerequisite. Two competing BlockType definitions exist:
    - `src/types/circuit.ts`: CanonicalBlockType (42 values) + BlockType = CanonicalBlockType | (string & {})
    - `src/components/OneCanvas/types.ts`: BlockType (23 legacy values only)
  - Make circuit.ts the single source of truth:
    1. Use `lsp_find_references` on BOTH BlockType definitions to map all 31+ import sites
    2. In `src/components/OneCanvas/types.ts`, REMOVE the local BlockType definition and re-export from `@types/circuit`
    3. Update all files that import BlockType from OneCanvas/types to use the canonical source
    4. Fix any type mismatches this reveals (legacy names vs canonical names)
    5. Verify LEGACY_BLOCK_TYPE_MAP in circuit.ts still maps all 16 legacy names
  - Use `ast_grep_search` to find all `block.type === '...'` patterns across codebase for completeness
  - Use `ast_grep_replace(dryRun=true)` to preview import path changes before applying

  **Must NOT do**:
  - Do NOT remove any BlockType values — only consolidate the definition
  - Do NOT change LEGACY_BLOCK_TYPE_MAP
  - Do NOT modify block type values in serialization.ts

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 5, independent)
  - **Blocks**: Tasks 6, 7, 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/types/circuit.ts:57-84` — CanonicalBlockType union (42 values) + BlockType with string escape hatch
  - `src/components/OneCanvas/types.ts:14-38` — Legacy BlockType union (23 values). This is the one to REMOVE and re-export.
  - `src/types/circuit.ts` — LEGACY_BLOCK_TYPE_MAP maps 16 legacy names to canonical. MUST remain.

  **API/Type References**:
  - `src/components/OneCanvas/blockDefinitions.ts` — imports BlockType from local types.ts. Must update import.
  - `src/components/OneCanvas/renderers/BlockRenderer.ts` — imports BlockType. Must update.
  - `src/components/OneCanvas/utils/symbolThumbnails.ts` — imports BlockType. Must update.

  **Acceptance Criteria**:
  - [ ] `pnpm run build` passes with zero errors
  - [ ] `pnpm run test` all pass
  - [ ] grep shows exactly ONE BlockType definition (in circuit.ts)
  - [ ] All 31+ files compile correctly with unified import

  **QA Scenarios:**

  ```
  Scenario: Single BlockType definition exists
    Tool: Bash
    Steps:
      1. Run grep to find BlockType definitions — expect exactly one in circuit.ts
      2. Run `pnpm run build` — exit code 0
      3. Run `pnpm run test` — all pass
    Expected Result: One definition, zero build errors, all tests pass
    Evidence: .sisyphus/evidence/task-4-single-blocktype.txt

  Scenario: Legacy type mapping still works
    Tool: Bash
    Steps:
      1. Grep for LEGACY_BLOCK_TYPE_MAP — verify it exists with 16 entries
    Expected Result: Map exists and is unchanged
    Evidence: .sisyphus/evidence/task-4-legacy-map.txt
  ```

  **Commit**: YES
  - Message: `refactor(types): unify dual BlockType definitions into circuit.ts`
  - Files: `src/types/circuit.ts`, `src/components/OneCanvas/types.ts`, ~31 import updates
  - Pre-commit: `pnpm run build && pnpm run test`

- [ ] 5. Upgrade 22 Existing Builtin Symbols to v2 Schema

  **What to do**:
  - Update all 22 files in `src/assets/builtin-symbols/` to use v2 SymbolPin type:
    - Map existing `type` field to `electricalType`: input->input, output->output, bidirectional->bidirectional, power->power_in (default, override to power_out where appropriate like power source output), passive->passive
    - Add `functionalRole` field: PLC symbols get plc_input/plc_output, others get general
    - Add `sortOrder` to each pin (based on current array index)
    - Add `nameVisible: true` and `numberVisible: true` as defaults
  - Update the TypeScript import/type to reference v2 SymbolPin type
  - Verify pin positions match existing blockDefinitions.ts values (port regression test)

  **Must NOT do**:
  - Do NOT change pin positions or dimensions
  - Do NOT add new symbols (that is Task 6)
  - Do NOT populate iecSection/spice fields (schema placeholders only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4, independent)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 1, 2, 3

  **References**:

  **Pattern References**:
  - `src/assets/builtin-symbols/` — All 22 existing symbol definition files. Check actual file structure.
  - `src/components/OneCanvas/blockDefinitions.ts` — Port positions to verify against (absolutePosition values must match).

  **Test References**:
  - `tests/` — Look for builtin-symbol-migration.test.ts and port-positions.test.ts for golden file validation.

  **Acceptance Criteria**:
  - [ ] `pnpm run build` passes
  - [ ] `pnpm run test` all pass including builtin-symbol tests
  - [ ] All 22 symbols have electricalType, functionalRole, sortOrder on every pin

  **QA Scenarios:**

  ```
  Scenario: All builtins have v2 pin fields
    Tool: Bash
    Steps:
      1. Grep all builtin symbol files for electricalType — should appear in all 22
      2. Grep for functionalRole — should appear in all 22
      3. Grep for sortOrder — should appear in all 22
      4. Run `pnpm run test` — all pass
    Expected Result: All 22 files have v2 fields, all tests pass
    Evidence: .sisyphus/evidence/task-5-builtin-upgrade.txt

  Scenario: Pin positions unchanged
    Tool: Bash
    Steps:
      1. Run port-positions tests if they exist
      2. Compare pin.position values against blockDefinitions.ts absolutePosition values
    Expected Result: All positions match exactly
    Evidence: .sisyphus/evidence/task-5-port-positions.txt
  ```

  **Commit**: YES
  - Message: `feat(symbols): upgrade 22 builtin symbols to v2 schema`
  - Files: `src/assets/builtin-symbols/*`
  - Pre-commit: `pnpm run build && pnpm run test`

- [ ] 6. Create Missing Builtin Symbols for Canonical Types

  **What to do**:
  - Compare CanonicalBlockType (42 values) against existing builtin symbols (22 files)
  - Create new v2 SymbolDefinition files for any canonical types without a corresponding builtin:
    - Examples: power_source, ground, switch_no, switch_nc, switch_changeover, push_button_no, push_button_nc, circuit_breaker, relay_coil, relay_contact_no, relay_contact_nc, resistor, capacitor, inductor, diode, terminal, connector, junction_box, etc.
  - For multi-unit symbols (relay has coil + contacts), create SEPARATE SymbolDefinition files for each canonical sub-type. The relay_coil and relay_contact_no are separate placeable components.
  - Port positions MUST match existing blockDefinitions.ts values EXACTLY (verify against golden file tests)
  - Use the hardcoded drawing code in SymbolLibrary.ts as reference for graphics primitives
  - Each new symbol must have: v2 electricalType, functionalRole, sortOrder, proper pin positions

  **Must NOT do**:
  - Do NOT change existing blockDefinitions.ts port positions
  - Do NOT populate iecSection/spice/extendsSymbol fields (schema placeholders only)
  - Do NOT modify SymbolLibrary.ts — just reference it for drawing dimensions

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential before Task 7)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 4, 5

  **References**:

  **Pattern References**:
  - `src/assets/builtin-symbols/` — Existing 22 symbols as templates for file format and structure.
  - `src/components/OneCanvas/blockDefinitions.ts:26-480` — Hardcoded port positions, sizes, default props per block type. Pin positions MUST match.
  - `src/components/OneCanvas/renderers/symbols/SymbolLibrary.ts` — Hardcoded Pixi.js drawing code (576 lines). Convert drawing instructions to GraphicPrimitive arrays.
  - `src/components/OneCanvas/utils/symbolThumbnails.ts` — CANONICAL_SYMBOL_TYPES array listing all canonical types.
  - `src/types/circuit.ts:57-84` — CanonicalBlockType union — the complete list of types that need builtins.

  **Acceptance Criteria**:
  - [ ] Every CanonicalBlockType has a corresponding builtin SymbolDefinition
  - [ ] `pnpm run build` passes
  - [ ] `pnpm run test` all pass including port-positions tests
  - [ ] All new symbols have correct pin positions matching blockDefinitions.ts

  **QA Scenarios:**

  ```
  Scenario: All canonical types have builtin symbols
    Tool: Bash
    Steps:
      1. List all CanonicalBlockType values from circuit.ts
      2. List all builtin symbol files in src/assets/builtin-symbols/
      3. Verify 1:1 mapping — every canonical type has a symbol file
      4. Run `pnpm run build && pnpm run test`
    Expected Result: Complete coverage, all tests pass
    Evidence: .sisyphus/evidence/task-6-complete-coverage.txt

  Scenario: Port positions match golden file
    Tool: Bash
    Steps:
      1. Run port-position regression tests
      2. Compare new symbol pin positions against blockDefinitions.ts
    Expected Result: All positions match within tolerance
    Evidence: .sisyphus/evidence/task-6-port-regression.txt
  ```

  **Commit**: YES
  - Message: `feat(symbols): create missing builtin symbols for canonical types`
  - Files: `src/assets/builtin-symbols/*`
  - Pre-commit: `pnpm run build && pnpm run test`

- [ ] 7. Unify Bridge: customSymbolBridge -> symbolBridge

  **What to do**:
  - Refactor `customSymbolBridge.ts` into `symbolBridge.ts` that handles ALL symbols (builtin + custom):
    1. Rename file: `customSymbolBridge.ts` -> `symbolBridge.ts`
    2. Add `registerBuiltinSymbols()` function that loads all builtin SymbolDefinition files at startup
    3. Update `buildPorts()` to preserve v2 fields: pin number, electricalType, functionalRole, sortOrder
    4. Update PIN_TYPE_TO_PORT_TYPE mapping to handle all 12 electrical types (no more lossy power->input)
    5. Export unified API: `getSymbolContext(symbolId)`, `getSymbolSize(symbolId)`, `getSymbolPorts(symbolId)` — works for ANY symbol
  - Update `BlockRenderer.ts`:
    1. `resolveSymbolContext()` should try unified bridge FIRST, fall back to SymbolLibrary only if not found
    2. Eventually ALL types should resolve through the unified bridge
  - Update `index.ts` re-exports in symbols/ directory
  - Keep SymbolLibrary.ts functional as fallback during transition (do NOT delete yet)

  **Must NOT do**:
  - Do NOT delete SymbolLibrary.ts (that is Task 10)
  - Do NOT change the Toolbox or drag-and-drop system
  - Do NOT modify the canvas interaction machine

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 6)
  - **Blocks**: Task 8
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `src/components/OneCanvas/renderers/symbols/customSymbolBridge.ts` — Current bridge code (222 lines). This becomes the foundation. buildPorts() at line 151, buildContext() at line 40.
  - `src/components/OneCanvas/renderers/BlockRenderer.ts` — resolveSymbolContext() and resolveSymbolSize() methods that currently branch on block.type === custom_symbol.
  - `src/components/OneCanvas/renderers/symbols/SymbolLibrary.ts` — getSymbolContext() function that handles hardcoded types. Keep as fallback.
  - `src/components/OneCanvas/renderers/symbols/index.ts` — Re-exports. Update to include symbolBridge.

  **Acceptance Criteria**:
  - [ ] `pnpm run build` passes
  - [ ] `pnpm run test` all pass
  - [ ] ALL builtin block types render through unified bridge (verify with logging or test)
  - [ ] Custom symbols still render correctly
  - [ ] Port data includes number, electricalType, functionalRole fields

  **QA Scenarios:**

  ```
  Scenario: All block types render through unified bridge
    Tool: Bash
    Steps:
      1. Run `pnpm run build` — exit code 0
      2. Run `pnpm run test` — all pass
      3. Search for getCustomSymbolContext usage — should be reduced or wrapped by unified getSymbolContext
    Expected Result: Build passes, tests pass, unified bridge is primary
    Evidence: .sisyphus/evidence/task-7-unified-bridge.txt

  Scenario: Port v2 fields preserved in conversion
    Tool: Bash
    Steps:
      1. Inspect symbolBridge.ts buildPorts() output
      2. Verify Port objects include number, electricalType, functionalRole
      3. Verify power_in/power_out are NOT lossy-mapped to input anymore
    Expected Result: Full v2 port data in output
    Evidence: .sisyphus/evidence/task-7-port-fields.txt
  ```

  **Commit**: YES
  - Message: `refactor(renderer): unify symbol bridge for all block types`
  - Files: `src/components/OneCanvas/renderers/symbols/*`, `src/components/OneCanvas/renderers/BlockRenderer.ts`
  - Pre-commit: `pnpm run build && pnpm run test`

- [ ] 8. Replace BlockType Union with ComponentInstance (HIGHEST RISK)

  **What to do**:
  - This is the highest-risk phase. Execute in 3 sub-phases with a commit after each:
  
  **Sub-phase 8a — Types + Stores layer**:
  - Create `ComponentInstance` interface in circuit.ts that replaces the 27 specialized Block interfaces:
    ```
    interface ComponentInstance {
      id: string;
      symbolId: string;           // references SymbolDefinition.id
      type: string;               // backward compat — maps to symbolId via registry
      position: Position;
      rotation: number;
      instanceProperties: Record<string, unknown>;  // replaces type-specific props
      selectedUnit?: number;       // for multi-unit symbols
      // ... other common fields from BaseBlock
    }
    ```
  - Update stores (canvasStore, useSchematicCanvasDocument, useCanvasDocument) to accept ComponentInstance
  - Keep Block union type as an alias for backward compat during transition

  **Sub-phase 8b — Renderers layer**:
  - Update BlockRenderer.ts to resolve ALL types via symbolBridge (remove hardcoded type branching)
  - Update SimulationRenderer._resolveTint() to use symbol metadata (category, properties) instead of type string matching. Create a tint mapping: `{ category: 'relay' -> tint: 0x3399FF, category: 'motor' -> tint: 0x33CC33, ... }`
  - Update PortRenderer, GhostPreviewRenderer, SimulationOverlay for ComponentInstance
  - Tag commit before this sub-phase as safe rollback point

  **Sub-phase 8c — UI + Serialization layer**:
  - Update serialization.ts:
    - Add `migrateBlockToComponentInstance()` function for existing .yaml files
    - Update `isValidBlockType()` to accept both old type strings AND new symbolId references
    - Update `getDefaultPorts()` to use symbolBridge instead of hardcoded switch
    - Ensure round-trip: old format loads -> migrates in memory -> saves in new format
  - Update InteractionController, useDragDrop, useCanvasKeyboardShortcuts for ComponentInstance
  - Update canvasCommands.tsx, BlockDragPreview.tsx, OneCanvasPanel.tsx
  - Handle v1 custom symbol format upgrade: symbols created by users in v1 must auto-upgrade

  **Must NOT do**:
  - Do NOT remove LEGACY_BLOCK_TYPE_MAP — it is needed for file migration
  - Do NOT change LadderEditor
  - Do NOT touch undo/redo internals
  - Do NOT change Rust simulation engine types
  - Do NOT refactor adjacent code

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (solo — highest risk, full focus)
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Task 7

  **References**:

  **Pattern References**:
  - `src/types/circuit.ts` — All 27 specialized Block interfaces (PowerSourceBlock, RelayCoilBlock, etc.) and the Block union type. These get replaced by ComponentInstance.
  - `src/components/OneCanvas/renderers/BlockRenderer.ts` — resolveSymbolContext(), resolveSymbolSize() with type branching.
  - `src/components/OneCanvas/renderers/SimulationRenderer.ts:202-238` — _resolveTint() with 15 type string matches. Must convert to category-based mapping.
  - `src/components/OneCanvas/serialization.ts` — isValidBlockType(), getDefaultPorts(), save/load logic. CRITICAL for file compat.

  **API/Type References**:
  - `src/stores/canvasStore.ts` — Block state shape. Must accept ComponentInstance.
  - `src/components/OneCanvas/utils/connectionValidator.ts` — validates connections using block types. Must update.
  - `src/components/OneCanvas/utils/bomGenerator.ts` — generates BOM from block types. Must update.
  - `src/components/OneCanvas/utils/crossReference.ts` — cross-references using block types. Must update.
  - `src/components/OneCanvas/utils/wireNumbering.ts` — wire numbering logic. Must update if type-dependent.

  **Acceptance Criteria**:
  - [ ] `pnpm run build` passes after each sub-phase (8a, 8b, 8c)
  - [ ] `pnpm run test` passes after each sub-phase
  - [ ] Existing .yaml project files load correctly via migration function
  - [ ] Simulation tinting works for all 15 block types
  - [ ] No type: any or ts-ignore added (verify with grep)

  **QA Scenarios:**

  ```
  Scenario: Existing YAML files load correctly
    Tool: Bash
    Steps:
      1. Find existing .yaml test fixtures or example projects
      2. Load them via serialization.ts (write a quick test or use existing)
      3. Verify all blocks load with correct symbolId and instanceProperties
      4. Save and reload — verify round-trip integrity
    Expected Result: All files load, migrate, and round-trip correctly
    Evidence: .sisyphus/evidence/task-8-yaml-compat.txt

  Scenario: Simulation tinting preserved
    Tool: Bash
    Steps:
      1. Run `pnpm run test` — simulation-related tests pass
      2. Verify SimulationRenderer uses category-based tint mapping
      3. Grep for hardcoded type strings in SimulationRenderer — should be minimal/zero
    Expected Result: Tinting works identically for all 15 block types
    Evidence: .sisyphus/evidence/task-8-sim-tinting.txt

  Scenario: No type safety regressions
    Tool: Bash
    Steps:
      1. Run `grep -rn 'as any' src/ --include='*.ts' | wc -l` — count before and after
      2. Run `grep -rn 'ts-ignore' src/ --include='*.ts' | wc -l` — count before and after
      3. Counts should not increase
    Expected Result: No new type escape hatches
    Evidence: .sisyphus/evidence/task-8-type-safety.txt
  ```

  **Commit**: YES (3 commits for sub-phases)
  - Message 8a: `refactor(types): introduce ComponentInstance type`
  - Message 8b: `refactor(renderer): migrate renderers to ComponentInstance`
  - Message 8c: `refactor(ui): migrate UI/interaction to ComponentInstance`
  - Pre-commit: `pnpm run build && pnpm run test` (each sub-phase)

- [ ] 9. Update Toolbox/Library UI to Dynamic Loading

  **What to do**:
  - Update `Toolbox.tsx` to read categories and items from SymbolDefinition registry instead of hardcoded SYMBOL_CATEGORIES:
    1. Import symbol registry from symbolBridge
    2. Group symbols by SymbolDefinition.category
    3. Generate toolbox items dynamically
    4. Keep the SAME visual layout and categories — this is a data source change only
  - Update `symbolThumbnails.ts`:
    1. Generate thumbnails from SymbolDefinition.graphics instead of hardcoded CANONICAL_SYMBOL_TYPES
    2. Use symbolBridge to get GraphicsContext for thumbnail rendering
  - Update `SymbolRenderer.tsx` to use unified bridge for rendering
  - Update `BlockDragPreview.tsx` to work with ComponentInstance type

  **Must NOT do**:
  - Do NOT redesign the Toolbox layout or add new UI features
  - Do NOT add search, filtering, or custom symbol browser
  - Do NOT change category names or ordering (preserve existing UX)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 10)
  - **Blocks**: Task 10
  - **Blocked By**: Task 8

  **References**:

  **Pattern References**:
  - `src/components/OneCanvas/components/Toolbox.tsx` — Current toolbox using SYMBOL_CATEGORIES. Preserve visual layout.
  - `src/components/OneCanvas/utils/symbolThumbnails.ts` — CANONICAL_SYMBOL_TYPES[], SYMBOL_CATEGORIES[], SYMBOL_LABELS{}. Replace data source.
  - `src/components/OneCanvas/components/SymbolRenderer.tsx` — Symbol thumbnail rendering.

  **Acceptance Criteria**:
  - [ ] `pnpm run build` passes
  - [ ] `pnpm run test` all pass
  - [ ] Toolbox shows all symbols organized by category
  - [ ] Drag-and-drop from toolbox creates correct ComponentInstance

  **QA Scenarios:**

  ```
  Scenario: Toolbox renders all symbols
    Tool: Playwright (playwright skill)
    Steps:
      1. Launch app with `pnpm tauri dev`
      2. Open a project/create new canvas
      3. Verify toolbox panel shows symbols grouped by category
      4. Count total symbols — should match number of builtin SymbolDefinition files
      5. Screenshot the toolbox
    Expected Result: All symbols visible, correct categories
    Evidence: .sisyphus/evidence/task-9-toolbox-render.png

  Scenario: Drag-and-drop places blocks correctly
    Tool: Playwright (playwright skill)
    Steps:
      1. Drag a symbol from toolbox onto canvas
      2. Verify block appears at drop position
      3. Verify block has correct ports (check port count and positions)
      4. Try multiple symbol types
    Expected Result: Blocks place correctly with proper ports
    Evidence: .sisyphus/evidence/task-9-drag-drop.png
  ```

  **Commit**: YES
  - Message: `refactor(toolbox): switch to dynamic symbol loading`
  - Files: `Toolbox.tsx`, `symbolThumbnails.ts`, `SymbolRenderer.tsx`, `BlockDragPreview.tsx`
  - Pre-commit: `pnpm run build && pnpm run test`

- [ ] 10. Cleanup Old Types and Dead Code

  **What to do**:
  - Remove dead code that is no longer the primary path:
    - SymbolLibrary.ts hardcoded drawing code (if all types now render via symbolBridge)
    - Unused specialized Block interfaces (PowerSourceBlock, RelayCoilBlock, etc.) IF fully replaced
    - Redundant getDefaultPorts() in serialization.ts (now using symbolBridge)
    - Old PinElectricalType (5-value) IF fully replaced by 12-value version
    - Old Port interface IF fully replaced by PortV2
    - CANONICAL_SYMBOL_TYPES and SYMBOL_LABELS in symbolThumbnails.ts IF replaced by dynamic loading
  - Update SymbolEditor.tsx to output v2 SymbolPin format (electricalType + functionalRole + sortOrder)
  - Keep LEGACY_BLOCK_TYPE_MAP for file compatibility
  - Run comprehensive test suite to verify no regressions

  **Must NOT do**:
  - Do NOT remove LEGACY_BLOCK_TYPE_MAP
  - Do NOT remove any code that is still referenced (verify with lsp_find_references before deleting)
  - Do NOT redesign SymbolEditor UI — only update its output format

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 9)
  - **Blocks**: None
  - **Blocked By**: Tasks 8, 9

  **References**:

  **Pattern References**:
  - `src/components/OneCanvas/renderers/symbols/SymbolLibrary.ts` — Candidate for removal. Verify zero references via lsp_find_references first.
  - `src/types/circuit.ts` — Old Block union, specialized interfaces. Verify each is unreferenced.
  - `src/components/SymbolEditor/SymbolEditor.tsx` — Symbol editor that creates custom symbols. Update output format.

  **Acceptance Criteria**:
  - [ ] `pnpm run build` passes with zero errors
  - [ ] `pnpm run test` all pass
  - [ ] `pnpm run test:e2e` passes
  - [ ] No dead code warnings
  - [ ] SymbolEditor creates v2 format symbols
  - [ ] LEGACY_BLOCK_TYPE_MAP still present and functional

  **QA Scenarios:**

  ```
  Scenario: No dead code remains
    Tool: Bash
    Steps:
      1. Run `pnpm run build` — zero errors
      2. Search for removed type names — should have zero references
      3. Run `pnpm run test` — all pass
      4. Run `pnpm run test:e2e` — all pass
    Expected Result: Clean build, all tests pass, no dead references
    Evidence: .sisyphus/evidence/task-10-cleanup.txt

  Scenario: SymbolEditor outputs v2 format
    Tool: Bash
    Steps:
      1. Check SymbolEditor code for v2 field output (electricalType, functionalRole, sortOrder)
      2. Verify saved symbols include v2 fields
    Expected Result: Editor outputs v2 SymbolDefinition format
    Evidence: .sisyphus/evidence/task-10-editor-v2.txt
  ```

  **Commit**: YES
  - Message: `refactor(cleanup): remove legacy type definitions and dead code`
  - Files: Multiple (SymbolLibrary.ts, circuit.ts, symbolThumbnails.ts, SymbolEditor.tsx, etc.)
  - Pre-commit: `pnpm run build && pnpm run test && pnpm run test:e2e`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection -> fix -> re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm run build` + `pnpm run test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1**: `feat(types): add SymbolPin v2 type definitions with 12 electrical types` — src/types/symbol.ts
- **2**: `feat(backend): mirror v2 symbol types in Rust` — src-tauri/src/symbols/types.rs
- **3**: `chore(schema): update symbol.schema.json for v2 fields` — src/types/symbol.schema.json
- **4**: `refactor(types): unify dual BlockType definitions into circuit.ts` — src/types/circuit.ts, src/components/OneCanvas/types.ts, ~31 import updates
- **5**: `feat(symbols): upgrade 22 builtin symbols to v2 schema` — src/assets/builtin-symbols/*
- **6**: `feat(symbols): create missing builtin symbols for canonical types` — src/assets/builtin-symbols/*
- **7**: `refactor(renderer): unify symbol bridge for all block types` — src/components/OneCanvas/renderers/symbols/*
- **8a**: `refactor(types): introduce ComponentInstance type` — types + stores layer
- **8b**: `refactor(renderer): migrate renderers to ComponentInstance` — renderers layer
- **8c**: `refactor(ui): migrate UI/interaction to ComponentInstance` — UI + serialization layer
- **9**: `refactor(toolbox): switch to dynamic symbol loading` — Toolbox.tsx, symbolThumbnails.ts
- **10**: `refactor(cleanup): remove legacy type definitions and dead code` — multiple files

---

## Success Criteria

### Verification Commands
```bash
pnpm run build         # Expected: zero TS errors
pnpm run test          # Expected: all tests pass
pnpm run test:e2e      # Expected: E2E smoke test passes
```

### Final Checklist
- [ ] All "Must Have" present — 12 pin types, dual typing, SpiceModelRef, inheritance, file compat
- [ ] All "Must NOT Have" absent — no IEC rendering, no SPICE engine, no Toolbox redesign
- [ ] All tests pass — unit, integration, E2E
- [ ] Single BlockType definition (circuit.ts only)
- [ ] All symbols render through unified symbolBridge
- [ ] Existing .yaml files load and save correctly
- [ ] Simulation tinting preserved for all 15 block types
