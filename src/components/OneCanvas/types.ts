/**
 * OneCanvas Type Definitions
 *
 * Types for circuit simulation canvas including blocks, wires, ports,
 * simulation state, and YAML serialization schema.
 */

// ============================================================================
// Block Types
// ============================================================================

/** Available block types in the canvas */
export type BlockType =
  | 'powersource'
  | 'plc_out'
  | 'plc_in'
  | 'led'
  | 'button'
  | 'scope'
  | 'text'
  | 'relay'
  | 'fuse'
  | 'motor'
  | 'emergency_stop'
  | 'selector_switch'
  | 'solenoid_valve'
  | 'sensor'
  | 'pilot_lamp'
  | 'net_label'
  | 'transformer'
  | 'terminal_block'
  | 'overload_relay'
  | 'contactor'
  | 'disconnect_switch'
  | 'off_page_connector';

/** Legacy block types (for migration) */
export type LegacyBlockType = 'power_24v' | 'power_12v' | 'gnd';

/** Polarity for power source blocks */
export type PowerPolarity = 'positive' | 'negative' | 'ground';

/** Position in canvas coordinates */
export interface Position {
  x: number;
  y: number;
}

/**
 * Screen Space Position (viewport/screen pixel coordinates)
 * - Direct mouse event coordinates
 * - Affected by zoom/pan
 */
export interface ScreenPosition {
  readonly _brand: 'ScreenPosition';
  x: number;
  y: number;
}

/**
 * Container Space Position (컨테이너 기준 상대 좌표)
 * - getBoundingClientRect 기준
 * - zoom/pan 영향 없음
 */
export interface ContainerPosition {
  readonly _brand: 'ContainerPosition';
  x: number;
  y: number;
}

/**
 * Canvas Space Position (논리적 캔버스 좌표)
 * - Block, Wire 등의 실제 위치
 * - zoom/pan 독립적
 */
export interface CanvasPosition {
  readonly _brand: 'CanvasPosition';
  x: number;
  y: number;
}

// Helper functions for type conversion
export function toScreenPos(pos: Position): ScreenPosition {
  return { ...pos, _brand: 'ScreenPosition' as const };
}

export function toContainerPos(pos: Position): ContainerPosition {
  return { ...pos, _brand: 'ContainerPosition' as const };
}

export function toCanvasPos(pos: Position): CanvasPosition {
  return { ...pos, _brand: 'CanvasPosition' as const };
}

/** Size of a block */
export interface Size {
  width: number;
  height: number;
}

// ============================================================================
// Selection Types
// ============================================================================

/** Type of selectable items on canvas */
export type SelectableType = 'block' | 'wire' | 'junction';

/** A selected item with its type */
export interface Selection {
  type: SelectableType;
  id: string;
}

/** Typed selection state (plain object, works with Zustand immer) */
export interface SelectionState {
  /** Map of selected items by ID */
  items: Map<string, Selection>;
}

/** Create a new empty selection state */
export function createSelectionState(selections: Selection[] = []): SelectionState {
  return {
    items: new Map(selections.map(s => [s.id, s])),
  };
}

/** Get all selected block IDs */
export function getSelectedBlocks(state: SelectionState): string[] {
  return Array.from(state.items.values())
    .filter(s => s.type === 'block')
    .map(s => s.id);
}

/** Get all selected wire IDs */
export function getSelectedWires(state: SelectionState): string[] {
  return Array.from(state.items.values())
    .filter(s => s.type === 'wire')
    .map(s => s.id);
}

/** Get all selected junction IDs */
export function getSelectedJunctions(state: SelectionState): string[] {
  return Array.from(state.items.values())
    .filter(s => s.type === 'junction')
    .map(s => s.id);
}

/** Get all selected items */
export function getAllSelections(state: SelectionState): Selection[] {
  return Array.from(state.items.values());
}

/** Get all selected IDs (regardless of type) */
export function getAllSelectedIds(state: SelectionState): string[] {
  return Array.from(state.items.keys());
}

/** Check if an item is selected */
export function isSelected(state: SelectionState, id: string): boolean {
  return state.items.has(id);
}

/** Check if selection is empty */
export function isSelectionEmpty(state: SelectionState): boolean {
  return state.items.size === 0;
}

/** Get number of selected items */
export function getSelectionSize(state: SelectionState): number {
  return state.items.size;
}

/** Add an item to selection (immutable) */
export function addToSelectionState(state: SelectionState, selection: Selection): SelectionState {
  const newItems = new Map(state.items);
  newItems.set(selection.id, selection);
  return { items: newItems };
}

/** Remove an item from selection (immutable) */
export function removeFromSelectionState(state: SelectionState, id: string): SelectionState {
  const newItems = new Map(state.items);
  newItems.delete(id);
  return { items: newItems };
}

/** Toggle an item in selection (immutable) */
export function toggleInSelectionState(state: SelectionState, selection: Selection): SelectionState {
  if (isSelected(state, selection.id)) {
    return removeFromSelectionState(state, selection.id);
  } else {
    return addToSelectionState(state, selection);
  }
}

/** Clear all selections (immutable) */
export function clearSelectionState(): SelectionState {
  return { items: new Map() };
}

/** Convert selection state to plain array for serialization */
export function selectionStateToArray(state: SelectionState): Selection[] {
  return getAllSelections(state);
}

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
}

// ============================================================================
// Specialized Block Types
// ============================================================================

/** Unified power source block (replaces Power24v, Power12v, Gnd) */
export interface PowerSourceBlock extends BaseBlock<'powersource'> {
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
  | OffPageConnectorBlock;

// ============================================================================
// Junction (wire-level concept)
// ============================================================================

/** Junction point for wire branching (not a Block) */
export interface Junction {
  /** Unique identifier */
  id: string;
  /** Position on canvas (center-based) */
  position: Position;
  /**
   * @deprecated Rendering-layer selection flag. Do NOT use as the authoritative source
   * of truth for selection state. The canonical selection state is in
   * `useCanvasFacade().selectedIds` (a Set<string>). This field is synchronized
   * from selectedIds during render and is used by CanvasContent.tsx for
   * junction rendering. Modifying this directly will cause state drift.
   */
  selected?: boolean;
}

// ============================================================================
// Wire Types
// ============================================================================

/** Wire endpoint connected to a block port */
export interface PortEndpoint {
  /** ID of the component block */
  componentId: string;
  /** ID of the port on the component */
  portId: string;
}

/** Wire endpoint connected to a junction */
export interface JunctionEndpoint {
  /** ID of the junction */
  junctionId: string;
}

/** Endpoint of a wire connection (discriminated union) */
export type WireEndpoint = PortEndpoint | JunctionEndpoint;

/** Type guard: check if endpoint connects to a block port */
export function isPortEndpoint(ep: WireEndpoint): ep is PortEndpoint {
  return 'componentId' in ep;
}

/** Type guard: check if endpoint connects to a junction */
export function isJunctionEndpoint(ep: WireEndpoint): ep is JunctionEndpoint {
  return 'junctionId' in ep;
}

/** Legacy endpoint format (for backward compatibility during migration) */
export interface LegacyWireEndpoint {
  componentId: string;
  portId: string;
}

/** Wire handle constraint direction */
export type HandleConstraint = 'horizontal' | 'vertical' | 'free';

/** Wire control point with constraint and source info */
export interface WireHandle {
  /** Stable identifier for history-friendly handle tracking */
  id?: string;
  /** Handle position */
  position: Position;
  /** Movement constraint */
  constraint: HandleConstraint;
  /** Whether auto-generated or user-placed */
  source: 'auto' | 'user';
}

/** Wire connection between two ports */
export interface Wire {
  /** Unique identifier */
  id: string;
  /** Source endpoint */
  from: WireEndpoint;
  /** Destination endpoint */
  to: WireEndpoint;
  /**
   * @deprecated Rendering-layer selection flag. Do NOT use as the authoritative source
   * of truth for selection state. The canonical selection state is in
   * `useCanvasFacade().selectedIds` (a Set<string>). This field is synchronized
   * from selectedIds during render and is used by CanvasContent.tsx for
   * junction rendering. Modifying this directly will cause state drift.
   */
  selected?: boolean;
  /** Optional wire color */
  color?: string;
  /** Control points for wire routing */
  handles?: WireHandle[];
  /** Direction wire exits from source port (user-specified via drag direction) */
  fromExitDirection?: PortPosition;
  /** Direction wire enters target port (user-specified via drag direction) */
  toExitDirection?: PortPosition;
  /** Wire label (display name, e.g., "L1", "N", "PE", "101") */
  label?: string;
  /** IEC 60204-1 wire number for documentation */
  wireNumber?: string;
  /** Routing mode: 'auto' = fully recalculated on block move, 'manual' = user-controlled handles */
  routingMode?: 'auto' | 'manual';
}

// ============================================================================
// Polyline & Geometry API (used by wire simplifier + rubber-band)
// ============================================================================

/** Ordered positions forming an orthogonal polyline (exit point → handles → exit point) */
export type Poly = readonly Position[];

/** Geometry API for resolving wire endpoint positions */
export interface GeomApi {
  components: Map<string, Block>;
  junctions: Map<string, Junction>;
}

// ============================================================================
// Wire Geometry Types (for DOM-free selection)
// ============================================================================

/** Bounding box for quick collision rejection */
export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Pre-computed geometry for a wire (no DOM dependency) */
export interface WireGeometry {
  /** Wire identifier */
  wireId: string;
  /** Bounding box for quick rejection tests */
  bounds: BoundingBox;
  /** Sampled points along the Bezier curve */
  samples: Position[];
  /** Line segments connecting sampled points */
  segments: Array<{ start: Position; end: Position }>;
}

// ============================================================================
// Circuit State
// ============================================================================

/** Circuit metadata */
export interface CircuitMetadata {
  /** Circuit name */
  name: string;
  /** Description */
  description: string;
  /** Tags for categorization */
  tags: string[];
  /** Author name */
  author?: string;
  /** Creation date (ISO string) */
  createdAt?: string;
  /** Last modified date (ISO string) */
  modifiedAt?: string;
  /** Schema version */
  version?: string;
}

/** Complete circuit state */
export interface CircuitState {
  /** All component blocks by ID */
  components: Map<string, Block>;
  /** All junction points by ID */
  junctions: Map<string, Junction>;
  /** All wire connections */
  wires: Wire[];
  /** Circuit metadata */
  metadata: CircuitMetadata;
  /** Currently selected component/wire IDs */
  selectedIds?: Set<string>;
  /** Typed selection state */
  selection?: SelectionState;
  /** Viewport state */
  viewport?: ViewportState;
}

/** Viewport (pan/zoom) state */
export interface ViewportState {
  /** Zoom level (1.0 = 100%) */
  zoom: number;
  /** Pan X offset */
  panX: number;
  /** Pan Y offset */
  panY: number;
}

/** Serializable version of CircuitState (for JSON) */
export interface SerializableCircuitState {
  components: Record<string, Block>;
  junctions?: Record<string, Junction>;
  wires: Wire[];
  metadata: CircuitMetadata;
  viewport?: ViewportState;
}

// ============================================================================
// Simulation State
// ============================================================================

/** Runtime simulation state */
export interface SimulationState {
  /** Whether simulation is running */
  running: boolean;
  /** Whether simulation is paused */
  paused?: boolean;
  /** Step-by-step mode */
  stepMode?: boolean;
  /** Voltage at each port (portId -> voltage in volts) */
  voltages: Map<string, number>;
  /** Current through each wire (wireId -> current in amps) */
  currents: Map<string, number>;
  /** Complete current paths (arrays of connected port IDs) */
  currentPaths: string[][];
  /** Current simulation time in ms */
  simulationTime: number;
  /** Simulation ticks per second */
  tickRate: number;
}

/** Serializable simulation state */
export interface SerializableSimulationState {
  running: boolean;
  paused?: boolean;
  voltages: Record<string, number>;
  currents: Record<string, number>;
  currentPaths: string[][];
  simulationTime: number;
}

// ============================================================================
// YAML Schema Types
// ============================================================================

/** YAML block definition */
export interface YamlBlockDefinition {
  id: string;
  type: BlockType | LegacyBlockType;
  position: { x: number; y: number };
  label?: string;
  properties?: Record<string, unknown>;
  ports?: Array<{
    id: string;
    type: string;
    label: string;
    position: string;
  }>;
}

/** YAML wire definition */
export interface YamlWireDefinition {
  id: string;
  from: { component: string; port: string };
  to: { component: string; port: string };
  color?: string;
}

/** Complete YAML circuit schema */
export interface YamlCircuitSchema {
  /** Schema version for migrations */
  version: string;
  /** Circuit metadata */
  metadata: {
    name: string;
    description: string;
    tags: string[];
    created?: string;
    modified?: string;
  };
  /** Component blocks */
  components: YamlBlockDefinition[];
  /** Wire connections */
  wires: YamlWireDefinition[];
}

// ============================================================================
// Type Guards
// ============================================================================

/** Check if a string is a valid BlockType */
export function isValidBlockType(type: string): type is BlockType {
  return [
    'powersource', 'plc_out', 'plc_in', 'led', 'button', 'scope', 'text',
    'relay', 'fuse', 'motor', 'emergency_stop', 'selector_switch',
    'solenoid_valve', 'sensor', 'pilot_lamp', 'net_label',
    'transformer', 'terminal_block', 'overload_relay', 'contactor',
    'disconnect_switch', 'off_page_connector',
  ].includes(type);
}

/** Check if a string is a legacy block type that can be migrated */
export function isLegacyBlockType(type: string): type is LegacyBlockType {
  return ['power_24v', 'power_12v', 'gnd'].includes(type);
}

/** Check if a block is a power source */
export function isPowerSource(block: Block): block is PowerSourceBlock {
  return block.type === 'powersource';
}

/**
 * Migrate a legacy block type to powersource properties.
 * Returns null if type is not a legacy type.
 */
export function migrateLegacyBlockType(type: string): { voltage: number; polarity: PowerPolarity; label: string } | null {
  switch (type) {
    case 'power_24v':
      return { voltage: 24, polarity: 'positive', label: '+24V' };
    case 'power_12v':
      return { voltage: 12, polarity: 'positive', label: '+12V' };
    case 'gnd':
      return { voltage: 0, polarity: 'ground', label: 'GND' };
    default:
      return null;
  }
}

/** Check if a block is a PLC I/O block */
export function isPlcBlock(block: Block): block is PlcOutBlock | PlcInBlock {
  return block.type === 'plc_out' || block.type === 'plc_in';
}

/** Check if a block is interactive (can be clicked/toggled) */
export function isInteractiveBlock(
  block: Block
): block is ButtonBlock | LedBlock {
  return block.type === 'button' || block.type === 'led';
}

/** Check if a block is a non-electrical annotation (excluded from simulation) */
export function isAnnotationBlock(block: Block): block is TextBlock {
  return block.type === 'text';
}

// ============================================================================
// Default Values
// ============================================================================

/** Default viewport state */
export const DEFAULT_VIEWPORT: ViewportState = {
  zoom: 1.0,
  panX: 0,
  panY: 0,
};

/** Default circuit metadata */
export const DEFAULT_METADATA: CircuitMetadata = {
  name: 'Untitled Circuit',
  description: '',
  tags: [],
};

/** Default simulation state */
export const DEFAULT_SIMULATION_STATE: SimulationState = {
  running: false,
  paused: false,
  stepMode: false,
  voltages: new Map(),
  currents: new Map(),
  currentPaths: [],
  simulationTime: 0,
  tickRate: 60,
};

// ============================================================================
// Conversion Utilities
// ============================================================================

/** Convert CircuitState to serializable format */
export function circuitStateToSerializable(
  state: CircuitState
): SerializableCircuitState {
  return {
    components: Object.fromEntries(state.components),
    junctions: state.junctions.size > 0 ? Object.fromEntries(state.junctions) : undefined,
    wires: state.wires,
    metadata: state.metadata,
    viewport: state.viewport,
  };
}

/** Convert serializable format to CircuitState */
export function serializableToCircuitState(
  data: SerializableCircuitState
): CircuitState {
  return {
    components: new Map(Object.entries(data.components)),
    junctions: data.junctions ? new Map(Object.entries(data.junctions)) : new Map(),
    wires: data.wires,
    metadata: data.metadata,
    viewport: data.viewport,
    selectedIds: new Set(),
  };
}

/** Convert CircuitState to YAML schema */
export function circuitStateToYaml(state: CircuitState): YamlCircuitSchema {
  const components: YamlBlockDefinition[] = [];

  for (const [, block] of state.components) {
    const { id, type, position, label, ports, size, ...properties } = block;
    components.push({
      id,
      type,
      position,
      label,
      properties: Object.keys(properties).length > 0 ? properties : undefined,
      ports: ports.length > 0 ? ports : undefined,
    });
  }

  return {
    version: '1.0',
    metadata: {
      name: state.metadata.name,
      description: state.metadata.description,
      tags: state.metadata.tags,
      created: state.metadata.createdAt,
      modified: state.metadata.modifiedAt,
    },
    components,
    wires: state.wires
      .filter((wire) => isPortEndpoint(wire.from) && isPortEndpoint(wire.to))
      .map((wire) => ({
        id: wire.id,
        from: { component: (wire.from as PortEndpoint).componentId, port: (wire.from as PortEndpoint).portId },
        to: { component: (wire.to as PortEndpoint).componentId, port: (wire.to as PortEndpoint).portId },
        color: wire.color,
      })),
  };
}
