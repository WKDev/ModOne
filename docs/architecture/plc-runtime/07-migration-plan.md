# Migration Plan

## Wave 1. Canonical Runtime Types and Memory

Exit criteria:

- canonical runtime types compile
- canonical memory works in isolation
- canonical event bus exists and is deterministic

Rollback boundary:

- runtime remains unused by legacy simulator and protocols

## Wave 2. Vendor Profiles

Exit criteria:

- `LsProfile` fully preserves current behavior
- `MelsecFxQProfile` supports the frozen common-core scope
- profile selection is real runtime behavior
- `LS P` is treated as a model-sensitive compatibility family instead of one globally fixed canonical area

Rollback boundary:

- legacy parser/runtime code still exists and can be re-selected if migration is paused

## Wave 3. Parser and Runtime Migration

Exit criteria:

- runtime string address resolution is profile-driven
- simulator reads and writes are canonical-memory driven
- timer/counter exposure uses canonical areas

Rollback boundary:

- profile-driven resolution can coexist with legacy code behind a controlled transition seam

## Wave 4. Modbus Adapter Migration

Exit criteria:

- Modbus reads and writes use canonical memory
- external writes do not bypass runtime mutation rules
- LS compatibility is preserved
- segmented or topology-driven LS `P` projection has an explicit mapping representation instead of one family-wide assumption

Rollback boundary:

- protocol adapter boundary remains isolated from OPC UA work

## Wave 5. Tag Registry

Exit criteria:

- raw-backed tags work
- semantic tags work
- stable id rules are locked

Rollback boundary:

- tag registry may exist before OPC UA uses it

## Wave 6. OPC UA v1

Exit criteria:

- raw namespace browse/read/write/subscribe works
- tag namespace browse/read/write/subscribe works
- basic security target is met

Rollback boundary:

- OPC UA remains an adapter over canonical runtime and tag registry, not a core runtime dependency

## Final Compatibility and Hardening Gate

Exit criteria:

- LS regression suite passes
- MELSEC common-core suite passes
- Modbus compatibility suite passes
- OPC UA smoke and security suite passes
- docs match the implemented system

## No-Mixed-Concern Rule

Do not start OPC UA namespace or server behavior work until:

- canonical memory is stable
- vendor profiles are stable
- protocol mutation paths are unified

The project must not solve missing runtime architecture by smuggling vendor assumptions into OPC UA or Modbus code.

That rule applies directly to LS `P`: if a model requires fixed-window or slot-driven I/O projection, that logic belongs in the profile or topology layer, not in Modbus or OPC UA adapters.
