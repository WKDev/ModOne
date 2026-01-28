# PRD Unit 4: Memory Visualizer

## Overview
Implement a panel that visualizes and controls ModServer's Modbus memory (Coil, Discrete Input, Holding Register, Input Register) in table format. Users can monitor memory values in real-time and directly modify values.

## Key Features

### 1. Memory Table View
- Display 4 memory types: Coil, Discrete Input, Holding Register, Input Register
- Configurable view: DEC/HEX mode, column count (1-16), start address, count
- Grid-based display with row headers showing addresses
- Cell click for value editing (Coils: toggle, Registers: numpad input)

### 2. Memory Types
| Type | Description | Access | Size |
|------|-------------|--------|------|
| Coil | Output bits | Read/Write | 1-bit |
| Discrete Input | Input bits | Read-only | 1-bit |
| Holding Register | Output registers | Read/Write | 16-bit |
| Input Register | Input registers | Read-only | 16-bit |

### 3. Number Input Popover
- Numpad interface for register value input
- DEC/HEX input mode toggle
- HEX keys (A-F) shown in HEX mode
- Cancel/Apply buttons

### 4. Favorites Panel
- Add frequently accessed addresses to favorites
- Custom labels for favorite items
- Color coding support
- Multiple display formats: DEC, HEX, BINARY, SIGNED, FLOAT32
- Drag-and-drop reordering

### 5. Context Menus
- Table cell: Add to Favorites, Copy Address/Value, Set to 0/1
- Favorites item: Edit Label, Change Color/Format, Move Up/Down, Remove

### 6. Data Formats for Registers
| Format | Description | Example (raw: 0xFF00) |
|--------|-------------|----------------------|
| DEC | Unsigned 16-bit | 65280 |
| HEX | Hexadecimal | 0xFF00 |
| BINARY | Binary | 1111111100000000 |
| SIGNED | Signed 16-bit | -256 |
| FLOAT32 | 32-bit float (2 registers) | 123.456 |

## Component Structure
```
src/components/MemoryVisualizer/
├── MemoryVisualizer.tsx       # Main panel component
├── MemoryToolbar.tsx          # Settings toolbar
├── MemoryTable.tsx            # Memory table
├── MemoryCell.tsx             # Individual cell (Coil/Register)
├── NumberInputPopover.tsx     # Number input popover
├── Numpad.tsx                 # Numpad component
├── FavoritesPanel.tsx         # Favorites panel
├── FavoriteItem.tsx           # Favorite item
├── ContextMenu.tsx            # Context menu
├── hooks/
│   ├── useMemoryData.ts       # Memory data hook
│   ├── useFavorites.ts        # Favorites management hook
│   └── useMemoryEvents.ts     # Memory event subscription hook
├── utils/
│   ├── formatters.ts          # Value formatting utils
│   └── addressUtils.ts        # Address conversion utils
└── types.ts                   # Type definitions
```

## Tauri Commands (using existing ModServer API)
- `modbus_read_coils`, `modbus_read_discrete_inputs`
- `modbus_read_holding_registers`, `modbus_read_input_registers`
- `modbus_write_coil`, `modbus_write_coils`
- `modbus_write_holding_register`, `modbus_write_holding_registers`

## New Commands Needed
- `favorites_list` - List all favorites
- `favorites_add` - Add favorite
- `favorites_update` - Update favorite
- `favorites_remove` - Remove favorite
- `favorites_reorder` - Reorder favorites

## Dependencies
- Unit 2: UI Layout (panel system)
- Unit 3: ModServer (memory data source)

## Implementation Priority
1. Basic table layout (Holding Register)
2. Memory read and display
3. DEC/HEX view mode toggle
4. Number input popover (Numpad)
5. Coil table (toggle function)
6. Real-time updates (event subscription)
7. Favorites panel
8. Context menus
9. Advanced formats (FLOAT32, SIGNED)
10. Settings save/restore
