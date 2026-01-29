/**
 * OneParser Program Validator
 *
 * Validates ladder programs for syntax errors, address conflicts,
 * and logical issues.
 */

import type {
  LadderProgram,
  LadderNetwork,
  LadderNode,
  DeviceAddress,
  ContactNode,
  CoilNode,
  TimerNode,
  CounterNode,
  BlockNode,
  ValidationError,
  ValidationResult,
  ValidationErrorType,
} from './types';
import { isAddressInRange, formatDeviceAddress } from './types';

// ============================================================================
// Read-Only Devices
// ============================================================================

/** Devices that cannot be written to directly */
const READ_ONLY_DEVICES = ['P', 'F', 'T', 'C'] as const;

/** Bit devices that can be used in contacts */
const BIT_DEVICES = ['P', 'M', 'K', 'F', 'T', 'C'] as const;

/** Output node types */
const OUTPUT_NODE_TYPES = [
  'coil_out',
  'coil_set',
  'coil_rst',
  'timer_ton',
  'timer_tof',
  'timer_tmr',
  'counter_ctu',
  'counter_ctd',
  'counter_ctud',
] as const;

// ============================================================================
// Program Validator
// ============================================================================

/**
 * Ladder Program Validator
 *
 * Validates programs for:
 * - Address range errors
 * - Read-only device write attempts
 * - Empty networks
 * - Missing output instructions
 * - Duplicate output addresses
 * - Timer/counter device constraints
 * - Block structure constraints
 */
export class ProgramValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private usedOutputs: Map<string, string[]> = new Map(); // address -> network IDs

  /**
   * Validate a complete ladder program
   * @param program - The ladder program to validate
   * @returns Validation result with errors and warnings
   */
  validate(program: LadderProgram): ValidationResult {
    this.errors = [];
    this.warnings = [];
    this.usedOutputs.clear();

    // Validate each network
    for (const network of program.networks) {
      this.validateNetwork(network);
    }

    // Check for global issues
    this.checkDuplicateOutputs();

    return {
      valid: this.errors.length === 0,
      errors: this.errors.filter((e) => e.severity === 'error'),
      warnings: this.errors
        .filter((e) => e.severity === 'warning')
        .concat(this.warnings),
    };
  }

  // ==========================================================================
  // Network Validation
  // ==========================================================================

  /**
   * Validate a single network
   */
  private validateNetwork(network: LadderNetwork): void {
    // Check for empty network
    if (network.nodes.length === 0) {
      this.addWarning(network.id, undefined, 'Empty network', 'structure');
      return;
    }

    // Validate each node
    for (const node of network.nodes) {
      this.validateNode(network.id, node);
    }

    // Check for output instruction
    const hasOutput = network.nodes.some((n) =>
      (OUTPUT_NODE_TYPES as readonly string[]).includes(n.type)
    );

    if (!hasOutput) {
      this.addWarning(
        network.id,
        undefined,
        'Network has no output instruction',
        'structure'
      );
    }
  }

  // ==========================================================================
  // Node Validation
  // ==========================================================================

  /**
   * Validate a single node
   */
  private validateNode(networkId: string, node: LadderNode): void {
    // Validate address if present
    if ('address' in node && node.address) {
      this.validateAddress(networkId, node.id, node.address);
    }

    // Type-specific validation
    switch (node.type) {
      case 'contact_no':
      case 'contact_nc':
      case 'contact_p':
      case 'contact_n':
        this.validateContact(networkId, node as ContactNode);
        break;

      case 'coil_out':
      case 'coil_set':
      case 'coil_rst':
        this.validateCoil(networkId, node as CoilNode);
        break;

      case 'timer_ton':
      case 'timer_tof':
      case 'timer_tmr':
        this.validateTimer(networkId, node as TimerNode);
        break;

      case 'counter_ctu':
      case 'counter_ctd':
      case 'counter_ctud':
        this.validateCounter(networkId, node as CounterNode);
        break;

      case 'block_series':
      case 'block_parallel':
        this.validateBlock(networkId, node as BlockNode);
        break;
    }
  }

  // ==========================================================================
  // Address Validation
  // ==========================================================================

  /**
   * Validate device address
   */
  private validateAddress(
    networkId: string,
    nodeId: string,
    address: DeviceAddress
  ): void {
    // Check address range
    if (!isAddressInRange(address.device, address.address)) {
      this.addError(
        networkId,
        nodeId,
        `Address ${formatDeviceAddress(address)} is out of range`,
        'address'
      );
    }

    // Check bit index for word devices
    if (address.bitIndex !== undefined) {
      if (address.bitIndex < 0 || address.bitIndex > 15) {
        this.addError(
          networkId,
          nodeId,
          `Bit index ${address.bitIndex} is out of range (0-15)`,
          'address'
        );
      }
    }

    // Check index register range
    if (address.indexRegister !== undefined) {
      if (address.indexRegister < 0 || address.indexRegister > 15) {
        this.addError(
          networkId,
          nodeId,
          `Index register Z${address.indexRegister} is out of range (0-15)`,
          'address'
        );
      }
    }
  }

  // ==========================================================================
  // Type-Specific Validation
  // ==========================================================================

  /**
   * Validate contact node
   */
  private validateContact(networkId: string, node: ContactNode): void {
    const device = node.address.device;

    // Contacts can use bit devices (P, M, K, F, T, C) or word devices with bit access
    if (
      !(BIT_DEVICES as readonly string[]).includes(device) &&
      node.address.bitIndex === undefined
    ) {
      this.addWarning(
        networkId,
        node.id,
        `Contact using word device ${device} without bit access`,
        'logic'
      );
    }
  }

  /**
   * Validate coil node
   */
  private validateCoil(networkId: string, node: CoilNode): void {
    const device = node.address.device;

    // Check for read-only devices
    if ((READ_ONLY_DEVICES as readonly string[]).includes(device)) {
      this.addError(
        networkId,
        node.id,
        `Cannot write to read-only device ${device}`,
        'logic'
      );
    }

    // Track used outputs for duplicate detection
    this.trackOutput(node.address, networkId);
  }

  /**
   * Validate timer node
   */
  private validateTimer(networkId: string, node: TimerNode): void {
    // Timer must use T device
    if (node.address.device !== 'T') {
      this.addError(
        networkId,
        node.id,
        `Timer must use T device, not ${node.address.device}`,
        'logic'
      );
    }

    // Preset must be positive
    if (node.preset <= 0) {
      this.addWarning(
        networkId,
        node.id,
        'Timer preset should be positive',
        'logic'
      );
    }

    // Track output for duplicate detection
    this.trackOutput(node.address, networkId);
  }

  /**
   * Validate counter node
   */
  private validateCounter(networkId: string, node: CounterNode): void {
    // Counter must use C device
    if (node.address.device !== 'C') {
      this.addError(
        networkId,
        node.id,
        `Counter must use C device, not ${node.address.device}`,
        'logic'
      );
    }

    // Preset must be positive
    if (node.preset <= 0) {
      this.addWarning(
        networkId,
        node.id,
        'Counter preset should be positive',
        'logic'
      );
    }

    // Track output for duplicate detection
    this.trackOutput(node.address, networkId);
  }

  /**
   * Validate block node
   */
  private validateBlock(networkId: string, node: BlockNode): void {
    // Block must have at least 2 children
    if (node.children.length < 2) {
      this.addError(
        networkId,
        node.id,
        'Block must have at least 2 children',
        'structure'
      );
    }

    // Recursively validate children
    for (const child of node.children) {
      this.validateNode(networkId, child);
    }
  }

  // ==========================================================================
  // Output Tracking
  // ==========================================================================

  /**
   * Track an output address for duplicate detection
   */
  private trackOutput(address: DeviceAddress, networkId: string): void {
    const addrKey = formatDeviceAddress(address);
    if (!this.usedOutputs.has(addrKey)) {
      this.usedOutputs.set(addrKey, []);
    }
    this.usedOutputs.get(addrKey)!.push(networkId);
  }

  // ==========================================================================
  // Global Validation
  // ==========================================================================

  /**
   * Check for duplicate output addresses across networks
   */
  private checkDuplicateOutputs(): void {
    // Warn about addresses used in multiple networks
    for (const [addr, networks] of this.usedOutputs) {
      if (networks.length > 1) {
        this.addWarning(
          networks[0],
          undefined,
          `Address ${addr} is used as output in multiple networks: ${networks.join(', ')}`,
          'logic'
        );
      }
    }
  }

  // ==========================================================================
  // Error/Warning Helpers
  // ==========================================================================

  private addError(
    networkId: string,
    nodeId: string | undefined,
    message: string,
    errorType: ValidationErrorType
  ): void {
    this.errors.push({
      networkId,
      nodeId,
      message,
      errorType,
      severity: 'error',
    });
  }

  private addWarning(
    networkId: string,
    nodeId: string | undefined,
    message: string,
    errorType: ValidationErrorType
  ): void {
    this.warnings.push({
      networkId,
      nodeId,
      message,
      errorType,
      severity: 'warning',
    });
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Validate a ladder program
 * @param program - The program to validate
 * @returns Validation result
 */
export function validateProgram(program: LadderProgram): ValidationResult {
  const validator = new ProgramValidator();
  return validator.validate(program);
}
