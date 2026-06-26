import type { Position } from './geometry';
import type {
  CircuitState, ViewportState, YamlCircuitSchema, CircuitMetadata,
  SimulationState, SerializableCircuitState, YamlBlockDefinition,
} from './circuit';
import type { PortEndpoint, JunctionEndpoint, FloatingEndpoint } from './wires';
import { isPortEndpoint, isJunctionEndpoint } from './wires';
import type { RuntimeGridUnit } from '../canvasUnits';
import { SCREEN_PX_PER_MM, circuitStateToVersionedSerializable, ensureRuntimeGridUnit, normalizeSerializableCircuitState } from '../canvasUnits';

// ============================================================================
// V2 Canvas Infrastructure Types
// ============================================================================

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GridConfig {
  size: number;
  visible?: boolean;
  color?: string;
  alpha?: number;
  majorInterval?: number;
  majorColor?: string;
  majorAlpha?: number;
  subdivisions?: number;
  style?: 'dots' | 'lines';
  /** Physical unit for the `size` value. */
  unit?: RuntimeGridUnit;
}

export const DEFAULT_GRID: GridConfig = {
  size: 5,
  unit: 'mm',
  visible: true,
  color: '#cccccc',
  alpha: 0.3,
  majorInterval: 5,
  majorColor: '#999999',
  majorAlpha: 0.5,
  subdivisions: 5,
  style: 'dots',
};

export interface CanvasConfig {
  grid: GridConfig;
  minZoom?: number;
  maxZoom?: number;
  backgroundColor?: number;
}

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  grid: DEFAULT_GRID,
  minZoom: 0.01,
  maxZoom: 10,
  backgroundColor: 0xffffff,
};

export type LayerName =
  | 'grid'
  | 'sheet'
  | 'wires'
  | 'junctions'
  | 'blocks'
  | 'ports'
  | 'selection'
  | 'overlay'
  | 'debug';

export interface LayerConfig {
  name: LayerName;
  zIndex: number;
  visible?: boolean;
  interactive?: boolean;
}

export const DEFAULT_LAYERS: LayerConfig[] = [
  { name: 'grid', zIndex: 0 },
  { name: 'sheet', zIndex: 5, interactive: false },
  { name: 'wires', zIndex: 10 },
  { name: 'junctions', zIndex: 20 },
  { name: 'blocks', zIndex: 30 },
  { name: 'ports', zIndex: 40 },
  { name: 'selection', zIndex: 50 },
  { name: 'overlay', zIndex: 60 },
  { name: 'debug', zIndex: 100 },
];

export interface HitTestResult {
  type: 'block' | 'wire' | 'junction' | 'port' | 'segment' | 'none';
  id: string;
  position: Position;
  distance: number;
  blockId?: string;
  portId?: string;
  parentId?: string;
  subIndex?: number;
}

export type DirtyFlag =
  | 'blocks'
  | 'wires'
  | 'junctions'
  | 'selection'
  | 'viewport'
  | 'grid'
  | 'all';

// ============================================================================
// Unit Conversion Utilities
// ============================================================================

/** Pixels per mil (1 mil = 1/1000 inch, 1 inch ≈ 96 CSS px). */
const PX_PER_MIL = 96 / 1000;
/** Pixels per millimeter (1 mm = 96/25.4 CSS px ≈ 3.779). */
const PX_PER_MM = SCREEN_PX_PER_MM;

/**
 * Convert a value from a physical unit to canvas pixels.
 */
export function unitToPx(value: number, unit: 'px' | 'mil' | 'mm' = 'px'): number {
  switch (unit) {
    case 'mil':
      return value * PX_PER_MIL;
    case 'mm':
      return value * PX_PER_MM;
    default:
      return value;
  }
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
  const serializable = circuitStateToVersionedSerializable(state);
  if (!state.selection) {
    return serializable;
  }

  return {
    ...serializable,
    gridSize: undefined,
    showGrid: undefined,
    gridStyle: undefined,
    gridUnit: undefined,
  };
}

/** Convert serializable format to CircuitState */
export function serializableToCircuitState(
  data: SerializableCircuitState
): CircuitState {
  const normalized = normalizeSerializableCircuitState(data);
  return {
    components: new Map(Object.entries(normalized.components)),
    junctions: normalized.junctions ? new Map(Object.entries(normalized.junctions)) : new Map(),
    wires: normalized.wires,
    metadata: normalized.metadata,
    viewport: normalized.viewport,
    selectedIds: new Set(),
    gridSize: normalized.gridSize,
    showGrid: normalized.showGrid,
    gridStyle: normalized.gridStyle,
    gridUnit: ensureRuntimeGridUnit(normalized.gridUnit),
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
    wires: state.wires.map((wire) => ({
      id: wire.id,
      from: isPortEndpoint(wire.from)
        ? { component: (wire.from as PortEndpoint).componentId, port: (wire.from as PortEndpoint).portId }
        : isJunctionEndpoint(wire.from)
          ? { junction: (wire.from as JunctionEndpoint).junctionId }
          : { position: { x: (wire.from as FloatingEndpoint).position.x, y: (wire.from as FloatingEndpoint).position.y } },
      to: isPortEndpoint(wire.to)
        ? { component: (wire.to as PortEndpoint).componentId, port: (wire.to as PortEndpoint).portId }
        : isJunctionEndpoint(wire.to)
          ? { junction: (wire.to as JunctionEndpoint).junctionId }
          : { position: { x: (wire.to as FloatingEndpoint).position.x, y: (wire.to as FloatingEndpoint).position.y } },
      color: wire.color,
    })),
  };
}


