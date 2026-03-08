/**
 * LadderElementFactory
 *
 * Dispatches element creation/update to the appropriate type-specific renderer.
 */

import type { Container } from 'pixi.js';
import type {
  LadderElement,
  ContactElement,
  CoilElement,
  TimerElement,
  CounterElement,
  CompareElement,
} from '../../../../types/ladder';
import { isContactType, isCoilType, isTimerType, isCounterType, isCompareType } from '../../../../types/ladder';
import { LadderContactRenderer } from './LadderContactRenderer';
import { LadderCoilRenderer } from './LadderCoilRenderer';
import { LadderTimerRenderer } from './LadderTimerRenderer';
import { LadderCounterRenderer } from './LadderCounterRenderer';
import { LadderCompareRenderer } from './LadderCompareRenderer';

export class LadderElementFactory {
  private contactRenderer = new LadderContactRenderer();
  private coilRenderer = new LadderCoilRenderer();
  private timerRenderer = new LadderTimerRenderer();
  private counterRenderer = new LadderCounterRenderer();
  private compareRenderer = new LadderCompareRenderer();

  /**
   * Create a Pixi Container for any logic element.
   * Returns null for wire/rail types (handled by dedicated renderers).
   */
  createElement(
    element: LadderElement,
    cellWidth: number,
    cellHeight: number,
  ): Container | null {
    const { type } = element;

    if (isContactType(type)) {
      return this.contactRenderer.create(element as ContactElement, cellWidth, cellHeight);
    }
    if (isCoilType(type)) {
      return this.coilRenderer.create(element as CoilElement, cellWidth, cellHeight);
    }
    if (isTimerType(type)) {
      return this.timerRenderer.create(element as TimerElement, cellWidth, cellHeight);
    }
    if (isCounterType(type)) {
      return this.counterRenderer.create(element as CounterElement, cellWidth, cellHeight);
    }
    if (isCompareType(type)) {
      return this.compareRenderer.create(element as CompareElement, cellWidth, cellHeight);
    }

    // Wire and rail types are not handled here
    return null;
  }

  /**
   * Update an existing element container.
   */
  updateElement(container: Container, element: LadderElement): void {
    const { type } = element;

    if (isContactType(type)) {
      this.contactRenderer.update(container, element as ContactElement);
    } else if (isCoilType(type)) {
      this.coilRenderer.update(container, element as CoilElement);
    } else if (isTimerType(type)) {
      this.timerRenderer.update(container, element as TimerElement);
    } else if (isCounterType(type)) {
      this.counterRenderer.update(container, element as CounterElement);
    } else if (isCompareType(type)) {
      this.compareRenderer.update(container, element as CompareElement);
    }
  }

  destroy(): void {
    this.contactRenderer.destroy();
    this.coilRenderer.destroy();
    this.timerRenderer.destroy();
    this.counterRenderer.destroy();
    this.compareRenderer.destroy();
  }
}
