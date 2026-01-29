/**
 * Tests for Grid Converter Utility
 *
 * Tests the conversion from OneParser AST to ladder grid elements
 */

import { describe, it, expect } from 'vitest';
import {
  convertNodeToGrid,
  convertNetworkToGrid,
  convertToEditorNetwork,
  convertMultipleNetworks,
  flattenNodes,
  getNodeStats,
} from '../gridConverter';
import type {
  ContactNode,
  CoilNode,
  TimerNode,
  CounterNode,
  ComparisonNode,
  BlockNode,
  LadderNode,
  LadderNetwork as LadderNetworkAST,
  DeviceAddress,
} from '../../../OneParser/types';
import { isContactElement, isCoilElement, isTimerElement, isCounterElement } from '../../../../types/ladder';

// ============================================================================
// Test Fixtures
// ============================================================================

function createAddress(device: string, address: number): DeviceAddress {
  return { device: device as DeviceAddress['device'], address };
}

function createContactNode(
  type: ContactNode['type'],
  device: string,
  address: number,
  row = 0,
  col = 0
): ContactNode {
  return {
    id: `contact-${device}${address}`,
    type,
    address: createAddress(device, address),
    gridPosition: { row, col },
  };
}

function createCoilNode(
  type: CoilNode['type'],
  device: string,
  address: number,
  row = 0,
  col = 0
): CoilNode {
  return {
    id: `coil-${device}${address}`,
    type,
    address: createAddress(device, address),
    gridPosition: { row, col },
  };
}

function createTimerNode(
  type: TimerNode['type'],
  address: number,
  preset: number,
  row = 0,
  col = 0
): TimerNode {
  return {
    id: `timer-T${address}`,
    type,
    address: createAddress('T', address),
    preset,
    timeBase: 'ms',
    gridPosition: { row, col },
  };
}

function createCounterNode(
  type: CounterNode['type'],
  address: number,
  preset: number,
  row = 0,
  col = 0
): CounterNode {
  return {
    id: `counter-C${address}`,
    type,
    address: createAddress('C', address),
    preset,
    gridPosition: { row, col },
  };
}

function createComparisonNode(
  operator: ComparisonNode['operator'],
  operand1: DeviceAddress | number,
  operand2: DeviceAddress | number,
  row = 0,
  col = 0
): ComparisonNode {
  return {
    id: `compare-${row}-${col}`,
    type: 'comparison',
    operator,
    operand1,
    operand2,
    gridPosition: { row, col },
  };
}

function createSeriesBlock(children: LadderNode[]): BlockNode {
  return {
    id: `series-${Date.now()}`,
    type: 'block_series',
    children,
    gridPosition: { row: 0, col: 0 },
  };
}

function createParallelBlock(children: LadderNode[]): BlockNode {
  return {
    id: `parallel-${Date.now()}`,
    type: 'block_parallel',
    children,
    gridPosition: { row: 0, col: 0 },
  };
}

function createTestNetwork(nodes: LadderNode[], step = 0): LadderNetworkAST {
  return {
    id: `network-${step}`,
    step,
    nodes,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('gridConverter', () => {
  describe('convertNodeToGrid - Single Elements', () => {
    it('should convert a single contact_no to grid element', () => {
      const node = createContactNode('contact_no', 'M', 0);
      const result = convertNodeToGrid(node);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].type).toBe('contact_no');
      expect(result.elements[0].address).toBe('M0000');
      expect(result.elements[0].position).toEqual({ row: 0, col: 0 });
    });

    it('should convert a single contact_nc to grid element', () => {
      const node = createContactNode('contact_nc', 'M', 1);
      const result = convertNodeToGrid(node);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].type).toBe('contact_nc');
    });

    it('should convert contact_p with rising edge property', () => {
      const node = createContactNode('contact_p', 'M', 2);
      const result = convertNodeToGrid(node);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].type).toBe('contact_p');
      expect(isContactElement(result.elements[0])).toBe(true);
      if (isContactElement(result.elements[0])) {
        expect(result.elements[0].properties.edgeDetection).toBe('rising');
      }
    });

    it('should convert contact_n with falling edge property', () => {
      const node = createContactNode('contact_n', 'M', 3);
      const result = convertNodeToGrid(node);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].type).toBe('contact_n');
      if (isContactElement(result.elements[0])) {
        expect(result.elements[0].properties.edgeDetection).toBe('falling');
      }
    });

    it('should convert coil_out to coil element', () => {
      const node = createCoilNode('coil_out', 'P', 0);
      const result = convertNodeToGrid(node);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].type).toBe('coil');
      expect(result.elements[0].address).toBe('P0000');
    });

    it('should convert coil_set to coil_set element', () => {
      const node = createCoilNode('coil_set', 'P', 1);
      const result = convertNodeToGrid(node);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].type).toBe('coil_set');
      if (isCoilElement(result.elements[0])) {
        expect(result.elements[0].properties.latched).toBe(true);
      }
    });

    it('should convert coil_rst to coil_reset element', () => {
      const node = createCoilNode('coil_rst', 'P', 2);
      const result = convertNodeToGrid(node);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].type).toBe('coil_reset');
    });

    it('should convert timer_ton element with preset', () => {
      const node = createTimerNode('timer_ton', 0, 1000);
      const result = convertNodeToGrid(node);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].type).toBe('timer_ton');
      expect(isTimerElement(result.elements[0])).toBe(true);
      if (isTimerElement(result.elements[0])) {
        expect(result.elements[0].properties.presetTime).toBe(1000);
        expect(result.elements[0].properties.timeBase).toBe('ms');
      }
    });

    it('should convert counter_ctu element with preset', () => {
      const node = createCounterNode('counter_ctu', 0, 10);
      const result = convertNodeToGrid(node);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].type).toBe('counter_ctu');
      expect(isCounterElement(result.elements[0])).toBe(true);
      if (isCounterElement(result.elements[0])) {
        expect(result.elements[0].properties.presetValue).toBe(10);
        expect(result.elements[0].properties.direction).toBe('up');
      }
    });

    it('should convert counter_ctd with down direction', () => {
      const node = createCounterNode('counter_ctd', 1, 5);
      const result = convertNodeToGrid(node);

      if (isCounterElement(result.elements[0])) {
        expect(result.elements[0].properties.direction).toBe('down');
      }
    });

    it('should convert counter_ctud with both direction', () => {
      const node = createCounterNode('counter_ctud', 2, 20);
      const result = convertNodeToGrid(node);

      if (isCounterElement(result.elements[0])) {
        expect(result.elements[0].properties.direction).toBe('both');
      }
    });

    it('should convert comparison node to compare element', () => {
      const node = createComparisonNode('>', createAddress('D', 0), 100);
      const result = convertNodeToGrid(node);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].type).toBe('compare_gt');
    });
  });

  describe('convertNodeToGrid - Series Block', () => {
    it('should convert series block with contacts horizontally', () => {
      const block = createSeriesBlock([
        createContactNode('contact_no', 'M', 0),
        createContactNode('contact_no', 'M', 1),
        createContactNode('contact_no', 'M', 2),
      ]);

      const result = convertNodeToGrid(block);

      expect(result.elements).toHaveLength(3);
      expect(result.rowCount).toBe(1);
      expect(result.maxColumn).toBe(2);

      // Elements should be placed horizontally
      expect(result.elements[0].position.col).toBe(0);
      expect(result.elements[1].position.col).toBe(1);
      expect(result.elements[2].position.col).toBe(2);

      // All on same row
      expect(result.elements[0].position.row).toBe(0);
      expect(result.elements[1].position.row).toBe(0);
      expect(result.elements[2].position.row).toBe(0);
    });

    it('should generate wires between series elements', () => {
      const block = createSeriesBlock([
        createContactNode('contact_no', 'M', 0),
        createContactNode('contact_no', 'M', 1),
      ]);

      const result = convertNodeToGrid(block);

      expect(result.wires).toHaveLength(1);
      expect(result.wires[0].type).toBe('horizontal');
    });

    it('should handle series block with mixed element types', () => {
      const block = createSeriesBlock([
        createContactNode('contact_no', 'M', 0),
        createTimerNode('timer_ton', 0, 1000),
        createCoilNode('coil_out', 'P', 0),
      ]);

      const result = convertNodeToGrid(block);

      expect(result.elements).toHaveLength(3);
      expect(result.elements[0].type).toBe('contact_no');
      expect(result.elements[1].type).toBe('timer_ton');
      expect(result.elements[2].type).toBe('coil');
    });
  });

  describe('convertNodeToGrid - Parallel Block', () => {
    it('should convert parallel block with contacts vertically', () => {
      const block = createParallelBlock([
        createContactNode('contact_no', 'M', 0),
        createContactNode('contact_no', 'M', 1),
        createContactNode('contact_no', 'M', 2),
      ]);

      const result = convertNodeToGrid(block);

      expect(result.elements).toHaveLength(3);
      expect(result.rowCount).toBe(3);
      expect(result.maxColumn).toBe(0);

      // Elements should be placed vertically
      expect(result.elements[0].position.row).toBe(0);
      expect(result.elements[1].position.row).toBe(1);
      expect(result.elements[2].position.row).toBe(2);

      // All on same column
      expect(result.elements[0].position.col).toBe(0);
      expect(result.elements[1].position.col).toBe(0);
      expect(result.elements[2].position.col).toBe(0);
    });
  });

  describe('convertNodeToGrid - Nested Blocks', () => {
    it('should handle series within parallel', () => {
      const block = createParallelBlock([
        createSeriesBlock([
          createContactNode('contact_no', 'M', 0),
          createContactNode('contact_no', 'M', 1),
        ]),
        createContactNode('contact_no', 'M', 2),
      ]);

      const result = convertNodeToGrid(block);

      expect(result.elements).toHaveLength(3);
      expect(result.rowCount).toBe(2);
      expect(result.maxColumn).toBe(1);
    });

    it('should handle parallel within series', () => {
      const block = createSeriesBlock([
        createContactNode('contact_no', 'M', 0),
        createParallelBlock([
          createContactNode('contact_no', 'M', 1),
          createContactNode('contact_no', 'M', 2),
        ]),
        createCoilNode('coil_out', 'P', 0),
      ]);

      const result = convertNodeToGrid(block);

      expect(result.elements).toHaveLength(4);
      // First contact at col 0, parallel block at col 1, coil at col 2
      expect(result.elements[0].position.col).toBe(0);
      expect(result.elements[3].position.col).toBe(2);
    });
  });

  describe('convertNodeToGrid - Position Options', () => {
    it('should respect startRow option', () => {
      const node = createContactNode('contact_no', 'M', 0);
      const result = convertNodeToGrid(node, { startRow: 5 });

      expect(result.elements[0].position.row).toBe(5);
    });

    it('should respect startCol option', () => {
      const node = createContactNode('contact_no', 'M', 0);
      const result = convertNodeToGrid(node, { startCol: 3 });

      expect(result.elements[0].position.col).toBe(3);
    });

    it('should respect both startRow and startCol', () => {
      const block = createSeriesBlock([
        createContactNode('contact_no', 'M', 0),
        createContactNode('contact_no', 'M', 1),
      ]);
      const result = convertNodeToGrid(block, { startRow: 2, startCol: 4 });

      expect(result.elements[0].position).toEqual({ row: 2, col: 4 });
      expect(result.elements[1].position).toEqual({ row: 2, col: 5 });
    });
  });

  describe('convertNetworkToGrid', () => {
    it('should convert network with single node', () => {
      const network = createTestNetwork([
        createContactNode('contact_no', 'M', 0),
      ]);

      const result = convertNetworkToGrid(network);

      expect(result.elements).toHaveLength(1);
    });

    it('should convert network with multiple top-level nodes', () => {
      const network = createTestNetwork([
        createContactNode('contact_no', 'M', 0),
        createCoilNode('coil_out', 'P', 0),
      ]);

      const result = convertNetworkToGrid(network);

      expect(result.elements).toHaveLength(2);
      expect(result.wires.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('convertToEditorNetwork', () => {
    it('should return editor network format with Map elements', () => {
      const astNetwork = createTestNetwork([
        createContactNode('contact_no', 'M', 0),
        createCoilNode('coil_out', 'P', 0),
      ], 1);

      const result = convertToEditorNetwork(astNetwork);

      expect(result.id).toBe(astNetwork.id);
      expect(result.label).toBe('Network 1');
      expect(result.elements instanceof Map).toBe(true);
      expect(result.elements.size).toBe(2);
      expect(result.enabled).toBe(true);
    });

    it('should include network comment', () => {
      const astNetwork: LadderNetworkAST = {
        id: 'net-1',
        step: 0,
        nodes: [createContactNode('contact_no', 'M', 0)],
        comment: 'Test network comment',
      };

      const result = convertToEditorNetwork(astNetwork);

      expect(result.comment).toBe('Test network comment');
    });
  });

  describe('convertMultipleNetworks', () => {
    it('should convert multiple networks', () => {
      const networks = [
        createTestNetwork([createContactNode('contact_no', 'M', 0)], 0),
        createTestNetwork([createContactNode('contact_no', 'M', 1)], 1),
        createTestNetwork([createContactNode('contact_no', 'M', 2)], 2),
      ];

      const result = convertMultipleNetworks(networks);

      expect(result).toHaveLength(3);
      expect(result[0].label).toBe('Network 0');
      expect(result[1].label).toBe('Network 1');
      expect(result[2].label).toBe('Network 2');
    });
  });

  describe('flattenNodes', () => {
    it('should return single node as array', () => {
      const node = createContactNode('contact_no', 'M', 0);
      const result = flattenNodes(node);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(node);
    });

    it('should flatten series block', () => {
      const block = createSeriesBlock([
        createContactNode('contact_no', 'M', 0),
        createContactNode('contact_no', 'M', 1),
      ]);

      const result = flattenNodes(block);

      expect(result).toHaveLength(3); // block + 2 children
    });

    it('should flatten nested blocks', () => {
      const block = createSeriesBlock([
        createParallelBlock([
          createContactNode('contact_no', 'M', 0),
          createContactNode('contact_no', 'M', 1),
        ]),
        createContactNode('contact_no', 'M', 2),
      ]);

      const result = flattenNodes(block);

      // series block + parallel block + 3 contacts
      expect(result).toHaveLength(5);
    });
  });

  describe('getNodeStats', () => {
    it('should count single contact', () => {
      const node = createContactNode('contact_no', 'M', 0);
      const stats = getNodeStats(node);

      expect(stats.totalNodes).toBe(1);
      expect(stats.contacts).toBe(1);
      expect(stats.coils).toBe(0);
      expect(stats.blocks).toBe(0);
    });

    it('should count all node types in complex structure', () => {
      const block = createSeriesBlock([
        createContactNode('contact_no', 'M', 0),
        createParallelBlock([
          createTimerNode('timer_ton', 0, 1000),
          createCounterNode('counter_ctu', 0, 10),
        ]),
        createCoilNode('coil_out', 'P', 0),
      ]);

      const stats = getNodeStats(block);

      expect(stats.totalNodes).toBe(6);
      expect(stats.contacts).toBe(1);
      expect(stats.coils).toBe(1);
      expect(stats.timers).toBe(1);
      expect(stats.counters).toBe(1);
      expect(stats.blocks).toBe(2);
    });
  });

  describe('Wire Generation', () => {
    it('should generate correct number of wires for series', () => {
      const block = createSeriesBlock([
        createContactNode('contact_no', 'M', 0),
        createContactNode('contact_no', 'M', 1),
        createContactNode('contact_no', 'M', 2),
      ]);

      const result = convertNodeToGrid(block);

      // 3 elements in series = 2 wires
      expect(result.wires).toHaveLength(2);
    });

    it('should have correct wire endpoints', () => {
      const block = createSeriesBlock([
        createContactNode('contact_no', 'M', 0),
        createContactNode('contact_no', 'M', 1),
      ]);

      const result = convertNodeToGrid(block);

      expect(result.wires).toHaveLength(1);
      const wire = result.wires[0];

      expect(wire.from.elementId).toBe(result.elements[0].id);
      expect(wire.from.port).toBe('right');
      expect(wire.to.elementId).toBe(result.elements[1].id);
      expect(wire.to.port).toBe('left');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty series block', () => {
      const block = createSeriesBlock([]);
      const result = convertNodeToGrid(block);

      expect(result.elements).toHaveLength(0);
      expect(result.wires).toHaveLength(0);
    });

    it('should handle empty parallel block', () => {
      const block = createParallelBlock([]);
      const result = convertNodeToGrid(block);

      expect(result.elements).toHaveLength(0);
      expect(result.wires).toHaveLength(0);
    });

    it('should handle single element in series block', () => {
      const block = createSeriesBlock([
        createContactNode('contact_no', 'M', 0),
      ]);

      const result = convertNodeToGrid(block);

      expect(result.elements).toHaveLength(1);
      expect(result.wires).toHaveLength(0);
    });

    it('should handle deeply nested structure', () => {
      const block = createSeriesBlock([
        createParallelBlock([
          createSeriesBlock([
            createParallelBlock([
              createContactNode('contact_no', 'M', 0),
              createContactNode('contact_no', 'M', 1),
            ]),
          ]),
          createContactNode('contact_no', 'M', 2),
        ]),
      ]);

      const result = convertNodeToGrid(block);

      expect(result.elements).toHaveLength(3);
    });
  });
});
