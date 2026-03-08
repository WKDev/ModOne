/**
 * SyncEngine — Zustand document state -> Pixi renderers synchronization.
 *
 * Subscribes to documentRegistry updates for a single active canvas document,
 * computes dirty flags from structural reference changes, batches work with RAF,
 * and reconciles renderer + hit testing state in one place.
 */

import type {
  Block,
  DirtyFlag,
  Junction,
  Rect,
  Wire,
} from '../types';
import type { DocumentState } from '@/types/document';
import type {
  BlockRenderer,
  GridRenderer,
  JunctionRenderer,
  PortRenderer,
  SelectionRenderer,
  WireRenderer,
} from '../renderers';
import type { HitTester, PixiViewport, SpatialIndex } from '../core';
import { useDocumentRegistry } from '@stores/documentRegistry';
import { isCanvasDocument, isSchematicDocument } from '@/types/document';

interface CanvasSnapshot {
  components: Map<string, Block>;
  wires: Wire[];
  junctions: Map<string, Junction>;
  zoom: number;
  panX: number;
  panY: number;
  gridSize: number;
  showGrid: boolean;
}

export interface SyncEngineConfig {
  blockRenderer: BlockRenderer;
  wireRenderer: WireRenderer;
  portRenderer: PortRenderer;
  junctionRenderer: JunctionRenderer;
  selectionRenderer: SelectionRenderer;
  gridRenderer: GridRenderer;
  spatialIndex: SpatialIndex;
  hitTester: HitTester;
  viewport: PixiViewport;
  onApplyingViewportStoreState?: (applying: boolean) => void;
}

const EMPTY_BLOCKS: Record<string, Block> = {};
const EMPTY_WIRES: Record<string, Wire> = {};
const EMPTY_JUNCTIONS: Record<string, Junction> = {};
const EPSILON = 0.0001;

export class SyncEngine {
  private _config: SyncEngineConfig | null = null;
  private _documentId: string | null = null;
  private _unsubscribe: (() => void) | null = null;
  private _dirtyFlags = new Set<DirtyFlag>();
  private _rafId: number | null = null;
  private _destroyed = false;

  init(config: SyncEngineConfig): void {
    if (this._destroyed) {
      throw new Error('SyncEngine is destroyed');
    }
    this._config = config;
  }

  setDocumentId(documentId: string | null): void {
    if (this._destroyed) return;
    if (this._documentId === documentId) return;

    this._unsubscribeFromStore();
    this._documentId = documentId;

    if (!this._documentId) {
      this._dirtyFlags.clear();
      return;
    }

    this._subscribeToStore();
    this._markDirty('all');
  }

  syncSelection(
    selectedBlockIds: string[],
    selectedWireIds: string[],
    selectedJunctionIds: string[],
    selectedBlocks: Block[],
    bounds?: Rect
  ): void {
    if (!this._config || this._destroyed) return;

    this._config.blockRenderer.setSelectedBlocks(new Set(selectedBlockIds));
    this._config.wireRenderer.setSelectedWires(new Set(selectedWireIds));
    this._config.junctionRenderer.setSelectedJunctions(new Set(selectedJunctionIds));
    this._config.selectionRenderer.renderHighlights(selectedBlocks, bounds);
  }

  syncHover(type: 'block' | 'wire' | 'junction' | null, id: string | null): void {
    if (!this._config || this._destroyed) return;

    this._config.blockRenderer.setHoveredBlock(type === 'block' ? id : null);
    this._config.wireRenderer.setHoveredWire(type === 'wire' ? id : null);
    this._config.junctionRenderer.setHoveredJunction(type === 'junction' ? id : null);
  }

  forceSync(): void {
    if (!this._config || this._destroyed) return;

    this._dirtyFlags.add('all');
    this._flushNow();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._unsubscribeFromStore();
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this._dirtyFlags.clear();
    this._documentId = null;
    this._config = null;
  }

  private _subscribeToStore(): void {
    if (!this._documentId) return;

    const documentId = this._documentId;
    this._unsubscribe = useDocumentRegistry.subscribe((state, prevState) => {
      if (this._destroyed || !this._config) return;
      if (this._documentId !== documentId) return;

      const currentDoc = state.documents.get(documentId);
      const prevDoc = prevState.documents.get(documentId);

      const current = this._toCanvasSnapshot(currentDoc);
      const previous = this._toCanvasSnapshot(prevDoc);

      if (!current && !previous) {
        return;
      }

      if (!current || !previous) {
        this._markDirty('all');
        return;
      }

      let hasChanges = false;

      if (current.components !== previous.components) {
        this._dirtyFlags.add('blocks');
        hasChanges = true;
      }

      if (current.wires !== previous.wires) {
        this._dirtyFlags.add('wires');
        hasChanges = true;
      }

      if (current.junctions !== previous.junctions) {
        this._dirtyFlags.add('junctions');
        hasChanges = true;
      }

      const viewportChanged =
        !this._numberEquals(current.zoom, previous.zoom) ||
        !this._numberEquals(current.panX, previous.panX) ||
        !this._numberEquals(current.panY, previous.panY);

      if (viewportChanged) {
        this._dirtyFlags.add('viewport');
        hasChanges = true;
      }

      const gridChanged =
        current.gridSize !== previous.gridSize ||
        current.showGrid !== previous.showGrid;

      if (gridChanged) {
        this._dirtyFlags.add('grid');
        hasChanges = true;
      }

      if (hasChanges) {
        this._scheduleSync();
      }
    });
  }

  private _unsubscribeFromStore(): void {
    if (!this._unsubscribe) return;
    this._unsubscribe();
    this._unsubscribe = null;
  }

  private _markDirty(flag: DirtyFlag): void {
    this._dirtyFlags.add(flag);
    this._scheduleSync();
  }

  private _scheduleSync(): void {
    if (!this._config || this._destroyed) return;
    if (this._rafId !== null) return;

    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._processDirtyFlags();
    });
  }

  private _flushNow(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._processDirtyFlags();
  }

  private _processDirtyFlags(): void {
    if (!this._config || this._destroyed) return;
    if (this._dirtyFlags.size === 0) return;

    const flags = new Set(this._dirtyFlags);
    this._dirtyFlags.clear();

    const documentId = this._documentId;
    const doc = documentId
      ? useDocumentRegistry.getState().documents.get(documentId)
      : undefined;
    const snapshot = this._toCanvasSnapshot(doc);

    const isAllDirty = flags.has('all');
    const blocksDirty = isAllDirty || flags.has('blocks');
    const wiresDirty = isAllDirty || flags.has('wires');
    const junctionsDirty = isAllDirty || flags.has('junctions');
    const viewportDirty = isAllDirty || flags.has('viewport');
    const gridDirty = isAllDirty || flags.has('grid');

    if (!snapshot) {
      if (isAllDirty || blocksDirty || wiresDirty || junctionsDirty) {
        this._renderCircuit(EMPTY_BLOCKS, EMPTY_WIRES, EMPTY_JUNCTIONS, {
          blocksDirty: true,
          wiresDirty: true,
          junctionsDirty: true,
        });
      }

      if (isAllDirty || gridDirty || viewportDirty) {
        this._renderGrid();
      }
      return;
    }

    this._applyViewportFromStore(snapshot, viewportDirty);

    let blockRecord: Record<string, Block> | null = null;
    let wireRecord: Record<string, Wire> | null = null;
    let junctionRecord: Record<string, Junction> | null = null;

    const needsCircuitData = blocksDirty || wiresDirty || junctionsDirty;

    if (needsCircuitData) {
      blockRecord = Object.fromEntries(snapshot.components);
      wireRecord = snapshot.wires.reduce<Record<string, Wire>>((acc, wire) => {
        acc[wire.id] = wire;
        return acc;
      }, {});
      junctionRecord = Object.fromEntries(snapshot.junctions);

      this._renderCircuit(blockRecord, wireRecord, junctionRecord, {
        blocksDirty,
        wiresDirty,
        junctionsDirty,
      });
    }

    if (gridDirty || viewportDirty || needsCircuitData) {
      this._updateGridConfig(snapshot);
      this._renderGrid();
    }
  }

  private _renderCircuit(
    blocks: Record<string, Block>,
    wires: Record<string, Wire>,
    junctions: Record<string, Junction>,
    options: { blocksDirty: boolean; wiresDirty: boolean; junctionsDirty: boolean }
  ): void {
    if (!this._config) return;

    if (options.blocksDirty) {
      this._config.blockRenderer.renderAll(blocks);
      this._config.portRenderer.renderAll(blocks);
    }

    if (options.wiresDirty) {
      this._config.wireRenderer.renderAll(wires, blocks, junctions);
    }

    if (options.junctionsDirty) {
      this._config.junctionRenderer.renderAll(junctions);
    }

    this._config.spatialIndex.rebuild(blocks, wires, junctions);
    this._config.hitTester.updateData(blocks, wires, junctions);

    if (import.meta.env.DEV) {
      const blockCount = Object.keys(blocks).length;
      const wireCount = Object.keys(wires).length;
      const junctionCount = Object.keys(junctions).length;
      const total = blockCount + wireCount + junctionCount;
      if (total === 0) {
        console.warn('[SyncEngine] Spatial index rebuilt with EMPTY data — hitTest will always return "none"');
      } else {
        console.debug(`[SyncEngine] Spatial index rebuilt: ${blockCount} blocks, ${wireCount} wires, ${junctionCount} junctions → ${this._config.spatialIndex.size} items`);
      }
    }
  }

  private _applyViewportFromStore(snapshot: CanvasSnapshot, viewportDirty: boolean): void {
    if (!this._config || !viewportDirty) return;

    const viewportState = this._config.viewport.state;
    const changed =
      !this._numberEquals(viewportState.panX, snapshot.panX) ||
      !this._numberEquals(viewportState.panY, snapshot.panY) ||
      !this._numberEquals(viewportState.zoom, snapshot.zoom);

    if (!changed) return;

    this._config.onApplyingViewportStoreState?.(true);
    try {
      this._config.viewport.setViewport({
        panX: snapshot.panX,
        panY: snapshot.panY,
        zoom: snapshot.zoom,
      });
    } finally {
      this._config.onApplyingViewportStoreState?.(false);
    }
  }

  private _updateGridConfig(snapshot: CanvasSnapshot): void {
    if (!this._config) return;

    const currentGridConfig = this._config.gridRenderer.config;
    if (
      currentGridConfig.size === snapshot.gridSize &&
      currentGridConfig.visible === snapshot.showGrid
    ) {
      return;
    }

    this._config.gridRenderer.config = {
      ...currentGridConfig,
      size: snapshot.gridSize,
      visible: snapshot.showGrid,
    };
  }

  private _renderGrid(): void {
    if (!this._config) return;

    this._config.gridRenderer.render(
      this._config.viewport.visibleBounds,
      this._config.viewport.state.zoom
    );
  }

  private _toCanvasSnapshot(doc: DocumentState | undefined): CanvasSnapshot | null {
    if (!doc) return null;

    if (isCanvasDocument(doc)) {
      return {
        components: doc.data.components,
        wires: doc.data.wires,
        junctions: doc.data.junctions,
        zoom: doc.data.zoom,
        panX: doc.data.pan.x,
        panY: doc.data.pan.y,
        gridSize: doc.data.gridSize,
        showGrid: doc.data.showGrid,
      };
    }

    if (isSchematicDocument(doc)) {
      const schematic = doc.data.schematic;
      const activePage = schematic.pages.find(p => p.id === schematic.activePageId);
      if (!activePage) return null;

      const circuit = activePage.circuit;
      // SerializableCircuitState has Record<string, Block> — convert to Map
      const components = new Map(Object.entries(circuit.components)) as Map<string, Block>;
      const junctions = circuit.junctions
        ? new Map(Object.entries(circuit.junctions)) as Map<string, Junction>
        : new Map<string, Junction>();

      return {
        components,
        wires: circuit.wires,
        junctions,
        zoom: circuit.viewport?.zoom ?? 1.0,
        panX: circuit.viewport?.panX ?? 0,
        panY: circuit.viewport?.panY ?? 0,
        gridSize: 20,
        showGrid: true,
      };
    }

    if (import.meta.env.DEV) {
      console.warn(
        `[SyncEngine] Document "${doc.id}" has type "${doc.type}" — unsupported for canvas sync.`
      );
    }
    return null;
  }

  private _numberEquals(a: number, b: number): boolean {
    return Math.abs(a - b) <= EPSILON;
  }
}
