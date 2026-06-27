// 데모 builtin 심볼 terminal_strip이 실제 로더+해석 파이프라인에서 가변 포트로 동작하는지 검증 (트랙 B Phase 4)
import { describe, it, expect } from 'vitest';
import { BUILTIN_SYMBOLS } from '@/assets/builtin-symbols';
import {
  resolveEffectivePins,
  resolveInstancePorts,
} from '@/components/OneCanvas/renderers/symbols/resolveInstancePorts';

const def = BUILTIN_SYMBOLS.get('builtin:terminal_strip')!;

describe('terminal_strip — parametric builtin demo', () => {
  it('loads from the builtin registry with two PortTemplates and a terminals property', () => {
    expect(def).toBeDefined();
    expect(def.portTemplates).toHaveLength(2);
    expect(def.properties.find((p) => p.key === 'terminals')?.value).toBe(3);
  });

  it('resolves to N in + N out terminals using the property default (3)', () => {
    const pins = resolveEffectivePins(def);
    expect(pins.map((p) => p.id)).toEqual(['in1', 'in2', 'in3', 'out1', 'out2', 'out3']);
  });

  it('tracks an instance terminals value', () => {
    expect(resolveInstancePorts(def, { terminals: 5 })).toHaveLength(10);
    expect(resolveInstancePorts(def, { terminals: 1 })).toHaveLength(2);
  });

  it('clamps to the template min/max (1..12)', () => {
    expect(resolveInstancePorts(def, { terminals: 99 })).toHaveLength(24);
    expect(resolveInstancePorts(def, { terminals: 0 })).toHaveLength(2);
  });

  it('places left inputs and right outputs at the expected coordinates', () => {
    const ports = resolveInstancePorts(def, { terminals: 2 });
    const byId = Object.fromEntries(ports.map((p) => [p.id, p]));
    expect(byId.in1).toMatchObject({ position: 'left', absolutePosition: { x: 0, y: 10 } });
    expect(byId.in2).toMatchObject({ position: 'left', absolutePosition: { x: 0, y: 20 } });
    expect(byId.out1).toMatchObject({ position: 'right', absolutePosition: { x: 20, y: 10 } });
  });
});
