/**
 * IEC Standard Wire Colors
 *
 * Wire color definitions according to IEC 60204-1 and common industrial practices.
 * These colors are used in electrical installations for safety and identification.
 */

// ============================================================================
// Types
// ============================================================================

/** Standard wire function categories */
export type WireFunction =
  | 'L1'           // Phase 1 (AC)
  | 'L2'           // Phase 2 (AC)
  | 'L3'           // Phase 3 (AC)
  | 'N'            // Neutral
  | 'PE'           // Protective Earth (Ground)
  | 'DC_PLUS'      // DC Positive (+24V, +12V, etc.)
  | 'DC_MINUS'     // DC Negative (0V)
  | 'CONTROL'      // Control circuit
  | 'SIGNAL'       // Signal/sensor wire
  | 'INTERLOCK'    // Safety interlock
  | 'EMERGENCY'    // Emergency stop circuit
  | 'CUSTOM';      // Custom/undefined

/** Wire color definition */
export interface WireColor {
  /** Primary color hex code */
  primary: string;
  /** Secondary color for striped wires (optional) */
  secondary?: string;
  /** Human-readable name */
  name: string;
  /** IEC standard reference */
  standard?: string;
  /** Description/usage */
  description: string;
}

/** Predefined wire color preset */
export interface WireColorPreset {
  /** Preset identifier */
  id: string;
  /** Display name */
  label: string;
  /** Wire function */
  function: WireFunction;
  /** Color definition */
  color: WireColor;
}

// ============================================================================
// IEC Standard Colors
// ============================================================================

/**
 * IEC 60204-1 Standard Wire Colors
 */
export const IEC_WIRE_COLORS: Record<WireFunction, WireColor> = {
  // AC Power Conductors
  L1: {
    primary: '#8B4513',  // Brown
    name: 'Brown',
    standard: 'IEC 60204-1',
    description: 'Phase 1 (L1) conductor in 3-phase AC systems',
  },
  L2: {
    primary: '#1a1a1a',  // Black
    name: 'Black',
    standard: 'IEC 60204-1',
    description: 'Phase 2 (L2) conductor in 3-phase AC systems',
  },
  L3: {
    primary: '#6b7280',  // Gray
    name: 'Gray',
    standard: 'IEC 60204-1',
    description: 'Phase 3 (L3) conductor in 3-phase AC systems',
  },
  N: {
    primary: '#2563eb',  // Blue
    name: 'Blue',
    standard: 'IEC 60204-1',
    description: 'Neutral conductor',
  },
  PE: {
    primary: '#22c55e',  // Green
    secondary: '#eab308', // Yellow (striped)
    name: 'Green/Yellow',
    standard: 'IEC 60204-1',
    description: 'Protective Earth (PE) conductor - safety ground',
  },

  // DC Conductors
  DC_PLUS: {
    primary: '#ef4444',  // Red
    name: 'Red',
    standard: 'IEC 60204-1',
    description: 'DC positive (+24V, +12V, etc.)',
  },
  DC_MINUS: {
    primary: '#3b82f6',  // Blue (dark)
    name: 'Blue',
    standard: 'IEC 60204-1',
    description: 'DC negative (0V reference)',
  },

  // Control Circuits
  CONTROL: {
    primary: '#dc2626',  // Red
    name: 'Red',
    standard: 'Common practice',
    description: 'Control circuit power (typically 24VDC or 110VAC)',
  },
  SIGNAL: {
    primary: '#f97316',  // Orange
    name: 'Orange',
    standard: 'Common practice',
    description: 'Signal wiring (sensors, analog signals)',
  },
  INTERLOCK: {
    primary: '#a855f7',  // Purple
    name: 'Purple',
    standard: 'Common practice',
    description: 'Safety interlock circuits',
  },
  EMERGENCY: {
    primary: '#fcd34d',  // Yellow
    name: 'Yellow',
    standard: 'Common practice',
    description: 'Emergency stop circuits',
  },

  // Custom
  CUSTOM: {
    primary: '#9ca3af',  // Gray
    name: 'Custom',
    description: 'User-defined wire color',
  },
};

// ============================================================================
// Wire Color Presets
// ============================================================================

/**
 * Common wire color presets for quick selection
 */
export const WIRE_COLOR_PRESETS: WireColorPreset[] = [
  { id: 'l1', label: 'L1 (Phase 1)', function: 'L1', color: IEC_WIRE_COLORS.L1 },
  { id: 'l2', label: 'L2 (Phase 2)', function: 'L2', color: IEC_WIRE_COLORS.L2 },
  { id: 'l3', label: 'L3 (Phase 3)', function: 'L3', color: IEC_WIRE_COLORS.L3 },
  { id: 'n', label: 'N (Neutral)', function: 'N', color: IEC_WIRE_COLORS.N },
  { id: 'pe', label: 'PE (Ground)', function: 'PE', color: IEC_WIRE_COLORS.PE },
  { id: 'dc_plus', label: '+24V DC', function: 'DC_PLUS', color: IEC_WIRE_COLORS.DC_PLUS },
  { id: 'dc_minus', label: '0V DC', function: 'DC_MINUS', color: IEC_WIRE_COLORS.DC_MINUS },
  { id: 'control', label: 'Control', function: 'CONTROL', color: IEC_WIRE_COLORS.CONTROL },
  { id: 'signal', label: 'Signal', function: 'SIGNAL', color: IEC_WIRE_COLORS.SIGNAL },
  { id: 'interlock', label: 'Interlock', function: 'INTERLOCK', color: IEC_WIRE_COLORS.INTERLOCK },
  { id: 'emergency', label: 'E-Stop', function: 'EMERGENCY', color: IEC_WIRE_COLORS.EMERGENCY },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get wire color definition for a given function
 */
export function getWireColor(wireFunction: WireFunction): WireColor {
  return IEC_WIRE_COLORS[wireFunction] || IEC_WIRE_COLORS.CUSTOM;
}

/**
 * Get the primary color hex for a wire function
 */
export function getWireColorHex(wireFunction: WireFunction): string {
  return IEC_WIRE_COLORS[wireFunction]?.primary || '#9ca3af';
}

/**
 * Suggest a wire color based on wire label/number
 */
export function suggestWireColor(wireLabel: string): WireFunction {
  const label = wireLabel.toUpperCase().trim();

  // Phase conductors
  if (label === 'L1' || label.includes('PHASE1') || label.includes('PHASE 1')) return 'L1';
  if (label === 'L2' || label.includes('PHASE2') || label.includes('PHASE 2')) return 'L2';
  if (label === 'L3' || label.includes('PHASE3') || label.includes('PHASE 3')) return 'L3';

  // Neutral
  if (label === 'N' || label === 'NEUTRAL') return 'N';

  // Ground/Earth
  if (label === 'PE' || label === 'GND' || label === 'GROUND' || label === 'EARTH') return 'PE';

  // DC Power
  if (label.includes('+24V') || label.includes('+12V') || label.includes('VCC') || label === 'V+') return 'DC_PLUS';
  if (label.includes('0V') || label.includes('COM') || label.includes('GND') || label === 'V-') return 'DC_MINUS';

  // Special circuits
  if (label.includes('CONTROL') || label.includes('CTRL')) return 'CONTROL';
  if (label.includes('SIGNAL') || label.includes('SIG') || label.includes('ANALOG')) return 'SIGNAL';
  if (label.includes('INTERLOCK') || label.includes('SAFETY')) return 'INTERLOCK';
  if (label.includes('ESTOP') || label.includes('EMERGENCY') || label.includes('E-STOP')) return 'EMERGENCY';

  return 'CUSTOM';
}

/**
 * Get CSS style for wire rendering
 */
export function getWireStyle(wireFunction: WireFunction): {
  stroke: string;
  strokeDasharray?: string;
} {
  const color = IEC_WIRE_COLORS[wireFunction];

  // PE wire has green/yellow stripes
  if (wireFunction === 'PE' && color.secondary) {
    return {
      stroke: color.primary,
      strokeDasharray: '8 4', // Creates a dashed effect
    };
  }

  return {
    stroke: color.primary,
  };
}

/**
 * Get all available wire functions
 */
export function getAllWireFunctions(): WireFunction[] {
  return Object.keys(IEC_WIRE_COLORS) as WireFunction[];
}

/**
 * Check if a color is close to an IEC standard color
 */
export function findClosestIecColor(hexColor: string): WireFunction | null {
  const target = hexToRgb(hexColor);
  if (!target) return null;

  let closestFunction: WireFunction | null = null;
  let closestDistance = Infinity;

  for (const [func, color] of Object.entries(IEC_WIRE_COLORS)) {
    const rgb = hexToRgb(color.primary);
    if (!rgb) continue;

    const distance = Math.sqrt(
      Math.pow(target.r - rgb.r, 2) +
      Math.pow(target.g - rgb.g, 2) +
      Math.pow(target.b - rgb.b, 2)
    );

    if (distance < closestDistance && distance < 50) {
      closestDistance = distance;
      closestFunction = func as WireFunction;
    }
  }

  return closestFunction;
}

/**
 * Helper: Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}
