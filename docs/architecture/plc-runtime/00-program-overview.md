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
3. No protocol layer is allowed to bypass canonical memory mutation paths.
4. No new vendor support may be implemented by copying LS-specific rules into global runtime code.
5. Documentation is part of the implementation surface. If code changes a contract, the matching architecture document must be updated in the same change.
