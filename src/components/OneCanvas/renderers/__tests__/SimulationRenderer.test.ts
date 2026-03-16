import { describe, expect, it, vi } from 'vitest';
import type { Ticker } from 'pixi.js';
import type { ComponentBehaviorState } from '@/types/behavior';
import type { BlockRenderer, BlockVisualHandle } from '../BlockRenderer';
import type { WireRenderer } from '../WireRenderer';
import { SimulationRenderer } from '../SimulationRenderer';

function motorState(running: boolean): ComponentBehaviorState {
  return {
    componentId: 'motor-1',
    templateId: 'archetype:motor',
    archetype: 'motor',
    visualState: running ? 'running' : 'stopped',
    powered: running,
    running,
  };
}

describe('SimulationRenderer', () => {
  it('applies variants and starts/stops ticker animations from block visuals', () => {
    const rotor = { rotation: 0 } as { rotation: number };
    const fakeTicker = {
      deltaMS: 1000,
      add: vi.fn(),
      remove: vi.fn(),
    };
    const ticker = fakeTicker as unknown as Ticker;

    let visualHandle: BlockVisualHandle | null = {
      container: {} as BlockVisualHandle['container'],
      symbolRoot: {} as BlockVisualHandle['symbolRoot'],
      tintables: [],
      activeVisualState: 'running',
      definitionId: 'builtin:motor',
      animationTargets: new Map([
        [
          'rotor',
          {
            displayObject: rotor as never,
            baseRotation: 0,
            spec: { type: 'rotate', target: 'rotor', speed: 180 },
          },
        ],
      ]),
    };

    const blockRenderer = {
      setBlockBehaviorState: vi.fn((_blockId: string, state: ComponentBehaviorState | null) => {
        if (!state || state.visualState !== 'running') {
          visualHandle = {
            ...visualHandle!,
            activeVisualState: null,
            animationTargets: new Map(),
          };
        }
      }),
      setBlockRuntimeTint: vi.fn(),
      resetBlockRuntimeVisual: vi.fn(() => {
        visualHandle = {
          ...visualHandle!,
          activeVisualState: null,
          animationTargets: new Map(),
        };
      }),
      getBlockVisual: vi.fn(() => visualHandle),
    } as unknown as BlockRenderer;

    const wireRenderer = {
      getWireGraphics: vi.fn(() => null),
    } as unknown as WireRenderer;

    const renderer = new SimulationRenderer();
    renderer.init({
      blockRenderer,
      wireRenderer,
      overlayLayer: {} as never,
      ticker,
      getBlockType: () => 'motor',
    });

    renderer.applySimulationSnapshot(new Map([['motor-1', motorState(true)]]), new Set());

    expect(blockRenderer.setBlockBehaviorState).toHaveBeenCalledWith('motor-1', expect.objectContaining({ visualState: 'running' }));
    expect(blockRenderer.setBlockRuntimeTint).toHaveBeenCalledWith('motor-1', 0x22c55e);
    expect(fakeTicker.add).toHaveBeenCalledTimes(1);

    const tick = fakeTicker.add.mock.calls[0]?.[0] as ((ticker: Ticker) => void) | undefined;
    tick?.(ticker);
    expect(rotor.rotation).toBeCloseTo(Math.PI, 5);

    renderer.applySimulationSnapshot(new Map(), new Set());

    expect(blockRenderer.resetBlockRuntimeVisual).toHaveBeenCalledWith('motor-1');
    expect(fakeTicker.remove).toHaveBeenCalledTimes(1);
    expect(rotor.rotation).toBeCloseTo(0, 5);
  });
});
