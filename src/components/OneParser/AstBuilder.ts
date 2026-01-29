/**
 * AstBuilder - Ladder Logic AST Builder
 *
 * Constructs LadderProgram structures from parsed CSV content,
 * including network building and grid position calculation.
 */

import type {
  CsvRow,
  LadderNetwork,
  LadderNode,
  LadderProgram,
  ProgramMetadata,
  SymbolTable,
  SymbolEntry,
  BlockNode,
} from './types';

import { CsvReader } from './CsvReader';
import { InstructionParser } from './InstructionParser';
import { parseDeviceAddress, formatDeviceAddress, isBlockNode } from './types';

/**
 * AST Builder for ladder logic programs
 *
 * Coordinates CSV parsing, instruction processing, and program assembly.
 */
export class AstBuilder {
  private instructionParser: InstructionParser;

  constructor() {
    this.instructionParser = new InstructionParser();
  }

  /**
   * Build complete ladder program from CSV content
   * @param csvContent - Raw CSV content string
   * @param metadata - Optional partial metadata to merge
   * @returns Complete LadderProgram structure
   */
  buildProgram(csvContent: string, metadata?: Partial<ProgramMetadata>): LadderProgram {
    const reader = new CsvReader(csvContent);
    const rows = reader.readAllRows();
    const groupedRows = reader.groupByStep(rows);

    const networks: LadderNetwork[] = [];
    const symbolTable = this.buildSymbolTable(rows);

    // Process each network (step) in order
    const sortedSteps = Array.from(groupedRows.keys()).sort((a, b) => a - b);

    for (const step of sortedSteps) {
      const stepRows = groupedRows.get(step)!;
      const network = this.buildNetwork(step, stepRows);
      if (network) {
        networks.push(network);
      }
    }

    const now = new Date().toISOString();

    return {
      metadata: {
        name: metadata?.name || 'Untitled Program',
        description: metadata?.description,
        author: metadata?.author,
        createdAt: metadata?.createdAt || now,
        modifiedAt: now,
        version: metadata?.version || '1.0.0',
        plcModel: metadata?.plcModel,
      },
      networks,
      symbolTable,
    };
  }

  /**
   * Build a single network from rows
   * @param step - Network step number
   * @param rows - CSV rows for this network
   * @returns LadderNetwork or null if no valid nodes
   */
  private buildNetwork(step: number, rows: CsvRow[]): LadderNetwork | null {
    this.instructionParser.reset();

    const allNodes: LadderNode[] = [];
    let networkComment: string | undefined;

    for (const row of rows) {
      const node = this.instructionParser.parseInstruction(row);
      if (node) {
        allNodes.push(node);
      }
      // Capture first non-empty comment as network comment
      if (!networkComment && row.comment && row.comment.trim()) {
        networkComment = row.comment.trim();
      }
    }

    // Get the final AST structure from the stack
    const rootNode = this.instructionParser.getResult();

    // Calculate grid positions if we have a root node
    if (rootNode) {
      this.calculateGridPositions(rootNode, 0, 0);
    }

    // Flatten nodes for the network
    const flattenedNodes = rootNode ? this.flattenNodes(rootNode) : [];

    return {
      id: crypto.randomUUID(),
      step,
      nodes: flattenedNodes,
      comment: networkComment,
    };
  }

  /**
   * Calculate grid positions for visualization
   *
   * Grid layout rules:
   * - Series connections: nodes flow left to right (col++)
   * - Parallel connections: branches stack vertically (row++)
   * - Blocks take up space based on their children
   *
   * @param node - Node to calculate position for
   * @param startRow - Starting row position
   * @param startCol - Starting column position
   * @returns Maximum row and column used
   */
  private calculateGridPositions(
    node: LadderNode,
    startRow: number,
    startCol: number
  ): { maxRow: number; maxCol: number } {
    node.gridPosition = { row: startRow, col: startCol };

    if (node.type === 'block_series') {
      const blockNode = node as BlockNode;
      let currentCol = startCol;
      let maxRow = startRow;

      for (const child of blockNode.children) {
        const result = this.calculateGridPositions(child, startRow, currentCol);
        currentCol = result.maxCol + 1;
        maxRow = Math.max(maxRow, result.maxRow);
      }

      return { maxRow, maxCol: Math.max(startCol, currentCol - 1) };
    }

    if (node.type === 'block_parallel') {
      const blockNode = node as BlockNode;
      let currentRow = startRow;
      let maxCol = startCol;

      for (const child of blockNode.children) {
        const result = this.calculateGridPositions(child, currentRow, startCol);
        currentRow = result.maxRow + 1;
        maxCol = Math.max(maxCol, result.maxCol);
      }

      return { maxRow: Math.max(startRow, currentRow - 1), maxCol };
    }

    // Leaf node - occupies single cell
    return { maxRow: startRow, maxCol: startCol };
  }

  /**
   * Flatten nested block structure into array of nodes
   * @param node - Root node to flatten
   * @returns Array of all nodes including containers
   */
  private flattenNodes(node: LadderNode): LadderNode[] {
    const nodes: LadderNode[] = [node];

    if (isBlockNode(node)) {
      const blockNode = node as BlockNode;
      for (const child of blockNode.children) {
        nodes.push(...this.flattenNodes(child));
      }
    }

    return nodes;
  }

  /**
   * Build symbol table from CSV rows
   * Extracts unique device addresses and their associated comments
   * @param rows - All CSV rows
   * @returns SymbolTable with address entries
   */
  private buildSymbolTable(rows: CsvRow[]): SymbolTable {
    const entries = new Map<string, SymbolEntry>();

    for (const row of rows) {
      // Extract addresses from all operands
      const operands = [row.operand1, row.operand2, row.operand3].filter(
        (op): op is string => op !== undefined && op !== ''
      );

      for (const operand of operands) {
        // Only process strings that look like device addresses
        if (/^[A-Z]/i.test(operand)) {
          const address = parseDeviceAddress(operand);
          if (address) {
            const key = formatDeviceAddress(address);
            if (!entries.has(key)) {
              entries.set(key, {
                address,
                comment: row.comment?.trim(),
              });
            }
          }
        }
      }
    }

    return { entries };
  }

  /**
   * Build a single network from a subset of CSV content
   * Useful for parsing individual rungs
   * @param csvContent - CSV content for a single network
   * @param step - Step number to assign
   * @returns LadderNetwork or null
   */
  buildSingleNetwork(csvContent: string, step: number = 0): LadderNetwork | null {
    const reader = new CsvReader(csvContent);
    const rows = reader.readAllRows();
    return this.buildNetwork(step, rows);
  }

  /**
   * Get the root AST node from the last parsed network
   * Useful for debugging and testing
   * @returns Last root node or null
   */
  getLastRootNode(): LadderNode | null {
    return this.instructionParser.getResult();
  }
}

export default AstBuilder;
