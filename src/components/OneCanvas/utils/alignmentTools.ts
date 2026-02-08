/**
 * Alignment and Distribution Tools
 *
 * Utilities for aligning and distributing blocks on the canvas.
 * Supports alignment to edges and centers, as well as even distribution.
 */

import type { Block, Position } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Alignment direction */
export type AlignmentDirection = 
  | 'left' 
  | 'right' 
  | 'top' 
  | 'bottom' 
  | 'centerH' 
  | 'centerV';

/** Distribution direction */
export type DistributionDirection = 'horizontal' | 'vertical';

/** Alignment result for a single block */
export interface AlignmentResult {
  blockId: string;
  newPosition: Position;
}

/** Bounds of a set of blocks */
interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate the bounding box of a set of blocks
 */
function calculateBounds(blocks: Block[]): Bounds {
  if (blocks.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const block of blocks) {
    minX = Math.min(minX, block.position.x);
    maxX = Math.max(maxX, block.position.x + block.size.width);
    minY = Math.min(minY, block.position.y);
    maxY = Math.max(maxY, block.position.y + block.size.height);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

// ============================================================================
// Alignment Functions
// ============================================================================

/**
 * Align blocks to the left edge
 */
export function alignLeft(blocks: Block[]): AlignmentResult[] {
  if (blocks.length < 2) return [];

  const bounds = calculateBounds(blocks);
  
  return blocks.map(block => ({
    blockId: block.id,
    newPosition: {
      x: bounds.minX,
      y: block.position.y,
    },
  }));
}

/**
 * Align blocks to the right edge
 */
export function alignRight(blocks: Block[]): AlignmentResult[] {
  if (blocks.length < 2) return [];

  const bounds = calculateBounds(blocks);
  
  return blocks.map(block => ({
    blockId: block.id,
    newPosition: {
      x: bounds.maxX - block.size.width,
      y: block.position.y,
    },
  }));
}

/**
 * Align blocks to the top edge
 */
export function alignTop(blocks: Block[]): AlignmentResult[] {
  if (blocks.length < 2) return [];

  const bounds = calculateBounds(blocks);
  
  return blocks.map(block => ({
    blockId: block.id,
    newPosition: {
      x: block.position.x,
      y: bounds.minY,
    },
  }));
}

/**
 * Align blocks to the bottom edge
 */
export function alignBottom(blocks: Block[]): AlignmentResult[] {
  if (blocks.length < 2) return [];

  const bounds = calculateBounds(blocks);
  
  return blocks.map(block => ({
    blockId: block.id,
    newPosition: {
      x: block.position.x,
      y: bounds.maxY - block.size.height,
    },
  }));
}

/**
 * Align blocks to horizontal center
 */
export function alignCenterH(blocks: Block[]): AlignmentResult[] {
  if (blocks.length < 2) return [];

  const bounds = calculateBounds(blocks);
  
  return blocks.map(block => ({
    blockId: block.id,
    newPosition: {
      x: bounds.centerX - block.size.width / 2,
      y: block.position.y,
    },
  }));
}

/**
 * Align blocks to vertical center
 */
export function alignCenterV(blocks: Block[]): AlignmentResult[] {
  if (blocks.length < 2) return [];

  const bounds = calculateBounds(blocks);
  
  return blocks.map(block => ({
    blockId: block.id,
    newPosition: {
      x: block.position.x,
      y: bounds.centerY - block.size.height / 2,
    },
  }));
}

/**
 * Align blocks in a specified direction
 */
export function alignBlocks(
  blocks: Block[],
  direction: AlignmentDirection
): AlignmentResult[] {
  switch (direction) {
    case 'left':
      return alignLeft(blocks);
    case 'right':
      return alignRight(blocks);
    case 'top':
      return alignTop(blocks);
    case 'bottom':
      return alignBottom(blocks);
    case 'centerH':
      return alignCenterH(blocks);
    case 'centerV':
      return alignCenterV(blocks);
    default:
      return [];
  }
}

// ============================================================================
// Distribution Functions
// ============================================================================

/**
 * Distribute blocks evenly horizontally
 */
export function distributeHorizontal(blocks: Block[]): AlignmentResult[] {
  if (blocks.length < 3) return [];

  // Sort by x position
  const sorted = [...blocks].sort((a, b) => a.position.x - b.position.x);
  
  // Calculate total width needed
  const firstBlock = sorted[0];
  const lastBlock = sorted[sorted.length - 1];
  const totalSpan = (lastBlock.position.x + lastBlock.size.width) - firstBlock.position.x;
  
  // Calculate total block widths
  const totalBlockWidth = sorted.reduce((sum, block) => sum + block.size.width, 0);
  
  // Calculate gap between blocks
  const gap = (totalSpan - totalBlockWidth) / (sorted.length - 1);
  
  // Position blocks
  let currentX = firstBlock.position.x;
  
  return sorted.map((block, index) => {
    const newPosition = {
      x: index === 0 ? block.position.x : currentX,
      y: block.position.y,
    };
    
    currentX += block.size.width + gap;
    
    return {
      blockId: block.id,
      newPosition,
    };
  });
}

/**
 * Distribute blocks evenly vertically
 */
export function distributeVertical(blocks: Block[]): AlignmentResult[] {
  if (blocks.length < 3) return [];

  // Sort by y position
  const sorted = [...blocks].sort((a, b) => a.position.y - b.position.y);
  
  // Calculate total height needed
  const firstBlock = sorted[0];
  const lastBlock = sorted[sorted.length - 1];
  const totalSpan = (lastBlock.position.y + lastBlock.size.height) - firstBlock.position.y;
  
  // Calculate total block heights
  const totalBlockHeight = sorted.reduce((sum, block) => sum + block.size.height, 0);
  
  // Calculate gap between blocks
  const gap = (totalSpan - totalBlockHeight) / (sorted.length - 1);
  
  // Position blocks
  let currentY = firstBlock.position.y;
  
  return sorted.map((block, index) => {
    const newPosition = {
      x: block.position.x,
      y: index === 0 ? block.position.y : currentY,
    };
    
    currentY += block.size.height + gap;
    
    return {
      blockId: block.id,
      newPosition,
    };
  });
}

/**
 * Distribute blocks in a specified direction
 */
export function distributeBlocks(
  blocks: Block[],
  direction: DistributionDirection
): AlignmentResult[] {
  switch (direction) {
    case 'horizontal':
      return distributeHorizontal(blocks);
    case 'vertical':
      return distributeVertical(blocks);
    default:
      return [];
  }
}

// ============================================================================
// Spacing Functions
// ============================================================================

/**
 * Set equal horizontal spacing between blocks
 */
export function setEqualHorizontalSpacing(
  blocks: Block[],
  spacing: number
): AlignmentResult[] {
  if (blocks.length < 2) return [];

  // Sort by x position
  const sorted = [...blocks].sort((a, b) => a.position.x - b.position.x);
  
  // Position blocks with equal spacing
  let currentX = sorted[0].position.x;
  
  return sorted.map((block, index) => {
    const newPosition = {
      x: index === 0 ? block.position.x : currentX,
      y: block.position.y,
    };
    
    currentX += block.size.width + spacing;
    
    return {
      blockId: block.id,
      newPosition,
    };
  });
}

/**
 * Set equal vertical spacing between blocks
 */
export function setEqualVerticalSpacing(
  blocks: Block[],
  spacing: number
): AlignmentResult[] {
  if (blocks.length < 2) return [];

  // Sort by y position
  const sorted = [...blocks].sort((a, b) => a.position.y - b.position.y);
  
  // Position blocks with equal spacing
  let currentY = sorted[0].position.y;
  
  return sorted.map((block, index) => {
    const newPosition = {
      x: block.position.x,
      y: index === 0 ? block.position.y : currentY,
    };
    
    currentY += block.size.height + spacing;
    
    return {
      blockId: block.id,
      newPosition,
    };
  });
}

// ============================================================================
// Grid Snap Functions
// ============================================================================

/**
 * Snap block positions to grid
 */
export function snapToGrid(
  blocks: Block[],
  gridSize: number
): AlignmentResult[] {
  return blocks.map(block => ({
    blockId: block.id,
    newPosition: {
      x: Math.round(block.position.x / gridSize) * gridSize,
      y: Math.round(block.position.y / gridSize) * gridSize,
    },
  }));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Apply alignment results to blocks (returns new block array)
 */
export function applyAlignmentResults(
  blocks: Block[],
  results: AlignmentResult[]
): Block[] {
  const resultMap = new Map(results.map(r => [r.blockId, r.newPosition]));
  
  return blocks.map(block => {
    const newPosition = resultMap.get(block.id);
    if (newPosition) {
      return { ...block, position: newPosition };
    }
    return block;
  });
}

/**
 * Check if blocks can be aligned (need at least 2 for most operations)
 */
export function canAlign(blocks: Block[]): boolean {
  return blocks.length >= 2;
}

/**
 * Check if blocks can be distributed (need at least 3)
 */
export function canDistribute(blocks: Block[]): boolean {
  return blocks.length >= 3;
}
