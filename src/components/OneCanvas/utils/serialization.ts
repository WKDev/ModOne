/**
 * Circuit YAML Serialization Utilities
 *
 * Functions to convert circuit state to/from YAML format for file storage.
 */

import * as yaml from 'yaml';
import type {
  Block,
  BlockType,
  Wire,
  WireEndpoint,
  Port,
  PortType as PortTypeEnum,
  PortPosition,
  CircuitState,
  CircuitMetadata,
  YamlCircuitSchema,
  YamlBlockDefinition,
  YamlWireDefinition,
  YamlWireEndpoint,
  } from '../types';
import type { ComponentInstance, Port as CircuitPort } from '../../../types/circuit';
import { isValidBlockType, isLegacyBlockType, isPortEndpoint, isJunctionEndpoint, isFloatingEndpoint, migrateLegacyBlockType } from '../types';
import { createSelectionState } from '../types';
import { getBlockSize, getPowerSourcePorts } from '../blockDefinitions';
import { getBuiltinSymbolForBlockType } from '@/assets/builtin-symbols';
import type { SymbolPin } from '@/types/symbol';

// ============================================================================
// Serialization (CircuitState -> YAML String)
// ============================================================================

/**
 * Convert a Block to YAML format.
 */
function blockToYaml(block: Block): YamlBlockDefinition {
  const { id, type, position, label, ports, size, ...properties } = block;

  // Filter out undefined/null properties and runtime state
  const cleanProperties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (key !== 'selected' && value !== undefined && value !== null) {
      cleanProperties[key] = value;
    }
  }

  return {
    id,
    type,
    position: { x: position.x, y: position.y },
    label,
    properties: Object.keys(cleanProperties).length > 0 ? cleanProperties : undefined,
    ports: ports.length > 0
      ? ports.map((p) => ({
          id: p.id,
          type: p.type,
          label: p.label,
          position: p.position,
          ...(p.offset !== undefined ? { offset: p.offset } : {}),
          ...(p.absolutePosition ? { absolutePosition: p.absolutePosition } : {}),
        }))
      : undefined,
  };
}


/**
 * Convert a WireEndpoint to YAML format.
 */
function endpointToYaml(endpoint: WireEndpoint): YamlWireEndpoint | null {
  if (isPortEndpoint(endpoint)) {
    return { component: endpoint.componentId, port: endpoint.portId };
  }
  if (isJunctionEndpoint(endpoint)) {
    return { junction: endpoint.junctionId };
  }
  if (isFloatingEndpoint(endpoint)) {
    return { position: { x: endpoint.position.x, y: endpoint.position.y } };
  }
  return null;
}

/**
 * Convert a Wire to YAML format.
 */
function wireToYaml(wire: Wire): YamlWireDefinition | null {
  const from = endpointToYaml(wire.from);
  const to = endpointToYaml(wire.to);
  if (!from || !to) return null;
  return {
    id: wire.id,
    from,
    to,
    ...(wire.color ? { color: wire.color } : {}),
  };
}

/**
 * Convert CircuitState to YAML schema object.
 */
export function circuitToYamlSchema(state: CircuitState): YamlCircuitSchema {
  const components: YamlBlockDefinition[] = [];

  for (const [, block] of state.components) {
    components.push(blockToYaml(block));
  }

  return {
    version: '1.1',
    metadata: {
      name: state.metadata.name,
      description: state.metadata.description,
      tags: state.metadata.tags,
      created: state.metadata.createdAt,
      modified: new Date().toISOString(),
    },
    components,
    wires: state.wires.map(wireToYaml).filter((w): w is YamlWireDefinition => w !== null),
  };
}

/**
 * Serialize CircuitState to YAML string.
 */
export function circuitToYaml(state: CircuitState): string {
  const schema = circuitToYamlSchema(state);
  return yaml.stringify(schema, {
    indent: 2,
    lineWidth: 120,
    minContentWidth: 0,
  });
}

// ============================================================================
// Deserialization (YAML String -> CircuitState)
// ============================================================================

/**
 * Validation error with context.
 */
export class CircuitValidationError extends Error {
  constructor(message: string, public readonly path?: string) {
    super(path ? `${message} at ${path}` : message);
    this.name = 'CircuitValidationError';
  }
}

/**
 * Validate that a value is a non-null object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate the YAML schema structure.
 */
function validateCircuitYaml(data: unknown): YamlCircuitSchema {
  if (!isObject(data)) {
    throw new CircuitValidationError('Circuit data must be an object');
  }

  // Validate version
  if (typeof data.version !== 'string') {
    throw new CircuitValidationError('Missing or invalid version field');
  }

  // Validate metadata
  if (!isObject(data.metadata)) {
    throw new CircuitValidationError('Missing or invalid metadata field');
  }

  const metadata = data.metadata as Record<string, unknown>;
  if (typeof metadata.name !== 'string') {
    throw new CircuitValidationError('Missing or invalid metadata.name');
  }

  // Validate components array
  if (!Array.isArray(data.components)) {
    throw new CircuitValidationError('Missing or invalid components field');
  }

  // Validate wires array
  if (!Array.isArray(data.wires)) {
    throw new CircuitValidationError('Missing or invalid wires field');
  }

  // Validate each component
  const componentIds = new Set<string>();
  for (let i = 0; i < data.components.length; i++) {
    const comp = data.components[i];
    if (!isObject(comp)) {
      throw new CircuitValidationError(`Invalid component at index ${i}`);
    }

    if (typeof comp.id !== 'string' || !comp.id) {
      throw new CircuitValidationError(`Missing or invalid component id`, `components[${i}]`);
    }

    if (componentIds.has(comp.id)) {
      throw new CircuitValidationError(`Duplicate component id: ${comp.id}`, `components[${i}]`);
    }
    componentIds.add(comp.id);

    if (typeof comp.type !== 'string' || (!isValidBlockType(comp.type) && !isLegacyBlockType(comp.type))) {
      throw new CircuitValidationError(
        `Invalid component type: ${comp.type}`,
        `components[${i}]`
      );
    }

    if (!isObject(comp.position)) {
      throw new CircuitValidationError(`Missing or invalid position`, `components[${i}]`);
    }
  }

  // Validate each wire
  for (let i = 0; i < data.wires.length; i++) {
    const wire = data.wires[i];
    if (!isObject(wire)) {
      throw new CircuitValidationError(`Invalid wire at index ${i}`);
    }

    if (typeof wire.id !== 'string' || !wire.id) {
      throw new CircuitValidationError(`Missing or invalid wire id`, `wires[${i}]`);
    }

    if (!isObject(wire.from)) {
      throw new CircuitValidationError(`Invalid wire 'from' endpoint`, `wires[${i}]`);
    }

    if (!isObject(wire.to)) {
      throw new CircuitValidationError(`Invalid wire 'to' endpoint`, `wires[${i}]`);
    }

    // Validate port endpoints reference existing components (floating/junction endpoints are always valid)
    const fromEp = wire.from as Record<string, unknown>;
    const toEp = wire.to as Record<string, unknown>;

    if (typeof fromEp.component === 'string' && !componentIds.has(fromEp.component)) {
      throw new CircuitValidationError(
        `Wire references non-existent component: ${fromEp.component}`,
        `wires[${i}].from`
      );
    }

    if (typeof toEp.component === 'string' && !componentIds.has(toEp.component)) {
      throw new CircuitValidationError(
        `Wire references non-existent component: ${toEp.component}`,
        `wires[${i}].to`
      );
    }
  }

  return data as unknown as YamlCircuitSchema;
}

/**
 * Convert YAML port to Port type.
 */
function yamlToPort(yamlPort: { id: string; type: string; label: string; position: string; offset?: number; absolutePosition?: { x: number; y: number } }): Port {
  return {
    id: yamlPort.id,
    type: yamlPort.type as PortTypeEnum,
    label: yamlPort.label,
    position: yamlPort.position as PortPosition,
    offset: yamlPort.offset,
    absolutePosition: yamlPort.absolutePosition,
  };
}


function orientationToPortPosition(orientation: SymbolPin['orientation']): PortPosition {
  switch (orientation) {
    case 'left': return 'left';
    case 'right': return 'right';
    case 'up': return 'top';
    case 'down': return 'bottom';
    default: return 'left';
  }
}

function electricalTypeToPortType(type: SymbolPin['type'] | SymbolPin['electricalType']): PortTypeEnum {
  switch (type) {
    case 'input':
    case 'power_in':
    case 'open_collector':
    case 'open_emitter':
      return 'input';
    case 'output':
    case 'power_out':
      return 'output';
    default:
      return 'bidirectional';
  }
}

function pinToPort(pin: SymbolPin): Port {
  return {
    id: pin.id,
    type: electricalTypeToPortType(pin.electricalType ?? pin.type),
    label: pin.name,
    position: orientationToPortPosition(pin.orientation),
  };
}

/**
 * Get default ports for a block type.
 */
function getDefaultPorts(type: string, properties?: Record<string, unknown>): Port[] {
  // Keep powersource special case (polarity-based ports)
  if (type === 'powersource' || type === 'power_source') {
    const polarity = (properties?.polarity as string) || 'positive';
    return getPowerSourcePorts(polarity as 'positive' | 'negative' | 'ground');
  }
  // All other types: look up in symbolBridge
  const symbol = getBuiltinSymbolForBlockType(type);
  if (symbol) {
    const pins = symbol.units ? symbol.units[0]?.pins ?? [] : symbol.pins;
    return pins.map(pinToPort);
  }
  // No symbol found → no default ports
  return [];
}

/**
 * Convert YAML component to Block, migrating legacy types.
 */
function yamlToBlock(yamlBlock: YamlBlockDefinition): Block {
  let type = yamlBlock.type as string;
  let properties = { ...(yamlBlock.properties || {}) };
  let label = yamlBlock.label;

  // Migrate legacy block types to powersource
  const migration = migrateLegacyBlockType(type);
  if (migration) {
    type = 'powersource';
    properties = {
      ...properties,
      voltage: migration.voltage,
      polarity: migration.polarity,
    };
    if (!label) {
      label = migration.label;
    }
  }

  const blockType = type as BlockType;
  const ports = yamlBlock.ports
    ? yamlBlock.ports.map(yamlToPort)
    : getDefaultPorts(blockType, properties);

  const baseBlock = {
    id: yamlBlock.id,
    type: blockType,
    position: { x: yamlBlock.position.x, y: yamlBlock.position.y },
    size: getBlockSize(blockType),
    ports,
    label,
  };

  return { ...baseBlock, ...properties } as Block;
}

/**
 * Migrate a legacy Block to ComponentInstance format.
 * Used when loading old .yaml project files.
 */
export function migrateBlockToComponentInstance(block: Block): ComponentInstance {
  return {
    id: block.id,
    symbolId: block.type,  // type string maps to symbolId via BLOCK_TYPE_TO_SYMBOL_ID
    type: block.type,
    position: block.position,
    rotation: block.rotation ?? 0,
    instanceProperties: { ...(block as unknown as Record<string, unknown>) },
    ports: (block.ports ?? []) as unknown as CircuitPort[],
    label: (block as unknown as Record<string, unknown>).label as string | undefined,
    designation: (block as unknown as Record<string, unknown>).designation as string | undefined,
  };
}

/**
 * Convert a YAML wire endpoint to a WireEndpoint.
 */
function yamlEndpointToWireEndpoint(ep: YamlWireEndpoint): WireEndpoint | null {
  if (ep.component && ep.port) {
    return { componentId: ep.component, portId: ep.port };
  }
  if (ep.junction) {
    return { junctionId: ep.junction };
  }
  if (ep.position) {
    return { position: { x: ep.position.x, y: ep.position.y } };
  }
  return null;
}

/**
 * Convert YAML wire to Wire.
 */
function yamlToWire(yamlWire: YamlWireDefinition): Wire | null {
  const from = yamlEndpointToWireEndpoint(yamlWire.from);
  const to = yamlEndpointToWireEndpoint(yamlWire.to);
  if (!from || !to) return null;
  return {
    id: yamlWire.id,
    from,
    to,
    color: yamlWire.color,
  };
}

/**
 * Parse YAML string and convert to CircuitState.
 */
export function yamlToCircuit(yamlString: string): CircuitState {
  let data: unknown;

  try {
    data = yaml.parse(yamlString);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown parse error';
    throw new CircuitValidationError(`Failed to parse YAML: ${message}`);
  }

  // Validate structure
  const validatedData = validateCircuitYaml(data);

  // Convert to CircuitState
  const components = new Map<string, Block>();
  for (const yamlBlock of validatedData.components) {
    const block = yamlToBlock(yamlBlock);
    components.set(block.id, block);
  }

  const wires: Wire[] = validatedData.wires.map(yamlToWire).filter((w): w is Wire => w !== null);

  const metadata: CircuitMetadata = {
    name: validatedData.metadata.name,
    description: validatedData.metadata.description || '',
    tags: validatedData.metadata.tags || [],
    createdAt: validatedData.metadata.created,
    modifiedAt: validatedData.metadata.modified,
  };

  return {
    components,
    junctions: new Map(),
    wires,
    metadata,
    selection: createSelectionState([]),
  };
}

// ============================================================================
// Default Circuit
// ============================================================================

/**
 * Create a default empty circuit with given name.
 */
export function createDefaultCircuit(name: string): CircuitState {
  return {
    components: new Map(),
    junctions: new Map(),
    wires: [],
    metadata: {
      name,
      description: '',
      tags: [],
      createdAt: new Date().toISOString(),
    },
    selection: createSelectionState([]),
  };
}

/**
 * Create default circuit YAML string.
 */
export function createDefaultCircuitYaml(name: string): string {
  const state = createDefaultCircuit(name);
  return circuitToYaml(state);
}
