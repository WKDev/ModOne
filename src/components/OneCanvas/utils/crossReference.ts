/**
 * Cross-Reference System for OneCanvas
 *
 * Provides utilities to link related components across the circuit.
 * For example, a relay coil K1 and its contacts K1.1, K1.2 throughout
 * different parts of the schematic.
 */

import type { Block } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Cross-reference entry for a single device */
export interface CrossReferenceEntry {
  /** The designation (e.g., "K1", "M1", "F1") */
  designation: string;
  /** All block IDs with this designation */
  blockIds: string[];
  /** Block type (relay, motor, fuse, etc.) */
  blockType: string;
}

/** Cross-reference info for display */
export interface CrossReferenceInfo {
  /** Current block's designation */
  designation: string;
  /** Related blocks with their positions */
  relatedBlocks: Array<{
    id: string;
    type: string;
    label: string;
    position: { x: number; y: number };
    /** Additional info (e.g., "NO", "NC" for relay contacts) */
    info?: string;
  }>;
  /** Total count including current block */
  totalCount: number;
}

/** Map of designation -> CrossReferenceEntry */
export type CrossReferenceMap = Map<string, CrossReferenceEntry>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if a block has a designation field
 */
function hasDesignation(block: Block): block is Block & { designation: string } {
  return 'designation' in block && typeof (block as any).designation === 'string';
}

/**
 * Gets additional info from a block for cross-reference display
 */
function getBlockInfo(block: Block): string | undefined {
  switch (block.type) {
    case 'relay':
      return (block as any).contacts; // "NO" or "NC"
    case 'fuse':
      return `${(block as any).ratingAmps}A`;
    case 'motor':
      return `${(block as any).powerKw}kW`;
    default:
      return undefined;
  }
}

/**
 * Gets a human-readable label for a block type
 */
function getBlockTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    relay: 'Relay',
    fuse: 'Fuse/CB',
    motor: 'Motor',
    emergencyStop: 'E-Stop',
    selectorSwitch: 'Selector',
    terminal: 'Terminal',
    solenoid: 'Solenoid',
    sensor: 'Sensor',
  };
  return labels[type] || type;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Build a cross-reference map from all components.
 *
 * Groups components by their designation (K1, K2, M1, F1, etc.).
 * This enables finding all related components for a given device.
 *
 * @param components - Map of all circuit components
 * @returns Map of designation -> CrossReferenceEntry
 */
export function buildCrossReferenceMap(
  components: Map<string, Block>
): CrossReferenceMap {
  const map: CrossReferenceMap = new Map();

  for (const [id, block] of components) {
    if (!hasDesignation(block)) continue;

    const designation = block.designation.toUpperCase().trim();
    if (!designation) continue;

    const existing = map.get(designation);
    if (existing) {
      existing.blockIds.push(id);
    } else {
      map.set(designation, {
        designation,
        blockIds: [id],
        blockType: block.type,
      });
    }
  }

  return map;
}

/**
 * Find all components sharing the same designation.
 *
 * @param designation - Device designation (e.g., "K1")
 * @param components - Map of all circuit components
 * @returns Array of block IDs with this designation
 */
export function findRelatedComponents(
  designation: string,
  components: Map<string, Block>
): string[] {
  const normalizedDesignation = designation.toUpperCase().trim();
  const related: string[] = [];

  for (const [id, block] of components) {
    if (hasDesignation(block)) {
      if (block.designation.toUpperCase().trim() === normalizedDesignation) {
        related.push(id);
      }
    }
  }

  return related;
}

/**
 * Get cross-reference information for a specific block.
 *
 * Returns info about all related blocks that share the same designation,
 * along with their positions and additional details.
 *
 * @param blockId - ID of the block to get cross-reference info for
 * @param components - Map of all circuit components
 * @returns CrossReferenceInfo or null if block has no designation
 */
export function getCrossReferenceInfo(
  blockId: string,
  components: Map<string, Block>
): CrossReferenceInfo | null {
  const block = components.get(blockId);
  if (!block || !hasDesignation(block)) {
    return null;
  }

  const designation = block.designation.toUpperCase().trim();
  if (!designation) {
    return null;
  }

  const relatedIds = findRelatedComponents(designation, components);

  // Build related blocks array (excluding current block)
  const relatedBlocks = relatedIds
    .filter((id) => id !== blockId)
    .map((id) => {
      const relatedBlock = components.get(id)!;
      return {
        id,
        type: relatedBlock.type,
        label: getBlockTypeLabel(relatedBlock.type),
        position: { ...relatedBlock.position },
        info: getBlockInfo(relatedBlock),
      };
    })
    .sort((a, b) => {
      // Sort by position: top-to-bottom, left-to-right
      if (Math.abs(a.position.y - b.position.y) > 50) {
        return a.position.y - b.position.y;
      }
      return a.position.x - b.position.x;
    });

  return {
    designation,
    relatedBlocks,
    totalCount: relatedIds.length,
  };
}

/**
 * Get all designations that have multiple components (actual cross-references).
 *
 * @param components - Map of all circuit components
 * @returns Array of designations with more than one component
 */
export function getMultipleReferenceDesignations(
  components: Map<string, Block>
): string[] {
  const map = buildCrossReferenceMap(components);
  const multiple: string[] = [];

  for (const [designation, entry] of map) {
    if (entry.blockIds.length > 1) {
      multiple.push(designation);
    }
  }

  return multiple.sort();
}

/**
 * Format cross-reference info as a display string.
 *
 * @param info - CrossReferenceInfo from getCrossReferenceInfo
 * @returns Formatted string for tooltip/display
 */
export function formatCrossReferenceTooltip(info: CrossReferenceInfo): string {
  if (info.relatedBlocks.length === 0) {
    return `${info.designation}: No other references`;
  }

  const lines = [`${info.designation} (${info.totalCount} total):`];

  for (const related of info.relatedBlocks) {
    const infoStr = related.info ? ` [${related.info}]` : '';
    const posStr = `@(${Math.round(related.position.x)}, ${Math.round(related.position.y)})`;
    lines.push(`  • ${related.label}${infoStr} ${posStr}`);
  }

  return lines.join('\n');
}
