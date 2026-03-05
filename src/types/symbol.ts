/**
 * Custom Symbol Type System
 *
 * Defines the complete type system for custom electrical symbols in ModOne.
 * Supports PLC-optimized pin types, graphic primitives, symbol definitions,
 * and library management.
 */
import type { BaseBlock } from '../components/OneCanvas/types';

// ============================================================================
// Pin Types (PLC-Optimized)
// ============================================================================

/** Electrical type of a pin (5 types only) */
export type PinElectricalType = 'input' | 'output' | 'bidirectional' | 'power' | 'passive';

/** Visual shape of a pin */
export type PinShape = 'line' | 'inverted' | 'clock';

/** Pin orientation on symbol */
export type PinOrientation = 'right' | 'left' | 'up' | 'down';

/** A pin on a symbol */
export interface SymbolPin {
  /** Unique identifier for this pin */
  id: string;
  /** Display name of the pin */
  name: string;
  /** Pin number (e.g., "1", "A1") */
  number: string;
  /** Electrical type */
  type: PinElectricalType;
  /** Visual shape */
  shape: PinShape;
  /** Position relative to symbol origin */
  position: { x: number; y: number };
  /** Pin orientation */
  orientation: PinOrientation;
  /** Pin line length in pixels */
  length: number;
  /** Whether pin is hidden from display */
  hidden?: boolean;
}

// ============================================================================
// Graphic Primitives
// ============================================================================

/** Rectangle primitive */
export interface RectPrimitive {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
}

/** Circle primitive */
export interface CirclePrimitive {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
}

/** Polyline primitive */
export interface PolylinePrimitive {
  kind: 'polyline';
  points: Array<{ x: number; y: number }>;
  stroke: string;
  fill: string;
  strokeWidth: number;
}

/** Arc primitive */
export interface ArcPrimitive {
  kind: 'arc';
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
}

/** Text primitive */
export interface TextPrimitive {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
}

/** Union of all graphic primitives */
export type GraphicPrimitive =
  | RectPrimitive
  | CirclePrimitive
  | PolylinePrimitive
  | ArcPrimitive
  | TextPrimitive;

// ============================================================================
// Symbol Units (Multi-Unit Support)
// ============================================================================

/** A unit within a symbol (for multi-unit components) */
export interface SymbolUnit {
  /** Unit identifier (1-based) */
  unitId: number;
  /** Unit name (e.g., "A", "B", "Unit 1") */
  name: string;
  /** Graphics for this unit */
  graphics: GraphicPrimitive[];
  /** Pins for this unit */
  pins: SymbolPin[];
}

// ============================================================================
// Symbol Properties
// ============================================================================

/** A property that can be set on a symbol instance */
export interface SymbolProperty {
  /** Property key (e.g., "voltage", "color") */
  key: string;
  /** Default value */
  value: string | number | boolean;
  /** Property type */
  type: 'string' | 'number' | 'boolean' | 'enum';
  /** Whether property is visible in UI */
  visible?: boolean;
  /** Editor widget type */
  editorType?: 'text' | 'number' | 'checkbox' | 'select';
  /** Options for enum/select types */
  options?: string[];
}

// ============================================================================
// Symbol Definition
// ============================================================================

/** Complete symbol definition */
export interface SymbolDefinition {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Semantic version */
  version: string;
  /** Optional description */
  description?: string;
  /** Category (e.g., "relay", "switch", "sensor") */
  category: string;
  /** Author name */
  author?: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last modification timestamp (ISO 8601) */
  updatedAt: string;
  /** Symbol width in pixels */
  width: number;
  /** Symbol height in pixels */
  height: number;
  /** Graphics for the symbol */
  graphics: GraphicPrimitive[];
  /** Pins on the symbol */
  pins: SymbolPin[];
  /** Optional multi-unit definitions */
  units?: SymbolUnit[];
  /** Configurable properties */
  properties: SymbolProperty[];
  /** Optional runtime state schema (JSON Schema) */
  runtimeStateSchema?: Record<string, unknown>;
}

// ============================================================================
// Symbol Summary (for listings)
// ============================================================================

/** Scope of a symbol library */
export type LibraryScope = 'project' | 'global';

/** Summary of a symbol for listings */
export interface SymbolSummary {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Semantic version */
  version: string;
  /** Category */
  category: string;
  /** Optional description */
  description?: string;
  /** Library scope */
  scope: LibraryScope;
  /** Last modification timestamp (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// Custom Symbol Block (Canvas Integration)
// ============================================================================

/** Block type for custom symbols on canvas */
export interface CustomSymbolBlock extends BaseBlock<'custom_symbol'> {
  /** Reference to symbol definition */
  symbolId: string;
  /** Selected unit (if multi-unit symbol) */
  selectedUnit?: number;
  /** Instance-specific property overrides */
  instanceProperties?: Record<string, string | number | boolean>;
}
