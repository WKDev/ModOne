import type { Block } from './blocks';
import type { Wire, Junction } from './wires';
import type { SelectionState } from './selection';
import type { LegacyBlockType } from './geometry';
import type { BlockType } from '../../../types/circuit';
import type { RuntimeGridUnit, SerializableGridUnit } from '../canvasUnits';

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
  gridSize?: number;
  showGrid?: boolean;
  gridStyle?: 'dots' | 'lines';
  gridUnit?: RuntimeGridUnit;
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
  version?: string;
  components: Record<string, Block>;
  junctions?: Record<string, Junction>;
  wires: Wire[];
  metadata: CircuitMetadata;
  viewport?: ViewportState;
  gridSize?: number;
  showGrid?: boolean;
  gridStyle?: 'dots' | 'lines';
  gridUnit?: SerializableGridUnit;
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

/** YAML wire endpoint (port, junction, or floating position) */
export interface YamlWireEndpoint {
  component?: string;
  port?: string;
  junction?: string;
  position?: { x: number; y: number };
}

/** YAML wire definition */
export interface YamlWireDefinition {
  id: string;
  from: YamlWireEndpoint;
  to: YamlWireEndpoint;
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

