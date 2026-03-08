/**
 * ViewportSync — Pixi viewport -> Zustand document viewport synchronization.
 *
 * Debounces store writes to avoid triggering React re-render cascades during
 * active pan/zoom. The Pixi viewport handles visual transforms natively (GPU),
 * so the store only needs the final settled position for persistence.
 *
 * During pan: pixi-viewport moves smoothly (no React involvement).
 * After pan settles (DEBOUNCE_MS): one store write, one React update cycle.
 */

import { isCanvasDocument, isSchematicDocument, type CanvasDocumentData } from '@/types/document';
import { useDocumentRegistry } from '@stores/documentRegistry';
import type { PixiViewport } from '../core';

export interface ViewportSyncConfig {
  viewport: PixiViewport;
  documentId: string | null;
}

const EPSILON = 0.0001;

/**
 * Delay before writing viewport state to the Zustand store after the last
 * viewport change event. This prevents React re-render cascades (facade →
 * panel → minimap) on every pan/zoom frame while still persisting the final
 * viewport position for document switching and app close.
 *
 * During pixi-viewport deceleration, each tick resets the timer, so the
 * write only fires once deceleration fully settles.
 */
const DEBOUNCE_MS = 150;

export class ViewportSync {
  private _viewport: PixiViewport | null = null;
  private _documentId: string | null = null;
  private _isApplyingStoreState = false;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _destroyed = false;
  private _onViewportChanged = () => {
    this._queueStoreWrite();
  };

  init(config: ViewportSyncConfig): void {
    if (this._destroyed) {
      throw new Error('ViewportSync is destroyed');
    }

    this._detachListeners();
    this._viewport = config.viewport;
    this._documentId = config.documentId;
    this._attachListeners();
  }

  setDocumentId(documentId: string | null): void {
    if (this._destroyed) return;

    // Flush pending viewport state for the outgoing document before switching
    if (this._documentId && this._debounceTimer !== null) {
      this._flushPendingWrite();
    }

    this._documentId = documentId;
  }

  setApplyingStoreState(applying: boolean): void {
    if (this._destroyed) return;
    this._isApplyingStoreState = applying;
  }

  destroy(): void {
    if (this._destroyed) return;

    // Persist final viewport state before tearing down
    this._flushPendingWrite();

    this._destroyed = true;
    this._detachListeners();

    this._viewport = null;
    this._documentId = null;
  }

  private _attachListeners(): void {
    if (!this._viewport) return;

    const viewport = this._viewport.viewport;
    viewport.on('moved', this._onViewportChanged);
    viewport.on('zoomed', this._onViewportChanged);
  }

  private _detachListeners(): void {
    if (!this._viewport) return;

    const viewport = this._viewport.viewport;
    viewport.off('moved', this._onViewportChanged);
    viewport.off('zoomed', this._onViewportChanged);
  }

  private _queueStoreWrite(): void {
    if (this._destroyed) return;
    if (this._isApplyingStoreState) return;
    if (!this._viewport || !this._documentId) return;

    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._writeViewportToStore();
    }, DEBOUNCE_MS);
  }

  private _flushPendingWrite(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this._writeViewportToStore();
  }

  private _writeViewportToStore(): void {
    if (this._destroyed) return;
    if (this._isApplyingStoreState) return;
    if (!this._viewport || !this._documentId) return;

    const state = this._viewport.state;
    const x = state.panX;
    const y = state.panY;
    const zoom = state.zoom;
    const documentId = this._documentId;
    const registry = useDocumentRegistry.getState();
    const document = registry.documents.get(documentId);

    if (!document) return;

    if (isCanvasDocument(document)) {
      registry.updateCanvasData(documentId, (data: CanvasDocumentData) => {
        if (
          this._isApproxEqual(data.pan.x, x) &&
          this._isApproxEqual(data.pan.y, y) &&
          this._isApproxEqual(data.zoom, zoom)
        ) {
          return;
        }

        data.pan.x = x;
        data.pan.y = y;
        data.zoom = zoom;
      });
      return;
    }

    if (isSchematicDocument(document)) {
      registry.updateSchematicData(documentId, (data) => {
        const page =
          data.schematic.pages.find(
            (candidate) => candidate.id === data.schematic.activePageId
          ) ?? null;
        if (!page) return;

        const viewport = page.circuit.viewport ?? { zoom: 1, panX: 0, panY: 0 };
        if (
          this._isApproxEqual(viewport.panX, x) &&
          this._isApproxEqual(viewport.panY, y) &&
          this._isApproxEqual(viewport.zoom, zoom)
        ) {
          return;
        }

        page.circuit.viewport = { zoom, panX: x, panY: y };
        page.updatedAt = new Date().toISOString();
        data.schematic.updatedAt = new Date().toISOString();
      });
    }
  }

  private _isApproxEqual(a: number, b: number): boolean {
    return Math.abs(a - b) <= EPSILON;
  }
}
