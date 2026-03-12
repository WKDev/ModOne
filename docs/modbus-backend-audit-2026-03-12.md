# Modbus Backend Audit

Date: 2026-03-12
Scope: Rust backend only (`src-tauri/src`)

## Verdict

- Modbus server backend is implemented beyond stub level.
- Modbus TCP server exists with request parsing, memory read/write handling, connection tracking, and Tauri command exposure.
- Modbus RTU server exists with serial port open/close, CRC validation, frame parsing, memory read/write handling, and Tauri command exposure.
- Shared Modbus memory and simulation sync scaffolding are implemented.
- Overall backend completeness is roughly "usable prototype to early productization", not "commissioning-ready commercial backend".

## What Is Implemented

### 1. Tauri command surface is wired

- `src-tauri/src/lib.rs` registers start/stop/status/memory CSV/read/write commands for TCP and RTU.
- `src-tauri/src/commands/modbus.rs` manages shared `ModbusState`, creates server instances, and exposes memory access APIs.

### 2. TCP server is real

- `src-tauri/src/modbus/tcp.rs` binds a real `TcpListener`.
- It accepts concurrent clients, enforces a max-connection limit, parses MBAP headers, validates protocol ID and PDU length, and responds over the socket.
- Implemented function codes:
  - `0x01` Read Coils
  - `0x02` Read Discrete Inputs
  - `0x03` Read Holding Registers
  - `0x04` Read Input Registers
  - `0x05` Write Single Coil
  - `0x06` Write Single Register
  - `0x0F` Write Multiple Coils
  - `0x10` Write Multiple Registers

### 3. RTU server is real

- `src-tauri/src/modbus/rtu.rs` opens a real serial port via `tokio_serial`.
- It computes/validates CRC16, uses inter-frame delay timing, parses RTU frames, and sends responses.
- Supported function codes match the TCP implementation.

### 4. Memory layer is substantial

- `src-tauri/src/modbus/memory.rs` provides thread-safe memory for:
  - coils
  - discrete inputs
  - holding registers
  - input registers
- Address/count validation exists.
- Change events and batch events exist.
- CSV snapshot save/load exists.

### 5. Simulation sync scaffold exists

- `src-tauri/src/commands/sim.rs` wires `ModServerSync` into the simulation engine when simulation starts.
- `src-tauri/src/sim/modserver_sync.rs` maps:
  - Discrete Inputs -> `P`
  - `M/K/T/C` -> Coils
  - `D/TD/CD` -> Holding Registers
- `src-tauri/src/sim/engine.rs` calls sync during input/output scan phases.

## Gaps / Risks

### 1. External holding-register writes are not propagated into simulation state

- `ModServerSync` is clearly designed to mirror external HR writes into `D` registers using `mark_external_write()`.
- But the only references to `mark_external_write()` are in tests.
- TCP/RTU write handlers update `ModbusMemory`, but they do not notify `ModServerSync` that an external HR write occurred.
- Result: comments and tests claim `External HR writes -> D registers`, but the production write path does not complete that loop.

### 2. Protocol coverage is partial, not industrial-grade

- Only a core subset of Modbus function codes is implemented.
- There is no visible support for diagnostics/device identification/report-slave-id style coverage.
- No evidence of exception detail depth beyond basic illegal function/address/value cases.
- No per-connection timeout/idle handling despite config carrying `timeout_ms` for TCP.

### 3. TCP connection lifecycle is serviceable but not hardened

- Server shutdown depends on a spawned accept loop and polling for stop completion.
- Connection limit enforcement rejects extra clients by dropping them silently after accept, rather than returning a protocol-level or audited rejection flow.
- PDU reads rely on a single follow-up read after MBAP parsing, which is fine for many local cases but not robust against segmented TCP delivery.

### 4. RTU implementation is functional but minimally hardened

- RTU uses timing-based frame assembly and task abort for shutdown.
- There is no visible test that exercises a real serial loopback device.
- Error recovery is basic and oriented toward continuing the loop rather than proving deterministic industrial behavior.

### 5. Test coverage is mostly unit-level, not interoperability-level

- `tcp.rs`, `rtu.rs`, `memory.rs`, and `modserver_sync.rs` include useful unit tests.
- But there is no evidence of a backend integration test that starts the TCP server, connects with a real Modbus client, sends frames, and verifies memory/simulation behavior end-to-end.
- On this machine, `cargo test modbus -- --nocapture` compiled but the test binary failed to launch with `STATUS_ENTRYPOINT_NOT_FOUND`, so current automated proof is also operationally shaky.

## Backend Completion Estimate

- Core server existence: high
- Command/API exposure: high
- In-memory data model: high
- TCP protocol basics: medium-high
- RTU protocol basics: medium
- Simulation integration: medium
- Production hardening: low-medium
- Commissioning readiness: low

## Expertise Take

If we were aiming at a commercial EDA/PLC simulator baseline, I would not call this "missing". I would call it "implemented, but not closed".

The next backend steps should be:

1. Close the missing production sync path for external HR writes -> `D` registers.
2. Add backend integration tests with real TCP socket requests.
3. Harden TCP reads to handle fragmented frames correctly.
4. Add explicit protocol support/compatibility matrix documentation.
5. Introduce structured observability around client sessions, request counts, exception responses, and sync activity.
