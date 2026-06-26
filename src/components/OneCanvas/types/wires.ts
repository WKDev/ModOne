import type { Position } from './geometry';
import type { PortPosition, Block } from './blocks';

// ============================================================================
// Junction (wire-level concept)
// ============================================================================

/** Junction point for wire branching (not a Block) */
export interface Junction {
  /** Unique identifier */
  id: string;
  /** Position on canvas (center-based) */
  position: Position;
  /**
   * @deprecated Rendering-layer selection flag. Do NOT use as the authoritative source
   * of truth for selection state. The canonical selection state is in
   * `useCanvasFacade().selectedIds` (a Set<string>). This field is synchronized
   * from selectedIds during render and is used by CanvasContent.tsx for
   * junction rendering. Modifying this directly will cause state drift.
   */
  selected?: boolean;
}

// ============================================================================
// Wire Types
// ============================================================================

/** Wire endpoint connected to a block port */
export interface PortEndpoint {
  /** ID of the component block */
  componentId: string;
  /** ID of the port on the component */
  portId: string;
}

/** Wire endpoint connected to a junction */
export interface JunctionEndpoint {
  /** ID of the junction */
  junctionId: string;
}

/** Wire endpoint at a free position (not connected to any port or junction) */
export interface FloatingEndpoint {
  position: Position;
}

/** Endpoint of a wire connection (discriminated union) */
export type WireEndpoint = PortEndpoint | JunctionEndpoint | FloatingEndpoint;

/** Type guard: check if endpoint connects to a block port */
export function isPortEndpoint(ep: WireEndpoint): ep is PortEndpoint {
  return 'componentId' in ep;
}

/** Type guard: check if endpoint connects to a junction */
export function isJunctionEndpoint(ep: WireEndpoint): ep is JunctionEndpoint {
  return 'junctionId' in ep;
}

export function isFloatingEndpoint(ep: WireEndpoint): ep is FloatingEndpoint {
  return 'position' in ep && !('componentId' in ep) && !('junctionId' in ep);
}

/** Legacy endpoint format (for backward compatibility during migration) */
export interface LegacyWireEndpoint {
  componentId: string;
  portId: string;
}

/** Wire handle constraint direction */
export type HandleConstraint = 'horizontal' | 'vertical' | 'free';

/** Wire control point with constraint and source info */
export interface WireHandle {
  /** Stable identifier for history-friendly handle tracking */
  id?: string;
  /** Handle position */
  position: Position;
  /** Movement constraint */
  constraint: HandleConstraint;
  /** Whether auto-generated or user-placed */
  source: 'auto' | 'user';
}

/** Wire connection between two ports */
export interface Wire {
  /** Unique identifier */
  id: string;
  /** Source endpoint */
  from: WireEndpoint;
  /** Destination endpoint */
  to: WireEndpoint;
  /**
   * @deprecated Rendering-layer selection flag. Do NOT use as the authoritative source
   * of truth for selection state. The canonical selection state is in
   * `useCanvasFacade().selectedIds` (a Set<string>). This field is synchronized
   * from selectedIds during render and is used by CanvasContent.tsx for
   * junction rendering. Modifying this directly will cause state drift.
   */
  selected?: boolean;
  /** Optional wire color */
  color?: string;
  /** Cached net ID from connectivity graph */
  netId?: string;
  /** Control points for wire routing */
  handles?: WireHandle[];
  /** Direction wire exits from source port (user-specified via drag direction) */
  fromExitDirection?: PortPosition;
  /** Direction wire enters target port (user-specified via drag direction) */
  toExitDirection?: PortPosition;
  /** Wire label (display name, e.g., "L1", "N", "PE", "101") */
  label?: string;
  /** IEC 60204-1 wire number for documentation */
  wireNumber?: string;
  /** Routing mode: 'auto' = fully recalculated on block move, 'manual' = user-controlled handles */
  routingMode?: 'auto' | 'manual';
}

// ============================================================================
// Polyline & Geometry API (used by wire simplifier + rubber-band)
// ============================================================================

/** Ordered positions forming an orthogonal polyline (exit point → handles → exit point) */
export type Poly = readonly Position[];

/** Geometry API for resolving wire endpoint positions */
export interface GeomApi {
  components: Map<string, Block>;
  junctions: Map<string, Junction>;
}

// ============================================================================
// Wire Geometry Types (for DOM-free selection)
// ============================================================================

/** Bounding box for quick collision rejection */
export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Pre-computed geometry for a wire (no DOM dependency) */
export interface WireGeometry {
  /** Wire identifier */
  wireId: string;
  /** Bounding box for quick rejection tests */
  bounds: BoundingBox;
  /** Sampled points along the Bezier curve */
  samples: Position[];
  /** Line segments connecting sampled points */
  segments: Array<{ start: Position; end: Position }>;
}

