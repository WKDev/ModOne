# PRD Unit 8: Ladder Editor (Ladder Diagram Editor)

## Overview
Ladder Editor is a UI component that visualizes the AST parsed by OneParser as a grid-based ladder diagram and allows drag-and-drop editing. In monitoring mode, it displays real-time status by integrating with OneSim.

## Ladder Diagram Basics

### Grid Specifications
- Column count: 8-12 (configurable)
- Cell size: 80x40 pixels (configurable)
- Power Rail: Left side fixed
- Neutral Rail: Right side fixed
- Output area: Last 1-2 columns

## Ladder Elements

### 1. Contacts
- Normally Open (NO): `──[ ]──` - a-contact
- Normally Closed (NC): `──[/]──` - b-contact
- Positive Edge (P): `──[↑]──` - Rising edge
- Negative Edge (N): `──[↓]──` - Falling edge

### 2. Coils
- Output Coil: `──( )──` - Standard output
- Set Coil: `──(S)──` - Latch
- Reset Coil: `──(R)──` - Unlatch

### 3. Timers
- TON: ON Delay Timer
- TOF: OFF Delay Timer
- TMR: Accumulating Timer
- Display: Device, Preset value, Elapsed time (monitoring)

### 4. Counters
- CTU: Count Up
- CTD: Count Down
- CTUD: Count Up/Down
- Display: Device, Preset value, Current value (monitoring)

### 5. Comparison Blocks
- Equal, Greater, Less, Greater/Equal, Less/Equal, Not Equal

### 6. Wires
- Horizontal, Vertical, Corner, Junction
- Energized state indication in monitoring mode

## UI Layout

### Main Components
1. **Toolbox** - Element palette (Contacts, Coils, Timers, Counters, Compare)
2. **Ladder Grid** - Canvas for ladder diagram
3. **Properties Panel** - Selected element properties
4. **Status Bar** - Current network, cell position, mode

## Editing Features

### Drag and Drop
- Toolbox to Grid: Create new element
- Grid internal: Move element
- Validation: Check valid placement before drop

### Keyboard Shortcuts
- Delete: Delete selected element
- Ctrl+C/V/X: Copy/Paste/Cut
- Ctrl+Z/Y: Undo/Redo
- Ctrl+D: Duplicate
- Arrow Keys: Navigate cells
- Enter: Edit element (double-click equivalent)
- Escape: Deselect

### Context Menu
- Edit Properties
- Cut/Copy/Paste/Delete
- Insert Contact (NO/NC)
- Insert Coil
- Add Branch (Parallel)
- Insert/Delete Network
- Cross Reference
- Go to Symbol Definition

### Auto Wire Generation
- Automatically create connections when placing elements
- Power rail connection for column 0
- Neutral rail connection for output elements

### Parallel Branch Creation
- Insert new row for branch
- Create vertical wires at branch/merge points
- Connect with horizontal wires

## Monitoring Mode

### State Visualization
- Contact ON: Green fill
- Coil ON: Red fill
- Wire energized: Green, thicker, flow animation
- Timer running: Yellow fill
- Timer done: Green fill

### Real-time Value Display
- Timer: ET (elapsed time) / PT (preset time)
- Counter: CV (current value) / PV (preset value)
- Progress bar for timers

### Force Function
- Force device value in monitoring mode
- Yellow border for forced devices
- Release force option

## AST ↔ Grid Conversion

### AST to Grid
1. Traverse node tree
2. Place elements at calculated positions
3. Handle series (column increment) and parallel (row increment) blocks
4. Generate wire segments

### Grid to AST
1. Group elements by row into series blocks
2. Detect parallel connections
3. Build AST tree structure
4. Flatten nodes for storage

## Tauri Command API

### Grid Operations
- `ladder_place_element` - Place element on grid
- `ladder_move_element` - Move element
- `ladder_delete_element` - Delete element
- `ladder_insert_network` - Insert new network
- `ladder_delete_network` - Delete network

### Edit History
- `ladder_undo` - Undo action
- `ladder_redo` - Redo action
- `ladder_save` - Save changes

### Monitoring
- `ladder_start_monitoring` - Start monitoring
- `ladder_stop_monitoring` - Stop monitoring
- `ladder_force_device` - Force device value
- `ladder_release_force` - Release forced value
- `ladder_get_monitoring_state` - Get current state

### Events
- `ladder:element-state` - Element state change
- `ladder:network-evaluated` - Network evaluation complete

## Component Structure
```
src/components/LadderEditor/
├── LadderEditor.tsx           # Main editor component
├── LadderToolbox.tsx          # Toolbox (element palette)
├── LadderGrid.tsx             # Ladder grid canvas
├── LadderNetwork.tsx          # Single network rendering
├── LadderRow.tsx              # Single row rendering
├── PropertiesPanel.tsx        # Properties panel
├── StatusBar.tsx              # Status bar
├── elements/                  # Ladder element components
│   ├── Contact.tsx
│   ├── Coil.tsx
│   ├── Timer.tsx
│   ├── Counter.tsx
│   ├── Comparison.tsx
│   ├── Wire.tsx
│   ├── PowerRail.tsx
│   └── NeutralRail.tsx
├── dialogs/                   # Dialog components
│   ├── DeviceSelectDialog.tsx
│   ├── TimerSettingDialog.tsx
│   └── SymbolEditDialog.tsx
├── hooks/
│   ├── useLadderGrid.ts
│   ├── useLadderEdit.ts
│   ├── useDragDrop.ts
│   ├── useMonitoring.ts
│   └── useUndoRedo.ts
└── utils/
    ├── gridConverter.ts
    ├── wireGenerator.ts
    └── validation.ts
```

## Test Criteria

### Unit Tests
- AST to Grid conversion
- Grid to AST conversion
- Element placement validation
- Auto wire generation
- Parallel branch creation/deletion
- Undo/Redo operations

### Integration Tests
- OneParser result visualization
- Edit and save/load
- ModServer integration (monitoring)
- Symbol table synchronization

### E2E Tests
- Drag from toolbox to grid
- Double-click element to edit
- Toggle monitoring mode
- Force device value
- Open CSV → Edit → Save

## Dependencies
- Unit 2: UI Layout (panel system)
- Unit 3: ModServer (monitoring)
- Unit 7: OneParser (AST)

## Blocks
- Unit 9: OneSim (simulation integration)
- Unit 10: Integration (full integration test)

## External Libraries
- React Konva or Fabric.js for canvas rendering
- react-dnd for drag and drop
- uuid for ID generation
- immer for immutable state

## Implementation Priority
1. Basic grid rendering (cells, power/neutral rails)
2. Contact element rendering
3. Coil element rendering
4. AST to Grid conversion
5. Drag and drop placement
6. Auto wire generation
7. Properties panel
8. Parallel branch editing
9. Timer/Counter elements
10. Undo/Redo
11. Monitoring mode
12. Force function
13. Grid to AST conversion
14. Comparison/Math elements
