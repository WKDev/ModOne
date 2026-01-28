# PRD Unit 6: Scenario Editor

## Overview
Scenario Editor is a tool for editing and executing scenarios that automatically manipulate ModServer memory values based on time. It provides an Excel-sheet-like interface to define simulation test cases.

## Scenario Concept

### Execution Flow
```
Simulation Start (t=0)
    │
    ├─ t=0.0s   → address: M0001, value: 1 (persist: true)
    │
    ├─ t=1.5s   → address: M0002, value: 1 (persist: false, release after 500ms)
    │
    ├─ t=2.0s   → address: D100, value: 1234
    │
    ├─ t=5.0s   → address: M0001, value: 0
    │
    └─ Scenario end or loop
```

### Use Cases
1. **Automated Testing**: Verify PLC logic for specific input sequences
2. **Demo/Presentation**: Reproduce simulation with predefined scenarios
3. **Load Testing**: Test various input combinations
4. **Debugging**: Reproduce specific conditions

## Data Model

### Scenario Event
```typescript
interface ScenarioEvent {
  id: string;                    // Unique ID
  time: number;                  // Time after simulation start (seconds)
  address: string;               // Modbus address (e.g., "C:0x0001", "H:0x0100")
  value: number;                 // Value to set (0~65535)
  persist: boolean;              // Value persistence
  persistDuration?: number;      // Auto-release time when persist=false (ms)
  note: string;                  // Description/comment
  enabled: boolean;              // Event enabled/disabled
}
```

### Scenario File
```typescript
interface Scenario {
  metadata: {
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    author: string;
  };
  settings: {
    loop: boolean;               // Loop execution
    loopCount: number;           // Loop count (0 = infinite)
    loopDelay: number;           // Delay between loops (ms)
    autoStart: boolean;          // Auto-start on simulation start
  };
  events: ScenarioEvent[];
}
```

### Address Format
| Prefix | Memory Type | Example |
|--------|-------------|---------|
| C: | Coil | C:0x0001, C:100 |
| DI: | Discrete Input | DI:0x0001 |
| H: | Holding Register | H:0x0100, H:256 |
| IR: | Input Register | IR:0x0100 |
| (PLC alias) | Auto-convert | M0001 → C:0x0001 |

## UI Components

### Main Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Scenario Editor                               [New] [Save] [▼] │
├─────────────────────────────────────────────────────────────────┤
│  [▶ Run] [⏸ Pause] [⏹ Stop] [🔁 Loop: ON]  Time: 00:05.234      │
├─────────────────────────────────────────────────────────────────┤
│  ┌───┬─────────┬────────────┬─────────┬─────────┬─────────┬────┐│
│  │   │  Time   │  Address   │  Value  │ Persist │ Duration│Note││
│  ├───┼─────────┼────────────┼─────────┼─────────┼─────────┼────┤│
│  │ ☑ │  0.000  │  C:0x0001  │    1    │   ✓    │    -    │ .. ││
│  │ ☑ │  1.500  │  C:0x0002  │    1    │   ☐    │  500ms  │ .. ││
│  └───┴─────────┴────────────┴─────────┴─────────┴─────────┴────┘│
├─────────────────────────────────────────────────────────────────┤
│  Progress: ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  25% (2/8 events)│
└─────────────────────────────────────────────────────────────────┘
```

### 1. Toolbar
- Run/Pause/Stop execution controls
- Loop toggle
- Current time display
- File operations: New, Open, Save, Save As, Export CSV, Import CSV

### 2. Spreadsheet Grid
| Column | Type | Width | Edit | Description |
|--------|------|-------|------|-------------|
| (checkbox) | boolean | 30px | ✓ | Event enable/disable |
| Time | float | 80px | ✓ | Execution time (seconds) |
| Address | string | 120px | ✓ | Modbus address |
| Value | number | 80px | ✓ | Value to set |
| Persist | boolean | 70px | ✓ | Value persistence |
| Duration | number | 80px | ✓ | Auto-release time |
| Note | string | auto | ✓ | Comment |

### 3. Row Operations
- Add: Last row "[+] Add Event" or Ctrl+Enter
- Insert: Above/below (context menu)
- Delete: Delete key or context menu
- Duplicate: Ctrl+D
- Move: Drag and drop
- Multi-select: Shift+click, Ctrl+click

### 4. Execution State Display
- Completed rows: Green background
- Current row: Yellow background + blinking
- Pending rows: Default background
- Disabled rows: Gray text
- Error rows: Red border

## CSV File Format
```csv
time,address,value,persist,duration,note
0.000,C:0x0001,1,true,,Motor Start
1.500,C:0x0002,1,false,500,Sensor Trigger
2.000,H:0x0100,1234,true,,Set Temperature
5.000,C:0x0001,0,true,,Motor Stop
```

## Component Structure
```
src/components/ScenarioEditor/
├── ScenarioEditor.tsx         # Main editor component
├── ScenarioToolbar.tsx        # Toolbar (execution control, file ops)
├── ScenarioGrid.tsx           # Spreadsheet grid
├── ScenarioRow.tsx            # Individual row component
├── cells/                     # Cell editors
│   ├── TimeCell.tsx           # Time input cell
│   ├── AddressCell.tsx        # Address selector cell
│   ├── ValueCell.tsx          # Value input cell
│   ├── PersistCell.tsx        # Checkbox cell
│   ├── DurationCell.tsx       # Duration input cell
│   └── NoteCell.tsx           # Note cell
├── ExecutionProgress.tsx      # Execution progress display
├── TimelineView.tsx           # Timeline view (optional)
├── AddressSelector.tsx        # Address selector dialog
├── SettingsDialog.tsx         # Scenario settings dialog
├── hooks/
│   ├── useScenarioData.ts     # Scenario data management
│   ├── useScenarioExecution.ts # Execution state management
│   └── useScenarioEvents.ts   # Event subscription
├── utils/
│   ├── csvParser.ts           # CSV parsing/generation
│   ├── addressParser.ts       # Address parsing/conversion
│   └── timeUtils.ts           # Time formatting
└── types.ts
```

## Tauri Commands
- `scenario_load` - Load scenario file
- `scenario_save` - Save scenario file
- `scenario_import_csv` - Import CSV
- `scenario_export_csv` - Export CSV
- `scenario_run` - Start execution
- `scenario_pause` - Pause execution
- `scenario_resume` - Resume execution
- `scenario_stop` - Stop execution
- `scenario_get_status` - Get execution state
- `scenario_seek` - Jump to specific time

## Scenario Events (Tauri)
- `scenario:event-executed` - Event execution notification
- `scenario:status-changed` - Status change notification

## Dependencies
- Unit 2: UI Layout (panel system)
- Unit 3: ModServer (memory manipulation)
- Unit 4: Memory Visualizer (address selection, result verification)

## Implementation Priority
1. Basic spreadsheet UI
2. Event CRUD (add/edit/delete)
3. CSV file save/load
4. Scenario execution engine (basic)
5. Execution state display
6. ModServer integration (memory write)
7. persist=false auto-release
8. Loop execution
9. Address selector (Memory Visualizer integration)
10. CSV import/export
11. Timeline view (optional)
