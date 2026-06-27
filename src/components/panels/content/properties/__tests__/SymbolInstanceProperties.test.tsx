// 커스텀 심볼 인스턴스 속성 편집 시 가변 포트가 재계산되는지 검증 (트랙 B Phase 3)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SymbolInstanceProperties } from '../SymbolInstanceProperties';
import {
  registerCustomSymbol,
  clearCustomSymbolCache,
} from '../../../../OneCanvas/renderers/symbols/customSymbolBridge';
import type { Block } from '../../../../OneCanvas/types';
import type { SymbolDefinition } from '../../../../../types/symbol';

const DEF: SymbolDefinition = {
  id: 'custom:scope',
  name: 'Param Scope',
  version: '1.0.0',
  category: 'measurement',
  createdAt: '',
  updatedAt: '',
  width: 50,
  height: 40,
  graphics: [],
  pins: [
    { id: 'trig', name: 'TRIG', number: '1', type: 'input', shape: 'line', position: { x: 25, y: 0 }, orientation: 'up', length: 0 },
  ],
  portTemplates: [
    { repeat: 'channels', min: 1, max: 8, idPattern: 'ch{i}', namePattern: 'CH{i}', numberFrom: 2, type: 'input', orientation: 'left', x: 0, yStart: 10, yStep: 10 },
  ],
  properties: [
    { key: 'channels', value: 4, type: 'number', visible: true },
  ],
};

function makeBlock(): Block {
  return {
    id: 'b1',
    type: 'custom_symbol',
    position: { x: 0, y: 0 },
    size: { width: 50, height: 40 },
    ports: [],
    symbolId: 'custom:scope',
    instanceProperties: {},
  } as unknown as Block;
}

beforeEach(() => registerCustomSymbol(DEF));
afterEach(() => { cleanup(); clearCustomSymbolCache(); });

describe('SymbolInstanceProperties — parametric custom symbol', () => {
  it('renders the symbol property field', () => {
    render(<SymbolInstanceProperties component={makeBlock()} onChange={vi.fn()} />);
    expect(screen.getByLabelText('channels')).toBeTruthy();
  });

  it('recomputes ports when a repeat-driving property changes', () => {
    const onChange = vi.fn();
    render(<SymbolInstanceProperties component={makeBlock()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('channels'), { target: { value: '3' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const updates = onChange.mock.calls[0][0];
    expect(updates.instanceProperties.channels).toBe(3);
    // static trig + 3 channel ports
    expect(updates.ports).toHaveLength(4);
    expect(updates.ports.map((p: { id: string }) => p.id)).toEqual(['trig', 'ch1', 'ch2', 'ch3']);
  });

  it('renders nothing for a symbol with no visible properties', () => {
    clearCustomSymbolCache();
    registerCustomSymbol({ ...DEF, properties: [] });
    const { container } = render(<SymbolInstanceProperties component={makeBlock()} onChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
