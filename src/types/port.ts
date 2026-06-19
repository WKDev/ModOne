/**
 * Port / Pin Data Model for Symbol Editor
 *
 * Canonical schema for port definitions used throughout the Symbol Editor.
 * Bridges the SymbolPin (symbol XML definition) and canvas Port (netlist)
 * type systems, adding CRUD-friendly validation and conversion utilities.
 *
 * Design references:
 *   - IEC 62714 (AutomationML CAEX) for hierarchical interface/terminal modeling
 *   - IEC 60617 for electrical symbol conventions
 *   - KiCad .kicad_sym format for pin type/shape vocabulary
 */

import type {
  SymbolPin,
  PinElectricalType,
  PinElectricalTypeV2,
  PinFunctionalRole,
  PinShape,
} from './symbol';

// ============================================================================
// Port Electrical Type  (Consolidated)
// ============================================================================

/**
 * Electrical type of a port — consolidated 13-value set.
 *
 * Maps to:
 *  - `PinElectricalTypeV2` (symbol XML/TS definitions)
 *  - `PortType` (canvas netlist connection system)
 */
export type PortElectricalType =
  | 'input'          // Signal flows into the component
  | 'output'         // Signal flows out of the component
  | 'bidirectional'  // Signal can flow both ways (e.g. I²C SDA)
  | 'power'          // Generic power rail (legacy / simplified)
  | 'passive'        // No active driving (resistors, capacitors, etc.)
  | 'tri_state'      // Tri-state output (Hi-Z capable)
  | 'power_in'       // Power consumer pin (VCC, VDD)
  | 'power_out'      // Power provider pin (regulator output)
  | 'open_collector' // Open-collector/open-drain output
  | 'open_emitter'   // Open-emitter output
  | 'free'           // Unconstrained / don't-care
  | 'unspecified'    // Type not yet assigned
  | 'no_connect';    // Pin must NOT be connected

/** The 5-value simplified canvas type used for netlist connection compatibility */
export type PortCanvasType = 'input' | 'output' | 'bidirectional' | 'power' | 'passive';

// ============================================================================
// Port Orientation  (Direction)
// ============================================================================

/**
 * Port orientation — which direction the pin line extends from the endpoint.
 *
 * Convention (matching KiCad):
 *   'right'  → pin line points right  (endpoint is on the RIGHT edge)
 *   'left'   → pin line points left   (endpoint is on the LEFT edge)
 *   'up'     → pin line points up     (endpoint is on the TOP edge)
 *   'down'   → pin line points down   (endpoint is on the BOTTOM edge)
 */
export type PortOrientation = 'right' | 'left' | 'up' | 'down';

/**
 * Edge position — which edge of the symbol bounding box this port sits on.
 * Used for canvas wire-connection snapping and netlist port lookup.
 */
export type PortEdgePosition = 'top' | 'bottom' | 'left' | 'right';

// ============================================================================
// Port Visual Shape
// ============================================================================

/**
 * Visual shape of the pin endpoint marker (9-value KiCad-compatible set).
 */
export type PortShape =
  | 'line'            // Plain line (default)
  | 'inverted'        // Bubble (active-low / logic inversion)
  | 'clock'           // Clock edge indicator
  | 'inverted_clock'  // Inverted clock
  | 'input_low'       // Active-low input (IEEE 91)
  | 'clock_low'       // Active-low clock input
  | 'output_low'      // Active-low output
  | 'edge_clock_high' // Rising-edge triggered clock
  | 'non_logic';      // Non-logic (analogue) signal

// ============================================================================
// Functional Role
// ============================================================================

/**
 * Functional role for PLC-aware port classification.
 *
 * Constraints (enforced at netlist simulation time, not here):
 *   - Blocks tagged 'plc_input'/'plc_output' may read/write PLC memory registers
 *   - 'communication' ports are reserved for Modbus / OPC-UA channel bindings
 *   - 'general' has no special simulation privileges
 */
export type PortFunctionalRole =
  | 'general'       // No special role
  | 'plc_input'     // Maps to a PLC digital/analogue input register
  | 'plc_output'    // Maps to a PLC digital/analogue output register
  | 'communication'; // Communication interface (Modbus, OPC-UA, etc.)

// ============================================================================
// Core Port Definition
// ============================================================================

/**
 * Canonical port definition for the Symbol Editor.
 *
 * Designed to be:
 *  1. Losslessly round-trippable to/from `SymbolPin` (for XML symbol files)
 *  2. Compatible with the canvas `Port` interface (for netlist wire connections)
 *  3. Fully self-validatable at design-time
 */
export interface PortDef {
  // ── Identity ─────────────────────────────────────────────────────────────

  /** Stable unique identifier within the symbol (UUIDv4 recommended) */
  id: string;

  /** Human-readable display name shown on the symbol (e.g. "IN", "OUT", "VCC") */
  name: string;

  /**
   * Pin number / designator (e.g. "1", "A1", "COM").
   * Must be unique within a symbol (or unit).
   * Used for BOM generation, netlist nodes, and multi-pin connectors.
   */
  number: string;

  // ── Position ─────────────────────────────────────────────────────────────

  /**
   * Position of the pin wire-connection endpoint relative to the symbol origin (0,0),
   * expressed in symbol coordinate space (pixels at 1× zoom).
   * This is the point where a wire physically connects to the port.
   */
  position: { x: number; y: number };

  /**
   * Which edge of the symbol bounding box this port is on.
   * Derived from `orientation` if omitted — stored here for fast canvas lookup.
   */
  edgePosition?: PortEdgePosition;

  /**
   * Normalised offset along the edge: 0.0 = first point, 1.0 = last point.
   * Used for canvas port snapping and automatic wire routing.
   * Computed from `position` / symbol dimensions at runtime when omitted.
   */
  edgeOffset?: number;

  // ── Type & Role ───────────────────────────────────────────────────────────

  /** Full 13-value electrical type for precise connection compatibility checking */
  electricalType: PortElectricalType;

  /**
   * Simplified 5-value canvas type for netlist compatibility.
   * Automatically derived from `electricalType` if not set explicitly.
   */
  canvasType?: PortCanvasType;

  /** PLC functional role — controls simulation privilege level */
  functionalRole: PortFunctionalRole;

  // ── Visual ────────────────────────────────────────────────────────────────

  /**
   * Orientation: direction the pin line extends from the connection endpoint.
   * Also implies which edge of the symbol body the pin is attached to.
   */
  orientation: PortOrientation;

  /** Visual shape of the pin endpoint marker */
  shape: PortShape;

  /** Length of the pin stub line in pixels */
  length: number;

  // ── Connection Constraints ────────────────────────────────────────────────

  /** Maximum number of wire connections allowed (undefined = unlimited) */
  maxConnections?: number;

  // ── Visibility ────────────────────────────────────────────────────────────

  /** Hide this pin entirely (used for implicit power/GND connections) */
  hidden?: boolean;

  /** Whether the pin name label is rendered */
  nameVisible?: boolean;

  /** Whether the pin number label is rendered */
  numberVisible?: boolean;

  // ── Metadata ──────────────────────────────────────────────────────────────

  /**
   * Optional human-readable description / tooltip text for this port.
   * Displayed on hover in the Symbol Editor canvas and in port list panels.
   */
  description?: string;

  /**
   * Optional grouping label (e.g. "Power", "Data", "Control").
   * Used for logical grouping in port list UI and for edge-side clustering.
   */
  group?: string;

  // ── Lock State ───────────────────────────────────────────────────────────

  /**
   * When true, the port is locked and all manipulation (drag, delete, rename)
   * is blocked. Locked ports display a visual lock indicator and cursor change.
   */
  locked?: boolean;

  // ── Custom Color ─────────────────────────────────────────────────────────

  /**
   * Optional CSS color string applied to the port **fill** only.
   * Stroke retains the default/theme color. Example values: "#FF0000", "rgb(255,0,0)".
   */
  color?: string;

  // ── Label Offset ─────────────────────────────────────────────────────────

  /**
   * Pixel offset of the port name label from the default rendering position.
   * Allows manual fine-tuning of label placement on the canvas.
   * When omitted the label renders at the default position derived from orientation.
   */
  labelOffset?: { x: number; y: number };

  // ── Sort / Order ──────────────────────────────────────────────────────────

  /**
   * Sort index for deterministic ordering in pin lists and pin-number assignment.
   * Lower values appear first. Maintained automatically by CRUD operations.
   */
  sortOrder: number;
}

// ============================================================================
// Port Validation
// ============================================================================

/** A single field-level validation error on a PortDef */
export interface PortValidationError {
  /** Which field triggered the error ('general' for cross-field issues) */
  field: keyof PortDef | 'general';
  /** Human-readable error message */
  message: string;
}

/** Aggregated validation result */
export interface PortValidationResult {
  /** True when there are no errors */
  valid: boolean;
  /** List of individual field errors */
  errors: PortValidationError[];
}

/**
 * Validates a (partial) PortDef for correctness.
 *
 * @param port - The port object to validate (may be partial for in-progress forms)
 * @param existingPorts - Other ports in the same symbol/unit (for uniqueness checks)
 * @returns PortValidationResult with `valid` flag and error list
 */
export function validatePortDef(
  port: Partial<PortDef>,
  existingPorts: PortDef[] = [],
): PortValidationResult {
  const errors: PortValidationError[] = [];

  // Required: id
  if (!port.id?.trim()) {
    errors.push({ field: 'id', message: 'Port ID is required' });
  }

  // Required: name
  if (!port.name?.trim()) {
    errors.push({ field: 'name', message: 'Port name is required' });
  }

  // Required: number (can be empty string but not undefined/null)
  if (port.number === undefined || port.number === null) {
    errors.push({ field: 'number', message: 'Port number is required (may be empty string)' });
  }

  // Required: position with finite coords
  if (!port.position) {
    errors.push({ field: 'position', message: 'Port position is required' });
  } else {
    if (!Number.isFinite(port.position.x) || !Number.isFinite(port.position.y)) {
      errors.push({ field: 'position', message: 'Port position x and y must be finite numbers' });
    }
  }

  // Required: electricalType
  if (!port.electricalType) {
    errors.push({ field: 'electricalType', message: 'Electrical type is required' });
  }

  // Required: functionalRole
  if (!port.functionalRole) {
    errors.push({ field: 'functionalRole', message: 'Functional role is required' });
  }

  // Required: orientation
  if (!port.orientation) {
    errors.push({ field: 'orientation', message: 'Orientation is required' });
  }

  // Required: shape
  if (!port.shape) {
    errors.push({ field: 'shape', message: 'Pin shape is required' });
  }

  // Length must be positive
  if (port.length !== undefined && port.length <= 0) {
    errors.push({ field: 'length', message: 'Pin length must be greater than 0' });
  }

  // edgeOffset must be in [0, 1]
  if (port.edgeOffset !== undefined) {
    if (!Number.isFinite(port.edgeOffset) || port.edgeOffset < 0 || port.edgeOffset > 1) {
      errors.push({ field: 'edgeOffset', message: 'Edge offset must be a number between 0 and 1' });
    }
  }

  // color must be a valid CSS hex colour string when provided
  if (port.color !== undefined && port.color !== '') {
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(port.color)) {
      errors.push({ field: 'color', message: 'Color must be a valid hex color (e.g. "#FF5733")' });
    }
  }

  // labelOffset must have finite coordinates when provided
  if (port.labelOffset !== undefined) {
    if (!Number.isFinite(port.labelOffset.x) || !Number.isFinite(port.labelOffset.y)) {
      errors.push({ field: 'labelOffset', message: 'Label offset x and y must be finite numbers' });
    }
  }

  // Uniqueness: pin number must not clash with other ports (excluding self)
  if (port.number !== undefined && port.number !== '' && port.id) {
    const clash = existingPorts.find((p) => p.id !== port.id && p.number === port.number);
    if (clash) {
      errors.push({
        field: 'number',
        message: `Pin number "${port.number}" is already used by port "${clash.name || clash.id}"`,
      });
    }
  }

  // Uniqueness: ID must not clash with other ports (catch accidental duplicates)
  if (port.id) {
    const idClash = existingPorts.filter((p) => p.id === port.id);
    // When editing, self appears once; if it appears more than once it is a duplicate
    if (idClash.length > 1) {
      errors.push({ field: 'id', message: `Port ID "${port.id}" is already in use` });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Creates a new PortDef with sensible defaults.
 * Always generates a fresh UUIDv4 for `id` unless overridden.
 */
export function createPortDef(overrides: Partial<PortDef> = {}): PortDef {
  return {
    id: crypto.randomUUID(),
    name: '',
    number: '',
    position: { x: 0, y: 0 },
    electricalType: 'passive',
    functionalRole: 'general',
    orientation: 'right',
    shape: 'line',
    length: 40,
    sortOrder: 0,
    hidden: false,
    nameVisible: true,
    numberVisible: true,
    description: undefined,
    group: undefined,
    locked: false,
    color: undefined,
    labelOffset: undefined,
    ...overrides,
  };
}

// ============================================================================
// Type Conversion Helpers
// ============================================================================

/**
 * Maps a full 13-value PortElectricalType to the simplified 5-value PortCanvasType.
 * Used when creating canvas `Port` objects from symbol pin definitions.
 */
export function electricalTypeToCanvasType(type: PortElectricalType): PortCanvasType {
  switch (type) {
    case 'input':
      return 'input';
    case 'output':
      return 'output';
    case 'bidirectional':
    case 'tri_state':
      return 'bidirectional';
    case 'power':
    case 'power_in':
    case 'power_out':
      return 'power';
    case 'passive':
    case 'open_collector':
    case 'open_emitter':
    case 'free':
    case 'unspecified':
    case 'no_connect':
    default:
      return 'passive';
  }
}

/**
 * Derives the edge position from pin orientation.
 *
 * The orientation is the direction the pin line extends FROM the symbol body,
 * so the edge that the pin is attached to is the SAME direction:
 *   'right'  → RIGHT edge
 *   'left'   → LEFT edge
 *   'up'     → TOP edge
 *   'down'   → BOTTOM edge
 */
export function orientationToEdgePosition(orientation: PortOrientation): PortEdgePosition {
  switch (orientation) {
    case 'right': return 'right';
    case 'left':  return 'left';
    case 'up':    return 'top';
    case 'down':  return 'bottom';
  }
}

/**
 * Maps a 9-value PortShape to the 3-value PinShape used in SymbolPin.
 * Lossy (detail is dropped) — fine because PinShape is display-only.
 */
export function portShapeToSymbolPinShape(shape: PortShape): PinShape {
  switch (shape) {
    case 'inverted':
    case 'inverted_clock':
      return 'inverted';
    case 'clock':
    case 'input_low':
    case 'clock_low':
    case 'output_low':
    case 'edge_clock_high':
      return 'clock';
    case 'line':
    case 'non_logic':
    default:
      return 'line';
  }
}

// ============================================================================
// Round-trip Conversion: PortDef ↔ SymbolPin
// ============================================================================

/**
 * Converts a PortDef to a SymbolPin.
 *
 * Use this when persisting editor ports into a SymbolDefinition
 * (for XML serialisation, canvas block creation, etc.).
 */
export function portDefToSymbolPin(port: PortDef): SymbolPin {
  return {
    id: port.id,
    name: port.name,
    number: port.number,
    type: (port.canvasType ?? electricalTypeToCanvasType(port.electricalType)) as PinElectricalType,
    shape: portShapeToSymbolPinShape(port.shape),
    position: { x: port.position.x, y: port.position.y },
    orientation: port.orientation,
    length: port.length,
    hidden: port.hidden,
    electricalType: port.electricalType as PinElectricalTypeV2,
    functionalRole: port.functionalRole as PinFunctionalRole,
    sortOrder: port.sortOrder,
    nameVisible: port.nameVisible,
    numberVisible: port.numberVisible,
    description: port.description,
    group: port.group,
    locked: port.locked,
    color: port.color,
    labelOffset: port.labelOffset ? { x: port.labelOffset.x, y: port.labelOffset.y } : undefined,
  };
}

/**
 * Converts a SymbolPin back to a PortDef.
 *
 * Use this when loading an existing symbol into the editor so that
 * the editor operates entirely with the richer PortDef type.
 *
 * @param pin - The SymbolPin to convert
 * @param sortOrder - Explicit sort order (falls back to pin.sortOrder ?? 0)
 */
export function symbolPinToPortDef(pin: SymbolPin, sortOrder?: number): PortDef {
  // Prefer the full V2 electrical type; fall back to the basic type field
  const electricalType: PortElectricalType =
    (pin.electricalType as PortElectricalType | undefined) ??
    (pin.type as PortElectricalType);

  const shape: PortShape = (() => {
    switch (pin.shape) {
      case 'inverted': return 'inverted';
      case 'clock':    return 'clock';
      default:         return 'line';
    }
  })();

  return {
    id: pin.id,
    name: pin.name,
    number: pin.number,
    position: { x: pin.position.x, y: pin.position.y },
    electricalType,
    canvasType: (pin.type ?? electricalTypeToCanvasType(electricalType)) as PortCanvasType,
    functionalRole: (pin.functionalRole ?? 'general') as PortFunctionalRole,
    edgePosition: orientationToEdgePosition(pin.orientation),
    orientation: pin.orientation,
    shape,
    length: pin.length,
    hidden: pin.hidden,
    nameVisible: pin.nameVisible,
    numberVisible: pin.numberVisible,
    sortOrder: pin.sortOrder ?? sortOrder ?? 0,
    maxConnections: undefined,
    description: pin.description,
    group: pin.group,
    locked: pin.locked,
    color: pin.color,
    labelOffset: pin.labelOffset ? { x: pin.labelOffset.x, y: pin.labelOffset.y } : undefined,
  };
}

/**
 * Converts an array of SymbolPins to PortDefs, preserving array order as sortOrder.
 */
export function symbolPinsToPortDefs(pins: SymbolPin[]): PortDef[] {
  return pins.map((pin, index) =>
    symbolPinToPortDef(pin, pin.sortOrder ?? index),
  );
}

/**
 * Converts an array of PortDefs back to SymbolPins.
 */
export function portDefsToSymbolPins(ports: PortDef[]): SymbolPin[] {
  return ports
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(portDefToSymbolPin);
}
