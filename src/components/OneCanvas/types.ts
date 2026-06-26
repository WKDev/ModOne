/**
 * OneCanvas Type Definitions — barrel.
 *
 * The definitions are split into focused modules under `./types/` to keep each
 * file small and LLM/AI-readable (see CLAUDE.md → Code Organization):
 *   geometry  — coordinates, Size, legacy/polarity aliases
 *   selection — selection model + helpers
 *   blocks    — ports, BaseBlock, every block variant, the Block union
 *   wires     — junctions, endpoints, Wire, wire geometry
 *   circuit   — circuit/viewport/simulation/YAML state
 *   guards    — block type guards + legacy migration
 *   canvas    — grid/canvas/layer config, hit-test, unit + YAML conversion
 *
 * Import from `../types` (this barrel) exactly as before — nothing else changes.
 */
export * from './types/geometry';
export * from './types/selection';
export * from './types/blocks';
export * from './types/wires';
export * from './types/circuit';
export * from './types/guards';
export * from './types/canvas';

// Re-exported from sibling modules so existing import paths stay stable.
export type { BlockType } from '../../types/circuit';
export type { RuntimeGridUnit, SerializableGridUnit } from './canvasUnits';
