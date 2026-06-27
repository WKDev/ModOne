// scope 채널 수에 따라 포트가 가변적으로 생성되는지 검증 (Q2 트랙 A)
import { describe, it, expect } from 'vitest';
import { getScopePorts } from '../blockDefinitions';
import { createBlockInstance } from '../runtime/blockFactory';

describe('getScopePorts — parametric scope channels', () => {
  it('returns N left-edge input ports for N channels', () => {
    const ports = getScopePorts(4);
    expect(ports).toHaveLength(4);
    expect(ports.map((p) => p.id)).toEqual(['ch1', 'ch2', 'ch3', 'ch4']);
    expect(ports.map((p) => p.label)).toEqual(['CH1', 'CH2', 'CH3', 'CH4']);
    expect(ports.every((p) => p.type === 'input' && p.position === 'left')).toBe(true);
  });

  it('distributes ports evenly via offset (no absolutePosition)', () => {
    const ports = getScopePorts(4);
    expect(ports.map((p) => p.offset)).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(ports.every((p) => p.absolutePosition === undefined)).toBe(true);
  });

  it('single channel centers on the edge', () => {
    const ports = getScopePorts(1);
    expect(ports).toHaveLength(1);
    expect(ports[0].offset).toBe(0.5);
  });

  it('clamps invalid counts to at least one port', () => {
    expect(getScopePorts(0)).toHaveLength(1);
    expect(getScopePorts(-3)).toHaveLength(1);
  });
});

describe('createBlockInstance — scope ports track channels', () => {
  it('defaults to a 4-channel scope with 4 ports', () => {
    const block = createBlockInstance('s1', 'scope', { x: 0, y: 0 });
    expect(block.ports).toHaveLength(4);
  });

  it('builds ports matching an explicit channel count', () => {
    const block = createBlockInstance('s2', 'scope', { x: 0, y: 0 }, { channels: 2 } as never);
    expect(block.ports.map((p) => p.id)).toEqual(['ch1', 'ch2']);
  });
});
