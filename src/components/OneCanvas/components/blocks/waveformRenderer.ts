/**
 * Waveform Renderer
 *
 * Canvas 2D drawing functions for oscilloscope waveform display.
 */

import type { ScopeDisplayData, ChannelDisplayData } from '../../../../types/onesim';

// ============================================================================
// Constants
// ============================================================================

/** Channel waveform colors (yellow, green, blue, red) */
export const CHANNEL_COLORS = ['#eab308', '#22c55e', '#3b82f6', '#ef4444'];

/** Grid line color */
const GRID_COLOR = '#1f2937';

/** Center line color */
const CENTER_LINE_COLOR = '#374151';

/** Trigger marker color */
const TRIGGER_COLOR = '#f97316';

/** Default voltage scale (±24V range mapped to canvas height) */
const DEFAULT_VOLTAGE_RANGE = 24;

// ============================================================================
// Grid Drawing
// ============================================================================

/**
 * Draw oscilloscope grid lines on canvas.
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;

  // Vertical grid lines (5 divisions)
  for (let i = 1; i < 5; i++) {
    const x = (i / 5) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Horizontal grid lines (4 divisions)
  for (let i = 1; i < 4; i++) {
    const y = (i / 4) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Center lines (thicker)
  ctx.strokeStyle = CENTER_LINE_COLOR;
  ctx.lineWidth = 1;

  // Vertical center
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  // Horizontal center
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

// ============================================================================
// Channel Waveform Drawing
// ============================================================================

/**
 * Draw a single channel waveform on canvas.
 */
export function drawChannel(
  ctx: CanvasRenderingContext2D,
  channel: ChannelDisplayData,
  width: number,
  height: number,
  colorIndex: number,
  voltageRange: number = DEFAULT_VOLTAGE_RANGE
): void {
  if (channel.points.length === 0) return;

  ctx.strokeStyle = CHANNEL_COLORS[colorIndex % CHANNEL_COLORS.length];
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  channel.points.forEach(([x, y], j) => {
    // x is already normalized 0-1
    const px = x * width;
    // y is voltage, scale to canvas coordinates (center = 0V)
    const py = height / 2 - (y / voltageRange) * (height / 2);

    if (j === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  });

  ctx.stroke();
}

// ============================================================================
// Trigger Marker Drawing
// ============================================================================

/**
 * Draw trigger position marker as a dashed vertical line.
 */
export function drawTriggerMarker(
  ctx: CanvasRenderingContext2D,
  triggerPosition: number,
  width: number,
  height: number
): void {
  const tx = triggerPosition * width;

  ctx.strokeStyle = TRIGGER_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  ctx.beginPath();
  ctx.moveTo(tx, 0);
  ctx.lineTo(tx, height);
  ctx.stroke();

  // Reset line dash
  ctx.setLineDash([]);
}

// ============================================================================
// Composite Waveform Drawing
// ============================================================================

/**
 * Draw complete waveform display including grid, channels, and trigger.
 */
export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  data: ScopeDisplayData,
  width: number,
  height: number,
  voltageRange: number = DEFAULT_VOLTAGE_RANGE
): void {
  // Clear canvas with black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // Draw grid
  drawGrid(ctx, width, height);

  // Draw channels
  data.channels.forEach((channel, i) => {
    drawChannel(ctx, channel, width, height, i, voltageRange);
  });

  // Draw trigger marker if triggered
  if (data.triggered) {
    drawTriggerMarker(ctx, data.triggerPosition, width, height);
  }
}

/**
 * Draw static grid when no data is available.
 */
export function drawEmptyScope(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  // Clear canvas with black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // Draw grid only
  drawGrid(ctx, width, height);
}
