import { afterEach, describe, expect, it } from 'vitest';
import { Container, Text } from 'pixi.js';
import type { ComponentBehaviorState } from '@/types/behavior';
import type { SymbolDefinition } from '@/types/symbol';
import type { Block } from '../../types';
import { BlockRenderer } from '../BlockRenderer';
import { registerCustomSymbol, unregisterCustomSymbol } from '../symbols';

const customTextSymbol: SymbolDefinition = {
  id: 'custom:test-text-symbol',
  name: 'Text Symbol',
  version: '1.0.0',
  category: 'test',
  createdAt: '2026-03-16T00:00:00Z',
  updatedAt: '2026-03-16T00:00:00Z',
  width: 40,
  height: 40,
  graphics: [
    { id: 'box', kind: 'rect', x: 4, y: 4, width: 32, height: 32, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { id: 'label', kind: 'text', x: 20, y: 20, text: 'T', fontSize: 12, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
  ],
  pins: [
    { id: 'p1', name: 'P1', number: '1', type: 'passive', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0 },
  ],
  properties: [],
};

afterEach(() => {
  unregisterCustomSymbol(customTextSymbol.id);
});

describe('BlockRenderer', () => {
  it('renders text primitives for registered custom symbols', () => {
    registerCustomSymbol(customTextSymbol);

    const layer = new Container();
    const renderer = new BlockRenderer({ layer });
    const block: Block = {
      id: 'custom-block',
      type: 'custom_symbol',
      position: { x: 0, y: 0 },
      size: { width: 40, height: 40 },
      ports: [],
      symbolId: customTextSymbol.id,
      selectedUnit: 1,
      instanceProperties: {},
    };

    renderer.renderBlock(block);

    const visual = renderer.getBlockVisual(block.id);
    const symbolLayer = visual?.symbolRoot.children[0] as Container;

    expect(symbolLayer.children.some((child) => child instanceof Text)).toBe(true);
    expect(visual?.tintables.length).toBe(2);

    renderer.destroy();
  });

  it('exposes animation targets when a behavior state activates a visual variant', () => {
    const layer = new Container();
    const renderer = new BlockRenderer({ layer });
    const block: Block = {
      id: 'motor-1',
      type: 'motor',
      position: { x: 0, y: 0 },
      size: { width: 80, height: 80 },
      ports: [],
      designation: 'M1',
      powerKw: 1.5,
      voltageRating: 400,
    } as Block;
    const runningState: ComponentBehaviorState = {
      componentId: block.id,
      templateId: 'archetype:motor',
      archetype: 'motor',
      visualState: 'running',
      powered: true,
      running: true,
    };

    renderer.renderBlock(block);
    renderer.setBlockBehaviorState(block.id, runningState);

    const visual = renderer.getBlockVisual(block.id);

    expect(visual?.activeVisualState).toBe('running');
    expect(visual?.animationTargets.get('rotor')).toHaveLength(1);

    renderer.destroy();
  });

  it('captures multiple animations targeting the same primitive', () => {
    const multiAnimSymbol: SymbolDefinition = {
      id: 'custom:multi-anim',
      name: 'Multi Anim',
      version: '1.0.0',
      category: 'test',
      createdAt: '2026-03-16T00:00:00Z',
      updatedAt: '2026-03-16T00:00:00Z',
      width: 40,
      height: 40,
      graphics: [
        { id: 'box', kind: 'rect', x: 4, y: 4, width: 32, height: 32, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
      ],
      pins: [
        { id: 'p1', name: 'P1', number: '1', type: 'passive', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0 },
      ],
      properties: [],
      visualStates: { on: { primitiveOverrides: {} } },
      animations: {
        on: [
          { type: 'rotate', target: 'box', speed: 90 },
          { type: 'blink', target: 'box', duration: 500 },
        ],
      },
    };
    registerCustomSymbol(multiAnimSymbol);

    const layer = new Container();
    const renderer = new BlockRenderer({ layer });
    const block: Block = {
      id: 'multi-1',
      type: 'custom_symbol',
      position: { x: 0, y: 0 },
      size: { width: 40, height: 40 },
      ports: [],
      symbolId: multiAnimSymbol.id,
      instanceProperties: {},
    } as Block;

    renderer.renderBlock(block);
    renderer.setBlockBehaviorState(block.id, {
      componentId: block.id,
      templateId: 'archetype:lamp',
      archetype: 'lamp',
      visualState: 'on',
      powered: true,
    });

    const targets = renderer.getBlockVisual(block.id)?.animationTargets.get('box');
    expect(targets).toHaveLength(2);
    expect(targets?.map((t) => t.spec.type)).toEqual(['rotate', 'blink']);

    renderer.destroy();
    unregisterCustomSymbol(multiAnimSymbol.id);
  });
});
