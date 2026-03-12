# PLC Memory Model and OPC UA Readiness Audit

Date: 2026-03-12
Scope: Rust backend only (`src-tauri/src`)

## Bottom Line

- Vendor-specific PLC memory structure differences are **not yet structurally reflected** in the backend.
- The current simulator memory model is effectively **LS/XG5000-centered**.
- There is a manufacturer field in project config, but it does **not currently drive** memory layout, parser behavior, or simulation memory shape.
- OPC UA can be added on top of the current simulator, but the codebase is **not yet architecturally ready for a clean commercial-grade OPC UA layer** without first introducing a vendor-neutral memory/profile abstraction.

## Evidence: Current Memory Model Is LS-Centric

### 1. Parser types are explicitly LS-oriented

- `parser/types.rs` literally describes the address system as LS PLC device types.
- Supported device families are:
  - bit: `P`, `M`, `K`, `F`, `T`, `C`
  - word: `D`, `R`, `Z`, `N`
- This is not a generic IEC memory model and not a Mitsubishi memory model.

### 2. Simulation memory is hardcoded to one device set

- `sim/types.rs` defines fixed enums `SimBitDeviceType` and `SimWordDeviceType`.
- `sim/memory.rs` allocates fixed arrays/bitmaps for `P/M/K/F/T/C` and `D/R/Z/N/TD/CD`.
- Sizes are compile-time constants such as:
  - `P=2048`
  - `M=8192`
  - `D=10000`
  - `Z=16`
- That is a concrete memory shape, not a pluggable vendor profile.

### 3. Modbus mapping assumes the same LS-style device layout

- `parser/modbus_mapper.rs` says it converts LS PLC device addresses.
- Default mapping rules are fixed against the same LS-oriented offsets.
- `sim/modserver_sync.rs` also hardcodes offsets and sync counts that match that specific memory scheme.

### 4. Project config stores manufacturer, but does not control runtime memory architecture

- `project/config.rs` contains `PlcManufacturer` with `LS`, `Mitsubishi`, `Siemens`.
- But this currently behaves as metadata/config, not as a runtime profile selector for:
  - parser grammar
  - device enum set
  - memory allocation
  - readonly rules
  - Modbus mapping rules
  - simulation semantics

## Roast

Right now the backend is wearing a fake mustache and pretending to be multi-vendor.

There is a manufacturer enum, but the actual runtime heart of the simulator still speaks one dialect. That means if you claim "Mitsubishi" in project settings today, you are mostly changing a label, not the underlying memory semantics. For structural stability, that is exactly backwards: the memory model should be the source of truth, and vendor name should select it.

## What This Means for LS vs Mitsubishi vs IEC

### LS vs Mitsubishi MELSEC

- Mitsubishi adds device families and semantics that do not fit neatly into the current fixed enums.
- Even where letters overlap conceptually, ranges, retention rules, special relays, file/link register behavior, and address conventions differ.
- Because the code hardcodes device enums and sizes, adding MELSEC cleanly would currently require touching core parser, memory, sync, and address-mapping code in multiple places.

### IEC-style PLC model

- IEC-oriented systems usually want a stronger symbolic/tag model and typed variables, not just raw device-letter memory.
- Current backend is address-first, not symbol-first.
- That is workable for LS-style ladder memory, but weak for an OPC UA-facing IEC-style information model.

## OPC UA Readiness

## What is already good

### 1. Centralized runtime state exists

- `OneSimEngine` owns a central `DeviceMemory`.
- `SimState` already supports shared runtime state and background task orchestration.
- This is a good place to hang an additional protocol server.

### 2. Thread-safe memory API exists

- `DeviceMemory` provides synchronized read/write APIs.
- That is enough to expose values through an OPC UA server.

### 3. Protocol integration precedent already exists

- Modbus is already integrated through a dedicated sync layer.
- Architecturally, this shows the simulator can host external protocol adapters.

## What is missing for a strong OPC UA design

### 1. No vendor-neutral memory profile layer

- There is no `MemoryProfile`, `AddressSpaceProfile`, or device-schema abstraction.
- OPC UA would need a stable canonical model underneath, or you end up baking LS assumptions into UA NodeIds and browse trees.

### 2. No symbolic/tag information model

- OPC UA works best when the server exposes semantic nodes, not only raw addresses.
- The backend currently centers on raw device addresses such as `M100`, `D200`, `TD5`.
- There is no first-class tag catalog or canonical typed variable layer.

### 3. No generic subscription/change-notification layer for simulator memory

- `ModbusMemory` has event emission.
- `DeviceMemory` does not expose an equivalent general notification mechanism.
- For OPC UA DataChange subscriptions, this means you would likely fall back to polling unless you first add memory observers/events.

### 4. No protocol-host abstraction

- Modbus integration is concrete and protocol-specific.
- There is no trait or boundary like `ExternalRuntimeAdapter`, `ProtocolServer`, or `AddressSpaceBridge`.
- Adding OPC UA now is possible, but it would likely be another one-off integration unless the abstraction is introduced first.

## Expertise Recommendation

If we want structural stability before connecting more interfaces, I would do this first:

1. Introduce a canonical internal memory model:
   - separate "simulation core memory" from vendor presentation
   - define typed domains like inputs, outputs, internals, timers, counters, data registers, retentive registers, system registers

2. Add a vendor profile layer:
   - `LsProfile`
   - `MelsecProfile`
   - later `IecProfile`
   - each profile defines device families, ranges, readonly rules, retention, parser grammar, and external mapping rules

3. Move address parsing behind the profile:
   - no more global hardcoded `P/M/K/F/T/C/D/R/Z/N` parsing
   - parser should ask the active profile how to parse and validate addresses

4. Move Modbus mapping behind the profile:
   - current LS mapping can become `LsProfile::modbus_mapping()`
   - Mitsubishi or IEC-style variants can provide their own mapping policies

5. Introduce a memory event bus for `DeviceMemory`:
   - required for scalable OPC UA subscriptions and clean protocol adapters

6. Add an OPC UA adapter on top of the canonical model, not directly on LS-style addresses:
   - raw memory nodes can still be exposed
   - but also expose semantic/tag nodes and typed values

## Practical Verdict

- Is vendor-differentiated memory structure already reflected? **No, not in a structurally meaningful way.**
- Is the simulator ready to safely serve as the long-term base for Modbus + OPC UA + multi-vendor PLC support? **Not yet.**
- Is the current code salvageable for that direction? **Yes.**
- What must happen first? **Vendor-neutral memory/profile abstraction and a memory event/subscription layer.**
