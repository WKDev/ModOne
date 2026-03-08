/**
 * SimulationRenderer — Applies live simulation state to Pixi symbols.
 *
 * Listens to Tauri `sim:plc-outputs` events and updates block/wire tint state.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { Container, Ticker } from 'pixi.js';
import type { BlockRenderer } from './BlockRenderer';
import type { WireRenderer } from './WireRenderer';

const COLOR_DEFAULT = 0xffffff;
const COLOR_ACTIVE = 0x3b82f6;
const COLOR_RUNNING = 0x22c55e;
const COLOR_ERROR = 0xef4444;
const COLOR_WARNING = 0xeab308;

interface PlcOutputUpdateRaw {
  block_id?: string;
  blockId?: string;
  state: boolean;
  value?: string | null;
}

interface PlcOutputsEventRaw {
  updates: PlcOutputUpdateRaw[];
  timestamp: number;
}

export interface PlcOutputUpdate {
  block_id: string;
  state: boolean;
  value?: string | null;
}

export interface PlcOutputsEvent {
  updates: PlcOutputUpdate[];
  timestamp: number;
}

export interface SimulationRendererConfig {
  blockRenderer: BlockRenderer;
  wireRenderer: WireRenderer;
  overlayLayer: Container;
  ticker?: Ticker;
  getBlockType?: (blockId: string) => string | undefined;
  getLedColor?: (blockId: string) => string | undefined;
  getWireIdsForBlock?: (blockId: string) => Iterable<string> | undefined;
}

export class SimulationRenderer {
  private _config: SimulationRendererConfig | null = null;
  private _destroyed = false;
  private _listening = false;
  private _startToken = 0;
  private _unlisten: UnlistenFn | null = null;

  private _energizedBlocks = new Set<string>();
  private _energizedWires = new Set<string>();

  init(config: SimulationRendererConfig): void {
    if (this._destroyed) {
      throw new Error('SimulationRenderer is destroyed');
    }
    this._config = config;
  }

  startListening(): void {
    if (this._destroyed || this._listening) return;
    if (!this._config) {
      throw new Error('SimulationRenderer not initialized');
    }

    this._listening = true;
    const token = ++this._startToken;

    void listen<PlcOutputsEventRaw>('sim:plc-outputs', (event) => {
      if (this._destroyed || !this._listening || token !== this._startToken) {
        return;
      }

      const payload = this._normalizePayload(event.payload);
      if (!payload) return;

      this._applyPlcUpdates(payload.updates);
      this._recomputeEnergizedWires();
    }).then((unlisten) => {
      if (this._destroyed || !this._listening || token !== this._startToken) {
        void Promise.resolve(unlisten()).catch(() => undefined);
        return;
      }
      this._unlisten = unlisten;
    }).catch(() => {
      if (token === this._startToken) {
        this._listening = false;
      }
    });
  }

  stopListening(): void {
    if (this._destroyed) return;

    this._listening = false;
    this._startToken += 1;

    const unlisten = this._unlisten;
    this._unlisten = null;
    if (unlisten) {
      void Promise.resolve(unlisten()).catch(() => undefined);
    }

    this.resetAllVisualState();
  }

  setEnergizedWires(wireIds: Set<string>): void {
    if (this._destroyed || !this._config) return;

    const next = new Set(wireIds);

    for (const wireId of this._energizedWires) {
      if (next.has(wireId)) continue;
      const graphics = this._config.wireRenderer.getWireGraphics(wireId);
      if (graphics) {
        graphics.tint = COLOR_DEFAULT;
      }
    }

    for (const wireId of next) {
      const graphics = this._config.wireRenderer.getWireGraphics(wireId);
      if (graphics) {
        graphics.tint = COLOR_ACTIVE;
      }
    }

    this._energizedWires = next;
  }

  resetAllVisualState(): void {
    if (!this._config) return;

    for (const blockId of this._energizedBlocks) {
      const graphics = this._config.blockRenderer.getBlockGraphics(blockId);
      if (graphics) {
        graphics.tint = COLOR_DEFAULT;
      }
    }

    for (const wireId of this._energizedWires) {
      const graphics = this._config.wireRenderer.getWireGraphics(wireId);
      if (graphics) {
        graphics.tint = COLOR_DEFAULT;
      }
    }

    this._energizedBlocks.clear();
    this._energizedWires.clear();
  }

  getEnergizedBlocks(): ReadonlySet<string> {
    return this._energizedBlocks;
  }

  getEnergizedWires(): ReadonlySet<string> {
    return this._energizedWires;
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stopListening();
    this._config = null;
  }

  private _applyPlcUpdates(updates: PlcOutputUpdate[]): void {
    if (!this._config) return;

    for (const update of updates) {
      const blockId = update.block_id;
      if (!blockId) continue;

      if (update.state) {
        this._energizedBlocks.add(blockId);
      } else {
        this._energizedBlocks.delete(blockId);
      }

      this._applyBlockTint(blockId, update.state, update.value ?? null);
    }
  }

  private _applyBlockTint(blockId: string, state: boolean, value: string | null): void {
    if (!this._config) return;

    const graphics = this._config.blockRenderer.getBlockGraphics(blockId);
    if (!graphics) return;

    const blockType = this._config.getBlockType?.(blockId) ?? 'unknown';
    graphics.tint = this._resolveTint(blockType, state, blockId, value);
  }

  private _resolveTint(blockType: string, state: boolean, blockId: string, _value: string | null): number {
    switch (blockType) {
      case 'relay_coil':
        return state ? COLOR_ACTIVE : COLOR_DEFAULT;

      case 'led':
      case 'pilot_lamp':
        return state ? this._resolveLedColor(blockId) : COLOR_DEFAULT;

      case 'relay_contact_no':
      case 'relay_contact_nc':
      case 'switch_no':
      case 'switch_nc':
        return state ? COLOR_RUNNING : COLOR_DEFAULT;

      case 'push_button_no':
      case 'push_button_nc':
      case 'button':
      case 'emergency_stop':
        return state ? COLOR_WARNING : COLOR_DEFAULT;

      case 'plc_input':
      case 'plc_output':
      case 'plc_in':
      case 'plc_out':
        return state ? COLOR_ACTIVE : COLOR_DEFAULT;

      case 'motor':
        return state ? COLOR_RUNNING : COLOR_DEFAULT;

      case 'power_source':
      case 'powersource':
        return COLOR_DEFAULT;

      default:
        return state ? COLOR_ACTIVE : COLOR_DEFAULT;
    }
  }

  private _resolveLedColor(blockId: string): number {
    const color = this._config?.getLedColor?.(blockId)?.toLowerCase();
    switch (color) {
      case 'red':
        return COLOR_ERROR;
      case 'yellow':
        return COLOR_WARNING;
      case 'blue':
        return COLOR_ACTIVE;
      case 'green':
      default:
        return COLOR_RUNNING;
    }
  }

  private _recomputeEnergizedWires(): void {
    if (!this._config) return;

    const getWireIdsForBlock = this._config.getWireIdsForBlock;
    if (!getWireIdsForBlock) {
      this.setEnergizedWires(new Set());
      return;
    }

    const next = new Set<string>();
    for (const blockId of this._energizedBlocks) {
      const wireIds = getWireIdsForBlock(blockId);
      if (!wireIds) continue;
      for (const wireId of wireIds) {
        next.add(wireId);
      }
    }

    this.setEnergizedWires(next);
  }

  private _normalizePayload(payload: unknown): PlcOutputsEvent | null {
    const eventPayload = this._extractEventPayload(payload);
    if (!eventPayload || !Array.isArray(eventPayload.updates)) {
      return null;
    }

    const updates: PlcOutputUpdate[] = [];
    for (const update of eventPayload.updates) {
      const blockId = update.block_id ?? update.blockId;
      if (!blockId) continue;
      updates.push({
        block_id: blockId,
        state: Boolean(update.state),
        value: update.value ?? null,
      });
    }

    return {
      updates,
      timestamp: Number(eventPayload.timestamp ?? Date.now()),
    };
  }

  private _extractEventPayload(payload: unknown): PlcOutputsEventRaw | null {
    if (!payload || typeof payload !== 'object') return null;

    const direct = payload as Partial<PlcOutputsEventRaw>;
    if (Array.isArray(direct.updates)) {
      return {
        updates: direct.updates,
        timestamp: Number(direct.timestamp ?? Date.now()),
      };
    }

    if ('payload' in direct) {
      const nested = direct.payload;
      if (nested && typeof nested === 'object') {
        const nestedPayload = nested as Partial<PlcOutputsEventRaw>;
        if (Array.isArray(nestedPayload.updates)) {
          return {
            updates: nestedPayload.updates,
            timestamp: Number(nestedPayload.timestamp ?? Date.now()),
          };
        }
      }
    }

    return null;
  }
}
