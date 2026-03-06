import { useDocumentRegistry } from '@stores/documentRegistry';
import type { CanvasDocumentData } from '@/types/document';
import { isCanvasDocument } from '@/types/document';
import type { PixiLayerManager } from './PixiLayerManager';
import { PixiBlockRenderer } from './PixiBlockRenderer';
import { PixiJunctionRenderer } from './PixiJunctionRenderer';
import { PixiPortRenderer } from './PixiPortRenderer';
import { PixiSelectionRenderer } from './PixiSelectionRenderer';
import { PixiWireRenderer } from './PixiWireRenderer';

type VisibleBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export interface PixiGridRenderer {
  update(zoom: number, visibleBounds: VisibleBounds): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

interface SyncSnapshot {
  components: CanvasDocumentData['components'];
  wires: CanvasDocumentData['wires'];
  junctions: CanvasDocumentData['junctions'];
  zoom: number;
  pan: CanvasDocumentData['pan'];
  selectedIds: string[];
  gridSize: number;
  showGrid: boolean;
}

interface DirtyFlags {
  grid: boolean;
  viewport: boolean;
  components: boolean;
  wires: boolean;
  junctions: boolean;
  selection: boolean;
}

const EMPTY_FLAGS: DirtyFlags = {
  grid: false,
  viewport: false,
  components: false,
  wires: false,
  junctions: false,
  selection: false,
};

function cloneFlags(flags: DirtyFlags): DirtyFlags {
  return { ...flags };
}

function areStringArraysShallowEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

function normalizeStringIds(ids: Iterable<string>): string[] {
  const unique = new Set<string>();
  for (const id of ids) {
    unique.add(id);
  }
  return Array.from(unique).sort();
}

function extractSelectedIds(data: CanvasDocumentData): string[] {
  const withSelection = data as CanvasDocumentData & {
    selectedIds?: unknown;
    selection?: unknown;
  };

  if (withSelection.selectedIds instanceof Set) {
    return normalizeStringIds(withSelection.selectedIds.values());
  }

  if (Array.isArray(withSelection.selectedIds)) {
    const stringIds = withSelection.selectedIds.filter((id): id is string => typeof id === 'string');
    return normalizeStringIds(stringIds);
  }

  if (
    withSelection.selection !== null &&
    typeof withSelection.selection === 'object' &&
    'items' in withSelection.selection
  ) {
    const maybeItems = (withSelection.selection as { items?: unknown }).items;
    if (maybeItems instanceof Map) {
      const keys = Array.from(maybeItems.keys()).filter((id): id is string => typeof id === 'string');
      return normalizeStringIds(keys);
    }
  }

  return [];
}

function toSnapshot(data: CanvasDocumentData): SyncSnapshot {
  return {
    components: data.components,
    wires: data.wires,
    junctions: data.junctions,
    zoom: data.zoom,
    pan: data.pan,
    selectedIds: extractSelectedIds(data),
    gridSize: data.gridSize,
    showGrid: data.showGrid,
  };
}

type RegistryState = ReturnType<typeof useDocumentRegistry.getState>;

export class PixiSyncEngine {
  private unsubscribers: Array<() => void> = [];

  private prevState: SyncSnapshot | null = null;

  private latestState: SyncSnapshot | null = null;

  private dirtyFlags: DirtyFlags = cloneFlags(EMPTY_FLAGS);

  private rafId: number | null = null;

  private viewportZoomOverride: number | null = null;

  private appliedLodZoom: number | null = null;

  private blockRenderer: PixiBlockRenderer;

  private portRenderer: PixiPortRenderer;

  private wireRenderer: PixiWireRenderer;

  private junctionRenderer: PixiJunctionRenderer;

  private selectionRenderer: PixiSelectionRenderer;

  constructor(
    private documentId: string,
    layers: PixiLayerManager,
    private gridRenderer: PixiGridRenderer,
    private getVisibleBounds: () => VisibleBounds,
  ) {
    this.blockRenderer = new PixiBlockRenderer(layers.blockLayer);
    this.portRenderer = new PixiPortRenderer(layers.portLayer);
    this.wireRenderer = new PixiWireRenderer(layers.wireLayer);
    this.junctionRenderer = new PixiJunctionRenderer(layers.junctionLayer);
    this.selectionRenderer = new PixiSelectionRenderer(
      layers.selectionLayer,
      this.blockRenderer,
      this.wireRenderer,
      this.junctionRenderer,
    );
    this.portRenderer.setBlockVisibilityLookup((blockId) => this.blockRenderer.isBlockVisible(blockId));
  }

  start(): void {
    if (this.unsubscribers.length > 0) {
      return;
    }

    const initial = this.getCurrentSnapshot();
    this.prevState = initial;
    this.latestState = initial;

    if (initial !== null) {
      this.markDirty({
        grid: true,
        viewport: true,
        components: true,
        wires: true,
        junctions: true,
        selection: true,
      });
      this.scheduleFlush();
    }

    const unsub = useDocumentRegistry.subscribe((state) => {
      this.onStoreChanged(state);
    });

    this.unsubscribers.push(unsub);
  }

  stop(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.blockRenderer.destroy();
    this.portRenderer.destroy();
    this.wireRenderer.destroy();
    this.junctionRenderer.destroy();
    this.selectionRenderer.destroy();

    this.prevState = null;
    this.latestState = null;
    this.viewportZoomOverride = null;
    this.appliedLodZoom = null;
    this.dirtyFlags = cloneFlags(EMPTY_FLAGS);
  }

  onViewportChanged(zoom: number): void {
    this.viewportZoomOverride = zoom;
    this.markDirty({ grid: true, viewport: true });
    this.scheduleFlush();
  }

  private onStoreChanged(state: RegistryState): void {
    const doc = state.documents.get(this.documentId);
    if (!doc || !isCanvasDocument(doc)) {
      this.prevState = null;
      this.latestState = null;
      return;
    }

    const nextSnapshot = toSnapshot(doc.data);
    const prevSnapshot = this.prevState;

    this.latestState = nextSnapshot;

    if (prevSnapshot === null) {
      this.prevState = nextSnapshot;
      this.markDirty({
        grid: true,
        viewport: true,
        components: true,
        wires: true,
        junctions: true,
        selection: true,
      });
      this.scheduleFlush();
      return;
    }

    const componentsChanged = prevSnapshot.components !== nextSnapshot.components;
    const wiresChanged = prevSnapshot.wires !== nextSnapshot.wires;
    const junctionsChanged = prevSnapshot.junctions !== nextSnapshot.junctions;
    const zoomChanged = prevSnapshot.zoom !== nextSnapshot.zoom;
    const panChanged =
      prevSnapshot.pan !== nextSnapshot.pan
      || prevSnapshot.pan.x !== nextSnapshot.pan.x
      || prevSnapshot.pan.y !== nextSnapshot.pan.y;
    const selectedIdsChanged = !areStringArraysShallowEqual(prevSnapshot.selectedIds, nextSnapshot.selectedIds);
    const gridSettingsChanged =
      prevSnapshot.gridSize !== nextSnapshot.gridSize || prevSnapshot.showGrid !== nextSnapshot.showGrid;

    this.prevState = nextSnapshot;

    if (
      !componentsChanged
      && !wiresChanged
      && !junctionsChanged
      && !zoomChanged
      && !panChanged
      && !selectedIdsChanged
      && !gridSettingsChanged
    ) {
      return;
    }

    this.markDirty({
      grid: zoomChanged || panChanged || gridSettingsChanged,
      viewport: zoomChanged || panChanged,
      components: componentsChanged,
      wires: wiresChanged,
      junctions: junctionsChanged,
      selection: selectedIdsChanged,
    });
    this.scheduleFlush();
  }

  private flush(): void {
    const snapshot = this.latestState;
    if (snapshot === null) {
      this.viewportZoomOverride = null;
      this.appliedLodZoom = null;
      this.dirtyFlags = cloneFlags(EMPTY_FLAGS);
      return;
    }

    const zoom = this.viewportZoomOverride ?? snapshot.zoom;
    const visibleBounds = this.getVisibleBounds();

    if (this.dirtyFlags.viewport || this.dirtyFlags.components) {
      this.blockRenderer.setVisibleBounds(visibleBounds);
      this.portRenderer.setVisibleBounds(visibleBounds);
    }

    if (this.dirtyFlags.viewport || this.dirtyFlags.wires) {
      this.wireRenderer.setVisibleBounds(visibleBounds);
    }

    if (this.dirtyFlags.viewport || this.dirtyFlags.junctions) {
      this.junctionRenderer.setVisibleBounds(visibleBounds);
    }

    if (this.dirtyFlags.grid) {
      this.gridRenderer.setVisible(snapshot.showGrid);
      this.gridRenderer.update(zoom, visibleBounds);
    }

    if (this.dirtyFlags.components) {
      this.blockRenderer.sync(snapshot.components);
      this.portRenderer.syncPorts(snapshot.components);
    }

    if (this.dirtyFlags.wires) {
      this.wireRenderer.sync(snapshot.wires, snapshot.components, snapshot.junctions);
    }

    if (this.dirtyFlags.junctions) {
      this.junctionRenderer.sync(snapshot.junctions);
    }

    if (this.dirtyFlags.viewport) {
      this.blockRenderer.applyViewportCulling();
      this.wireRenderer.applyViewportCulling();
      this.junctionRenderer.applyViewportCulling();
      this.portRenderer.applyViewportCulling();
    }

    if (
      this.appliedLodZoom === null
      || this.appliedLodZoom !== zoom
      || this.dirtyFlags.components
      || this.dirtyFlags.wires
      || this.dirtyFlags.viewport
    ) {
      this.blockRenderer.setLOD(zoom);
      this.wireRenderer.setLOD(zoom);
      this.portRenderer.setLOD(zoom);
      this.appliedLodZoom = zoom;
    }

    if (this.dirtyFlags.selection) {
      this.selectionRenderer.update(
        snapshot.selectedIds,
        snapshot.components,
        snapshot.wires,
        snapshot.junctions,
      );
    }

    this.viewportZoomOverride = null;
    this.dirtyFlags = cloneFlags(EMPTY_FLAGS);
  }

  private scheduleFlush(): void {
    if (this.rafId !== null) {
      return;
    }

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.flush();
    });
  }

  private markDirty(partial: Partial<DirtyFlags>): void {
    this.dirtyFlags = {
      grid: this.dirtyFlags.grid || partial.grid === true,
      viewport: this.dirtyFlags.viewport || partial.viewport === true,
      components: this.dirtyFlags.components || partial.components === true,
      wires: this.dirtyFlags.wires || partial.wires === true,
      junctions: this.dirtyFlags.junctions || partial.junctions === true,
      selection: this.dirtyFlags.selection || partial.selection === true,
    };
  }

  private getCurrentSnapshot(): SyncSnapshot | null {
    const state = useDocumentRegistry.getState();
    const doc = state.documents.get(this.documentId);
    if (!doc || !isCanvasDocument(doc)) {
      return null;
    }

    return toSnapshot(doc.data);
  }
}
