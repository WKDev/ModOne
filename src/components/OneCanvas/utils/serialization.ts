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
  Port,
  PortType as PortTypeEnum,
  PortPosition,
  CircuitState,
  CircuitMetadata,
  YamlCircuitSchema,
  YamlBlockDefinition,
  YamlWireDefinition,
} from '../types';
import { isValidBlockType } from '../types';

// ============================================================================
// Serialization (CircuitState -> YAML String)
// ============================================================================

/**
 * Convert a Block to YAML format.
 */
function blockToYaml(block: Block): YamlBlockDefinition {
  const { id, type, position, label, ports, selected, ...properties } = block;

  // Filter out undefined/null properties and runtime state
  const cleanProperties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value !== undefined && value !== null) {
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
        }))
      : undefined,
  };
}

/**
 * Convert a Wire to YAML format.
 */
function wireToYaml(wire: Wire): YamlWireDefinition {
  return {
    id: wire.id,
    from: { component: wire.from.componentId, port: wire.from.portId },
    to: { component: wire.to.componentId, port: wire.to.portId },
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
    version: '1.0',
    metadata: {
      name: state.metadata.name,
      description: state.metadata.description,
      tags: state.metadata.tags,
      created: state.metadata.createdAt,
      modified: new Date().toISOString(),
    },
    components,
    wires: state.wires.map(wireToYaml),
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

    if (typeof comp.type !== 'string' || !isValidBlockType(comp.type)) {
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

    if (!isObject(wire.from) || typeof (wire.from as Record<string, unknown>).component !== 'string') {
      throw new CircuitValidationError(`Invalid wire 'from' endpoint`, `wires[${i}]`);
    }

    if (!isObject(wire.to) || typeof (wire.to as Record<string, unknown>).component !== 'string') {
      throw new CircuitValidationError(`Invalid wire 'to' endpoint`, `wires[${i}]`);
    }

    // Validate wire endpoints reference existing components
    const fromComponent = (wire.from as Record<string, unknown>).component as string;
    const toComponent = (wire.to as Record<string, unknown>).component as string;

    if (!componentIds.has(fromComponent)) {
      throw new CircuitValidationError(
        `Wire references non-existent component: ${fromComponent}`,
        `wires[${i}].from`
      );
    }

    if (!componentIds.has(toComponent)) {
      throw new CircuitValidationError(
        `Wire references non-existent component: ${toComponent}`,
        `wires[${i}].to`
      );
    }
  }

  return data as unknown as YamlCircuitSchema;
}

/**
 * Convert YAML port to Port type.
 */
function yamlToPort(yamlPort: { id: string; type: string; label: string; position: string; offset?: number }): Port {
  return {
    id: yamlPort.id,
    type: yamlPort.type as PortTypeEnum,
    label: yamlPort.label,
    position: yamlPort.position as PortPosition,
    offset: yamlPort.offset,
  };
}

/**
 * Get default ports for a block type.
 */
function getDefaultPorts(type: BlockType): Port[] {
  switch (type) {
    case 'power_24v':
    case 'power_12v':
      return [{ id: 'out', type: 'output', label: '+', position: 'bottom' }];
    case 'gnd':
      return [{ id: 'in', type: 'input', label: 'GND', position: 'top' }];
    case 'plc_out':
    case 'plc_in':
      return [
        { id: 'in', type: 'input', label: 'IN', position: 'left' },
        { id: 'out', type: 'output', label: 'OUT', position: 'right' },
      ];
    case 'led':
      return [
        { id: 'anode', type: 'input', label: '+', position: 'top' },
        { id: 'cathode', type: 'output', label: '-', position: 'bottom' },
      ];
    case 'button':
      return [
        { id: 'in', type: 'input', label: 'IN', position: 'left' },
        { id: 'out', type: 'output', label: 'OUT', position: 'right' },
      ];
    case 'scope':
      return [
        { id: 'ch1', type: 'input', label: 'CH1', position: 'left', offset: 0.25 },
        { id: 'ch2', type: 'input', label: 'CH2', position: 'left', offset: 0.5 },
        { id: 'ch3', type: 'input', label: 'CH3', position: 'left', offset: 0.75 },
        { id: 'ch4', type: 'input', label: 'CH4', position: 'left', offset: 1.0 },
      ];
    default:
      return [];
  }
}

/**
 * Convert YAML component to Block.
 */
function yamlToBlock(yamlBlock: YamlBlockDefinition): Block {
  const ports = yamlBlock.ports
    ? yamlBlock.ports.map(yamlToPort)
    : getDefaultPorts(yamlBlock.type);

  const baseBlock = {
    id: yamlBlock.id,
    type: yamlBlock.type,
    position: { x: yamlBlock.position.x, y: yamlBlock.position.y },
    ports,
    label: yamlBlock.label,
  };

  // Merge type-specific properties
  const properties = yamlBlock.properties || {};

  return { ...baseBlock, ...properties } as Block;
}

/**
 * Convert YAML wire to Wire.
 */
function yamlToWire(yamlWire: YamlWireDefinition): Wire {
  return {
    id: yamlWire.id,
    from: {
      componentId: yamlWire.from.component,
      portId: yamlWire.from.port,
    },
    to: {
      componentId: yamlWire.to.component,
      portId: yamlWire.to.port,
    },
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

  const wires: Wire[] = validatedData.wires.map(yamlToWire);

  const metadata: CircuitMetadata = {
    name: validatedData.metadata.name,
    description: validatedData.metadata.description || '',
    tags: validatedData.metadata.tags || [],
    createdAt: validatedData.metadata.created,
    modifiedAt: validatedData.metadata.modified,
  };

  return {
    components,
    wires,
    metadata,
    selectedIds: new Set(),
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
    wires: [],
    metadata: {
      name,
      description: '',
      tags: [],
      createdAt: new Date().toISOString(),
    },
    selectedIds: new Set(),
  };
}

/**
 * Create default circuit YAML string.
 */
export function createDefaultCircuitYaml(name: string): string {
  const state = createDefaultCircuit(name);
  return circuitToYaml(state);
}
