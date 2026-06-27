// 핀 인스펙터의 전기타입 저작과 심볼 속성 저작 패널 동작을 고정하는 테스트
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PinInspector } from '../PinInspector';
import { SymbolPropertiesEditor } from '../SymbolPropertiesEditor';
import type { SymbolPin, SymbolProperty } from '../../../../types/symbol';

afterEach(cleanup);

function makePin(overrides: Partial<SymbolPin> = {}): SymbolPin {
  return {
    id: 'p1',
    name: 'IN',
    number: '1',
    type: 'input',
    shape: 'line',
    position: { x: 0, y: 10 },
    orientation: 'left',
    length: 0,
    ...overrides,
  };
}

describe('PinInspector — detailed electrical type authoring', () => {
  it('selecting Power Output sets electricalType and syncs v1 category to power', () => {
    const onUpdatePin = vi.fn();
    render(<PinInspector pin={makePin()} onUpdatePin={onUpdatePin} />);

    fireEvent.change(screen.getByTestId('pin-etype-v2-select'), {
      target: { value: 'power_out' },
    });

    expect(onUpdatePin).toHaveBeenCalledWith('p1', {
      electricalType: 'power_out',
      type: 'power',
    });
  });

  it('clearing detailed type resets electricalType to undefined', () => {
    const onUpdatePin = vi.fn();
    render(<PinInspector pin={makePin({ electricalType: 'power_in' })} onUpdatePin={onUpdatePin} />);

    fireEvent.change(screen.getByTestId('pin-etype-v2-select'), {
      target: { value: '' },
    });

    expect(onUpdatePin).toHaveBeenCalledWith('p1', { electricalType: undefined });
  });

  it('reflects the current electricalType value', () => {
    render(<PinInspector pin={makePin({ electricalType: 'power_out' })} />);
    expect((screen.getByTestId('pin-etype-v2-select') as HTMLSelectElement).value).toBe('power_out');
  });
});

describe('SymbolPropertiesEditor — instance property authoring', () => {
  it('add button appends a blank property', () => {
    const onChange = vi.fn();
    render(<SymbolPropertiesEditor properties={[]} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('prop-add'));

    expect(onChange).toHaveBeenCalledWith([
      { key: '', value: '', type: 'string', editorType: 'text', visible: true },
    ]);
  });

  it('editing a key updates that property', () => {
    const props: SymbolProperty[] = [
      { key: '', value: '', type: 'string', editorType: 'text', visible: true },
    ];
    const onChange = vi.fn();
    render(<SymbolPropertiesEditor properties={props} onChange={onChange} />);

    fireEvent.change(screen.getByTestId('prop-key-0'), { target: { value: 'voltage' } });

    expect(onChange).toHaveBeenCalledWith([
      { key: 'voltage', value: '', type: 'string', editorType: 'text', visible: true },
    ]);
  });

  it('switching type to number resets editorType and default value', () => {
    const props: SymbolProperty[] = [
      { key: 'voltage', value: 'x', type: 'string', editorType: 'text', visible: true },
    ];
    const onChange = vi.fn();
    render(<SymbolPropertiesEditor properties={props} onChange={onChange} />);

    fireEvent.change(screen.getByTestId('prop-type-0'), { target: { value: 'number' } });

    expect(onChange).toHaveBeenCalledWith([
      { key: 'voltage', value: 0, type: 'number', editorType: 'number', visible: true },
    ]);
  });

  it('removing a property drops it from the list', () => {
    const props: SymbolProperty[] = [
      { key: 'a', value: '', type: 'string', visible: true },
      { key: 'b', value: '', type: 'string', visible: true },
    ];
    const onChange = vi.fn();
    render(<SymbolPropertiesEditor properties={props} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('prop-remove-0'));

    expect(onChange).toHaveBeenCalledWith([{ key: 'b', value: '', type: 'string', visible: true }]);
  });
});
