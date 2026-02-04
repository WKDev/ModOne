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
  | 'scope';

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
  /** Whether block is selected */
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

/** Discriminated union of all block types */
export type Block =
  | PowerSourceBlock
  | PlcOutBlock
  | PlcInBlock
  | LedBlock
  | ButtonBlock
  | ScopeBlock;

// ============================================================================
// Junction (wire-level concept)
// ============================================================================

/** Junction point for wire branching (not a Block) */
export interface Junction {
  /** Unique identifier */
  id: string;
  /** Position on canvas (center-based) */
  position: Position;
  /** Whether junction is selected */
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
  /** Whether wire is selected */
  selected?: boolean;
  /** Optional wire color */
  color?: string;
  /** Control points for wire routing */
  handles?: WireHandle[];
  /** Direction wire exits from source port (user-specified via drag direction) */
  fromExitDirection?: PortPosition;
  /** Direction wire enters target port (user-specified via drag direction) */
  toExitDirection?: PortPosition;
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
    'powersource',
    'plc_out',
    'plc_in',
    'led',
    'button',
    'scope',
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
