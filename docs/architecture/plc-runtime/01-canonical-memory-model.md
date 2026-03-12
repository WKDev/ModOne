# Canonical Memory Model

## Purpose

Canonical memory is the single internal runtime truth. Vendor letters, Modbus offsets, and OPC UA nodes are all views on top of it.

## Canonical Area Kinds

The canonical runtime defines the following area families:

- `InputBit`
- `OutputBit`
- `InternalBit`
- `RetentiveBit`
- `SpecialBit`
- `DataWord`
- `RetentiveWord`
- `IndexWord`
- `TimerDoneBit`
- `TimerValueWord`
- `CounterDoneBit`
- `CounterValueWord`
- `SystemBit`
- `SystemWord`

Each area kind has:

- a scalar value type: `Bool` or `U16`
- a default access mode
- a default retention mode
- a configured storage size

## CanonicalAddress

`CanonicalAddress` is the stable internal locator:

- `area`
- `index`
- optional `bit_index`

Rules:

- `bit_index` is only valid for word-backed canonical areas
- protocols and vendor profiles may expose aliases, but canonical addressing is the authoritative identity

## CanonicalValue

Canonical storage is intentionally narrow in v1:

- `Bool`
- `U16`

Any richer type system must be layered above this storage in profile metadata or tag metadata.

## Access Semantics

The canonical runtime supports three access classes:

- `ReadOnly`
- `ReadWrite`
- `InternalOnly`

Rules:

- `ReadOnly` cannot be changed through public protocol mutation paths
- `InternalOnly` may only be mutated by runtime-internal sources such as simulation, restoration, or migration code
- `ReadWrite` may be mutated through validated public mutation paths

## Retention Semantics

Each area is either:

- retained across volatile clears
- cleared on volatile reset

Canonical retention is defined at the area family level in v1. Per-address overrides are out of scope for the initial implementation.

## Reset and Clear Semantics

The canonical runtime supports:

- `clear_all`
  - zero every area
- `clear_volatile`
  - zero only non-retained areas
- `restore_snapshot`
  - overwrite storage with a snapshot payload without bypassing canonical invariants

## Snapshot Semantics

Snapshots must capture:

- all canonical areas
- the runtime profile id that produced them
- the capture timestamp

Snapshot restore must remain deterministic and must preserve canonical area identity.

## Timer and Counter Projection

Timer and counter state is modeled as canonical memory, not hidden runtime state:

- timer done state -> `TimerDoneBit`
- timer current value -> `TimerValueWord`
- counter done state -> `CounterDoneBit`
- counter current value -> `CounterValueWord`

Vendor profiles may expose aliases like `T`, `C`, `TD`, `CD`, but the simulator and protocol adapters must operate on canonical areas.

## Change Event Model

Every canonical mutation emits a `MemoryChange` event containing:

- canonical address
- old value
- new value
- write source
- timestamp
- optional batch id

Single writes emit a single change event.

## Batch Event Model

Batch writes emit:

- one `MemoryBatchChange` envelope
- ordered `MemoryChange` members inside the batch

Ordering must match commit order, not arbitrary hash-map iteration order.

## Write-Source Classification

The runtime classifies writes by source:

- `InternalRuntime`
- `Simulation`
- `ExternalProtocol`
- `SnapshotRestore`
- `Migration`
- `Test`

This metadata is mandatory so protocol subscriptions, auditing, and future conflict handling can reason about origin.

## Explicitly Forbidden

The following are not allowed:

- using vendor letters as the primary identity of internal runtime memory
- protocol-owned mutation paths that bypass canonical memory APIs
- protocol-specific event emission that does not originate from canonical memory changes
