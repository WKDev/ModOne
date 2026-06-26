/**
 * Grid Converter Utility — barrel.
 *
 * Converts OneParser AST output into ladder grid elements (and back). Split into
 * focused modules to keep each file small and LLM/AI-readable (CLAUDE.md → Code
 * Organization):
 *   astFactories — element/wire factories, node-type mapping, conversion types
 *   astToGrid    — node traversal + AST→grid conversion (main forward path)
 *   nodeUtils    — flattenNodes, getNodeStats
 *   gridGrouping — row grouping + parallel-group detection
 *   gridToAst    — grid→AST reconstruction + normalization (main reverse path)
 *
 * Import from this module exactly as before — it re-exports the full surface.
 */
export * from './astFactories';
export * from './astToGrid';
export * from './nodeUtils';
export * from './gridGrouping';
export * from './gridToAst';

// Default export preserved for `import gridConverter from '...'` consumers.
import {
  convertNodeToGrid, convertNetworkToGrid, convertToEditorNetwork,
  convertMultipleNetworks, calculateNodeDimensions,
} from './astToGrid';
import { flattenNodes, getNodeStats } from './nodeUtils';
import { groupElementsByRow, detectParallelGroups } from './gridGrouping';
import { buildASTFromGroups, normalizeAST, gridToAST, convertEditorToAST } from './gridToAst';

export default {
  convertNodeToGrid, convertNetworkToGrid, convertToEditorNetwork, convertMultipleNetworks,
  flattenNodes, getNodeStats, calculateNodeDimensions,
  groupElementsByRow, detectParallelGroups, buildASTFromGroups, normalizeAST, gridToAST,
  convertEditorToAST,
};
