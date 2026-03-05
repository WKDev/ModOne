# Block Size Audit - All 22 Block Types

**Generated:** 2026-02-27  
**Source:** `src/components/OneCanvas/blockDefinitions.ts`  
**Purpose:** Document all block dimensions for port migration planning

## Block Dimensions Table

| Block Type | Width | Height | 20px-aligned | Notes |
|------------|-------|--------|--------------|-------|
| powersource | 40 | 40 | YES | Power supply source |
| plc_out | 80 | 40 | YES | PLC output module |
| plc_in | 80 | 40 | YES | PLC input module |
| led | 40 | 60 | YES | Light-emitting diode |
| button | 40 | 40 | YES | Push button switch |
| scope | 100 | 80 | YES | Oscilloscope/measurement |
| text | 160 | 40 | YES | Text label/annotation |
| relay | 60 | 60 | YES | Electromagnetic relay |
| fuse | 40 | 50 | NO | Protective fuse element |
| motor | 60 | 60 | YES | Three-phase motor |
| emergency_stop | 50 | 50 | NO | Emergency stop button |
| selector_switch | 50 | 50 | NO | Multi-position selector |
| solenoid_valve | 60 | 50 | NO | Solenoid-controlled valve |
| sensor | 60 | 40 | YES | Industrial sensor |
| pilot_lamp | 40 | 40 | YES | Indicator lamp |
| net_label | 80 | 24 | NO | Network/signal label |
| transformer | 70 | 80 | NO | Power transformer |
| terminal_block | 40 | 50 | NO | Terminal connection block |
| overload_relay | 60 | 70 | NO | Overload protection relay |
| contactor | 70 | 80 | NO | Power contactor |
| disconnect_switch | 60 | 70 | NO | Disconnect/isolator switch |
| off_page_connector | 80 | 32 | NO | Off-page signal connector |

## Summary Statistics

- **Total Block Types:** 22
- **20px-aligned (both W & H):** 11 blocks
- **Non-aligned:** 11 blocks

### Aligned Blocks (11)
- powersource, plc_out, plc_in, led, button, scope, text, relay, motor, sensor, pilot_lamp

### Non-aligned Blocks (11)
- fuse (40×50), emergency_stop (50×50), selector_switch (50×50), solenoid_valve (60×50)
- net_label (80×24), transformer (70×80), terminal_block (40×50), overload_relay (60×70)
- contactor (70×80), disconnect_switch (60×70), off_page_connector (80×32)

## Alignment Analysis

**20px-aligned means:** Both width AND height are multiples of 20

- **40px:** Divisible by 20 ✓
- **50px:** NOT divisible by 20 ✗
- **60px:** Divisible by 20 ✓
- **70px:** NOT divisible by 20 ✗
- **80px:** Divisible by 20 ✓
- **100px:** Divisible by 20 ✓
- **160px:** Divisible by 20 ✓
- **24px:** NOT divisible by 20 ✗
- **32px:** NOT divisible by 20 ✗

## Port Configuration Notes

All blocks have default port definitions in blockDefinitions.ts:
- Input ports: typically on left/top
- Output ports: typically on right/bottom
- Bidirectional ports: used for off-page connectors
- Port offsets: used for multi-port blocks (scope, motor, contactor, etc.)

## Future Migration Considerations

1. **Grid Alignment:** Non-aligned blocks may need dimension adjustments for strict 20px grid
2. **Port Positioning:** Port offsets are relative (0.0-1.0) and scale with block dimensions
3. **Rendering:** Current canvas uses pixel-based positioning; grid alignment is optional
4. **Backward Compatibility:** Changing dimensions would require updating all existing schematics
