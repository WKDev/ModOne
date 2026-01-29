/**
 * Tests for AstBuilder and GridCalculator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AstBuilder } from '../AstBuilder';
import { GridCalculator } from '../GridCalculator';
import { isBlockNode } from '../types';

// Sample CSV content for testing
const SIMPLE_CSV = `No,Step,Instruction,Operand1,Operand2,Operand3,Comment
1,0,LOAD,M0000,,,Start condition
2,0,OUT,P0000,,,Output
`;

const SERIES_CSV = `No,Step,Instruction,Operand1,Operand2,Operand3,Comment
1,0,LOAD,M0000,,,Input 1
2,0,AND,M0001,,,Input 2
3,0,AND,M0002,,,Input 3
4,0,OUT,P0000,,,Output
`;

const PARALLEL_CSV = `No,Step,Instruction,Operand1,Operand2,Operand3,Comment
1,0,LOAD,M0000,,,Branch 1
2,0,OR,M0001,,,Branch 2
3,0,OR,M0002,,,Branch 3
4,0,OUT,P0000,,,Output
`;

const MULTI_NETWORK_CSV = `No,Step,Instruction,Operand1,Operand2,Operand3,Comment
1,0,LOAD,M0000,,,Network 0
2,0,OUT,P0000,,,
3,1,LOAD,M0001,,,Network 1
4,1,OUT,P0001,,,
5,2,LOAD,M0002,,,Network 2
6,2,OUT,P0002,,,
`;

const COMPLEX_CSV = `No,Step,Instruction,Operand1,Operand2,Operand3,Comment
1,0,LOAD,M0000,,,Series-Parallel test
2,0,AND,M0001,,,
3,0,LOAD,M0002,,,
4,0,AND,M0003,,,
5,0,ORB,,,,
6,0,OUT,P0000,,,
`;

describe('AstBuilder', () => {
  let builder: AstBuilder;

  beforeEach(() => {
    builder = new AstBuilder();
  });

  describe('buildProgram', () => {
    it('should build a program from simple CSV', () => {
      const program = builder.buildProgram(SIMPLE_CSV);

      expect(program).toBeDefined();
      expect(program.networks).toHaveLength(1);
      expect(program.metadata.name).toBe('Untitled Program');
    });

    it('should apply provided metadata', () => {
      const program = builder.buildProgram(SIMPLE_CSV, {
        name: 'Test Program',
        author: 'Test Author',
        version: '2.0.0',
      });

      expect(program.metadata.name).toBe('Test Program');
      expect(program.metadata.author).toBe('Test Author');
      expect(program.metadata.version).toBe('2.0.0');
    });

    it('should set timestamps', () => {
      const program = builder.buildProgram(SIMPLE_CSV);

      expect(program.metadata.createdAt).toBeDefined();
      expect(program.metadata.modifiedAt).toBeDefined();
    });

    it('should build multiple networks from CSV with different steps', () => {
      const program = builder.buildProgram(MULTI_NETWORK_CSV);

      expect(program.networks).toHaveLength(3);
      expect(program.networks[0].step).toBe(0);
      expect(program.networks[1].step).toBe(1);
      expect(program.networks[2].step).toBe(2);
    });

    it('should capture network comments', () => {
      const program = builder.buildProgram(SIMPLE_CSV);

      expect(program.networks[0].comment).toBe('Start condition');
    });
  });

  describe('Symbol Table', () => {
    it('should extract device addresses to symbol table', () => {
      const program = builder.buildProgram(SIMPLE_CSV);

      expect(program.symbolTable.entries.size).toBeGreaterThan(0);
      expect(program.symbolTable.entries.has('M0000')).toBe(true);
      expect(program.symbolTable.entries.has('P0000')).toBe(true);
    });

    it('should store comments in symbol table entries', () => {
      const program = builder.buildProgram(SIMPLE_CSV);

      const entry = program.symbolTable.entries.get('M0000');
      expect(entry).toBeDefined();
      expect(entry?.comment).toBe('Start condition');
    });

    it('should not duplicate symbol table entries', () => {
      const csv = `No,Step,Instruction,Operand1,Comment
1,0,LOAD,M0000,Comment 1
2,0,AND,M0000,Comment 2
3,0,OUT,P0000,
`;
      const program = builder.buildProgram(csv);

      // M0000 should only appear once
      let count = 0;
      program.symbolTable.entries.forEach((_, key) => {
        if (key === 'M0000') count++;
      });
      expect(count).toBe(1);
    });
  });

  describe('Grid Position Calculation', () => {
    it('should calculate positions for series connections', () => {
      const program = builder.buildProgram(SERIES_CSV);
      const network = program.networks[0];

      // Find leaf nodes (non-block)
      const leafNodes = network.nodes.filter((n) => !isBlockNode(n));

      // Should have at least some contacts
      expect(leafNodes.length).toBeGreaterThanOrEqual(1);

      // All nodes should have valid grid positions
      for (const node of leafNodes) {
        expect(node.gridPosition).toBeDefined();
        expect(node.gridPosition.row).toBeGreaterThanOrEqual(0);
        expect(node.gridPosition.col).toBeGreaterThanOrEqual(0);
      }
    });

    it('should calculate positions for parallel connections', () => {
      const program = builder.buildProgram(PARALLEL_CSV);
      const network = program.networks[0];

      const leafNodes = network.nodes.filter((n) => !isBlockNode(n));

      // Parallel branches should have different rows
      const rows = new Set(leafNodes.map((n) => n.gridPosition.row));
      expect(rows.size).toBeGreaterThan(1);
    });

    it('should handle complex series-parallel structures', () => {
      const program = builder.buildProgram(COMPLEX_CSV);
      const network = program.networks[0];

      expect(network.nodes.length).toBeGreaterThan(0);

      // Should contain block nodes for the structure
      const blockNodes = network.nodes.filter(isBlockNode);
      expect(blockNodes.length).toBeGreaterThan(0);
    });
  });

  describe('Node Flattening', () => {
    it('should flatten all nodes including block containers', () => {
      const program = builder.buildProgram(SERIES_CSV);
      const network = program.networks[0];

      // Flattened array should include all nodes
      expect(network.nodes.length).toBeGreaterThan(0);
    });

    it('should include block nodes in flattened output', () => {
      const program = builder.buildProgram(SERIES_CSV);
      const network = program.networks[0];

      const blockNodes = network.nodes.filter(isBlockNode);
      // Series of 3 AND operations should create block nodes
      expect(blockNodes.length).toBeGreaterThan(0);
    });
  });

  describe('buildSingleNetwork', () => {
    it('should build a single network from CSV', () => {
      const csv = `No,Step,Instruction,Operand1,Comment
1,0,LOAD,M0000,Test
2,0,OUT,P0000,
`;
      const network = builder.buildSingleNetwork(csv, 5);

      expect(network).not.toBeNull();
      expect(network?.step).toBe(5);
      expect(network?.nodes.length).toBeGreaterThan(0);
    });
  });
});

describe('GridCalculator', () => {
  let builder: AstBuilder;
  let calculator: GridCalculator;

  beforeEach(() => {
    builder = new AstBuilder();
    calculator = new GridCalculator();
  });

  describe('recalculate', () => {
    it('should calculate grid dimensions', () => {
      const program = builder.buildProgram(SERIES_CSV);
      const network = program.networks[0];
      const dims = calculator.recalculate(network);

      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    });

    it('should return larger width for series connections', () => {
      const program = builder.buildProgram(SERIES_CSV);
      const network = program.networks[0];
      const dims = calculator.recalculate(network);

      // Series should have more columns than rows
      expect(dims.width).toBeGreaterThanOrEqual(3);
    });

    it('should return larger height for parallel connections', () => {
      const program = builder.buildProgram(PARALLEL_CSV);
      const network = program.networks[0];
      const dims = calculator.recalculate(network);

      // Parallel should have multiple rows
      expect(dims.height).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getNodesAt', () => {
    it('should return nodes at specified position', () => {
      const csv = `No,Step,Instruction,Operand1
1,0,LOAD,M0000
2,0,OUT,P0000
`;
      const program = builder.buildProgram(csv);
      const network = program.networks[0];

      // First node should be at (0, 0)
      const nodesAtOrigin = calculator.getNodesAt(network, 0, 0);
      expect(nodesAtOrigin.length).toBeGreaterThan(0);
    });

    it('should return empty array for unoccupied position', () => {
      const program = builder.buildProgram(SIMPLE_CSV);
      const network = program.networks[0];

      const nodesAt = calculator.getNodesAt(network, 100, 100);
      expect(nodesAt).toHaveLength(0);
    });

    it('should exclude block nodes', () => {
      const program = builder.buildProgram(SERIES_CSV);
      const network = program.networks[0];

      const nodesAt = calculator.getNodesAt(network, 0, 0);
      for (const node of nodesAt) {
        expect(isBlockNode(node)).toBe(false);
      }
    });
  });

  describe('isOccupied', () => {
    it('should return true for occupied cell', () => {
      const program = builder.buildProgram(SIMPLE_CSV);
      const network = program.networks[0];

      expect(calculator.isOccupied(network, 0, 0)).toBe(true);
    });

    it('should return false for empty cell', () => {
      const program = builder.buildProgram(SIMPLE_CSV);
      const network = program.networks[0];

      expect(calculator.isOccupied(network, 100, 100)).toBe(false);
    });
  });

  describe('getAllPositions', () => {
    it('should return all unique positions', () => {
      const program = builder.buildProgram(SERIES_CSV);
      const network = program.networks[0];

      const positions = calculator.getAllPositions(network);
      expect(positions.length).toBeGreaterThan(0);

      // Check uniqueness
      const keys = positions.map((p) => `${p.row},${p.col}`);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });
  });

  describe('getLeafNodes', () => {
    it('should return only non-block nodes', () => {
      const program = builder.buildProgram(COMPLEX_CSV);
      const network = program.networks[0];

      const leafNodes = calculator.getLeafNodes(network);

      for (const node of leafNodes) {
        expect(isBlockNode(node)).toBe(false);
      }
    });
  });

  describe('getNodesByType', () => {
    it('should filter nodes by type', () => {
      const program = builder.buildProgram(SERIES_CSV);
      const network = program.networks[0];

      const contacts = calculator.getNodesByType(network, 'contact_no');
      for (const node of contacts) {
        expect(node.type).toBe('contact_no');
      }
    });
  });

  describe('getBounds', () => {
    it('should calculate bounding box', () => {
      const program = builder.buildProgram(SERIES_CSV);
      const network = program.networks[0];
      const leafNodes = calculator.getLeafNodes(network);

      const bounds = calculator.getBounds(leafNodes);

      expect(bounds.minRow).toBeLessThanOrEqual(bounds.maxRow);
      expect(bounds.minCol).toBeLessThanOrEqual(bounds.maxCol);
    });

    it('should return zeros for empty array', () => {
      const bounds = calculator.getBounds([]);

      expect(bounds.minRow).toBe(0);
      expect(bounds.maxRow).toBe(0);
      expect(bounds.minCol).toBe(0);
      expect(bounds.maxCol).toBe(0);
    });
  });
});
