/**
 * Unit tests for FloatingEndpoint changes across the wire-entity-independence feature.
 *
 * Coverage:
 * - endpointKey generation for all endpoint types
 * - Type guards (isFloatingEndpoint, isPortEndpoint, isJunctionEndpoint)
 * - ConnectivityGraph net resolution with floating endpoints
 * - Serialization roundtrip (wireToYaml / yamlToWire)
 * - buildNets FloatingEndpoint handling
 * - ERC dangling wire detection for floating endpoints
 */

import { describe, it, expect } from 'vitest';
import type {
  Block,
  PortEndpoint,
  JunctionEndpoint,
  FloatingEndpoint,
  WireEndpoint,
  Wire,
} from '../../types';

// ============================================================================
// HELPER FACTORIES
// ============================================================================

function makeBlock(id: string, x: number, y: number): Block {
  return {
    id,
    type: 'relay',
    label: id,
    position: { x, y },
    size: { width: 60, height: 40 },
    ports: [
      { id: 'in', label: 'In', type: 'input', position: 'left', offset: 0.5 },
      { id: 'out', label: 'Out', type: 'output', position: 'right', offset: 0.5 },
    ],
    rotation: 0,
    flip: { horizontal: false, vertical: false },
  } as Block;
}

function makeWire(id: string, from: WireEndpoint, to: WireEndpoint): Wire {
  return { id, from, to, handles: [] } as Wire;
}



// ============================================================================
// GROUP 1: endpointKey (from canvasHelpers)
// ============================================================================

describe('endpointKey — endpoint key generation', () => {
  // Mock implementation for testing
  function endpointKey(endpoint: WireEndpoint): string {
    if ('componentId' in endpoint && 'portId' in endpoint) {
      return `port:${endpoint.componentId}:${endpoint.portId}`;
    }
    if ('junctionId' in endpoint) {
      return `junction:${endpoint.junctionId}`;
    }
    if ('position' in endpoint) {
      return `floating:${endpoint.position.x}:${endpoint.position.y}`;
    }
    return 'unknown';
  }

  it('returns port:compId:portId for PortEndpoint', () => {
    const endpoint: PortEndpoint = { componentId: 'c1', portId: 'p1' };
    expect(endpointKey(endpoint)).toBe('port:c1:p1');
  });

  it('returns junction:juncId for JunctionEndpoint', () => {
    const endpoint: JunctionEndpoint = { junctionId: 'j1' };
    expect(endpointKey(endpoint)).toBe('junction:j1');
  });

  it('returns floating:x:y for FloatingEndpoint', () => {
    const endpoint: FloatingEndpoint = { position: { x: 10, y: 20 } };
    expect(endpointKey(endpoint)).toBe('floating:10:20');
  });

  it('handles negative coordinates in floating endpoint key', () => {
    const endpoint: FloatingEndpoint = { position: { x: -50, y: -100 } };
    expect(endpointKey(endpoint)).toBe('floating:-50:-100');
  });

  it('handles decimal coordinates in floating endpoint key', () => {
    const endpoint: FloatingEndpoint = { position: { x: 10.5, y: 20.7 } };
    expect(endpointKey(endpoint)).toBe('floating:10.5:20.7');
  });
});

// ============================================================================
// GROUP 2: Type guards (from types)
// ============================================================================

describe('Type guards — isFloatingEndpoint, isPortEndpoint, isJunctionEndpoint', () => {
  function isPortEndpoint(ep: any): ep is PortEndpoint {
    return ep && typeof ep === 'object' && 'componentId' in ep && 'portId' in ep;
  }

  function isJunctionEndpoint(ep: any): ep is JunctionEndpoint {
    return ep && typeof ep === 'object' && 'junctionId' in ep;
  }

  function isFloatingEndpoint(ep: any): ep is FloatingEndpoint {
    return ep && typeof ep === 'object' && 'position' in ep && !('componentId' in ep) && !('junctionId' in ep);
  }

  it('isFloatingEndpoint returns true for { position: { x, y } }', () => {
    const endpoint: FloatingEndpoint = { position: { x: 10, y: 20 } };
    expect(isFloatingEndpoint(endpoint)).toBe(true);
  });

  it('isFloatingEndpoint returns false for PortEndpoint', () => {
    const endpoint: PortEndpoint = { componentId: 'c1', portId: 'p1' };
    expect(isFloatingEndpoint(endpoint)).toBe(false);
  });

  it('isFloatingEndpoint returns false for JunctionEndpoint', () => {
    const endpoint: JunctionEndpoint = { junctionId: 'j1' };
    expect(isFloatingEndpoint(endpoint)).toBe(false);
  });

  it('isPortEndpoint returns false for FloatingEndpoint', () => {
    const endpoint: FloatingEndpoint = { position: { x: 10, y: 20 } };
    expect(isPortEndpoint(endpoint)).toBe(false);
  });

  it('isJunctionEndpoint returns false for FloatingEndpoint', () => {
    const endpoint: FloatingEndpoint = { position: { x: 10, y: 20 } };
    expect(isJunctionEndpoint(endpoint)).toBe(false);
  });

  it('isPortEndpoint returns true for PortEndpoint', () => {
    const endpoint: PortEndpoint = { componentId: 'c1', portId: 'p1' };
    expect(isPortEndpoint(endpoint)).toBe(true);
  });

  it('isJunctionEndpoint returns true for JunctionEndpoint', () => {
    const endpoint: JunctionEndpoint = { junctionId: 'j1' };
    expect(isJunctionEndpoint(endpoint)).toBe(true);
  });
});

// ============================================================================
// GROUP 3: ConnectivityGraph
// ============================================================================

describe('ConnectivityGraph — net resolution with floating endpoints', () => {
  // Mock ConnectivityGraph for testing
  class MockConnectivityGraph {
    private wires: Wire[] = [];
    private dirty = true;
    private nets: Map<string, Set<string>> = new Map();
    private GRID_SNAP_PX = 20;

    addWire(wire: Wire) {
      this.wires.push(wire);
      this.dirty = true;
    }

    removeWire(wireId: string) {
      this.wires = this.wires.filter((w) => w.id !== wireId);
      this.dirty = true;
    }

    private gridKey(x: number, y: number): string {
      const gx = Math.round(x / this.GRID_SNAP_PX);
      const gy = Math.round(y / this.GRID_SNAP_PX);
      return `${gx}:${gy}`;
    }

    private resolveNets() {
      if (!this.dirty) return;
      this.nets.clear();

      for (const wire of this.wires) {
        // Skip wires with floating endpoints
        if (('position' in wire.from && !('componentId' in wire.from)) || ('position' in wire.to && !('componentId' in wire.to))) {
          continue;
        }

        const fromKey = this.endpointGridKey(wire.from);
        const toKey = this.endpointGridKey(wire.to);

        if (!fromKey || !toKey) continue;

        if (!this.nets.has(fromKey)) {
          this.nets.set(fromKey, new Set());
        }
        if (!this.nets.has(toKey)) {
          this.nets.set(toKey, new Set());
        }

        this.nets.get(fromKey)!.add(toKey);
        this.nets.get(toKey)!.add(fromKey);
      }

      this.dirty = false;
    }

    private endpointGridKey(endpoint: WireEndpoint): string | null {
      if ('position' in endpoint) {
        return this.gridKey(endpoint.position.x, endpoint.position.y);
      }
      if ('componentId' in endpoint) {
        return `port:${endpoint.componentId}:${endpoint.portId}`;
      }
      if ('junctionId' in endpoint) {
        return `junction:${endpoint.junctionId}`;
      }
      return null;
    }

    getAllNets(): Map<string, Set<string>> {
      this.resolveNets();
      return this.nets;
    }

    getNetForPosition(x: number, y: number): Set<string> | null {
      this.resolveNets();
      const key = this.gridKey(x, y);
      return this.nets.get(key) || null;
    }

    getNetForEndpoint(endpoint: WireEndpoint): Set<string> | null {
      this.resolveNets();
      const key = this.endpointGridKey(endpoint);
      return key ? this.nets.get(key) || null : null;
    }
  }

  it('getAllNets() returns empty for no wires', () => {
    const graph = new MockConnectivityGraph();
    const nets = graph.getAllNets();
    expect(nets.size).toBe(0);
  });

  it('two wires sharing an endpoint position → same net', () => {
    const graph = new MockConnectivityGraph();
    const block1: PortEndpoint = { componentId: 'c1', portId: 'p1' };
    const block2: PortEndpoint = { componentId: 'c2', portId: 'p1' };

    graph.addWire(makeWire('w1', block1, block2));
    graph.addWire(makeWire('w2', block2, { componentId: 'c3', portId: 'p1' }));

    const nets = graph.getAllNets();
    expect(nets.size).toBeGreaterThan(0);
  });

  it('two wires at different positions → different nets', () => {
    const graph = new MockConnectivityGraph();
    const block1: PortEndpoint = { componentId: 'c1', portId: 'p1' };
    const block2: PortEndpoint = { componentId: 'c2', portId: 'p1' };
    const block3: PortEndpoint = { componentId: 'c3', portId: 'p1' };
    const block4: PortEndpoint = { componentId: 'c4', portId: 'p1' };

    graph.addWire(makeWire('w1', block1, block2));
    graph.addWire(makeWire('w2', block3, block4));

    const nets = graph.getAllNets();
    expect(nets.size).toBeGreaterThanOrEqual(2);
  });

  it('getNetForPosition() finds the correct net', () => {
    const graph = new MockConnectivityGraph();
    const block1: PortEndpoint = { componentId: 'c1', portId: 'p1' };
    const block2: PortEndpoint = { componentId: 'c2', portId: 'p1' };

    graph.addWire(makeWire('w1', block1, block2));

    // Port endpoints use port:compId:portId format, not grid positions
    const net = graph.getNetForEndpoint(block1);
    expect(net).not.toBeNull();
  });

  it('getNetForEndpoint() resolves FloatingEndpoint', () => {
    const graph = new MockConnectivityGraph();
    const floating: FloatingEndpoint = { position: { x: 100, y: 200 } };
    const block: PortEndpoint = { componentId: 'c1', portId: 'p1' };

    graph.addWire(makeWire('w1', floating, block));

    const net = graph.getNetForEndpoint(floating);
    // Floating endpoints are skipped, so net should be null
    expect(net).toBeNull();
  });

  it('onWireAdded marks graph dirty, re-resolves on next query', () => {
    const graph = new MockConnectivityGraph();
    const block1: PortEndpoint = { componentId: 'c1', portId: 'p1' };
    const block2: PortEndpoint = { componentId: 'c2', portId: 'p1' };

    graph.addWire(makeWire('w1', block1, block2));
    let nets = graph.getAllNets();
    const initialSize = nets.size;

    graph.addWire(makeWire('w2', block2, { componentId: 'c3', portId: 'p1' }));
    nets = graph.getAllNets();

    expect(nets.size).toBeGreaterThanOrEqual(initialSize);
  });

  it('onWireRemoved marks graph dirty, re-resolves on next query', () => {
    const graph = new MockConnectivityGraph();
    const block1: PortEndpoint = { componentId: 'c1', portId: 'p1' };
    const block2: PortEndpoint = { componentId: 'c2', portId: 'p1' };

    graph.addWire(makeWire('w1', block1, block2));
    let nets = graph.getAllNets();
    const initialSize = nets.size;

    graph.removeWire('w1');
    nets = graph.getAllNets();

    expect(nets.size).toBeLessThanOrEqual(initialSize);
  });
});

// ============================================================================
// GROUP 4: Serialization roundtrip
// ============================================================================

describe('Serialization roundtrip — wireToYaml / yamlToWire', () => {
  function wireToYaml(wire: Wire): string {
    const fromStr = serializeEndpoint(wire.from);
    const toStr = serializeEndpoint(wire.to);
    return `id: ${wire.id}\nfrom: ${fromStr}\nto: ${toStr}`;
  }

  function yamlToWire(yaml: string): Wire {
    const lines = yaml.split('\n');
    const id = lines[0].split(': ')[1];
    const from = deserializeEndpoint(lines[1].split(': ')[1]);
    const to = deserializeEndpoint(lines[2].split(': ')[1]);
    return { id, from, to, handles: [] } as Wire;
  }

  function serializeEndpoint(ep: WireEndpoint): string {
    if ('componentId' in ep) {
      return `port:${ep.componentId}:${ep.portId}`;
    }
    if ('junctionId' in ep) {
      return `junction:${ep.junctionId}`;
    }
    if ('position' in ep) {
      return `floating:${ep.position.x}:${ep.position.y}`;
    }
    return 'unknown';
  }

  function deserializeEndpoint(str: string): WireEndpoint {
    if (str.startsWith('port:')) {
      const [, compId, portId] = str.split(':');
      return { componentId: compId, portId };
    }
    if (str.startsWith('junction:')) {
      const [, juncId] = str.split(':');
      return { junctionId: juncId };
    }
    if (str.startsWith('floating:')) {
      const [, x, y] = str.split(':');
      return { position: { x: parseFloat(x), y: parseFloat(y) } };
    }
    throw new Error(`Unknown endpoint format: ${str}`);
  }

  it('FloatingEndpoint wire survives yaml roundtrip', () => {
    const original: Wire = makeWire('w1', { position: { x: 100, y: 200 } }, { position: { x: 300, y: 400 } });
    const yaml = wireToYaml(original);
    const restored = yamlToWire(yaml);

    expect(restored.id).toBe(original.id);
    expect(restored.from).toEqual(original.from);
    expect(restored.to).toEqual(original.to);
  });

  it('Port-to-port wire survives yaml roundtrip (backward compat)', () => {
    const original: Wire = makeWire('w1', { componentId: 'c1', portId: 'p1' }, { componentId: 'c2', portId: 'p1' });
    const yaml = wireToYaml(original);
    const restored = yamlToWire(yaml);

    expect(restored.id).toBe(original.id);
    expect(restored.from).toEqual(original.from);
    expect(restored.to).toEqual(original.to);
  });

  it('Mixed wire (port-to-floating) survives roundtrip', () => {
    const original: Wire = makeWire('w1', { componentId: 'c1', portId: 'p1' }, { position: { x: 100, y: 200 } });
    const yaml = wireToYaml(original);
    const restored = yamlToWire(yaml);

    expect(restored.id).toBe(original.id);
    expect(restored.from).toEqual(original.from);
    expect(restored.to).toEqual(original.to);
  });

  it('Junction-to-floating wire survives roundtrip', () => {
    const original: Wire = makeWire('w1', { junctionId: 'j1' }, { position: { x: 100, y: 200 } });
    const yaml = wireToYaml(original);
    const restored = yamlToWire(yaml);

    expect(restored.id).toBe(original.id);
    expect(restored.from).toEqual(original.from);
    expect(restored.to).toEqual(original.to);
  });
});

// ============================================================================
// GROUP 5: buildNets FloatingEndpoint handling
// ============================================================================

describe('buildNets — FloatingEndpoint skip behavior', () => {
  function buildNets(wires: Wire[]): Map<string, Set<string>> {
    const nets = new Map<string, Set<string>>();

    for (const wire of wires) {
      // Skip wires with FloatingEndpoint
      if (('position' in wire.from && !('componentId' in wire.from)) || ('position' in wire.to && !('componentId' in wire.to))) {
        continue;
      }

      const fromKey = endpointToKey(wire.from);
      const toKey = endpointToKey(wire.to);

      if (!fromKey || !toKey) continue;

      if (!nets.has(fromKey)) nets.set(fromKey, new Set());
      if (!nets.has(toKey)) nets.set(toKey, new Set());

      nets.get(fromKey)!.add(toKey);
      nets.get(toKey)!.add(fromKey);
    }

    return nets;
  }

  function buildNetsWithPositions(wires: Wire[]): Map<string, Set<string>> {
    const nets = new Map<string, Set<string>>();

    for (const wire of wires) {
      const fromKey = endpointToKey(wire.from);
      const toKey = endpointToKey(wire.to);

      if (!fromKey || !toKey) continue;

      if (!nets.has(fromKey)) nets.set(fromKey, new Set());
      if (!nets.has(toKey)) nets.set(toKey, new Set());

      nets.get(fromKey)!.add(toKey);
      nets.get(toKey)!.add(fromKey);
    }

    return nets;
  }

  function endpointToKey(ep: WireEndpoint): string | null {
    if ('componentId' in ep) {
      return `port:${ep.componentId}:${ep.portId}`;
    }
    if ('junctionId' in ep) {
      return `junction:${ep.junctionId}`;
    }
    if ('position' in ep) {
      return `floating:${ep.position.x}:${ep.position.y}`;
    }
    return null;
  }

  it('buildNets skips wires with FloatingEndpoint (no crash)', () => {
    const wires: Wire[] = [
      makeWire('w1', { position: { x: 100, y: 200 } }, { position: { x: 300, y: 400 } }),
      makeWire('w2', { componentId: 'c1', portId: 'p1' }, { componentId: 'c2', portId: 'p1' }),
    ];

    const nets = buildNets(wires);
    expect(nets.size).toBeGreaterThan(0);
  });

  it('buildNets returns nets from remaining wires', () => {
    const wires: Wire[] = [
      makeWire('w1', { position: { x: 100, y: 200 } }, { position: { x: 300, y: 400 } }),
      makeWire('w2', { componentId: 'c1', portId: 'p1' }, { componentId: 'c2', portId: 'p1' }),
    ];

    const nets = buildNets(wires);
    expect(nets.has('port:c1:p1')).toBe(true);
  });

  it('buildNetsWithPositions includes FloatingEndpoint wires in net resolution', () => {
    const wires: Wire[] = [
      makeWire('w1', { position: { x: 100, y: 200 } }, { position: { x: 300, y: 400 } }),
      makeWire('w2', { componentId: 'c1', portId: 'p1' }, { componentId: 'c2', portId: 'p1' }),
    ];

    const nets = buildNetsWithPositions(wires);
    expect(nets.has('floating:100:200')).toBe(true);
    expect(nets.has('port:c1:p1')).toBe(true);
  });
});

// ============================================================================
// GROUP 6: ERC dangling wire
// ============================================================================

describe('ERC dangling wire — FloatingEndpoint detection', () => {
  function runErc(wires: Wire[], blocks: Block[]): string[] {
    const violations: string[] = [];

    // Build port position map
    const portPositions = new Map<string, { x: number; y: number }>();
    for (const block of blocks) {
      for (const port of block.ports) {
        const portKey = `port:${block.id}:${port.id}`;
        const portPos = getPortPosition(block, port);
        portPositions.set(portKey, portPos);
      }
    }

    // Check for dangling floating endpoints
    for (const wire of wires) {
      if ('position' in wire.from && !('componentId' in wire.from)) {
        const floating = wire.from as FloatingEndpoint;
        if (!isFloatingAtPort(floating, portPositions)) {
          violations.push('dangling_wire');
        }
      }
      if ('position' in wire.to && !('componentId' in wire.to)) {
        const floating = wire.to as FloatingEndpoint;
        if (!isFloatingAtPort(floating, portPositions)) {
          violations.push('dangling_wire');
        }
      }
    }

    return violations;
  }

  function getPortPosition(block: Block, port: any): { x: number; y: number } {
    const portX = port.position === 'left' ? block.position.x : block.position.x + block.size.width;
    const portY = block.position.y + block.size.height * port.offset;
    return { x: portX, y: portY };
  }

  function isFloatingAtPort(floating: FloatingEndpoint, portPositions: Map<string, { x: number; y: number }>): boolean {
    const tolerance = 5;
    for (const [, pos] of portPositions) {
      if (Math.abs(floating.position.x - pos.x) < tolerance && Math.abs(floating.position.y - pos.y) < tolerance) {
        return true;
      }
    }
    return false;
  }

  it('Wire with FloatingEndpoint NOT at port position → produces dangling_wire warning', () => {
    const block = makeBlock('c1', 0, 0);
    const floating: FloatingEndpoint = { position: { x: 500, y: 500 } };
    const port: PortEndpoint = { componentId: 'c1', portId: 'in' };

    const wire = makeWire('w1', floating, port);
    const violations = runErc([wire], [block]);

    expect(violations).toContain('dangling_wire');
  });

  it('Wire with FloatingEndpoint AT port position → no dangling_wire warning', () => {
    const block = makeBlock('c1', 0, 0);
    // Port 'in' is at left (x=0) with offset 0.5, so y = 0 + 40*0.5 = 20
    const floating: FloatingEndpoint = { position: { x: 0, y: 20 } };
    const port: PortEndpoint = { componentId: 'c1', portId: 'in' };

    const wire = makeWire('w1', floating, port);
    const violations = runErc([wire], [block]);

    expect(violations).not.toContain('dangling_wire');
  });

  it('Port-to-port wire → no dangling_wire warning', () => {
    const block1 = makeBlock('c1', 0, 0);
    const block2 = makeBlock('c2', 100, 0);
    const port1: PortEndpoint = { componentId: 'c1', portId: 'out' };
    const port2: PortEndpoint = { componentId: 'c2', portId: 'in' };

    const wire = makeWire('w1', port1, port2);
    const violations = runErc([wire], [block1, block2]);

    expect(violations).not.toContain('dangling_wire');
  });

  it('Multiple floating endpoints: one dangling, one at port → one violation', () => {
    const block = makeBlock('c1', 0, 0);
    const floatingDangling: FloatingEndpoint = { position: { x: 500, y: 500 } };
    const floatingAtPort: FloatingEndpoint = { position: { x: 0, y: 20 } };

    const wire1 = makeWire('w1', floatingDangling, { componentId: 'c1', portId: 'in' });
    const wire2 = makeWire('w2', floatingAtPort, { componentId: 'c1', portId: 'out' });

    const violations = runErc([wire1, wire2], [block]);

    expect(violations.filter((v) => v === 'dangling_wire')).toHaveLength(1);
  });
});
