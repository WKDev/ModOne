import { describe, expect, it } from 'vitest';
import { BUILTIN_SYMBOLS, getBuiltinSymbolForBlockType } from '../assets/builtin-symbols';
import { getBlockDefinition } from '../components/OneCanvas/blockDefinitions';
import { circuitToYaml, createDefaultCircuit, yamlToCircuit } from '../components/OneCanvas/utils/serialization';
import { isPowerSource } from '../components/OneCanvas/types';
import type { BlockType, RelayBlock } from '../components/OneCanvas/types';
import goldenPositions from './fixtures/port-positions.json';

const ALL_BLOCK_TYPES: BlockType[] = [
  'powersource',
  'plc_out',
  'plc_in',
  'led',
  'button',
  'scope',
  'text',
  'relay',
  'fuse',
  'motor',
  'emergency_stop',
  'selector_switch',
  'solenoid_valve',
  'sensor',
  'pilot_lamp',
  'net_label',
  'transformer',
  'terminal_block',
  'overload_relay',
  'contactor',
  'disconnect_switch',
  'off_page_connector',
];

function collectUniquePins(blockType: BlockType): Array<{ id: string; position: { x: number; y: number } }> {
  const symbol = getBuiltinSymbolForBlockType(blockType);
  if (!symbol) {
    return [];
  }

  const allPins = [...symbol.pins, ...(symbol.units?.flatMap((unit) => unit.pins) ?? [])];
  const uniquePinMap = new Map(allPins.map((pin) => [pin.id, pin]));

  return Array.from(uniquePinMap.values()).map((pin) => ({ id: pin.id, position: pin.position }));
}

describe('builtin symbol migration', () => {
  it('registry has exactly 22 symbols', () => {
    expect(BUILTIN_SYMBOLS.size).toBe(22);
  });

  describe.each(ALL_BLOCK_TYPES)('%s', (blockType) => {
    const symbol = getBuiltinSymbolForBlockType(blockType);
    const blockDef = getBlockDefinition(blockType);

    it('has a builtin symbol definition', () => {
      expect(symbol).toBeDefined();
    });

    it('has correct dimensions matching blockDefinitions', () => {
      expect(symbol?.width).toBe(blockDef.size.width);
      expect(symbol?.height).toBe(blockDef.size.height);
    });

    it('has correct number of pins matching blockDefinitions ports', () => {
      const uniquePinCount = collectUniquePins(blockType).length;
      expect(uniquePinCount).toBe(blockDef.defaultPorts.length);
    });

    it('pin positions match golden file port positions', () => {
      const golden = goldenPositions[blockType as keyof typeof goldenPositions];
      const pins = collectUniquePins(blockType);

      for (const [portId, expectedPos] of Object.entries(golden.ports)) {
        const pin = pins.find((candidate) => candidate.id === portId);
        expect(pin).toBeDefined();
        expect(pin?.position).toEqual(expectedPos);
      }
    });

    it('has valid graphics (at least one primitive)', () => {
      const allGraphics = [
        ...(symbol?.graphics ?? []),
        ...(symbol?.units?.flatMap((unit) => unit.graphics) ?? []),
      ];

      expect(allGraphics.length).toBeGreaterThan(0);
    });

    it('has required metadata', () => {
      expect(symbol?.id).toBe(`builtin:${blockType}`);
      expect(symbol?.name).toBeTruthy();
      expect(symbol?.version).toBe('1.0.0');
      expect(symbol?.category).toBeTruthy();
    });
  });

  describe('multi-unit symbols', () => {
    it('relay has 2 units (coil + contact)', () => {
      const relay = getBuiltinSymbolForBlockType('relay');
      expect(relay?.units).toBeDefined();
      expect(relay?.units).toHaveLength(2);
    });

    it('contactor has 2 units (coil + power contacts)', () => {
      const contactor = getBuiltinSymbolForBlockType('contactor');
      expect(contactor?.units).toBeDefined();
      expect(contactor?.units).toHaveLength(2);
    });
  });
});

describe('serialization compatibility', () => {
  it('roundtrip preserves block data', () => {
    const circuit = createDefaultCircuit('Test');
    const yaml = circuitToYaml(circuit);
    const restored = yamlToCircuit(yaml);

    expect(restored.metadata.name).toBe('Test');
  });

  it('port absolutePosition survives serialization roundtrip', () => {
    const circuit = createDefaultCircuit('PortTest');
    const relayBlock: RelayBlock = {
      id: 'test-relay',
      type: 'relay',
      position: { x: 100, y: 100 },
      size: { width: 60, height: 60 },
      ports: getBlockDefinition('relay').defaultPorts.map((port) => ({ ...port })),
      designation: 'K1',
      coilVoltage: 24,
      contacts: 'NO',
      energized: false,
    };

    circuit.components.set(relayBlock.id, relayBlock);

    const yaml = circuitToYaml(circuit);
    const restored = yamlToCircuit(yaml);
    const restoredBlock = restored.components.get(relayBlock.id);

    expect(restoredBlock).toBeDefined();

    const relayPort = restoredBlock?.ports.find((port) => port.id === 'no');
    expect(relayPort?.absolutePosition).toEqual({ x: 60, y: 21 });
  });

  it('migrates legacy project block types during yaml load', () => {
    const legacyYaml = [
      'version: "1.1"',
      'metadata:',
      '  name: Legacy',
      '  description: ""',
      '  tags: []',
      'components:',
      '  - id: legacy-power',
      '    type: power_24v',
      '    position:',
      '      x: 10',
      '      y: 20',
      'wires: []',
    ].join('\n');

    const restored = yamlToCircuit(legacyYaml);
    const migrated = restored.components.get('legacy-power');

    expect(migrated).toBeDefined();
    expect(migrated?.type).toBe('powersource');
    expect(migrated?.label).toBe('+24V');

    if (!migrated) {
      throw new Error('Expected migrated component to exist');
    }

    expect(isPowerSource(migrated)).toBe(true);
    if (isPowerSource(migrated)) {
      expect(migrated.voltage).toBe(24);
      expect(migrated.polarity).toBe('positive');
    }
  });
});
