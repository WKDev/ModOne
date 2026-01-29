/**
 * InstructionParser - Stack-Based Ladder Logic Instruction Parser
 *
 * Parses LS PLC ladder logic instructions using a stack-based algorithm
 * for handling LOAD, AND, OR, ANDB, and ORB instructions.
 *
 * Processing algorithm:
 * 1. LOAD/LOADN/LOADP/LOADF - Push new contact onto stack
 * 2. AND/ANDN/ANDP/ANDF - Series connection with top of stack
 * 3. OR/ORN/ORP/ORF - Create parallel branch, push to pending
 * 4. ANDB - Pop two items, create series block
 * 5. ORB - Pop two items, create parallel block
 * 6. OUT/SET/RST - Output coil, connects to current path
 */

import type {
  CsvRow,
  LadderNode,
  ContactNode,
  CoilNode,
  TimerNode,
  CounterNode,
  ComparisonNode,
  MathNode,
  BlockNode,
  DeviceAddress,
  MathOperator,
  TimeBase,
} from './types';

import { parseDeviceAddress, DEFAULT_GRID_POSITION } from './types';

import {
  isLoadInstruction,
  isAndInstruction,
  isOrInstruction,
  isBlockInstruction,
  isOutputInstruction,
  isTimerInstruction,
  isCounterInstruction,
  isComparisonInstruction,
  isMathInstruction,
  getContactNodeType,
  getCoilNodeType,
  getTimerNodeType,
  getCounterNodeType,
  extractComparisonOperator,
} from './utils';

/**
 * Stack-based instruction parser for LS PLC ladder logic
 */
export class InstructionParser {
  /** Stack for building ladder logic expressions */
  private stack: LadderNode[] = [];

  /** Pending OR operations to be combined */
  private pendingOr: LadderNode[] = [];

  /** Counter for generating unique node IDs */
  private nodeCount: number = 0;

  /**
   * Parse a single instruction row
   * @param row - CSV row containing instruction data
   * @returns Parsed LadderNode or null if instruction not recognized
   */
  parseInstruction(row: CsvRow): LadderNode | null {
    const instruction = row.instruction.toUpperCase();

    // Contact instructions: LOAD/AND/OR variants
    if (
      isLoadInstruction(instruction) ||
      isAndInstruction(instruction) ||
      isOrInstruction(instruction)
    ) {
      return this.parseContactInstruction(row);
    }

    // Block instructions: ANDB, ORB
    if (isBlockInstruction(instruction)) {
      return this.parseBlockInstruction(row);
    }

    // Output instructions: OUT, OUTN, SET, RST
    if (isOutputInstruction(instruction)) {
      return this.parseOutputInstruction(row);
    }

    // Timer instructions: TON, TOF, TMR
    if (isTimerInstruction(instruction)) {
      return this.parseTimerInstruction(row);
    }

    // Counter instructions: CTU, CTD, CTUD
    if (isCounterInstruction(instruction)) {
      return this.parseCounterInstruction(row);
    }

    // Comparison instructions: LD=, LD>, LD<, etc.
    if (isComparisonInstruction(instruction)) {
      return this.parseComparisonInstruction(row);
    }

    // Math instructions: ADD, SUB, MUL, DIV, MOV
    if (isMathInstruction(instruction)) {
      return this.parseMathInstruction(row);
    }

    // Instruction not recognized
    return null;
  }

  /**
   * Parse contact instruction (LOAD/AND/OR variants)
   * @param row - CSV row containing contact instruction
   * @returns ContactNode or null if invalid
   */
  private parseContactInstruction(row: CsvRow): ContactNode | null {
    const instruction = row.instruction.toUpperCase();
    const address = parseDeviceAddress(row.operand1 || '');

    if (!address) {
      return null;
    }

    // Determine contact type from instruction suffix
    const nodeType = getContactNodeType(instruction);

    const node: ContactNode = {
      id: this.generateNodeId(),
      type: nodeType,
      address,
      comment: row.comment,
      gridPosition: { ...DEFAULT_GRID_POSITION },
    };

    // Stack operations based on instruction prefix
    if (isLoadInstruction(instruction)) {
      // LOAD - Push directly onto stack
      this.stack.push(node);
    } else if (isAndInstruction(instruction)) {
      // AND - Series connection with top of stack
      const top = this.stack.pop();
      if (top) {
        const seriesBlock: BlockNode = {
          id: this.generateNodeId(),
          type: 'block_series',
          children: [top, node],
          gridPosition: { ...DEFAULT_GRID_POSITION },
        };
        this.stack.push(seriesBlock);
      } else {
        // If stack is empty, treat as LOAD
        this.stack.push(node);
      }
    } else if (isOrInstruction(instruction)) {
      // OR - Parallel branch, add to pending
      this.pendingOr.push(node);
    }

    return node;
  }

  /**
   * Parse block instruction (ANDB/ORB)
   * @param row - CSV row containing block instruction
   * @returns BlockNode or null if insufficient stack items
   */
  private parseBlockInstruction(row: CsvRow): BlockNode | null {
    const instruction = row.instruction.toUpperCase();

    if (instruction === 'ANDB') {
      // AND Block: pop two items, create series connection
      const item2 = this.stack.pop();
      const item1 = this.stack.pop();

      if (item1 && item2) {
        const block: BlockNode = {
          id: this.generateNodeId(),
          type: 'block_series',
          children: [item1, item2],
          gridPosition: { ...DEFAULT_GRID_POSITION },
        };
        this.stack.push(block);
        return block;
      }
    } else if (instruction === 'ORB') {
      // OR Block: pop two items, create parallel connection
      const item2 = this.stack.pop();
      const item1 = this.stack.pop();

      if (item1 && item2) {
        const block: BlockNode = {
          id: this.generateNodeId(),
          type: 'block_parallel',
          children: [item1, item2],
          gridPosition: { ...DEFAULT_GRID_POSITION },
        };
        this.stack.push(block);
        return block;
      }
    }

    return null;
  }

  /**
   * Parse output instruction (OUT/SET/RST)
   * @param row - CSV row containing output instruction
   * @returns CoilNode or null if invalid
   */
  private parseOutputInstruction(row: CsvRow): CoilNode | null {
    const instruction = row.instruction.toUpperCase();
    const address = parseDeviceAddress(row.operand1 || '');

    if (!address) {
      return null;
    }

    const nodeType = getCoilNodeType(instruction);

    return {
      id: this.generateNodeId(),
      type: nodeType,
      address,
      comment: row.comment,
      gridPosition: { ...DEFAULT_GRID_POSITION },
    };
  }

  /**
   * Parse timer instruction (TON/TOF/TMR)
   * @param row - CSV row containing timer instruction
   * @returns TimerNode or null if invalid
   */
  private parseTimerInstruction(row: CsvRow): TimerNode | null {
    const instruction = row.instruction.toUpperCase();
    const address = parseDeviceAddress(row.operand1 || '');

    if (!address) {
      return null;
    }

    const preset = parseInt(row.operand2 || '0', 10);
    const nodeType = getTimerNodeType(instruction);

    // Parse time base from operand3 if present, default to 'ms'
    let timeBase: TimeBase = 'ms';
    if (row.operand3) {
      const tb = row.operand3.toLowerCase();
      if (tb === 's' || tb === 'sec' || tb === 'second') {
        timeBase = 's';
      }
    }

    return {
      id: this.generateNodeId(),
      type: nodeType,
      address,
      preset: isNaN(preset) ? 0 : preset,
      timeBase,
      comment: row.comment,
      gridPosition: { ...DEFAULT_GRID_POSITION },
    };
  }

  /**
   * Parse counter instruction (CTU/CTD/CTUD)
   * @param row - CSV row containing counter instruction
   * @returns CounterNode or null if invalid
   */
  private parseCounterInstruction(row: CsvRow): CounterNode | null {
    const instruction = row.instruction.toUpperCase();
    const address = parseDeviceAddress(row.operand1 || '');

    if (!address) {
      return null;
    }

    const preset = parseInt(row.operand2 || '0', 10);
    const nodeType = getCounterNodeType(instruction);

    return {
      id: this.generateNodeId(),
      type: nodeType,
      address,
      preset: isNaN(preset) ? 0 : preset,
      comment: row.comment,
      gridPosition: { ...DEFAULT_GRID_POSITION },
    };
  }

  /**
   * Parse comparison instruction (LD=/LD>/LD< etc.)
   * @param row - CSV row containing comparison instruction
   * @returns ComparisonNode or null if invalid
   */
  private parseComparisonInstruction(row: CsvRow): ComparisonNode | null {
    const instruction = row.instruction.toUpperCase();
    const operand1 = this.parseOperand(row.operand1);
    const operand2 = this.parseOperand(row.operand2);

    if (operand1 === null || operand2 === null) {
      return null;
    }

    const operator = extractComparisonOperator(instruction);

    const node: ComparisonNode = {
      id: this.generateNodeId(),
      type: 'comparison',
      operator,
      operand1,
      operand2,
      comment: row.comment,
      gridPosition: { ...DEFAULT_GRID_POSITION },
    };

    // Comparison instructions with LD prefix push to stack (like LOAD)
    // AND and OR prefixes affect stack differently
    if (instruction.startsWith('LD')) {
      this.stack.push(node);
    } else if (instruction.startsWith('AND')) {
      const top = this.stack.pop();
      if (top) {
        const seriesBlock: BlockNode = {
          id: this.generateNodeId(),
          type: 'block_series',
          children: [top, node],
          gridPosition: { ...DEFAULT_GRID_POSITION },
        };
        this.stack.push(seriesBlock);
      } else {
        this.stack.push(node);
      }
    } else if (instruction.startsWith('OR')) {
      this.pendingOr.push(node);
    }

    return node;
  }

  /**
   * Parse math instruction (ADD/SUB/MUL/DIV/MOV)
   * @param row - CSV row containing math instruction
   * @returns MathNode or null if invalid
   */
  private parseMathInstruction(row: CsvRow): MathNode | null {
    const instruction = row.instruction.toUpperCase() as MathOperator;
    const operand1 = this.parseOperand(row.operand1);

    if (operand1 === null) {
      return null;
    }

    // MOV has only 2 operands: source and destination
    // Other math instructions have 3 operands: source1, source2, destination
    let operand2: DeviceAddress | number | undefined;
    let destination: DeviceAddress | null;

    if (instruction === 'MOV') {
      // MOV: operand1 is source, operand2 is destination
      destination = parseDeviceAddress(row.operand2 || '');
      operand2 = undefined;
    } else {
      // ADD, SUB, MUL, DIV: operand1, operand2 are sources, operand3 is destination
      operand2 = this.parseOperand(row.operand2) ?? undefined;
      destination = parseDeviceAddress(row.operand3 || '');
    }

    if (!destination) {
      return null;
    }

    return {
      id: this.generateNodeId(),
      type: instruction === 'MOV' ? 'move' : 'math',
      operator: instruction,
      operand1,
      operand2,
      destination,
      comment: row.comment,
      gridPosition: { ...DEFAULT_GRID_POSITION },
    };
  }

  /**
   * Parse an operand as either a device address or immediate number
   * @param operand - Operand string
   * @returns DeviceAddress, number, or null if invalid
   */
  private parseOperand(operand: string | undefined): DeviceAddress | number | null {
    if (!operand) {
      return null;
    }

    const trimmed = operand.trim();

    // Try as number first (decimal integers)
    if (/^-?\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }

    // Try as hex number (H prefix or 0x prefix)
    if (/^(H|0x)[0-9A-Fa-f]+$/i.test(trimmed)) {
      const hexStr = trimmed.replace(/^(H|0x)/i, '');
      return parseInt(hexStr, 16);
    }

    // Try as device address
    return parseDeviceAddress(trimmed);
  }

  /**
   * Generate a unique node ID
   * @returns Unique ID string
   */
  private generateNodeId(): string {
    return `node_${++this.nodeCount}`;
  }

  /**
   * Get the final result from the stack after parsing all instructions
   * Combines any pending OR operations with the stack
   * @returns Final combined LadderNode or null if stack is empty
   */
  getResult(): LadderNode | null {
    // First, combine any pending OR operations
    while (this.pendingOr.length > 0) {
      const orItem = this.pendingOr.pop()!;
      const stackItem = this.stack.pop();

      if (stackItem) {
        const orBlock: BlockNode = {
          id: this.generateNodeId(),
          type: 'block_parallel',
          children: [stackItem, orItem],
          gridPosition: { ...DEFAULT_GRID_POSITION },
        };
        this.stack.push(orBlock);
      } else {
        // If stack is empty, just push the OR item
        this.stack.push(orItem);
      }
    }

    return this.stack.pop() || null;
  }

  /**
   * Get all remaining items from the stack
   * @returns Array of remaining nodes
   */
  getStackContents(): LadderNode[] {
    // Process pending OR first
    while (this.pendingOr.length > 0) {
      const orItem = this.pendingOr.pop()!;
      const stackItem = this.stack.pop();

      if (stackItem) {
        const orBlock: BlockNode = {
          id: this.generateNodeId(),
          type: 'block_parallel',
          children: [stackItem, orItem],
          gridPosition: { ...DEFAULT_GRID_POSITION },
        };
        this.stack.push(orBlock);
      } else {
        this.stack.push(orItem);
      }
    }

    return [...this.stack];
  }

  /**
   * Get current stack size
   * @returns Number of items on the stack
   */
  getStackSize(): number {
    return this.stack.length;
  }

  /**
   * Get pending OR count
   * @returns Number of pending OR items
   */
  getPendingOrCount(): number {
    return this.pendingOr.length;
  }

  /**
   * Reset parser state for parsing a new network
   */
  reset(): void {
    this.stack = [];
    this.pendingOr = [];
    // Keep nodeCount incrementing for unique IDs across networks
  }

  /**
   * Reset parser state completely including node counter
   */
  resetAll(): void {
    this.stack = [];
    this.pendingOr = [];
    this.nodeCount = 0;
  }
}

export default InstructionParser;
