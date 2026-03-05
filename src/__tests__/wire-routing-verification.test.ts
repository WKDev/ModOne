import { describe, expect, it } from 'vitest';
import goldenPositions from './fixtures/port-positions.json';
import { getBlockDefinition } from '../components/OneCanvas/blockDefinitions';
import { getPortAbsolutePosition, getWireEndpoints } from '../components/OneCanvas/utils/wirePathCalculator';
import { computeWireBendPoints } from '../components/OneCanvas/utils/canvasHelpers';
import type { Block, BlockType, PortPosition, Position } from '../components/OneCanvas/types';

type BuiltInBlockType = Exclude<BlockType, 'custom_symbol'>;

function createTestBlock(type: BlockType, position: Position, id: string): Block {
  const def = getBlockDefinition(type);

  return {
    id,
    type,
    position,
    size: def.size,
    ports: def.defaultPorts.map((port) => ({ ...port })),
  } as Block;
}

function assertOrthogonalPath(path: Position[]): void {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const sameX = a.x === b.x;
    const sameY = a.y === b.y;
    expect(sameX || sameY).toBe(true);
  }
}

function assertEndpointsMatchPortPositions(
  fromBlock: Block,
  fromPortId: string,
  toBlock: Block,
  toPortId: string,
  blocks: Map<string, Block>
): { fromPos: Position; toPos: Position } {
  const endpoints = getWireEndpoints(
    { componentId: fromBlock.id, portId: fromPortId },
    { componentId: toBlock.id, portId: toPortId },
    blocks
  );

  expect(endpoints).not.toBeNull();
  if (!endpoints) {
    throw new Error('Expected endpoints to resolve');
  }

  const expectedFromPos = getPortAbsolutePosition(fromBlock, fromPortId);
  const expectedToPos = getPortAbsolutePosition(toBlock, toPortId);

  expect(expectedFromPos).not.toBeNull();
  expect(expectedToPos).not.toBeNull();
  expect(endpoints.fromPos).toEqual(expectedFromPos);
  expect(endpoints.toPos).toEqual(expectedToPos);

  return endpoints;
}

function assertRoutedPathIsOrthogonal(
  from: { componentId: string; portId: string },
  to: { componentId: string; portId: string },
  blocks: Map<string, Block>,
  fromDirection: PortPosition,
  toDirection: PortPosition,
  endpoints: { fromPos: Position; toPos: Position }
): void {
  const bendPoints = computeWireBendPoints(from, to, blocks, fromDirection, toDirection);
  const fullPath = [
    endpoints.fromPos,
    ...(bendPoints?.map((handle) => handle.position) ?? []),
    endpoints.toPos,
  ];

  assertOrthogonalPath(fullPath);
}

describe('wire routing verification after port coordinate migration', () => {
  it('routes relay.no -> button.in with orthogonal segments and exact endpoints', () => {
    const relay = createTestBlock('relay', { x: 100, y: 100 }, 'relay1');
    const button = createTestBlock('button', { x: 300, y: 100 }, 'button1');
    const blocks = new Map<string, Block>([
      ['relay1', relay],
      ['button1', button],
    ]);

    const endpoints = assertEndpointsMatchPortPositions(relay, 'no', button, 'in', blocks);

    expect(endpoints.fromPos).toEqual({ x: 160, y: 121 });
    expect(endpoints.toPos).toEqual({ x: 300, y: 120 });

    assertRoutedPathIsOrthogonal(
      { componentId: 'relay1', portId: 'no' },
      { componentId: 'button1', portId: 'in' },
      blocks,
      'right',
      'left',
      endpoints
    );
  });

  it('routes motor.pe -> overload_relay.l1_in with orthogonal segments and exact endpoints', () => {
    const motor = createTestBlock('motor', { x: 100, y: 100 }, 'motor1');
    const overloadRelay = createTestBlock('overload_relay', { x: 115, y: 280 }, 'overload1');
    const blocks = new Map<string, Block>([
      ['motor1', motor],
      ['overload1', overloadRelay],
    ]);

    const endpoints = assertEndpointsMatchPortPositions(motor, 'pe', overloadRelay, 'l1_in', blocks);

    expect(endpoints.fromPos).toEqual({ x: 130, y: 160 });
    expect(endpoints.toPos).toEqual({ x: 130, y: 280 });

    assertRoutedPathIsOrthogonal(
      { componentId: 'motor1', portId: 'pe' },
      { componentId: 'overload1', portId: 'l1_in' },
      blocks,
      'bottom',
      'top',
      endpoints
    );
  });

  it('routes plc_in.out -> plc_out.in with orthogonal segments and exact endpoints', () => {
    const plcIn = createTestBlock('plc_in', { x: 100, y: 200 }, 'plcIn1');
    const plcOut = createTestBlock('plc_out', { x: 320, y: 200 }, 'plcOut1');
    const blocks = new Map<string, Block>([
      ['plcIn1', plcIn],
      ['plcOut1', plcOut],
    ]);

    const endpoints = assertEndpointsMatchPortPositions(plcIn, 'out', plcOut, 'in', blocks);

    expect(endpoints.fromPos).toEqual({ x: 180, y: 220 });
    expect(endpoints.toPos).toEqual({ x: 320, y: 220 });

    assertRoutedPathIsOrthogonal(
      { componentId: 'plcIn1', portId: 'out' },
      { componentId: 'plcOut1', portId: 'in' },
      blocks,
      'right',
      'left',
      endpoints
    );
  });

  it('wire endpoints match golden port positions', () => {
    const entries = Object.entries(goldenPositions) as Array<[
      BuiltInBlockType,
      (typeof goldenPositions)[BuiltInBlockType]
    ]>;

    for (const [blockType, golden] of entries) {
      const block = createTestBlock(blockType, { x: 0, y: 0 }, `test-${blockType}`);
      for (const [portId, expectedPos] of Object.entries(golden.ports)) {
        const absPos = getPortAbsolutePosition(block, portId);
        expect(absPos).toEqual(expectedPos);
      }
    }
  });
});
