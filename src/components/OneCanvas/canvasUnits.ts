import type {
  Block,
  CircuitState,
  Port,
  Position,
  SerializableCircuitState,
  Size,
  Wire,
  WireEndpoint,
} from './types';

export type RuntimeGridUnit = 'mm' | 'mil';
export type SerializableGridUnit = RuntimeGridUnit | 'px';

export const GRID_VERSION = '2.0';
export const MM_PER_MIL = 0.0254;
export const LEGACY_MM_PER_PX = 0.25;
export const LEGACY_PX_PER_MM = 1 / LEGACY_MM_PER_PX;
export const GRID_MODULE_MM = 5;
export const SCREEN_PX_PER_MM = 96 / 25.4;

/**
 * Scale factor for converting symbol pixel definitions to mm world coordinates.
 * Symbol graphics are authored in pixel units; this factor controls how large
 * they appear on the canvas relative to the grid (GRID_MODULE_MM = 5mm).
 *
 * 0.5 → a 40px symbol spans 20mm (4 grid cells).
 */
export const SYMBOL_PX_TO_MM = 0.5;

function roundToPrecision(value: number, digits: number = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function isLegacyCircuitVersion(version?: string): boolean {
  if (!version) return true;
  const parsed = Number.parseFloat(version);
  return Number.isNaN(parsed) || parsed < 2;
}

export function isLegacyGridUnit(unit?: SerializableGridUnit): unit is 'px' {
  return unit === 'px';
}

export function ensureRuntimeGridUnit(unit?: SerializableGridUnit): RuntimeGridUnit {
  return unit === 'mil' ? 'mil' : 'mm';
}

export function legacyPxToMm(value: number): number {
  return roundToPrecision(value * LEGACY_MM_PER_PX);
}

export function mmToLegacyPx(value: number): number {
  return roundToPrecision(value * LEGACY_PX_PER_MM);
}

export function milToMm(value: number): number {
  return roundToPrecision(value * MM_PER_MIL);
}

export function mmToMil(value: number): number {
  return roundToPrecision(value / MM_PER_MIL);
}

export function normalizeToGridModuleMm(value: number): number {
  if (value === 0) return 0;
  return roundToPrecision(Math.round(value / GRID_MODULE_MM) * GRID_MODULE_MM);
}

export function normalizeLegacyValueToMm(value: number): number {
  return normalizeToGridModuleMm(legacyPxToMm(value));
}

export function symbolPxToMm(value: number): number {
  return roundToPrecision(value * SYMBOL_PX_TO_MM);
}

export function normalizeSymbolValueToMm(value: number): number {
  return normalizeToGridModuleMm(symbolPxToMm(value));
}

export function normalizeRuntimePosition(position: Position): Position {
  return {
    x: roundToPrecision(position.x),
    y: roundToPrecision(position.y),
  };
}

export function normalizeLegacyPositionToMm(position: Position): Position {
  return {
    x: normalizeLegacyValueToMm(position.x),
    y: normalizeLegacyValueToMm(position.y),
  };
}

export function normalizeLegacySizeToMm(size: Size): Size {
  return {
    width: normalizeLegacyValueToMm(size.width),
    height: normalizeLegacyValueToMm(size.height),
  };
}

export function normalizeSymbolSizeToMm(size: Size): Size {
  return {
    width: normalizeSymbolValueToMm(size.width),
    height: normalizeSymbolValueToMm(size.height),
  };
}

export function normalizeSymbolPortToMm(port: Port): Port {
  return {
    ...port,
    absolutePosition: port.absolutePosition
      ? {
          x: symbolPxToMm(port.absolutePosition.x),
          y: symbolPxToMm(port.absolutePosition.y),
        }
      : undefined,
  };
}

export function normalizeRuntimeSize(size: Size): Size {
  return {
    width: roundToPrecision(size.width),
    height: roundToPrecision(size.height),
  };
}

export function normalizeLegacyPortToMm(port: Port): Port {
  return {
    ...port,
    absolutePosition: port.absolutePosition
      ? normalizeLegacyPositionToMm(port.absolutePosition)
      : undefined,
  };
}

export function normalizeRuntimePort(port: Port): Port {
  return {
    ...port,
    absolutePosition: port.absolutePosition
      ? normalizeRuntimePosition(port.absolutePosition)
      : undefined,
  };
}

function normalizeWireEndpoint(
  endpoint: WireEndpoint,
  legacy: boolean,
): WireEndpoint {
  if ('position' in endpoint && endpoint.position) {
    return {
      ...endpoint,
      position: legacy
        ? normalizeLegacyPositionToMm(endpoint.position)
        : normalizeRuntimePosition(endpoint.position),
    };
  }

  return { ...endpoint };
}

function normalizeWire(wire: Wire, legacy: boolean): Wire {
  return {
    ...wire,
    from: normalizeWireEndpoint(wire.from, legacy),
    to: normalizeWireEndpoint(wire.to, legacy),
    handles: wire.handles?.map((handle) => ({
      ...handle,
      position: legacy
        ? normalizeLegacyPositionToMm(handle.position)
        : normalizeRuntimePosition(handle.position),
    })),
  };
}

function normalizeBlock(block: Block, legacy: boolean): Block {
  return {
    ...block,
    position: legacy
      ? normalizeLegacyPositionToMm(block.position)
      : normalizeRuntimePosition(block.position),
    size: legacy
      ? normalizeLegacySizeToMm(block.size)
      : normalizeRuntimeSize(block.size),
    ports: block.ports.map((port) => (
      legacy ? normalizeLegacyPortToMm(port) : normalizeRuntimePort(port)
    )),
  };
}

export function normalizeGridSizeForRuntime(
  size: number | undefined,
  unit: SerializableGridUnit | undefined,
): { gridSize: number; gridUnit: RuntimeGridUnit } {
  if (typeof size !== 'number' || Number.isNaN(size) || size <= 0) {
    return {
      gridSize: GRID_MODULE_MM,
      gridUnit: 'mm',
    };
  }

  if (unit === 'px') {
    return {
      gridSize: normalizeLegacyValueToMm(size),
      gridUnit: 'mm',
    };
  }

  return {
    gridSize: roundToPrecision(size),
    gridUnit: ensureRuntimeGridUnit(unit),
  };
}

export function getGridStepMm(
  gridSize: number | undefined,
  gridUnit: SerializableGridUnit | undefined,
): number {
  if (typeof gridSize !== 'number' || Number.isNaN(gridSize) || gridSize <= 0) {
    return GRID_MODULE_MM;
  }

  switch (gridUnit) {
    case 'mil':
      return milToMm(gridSize);
    case 'px':
      return normalizeLegacyValueToMm(gridSize);
    case 'mm':
    default:
      return roundToPrecision(gridSize);
  }
}

export function mmToScreenPx(valueMm: number, zoom: number = 1): number {
  return roundToPrecision(valueMm * SCREEN_PX_PER_MM * zoom);
}

export function screenPxToMm(valuePx: number, zoom: number = 1): number {
  const safeZoom = zoom === 0 ? 1 : zoom;
  return roundToPrecision(valuePx / (SCREEN_PX_PER_MM * safeZoom));
}

export function normalizeSerializableCircuitState(
  data: SerializableCircuitState,
): SerializableCircuitState {
  const legacy = isLegacyCircuitVersion(data.version) || isLegacyGridUnit(data.gridUnit);
  const { gridSize, gridUnit } = normalizeGridSizeForRuntime(
    data.gridSize,
    data.gridUnit,
  );

  return {
    ...data,
    version: GRID_VERSION,
    components: Object.fromEntries(
      Object.entries(data.components).map(([id, block]) => [id, normalizeBlock(block, legacy)]),
    ),
    junctions: data.junctions
      ? Object.fromEntries(
          Object.entries(data.junctions).map(([id, junction]) => [
            id,
            {
              ...junction,
              position: legacy
                ? normalizeLegacyPositionToMm(junction.position)
                : normalizeRuntimePosition(junction.position),
            },
          ]),
        )
      : undefined,
    wires: data.wires.map((wire) => normalizeWire(wire, legacy)),
    metadata: {
      ...data.metadata,
      version: GRID_VERSION,
    },
    viewport: data.viewport
      ? {
          ...data.viewport,
          panX: legacy
            ? normalizeLegacyValueToMm(data.viewport.panX)
            : roundToPrecision(data.viewport.panX),
          panY: legacy
            ? normalizeLegacyValueToMm(data.viewport.panY)
            : roundToPrecision(data.viewport.panY),
        }
      : undefined,
    gridSize,
    showGrid: data.showGrid ?? true,
    gridStyle: data.gridStyle ?? 'dots',
    gridUnit,
  };
}

export function circuitStateToVersionedSerializable(
  state: CircuitState,
): SerializableCircuitState {
  const normalizedGrid = normalizeGridSizeForRuntime(state.gridSize, state.gridUnit);

  return {
    version: GRID_VERSION,
    components: Object.fromEntries(
      Array.from(state.components.entries()).map(([id, block]) => [
        id,
        normalizeBlock(block, false),
      ]),
    ),
    junctions: state.junctions.size > 0
      ? Object.fromEntries(
          Array.from(state.junctions.entries()).map(([id, junction]) => [
            id,
            {
              ...junction,
              position: normalizeRuntimePosition(junction.position),
            },
          ]),
        )
      : undefined,
    wires: state.wires.map((wire) => normalizeWire(wire, false)),
    metadata: {
      ...state.metadata,
      version: GRID_VERSION,
    },
    viewport: state.viewport
      ? {
          ...state.viewport,
          panX: roundToPrecision(state.viewport.panX),
          panY: roundToPrecision(state.viewport.panY),
        }
      : undefined,
    gridSize: normalizedGrid.gridSize,
    showGrid: state.showGrid,
    gridStyle: state.gridStyle,
    gridUnit: normalizedGrid.gridUnit,
  };
}
