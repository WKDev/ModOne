/**
 * LadderMonitoringRenderer
 *
 * Applies visual feedback for PLC monitoring mode:
 * - Energized elements/wires are highlighted in green
 * - Forced devices are highlighted in orange
 * - De-energized elements remain neutral
 * - Timer/counter current values are displayed
 *
 * This renderer operates as an overlay pass — it modifies tint/alpha
 * of existing element containers without destroying/recreating them.
 */

import { Graphics, Text, Container, TextStyle } from 'pixi.js';
import type { LadderMonitoringState } from '../../../../types/ladder';
import type { LadderGridConfig } from '../../../../types/ladder';

// ============================================================================
// Constants
// ============================================================================

const ENERGIZED_COLOR = 0x22c55e; // green-500
const FORCED_COLOR = 0xf97316; // orange-500
const DE_ENERGIZED_ALPHA = 0.5;
const ENERGIZED_ALPHA = 1.0;

const VALUE_LABEL_STYLE = new TextStyle({
  fontFamily: 'Consolas, monospace',
  fontSize: 10,
  fill: 0xfde68a, // amber-200
  align: 'center',
});

// ============================================================================
// Renderer
// ============================================================================

export class LadderMonitoringRenderer {
  private overlayContainer: Container;
  private valueLabels = new Map<string, Text>();
  private energizedOverlays = new Map<string, Graphics>();

  constructor(overlayContainer: Container) {
    this.overlayContainer = overlayContainer;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Apply monitoring visuals to element and wire containers.
   *
   * @param elementContainers Map of element id → Container
   * @param wireContainers Map of wire element id → Container
   * @param monitoringState Current monitoring state from store
   * @param config Grid config for positioning
   * @param elements Element data for address lookup
   */
  applyMonitoring(
    elementContainers: Map<string, Container>,
    wireContainers: Map<string, Container>,
    monitoringState: LadderMonitoringState,
    config: LadderGridConfig,
    elements: Map<string, { id: string; position: { row: number; col: number }; properties?: { address?: string } }>,
  ): void {
    this.clearOverlays();

    // Apply to regular elements
    for (const [id, container] of elementContainers) {
      const element = elements.get(id);
      if (!element) continue;

      const address = element.properties?.address;
      if (!address) {
        container.alpha = DE_ENERGIZED_ALPHA;
        continue;
      }

      const deviceValue = monitoringState.deviceStates.get(address);
      const isForced = monitoringState.forcedDevices.has(address);
      const isEnergized = deviceValue === true || (typeof deviceValue === 'number' && deviceValue !== 0);

      // Apply tint
      if (isForced) {
        container.tint = FORCED_COLOR;
        container.alpha = ENERGIZED_ALPHA;
      } else if (isEnergized) {
        container.tint = ENERGIZED_COLOR;
        container.alpha = ENERGIZED_ALPHA;
      } else {
        container.tint = 0xffffff; // reset tint
        container.alpha = DE_ENERGIZED_ALPHA;
      }

      // Show current value for timers/counters
      const timerState = monitoringState.timerStates.get(address);
      const counterState = monitoringState.counterStates.get(address);

      if (timerState) {
        this.showValueLabel(
          id,
          `${timerState.et}`,
          element.position.col * config.cellWidth + config.cellWidth / 2,
          element.position.row * config.cellHeight + config.cellHeight + 2,
        );
      } else if (counterState) {
        this.showValueLabel(
          id,
          `${counterState.cv}`,
          element.position.col * config.cellWidth + config.cellWidth / 2,
          element.position.row * config.cellHeight + config.cellHeight + 2,
        );
      }
    }

    // Apply to wires
    for (const [id, container] of wireContainers) {
      const isEnergized = monitoringState.energizedWires.has(id);

      if (isEnergized) {
        container.tint = ENERGIZED_COLOR;
        container.alpha = ENERGIZED_ALPHA;
      } else {
        container.tint = 0xffffff;
        container.alpha = DE_ENERGIZED_ALPHA;
      }
    }
  }

  /**
   * Remove all monitoring visuals and reset containers to normal.
   */
  clearMonitoring(
    elementContainers: Map<string, Container>,
    wireContainers: Map<string, Container>,
  ): void {
    // Reset element containers
    for (const container of elementContainers.values()) {
      container.tint = 0xffffff;
      container.alpha = 1.0;
    }

    // Reset wire containers
    for (const container of wireContainers.values()) {
      container.tint = 0xffffff;
      container.alpha = 1.0;
    }

    this.clearOverlays();
  }

  /**
   * Destroy renderer and clean up resources.
   */
  destroy(): void {
    this.clearOverlays();
  }

  // ===========================================================================
  // Internal
  // ===========================================================================

  private showValueLabel(
    elementId: string,
    value: string,
    x: number,
    y: number,
  ): void {
    let label = this.valueLabels.get(elementId);

    if (!label) {
      label = new Text({ text: value, style: VALUE_LABEL_STYLE });
      label.anchor.set(0.5, 0);
      this.overlayContainer.addChild(label);
      this.valueLabels.set(elementId, label);
    }

    label.text = value;
    label.position.set(x, y);
  }

  private clearOverlays(): void {
    for (const label of this.valueLabels.values()) {
      label.destroy();
    }
    this.valueLabels.clear();

    for (const overlay of this.energizedOverlays.values()) {
      overlay.destroy();
    }
    this.energizedOverlays.clear();
  }
}
