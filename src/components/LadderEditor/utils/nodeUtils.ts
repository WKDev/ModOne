import type { LadderNode, BlockNode } from "../../OneParser/types";
import {
  isBlockNode, isContactNode, isCoilNode, isTimerNode, isCounterNode, isComparisonNode,
} from "../../OneParser/types";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Flatten a nested block structure for debugging
 */
export function flattenNodes(node: LadderNode): LadderNode[] {
  if (!isBlockNode(node)) {
    return [node];
  }

  const block = node as BlockNode;
  const result: LadderNode[] = [node];

  for (const child of block.children) {
    result.push(...flattenNodes(child));
  }

  return result;
}

/**
 * Get statistics about a node tree
 */
export function getNodeStats(node: LadderNode): {
  totalNodes: number;
  contacts: number;
  coils: number;
  timers: number;
  counters: number;
  comparisons: number;
  blocks: number;
} {
  const stats = {
    totalNodes: 0,
    contacts: 0,
    coils: 0,
    timers: 0,
    counters: 0,
    comparisons: 0,
    blocks: 0,
  };

  function traverse(n: LadderNode) {
    stats.totalNodes++;

    if (isBlockNode(n)) {
      stats.blocks++;
      for (const child of (n as BlockNode).children) {
        traverse(child);
      }
    } else if (isContactNode(n)) {
      stats.contacts++;
    } else if (isCoilNode(n)) {
      stats.coils++;
    } else if (isTimerNode(n)) {
      stats.timers++;
    } else if (isCounterNode(n)) {
      stats.counters++;
    } else if (isComparisonNode(n)) {
      stats.comparisons++;
    }
  }

  traverse(node);
  return stats;
}

