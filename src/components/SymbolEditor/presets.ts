// 아키타입 빠른 시작 프리셋 — 동작하는 릴레이/램프/모터/스위치 심볼 시드
import type { SymbolDefinition } from '../../types/symbol';
import type { BehaviorRule } from '../../types/behaviorRules';

export type ArchetypeId = 'lamp' | 'relay' | 'motor' | 'switch';

export interface ArchetypePreset {
  id: ArchetypeId;
  label: string;
  description: string;
}

export const ARCHETYPE_PRESETS: ArchetypePreset[] = [
  { id: 'lamp', label: 'Lamp / LED', description: '전원 인가 시 점등(lit)' },
  { id: 'relay', label: 'Relay (coil)', description: '여자 시 energized 상태' },
  { id: 'motor', label: 'Motor', description: '구동 시 running + 회전 애니메이션' },
  { id: 'switch', label: 'Switch', description: '전원 인가 시 접점 닫힘(closed)' },
];

function scaffold(name: string, category: string): Omit<SymbolDefinition, 'graphics' | 'pins'> {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    version: '1.0.0',
    category,
    description: `${name} starter template`,
    width: 80,
    height: 60,
    properties: [],
    author: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** A single "IF powered(portId) THEN set_state(state) ELSE set_state(idle)" rule. */
function poweredStateRule(portId: string, state: string): BehaviorRule {
  return {
    id: crypto.randomUUID(),
    name: `${portId} powered → ${state}`,
    priority: 1,
    conditionLogic: 'all',
    enabled: true,
    conditions: [{ type: 'port_powered', portId }],
    thenActions: [{ type: 'set_state', stateName: state }],
    elseActions: [{ type: 'set_state', stateName: 'idle' }],
  };
}

function lamp(): SymbolDefinition {
  return {
    ...scaffold('LED', 'Indicator'),
    graphics: [
      { id: 'body', kind: 'circle', cx: 40, cy: 30, r: 18, stroke: '#333333', fill: '#ffffff', strokeWidth: 2 },
    ],
    pins: [
      { id: 'p_a', name: 'A', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 30 }, orientation: 'left', length: 10 },
      { id: 'p_k', name: 'K', number: '2', type: 'passive', shape: 'line', position: { x: 80, y: 30 }, orientation: 'right', length: 10 },
    ],
    visualStates: {
      idle: { primitiveOverrides: { body: { fill: '#ffffff' } } },
      lit: { primitiveOverrides: { body: { fill: '#fde047', stroke: '#f59e0b' } } },
    },
    behavior: { domain: 'circuit', archetype: 'lamp', rules: [poweredStateRule('p_a', 'lit')] },
  };
}

function relay(): SymbolDefinition {
  return {
    ...scaffold('Relay (coil)', 'Relay'),
    graphics: [
      { id: 'coil', kind: 'rect', x: 20, y: 10, width: 40, height: 40, stroke: '#333333', fill: '#ffffff', strokeWidth: 2 },
      { id: 'slash', kind: 'polyline', points: [{ x: 20, y: 50 }, { x: 60, y: 10 }], stroke: '#333333', fill: 'none', strokeWidth: 2 },
    ],
    pins: [
      { id: 'a1', name: 'A1', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 30 }, orientation: 'left', length: 20 },
      { id: 'a2', name: 'A2', number: '2', type: 'passive', shape: 'line', position: { x: 80, y: 30 }, orientation: 'right', length: 20 },
    ],
    visualStates: {
      idle: { primitiveOverrides: { coil: { fill: '#ffffff' } } },
      energized: { primitiveOverrides: { coil: { fill: '#bfdbfe', stroke: '#2563eb' } } },
    },
    behavior: { domain: 'circuit', archetype: 'relay', rules: [poweredStateRule('a1', 'energized')] },
  };
}

function motor(): SymbolDefinition {
  return {
    ...scaffold('Motor', 'Motor'),
    graphics: [
      { id: 'rotor', kind: 'circle', cx: 40, cy: 30, r: 18, stroke: '#333333', fill: '#ffffff', strokeWidth: 2 },
      { id: 'bar', kind: 'polyline', points: [{ x: 28, y: 30 }, { x: 52, y: 30 }], stroke: '#333333', fill: 'none', strokeWidth: 2 },
    ],
    pins: [
      { id: 'u', name: 'U', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 30 }, orientation: 'left', length: 20 },
      { id: 'v', name: 'V', number: '2', type: 'passive', shape: 'line', position: { x: 80, y: 30 }, orientation: 'right', length: 20 },
    ],
    visualStates: {
      idle: { primitiveOverrides: { rotor: { stroke: '#333333' } } },
      running: { primitiveOverrides: { rotor: { stroke: '#16a34a' } } },
    },
    animations: {
      running: [{ type: 'rotate', target: 'bar', speed: 180 }],
    },
    behavior: { domain: 'circuit', archetype: 'motor', rules: [poweredStateRule('u', 'running')] },
  };
}

function switchSym(): SymbolDefinition {
  return {
    ...scaffold('Switch', 'Switch'),
    graphics: [
      { id: 'pivot', kind: 'circle', cx: 16, cy: 30, r: 3, stroke: '#333333', fill: '#333333', strokeWidth: 1 },
      { id: 'pole', kind: 'circle', cx: 64, cy: 30, r: 3, stroke: '#333333', fill: '#333333', strokeWidth: 1 },
      { id: 'blade', kind: 'polyline', points: [{ x: 16, y: 30 }, { x: 60, y: 14 }], stroke: '#333333', fill: 'none', strokeWidth: 2 },
    ],
    pins: [
      { id: 'in', name: 'IN', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 30 }, orientation: 'left', length: 16 },
      { id: 'out', name: 'OUT', number: '2', type: 'output', shape: 'line', position: { x: 80, y: 30 }, orientation: 'right', length: 16 },
    ],
    visualStates: {
      idle: { primitiveOverrides: { blade: { stroke: '#333333' } } },
      closed: { primitiveOverrides: { blade: { stroke: '#16a34a' } } },
    },
    behavior: { domain: 'circuit', archetype: 'switch', rules: [poweredStateRule('in', 'closed')] },
  };
}

export function createArchetypeSymbol(id: ArchetypeId): SymbolDefinition {
  switch (id) {
    case 'lamp': return lamp();
    case 'relay': return relay();
    case 'motor': return motor();
    case 'switch': return switchSym();
  }
}
