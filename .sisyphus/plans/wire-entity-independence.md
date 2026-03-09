# Wire Entity Independence — From Port-Dependent to Entity-Based Wire Model

## Context

Transform ModOne's wire system from a **port-dependent connection model** (wires can only exist between ports) to an **independent entity model** (like KiCad's SCH_LINE). Wires should be drawable freely on the canvas with grid snap, and net assignment should happen via coordinate-based connectivity rather than explicit port references.

## Architectural Decisions

1. **FloatingEndpoint joins WireEndpoint union** — it already exists, just needs inclusion
2. **Grid snap is mandatory for ALL wire points** — GRID_SNAP_PX = 20
3. **Net assignment is coordinate-based** — not reference-based
4. **Backward compatible serialization** — old files load as-is
5. **Dangling wires = ERC warning** (not error) — normal during editing
6. **Multi-click wire drawing** — each click adds a bend point, double-click or port-snap finishes
7. **Whole wire = one undo step** — collect all points, single `addWire()` call at completion
8. **Wire-to-wire auto-junction deferred** — Phase 1 is endpoint-to-endpoint coordinate matching only

## Constraints

- TypeScript strict mode (no `as any`, no `@ts-ignore`)
- Must not break existing saved schematics (backward compat)
- Must handle 1000+ wires at 60fps
- Must not break LadderEditor wire system (separate subsystem — verified ZERO coupling)
- Grid size = 20px (GRID_SNAP_PX constant)
- Pixi.js renderer (WireRenderer uses Graphics.lineTo)

## Task Dependency Graph

```
Wave 0 (Prerequisite — MUST do first):
└── T0: Unify WireEndpoint type systems (circuit.ts vs OneCanvas/types.ts)

Wave 1 (After T0):
└── T1: Add FloatingEndpoint to WireEndpoint union in OneCanvas/types.ts

Wave 2 (After T1 — parallel):
├── T2: Utility updates (canvasHelpers, wireSimplifier, rubberBand)
├── T3: Wire path calculator (floating endpoint routing)
├── T9: Serialization (save/load floating wires)
└── T10: SpatialIndex (floating wire hit testing)

Wave 3 (After T2 — parallel):
├── T4: Store & facade (addWire accepts floating endpoints)
└── T6: ConnectivityGraph (NEW — coordinate-based net resolution)

Wave 4 (After T4, T6 — parallel):
├── T5: Interaction rewrite (free wire drawing + multi-click + grid snap)
├── T7: Net builder refactor (use ConnectivityGraph)
├── T8: ERC + validation (dangling wire warnings)
└── T11: Circuit graph (skip floating-only wires in simulation)

Wave 5 (After all above):
└── T12: Tests (update existing + add new)

Critical Path: T0 → T1 → T2 → T4 → T5
```

## Tasks

---

### T0. PREREQUISITE: Unify WireEndpoint Type Systems

> 🔴 **CRITICAL** — Metis analysis discovered TWO divergent WireEndpoint definitions

**Problem**: There are two separate type systems:
- `src/types/circuit.ts:384-389` — `WireEndpoint = PortEndpoint | JunctionEndpoint | FloatingEndpoint | LegacyPortEndpoint | LegacyJunctionEndpoint` (FloatingEndpoint **INCLUDED**)
- `src/components/OneCanvas/types.ts:649` — `WireEndpoint = PortEndpoint | JunctionEndpoint` (FloatingEndpoint **EXCLUDED**)

All OneCanvas subsystems import from `OneCanvas/types.ts`. The two `PortEndpoint` definitions also differ (circuit.ts has `type: 'port'` field, OneCanvas doesn't). Wire drawing creates legacy format `{ componentId, portId }` without `type` field.

**Changes**:
- Audit both type files and identify all divergences
- Decide on canonical source of truth (recommend: `OneCanvas/types.ts` as canonical, `circuit.ts` imports from it)
- Ensure consistent `isPortEndpoint`/`isJunctionEndpoint` type guards
- Document migration path for `LegacyPortEndpoint`/`LegacyJunctionEndpoint`

**Category**: `deep` | **Skills**: []
**Depends On**: None
**Acceptance**: Both files have consistent WireEndpoint definitions; `pnpm run build` passes

---

### T1. Type System — FloatingEndpoint Joins WireEndpoint Union

**Changes** in `src/components/OneCanvas/types.ts`:
- Line 649: `WireEndpoint = PortEndpoint | JunctionEndpoint | FloatingEndpoint`
- Line 661: `isFloatingEndpoint(ep: WireEndpoint)` (remove `| FloatingEndpoint` from param since it's now in the union)
- Add `netId?: string` to Wire interface (line 687) for cached connectivity

**Category**: `quick` | **Skills**: []
**Depends On**: T0
**Acceptance**: Union includes FloatingEndpoint; build compiles (expect exhaustiveness errors in downstream files — those are T2-T11)

---

### T2. Utility Updates — Handle FloatingEndpoint in Core Helpers

**Changes**:
- `canvasHelpers.ts:49` — `endpointKey()`: Add `floating:${ep.position.x}:${ep.position.y}` case
- `canvasHelpers.ts:57` — `isValidEndpoint()`: Floating endpoints always valid
- `wireSimplifier.ts:21` — `resolveEndpointPosition()`: Add `isFloatingEndpoint → clonePosition(endpoint.position)` branch
- `rubberBand.ts:31` — `endpointMoves()`: Floating endpoints return `false` (don't move with blocks)

**Category**: `quick` | **Skills**: []
**Depends On**: T1
**Acceptance**: No TS errors in these 3 files; `endpointKey` returns unique key for floating; `resolveEndpointPosition` returns position for floating

---

### T3. Wire Path Calculator — Floating Endpoint Routing

**Changes** in `wirePathCalculator.ts`:
- `calculateOrthogonalPath()`: When endpoint has no port direction, infer direction from geometry (dx/dy delta)
- `calculateWireBendPoints()`: Handle missing port direction for floating endpoints
- `getPortAbsolutePosition()` callers: null-safe for floating endpoints

**Category**: `unspecified-low` | **Skills**: []
**Depends On**: T1
**Acceptance**: Wire paths calculate without NaN/null for floating endpoints; port-to-port routing unchanged

---

### T4. Store & Facade — Accept Floating Endpoints in addWire

**Changes**:
- `canvasStore.ts:727` — `addWire()`: Check if either endpoint is floating → skip port-specific validation (`isValidConnection`) but keep duplicate/self-connection checks. Call `computeWireBendPoints()` with floating support.
- `canvasStore.ts` — `computeWireBendPoints()`: Handle floating (use position directly, infer direction)
- `canvasFacade.ts:91` — Signature already takes `WireEndpoint` (auto-accepts floating after T1)
- `useCanvasFacade.ts` — Verify no type narrowing blocks floating

**Category**: `unspecified-high` | **Skills**: []
**Depends On**: T1, T2, T3
**Acceptance**: `addWire()` accepts FloatingEndpoint without throwing; port validation still works; undo/redo works

---

### T5. Interaction Rewrite — Free Wire Drawing with Multi-Click Bend Points

**Changes** in `InteractionController.ts`:
- `_handleWireModePointerDown()` (line 777): Remove port-only guard → allow canvas click to start wire from grid-snapped FloatingEndpoint
- `_startWireDrawing()` (line 679): Accept Position (floating) in addition to HitTestResult (port)
- `_handleWireDrawingPointerDown()` (line 791): Click on empty = add bend point; click on port = complete; **double-click** = complete with FloatingEndpoint
- `_handleWireDrawingMove()` (line 696): Grid-snap all preview points; show orthogonal routing preview (not L-shape)
- `_handleWireDrawingUp()` (line 744): Support FloatingEndpoint completion; accumulate handles during multi-click; single `addWire()` call with all handles at completion
- Add ESC → complete with FloatingEndpoint at last position
- Wire mode stays active after completion (for continuous drawing)

**Category**: `deep` | **Skills**: [`frontend-ui-ux`]
**Depends On**: T1, T2, T4
**Acceptance**: Click canvas → wire starts; clicks add bends (grid-snapped); port-click completes; double-click/ESC creates floating end; whole wire = one undo step; wire mode persists after completion

---

### T6. ConnectivityGraph — New Coordinate-Based Net Resolution

**NEW FILE**: `src/components/OneCanvas/utils/connectivityGraph.ts`

**Design**:
- `ConnectivityGraph` class with:
  - `rebuild(wires, blocks, junctions)` — full rebuild
  - `onWireAdded(wire)` / `onWireRemoved(wireId)` — incremental updates
  - `getNetForPosition(position)` — net ID for a grid position
  - `getAllNets()` — all resolved nets
- Internal: `Map<gridKey, Set<entityId>>` for coordinate lookup
- Uses Union-Find (reuse from `netBuilder.ts`)
- Grid key: `${Math.round(x/20)*20}:${Math.round(y/20)*20}`
- Resolves both explicit (PortEndpoint) and implicit (FloatingEndpoint at same grid pos as port) connections
- Dirty-flag approach: mark dirty on mutation, rebuild on first access

**Category**: `deep` | **Skills**: []
**Depends On**: T1, T2
**Acceptance**: Same-position endpoints → same net; incremental == full rebuild; < 5ms for 1000 wires

---

### T7. Net Builder Refactor — Use ConnectivityGraph

**Changes** in `netBuilder.ts`:
- `buildNets()`: Create ConnectivityGraph, call rebuild, return net groupings
- Maintain backward-compatible API
- Add floating endpoint keys to nets when applicable

**Category**: `unspecified-low` | **Skills**: []
**Depends On**: T6
**Acceptance**: Existing net behavior preserved; floating endpoints at port positions join port's net

---

### T8. ERC & Validation — Dangling Wire Warnings

**Changes**:
- `electricalRuleCheck.ts`: Add `'dangling_wire'` to ErcCategory; add rule for floating endpoints not connected to any port → warning
- `connectionValidator.ts`: `isValidConnection()` → skip port-specific checks for FloatingEndpoint

**Category**: `unspecified-low` | **Skills**: []
**Depends On**: T1, T6, T7
**Acceptance**: Dangling float → ERC warning (not error); `isValidConnection` allows floating

---

### T9. Serialization — Save/Load Floating Endpoint Wires

**Changes** in `serialization.ts`:
- `wireToYaml()` (line 68): Handle FloatingEndpoint → `{ position: { x, y } }`
- `yamlToWire()`: Detect endpoint format: has `component` → PortEndpoint, has `position` → FloatingEndpoint
- `validateCircuitYaml()`: Allow either format
- Remove the silent `.filter(isPortEndpoint)` drop on line 1155

**Category**: `unspecified-low` | **Skills**: []
**Depends On**: T1, T2
**Acceptance**: Old YAML loads correctly; floating wires round-trip; no silent data loss

---

### T10. SpatialIndex — Floating Wire Hit Testing

**Changes** in `SpatialIndex.ts`:
- Verify wire bounding box handles floating endpoints
- Already imports `isFloatingEndpoint` — likely minimal changes

**Category**: `quick` | **Skills**: []
**Depends On**: T1, T2
**Acceptance**: Floating-endpoint wires are selectable via click

---

### T11. Circuit Graph — Skip Floating-Only Wires in Simulation

**Changes** in `circuitGraph.ts`:
- `buildCircuitGraph()`: If both endpoints floating → skip wire
- If one floating at port position → use ConnectivityGraph to resolve, treat as connected
- Add `isFloatingEndpoint` import

**Category**: `unspecified-low` | **Skills**: []
**Depends On**: T1, T6
**Acceptance**: Floating-only wires not in simulation; port-connected floaters included; existing simulation unchanged

---

### T12. Tests — Update Existing + Add New

**Changes**:
- Update `wireGeometryRoundtrip.test.ts`, `wirePreviewPath.test.ts`
- Add `connectivityGraph.test.ts` — coordinate net resolution
- Add `floatingWire.test.ts` — endpointKey, validation, serialization round-trip
- Add ERC dangling wire test
- Add backward-compat test (load existing v1 save)

**Category**: `unspecified-high` | **Skills**: []
**Depends On**: T1-T11
**Acceptance**: `pnpm run test` passes; `pnpm run build` succeeds

---

## Impact Analysis

- `WireEndpoint` — 20 files, 79 occurrences
- `isPortEndpoint/isJunctionEndpoint/isFloatingEndpoint` — 18 files, 86 occurrences
- `wire.from/wire.to` — 25 files, 133 occurrences
- LadderEditor coupling — **ZERO** (verified, completely isolated)

## Commit Strategy

Each task = one atomic commit:
```
T0:  refactor(types): unify WireEndpoint type systems
T1:  feat(types): add FloatingEndpoint to WireEndpoint union
T2:  feat(utils): handle FloatingEndpoint in core helpers
T3:  feat(wire-calc): floating endpoint routing support
T4:  feat(store): accept floating endpoints in addWire
T5:  feat(interaction): free wire drawing with multi-click bend points
T6:  feat(connectivity): add coordinate-based ConnectivityGraph
T7:  refactor(net-builder): use ConnectivityGraph for net resolution
T8:  feat(erc): add dangling wire warnings
T9:  feat(serialization): save/load floating endpoint wires
T10: feat(spatial): floating wire hit testing
T11: feat(circuit-graph): skip floating-only wires in simulation
T12: test: add floating wire tests
```

## Final Checklist

- [x] T0: Type systems unified
- [x] T1: FloatingEndpoint in WireEndpoint union
- [x] T2: Utilities handle floating endpoints
- [x] T3: Wire path calculator handles floating
- [x] T4: Store accepts floating endpoints
- [x] T5: Free wire drawing with multi-click + grid snap
- [x] T6: ConnectivityGraph coordinate-based nets
- [x] T7: Net builder uses ConnectivityGraph
- [x] T8: ERC dangling wire warnings
- [x] T9: Serialization save/load floating wires
- [x] T10: SpatialIndex floating hit testing
- [x] T11: Circuit graph skips floating-only
- [x] T12: Tests pass
- [x] `pnpm run build` passes (our code clean; pre-existing errors in unrelated files)
- [x] `pnpm run test` passes (1037 tests, 43 files, 0 failures)
- [x] Old schematic files load correctly (backward-compatible serialization verified)
