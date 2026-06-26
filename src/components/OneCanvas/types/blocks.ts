import type { Position, Size, PowerPolarity } from './geometry';
import type { CustomSymbolBlock } from '../../../types/symbol';
import type { BlockBehaviorBinding, BlockRuntimeState, BehaviorVisualState } from '../../../types/behavior';
import type { BlockType } from '../../../types/circuit';

// ============================================================================
// Port Types
// ============================================================================

/** Type of port connection */
export type PortType = 'input' | 'output' | 'bidirectional';

/** Position of port on block edge */
export type PortPosition = 'top' | 'bottom' | 'left' | 'right';

/** A connection port on a block */
export interface Port {
  /** Unique identifier for this port within the block */
  id: string;
  /** Type of port */
  type: PortType;
  /** Display label for the port */
  label: string;
  /** Position on block edge */
  position: PortPosition;
  /** Offset along the edge (0-1, default 0.5 = center) */
  offset?: number;
  /** Maximum number of wire connections allowed. Undefined = unlimited. */
  maxConnections?: number;
  /** Absolute position relative to block origin (center of port connection point) */
  absolutePosition?: { x: number; y: number };
}

// ============================================================================
// Base Block
// ============================================================================

/** Base interface for all block types */
export interface BaseBlock<T extends BlockType = BlockType> {
  /** Unique identifier */
  id: string;
  /** Block type discriminator */
  type: T;
  /** Position on canvas */
  position: Position;
  /** Block dimensions */
  size: Size;
  /** Connection ports */
  ports: Port[];
  /**
   * @deprecated Rendering-layer selection flag. Do NOT use as the authoritative source
   * of truth for selection state. The canonical selection state is in
   * `useCanvasFacade().selectedIds` (a Set<string>). This field is synchronized
   * from selectedIds during render and is used by CanvasContent.tsx for
   * junction rendering. Modifying this directly will cause state drift.
   */
  selected?: boolean;
  /** Optional display label */
  label?: string;
  /** Block rotation in degrees (0, 90, 180, 270) */
  rotation?: number;
  visible?: boolean;
  flip?: { horizontal: boolean; vertical: boolean };
  designation?: string;
  behavior?: BlockBehaviorBinding;
  runtimeState?: BlockRuntimeState;
  visualState?: BehaviorVisualState;
}

// ============================================================================
// Specialized Block Types
// ============================================================================

/** Unified power source block (replaces Power24v, Power12v, Gnd) */
export interface PowerSourceBlock extends BaseBlock<'powersource' | 'power_source' | 'power_source_dc_2p' | 'power_source_ac_1p' | 'power_source_ac_2p'> {
  /** Voltage in volts (24, 12, 5, 0, etc.) */
  voltage: number;
  /** Polarity: determines port direction and symbol */
  polarity: PowerPolarity;
  /** Maximum current in mA (not applicable for ground) */
  maxCurrent?: number;
}

/** PLC output (Coil) block - controls circuit based on PLC state */
export interface PlcOutBlock extends BaseBlock<'plc_out'> {
  /** Modbus address (e.g., 'C:0x0001' or 'Y:16') */
  address: string;
  /** Whether contact is normally open (default: true) */
  normallyOpen: boolean;
  /** Whether output is inverted (default: false) */
  inverted: boolean;
}

/** PLC input (Discrete Input) block - sends circuit state to PLC */
export interface PlcInBlock extends BaseBlock<'plc_in'> {
  /** Modbus address (e.g., 'DI:0x0001' or 'X:0') */
  address: string;
  /** Threshold voltage to trigger input (default: 12V) */
  thresholdVoltage: number;
  /** Whether input is inverted (default: false) */
  inverted: boolean;
}

/** LED colors */
export type LedColor = 'red' | 'green' | 'blue' | 'yellow' | 'white';

/** LED block */
export interface LedBlock extends BaseBlock<'led'> {
  /** LED color */
  color: LedColor;
  /** Forward voltage drop (default: 2.0V for red, 3.0V for blue/white) */
  forwardVoltage: number;
  /** Current state: lit or not */
  lit?: boolean;
}

/** Button operation mode */
export type ButtonMode = 'momentary' | 'stationary';

/** Contact configuration */
export type ContactConfig = '1a' | '1b' | '1a1b' | '2a' | '2b' | '2a2b' | '3a3b';

/** Button/Switch block */
export interface ButtonBlock extends BaseBlock<'button'> {
  /** Operation mode */
  mode: ButtonMode;
  /** Contact configuration */
  contactConfig: ContactConfig;
  /** Current pressed state */
  pressed?: boolean;
}

/** Text block style variant */
export type TextStyle = 'label' | 'title' | 'note' | 'section';

/** Oscilloscope trigger mode */
export type TriggerMode = 'auto' | 'normal' | 'single';

/** Oscilloscope block */
export interface ScopeBlock extends BaseBlock<'scope'> {
  /** Number of input channels (1-4) */
  channels: 1 | 2 | 3 | 4;
  /** Trigger mode */
  triggerMode: TriggerMode;
  /** Time base in ms per division */
  timeBase: number;
  /** Voltage scale in V per division */
  voltageScale?: number;
}

/** Text/Annotation block - non-electrical, for labeling and documentation */
export interface TextBlock extends BaseBlock<'text'> {
  /** Text content to display */
  content: string;
  /** Text style variant */
  textStyle: TextStyle;
  /** Font size in pixels */
  fontSize: number;
  /** Text color (CSS color string) */
  textColor: string;
  /** Background color (CSS color string, empty = transparent) */
  backgroundColor: string;
  /** Whether to show a border */
  showBorder: boolean;
}

// ============================================================================
// Industrial Component Block Types
// ============================================================================

/** Relay/Contactor contact type */
export type RelayContactType = 'NO' | 'NC';

/** Relay/Contactor block (K) - coil that controls contacts */
export interface RelayBlock extends BaseBlock<'relay'> {
  /** Device designation (e.g., "K1", "K2") */
  designation: string;
  /** Coil voltage rating */
  coilVoltage: number;
  /** Contact configuration */
  contacts: RelayContactType;
  /** Whether coil is energized */
  energized?: boolean;
}

/** Fuse/Circuit breaker type */
export type FuseType = 'fuse' | 'mcb' | 'mpcb';

/** Fuse/Circuit breaker block (F) */
export interface FuseBlock extends BaseBlock<'fuse'> {
  /** Device designation (e.g., "F1", "QF1") */
  designation: string;
  /** Fuse type */
  fuseType: FuseType;
  /** Current rating in Amps */
  ratingAmps: number;
  /** Whether the fuse is blown/tripped */
  tripped?: boolean;
}

/** Motor block */
export interface MotorBlock extends BaseBlock<'motor'> {
  /** Device designation (e.g., "M1") */
  designation: string;
  /** Motor power rating in kW */
  powerKw: number;
  /** Voltage rating */
  voltageRating: number;
  /** Whether motor is running */
  running?: boolean;
}

/** Emergency stop block */
export interface EmergencyStopBlock extends BaseBlock<'emergency_stop'> {
  /** Device designation (e.g., "ES1", "S0") */
  designation: string;
  /** Whether currently engaged (circuit broken) */
  engaged?: boolean;
}

/** Selector switch position count */
export type SelectorPositions = 2 | 3;

/** Selector switch block */
export interface SelectorSwitchBlock extends BaseBlock<'selector_switch'> {
  /** Device designation (e.g., "S1") */
  designation: string;
  /** Number of positions */
  positions: SelectorPositions;
  /** Current position (0-indexed) */
  currentPosition: number;
  /** Whether switch maintains position */
  maintained: boolean;
}

/** Solenoid valve type */
export type ValveType = '2-2' | '3-2' | '5-2' | '5-3';

/** Solenoid valve block */
export interface SolenoidValveBlock extends BaseBlock<'solenoid_valve'> {
  /** Device designation (e.g., "Y1") */
  designation: string;
  /** Valve type (ports-positions) */
  valveType: ValveType;
  /** Coil voltage */
  coilVoltage: number;
  /** Whether energized */
  energized?: boolean;
}

/** Sensor type */
export type SensorType = 'proximity_inductive' | 'proximity_capacitive' | 'photoelectric' | 'limit_switch';

/** Sensor block */
export interface SensorBlock extends BaseBlock<'sensor'> {
  /** Device designation (e.g., "B1", "SQ1") */
  designation: string;
  /** Sensor type */
  sensorType: SensorType;
  /** Output type: NPN (sinking) or PNP (sourcing) */
  outputType: 'NPN' | 'PNP';
  /** Whether sensor is detecting */
  detecting?: boolean;
}

/** Pilot lamp color */
export type PilotLampColor = 'red' | 'green' | 'yellow' | 'blue' | 'white';

/** Pilot lamp / indicator light block */
export interface PilotLampBlock extends BaseBlock<'pilot_lamp'> {
  /** Device designation (e.g., "H1", "P1") */
  designation: string;
  /** Lamp color */
  lampColor: PilotLampColor;
  /** Voltage rating */
  voltageRating: number;
  /** Whether lit */
  lit?: boolean;
}

/** Net label direction for visual indication */
export type NetLabelDirection = 'left' | 'right' | 'up' | 'down';

/** Net label block for virtual electrical connections */
export interface NetLabelBlock extends BaseBlock<'net_label'> {
  /** Net name (e.g., "+24V", "GND", "MOTOR_RUN") */
  netName: string;
  /** Visual direction of the label arrow */
  direction: NetLabelDirection;
  /** Optional description */
  description?: string;
}

// ============================================================================
// Additional Industrial Components
// ============================================================================

/** Transformer type */
export type TransformerType = 'power' | 'control' | 'isolation';

/** Transformer block (T) - power/control transformer */
export interface TransformerBlock extends BaseBlock<'transformer'> {
  /** Device designation (e.g., "T1") */
  designation: string;
  /** Transformer type */
  transformerType: TransformerType;
  /** Primary voltage */
  primaryVoltage: number;
  /** Secondary voltage */
  secondaryVoltage: number;
  /** Power rating in VA */
  powerVa: number;
}

/** Terminal block type */
export type TerminalType = 'feed_through' | 'ground' | 'fused' | 'disconnect';

/** Terminal block (X) - connection terminal */
export interface TerminalBlockType extends BaseBlock<'terminal_block'> {
  /** Device designation (e.g., "X1:1") */
  designation: string;
  /** Terminal type */
  terminalType: TerminalType;
  /** Wire size rating (mm²) */
  wireSizeMm2: number;
  /** Number of terminals in this block */
  terminalCount: number;
}

/** Overload relay class */
export type OverloadClass = '10' | '10A' | '20' | '30';

/** Overload relay block (F) - thermal/electronic overload */
export interface OverloadRelayBlock extends BaseBlock<'overload_relay'> {
  /** Device designation (e.g., "F1", "OL1") */
  designation: string;
  /** Overload class */
  overloadClass: OverloadClass;
  /** Current setting range min */
  currentMin: number;
  /** Current setting range max */
  currentMax: number;
  /** Whether tripped */
  tripped?: boolean;
}

/** Contactor type */
export type ContactorType = 'main' | 'auxiliary';

/** Contactor block (K) - higher current contactor distinct from relay */
export interface ContactorBlock extends BaseBlock<'contactor'> {
  /** Device designation (e.g., "KM1") */
  designation: string;
  /** Contactor type */
  contactorType: ContactorType;
  /** Coil voltage rating */
  coilVoltage: number;
  /** Power rating (AC3) in kW */
  powerRating: number;
  /** Main contact count */
  mainContacts: number;
  /** Auxiliary contact count */
  auxContacts: number;
  /** Whether energized */
  energized?: boolean;
}

/** Disconnect switch type */
export type DisconnectType = 'rotary' | 'knife' | 'fusible';

/** Disconnect switch block (Q) - main disconnect/isolator */
export interface DisconnectSwitchBlock extends BaseBlock<'disconnect_switch'> {
  /** Device designation (e.g., "Q1", "QS1") */
  designation: string;
  /** Disconnect type */
  disconnectType: DisconnectType;
  /** Number of poles */
  poles: 1 | 2 | 3 | 4;
  /** Current rating in Amps */
  currentRating: number;
  /** Whether switch is open (circuit broken) */
  open?: boolean;
}

/** Off-page connector direction */
export type OffPageConnectorDirection = 'outgoing' | 'incoming';

/** Off-page connector block - connects signals across schematic pages */
export interface OffPageConnectorBlock extends BaseBlock<'off_page_connector'> {
  /** Signal label (e.g., "MOTOR_RUN", "+24V") */
  signalLabel: string;
  /** Direction: outgoing = signal leaves this page, incoming = signal arrives */
  direction: OffPageConnectorDirection;
  /** Target page ID (set when cross-reference is established) */
  targetPageId?: string;
  /** Target page number for display */
  targetPageNumber?: number;
  /** Target page name for display */
  targetPageName?: string;
  /** Whether this connector is "dangling" (no paired connector on another page) */
  dangling?: boolean;
}

/** Discriminated union of all block types */
export type Block =
  | PowerSourceBlock
  | PlcOutBlock
  | PlcInBlock
  | LedBlock
  | ButtonBlock
  | ScopeBlock
  | TextBlock
  | RelayBlock
  | FuseBlock
  | MotorBlock
  | EmergencyStopBlock
  | SelectorSwitchBlock
  | SolenoidValveBlock
  | SensorBlock
  | PilotLampBlock
  | NetLabelBlock
  | TransformerBlock
  | TerminalBlockType
  | OverloadRelayBlock
  | ContactorBlock
  | DisconnectSwitchBlock
  | OffPageConnectorBlock
  | CustomSymbolBlock;

