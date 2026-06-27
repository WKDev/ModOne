import type { Block, BlockType, Position } from '../types';
import {
  getBlockSize,
  getDefaultBlockProps,
  getDefaultPorts,
  getPowerSourcePorts,
  getScopePorts,
} from '../blockDefinitions';
import { createBehaviorPatch } from './behaviorTemplates';

export function createBlockInstance(
  id: string,
  type: BlockType,
  position: Position,
  props: Partial<Block> = {}
): Block {
  const mergedProps = {
    ...getDefaultBlockProps(type),
    ...props,
  } as Partial<Block>;

  // Ports default to the type's static set, but parametric types derive theirs
  // from an instance property (polarity / channels) so edits stay consistent.
  let ports = getDefaultPorts(type);
  if (type === 'powersource') {
    const polarity = (mergedProps as Record<string, unknown>).polarity as string | undefined;
    if (polarity === 'ground' || polarity === 'negative' || polarity === 'positive') {
      ports = getPowerSourcePorts(polarity);
    }
  } else if (type === 'scope') {
    const channels = (mergedProps as Record<string, unknown>).channels as number | undefined;
    ports = getScopePorts(channels ?? 4);
  }

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
