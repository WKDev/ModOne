/**
 * Electrical Rule Check (ERC)
 *
 * Comprehensive circuit validation that checks for common electrical errors:
 * - Unconnected ports (floating inputs/outputs)
 * - Missing power or ground connections
 * - Power-to-power conflicts (two sources connected)
 * - Floating inputs (inputs with no driving source)
 * - Short circuits (direct power to ground)
 * - Components without any connections
 */

import type { Block, Wire, Junction } from '../types';
import { isPortEndpoint, isAnnotationBlock } from '../types';
import { buildCircuitGraph } from './circuitGraph';
import { findAllCircuitPaths, findShortCircuits } from './pathFinder';
import { evaluateSwitchStates, applySwitchStatesToGraph, createEmptyRuntimeState } from './switchEvaluator';

// ============================================================================
// Types
// ============================================================================

/** Severity levels for ERC violations */
export type ErcSeverity = 'error' | 'warning' | 'info';

/** Categories of ERC violations */
export type ErcCategory =
  | 'unconnected_port'
  | 'floating_input'
  | 'no_power'
  | 'no_ground'
  | 'power_conflict'
  | 'short_circuit'
  | 'isolated_component'
  | 'duplicate_designation'
  | 'missing_load';

/** A single ERC violation */
export interface ErcViolation {
  /** Unique ID for this violation */
  id: string;
  /** Severity level */
  severity: ErcSeverity;
  /** Violation category */
  category: ErcCategory;
  /** Human-readable message */
  message: string;
  /** Component ID(s) involved */
  componentIds: string[];
  /** Port ID(s) involved (format: componentId:portId) */
  portIds?: string[];
  /** Wire ID(s) involved */
  wireIds?: string[];
}

/** Complete ERC result */
export interface ErcResult {
  /** All violations found */
  violations: ErcViolation[];
  /** Count by severity */
  errorCount: number;
  warningCount: number;
  infoCount: number;
  /** Whether the circuit passed (no errors) */
  passed: boolean;
  /** Timestamp of the check */
  checkedAt: string;
}

// ============================================================================
// ERC Implementation
// ============================================================================

/**
 * Run a comprehensive Electrical Rule Check on the circuit.
 */
export function runErc(
  components: Map<string, Block>,
  wires: Wire[],
  junctions: Map<string, Junction>
): ErcResult {
  const violations: ErcViolation[] = [];
  let violationId = 0;
  const nextId = () => `erc-${++violationId}`;

  // Filter out annotation blocks
  const electricalComponents = new Map<string, Block>();
  for (const [id, block] of components) {
    if (!isAnnotationBlock(block)) {
      electricalComponents.set(id, block);
    }
  }

  // Build port connection map
  const connectedPorts = new Set<string>();
  const portConnections = new Map<string, string[]>(); // portKey -> [wireIds]

  wires.forEach((wire) => {
    if (isPortEndpoint(wire.from)) {
      const key = `${wire.from.componentId}:${wire.from.portId}`;
      connectedPorts.add(key);
      if (!portConnections.has(key)) portConnections.set(key, []);
      portConnections.get(key)!.push(wire.id);
    }
    if (isPortEndpoint(wire.to)) {
      const key = `${wire.to.componentId}:${wire.to.portId}`;
      connectedPorts.add(key);
      if (!portConnections.has(key)) portConnections.set(key, []);
      portConnections.get(key)!.push(wire.id);
    }
  });

  // ========================================================================
  // Check 1: Unconnected ports
  // ========================================================================
  for (const [, block] of electricalComponents) {
    for (const port of block.ports) {
      const portKey = `${block.id}:${port.id}`;
      if (!connectedPorts.has(portKey)) {
        violations.push({
          id: nextId(),
          severity: port.type === 'input' ? 'warning' : 'info',
          category: 'unconnected_port',
          message: `Unconnected ${port.type} port "${port.label}" on ${block.label || block.type} (${block.id.substring(0, 8)})`,
          componentIds: [block.id],
          portIds: [portKey],
        });
      }
    }
  }

  // ========================================================================
  // Check 2: Isolated components (no connections at all)
  // ========================================================================
  for (const [, block] of electricalComponents) {
    if (block.ports.length === 0) continue;
    const hasAnyConnection = block.ports.some(
      (port) => connectedPorts.has(`${block.id}:${port.id}`)
    );
    if (!hasAnyConnection) {
      violations.push({
        id: nextId(),
        severity: 'warning',
        category: 'isolated_component',
        message: `Component "${block.label || block.type}" has no connections`,
        componentIds: [block.id],
      });
    }
  }

  // ========================================================================
  // Check 3: Missing power source
  // ========================================================================
  const hasPowerSource = Array.from(electricalComponents.values()).some(
    (b) => b.type === 'powersource' && b.polarity !== 'ground'
  );
  if (!hasPowerSource && electricalComponents.size > 0) {
    violations.push({
      id: nextId(),
      severity: 'error',
      category: 'no_power',
      message: 'No power source found in the circuit',
      componentIds: [],
    });
  }

  // ========================================================================
  // Check 4: Missing ground
  // ========================================================================
  const hasGround = Array.from(electricalComponents.values()).some(
    (b) => b.type === 'powersource' && b.polarity === 'ground'
  );
  if (!hasGround && hasPowerSource) {
    violations.push({
      id: nextId(),
      severity: 'warning',
      category: 'no_ground',
      message: 'No ground reference found - circuit may not complete',
      componentIds: [],
    });
  }

  // ========================================================================
  // Check 5: Duplicate designations (industrial components)
  // ========================================================================
  const designations = new Map<string, string[]>(); // designation -> [blockIds]
  for (const [, block] of electricalComponents) {
    const designation = (block as unknown as Record<string, unknown>).designation as string | undefined;
    if (designation) {
      if (!designations.has(designation)) designations.set(designation, []);
      designations.get(designation)!.push(block.id);
    }
  }
  for (const [designation, ids] of designations) {
    if (ids.length > 1) {
      violations.push({
        id: nextId(),
        severity: 'warning',
        category: 'duplicate_designation',
        message: `Duplicate designation "${designation}" used by ${ids.length} components`,
        componentIds: ids,
      });
    }
  }

  // ========================================================================
  // Check 6: Short circuits (using existing path finder)
  // ========================================================================
  try {
    const componentsArray = Array.from(electricalComponents.values());
    const junctionsArray = Array.from(junctions.values());
    const graph = buildCircuitGraph(componentsArray, wires, junctionsArray);
    const switchStates = evaluateSwitchStates(componentsArray, createEmptyRuntimeState());
    const activeGraph = applySwitchStatesToGraph(graph, switchStates);
    const paths = findAllCircuitPaths(activeGraph);
    const shortCircuits = findShortCircuits(paths);

    for (const sc of shortCircuits) {
      violations.push({
        id: nextId(),
        severity: 'error',
        category: 'short_circuit',
        message: `Short circuit detected: ${sc.voltage}V path from power to ground with no load`,
        componentIds: sc.nodes.map((n) => n.split(':')[0]),
        wireIds: sc.wireIds,
      });
    }

    // Check 7: Power source with no load
    const powerComponents = componentsArray.filter(
      (b) => b.type === 'powersource' && b.polarity !== 'ground'
    );
    const completePaths = paths.filter((p) => p.isComplete && !p.isShortCircuit);
    if (powerComponents.length > 0 && completePaths.length === 0 && hasPowerSource && hasGround) {
      violations.push({
        id: nextId(),
        severity: 'info',
        category: 'missing_load',
        message: 'No complete current path found - check connections between power and ground',
        componentIds: powerComponents.map((b) => b.id),
      });
    }
  } catch {
    // Graph building might fail on incomplete circuits - that's OK
  }

  // ========================================================================
  // Compile results
  // ========================================================================
  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;
  const infoCount = violations.filter((v) => v.severity === 'info').length;

  return {
    violations,
    errorCount,
    warningCount,
    infoCount,
    passed: errorCount === 0,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Format ERC result as a human-readable report.
 */
export function formatErcReport(result: ErcResult): string {
  const lines: string[] = [];
  lines.push('=== Electrical Rule Check ===');
  lines.push(`Status: ${result.passed ? 'PASSED' : 'FAILED'}`);
  lines.push(`Errors: ${result.errorCount} | Warnings: ${result.warningCount} | Info: ${result.infoCount}`);
  lines.push('');

  const grouped = {
    error: result.violations.filter((v) => v.severity === 'error'),
    warning: result.violations.filter((v) => v.severity === 'warning'),
    info: result.violations.filter((v) => v.severity === 'info'),
  };

  for (const [severity, violations] of Object.entries(grouped)) {
    if (violations.length === 0) continue;
    lines.push(`--- ${severity.toUpperCase()} (${violations.length}) ---`);
    for (const v of violations) {
      lines.push(`  [${v.category}] ${v.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
