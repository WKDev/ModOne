/**
 * GridRenderer - stable world-space grid rendering for Pixi v8.
 *
 * The previous shader-based grid path was fragile across Pixi/WebGL updates and
 * could silently fail, leaving the canvas without any visible grid. This
 * renderer trades a bit of theoretical performance for predictable rendering by
 * drawing the visible grid procedurally with a single Graphics instance.
 */

import { Graphics, type Container } from 'pixi.js';
import type { GridConfig, ViewportBounds } from '../types';
import { DEFAULT_GRID, unitToPx } from '../types';

export type GridUnit = 'px' | 'mil' | 'mm';

export interface GridRendererOptions {
  /** The grid layer container (viewport child, world-space). */
  layer: Container;
  /** Initial grid configuration. */
  config?: GridConfig;
}

const MIN_SCREEN_SPACING = 10;
const MIN_MAJOR_SCREEN_SPACING = 26;
const MIN_DOT_SCREEN_SPACING = 18;
const MINOR_DOT_SCREEN_SIZE = 1;
const MAJOR_DOT_SCREEN_SIZE = 2;
const EPSILON = 0.0001;

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function getMajorFactor(config: GridConfig): number {
  return config.majorInterval ?? config.subdivisions ?? 5;
}

function getEffectiveStep(baseStep: number, zoom: number, minScreenSpacing: number): number {
  const screenStep = Math.max(baseStep * zoom, EPSILON);
  const multiplier = Math.max(1, Math.ceil(minScreenSpacing / screenStep));
  return baseStep * multiplier;
}

function getAlignedStart(min: number, step: number): number {
  return Math.floor(min / step) * step;
}

function isMajorCoordinate(value: number, majorStep: number): boolean {
  const snapped = Math.round(value / majorStep) * majorStep;
  return Math.abs(value - snapped) <= Math.max(EPSILON, majorStep * 0.001);
}

function drawDotCell(
  graphics: Graphics,
  x: number,
  y: number,
  zoom: number,
  screenSize: number
): void {
  const worldSize = screenSize / Math.max(zoom, EPSILON);
  const offset = worldSize / 2;
  graphics.rect(x - offset, y - offset, worldSize, worldSize);
}

export class GridRenderer {
  private _graphics: Graphics | null = null;
  private _config: GridConfig;
  private _layer: Container;
  private _destroyed = false;
  private _unit: GridUnit = 'mm';

  constructor(options: GridRendererOptions) {
    this._config = options.config ?? DEFAULT_GRID;
    this._layer = options.layer;
    this._unit = this._config.unit ?? 'mm';
    this._initGraphics();
  }

  get config(): GridConfig {
    return this._config;
  }

  set config(value: GridConfig) {
    this._config = value;
    this._unit = value.unit ?? 'mm';
  }

  set unit(value: GridUnit) {
    this._unit = value;
  }

  render(bounds: ViewportBounds, zoom: number): void {
    if (this._destroyed || !this._graphics) return;

    const visible = this._config.visible ?? true;
    this._graphics.visible = visible;
    if (!visible) return;

    this._graphics.clear();

    const style = this._config.style ?? 'dots';
    const baseMinorStep = Math.max(1, unitToPx(this._config.size, this._unit));
    const baseMajorStep = Math.max(baseMinorStep, baseMinorStep * getMajorFactor(this._config));

    const effectiveMinorStep = getEffectiveStep(
      baseMinorStep,
      zoom,
      style === 'dots' ? MIN_DOT_SCREEN_SPACING : MIN_SCREEN_SPACING
    );
    const effectiveMajorStep = getEffectiveStep(baseMajorStep, zoom, MIN_MAJOR_SCREEN_SPACING);

    if (style === 'lines') {
      this._renderLines(bounds, effectiveMinorStep, effectiveMajorStep, baseMajorStep);
      return;
    }

    this._renderDots(bounds, effectiveMinorStep, effectiveMajorStep, zoom, baseMajorStep);
  }

  setVisible(visible: boolean): void {
    this._config = { ...this._config, visible };
    if (this._graphics) {
      this._graphics.visible = visible;
    }
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._graphics?.destroy();
    this._graphics = null;
  }

  private _initGraphics(): void {
    const graphics = new Graphics();
    graphics.label = 'grid-graphics';
    graphics.eventMode = 'none';
    graphics.cullable = true;
    this._graphics = graphics;
    this._layer.addChild(graphics);
  }

  private _renderLines(
    bounds: ViewportBounds,
    minorStep: number,
    majorStep: number,
    baseMajorStep: number
  ): void {
    if (!this._graphics) return;

    const minorColor = hexToNumber(this._config.color ?? '#cccccc');
    const majorColor = hexToNumber(this._config.majorColor ?? '#999999');
    const minorAlpha = this._config.alpha ?? 0.3;
    const majorAlpha = this._config.majorAlpha ?? 0.5;

    const minorStartX = getAlignedStart(bounds.minX, minorStep);
    const minorStartY = getAlignedStart(bounds.minY, minorStep);

    for (let x = minorStartX; x <= bounds.maxX + minorStep; x += minorStep) {
      if (isMajorCoordinate(x, baseMajorStep)) continue;
      this._graphics.moveTo(x, bounds.minY).lineTo(x, bounds.maxY);
    }
    for (let y = minorStartY; y <= bounds.maxY + minorStep; y += minorStep) {
      if (isMajorCoordinate(y, baseMajorStep)) continue;
      this._graphics.moveTo(bounds.minX, y).lineTo(bounds.maxX, y);
    }
    this._graphics.stroke({
      color: minorColor,
      alpha: minorAlpha,
      width: 1,
      pixelLine: true,
    });

    const majorStartX = getAlignedStart(bounds.minX, majorStep);
    const majorStartY = getAlignedStart(bounds.minY, majorStep);

    for (let x = majorStartX; x <= bounds.maxX + majorStep; x += majorStep) {
      this._graphics.moveTo(x, bounds.minY).lineTo(x, bounds.maxY);
    }
    for (let y = majorStartY; y <= bounds.maxY + majorStep; y += majorStep) {
      this._graphics.moveTo(bounds.minX, y).lineTo(bounds.maxX, y);
    }
    this._graphics.stroke({
      color: majorColor,
      alpha: majorAlpha,
      width: 1,
      pixelLine: true,
    });
  }

  private _renderDots(
    bounds: ViewportBounds,
    minorStep: number,
    majorStep: number,
    zoom: number,
    baseMajorStep: number
  ): void {
    if (!this._graphics) return;

    const minorColor = hexToNumber(this._config.color ?? '#cccccc');
    const majorColor = hexToNumber(this._config.majorColor ?? '#999999');
    const minorAlpha = this._config.alpha ?? 0.3;
    const majorAlpha = this._config.majorAlpha ?? 0.5;

    const minorStartX = getAlignedStart(bounds.minX, minorStep);
    const minorStartY = getAlignedStart(bounds.minY, minorStep);

    for (let x = minorStartX; x <= bounds.maxX + minorStep; x += minorStep) {
      for (let y = minorStartY; y <= bounds.maxY + minorStep; y += minorStep) {
        if (isMajorCoordinate(x, baseMajorStep) && isMajorCoordinate(y, baseMajorStep)) {
          continue;
        }
        drawDotCell(this._graphics, x, y, zoom, MINOR_DOT_SCREEN_SIZE);
      }
    }
    this._graphics.fill({ color: minorColor, alpha: minorAlpha });

    const majorStartX = getAlignedStart(bounds.minX, majorStep);
    const majorStartY = getAlignedStart(bounds.minY, majorStep);

    for (let x = majorStartX; x <= bounds.maxX + majorStep; x += majorStep) {
      for (let y = majorStartY; y <= bounds.maxY + majorStep; y += majorStep) {
        drawDotCell(this._graphics, x, y, zoom, MAJOR_DOT_SCREEN_SIZE);
      }
    }
    this._graphics.fill({ color: majorColor, alpha: majorAlpha });
  }
}
