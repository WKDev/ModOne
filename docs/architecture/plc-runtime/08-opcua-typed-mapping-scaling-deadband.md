# OPC UA Typed Mapping, Scaling, and Deadband

## Purpose

This document describes how a tag's `OpcUaMappingConfig` drives the **live** OPC UA
server: how a PLC register span is exposed as a typed node (Int32/Float/Double/…),
how optional raw↔engineering **scaling** and publish **deadband** work, and how the
configuration is edited and persisted.

It extends [05 — Tag Registry and OPC UA Model](./05-tag-registry-and-opcua-model.md)
and [06 — OPC UA v1 Security](./06-opcua-v1-security.md).

## Background — the gap this closed

The `opcua-codec` crate had a complete, unit-tested mapping layer (12 UA data types,
word count, byte order, multi-register decomposition). But the **running server
ignored it**: every node was created and published as `Boolean` or `UInt16` based
only on `is_bool`. The rich config was used solely for NodeSet2/CSV export and
validation — so a tag mapped to `Float` exported as `Float` but appeared as
`UInt16` on the live server.

The work here wires the mapping config into the live address space and adds two
features on top of it: scaling and deadband.

## Data flow

```
TagRegistry + OpcUaMappingStore
        │  build_address_space_spec()
        ▼
AddressSpaceSpec.nodes[ OpcUaNodeSpec { canonical_address, mapping, … } ]
        │  OpcUaServer::start() stores spec
        ▼
Live OPC UA address space
  • node DataType  = mapping.effective_opcua_data_type()
  • read/publish   = node_values::read_node_mapped()  (raw span → typed → Variant)
  • client write   = node_values::variant_to_mapped() + mapped_to_register_writes()
```

`OpcUaNodeSpec` (in `opcua-codec`) carries the full `OpcUaMappingConfig`. The
builder (`src-tauri/src/opcua/address_space.rs`) fills it from the mapping store,
or a default derived from the canonical address for raw/alias nodes.

All conversion logic lives in `src-tauri/src/opcua/node_values.rs` (extracted to
keep `server.rs` from growing). Pure functions there are unit-testable without the
`opcua` crate; only `Variant`/`DataTypeId` bridges are feature-gated.

## Typed publish

The live publish path (`OpcUaServer::publish_nodes`) iterates the stored
`spec.nodes` rather than the per-address publish map, so multi-register types can
read their **full span**:

- **Dirty trigger** — `node_dirty()` republishes a node when any register in its
  span `[base, base + word_count)` intersects a dirty window (window `end_index`
  is inclusive).
- **Read** — `read_node_mapped()` reads `word_count` consecutive canonical
  registers and decodes them via the codec (`read_registers_to_mapped`, byte order
  applied). Boolean nodes read a single canonical value.
- **Write** — the per-node value setter decodes the client `Variant` to the node's
  type (`variant_to_mapped`, with range checks) and decomposes it back into
  consecutive register writes (`mapped_to_register_writes`).

## Scaling (raw ↔ engineering)

Defined in `opcua-codec/src/mapping/scaling.rs` (`ScalingConfig`, `ScalingKind`).

- **Kinds** — `None` (identity), `Linear`, `SquareRoot` (for differential-pressure
  flow, etc.). Fields: `rawLow/rawHigh`, `engLow/engHigh`, `clamp`.
- **Exposure** — when scaling is active on a numeric type,
  `effective_opcua_data_type()` returns `Double`. The node presents the
  engineering value; the raw integer type is internal.
- **Read** — raw span → numeric `f64` → `raw_to_eng` → `Double`.
- **Write** — client writes the engineering `Double` → `eng_to_raw` → rounded and
  range-saturated back to the underlying integer type → registers.
- **Guards** — zero-width ranges yield `t = 0` (no divide-by-zero); `clamp` bounds
  out-of-range inputs; `SquareRoot` clamps negatives before `sqrt`.

Scaling is inert on Boolean/String (non-numeric) types.

## Deadband (publish suppression)

Defined in `opcua-codec/src/mapping/deadband.rs` (`DeadbandConfig`, `DeadbandKind`).
This is a **server-side** default deadband (Kepware-style), independent of the
OPC UA client-side `DataChangeFilter`.

- **Kinds** — `None`, `Absolute` (threshold in exposed units), `Percent`
  (threshold = `value%` of the scaling engineering span).
- **State** — `OpcUaServer` keeps a per-node `last_published: HashMap<id, f64>`.
- **Behavior** — on an **incremental** (dirty) publish, a numeric node is skipped
  when `|new − last| < threshold`; the baseline is always updated. A **full sync**
  re-baselines without suppressing. The map is cleared on server stop.
- **Percent reference** — `deadband_reference_span()` returns the engineering span
  only when scaling is active; without it, `Percent` does not suppress.

Deadband is inert on Boolean/String types.

## Configuration, persistence, and "apply"

- **Store** — `OpcUaMappingStore` (managed `MappingStoreState`) maps `tag_id →
  OpcUaMappingConfig`. It is the runtime source the address space is built from.
- **Commands** — `get_tag_opcua_mapping(tagId)` (stored, or a default derived from
  the tag's canonical address) and `set_tag_opcua_mapping(tagId, config)`
  (validates, then stores). Registered in `lib.rs` / `commands/mod.rs`.
- **Apply** — the address space (node types, scaling) is built at server start, so
  **mapping changes take effect on the next OPC UA server (re)start.** The editor
  states this.
- **Project round-trip** — `scaling` and `deadband` use `#[serde(default,
  skip_serializing_if = "…is_disabled")]`, so project save/load round-trips them
  automatically and stays backward-compatible with configs that predate them.

## Frontend

- `src/types/opcuaMapping.ts` — TypeScript mirror of `OpcUaMappingConfig`
  (camelCase), matching the serde representation.
- `src/services/tagService.ts` — `getTagOpcUaMapping` / `setTagOpcUaMapping`.
- `OpcUaMappingEditor.tsx` — edits data type, word count, byte order, access level,
  scaling, and deadband; loads the config on mount and saves via the command.
- `OpcUaMappingSection.tsx` — renders read-only node info (Node ID, browse path,
  server status) plus the editor (previously it only showed a data type derived
  from the address).

## Import / Export

- **JSON export** (`tag_import_export.rs::build_json_export_leaf`) includes
  `opcuaScaling` / `opcuaDeadband` (serde representation) when active, alongside the
  existing `opcuaDataType` / `opcuaWordCount` / `opcuaByteOrder` / `opcuaAccessLevel`.
- **Import limitation (follow-up)** — JSON/CSV import does not parse OPC UA mapping
  fields at all (a pre-existing gap, not introduced here). Full mapping import,
  including scaling/deadband, is deferred. Configure via the UI or project file for
  now.

## Testing & build

- `opcua-codec` unit tests (scaling, deadband, mapping) — run with
  `cargo test -p opcua-codec` (no OpenSSL needed).
- `src-tauri/tests/node_values_pure_test.rs` — multi-register round-trip, scaling
  round-trip, dirty-span logic. Run with `--no-default-features` (the `opcua`
  feature, hence OpenSSL, is off): `cargo test --no-default-features --test
  node_values_pure_test`.
- `src-tauri/tests/opcua_integration.rs` / `opcua_session_smoke.rs` — end-to-end
  against a real server; require the `opcua-server` feature.
- **Native build note** — the `opcua-server` feature pulls `openssl-sys`, which
  vendors OpenSSL from source. Building needs Strawberry Perl ahead of Git Bash's
  Perl on `PATH` (`C:\Strawberry\perl\bin`); otherwise the build fails on missing
  Perl modules. `[lib] test = false`, so put unit-style tests under `tests/`.

## Key files

| Area | File |
|---|---|
| Scaling (pure) | `crates/opcua-codec/src/mapping/scaling.rs` |
| Deadband (pure) | `crates/opcua-codec/src/mapping/deadband.rs` |
| Mapping config | `crates/opcua-codec/src/mapping/config.rs` |
| Node spec | `crates/opcua-codec/src/address_space_spec.rs` |
| Conversion / publish helpers | `src-tauri/src/opcua/node_values.rs` |
| Live server (create/getter/setter/publish) | `src-tauri/src/opcua/server.rs` |
| Spec builder | `src-tauri/src/opcua/address_space.rs` |
| Get/set commands | `src-tauri/src/commands/tags.rs` |
| Editor UI | `src/components/panels/content/tagBrowser/OpcUaMappingEditor.tsx` |
| TS types | `src/types/opcuaMapping.ts` |

Working notes from the implementation: `docs/opcua-typed-scaling/{checklist,context-notes}.md`.

## Follow-ups

- Import-side parsing of OPC UA mapping fields (including scaling/deadband) for
  JSON and CSV.
- Optional: bulk multi-select mapping edit; per-node deadband applied to the
  client subscription path as well as the server publish path.
