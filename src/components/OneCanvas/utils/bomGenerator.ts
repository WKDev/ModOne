/**
 * BOM (Bill of Materials) Generator
 *
 * Generates a bill of materials from circuit components on the canvas.
 * Outputs component type, count, addresses, and labels.
 */

import type { Block, BlockType } from '../types';

// ============================================================================
// Types
// ============================================================================

/** A single BOM entry */
export interface BomEntry {
  /** Component type */
  type: BlockType;
  /** Display name for the type */
  typeName: string;
  /** Number of components of this type */
  quantity: number;
  /** Individual component details */
  items: BomItem[];
}

/** Individual component in a BOM entry */
export interface BomItem {
  /** Component ID */
  id: string;
  /** Label (if set) */
  label: string;
  /** Address (for PLC blocks) */
  address?: string;
  /** Additional details */
  details: string;
}

/** Complete BOM result */
export interface BomResult {
  /** BOM entries grouped by component type */
  entries: BomEntry[];
  /** Total number of components */
  totalComponents: number;
  /** Generation timestamp */
  generatedAt: string;
}

// ============================================================================
// Display Names
// ============================================================================

const TYPE_DISPLAY_NAMES: Record<BlockType, string> = {
  powersource: 'Power Source',
  plc_out: 'PLC Output (Coil)',
  plc_in: 'PLC Input (DI)',
  led: 'LED Indicator',
  button: 'Button / Switch',
  scope: 'Oscilloscope',
  text: 'Text Annotation',
  relay: 'Relay / Contactor',
  fuse: 'Fuse / Circuit Breaker',
  motor: 'Motor',
  emergency_stop: 'Emergency Stop',
  selector_switch: 'Selector Switch',
  solenoid_valve: 'Solenoid Valve',
  sensor: 'Sensor',
  pilot_lamp: 'Pilot Lamp',
  net_label: 'Net Label',
  transformer: 'Transformer',
  terminal_block: 'Terminal Block',
  overload_relay: 'Overload Relay',
  contactor: 'Contactor',
  disconnect_switch: 'Disconnect Switch',
  off_page_connector: 'Off-Page Connector',
};

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate a BOM from canvas components.
 * @param components - Map of all blocks on the canvas
 * @param excludeAnnotations - Whether to exclude text/annotation blocks (default: true)
 */
export function generateBom(
  components: Map<string, Block>,
  excludeAnnotations = true
): BomResult {
  const grouped = new Map<BlockType, BomItem[]>();

  for (const [, block] of components) {
    // Skip annotation blocks if requested
    if (excludeAnnotations && block.type === 'text') continue;

    if (!grouped.has(block.type)) {
      grouped.set(block.type, []);
    }

    const item: BomItem = {
      id: block.id,
      label: block.label || '',
      details: getBlockDetails(block),
    };

    // Add address for PLC blocks
    if (block.type === 'plc_out') {
      item.address = block.address;
    } else if (block.type === 'plc_in') {
      item.address = block.address;
    }

    grouped.get(block.type)!.push(item);
  }

  const entries: BomEntry[] = [];
  for (const [type, items] of grouped) {
    entries.push({
      type,
      typeName: TYPE_DISPLAY_NAMES[type] || type,
      quantity: items.length,
      items,
    });
  }

  // Sort by type name
  entries.sort((a, b) => a.typeName.localeCompare(b.typeName));

  return {
    entries,
    totalComponents: entries.reduce((sum, e) => sum + e.quantity, 0),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get human-readable details for a block.
 */
function getBlockDetails(block: Block): string {
  switch (block.type) {
    case 'powersource':
      return `${block.voltage}V ${block.polarity}`;
    case 'plc_out':
      return `${block.address} ${block.normallyOpen ? 'NO' : 'NC'}${block.inverted ? ' INV' : ''}`;
    case 'plc_in':
      return `${block.address} Vth=${block.thresholdVoltage}V`;
    case 'led':
      return `${block.color} Vf=${block.forwardVoltage}V`;
    case 'button':
      return `${block.mode} ${block.contactConfig}`;
    case 'scope':
      return `${block.channels}ch ${block.timeBase}ms/div`;
    case 'text':
      return block.content.substring(0, 30);
    case 'relay':
      return `${block.designation} ${block.coilVoltage}V ${block.contacts}`;
    case 'fuse':
      return `${block.designation} ${block.fuseType} ${block.ratingAmps}A`;
    case 'motor':
      return `${block.designation} ${block.powerKw}kW ${block.voltageRating}V`;
    case 'emergency_stop':
      return `${block.designation}`;
    case 'selector_switch':
      return `${block.designation} ${block.positions}pos`;
    case 'solenoid_valve':
      return `${block.designation} ${block.valveType} ${block.coilVoltage}V`;
    case 'sensor':
      return `${block.designation} ${block.sensorType} ${block.outputType}`;
    case 'pilot_lamp':
      return `${block.designation} ${block.lampColor} ${block.voltageRating}V`;
    default:
      return '';
  }
}

/**
 * Convert BOM to CSV string.
 */
export function bomToCsv(bom: BomResult): string {
  const lines: string[] = [];
  lines.push('Type,Quantity,Label,Address,Details');

  for (const entry of bom.entries) {
    for (const item of entry.items) {
      lines.push(
        [
          entry.typeName,
          '1',
          `"${item.label}"`,
          `"${item.address || ''}"`,
          `"${item.details}"`,
        ].join(',')
      );
    }
  }

  lines.push('');
  lines.push(`Total Components,${bom.totalComponents}`);
  lines.push(`Generated,${bom.generatedAt}`);

  return lines.join('\n');
}

/**
 * Convert BOM to a summary table (for display in UI).
 */
export function bomToSummary(bom: BomResult): string {
  const lines: string[] = [];
  lines.push('=== Bill of Materials ===');
  lines.push('');

  for (const entry of bom.entries) {
    lines.push(`${entry.typeName}: ${entry.quantity}`);
    for (const item of entry.items) {
      const parts = [item.label || item.id];
      if (item.address) parts.push(`[${item.address}]`);
      parts.push(item.details);
      lines.push(`  - ${parts.join(' ')}`);
    }
    lines.push('');
  }

  lines.push(`Total: ${bom.totalComponents} components`);
  return lines.join('\n');
}
