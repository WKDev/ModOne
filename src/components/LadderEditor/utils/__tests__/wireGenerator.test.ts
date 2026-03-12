import { describe, expect, it } from 'vitest';
import type { LadderElement, VerticalLinkEntity } from '../../../../types/ladder';
import { DEFAULT_LADDER_GRID_CONFIG, WireDirection } from '../../../../types/ladder';
import { mergeWireDirections, resolveWireElementType } from '../wireGenerator';

describe('wireGenerator', () => {
  it('treats a standalone vertical link as the top connection for the row below', () => {
    const elements = new Map<string, LadderElement>();
    const verticalLinks = new Map<string, VerticalLinkEntity>([
      [
        'vertical-link-1',
        {
          id: 'vertical-link-1',
          position: { row: 1, col: 0 },
          properties: { isValid: true },
        },
      ],
    ]);

    const resolved = resolveWireElementType(
      { row: 1, col: 0 },
      'wire_h',
      elements,
      DEFAULT_LADDER_GRID_CONFIG,
      undefined,
      verticalLinks
    );

    expect(resolved.directions & WireDirection.TOP).toBe(WireDirection.TOP);
    expect(resolved.directions & WireDirection.BOTTOM).toBe(0);
  });

  it('merges horizontal wire directions with vertical-link neighbors', () => {
    const elements = new Map<string, LadderElement>([
      [
        'wire-h-1',
        {
          id: 'wire-h-1',
          type: 'wire_h',
          position: { row: 1, col: 1 },
          properties: { connectedDirections: WireDirection.LEFT | WireDirection.RIGHT },
        } as LadderElement,
      ],
    ]);
    const verticalLinks = new Map<string, VerticalLinkEntity>([
      [
        'vertical-link-1',
        {
          id: 'vertical-link-1',
          position: { row: 2, col: 1 },
          properties: { isValid: true },
        },
      ],
    ]);

    const merged = mergeWireDirections(
      elements.get('wire-h-1') as LadderElement,
      'wire_v',
      elements,
      DEFAULT_LADDER_GRID_CONFIG,
      undefined,
      verticalLinks
    );

    expect(merged?.newDirections).toBe(
      WireDirection.TOP | WireDirection.BOTTOM | WireDirection.LEFT | WireDirection.RIGHT
    );
  });
});
