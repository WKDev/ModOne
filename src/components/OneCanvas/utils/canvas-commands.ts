import type { Block } from '../types';

function getSelectedComponents(
  components: Map<string, Block>,
  selectedIds: Set<string>
): Block[] {
  return Array.from(selectedIds)
    .filter((id) => components.has(id))
    .map((id) => components.get(id))
    .filter((component): component is Block => component !== undefined);
}

/**
 * Align components along a direction.
 * Pure function - no store access, no side effects.
 */
export function alignComponents(
  components: Map<string, Block>,
  selectedIds: Set<string>,
  direction: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV'
): Map<string, Block> {
  const nextComponents = new Map(components);
  const selectedComponents = getSelectedComponents(components, selectedIds);

  if (selectedComponents.length < 2) {
    return nextComponents;
  }

  let target: number;
  switch (direction) {
    case 'left':
      target = Math.min(...selectedComponents.map((c) => c.position.x));
      selectedComponents.forEach((c) => {
        nextComponents.set(c.id, { ...c, position: { ...c.position, x: target } });
      });
      break;
    case 'right':
      target = Math.max(...selectedComponents.map((c) => c.position.x + c.size.width));
      selectedComponents.forEach((c) => {
        nextComponents.set(c.id, { ...c, position: { ...c.position, x: target - c.size.width } });
      });
      break;
    case 'top':
      target = Math.min(...selectedComponents.map((c) => c.position.y));
      selectedComponents.forEach((c) => {
        nextComponents.set(c.id, { ...c, position: { ...c.position, y: target } });
      });
      break;
    case 'bottom':
      target = Math.max(...selectedComponents.map((c) => c.position.y + c.size.height));
      selectedComponents.forEach((c) => {
        nextComponents.set(c.id, { ...c, position: { ...c.position, y: target - c.size.height } });
      });
      break;
    case 'centerH': {
      const centerX = selectedComponents.reduce((sum, c) => sum + c.position.x + c.size.width / 2, 0) / selectedComponents.length;
      selectedComponents.forEach((c) => {
        nextComponents.set(c.id, { ...c, position: { ...c.position, x: centerX - c.size.width / 2 } });
      });
      break;
    }
    case 'centerV': {
      const centerY = selectedComponents.reduce((sum, c) => sum + c.position.y + c.size.height / 2, 0) / selectedComponents.length;
      selectedComponents.forEach((c) => {
        nextComponents.set(c.id, { ...c, position: { ...c.position, y: centerY - c.size.height / 2 } });
      });
      break;
    }
  }

  return nextComponents;
}

/**
 * Distribute components evenly along an axis.
 * Returns unchanged map if fewer than 3 selected.
 */
export function distributeComponents(
  components: Map<string, Block>,
  selectedIds: Set<string>,
  direction: 'horizontal' | 'vertical'
): Map<string, Block> {
  const nextComponents = new Map(components);
  const selectedComponents = getSelectedComponents(components, selectedIds);

  if (selectedComponents.length < 3) {
    return nextComponents;
  }

  if (direction === 'horizontal') {
    const sorted = [...selectedComponents].sort((a, b) => a.position.x - b.position.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpan = last.position.x + last.size.width - first.position.x;
    const totalWidths = sorted.reduce((sum, c) => sum + c.size.width, 0);
    const gap = (totalSpan - totalWidths) / (sorted.length - 1);

    let currentX = first.position.x;
    sorted.forEach((c) => {
      nextComponents.set(c.id, { ...c, position: { ...c.position, x: currentX } });
      currentX += c.size.width + gap;
    });
  } else {
    const sorted = [...selectedComponents].sort((a, b) => a.position.y - b.position.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpan = last.position.y + last.size.height - first.position.y;
    const totalHeights = sorted.reduce((sum, c) => sum + c.size.height, 0);
    const gap = (totalSpan - totalHeights) / (sorted.length - 1);

    let currentY = first.position.y;
    sorted.forEach((c) => {
      nextComponents.set(c.id, { ...c, position: { ...c.position, y: currentY } });
      currentY += c.size.height + gap;
    });
  }

  return nextComponents;
}

/**
 * Flip (mirror) components around the center of selection.
 */
export function flipComponents(
  components: Map<string, Block>,
  selectedIds: Set<string>,
  axis: 'horizontal' | 'vertical'
): Map<string, Block> {
  const nextComponents = new Map(components);
  const selectedComponents = getSelectedComponents(components, selectedIds);

  if (selectedComponents.length === 0) {
    return nextComponents;
  }

  const minX = Math.min(...selectedComponents.map((c) => c.position.x));
  const maxX = Math.max(...selectedComponents.map((c) => c.position.x + c.size.width));
  const minY = Math.min(...selectedComponents.map((c) => c.position.y));
  const maxY = Math.max(...selectedComponents.map((c) => c.position.y + c.size.height));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  selectedComponents.forEach((c) => {
    if (axis === 'horizontal') {
      const newX = 2 * centerX - c.position.x - c.size.width;
      nextComponents.set(c.id, { ...c, position: { ...c.position, x: newX } });
    } else {
      const newY = 2 * centerY - c.position.y - c.size.height;
      nextComponents.set(c.id, { ...c, position: { ...c.position, y: newY } });
    }
  });

  return nextComponents;
}
