// documentRegistry 스토어가 쓰는 순수 헬퍼들(히스토리 스냅샷·직렬화·경로) — 상태 의존 없음
import type {
  CanvasDocumentState,
  CanvasHistoryData,
  LadderHistoryData,
  ScenarioHistoryData,
  CanvasDocumentData,
  LadderDocumentData,
} from '../types/document';
import type { SerializableCircuitState } from '../components/OneCanvas/types';
import {
  GRID_VERSION,
  ensureRuntimeGridUnit,
  normalizeSerializableCircuitState,
} from '../components/OneCanvas/canvasUnits';
import type {
  LadderElement,
  HorizontalEdgeEntity,
  VerticalEdgeEntity,
} from '../types/ladder';
import { rebuildLadderTopologyCache } from '../components/LadderEditor/utils/topologyBuilder';
import type { Scenario } from '../types/scenario';

/** Create canvas history snapshot */
export function createCanvasHistorySnapshot(data: CanvasDocumentData): CanvasHistoryData {
  return {
    components: Array.from(data.components.entries()).map(([id, block]) => [
      id,
      { ...block, ports: [...block.ports] },
    ]),
    junctions: Array.from(data.junctions.entries()).map(([id, junction]) => [
      id,
      { ...junction, position: { ...junction.position } },
    ]),
    wires: data.wires.map((wire) => ({
      ...wire,
      from: { ...wire.from },
      to: { ...wire.to },
      handles: wire.handles ? wire.handles.map((h) => ({ ...h, position: { ...h.position } })) : undefined,
    })),
  };
}

/** Restore canvas data from history snapshot */
export function restoreCanvasFromHistory(snapshot: CanvasHistoryData): Pick<CanvasDocumentData, 'components' | 'junctions' | 'wires'> {
  return {
    components: new Map(
      snapshot.components.map(([id, block]) => [id, { ...block, ports: [...block.ports] }])
    ),
    junctions: new Map(
      (snapshot.junctions ?? []).map(([id, junction]) => [id, { ...junction, position: { ...junction.position } }])
    ),
    wires: snapshot.wires.map((wire) => ({
      ...wire,
      from: { ...wire.from },
      to: { ...wire.to },
      handles: wire.handles ? wire.handles.map((h) => ({ ...h, position: { ...h.position } })) : undefined,
    })),
  };
}

export function canvasDataToSerializable(data: CanvasDocumentData): SerializableCircuitState {
  return {
    version: GRID_VERSION,
    components: Object.fromEntries(data.components),
    junctions: data.junctions.size > 0 ? Object.fromEntries(data.junctions) : undefined,
    wires: data.wires.map((wire) => ({
      ...wire,
      from: { ...wire.from },
      to: { ...wire.to },
      handles: wire.handles
        ? wire.handles.map((handle) => ({ ...handle, position: { ...handle.position } }))
        : undefined,
    })),
    metadata: { ...data.metadata, version: GRID_VERSION },
    viewport: {
      zoom: data.zoom,
      panX: data.pan.x,
      panY: data.pan.y,
    },
    gridSize: data.gridSize,
    showGrid: data.showGrid,
    gridStyle: data.gridStyle,
    gridUnit: data.gridUnit,
  };
}

export function applySerializableToCanvasData(doc: CanvasDocumentState, circuit: SerializableCircuitState): void {
  const normalized = normalizeSerializableCircuitState(circuit);

  doc.data.components = new Map(Object.entries(normalized.components));
  doc.data.junctions = normalized.junctions ? new Map(Object.entries(normalized.junctions)) : new Map();
  doc.data.wires = normalized.wires.map((wire) => ({
    ...wire,
    from: { ...wire.from },
    to: { ...wire.to },
    handles: wire.handles
      ? wire.handles.map((handle) => ({ ...handle, position: { ...handle.position } }))
      : undefined,
  }));
  doc.data.metadata = { ...normalized.metadata };
  if (normalized.viewport) {
    doc.data.zoom = normalized.viewport.zoom;
    doc.data.pan = {
      x: normalized.viewport.panX,
      y: normalized.viewport.panY,
    };
  }
  doc.data.gridSize = normalized.gridSize ?? doc.data.gridSize;
  doc.data.showGrid = normalized.showGrid ?? doc.data.showGrid;
  doc.data.gridStyle = normalized.gridStyle ?? doc.data.gridStyle;
  doc.data.gridUnit = ensureRuntimeGridUnit(normalized.gridUnit);
}

/** Create ladder history snapshot */
export function createLadderHistorySnapshot(data: LadderDocumentData): LadderHistoryData {
  const elements: Array<[string, LadderElement]> = [];
  data.elements.forEach((element, id) => {
    elements.push([id, JSON.parse(JSON.stringify(element))]);
  });

  const horizontalEdges: Array<[string, HorizontalEdgeEntity]> = [];
  data.horizontalEdges.forEach((horizontalEdge, id) => {
    horizontalEdges.push([id, JSON.parse(JSON.stringify(horizontalEdge))]);
  });

  const verticalEdges: Array<[string, VerticalEdgeEntity]> = [];
  data.verticalEdges.forEach((verticalEdge, id) => {
    verticalEdges.push([id, JSON.parse(JSON.stringify(verticalEdge))]);
  });

  return {
    elements,
    horizontalEdges,
    verticalEdges,
    comment: data.comment,
    rungLabels: Array.from(data.rungLabels.entries()),
  };
}

/** Restore ladder data from history snapshot */
export function restoreLadderFromHistory(snapshot: LadderHistoryData): Pick<LadderDocumentData, 'elements' | 'horizontalEdges' | 'verticalEdges' | 'comment' | 'rungLabels' | 'topologyCache'> {
  const elements = new Map<string, LadderElement>();
  snapshot.elements.forEach(([id, element]) => {
    elements.set(id, JSON.parse(JSON.stringify(element)));
  });

  const horizontalEdges = new Map<string, HorizontalEdgeEntity>();
  (snapshot.horizontalEdges ?? []).forEach(([id, horizontalEdge]) => {
    horizontalEdges.set(id, JSON.parse(JSON.stringify(horizontalEdge)));
  });

  const verticalEdges = new Map<string, VerticalEdgeEntity>();
  (snapshot.verticalEdges ?? []).forEach(([id, verticalEdge]) => {
    verticalEdges.set(id, JSON.parse(JSON.stringify(verticalEdge)));
  });

  const restored: Pick<LadderDocumentData, 'elements' | 'horizontalEdges' | 'verticalEdges' | 'comment' | 'rungLabels' | 'topologyCache'> = {
    elements,
    horizontalEdges,
    verticalEdges,
    comment: snapshot.comment,
    rungLabels: new Map(snapshot.rungLabels ?? []),
    topologyCache: undefined,
  };
  (restored as LadderDocumentData).topologyCache = rebuildLadderTopologyCache(restored as LadderDocumentData);
  return restored;
}

/** Create scenario history snapshot */
export function createScenarioHistorySnapshot(scenario: Scenario): ScenarioHistoryData {
  return {
    scenario: JSON.parse(JSON.stringify(scenario)),
  };
}

/** Get file name from path */
export function getFileNameFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const fileName = parts[parts.length - 1];
  // Remove extension
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
}
