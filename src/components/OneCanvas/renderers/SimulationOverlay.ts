/**
 * SimulationOverlay — Fixed screen-space simulation HUD and wire flow overlay.
 */

import { Container, Graphics, Text, type Ticker } from 'pixi.js';
import type { Position } from '../types';

export type SimulationStatus = 'stopped' | 'running' | 'paused' | 'error';

const COLOR_RUNNING = 0x22c55e;
const COLOR_PAUSED = 0xeab308;
const COLOR_STOPPED = 0x6b7280;
const COLOR_ERROR = 0xef4444;
const COLOR_DASH = 0x3b82f6;

const DASH_LENGTH = 8;
const DASH_GAP = 4;
const DASH_SPEED_PX_PER_SEC = 60;

export interface SimulationOverlayConfig {
  stage: Container;
  ticker: Ticker;
  getScreenSize?: () => { width: number; height: number };
}

export class SimulationOverlay {
  private _config: SimulationOverlayConfig | null = null;
  private _destroyed = false;

  private _status: SimulationStatus = 'stopped';
  private _animationEnabled = true;
  private _dashOffset = 0;

  private _root: Container | null = null;
  private _statusBg: Graphics | null = null;
  private _statusText: Text | null = null;
  private _wireFlowGraphics: Graphics | null = null;

  private _energizedWirePoints = new Map<string, Position[]>();

  private readonly _tick = (ticker: Ticker): void => {
    if (this._destroyed) return;
    if (this._status !== 'running' || !this._animationEnabled) return;

    this._dashOffset = (this._dashOffset + (DASH_SPEED_PX_PER_SEC * ticker.deltaMS) / 1000) %
      (DASH_LENGTH + DASH_GAP);
    this._redrawWireAnimation();
  };

  init(config: SimulationOverlayConfig): void {
    if (this._destroyed) {
      throw new Error('SimulationOverlay is destroyed');
    }

    this._config = config;

    const root = new Container();
    root.label = 'simulation-overlay';
    root.zIndex = 1000;
    root.sortableChildren = true;
    config.stage.addChild(root);
    this._root = root;

    const wireFlow = new Graphics();
    wireFlow.label = 'simulation-wire-flow';
    root.addChild(wireFlow);
    this._wireFlowGraphics = wireFlow;

    const statusBg = new Graphics();
    statusBg.label = 'simulation-status-bg';
    root.addChild(statusBg);
    this._statusBg = statusBg;

    const statusText = new Text({
      text: '',
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12,
        fontWeight: '600',
        fill: 0xffffff,
        letterSpacing: 0.5,
      },
    });
    statusText.label = 'simulation-status-text';
    root.addChild(statusText);
    this._statusText = statusText;

    config.ticker.add(this._tick);

    this.setStatus('stopped');
    this._layoutStatusBadge();
  }

  setStatus(status: SimulationStatus): void {
    if (this._destroyed) return;
    this._status = status;

    const statusText = this._statusText;
    const statusBg = this._statusBg;
    if (!statusText || !statusBg) return;

    const { text, color } = this._statusVisual(status);
    statusText.text = text;

    const paddingX = 10;
    const paddingY = 6;
    const width = statusText.width + paddingX * 2;
    const height = statusText.height + paddingY * 2;

    statusBg.clear();
    statusBg.roundRect(0, 0, width, height, 8);
    statusBg.fill({ color, alpha: 0.9 });

    statusText.position.set(paddingX, paddingY);

    this._layoutStatusBadge();
    this._redrawWireAnimation();
  }

  setAnimationEnabled(enabled: boolean): void {
    if (this._destroyed) return;
    this._animationEnabled = enabled;
    this._redrawWireAnimation();
  }

  updateEnergizedWires(wirePoints: Map<string, Position[]>): void {
    if (this._destroyed) return;
    this._energizedWirePoints = new Map(wirePoints);
    this._redrawWireAnimation();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    if (this._config) {
      this._config.ticker.remove(this._tick);
    }

    this._statusBg?.destroy();
    this._statusText?.destroy();
    this._wireFlowGraphics?.destroy();
    this._root?.destroy({ children: true });

    this._statusBg = null;
    this._statusText = null;
    this._wireFlowGraphics = null;
    this._root = null;
    this._config = null;
    this._energizedWirePoints.clear();
  }

  private _layoutStatusBadge(): void {
    const root = this._root;
    const statusBg = this._statusBg;
    if (!root || !statusBg) return;

    const screen = this._getScreenSize();
    const margin = 12;

    root.position.set(0, 0);
    statusBg.position.set(Math.max(margin, screen.width - statusBg.width - margin), margin);
    if (this._statusText) {
      this._statusText.position.set(
        statusBg.position.x + 10,
        statusBg.position.y + 6,
      );
    }
  }

  private _redrawWireAnimation(): void {
    const g = this._wireFlowGraphics;
    if (!g) return;

    g.clear();

    const shouldAnimate = this._status === 'running' && this._animationEnabled;
    if (!shouldAnimate || this._energizedWirePoints.size === 0) {
      return;
    }

    for (const points of this._energizedWirePoints.values()) {
      if (points.length < 2) continue;
      this._drawDashedPolyline(g, points, this._dashOffset);
    }

    g.stroke({
      color: COLOR_DASH,
      width: 2,
      alpha: 0.95,
    });
  }

  private _drawDashedPolyline(g: Graphics, points: Position[], offset: number): void {
    const cycle = DASH_LENGTH + DASH_GAP;
    let carry = ((offset % cycle) + cycle) % cycle;

    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len <= 0) continue;

      const ux = dx / len;
      const uy = dy / len;

      let distance = -carry;
      while (distance < len) {
        const dashStart = Math.max(0, distance);
        const dashEnd = Math.min(len, distance + DASH_LENGTH);
        if (dashEnd > dashStart) {
          g.moveTo(a.x + ux * dashStart, a.y + uy * dashStart);
          g.lineTo(a.x + ux * dashEnd, a.y + uy * dashEnd);
        }
        distance += cycle;
      }

      carry = (carry + len) % cycle;
    }
  }

  private _statusVisual(status: SimulationStatus): { text: string; color: number } {
    switch (status) {
      case 'running':
        return { text: '● RUNNING', color: COLOR_RUNNING };
      case 'paused':
        return { text: '● PAUSED', color: COLOR_PAUSED };
      case 'error':
        return { text: '✕ ERROR', color: COLOR_ERROR };
      case 'stopped':
      default:
        return { text: '■ STOPPED', color: COLOR_STOPPED };
    }
  }

  private _getScreenSize(): { width: number; height: number } {
    if (this._config?.getScreenSize) {
      return this._config.getScreenSize();
    }
    return {
      width: typeof window === 'undefined' ? 1024 : window.innerWidth,
      height: typeof window === 'undefined' ? 768 : window.innerHeight,
    };
  }
}
