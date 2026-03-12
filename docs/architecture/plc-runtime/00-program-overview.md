# PLC Runtime Program Overview

## Current Problem

The backend runtime is currently centered on one LS-style device model. That creates three structural problems:

1. Vendor selection exists in project settings, but it does not control runtime memory semantics.
2. Address parsing, simulator memory, and Modbus mapping are tightly coupled to LS-shaped device families.
3. OPC UA would be forced to expose LS-centric runtime assumptions unless a protocol-agnostic core is introduced first.

The result is a system that can extend tactically, but not safely scale to multi-vendor PLC support or protocol-rich integration.

## Target Architecture

The runtime will be split into four explicit layers:

1. `Canonical Runtime`
   - single internal source of truth for memory, timer/counter state, reset behavior, retention, and change events
   - no vendor letters are allowed as primary runtime identity
2. `Vendor Profiles`
   - parse, format, validate, and translate vendor-specific addresses
   - own device-family rules, range rules, readonly rules, and protocol mapping policy
3. `Tag Registry`
   - stable semantic layer above raw memory
   - supports raw-backed tags and higher-level semantic tags
4. `Protocol Adapters`
   - Modbus and OPC UA both read and write through canonical runtime services
   - no protocol may mutate vendor-specific storage directly

Canonical runtime design must follow explicit I/O semantics closer to `MELSEC` and future `IEC` models:

- `InputBit` and `OutputBit` are first-class, distinct runtime areas
- vendor families that collapse or blur physical I/O semantics must be projected through a compatibility layer
- `LS P` is therefore treated as a compatibility family, not the canonical shape of the runtime

## Frozen Scope

The initial program target is fixed as follows:

- `LS` full runtime compatibility
- `MELSEC FX/Q common core` as the first non-LS profile
- `OPC UA v1` with:
  - raw memory namespace
  - tag namespace
  - browse/read/write/subscribe
  - basic security

## Out of Scope

The following are explicitly deferred:

- full `IEC runtime profile` implementation
- full `MELSEC universe` beyond the frozen FX/Q common core
- OPC UA alarms, events, methods, and full information modeling
- enterprise PKI, role hierarchy, and advanced security orchestration

## Migration Principles

1. Existing LS projects must continue to open and run.
2. Existing LS address strings must remain valid through the `LsProfile`.
3. `LS` support is implemented as a compatibility projection over canonical memory, not as the shape of canonical memory itself.
4. `MELSEC`-style explicit `X/Y` separation is the preferred reference model for physical I/O projection in v1.
5. `XBC/XEC` fixed CPU I/O windows and `XGT/XGI` slot-based I/O assignment must be modeled explicitly in profile logic instead of flattened into one global `P` rule.
6. No protocol layer is allowed to bypass canonical memory mutation paths.
7. No new vendor support may be implemented by copying LS-specific rules into global runtime code.
8. Documentation is part of the implementation surface. If code changes a contract, the matching architecture document must be updated in the same change.
