# PRD Unit 7: OneParser (LS PLC CSV Parser)

## Overview
OneParser is a module that parses CSV files exported from LS Electric's XG5000 PLC programming tool and converts ladder logic into an AST (Abstract Syntax Tree). This AST is used by LadderEditor for visualization and OneSim for execution.

## LS PLC Device System

### Bit Devices
| Device | Description | Address Range | Modbus Mapping |
|--------|-------------|---------------|----------------|
| P | Input Relay | P0000~P2047 | Discrete Input |
| M | Auxiliary Relay | M0000~M8191 | Coil |
| K | Keep Relay | K0000~K2047 | Coil |
| F | Special Relay | F0000~F2047 | Discrete Input (RO) |
| T | Timer Contact | T0000~T2047 | Coil (RO) |
| C | Counter Contact | C0000~C2047 | Coil (RO) |

### Word Devices
| Device | Description | Address Range | Modbus Mapping |
|--------|-------------|---------------|----------------|
| D | Data Register | D0000~D9999 | Holding Register |
| R | File Register | R0000~R9999 | Holding Register |
| Z | Index Register | Z0~Z15 | Holding Register |
| N | Link Data Register | N0000~N8191 | Holding Register |

## CSV File Format

### XG5000 Export Format
```csv
No,Step,Instruction,Operand1,Operand2,Operand3,Comment
1,0,LOAD,P0001,,,Start Button
2,0,OR,M0001,,,Self-hold
3,0,LOADN,P0002,,,Stop Button
4,0,ANDB,,,,AND Block
5,0,OUT,M0001,,,Motor ON
```

## Supported Instructions

### Contact Instructions
- LOAD, LOADN, LOADP, LOADF - Start contact (NO, NC, Positive Edge, Negative Edge)
- AND, ANDN, ANDP, ANDF - Series contact
- OR, ORN, ORP, ORF - Parallel contact

### Block Instructions
- ANDB - Block AND connection
- ORB - Block OR connection

### Output Instructions
- OUT, OUTN - Output (Coil)
- SET, RST - Latch/Unlatch

### Timer/Counter Instructions
- TON, TOF, TMR - Timers (ON Delay, OFF Delay, Accumulating)
- CTU, CTD, CTUD - Counters (Up, Down, Up/Down)

### Comparison Instructions
- LD=, LD>, LD<, LD>=, LD<=, LD<> - Comparison operations

### Math Instructions
- ADD, SUB, MUL, DIV - Arithmetic operations
- MOV - Data move

## AST Structure

### Ladder Program
```typescript
interface LadderProgram {
  metadata: ProgramMetadata;
  networks: LadderNetwork[];     // Each Step (Rung)
  symbolTable: SymbolTable;      // Device symbol table
}
```

### Ladder Node Types
- contact_no, contact_nc, contact_p, contact_n - Contacts
- coil_out, coil_set, coil_rst - Coils
- timer_ton, timer_tof, timer_tmr - Timers
- counter_ctu, counter_ctd, counter_ctud - Counters
- comparison, math, move - Operations
- block_series, block_parallel - Connection blocks

## Parsing Algorithm

1. Read CSV file row by row
2. Group by Step number (Network separation)
3. Stack-based instruction processing (LOAD/AND/OR/ANDB/ORB)
4. Build AST tree structure
5. Calculate grid positions
6. Generate LadderProgram

## Modbus Address Mapping

### Mapping Rules
- P (Input) → Discrete Input (offset: 0)
- M (Auxiliary) → Coil (offset: 0)
- K (Keep) → Coil (offset: 8192)
- T (Timer contact) → Coil (offset: 10240)
- C (Counter contact) → Coil (offset: 12288)
- D (Data) → Holding Register (offset: 0)
- TD (Timer current) → Holding Register (offset: 28208)
- CD (Counter current) → Holding Register (offset: 30256)

## Tauri Command API

### CSV Parsing
- `parser_parse_csv(path: String)` - Parse CSV file
- `parser_parse_csv_string(content: String)` - Parse CSV string
- `parser_validate_program(program: LadderProgram)` - Validate program

### Address Conversion
- `parser_map_address_to_modbus(device_address: String)` - Device to Modbus
- `parser_map_modbus_to_address(modbus_address: ModbusAddress)` - Modbus to Device

### Program Conversion
- `parser_program_to_csv(program: LadderProgram)` - AST to CSV (reverse)
- `parser_save_program(path: String, program: LadderProgram)` - Save program
- `parser_load_program(path: String)` - Load program

## Component Structure
```
src/components/OneParser/
├── OneParser.ts               # Main parser module
├── CsvReader.ts               # CSV file reader
├── InstructionParser.ts       # Instruction parsing
├── AstBuilder.ts              # AST generation
├── GridCalculator.ts          # Grid position calculation
├── ModbusMapper.ts            # Modbus address mapping
├── SymbolTableBuilder.ts      # Symbol table generation
├── Validator.ts               # Program validation
└── types.ts                   # TypeScript types

src-tauri/src/parser/
├── mod.rs
├── csv_parser.rs
├── instruction.rs
├── ast.rs
├── grid.rs
├── modbus_mapper.rs
├── symbol_table.rs
├── validator.rs
└── commands.rs
```

## Test Criteria

### Unit Tests
- CSV row parsing (each instruction)
- Device address parsing (P0001, M0001.0, D[Z0])
- Instruction stack processing
- Block connection (series/parallel)
- Modbus address mapping
- Grid position calculation

### Integration Tests
- Full CSV file parsing
- Symbol table generation
- AST to CSV reverse conversion
- Program save/load

### E2E Tests
- XG5000 sample file parsing
- Visualization in LadderEditor
- Execution confirmation in OneSim

## Dependencies
- Unit 1: Project base structure (file system)
- Unit 3: ModServer (address mapping reference)

## Blocks
- Unit 8: Ladder Editor (AST visualization)
- Unit 9: OneSim (AST execution)

## Implementation Priority
1. Basic CSV parsing (row separation, field extraction)
2. Device address parsing
3. Basic instructions (LOAD, AND, OR, OUT)
4. Block instructions (ANDB, ORB)
5. AST tree construction
6. Grid position calculation
7. Timer/Counter instructions
8. Modbus address mapping
9. Symbol table
10. Comparison/Math instructions
11. Reverse conversion (AST to CSV)
12. Validation and error handling
