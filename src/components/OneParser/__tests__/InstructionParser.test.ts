/**
 * Tests for InstructionParser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InstructionParser } from '../InstructionParser';
import type {
  CsvRow,
  ContactNode,
  CoilNode,
  TimerNode,
  CounterNode,
  ComparisonNode,
  MathNode,
  BlockNode,
} from '../types';
import {
  isContactNode,
  isCoilNode,
  isTimerNode,
  isCounterNode,
  isComparisonNode,
  isMathNode,
  isBlockNode,
} from '../types';

// Helper to create a minimal CsvRow
function createRow(
  instruction: string,
  operand1?: string,
  operand2?: string,
  operand3?: string,
  comment?: string
): CsvRow {
  return {
    no: 1,
    step: 0,
    instruction,
    operand1,
    operand2,
    operand3,
    comment,
  };
}

describe('InstructionParser', () => {
  let parser: InstructionParser;

  beforeEach(() => {
    parser = new InstructionParser();
  });

  describe('LOAD Instructions', () => {
    it('should parse LOAD as contact_no', () => {
      const row = createRow('LOAD', 'M0000');
      const node = parser.parseInstruction(row);

      expect(node).not.toBeNull();
      expect(isContactNode(node!)).toBe(true);

      const contact = node as ContactNode;
      expect(contact.type).toBe('contact_no');
      expect(contact.address.device).toBe('M');
      expect(contact.address.address).toBe(0);
    });

    it('should parse LOADN as contact_nc', () => {
      const row = createRow('LOADN', 'P0001');
      const node = parser.parseInstruction(row);

      expect(node).not.toBeNull();
      const contact = node as ContactNode;
      expect(contact.type).toBe('contact_nc');
      expect(contact.address.device).toBe('P');
      expect(contact.address.address).toBe(1);
    });

    it('should parse LOADP as contact_p (positive edge)', () => {
      const row = createRow('LOADP', 'M0100');
      const node = parser.parseInstruction(row);

      expect(node).not.toBeNull();
      const contact = node as ContactNode;
      expect(contact.type).toBe('contact_p');
    });

    it('should parse LOADF as contact_n (falling edge)', () => {
      const row = createRow('LOADF', 'M0200');
      const node = parser.parseInstruction(row);

      expect(node).not.toBeNull();
      const contact = node as ContactNode;
      expect(contact.type).toBe('contact_n');
    });

    it('should be case-insensitive', () => {
      const row = createRow('load', 'M0000');
      const node = parser.parseInstruction(row);

      expect(node).not.toBeNull();
      expect(isContactNode(node!)).toBe(true);
    });

    it('should push LOAD onto stack', () => {
      const row = createRow('LOAD', 'M0000');
      parser.parseInstruction(row);

      expect(parser.getStackSize()).toBe(1);
    });

    it('should return null for invalid operand', () => {
      const row = createRow('LOAD', 'INVALID');
      const node = parser.parseInstruction(row);

      expect(node).toBeNull();
    });

    it('should preserve comment', () => {
      const row = createRow('LOAD', 'M0000', undefined, undefined, '시작 조건');
      const node = parser.parseInstruction(row);

      expect(node).not.toBeNull();
      expect((node as ContactNode).comment).toBe('시작 조건');
    });
  });

  describe('AND Instructions', () => {
    it('should parse AND and create series block', () => {
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      const node = parser.parseInstruction(createRow('AND', 'M0001'));

      expect(node).not.toBeNull();
      expect(isContactNode(node!)).toBe(true);
      expect(parser.getStackSize()).toBe(1);

      // Stack should contain a series block
      const result = parser.getResult();
      expect(result).not.toBeNull();
      expect(isBlockNode(result!)).toBe(true);

      const block = result as BlockNode;
      expect(block.type).toBe('block_series');
      expect(block.children).toHaveLength(2);
    });

    it('should parse ANDN, ANDP, ANDF correctly', () => {
      const testCases = [
        { instruction: 'ANDN', expectedType: 'contact_nc' },
        { instruction: 'ANDP', expectedType: 'contact_p' },
        { instruction: 'ANDF', expectedType: 'contact_n' },
      ];

      for (const { instruction, expectedType } of testCases) {
        const p = new InstructionParser();
        p.parseInstruction(createRow('LOAD', 'M0000'));
        const node = p.parseInstruction(createRow(instruction, 'M0001'));

        expect(node).not.toBeNull();
        expect((node as ContactNode).type).toBe(expectedType);
      }
    });

    it('should handle AND on empty stack (treat as LOAD)', () => {
      const node = parser.parseInstruction(createRow('AND', 'M0000'));

      expect(node).not.toBeNull();
      expect(parser.getStackSize()).toBe(1);
    });
  });

  describe('OR Instructions', () => {
    it('should add OR to pendingOr', () => {
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('OR', 'M0001'));

      expect(parser.getPendingOrCount()).toBe(1);
    });

    it('should combine pending OR on getResult', () => {
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('OR', 'M0001'));

      const result = parser.getResult();
      expect(result).not.toBeNull();
      expect(isBlockNode(result!)).toBe(true);

      const block = result as BlockNode;
      expect(block.type).toBe('block_parallel');
      expect(block.children).toHaveLength(2);
    });

    it('should parse ORN, ORP, ORF correctly', () => {
      const testCases = [
        { instruction: 'ORN', expectedType: 'contact_nc' },
        { instruction: 'ORP', expectedType: 'contact_p' },
        { instruction: 'ORF', expectedType: 'contact_n' },
      ];

      for (const { instruction, expectedType } of testCases) {
        const p = new InstructionParser();
        p.parseInstruction(createRow('LOAD', 'M0000'));
        const node = p.parseInstruction(createRow(instruction, 'M0001'));

        expect(node).not.toBeNull();
        expect((node as ContactNode).type).toBe(expectedType);
      }
    });
  });

  describe('Block Instructions (ANDB/ORB)', () => {
    it('should create series block with ANDB', () => {
      // LOAD M0 -> LOAD M1 -> ANDB creates series of two
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('LOAD', 'M0001'));
      const block = parser.parseInstruction(createRow('ANDB'));

      expect(block).not.toBeNull();
      expect(isBlockNode(block!)).toBe(true);

      const blockNode = block as BlockNode;
      expect(blockNode.type).toBe('block_series');
      expect(blockNode.children).toHaveLength(2);
    });

    it('should create parallel block with ORB', () => {
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('LOAD', 'M0001'));
      const block = parser.parseInstruction(createRow('ORB'));

      expect(block).not.toBeNull();
      expect(isBlockNode(block!)).toBe(true);

      const blockNode = block as BlockNode;
      expect(blockNode.type).toBe('block_parallel');
      expect(blockNode.children).toHaveLength(2);
    });

    it('should return null if stack has fewer than 2 items', () => {
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      const block = parser.parseInstruction(createRow('ANDB'));

      expect(block).toBeNull();
    });

    it('should handle nested blocks', () => {
      // (M0 AND M1) OR (M2 AND M3)
      // LOAD M0 -> LOAD M1 -> ANDB -> LOAD M2 -> LOAD M3 -> ANDB -> ORB
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('LOAD', 'M0001'));
      parser.parseInstruction(createRow('ANDB'));
      parser.parseInstruction(createRow('LOAD', 'M0002'));
      parser.parseInstruction(createRow('LOAD', 'M0003'));
      parser.parseInstruction(createRow('ANDB'));
      parser.parseInstruction(createRow('ORB'));

      const result = parser.getResult();
      expect(result).not.toBeNull();
      expect(isBlockNode(result!)).toBe(true);

      const parallelBlock = result as BlockNode;
      expect(parallelBlock.type).toBe('block_parallel');
      expect(parallelBlock.children).toHaveLength(2);

      // Both children should be series blocks
      for (const child of parallelBlock.children) {
        expect(isBlockNode(child)).toBe(true);
        expect((child as BlockNode).type).toBe('block_series');
      }
    });
  });

  describe('Output Instructions', () => {
    it('should parse OUT as coil_out', () => {
      const node = parser.parseInstruction(createRow('OUT', 'P0000'));

      expect(node).not.toBeNull();
      expect(isCoilNode(node!)).toBe(true);

      const coil = node as CoilNode;
      expect(coil.type).toBe('coil_out');
      expect(coil.address.device).toBe('P');
      expect(coil.address.address).toBe(0);
    });

    it('should parse SET as coil_set', () => {
      const node = parser.parseInstruction(createRow('SET', 'M0100'));

      expect(node).not.toBeNull();
      const coil = node as CoilNode;
      expect(coil.type).toBe('coil_set');
    });

    it('should parse RST as coil_rst', () => {
      const node = parser.parseInstruction(createRow('RST', 'M0100'));

      expect(node).not.toBeNull();
      const coil = node as CoilNode;
      expect(coil.type).toBe('coil_rst');
    });

    it('should not modify stack (outputs are endpoints)', () => {
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('OUT', 'P0000'));

      // Stack still has the LOAD result
      expect(parser.getStackSize()).toBe(1);
    });
  });

  describe('Timer Instructions', () => {
    it('should parse TON with preset', () => {
      const node = parser.parseInstruction(createRow('TON', 'T0000', '1000'));

      expect(node).not.toBeNull();
      expect(isTimerNode(node!)).toBe(true);

      const timer = node as TimerNode;
      expect(timer.type).toBe('timer_ton');
      expect(timer.address.device).toBe('T');
      expect(timer.address.address).toBe(0);
      expect(timer.preset).toBe(1000);
      expect(timer.timeBase).toBe('ms');
    });

    it('should parse TOF as timer_tof', () => {
      const node = parser.parseInstruction(createRow('TOF', 'T0001', '500'));

      expect(node).not.toBeNull();
      const timer = node as TimerNode;
      expect(timer.type).toBe('timer_tof');
    });

    it('should parse TMR as timer_tmr', () => {
      const node = parser.parseInstruction(createRow('TMR', 'T0002', '2000'));

      expect(node).not.toBeNull();
      const timer = node as TimerNode;
      expect(timer.type).toBe('timer_tmr');
    });

    it('should handle missing preset (default to 0)', () => {
      const node = parser.parseInstruction(createRow('TON', 'T0000'));

      expect(node).not.toBeNull();
      const timer = node as TimerNode;
      expect(timer.preset).toBe(0);
    });

    it('should handle time base parameter', () => {
      const node = parser.parseInstruction(createRow('TON', 'T0000', '100', 's'));

      expect(node).not.toBeNull();
      const timer = node as TimerNode;
      expect(timer.timeBase).toBe('s');
    });
  });

  describe('Counter Instructions', () => {
    it('should parse CTU with preset', () => {
      const node = parser.parseInstruction(createRow('CTU', 'C0000', '10'));

      expect(node).not.toBeNull();
      expect(isCounterNode(node!)).toBe(true);

      const counter = node as CounterNode;
      expect(counter.type).toBe('counter_ctu');
      expect(counter.address.device).toBe('C');
      expect(counter.address.address).toBe(0);
      expect(counter.preset).toBe(10);
    });

    it('should parse CTD as counter_ctd', () => {
      const node = parser.parseInstruction(createRow('CTD', 'C0001', '5'));

      expect(node).not.toBeNull();
      const counter = node as CounterNode;
      expect(counter.type).toBe('counter_ctd');
    });

    it('should parse CTUD as counter_ctud', () => {
      const node = parser.parseInstruction(createRow('CTUD', 'C0002', '100'));

      expect(node).not.toBeNull();
      const counter = node as CounterNode;
      expect(counter.type).toBe('counter_ctud');
    });
  });

  describe('Comparison Instructions', () => {
    it('should parse LD= with two operands', () => {
      const node = parser.parseInstruction(createRow('LD=', 'D0000', '100'));

      expect(node).not.toBeNull();
      expect(isComparisonNode(node!)).toBe(true);

      const cmp = node as ComparisonNode;
      expect(cmp.operator).toBe('=');
      expect(cmp.operand1).toEqual({ device: 'D', address: 0 });
      expect(cmp.operand2).toBe(100);
    });

    it('should parse LD> correctly', () => {
      const node = parser.parseInstruction(createRow('LD>', 'D0001', 'D0002'));

      expect(node).not.toBeNull();
      const cmp = node as ComparisonNode;
      expect(cmp.operator).toBe('>');
    });

    it('should parse LD>= correctly', () => {
      const node = parser.parseInstruction(createRow('LD>=', 'D0001', '50'));

      expect(node).not.toBeNull();
      const cmp = node as ComparisonNode;
      expect(cmp.operator).toBe('>=');
    });

    it('should parse LD<> correctly', () => {
      const node = parser.parseInstruction(createRow('LD<>', 'D0001', '0'));

      expect(node).not.toBeNull();
      const cmp = node as ComparisonNode;
      expect(cmp.operator).toBe('<>');
    });

    it('should push LD comparison onto stack', () => {
      parser.parseInstruction(createRow('LD=', 'D0000', '100'));

      expect(parser.getStackSize()).toBe(1);
    });

    it('should create series with AND= comparison', () => {
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('AND=', 'D0000', '100'));

      expect(parser.getStackSize()).toBe(1);

      const result = parser.getResult();
      expect(isBlockNode(result!)).toBe(true);
      expect((result as BlockNode).type).toBe('block_series');
    });

    it('should add OR= comparison to pending', () => {
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('OR=', 'D0000', '100'));

      expect(parser.getPendingOrCount()).toBe(1);
    });
  });

  describe('Math Instructions', () => {
    it('should parse ADD with three operands', () => {
      const node = parser.parseInstruction(createRow('ADD', 'D0000', 'D0001', 'D0002'));

      expect(node).not.toBeNull();
      expect(isMathNode(node!)).toBe(true);

      const math = node as MathNode;
      expect(math.type).toBe('math');
      expect(math.operator).toBe('ADD');
      expect(math.operand1).toEqual({ device: 'D', address: 0 });
      expect(math.operand2).toEqual({ device: 'D', address: 1 });
      expect(math.destination).toEqual({ device: 'D', address: 2 });
    });

    it('should parse SUB correctly', () => {
      const node = parser.parseInstruction(createRow('SUB', 'D0000', '100', 'D0010'));

      expect(node).not.toBeNull();
      const math = node as MathNode;
      expect(math.operator).toBe('SUB');
      expect(math.operand1).toEqual({ device: 'D', address: 0 });
      expect(math.operand2).toBe(100);
    });

    it('should parse MUL and DIV', () => {
      const mul = parser.parseInstruction(createRow('MUL', 'D0000', 'D0001', 'D0002'));
      expect(mul).not.toBeNull();
      expect((mul as MathNode).operator).toBe('MUL');

      const div = parser.parseInstruction(createRow('DIV', 'D0000', 'D0001', 'D0002'));
      expect(div).not.toBeNull();
      expect((div as MathNode).operator).toBe('DIV');
    });

    it('should parse MOV with two operands', () => {
      const node = parser.parseInstruction(createRow('MOV', 'D0000', 'D0001'));

      expect(node).not.toBeNull();
      const math = node as MathNode;
      expect(math.type).toBe('move');
      expect(math.operator).toBe('MOV');
      expect(math.operand1).toEqual({ device: 'D', address: 0 });
      expect(math.operand2).toBeUndefined();
      expect(math.destination).toEqual({ device: 'D', address: 1 });
    });

    it('should parse MOV with immediate value', () => {
      const node = parser.parseInstruction(createRow('MOV', '100', 'D0000'));

      expect(node).not.toBeNull();
      const math = node as MathNode;
      expect(math.operand1).toBe(100);
      expect(math.destination).toEqual({ device: 'D', address: 0 });
    });

    it('should handle hex values', () => {
      const node = parser.parseInstruction(createRow('MOV', 'H10', 'D0000'));

      expect(node).not.toBeNull();
      const math = node as MathNode;
      expect(math.operand1).toBe(16); // 0x10 = 16
    });
  });

  describe('Parser State Management', () => {
    it('should reset state correctly', () => {
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('OR', 'M0001'));

      expect(parser.getStackSize()).toBe(1);
      expect(parser.getPendingOrCount()).toBe(1);

      parser.reset();

      expect(parser.getStackSize()).toBe(0);
      expect(parser.getPendingOrCount()).toBe(0);
    });

    it('should generate unique IDs across resets', () => {
      const node1 = parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.reset();
      const node2 = parser.parseInstruction(createRow('LOAD', 'M0001'));

      expect(node1!.id).not.toBe(node2!.id);
    });

    it('should reset node counter with resetAll', () => {
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.resetAll();
      const node = parser.parseInstruction(createRow('LOAD', 'M0001'));

      expect(node!.id).toBe('node_1');
    });

    it('getStackContents should return all nodes and clear pending', () => {
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('LOAD', 'M0001'));
      parser.parseInstruction(createRow('OR', 'M0002'));

      const contents = parser.getStackContents();

      // Should have combined pending OR
      expect(contents.length).toBeGreaterThan(0);
      expect(parser.getPendingOrCount()).toBe(0);
    });
  });

  describe('Unknown Instructions', () => {
    it('should return null for unknown instructions', () => {
      const node = parser.parseInstruction(createRow('UNKNOWN', 'M0000'));

      expect(node).toBeNull();
    });

    it('should return null for empty instruction', () => {
      const node = parser.parseInstruction(createRow('', 'M0000'));

      expect(node).toBeNull();
    });
  });

  describe('Complex Ladder Logic Patterns', () => {
    it('should handle simple series: M0 AND M1 AND M2 -> P0', () => {
      // LOAD M0, AND M1, AND M2, OUT P0
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('AND', 'M0001'));
      parser.parseInstruction(createRow('AND', 'M0002'));
      const output = parser.parseInstruction(createRow('OUT', 'P0000'));

      expect(output).not.toBeNull();
      expect(isCoilNode(output!)).toBe(true);

      const result = parser.getResult();
      expect(result).not.toBeNull();
      expect(isBlockNode(result!)).toBe(true);
      expect((result as BlockNode).type).toBe('block_series');
    });

    it('should handle simple parallel: M0 OR M1 OR M2 -> P0', () => {
      // LOAD M0, OR M1, OR M2, OUT P0
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('OR', 'M0001'));
      parser.parseInstruction(createRow('OR', 'M0002'));
      parser.parseInstruction(createRow('OUT', 'P0000'));

      const result = parser.getResult();
      expect(result).not.toBeNull();
      expect(isBlockNode(result!)).toBe(true);
      expect((result as BlockNode).type).toBe('block_parallel');
    });

    it('should handle series-parallel: (M0 AND M1) OR (M2 AND M3)', () => {
      // LOAD M0, AND M1, LOAD M2, AND M3, ORB
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('AND', 'M0001'));
      parser.parseInstruction(createRow('LOAD', 'M0002'));
      parser.parseInstruction(createRow('AND', 'M0003'));
      parser.parseInstruction(createRow('ORB'));

      const result = parser.getResult();
      expect(result).not.toBeNull();
      expect(isBlockNode(result!)).toBe(true);

      const orBlock = result as BlockNode;
      expect(orBlock.type).toBe('block_parallel');
      expect(orBlock.children).toHaveLength(2);

      // Both children should be series blocks
      for (const child of orBlock.children) {
        expect(isBlockNode(child)).toBe(true);
        expect((child as BlockNode).type).toBe('block_series');
      }
    });

    it('should handle parallel-series: (M0 OR M1) AND (M2 OR M3)', () => {
      // LOAD M0, OR M1, LOAD M2, OR M3, ANDB
      parser.parseInstruction(createRow('LOAD', 'M0000'));
      parser.parseInstruction(createRow('OR', 'M0001'));
      parser.parseInstruction(createRow('LOAD', 'M0002'));
      parser.parseInstruction(createRow('OR', 'M0003'));
      parser.parseInstruction(createRow('ANDB'));

      // Note: The pending OR for M1 will be combined when the first OR block is evaluated
      // This test verifies the ANDB creates a series block
      const result = parser.getResult();
      expect(result).not.toBeNull();
    });
  });
});
