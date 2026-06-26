/**
 * Wire Generator Utility — barrel.
 *
 * Generates and resolves wire connections between ladder elements. Split into
 * focused modules to keep each file small and LLM/AI-readable (CLAUDE.md → Code
 * Organization):
 *   wireGeneration     — connection points, validation, wire generation, path
 *   wireDirections     — Phase 1.2–1.4: direction maps, element/neighbor dirs
 *   wireTypeResolution — Phase 1.5–1.6: resolve wire element type, update adj.
 *   parallelBranches   — Phase 3: parallel branches, vertical segments, junctions
 *   wireMerge          — wire-direction merge + Phase 2 recalc helpers
 *
 * Import from this module exactly as before — it re-exports the full surface.
 */
export * from './wireGeneration';
export * from './wireDirections';
export * from './wireTypeResolution';
export * from './parallelBranches';
export * from './wireMerge';

// Default export preserved for `import wireGenerator from '...'` consumers.
import { getConnectionPoints, validateConnection, getWireTypeForConnection, calculateWirePath } from './wireGeneration';
import { resolveWireTypeFromDirections, getElementDirections, analyzeNeighborDirections } from './wireDirections';
import { resolveWireElementType, updateAdjacentWires } from './wireTypeResolution';
import { findParallelBranches, generateVerticalWireSegments, generateJunctionAtBranchPoint } from './parallelBranches';
import { mergeWireDirections, recalculateWireType, applyWireTypeUpdate, recalculateAllWireTypes } from './wireMerge';

export default {
  getConnectionPoints, validateConnection, getWireTypeForConnection, calculateWirePath,
  resolveWireTypeFromDirections, getElementDirections, analyzeNeighborDirections,
  resolveWireElementType, updateAdjacentWires,
  mergeWireDirections, recalculateWireType, applyWireTypeUpdate, recalculateAllWireTypes,
  findParallelBranches, generateVerticalWireSegments, generateJunctionAtBranchPoint,
};
