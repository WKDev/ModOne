import type { Viewport } from 'pixi-viewport';

type Pan = { x: number; y: number };

export class PixiViewportSync {
  private isPixiUpdating = false;
  private isStoreUpdating = false;

  private readonly viewportChangeHandler = (): void => {
    if (this.isStoreUpdating) {
      return;
    }

    this.isPixiUpdating = true;
    try {
      const zoom = this.viewport.scale.x;
      const pan = { x: this.viewport.x, y: this.viewport.y };

      this.setZoom(zoom);
      this.setPan(pan);
    } finally {
      this.isPixiUpdating = false;
    }
  };

  constructor(
    private viewport: Viewport,
    private setZoom: (zoom: number) => void,
    private setPan: (pan: Pan) => void,
  ) {}

  start(): void {
    this.viewport.on('moved', this.viewportChangeHandler);
    this.viewport.on('zoomed', this.viewportChangeHandler);
    this.viewport.on('moved-end', this.viewportChangeHandler);
  }

  stop(): void {
    this.viewport.off('moved', this.viewportChangeHandler);
    this.viewport.off('zoomed', this.viewportChangeHandler);
    this.viewport.off('moved-end', this.viewportChangeHandler);
  }

  syncFromStore(zoom: number, pan: Pan): void {
    if (this.isPixiUpdating) {
      return;
    }

    this.isStoreUpdating = true;
    try {
      const zoomDiff = Math.abs(this.viewport.scale.x - zoom);
      const panXDiff = Math.abs(this.viewport.x - pan.x);
      const panYDiff = Math.abs(this.viewport.y - pan.y);

      if (zoomDiff > 0.001) {
        this.viewport.setZoom(zoom, true);
      }

      if (panXDiff > 0.5 || panYDiff > 0.5) {
        this.viewport.position.set(pan.x, pan.y);
      }
    } finally {
      this.isStoreUpdating = false;
    }
  }
}
