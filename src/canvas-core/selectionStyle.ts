/**
 * Shared selection chrome — the single source of truth for how every editor
 * (Symbol, Schematic/OneCanvas, Sheet) draws selection outlines, handles and
 * marquees, so selection looks identical across all of them. Change the colour
 * here and all three editors follow.
 */

/** Selection outline + handle fill + marquee colour. */
export const SELECTION_COLOR = 0x4dabf7;

/** Handle border (drawn over the fill so handles read on any background). */
export const SELECTION_HANDLE_STROKE = 0xffffff;

/** CSS form of SELECTION_COLOR, for DOM overlays (e.g. the Sheet inline editor). */
export const SELECTION_COLOR_CSS = '#4dabf7';
