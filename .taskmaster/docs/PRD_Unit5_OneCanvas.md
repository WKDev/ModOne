# PRD Unit 5: OneCanvas (Circuit Simulation GUI)

## Overview
OneCanvas is a GUI editor for placing and connecting electronic components (buttons, LEDs, switches) as blocks to simulate circuits. It connects with ModServer's Coil/Register to visually test PLC I/O.

## Core Concepts

### Circuit Simulation Principle
1. **Power Supply**: Current starts from `+24V`, `+12V` blocks
2. **Current Path**: Delivered to components through wires
3. **Switching**: `plc_out`, `button` blocks open/close circuits
4. **Load**: Output devices like `LED` consume current
5. **Ground**: `GND` block completes the circuit

### Example Circuit
```
[+24V]---[plc_out(M0001)]---[LED]---[GND]

→ When M0001 Coil is ON, LED lights up
→ When M0001 Coil is OFF, LED turns off
```

## Block Types

### 1. plc_out (PLC Output)
- Connects PLC Coil output to circuit
- Properties: address, normally open/closed, inverted
- Coil ON = circuit connected, Coil OFF = circuit open

### 2. plc_in (PLC Input)
- Transmits circuit current state to PLC Discrete Input
- Properties: address, threshold voltage, inverted

### 3. LED
- Lights up when current flows
- Properties: color (red/green/blue/yellow/white), forward voltage

### 4. Button/Switch
- User input switch block
- Types: momentary (press-hold), stationary (toggle)
- Contact configurations: 1a, 1b, 1a1b, 2a, 2b, 2a2b, 3a3b
- NO (Normally Open) and NC (Normally Closed) contacts

### 5. Scope (Oscilloscope)
- Monitor signals and display waveforms
- Up to 4 channels, trigger modes, zoom/pan

### 6. Power Blocks
- GND: Ground (0V reference)
- +24V: 24V power supply
- +12V: 12V power supply

## Wire System
- Connect component ports with wires
- Multiple wires can connect to single port (branching)
- Visual current flow animation
- Color coding: Power (red), Ground (black), Signal (blue), Inactive (gray)

## Canvas System
- Infinite canvas with pan/zoom (10%-400%)
- Grid snapping (20px default)
- Component drag-and-drop from toolbox
- Wire drawing between ports

## UI Components

### Main Layout
- Toolbox panel (block categories)
- Canvas (component placement, wire drawing)
- Properties panel (selected component properties)

### Interactions
- Click: Select component
- Double-click: Edit properties
- Drag: Move component
- Port click-drag: Draw wire
- Mouse wheel: Zoom
- Space+drag: Pan canvas

### Keyboard Shortcuts
- Delete: Delete selection
- Ctrl+A: Select all
- Ctrl+C/V/X: Copy/Paste/Cut
- Ctrl+Z/Y: Undo/Redo
- Ctrl+D: Duplicate
- G: Toggle grid, S: Toggle snap

## Component Structure
```
src/components/OneCanvas/
├── OneCanvas.tsx              # Main editor component
├── Canvas.tsx                 # Canvas rendering
├── Toolbox.tsx                # Toolbox panel
├── PropertiesPanel.tsx        # Properties panel
├── components/                # Block components
│   ├── BlockRenderer.tsx      # Block renderer (type dispatch)
│   ├── PowerBlock.tsx         # +24V, +12V blocks
│   ├── GndBlock.tsx           # GND block
│   ├── PlcOutBlock.tsx        # plc_out block
│   ├── PlcInBlock.tsx         # plc_in block
│   ├── LedBlock.tsx           # LED block
│   ├── ButtonBlock.tsx        # Button block
│   ├── ScopeBlock.tsx         # Scope block
│   └── Port.tsx               # Connection port
├── Wire.tsx                   # Wire component
├── SelectionBox.tsx           # Selection area display
├── GridBackground.tsx         # Grid background
├── hooks/
│   ├── useCanvasState.ts      # Canvas state management
│   ├── useDragDrop.ts         # Drag and drop
│   ├── useWireDrawing.ts      # Wire drawing
│   ├── useSimulation.ts       # Simulation logic
│   └── useKeyboardShortcuts.ts
├── utils/
│   ├── circuitSimulator.ts    # Circuit simulation engine
│   ├── pathfinder.ts          # Current path finding
│   └── serialization.ts       # YAML serialization
└── types.ts
```

## Tauri Commands
- `canvas_load_circuit` - Load circuit file
- `canvas_save_circuit` - Save circuit file
- `canvas_create_circuit` - Create new circuit
- `canvas_start_simulation` - Start simulation
- `canvas_stop_simulation` - Stop simulation
- `canvas_get_simulation_state` - Get simulation state
- `canvas_button_press/release/toggle` - Button input

## Circuit YAML Schema
```yaml
metadata:
  name: "Circuit Name"
  description: "Description"
  tags: ["input", "sensor"]

circuit:
  components:
    - id: "power1"
      type: "power_24v"
      position: { x: 100, y: 50 }
      properties: { maxCurrent: 1000 }

  wires:
    - id: "wire1"
      from: { component: "power1", port: "positive" }
      to: { component: "plc_out1", port: "in" }
```

## Dependencies
- Unit 1: Project base structure (circuit YAML schema)
- Unit 2: UI Layout (panel system)
- Unit 3: ModServer (Coil/Register access)

## Implementation Priority
1. Basic canvas (zoom/pan/grid)
2. Block rendering (Power, GND)
3. Block placement (drag and drop)
4. Wire connection system
5. plc_out/plc_in blocks + ModServer integration
6. LED block + simulation
7. Button block (momentary/stationary)
8. Properties panel
9. YAML save/load
10. Selection/copy/paste
11. Undo/redo
12. Scope block (advanced)
