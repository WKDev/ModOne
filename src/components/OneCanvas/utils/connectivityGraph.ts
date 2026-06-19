/**
 * ConnectivityGraph — Coordinate-based net resolution
 *
 * Resolves electrical connectivity by matching endpoint positions on a grid.
 * Unlike the reference-based approach in netBuilder.ts, this system determines
 * connectivity by coordinate proximity: endpoints at the same grid-snapped
 * position belong to the same electrical net.
 *
 * Grid key: round to nearest grid-step boundary (default 5 mm).
 */

import type { Wire, Block, Junction, Position, WireEndpoint } from '../types';
import { isPortEndpoint, isJunctionEndpoint, isFloatingEndpoint } from '../types';
import { UnionFind } from './netBuilder';
import type { Net } from './netBuilder';
import { getPortRelativePosition } from './wirePathCalculator';
import { GRID_MODULE_MM } from '../canvasUnits';

function gridKey(pos: Position, step: number = GRID_MODULE_MM): string {
  const x = Math.round(pos.x / step) * step;
  const y = Math.round(pos.y / step) * step;
  return `${x}:${y}`;
}

function resolveEndpointPosition(
  endpoint: WireEndpoint,
  components: Map<string, Block>,
  junctions: Map<string, Junction>
): Position | null {
  if (isPortEndpoint(endpoint)) {
    const block = components.get(endpoint.componentId);
    if (!block) return null;

    const port = block.ports.find((p) => p.id === endpoint.portId);
    if (!port) return null;

    const relative = getPortRelativePosition(port.position, port.offset ?? 0.5, block.size);
    return {
      x: block.position.x + relative.x,
      y: block.position.y + relative.y,
    };
  }

  if (isJunctionEndpoint(endpoint)) {
    return junctions.get(endpoint.junctionId)?.position ?? null;
  }

  if (isFloatingEndpoint(endpoint)) {
    return endpoint.position;
  }

  return null;
}

class ConnectivityGraph {
  private _nets: Net[] = [];
  private _dirty = true;
  private _wires: Wire[] = [];
  private _components: Map<string, Block> = new Map();
  private _junctions: Map<string, Junction> = new Map();
  private _gridStep: number = GRID_MODULE_MM;

  set gridStep(value: number) {
    if (value > 0) this._gridStep = value;
  }

  rebuild(wires: Wire[], components: Map<string, Block>, junctions: Map<string, Junction>): void {
    this._wires = wires;
    this._components = components;
    this._junctions = junctions;
    this._dirty = false;
    this._resolve();
  }

  onWireAdded(wire: Wire): void {
    this._wires.push(wire);
    this._dirty = true;
  }

  onWireRemoved(wireId: string): void {
    this._wires = this._wires.filter((wire) => wire.id !== wireId);
    this._dirty = true;
  }

  getNetForPosition(position: Position): Net | undefined {
    if (this._dirty) {
      this._resolve();
    }

    const key = gridKey(position, this._gridStep);
    return this._nets.find((net) => net.members.has(key));
  }

  getAllNets(): Net[] {
    if (this._dirty) {
      this._resolve();
    }

    return this._nets;
  }

  getNetForEndpoint(endpoint: WireEndpoint): Net | undefined {
    const position = resolveEndpointPosition(endpoint, this._components, this._junctions);
    if (!position) {
      return undefined;
    }

    return this.getNetForPosition(position);
  }

  private _resolve(): void {
    const uf = new UnionFind();

    for (const wire of this._wires) {
      const fromPos = resolveEndpointPosition(wire.from, this._components, this._junctions);
      const toPos = resolveEndpointPosition(wire.to, this._components, this._junctions);

      if (!fromPos || !toPos) {
        continue;
      }

      const fromKey = gridKey(fromPos, this._gridStep);
      const toKey = gridKey(toPos, this._gridStep);
      uf.union(fromKey, toKey);
    }

    for (const [, component] of this._components) {
      for (const port of component.ports) {
        const relative = getPortRelativePosition(port.position, port.offset ?? 0.5, component.size);
        const absolute = {
          x: component.position.x + relative.x,
          y: component.position.y + relative.y,
        };
        uf.find(gridKey(absolute, this._gridStep));
      }
    }

    for (const [, junction] of this._junctions) {
      uf.find(gridKey(junction.position, this._gridStep));
    }

    const netMap = new Map<string, Set<string>>();

    for (const key of uf.parent.keys()) {
      const root = uf.find(key);
      if (!netMap.has(root)) {
        netMap.set(root, new Set());
      }
      netMap.get(root)!.add(key);
    }

    const nets: Net[] = [];
    for (const [id, members] of netMap) {
      if (members.size >= 2) {
        nets.push({ id, members });
      }
    }

    this._nets = nets;
    this._dirty = false;
  }
}

export { ConnectivityGraph };
export type { Net };
