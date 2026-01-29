/**
 * Ladder Element Styling Constants
 *
 * Shared color and style definitions for ladder diagram elements.
 */

/** Element color scheme */
export const ELEMENT_COLORS = {
  /** Default/off state */
  default: {
    stroke: 'rgb(163, 163, 163)', // neutral-400
    fill: 'transparent',
    text: 'rgb(163, 163, 163)',
  },
  /** Energized contact (ON state) */
  energizedContact: {
    stroke: 'rgb(74, 222, 128)', // green-400
    fill: 'rgba(34, 197, 94, 0.3)', // green-500 with opacity
    text: 'rgb(74, 222, 128)',
  },
  /** Energized coil (ON state) */
  energizedCoil: {
    stroke: 'rgb(248, 113, 113)', // red-400
    fill: 'rgba(239, 68, 68, 0.3)', // red-500 with opacity
    text: 'rgb(248, 113, 113)',
  },
  /** Forced state indicator */
  forced: {
    ring: 'rgb(234, 179, 8)', // yellow-500
    ringWidth: 2,
  },
  /** Wire/connection line */
  wire: {
    stroke: 'rgb(107, 114, 128)', // neutral-500
    strokeEnergized: 'rgb(34, 197, 94)', // green-500
  },
} as const;

/** Element dimensions */
export const ELEMENT_DIMENSIONS = {
  /** Default element width */
  width: 60,
  /** Default element height */
  height: 40,
  /** Stroke width for symbols */
  strokeWidth: 2,
  /** Font size for address labels */
  labelFontSize: 10,
  /** Font size for symbols (S, R, etc.) */
  symbolFontSize: 12,
} as const;

/** Color state type */
type ColorState = {
  stroke: string;
  fill: string;
  text: string;
};

/** Get colors based on element state */
export function getElementColors(
  isContact: boolean,
  isEnergized: boolean,
  isForced: boolean
): ColorState & { showForced: boolean; forcedRing: string } {
  let colors: ColorState = ELEMENT_COLORS.default;

  if (isEnergized) {
    colors = isContact ? ELEMENT_COLORS.energizedContact : ELEMENT_COLORS.energizedCoil;
  }

  return {
    ...colors,
    showForced: isForced,
    forcedRing: ELEMENT_COLORS.forced.ring,
  };
}
