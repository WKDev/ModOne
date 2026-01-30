# PRD Unit 9: OneSim (PLC Simulation Engine)

## Overview
OneSim is a PLC simulation engine that executes the ladder AST parsed by OneParser. It emulates the actual PLC scan cycle, evaluates ladder logic, and synchronizes memory with ModServer to integrate with OneCanvas and external Modbus clients.

## PLC Scan Cycle

### Actual PLC Operation Principle
```
1. Input Scan    → Read DI from Memory
2. Program Exec  → Evaluate Ladder Network by Network
3. Output Scan   → Write Coils to Memory
→ Repeat (Scan Time: 10~100ms configurable)
```

### OneSim Scan Cycle
- Configurable scan time (default: 10ms)
- Watchdog timeout (default: 1000ms)
- Three phases: Input Scan, Program Execution, Output Scan
- Statistics: cycle count, last/average/max scan time

## Simulation Architecture

### Core Components
1. **Program Executor** - Executes ladder AST
2. **Device Memory** - PLC device memory management
3. **Timer/Counter Manager** - Timer and counter runtime state
4. **ModServer Sync** - Bidirectional memory synchronization
5. **Debugger** - Breakpoints, watches, step execution

## Device Memory

### Bit Devices
- P (Input Relay): 2048 bits - Read from Discrete Input
- M (Auxiliary Relay): 8192 bits - Read/Write
- K (Keep Relay): 2048 bits - Read/Write (persistent)
- F (Special Relay): 2048 bits - Read only
- T (Timer Contact): 2048 bits - Read only (set by timer)
- C (Counter Contact): 2048 bits - Read only (set by counter)

### Word Devices
- D (Data Register): 10000 words
- R (File Register): 10000 words
- Z (Index Register): 16 words
- N (Link Data Register): 8192 words
- TD (Timer Current Value): 2048 words
- CD (Counter Current Value): 2048 words

## Program Execution

### Node Evaluation (Recursive)
- Contact NO: Read bit value
- Contact NC: Invert bit value
- Contact P: Rising edge detection (previous=false, current=true)
- Contact N: Falling edge detection (previous=true, current=false)
- Block Series: All children must be true (AND)
- Block Parallel: Any child true (OR)
- Comparison: Compare operand values

### Output Execution
- Coil OUT: Write input condition to bit
- Coil SET: Write true if input condition true (latch)
- Coil RST: Write false if input condition true (unlatch)
- Timer: Update timer state based on input
- Counter: Update counter on rising edge
- Math: Execute calculation if input true
- Move: Move data if input true

### Network Execution
1. Evaluate input tree from root to output nodes
2. Execute output nodes with input condition
3. Track execution time per network

## Timer/Counter Management

### Timer Types
- **TON (ON Delay)**: Start timing when input ON, output ON after preset
- **TOF (OFF Delay)**: Output ON immediately, start timing when input OFF
- **TMR (Accumulating)**: Accumulate time while input ON, reset only by RST

### Timer State
- enabled: Timer is running
- done: Timer completed
- elapsed: Current elapsed time
- Time bases: ms, 10ms, 100ms, s

### Counter Types
- **CTU (Count Up)**: Increment on rising edge
- **CTD (Count Down)**: Decrement on rising edge
- **CTUD (Up/Down)**: Both up and down inputs

### Counter State
- done: Reached preset value
- current_value: Current count
- Rising edge detection for counting

## ModServer Synchronization

### Input Sync (ModServer → DeviceMemory)
- Discrete Inputs → P (Input Relay)
- External Holding Register writes → D (Data Register)
- Check external write flag to distinguish from internal writes

### Output Sync (DeviceMemory → ModServer)
- M (Auxiliary) → Coils (offset: 0)
- K (Keep) → Coils (offset: 8192)
- T (Timer Contact) → Coils (offset: 10240)
- C (Counter Contact) → Coils (offset: 12288)
- D (Data) → Holding Registers
- TD (Timer Current) → Holding Registers (offset: 28208)
- CD (Counter Current) → Holding Registers (offset: 30256)

### Sync Modes
- Immediate: Real-time synchronization
- EndOfScan: Sync at end of each scan
- Manual: Manual sync trigger

## OneCanvas Integration

### Circuit Simulation Sync
- plc_out blocks: Read Coil state from memory
- plc_in blocks: Write circuit state to Discrete Input
- Subscribe to canvas events for plc_in state changes

## Debugging Features

### Breakpoints
- Network: Stop at specific network
- Device: Stop when device value changes
- Condition: Stop when condition met (e.g., "D0001 > 100")
- ScanCount: Stop at Nth scan

### Watch Variables
- Device address
- Current/Previous value
- Change count
- Last change time
- Value history

### Step Execution
- Step Network: Execute one network at a time
- Step Scan: Execute one full scan cycle
- Pause/Resume simulation

## Tauri Command API

### Simulation Control
- `sim_start(program_id, config)` - Start simulation
- `sim_stop()` - Stop simulation
- `sim_pause()` - Pause simulation
- `sim_resume()` - Resume simulation
- `sim_get_status()` - Get simulation status
- `sim_get_scan_info()` - Get scan cycle info

### Memory Access
- `sim_read_device(address)` - Read device value
- `sim_write_device(address, value)` - Write device value
- `sim_read_memory_range(type, start, count)` - Read memory range
- `sim_get_memory_snapshot()` - Get full memory snapshot

### Debugging
- `sim_add_breakpoint(breakpoint)` - Add breakpoint
- `sim_remove_breakpoint(breakpoint)` - Remove breakpoint
- `sim_add_watch(address)` - Add watch variable
- `sim_get_watches()` - Get watch list
- `sim_step_network()` - Step one network
- `sim_step_scan()` - Step one scan

### Events
- `sim:scan-complete` - Scan completed
- `sim:device-change` - Device value changed
- `sim:breakpoint-hit` - Breakpoint triggered

## Component Structure
```
src/components/OneSim/
├── OneSim.tsx                 # Simulation control UI
├── SimToolbar.tsx             # Start/Stop/Pause buttons
├── SimStatus.tsx              # Status display
├── ScanCycleMonitor.tsx       # Scan cycle monitoring
├── DebugPanel.tsx             # Debug panel
├── BreakpointList.tsx         # Breakpoint list
├── WatchList.tsx              # Watch variable list
├── hooks/
│   ├── useSimulation.ts
│   ├── useSimEvents.ts
│   ├── useDebugger.ts
│   └── useDeviceMemory.ts
└── types.ts

src-tauri/src/sim/
├── mod.rs
├── engine.rs                  # OneSim engine
├── executor.rs                # Program executor
├── memory.rs                  # DeviceMemory
├── timer.rs                   # Timer management
├── counter.rs                 # Counter management
├── edge.rs                    # Edge detection
├── modserver_sync.rs          # ModServer sync
├── canvas_sync.rs             # OneCanvas sync
├── debugger.rs                # Debugger
└── commands.rs                # Tauri commands
```

## Test Criteria

### Unit Tests
- Contact evaluation (NO/NC/P/N)
- Coil output (OUT/SET/RST)
- Block evaluation (series/parallel)
- Timer operation (TON/TOF/TMR)
- Counter operation (CTU/CTD/CTUD)
- Comparison operations
- Math operations
- Memory read/write

### Integration Tests
- Full scan cycle
- ModServer synchronization
- OneCanvas integration
- Multi-network execution
- Timer real-time operation

### E2E Tests
- Load program → Start simulation
- LadderEditor monitoring integration
- Memory Visualizer real-time update
- Breakpoint hit
- Step execution

## Dependencies
- Unit 3: ModServer (memory synchronization)
- Unit 5: OneCanvas (circuit integration)
- Unit 7: OneParser (AST)
- Unit 8: LadderEditor (monitoring)

## Blocks
- Unit 10: Integration (full integration)

## External Libraries (Rust)
- tokio: Async runtime
- bitvec: Bit vector
- parking_lot: High-performance locks
- tokio-util: CancellationToken

## Performance Goals
| Item | Target |
|------|--------|
| Minimum scan time | 1ms |
| Default scan time | 10ms |
| Per-network evaluation | < 100μs |
| Memory sync time | < 1ms |
| Max networks | 10,000 |
| Max devices | 100,000 |

## Implementation Priority
1. DeviceMemory structure
2. Basic contact/coil evaluation
3. Scan cycle loop
4. ModServer sync (output)
5. ModServer sync (input)
6. Block evaluation (series/parallel)
7. Timer implementation (TON)
8. Counter implementation (CTU)
9. Comparison/Math operations
10. OneCanvas integration
11. Debugger (breakpoints)
12. Watch variables
13. Step execution
14. Remaining timers/counters
