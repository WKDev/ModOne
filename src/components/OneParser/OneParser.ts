/**
 * OneParser Main Module
 *
 * Main entry point for parsing LS PLC ladder logic programs from XG5000 CSV exports.
 * Integrates all parser components and provides a clean public API.
 */

import type {
  LadderProgram,
  ProgramMetadata,
  LadderNetwork,
  CsvRow,
  ValidationResult,
} from './types';
import { parseCsvContent, parseCsvGrouped } from './CsvReader';
import { AstBuilder } from './AstBuilder';
import { ProgramValidator } from './Validator';
import { ModbusMapper, createDefaultMapper } from './ModbusMapper';
import { GridCalculator } from './GridCalculator';

// ============================================================================
// Types
// ============================================================================

/** Options for parsing operations */
export interface ParseOptions {
  /** Use Tauri backend for file operations (default: true in Tauri context) */
  useBackend?: boolean;
  /** Program metadata to include */
  metadata?: Partial<ProgramMetadata>;
  /** Validate after parsing (default: true) */
  validate?: boolean;
}

/** Result of parsing operation */
export interface ParseResult {
  /** Parsed ladder program */
  program: LadderProgram;
  /** Validation result (if validation was enabled) */
  validation?: ValidationResult;
  /** Raw CSV rows */
  csvRows?: CsvRow[];
  /** Rows grouped by network/step */
  groupedRows?: Map<number, CsvRow[]>;
}

// ============================================================================
// OneParser Class
// ============================================================================

/**
 * OneParser - Main parser module for LS PLC CSV files
 *
 * Parses XG5000 CSV exports into AST format for visualization and simulation.
 *
 * @example
 * ```typescript
 * const parser = new OneParser();
 *
 * // Parse CSV content
 * const result = await parser.parseString(csvContent);
 * if (result.validation?.valid) {
 *   console.log('Program parsed successfully');
 *   console.log(`Networks: ${result.program.networks.length}`);
 * }
 *
 * // Access Modbus mapper
 * const mapper = parser.getModbusMapper();
 * const modbusAddr = mapper.mapToModbus(deviceAddress);
 * ```
 */
export class OneParser {
  private astBuilder: AstBuilder;
  private validator: ProgramValidator;
  private modbusMapper: ModbusMapper;
  private gridCalculator: GridCalculator;

  constructor() {
    this.astBuilder = new AstBuilder();
    this.validator = new ProgramValidator();
    this.modbusMapper = createDefaultMapper();
    this.gridCalculator = new GridCalculator();
  }

  // ==========================================================================
  // Parsing Methods
  // ==========================================================================

  /**
   * Parse CSV string content
   * @param content - CSV content string
   * @param options - Parsing options
   * @returns Parsed program with optional validation result
   */
  parseString(content: string, options: ParseOptions = {}): ParseResult {
    const { metadata, validate = true } = options;

    // Parse CSV content
    const csvRows = parseCsvContent(content);

    // Group by network/step
    const groupedRows = parseCsvGrouped(content);

    // Build program using AstBuilder
    const program = this.astBuilder.buildProgram(content, metadata);

    // Validate if requested
    let validation: ValidationResult | undefined;
    if (validate) {
      validation = this.validator.validate(program);
    }

    return {
      program,
      validation,
      csvRows,
      groupedRows,
    };
  }

  /**
   * Parse CSV content directly to networks
   * @param content - CSV content string
   * @returns Array of parsed networks
   */
  parseToNetworks(content: string): LadderNetwork[] {
    const program = this.astBuilder.buildProgram(content);
    return program.networks;
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate an existing program
   * @param program - Ladder program to validate
   * @returns Validation result with errors and warnings
   */
  validate(program: LadderProgram): ValidationResult {
    return this.validator.validate(program);
  }

  // ==========================================================================
  // Grid Calculation
  // ==========================================================================

  /**
   * Recalculate grid dimensions for a network
   * @param network - Network to calculate dimensions for
   * @returns Grid dimensions { width, height }
   */
  calculateGridDimensions(network: LadderNetwork): { width: number; height: number } {
    return this.gridCalculator.recalculate(network);
  }

  /**
   * Calculate grid dimensions for all networks in a program
   * @param program - Ladder program to calculate dimensions for
   * @returns Map of network ID to dimensions
   */
  calculateAllGridDimensions(
    program: LadderProgram
  ): Map<string, { width: number; height: number }> {
    const dimensions = new Map<string, { width: number; height: number }>();

    for (const network of program.networks) {
      dimensions.set(network.id, this.gridCalculator.recalculate(network));
    }

    return dimensions;
  }

  // ==========================================================================
  // Component Accessors
  // ==========================================================================

  /**
   * Get the AST builder instance
   */
  getAstBuilder(): AstBuilder {
    return this.astBuilder;
  }

  /**
   * Get the program validator instance
   */
  getValidator(): ProgramValidator {
    return this.validator;
  }

  /**
   * Get the Modbus mapper instance
   */
  getModbusMapper(): ModbusMapper {
    return this.modbusMapper;
  }

  /**
   * Get the grid calculator instance
   */
  getGridCalculator(): GridCalculator {
    return this.gridCalculator;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Singleton OneParser instance */
export const oneParser = new OneParser();

export default OneParser;
