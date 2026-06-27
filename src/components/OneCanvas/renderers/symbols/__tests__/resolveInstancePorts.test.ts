// PortTemplate 펼침(개수·클램프·좌표·패턴) 및 정적 pins 병합 검증 (트랙 B Phase 2)
import { describe, it, expect } from 'vitest';
import type { SymbolDefinition } from '../../../../../types/symbol';
import {
  expandPortTemplate,
  resolveEffectivePins,
  resolveInstancePorts,
} from '../resolveInstancePorts';

function makeDef(overrides: Partial<SymbolDefinition> = {}): SymbolDefinition {
  return {
    id: 'test:scope',
    name: 'Scope',
    version: '1.0.0',
    category: 'measurement',
    createdAt: '',
    updatedAt: '',
    width: 50,
    height: 40,
    graphics: [],
    pins: [
      { id: 'trig', name: 'TRIG', number: '1', type: 'input', shape: 'line', position: { x: 25, y: 0 }, orientation: 'up', length: 0 },
    ],
    portTemplates: [
      {
        repeat: 'channels', min: 1, max: 8,
        idPattern: 'ch{i}', namePattern: 'CH{i}', numberFrom: 2,
        type: 'input', electricalType: 'input', orientation: 'left', shape: 'line',
        x: 0, yStart: 10, yStep: 10,
      },
    ],
    properties: [
      { key: 'channels', value: 4, type: 'number' },
    ],
    ...overrides,
  };
}

describe('expandPortTemplate', () => {
  it('uses the instance property value for the count', () => {
    const def = makeDef();
    const pins = expandPortTemplate(def.portTemplates![0], def, { channels: 6 });
    expect(pins).toHaveLength(6);
    expect(pins.map((p) => p.id)).toEqual(['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6']);
    expect(pins.map((p) => p.name)).toEqual(['CH1', 'CH2', 'CH3', 'CH4', 'CH5', 'CH6']);
  });

  it('falls back to the property default when no instance value', () => {
    const def = makeDef();
    expect(expandPortTemplate(def.portTemplates![0], def, undefined)).toHaveLength(4);
  });

  it('clamps to min/max', () => {
    const def = makeDef();
    expect(expandPortTemplate(def.portTemplates![0], def, { channels: 99 })).toHaveLength(8);
    expect(expandPortTemplate(def.portTemplates![0], def, { channels: 0 })).toHaveLength(1);
  });

  it('distributes left-edge pins by yStart + i*yStep at fixed x', () => {
    const def = makeDef();
    const pins = expandPortTemplate(def.portTemplates![0], def, { channels: 3 });
    expect(pins.map((p) => p.position)).toEqual([
      { x: 0, y: 10 }, { x: 0, y: 20 }, { x: 0, y: 30 },
    ]);
    expect(pins.map((p) => p.number)).toEqual(['2', '3', '4']);
    expect(pins.every((p) => p.orientation === 'left' && p.type === 'input')).toBe(true);
  });
});

describe('resolveEffectivePins', () => {
  it('merges static pins with expanded template pins', () => {
    const pins = resolveEffectivePins(makeDef(), { channels: 2 });
    expect(pins.map((p) => p.id)).toEqual(['trig', 'ch1', 'ch2']);
  });

  it('returns only static pins when there are no templates', () => {
    const def = makeDef({ portTemplates: undefined });
    expect(resolveEffectivePins(def, { channels: 4 }).map((p) => p.id)).toEqual(['trig']);
  });
});

describe('resolveInstancePorts', () => {
  it('produces canvas ports with absolute positions', () => {
    const ports = resolveInstancePorts(makeDef(), { channels: 2 });
    expect(ports.map((p) => p.id)).toEqual(['trig', 'ch1', 'ch2']);
    expect(ports[1]).toMatchObject({ id: 'ch1', position: 'left', absolutePosition: { x: 0, y: 10 } });
  });
});
