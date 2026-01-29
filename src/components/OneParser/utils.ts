/**
 * OneParser Utility Functions
 *
 * Helper functions for instruction parsing and node creation.
 */

import type { LadderNodeType } from './types';

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique ID for ladder nodes
 * @param prefix - Optional prefix for the ID
 * @returns Unique ID string
 */
export function generateId(prefix: string = 'node'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Instruction Category Detection
// ============================================================================

/**
 * Check if instruction is a LOAD-type contact instruction
 * @param instruction - Instruction mnemonic (case-insensitive)
 * @returns True if LOAD/LOADN/LOADP/LOADF
 */
export function isLoadInstruction(instruction: string): boolean {
  const upper = instruction.toUpperCase();
  return (
    upper === 'LOAD' ||
    upper === 'LOADN' ||
    upper === 'LOADP' ||
    upper === 'LOADF' ||
    upper === 'LOADA'
  );
}

/**
 * Check if instruction is an AND-type contact instruction
 * @param instruction - Instruction mnemonic (case-insensitive)
 * @returns True if AND/ANDN/ANDP/ANDF
 */
export function isAndInstruction(instruction: string): boolean {
  const upper = instruction.toUpperCase();
  return (
    upper === 'AND' ||
    upper === 'ANDN' ||
    upper === 'ANDP' ||
    upper === 'ANDF'
  );
}

/**
 * Check if instruction is an OR-type contact instruction
 * @param instruction - Instruction mnemonic (case-insensitive)
 * @returns True if OR/ORN/ORP/ORF
 */
export function isOrInstruction(instruction: string): boolean {
  const upper = instruction.toUpperCase();
  return upper === 'OR' || upper === 'ORN' || upper === 'ORP' || upper === 'ORF';
}

/**
 * Check if instruction is a contact instruction (LOAD/AND/OR variants)
 * @param instruction - Instruction mnemonic (case-insensitive)
 * @returns True if any contact instruction
 */
export function isContactInstruction(instruction: string): boolean {
  return (
    isLoadInstruction(instruction) ||
    isAndInstruction(instruction) ||
    isOrInstruction(instruction)
  );
}

/**
 * Check if instruction is a block instruction (ANDB/ORB)
 * @param instruction - Instruction mnemonic (case-insensitive)
 * @returns True if ANDB/ORB
 */
export function isBlockInstruction(instruction: string): boolean {
  const upper = instruction.toUpperCase();
  return upper === 'ANDB' || upper === 'ORB';
}

/**
 * Check if instruction is an output instruction (OUT/SET/RST)
 * @param instruction - Instruction mnemonic (case-insensitive)
 * @returns True if OUT/OUTN/SET/RST
 */
export function isOutputInstruction(instruction: string): boolean {
  const upper = instruction.toUpperCase();
  return (
    upper === 'OUT' || upper === 'OUTN' || upper === 'SET' || upper === 'RST'
  );
}

/**
 * Check if instruction is a timer instruction
 * @param instruction - Instruction mnemonic (case-insensitive)
 * @returns True if TON/TOF/TMR
 */
export function isTimerInstruction(instruction: string): boolean {
  const upper = instruction.toUpperCase();
  return upper === 'TON' || upper === 'TOF' || upper === 'TMR';
}

/**
 * Check if instruction is a counter instruction
 * @param instruction - Instruction mnemonic (case-insensitive)
 * @returns True if CTU/CTD/CTUD
 */
export function isCounterInstruction(instruction: string): boolean {
  const upper = instruction.toUpperCase();
  return upper === 'CTU' || upper === 'CTD' || upper === 'CTUD';
}

/**
 * Check if instruction is a comparison instruction
 * @param instruction - Instruction mnemonic (case-insensitive)
 * @returns True if LD=/AND=/OR= etc.
 */
export function isComparisonInstruction(instruction: string): boolean {
  const upper = instruction.toUpperCase();
  // Comparison instructions: LD=, LD>, LD<, LD>=, LD<=, LD<>
  // Also AND=, AND>, etc. and OR=, OR>, etc.
  return /^(LD|AND|OR)(=|>|<|>=|<=|<>)$/.test(upper);
}

/**
 * Check if instruction is a math instruction
 * @param instruction - Instruction mnemonic (case-insensitive)
 * @returns True if ADD/SUB/MUL/DIV/MOV
 */
export function isMathInstruction(instruction: string): boolean {
  const upper = instruction.toUpperCase();
  return (
    upper === 'ADD' ||
    upper === 'SUB' ||
    upper === 'MUL' ||
    upper === 'DIV' ||
    upper === 'MOV'
  );
}

// ============================================================================
// Contact Type Detection
// ============================================================================

/**
 * Determine the contact node type from instruction suffix
 * @param instruction - Instruction mnemonic (e.g., LOAD, LOADN, LOADP, LOADF)
 * @returns Contact node type
 */
export function getContactNodeType(
  instruction: string
): 'contact_no' | 'contact_nc' | 'contact_p' | 'contact_n' {
  const upper = instruction.toUpperCase();

  if (upper.endsWith('N') && !upper.endsWith('TON')) {
    // LOADN, ANDN, ORN -> Normally Closed
    return 'contact_nc';
  } else if (upper.endsWith('P')) {
    // LOADP, ANDP, ORP -> Positive edge
    return 'contact_p';
  } else if (upper.endsWith('F')) {
    // LOADF, ANDF, ORF -> Falling/Negative edge
    return 'contact_n';
  } else {
    // LOAD, AND, OR -> Normally Open
    return 'contact_no';
  }
}

/**
 * Determine the coil node type from instruction
 * @param instruction - Instruction mnemonic (OUT, SET, RST)
 * @returns Coil node type
 */
export function getCoilNodeType(
  instruction: string
): 'coil_out' | 'coil_set' | 'coil_rst' {
  const upper = instruction.toUpperCase();

  if (upper === 'SET') {
    return 'coil_set';
  } else if (upper === 'RST') {
    return 'coil_rst';
  } else {
    // OUT, OUTN
    return 'coil_out';
  }
}

/**
 * Determine the timer node type from instruction
 * @param instruction - Instruction mnemonic (TON, TOF, TMR)
 * @returns Timer node type
 */
export function getTimerNodeType(
  instruction: string
): 'timer_ton' | 'timer_tof' | 'timer_tmr' {
  const upper = instruction.toUpperCase();

  if (upper === 'TOF') {
    return 'timer_tof';
  } else if (upper === 'TMR') {
    return 'timer_tmr';
  } else {
    // TON
    return 'timer_ton';
  }
}

/**
 * Determine the counter node type from instruction
 * @param instruction - Instruction mnemonic (CTU, CTD, CTUD)
 * @returns Counter node type
 */
export function getCounterNodeType(
  instruction: string
): 'counter_ctu' | 'counter_ctd' | 'counter_ctud' {
  const upper = instruction.toUpperCase();

  if (upper === 'CTD') {
    return 'counter_ctd';
  } else if (upper === 'CTUD') {
    return 'counter_ctud';
  } else {
    // CTU
    return 'counter_ctu';
  }
}

// ============================================================================
// Comparison Operator Extraction
// ============================================================================

/**
 * Extract comparison operator from instruction
 * @param instruction - Comparison instruction (e.g., LD=, LD>=, AND<>)
 * @returns Comparison operator
 */
export function extractComparisonOperator(
  instruction: string
): '=' | '>' | '<' | '>=' | '<=' | '<>' {
  const upper = instruction.toUpperCase();

  // Check in order of longest match first
  if (upper.includes('>=')) return '>=';
  if (upper.includes('<=')) return '<=';
  if (upper.includes('<>')) return '<>';
  if (upper.includes('>')) return '>';
  if (upper.includes('<')) return '<';
  return '=';
}

// ============================================================================
// Node Type Utilities
// ============================================================================

/**
 * Check if a node type represents a contact
 * @param type - Ladder node type
 * @returns True if contact type
 */
export function isContactType(type: LadderNodeType): boolean {
  return (
    type === 'contact_no' ||
    type === 'contact_nc' ||
    type === 'contact_p' ||
    type === 'contact_n'
  );
}

/**
 * Check if a node type represents a coil
 * @param type - Ladder node type
 * @returns True if coil type
 */
export function isCoilType(type: LadderNodeType): boolean {
  return type === 'coil_out' || type === 'coil_set' || type === 'coil_rst';
}

/**
 * Check if a node type represents a timer
 * @param type - Ladder node type
 * @returns True if timer type
 */
export function isTimerType(type: LadderNodeType): boolean {
  return (
    type === 'timer_ton' || type === 'timer_tof' || type === 'timer_tmr'
  );
}

/**
 * Check if a node type represents a counter
 * @param type - Ladder node type
 * @returns True if counter type
 */
export function isCounterType(type: LadderNodeType): boolean {
  return (
    type === 'counter_ctu' || type === 'counter_ctd' || type === 'counter_ctud'
  );
}

/**
 * Check if a node type represents a block
 * @param type - Ladder node type
 * @returns True if block type
 */
export function isBlockType(type: LadderNodeType): boolean {
  return type === 'block_series' || type === 'block_parallel';
}
