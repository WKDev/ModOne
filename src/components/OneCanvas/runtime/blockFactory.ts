import type { Block, BlockType, Position } from '../types';
import {
  getBlockSize,
  getDefaultBlockProps,
  getDefaultPorts,
  getPowerSourcePorts,
} from '../blockDefinitions';
import { createBehaviorPatch } from './behaviorTemplates';

export function createBlockInstance(
  id: string,
  type: BlockType,
  position: Position,
  props: Partial<Block> = {}
): Block {
  let ports = getDefaultPorts(type);
  if (type === 'powersource') {
    const polarity = (props as Record<string, unknown>).polarity as string | undefined;
    if (polarity === 'ground' || polarity === 'negative' || polarity === 'positive') {
      ports = getPowerSourcePorts(polarity);
    }
  }

  const mergedProps = {
    ...getDefaultBlockProps(type),
    ...props,
  } as Partial<Block>;

  return {
    id,
    type,
    position,
    size: getBlockSize(type),
    ports,
    ...mergedProps,
    ...createBehaviorPatch(type, id, mergedProps),
  } as Block;
}
