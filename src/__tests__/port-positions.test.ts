import { describe, expect, it } from 'vitest';
import goldenPositions from './fixtures/port-positions.json';
import { getBlockDefinition } from '../components/OneCanvas/blockDefinitions';
import type { BlockType, PortPosition } from '../components/OneCanvas/types';

type BuiltInBlockType = Exclude<BlockType, 'custom_symbol'>;

function computePortCenter(
  position: PortPosition,
  offset: number = 0.5,
  blockSize: { width: number; height: number }
): { x: number; y: number } {
  const { width, height } = blockSize;
  switch (position) {
    case 'top':
      return { x: width * offset, y: 0 };
    case 'bottom':
      return { x: width * offset, y: height };
    case 'left':
      return { x: 0, y: height * offset };
    case 'right':
      return { x: width, y: height * offset };
    default:
      return { x: width / 2, y: height / 2 };
  }
}

const blockTypes = Object.keys(goldenPositions) as BuiltInBlockType[];

describe('port position golden file', () => {
  it('covers all block types in golden file', () => {
    expect(blockTypes.length).toBeGreaterThan(0);
  });

  describe.each(blockTypes)('%s', (blockType) => {
    const golden = goldenPositions[blockType as keyof typeof goldenPositions];
    const def = getBlockDefinition(blockType);

    it('has correct size', () => {
      expect(def.size).toEqual(golden.size);
    });

    it('has correct port positions', () => {
      for (const port of def.defaultPorts) {
        const computed = computePortCenter(port.position, port.offset, def.size);
        const expected = golden.ports[port.id as keyof typeof golden.ports];

        expect(expected).toBeDefined();
        expect(computed).toEqual(expected);
      }
    });

    it('has no extra golden ports', () => {
      const portIds = def.defaultPorts.map((port) => port.id);
      const goldenIds = Object.keys(golden.ports);

      expect(goldenIds.sort()).toEqual(portIds.sort());
    });
  });
});
