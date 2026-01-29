/**
 * PropertyField Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertyField } from '../PropertyField';

describe('PropertyField', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('Text Input', () => {
    it('should render text input with label', () => {
      const onChange = vi.fn();
      render(
        <PropertyField
          label="Test Label"
          type="text"
          value="test value"
          onChange={onChange}
        />
      );

      expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test value')).toBeInTheDocument();
    });

    it('should call onChange when value changes', async () => {
      const onChange = vi.fn();
      render(
        <PropertyField
          label="Address"
          type="text"
          value=""
          onChange={onChange}
        />
      );

      const input = screen.getByLabelText('Address');
      fireEvent.change(input, { target: { value: 'M0001' } });

      expect(onChange).toHaveBeenCalledWith('M0001');
    });

    it('should show placeholder text', () => {
      const onChange = vi.fn();
      render(
        <PropertyField
          label="Address"
          type="text"
          value=""
          onChange={onChange}
          placeholder="Enter address"
        />
      );

      expect(screen.getByPlaceholderText('Enter address')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      const onChange = vi.fn();
      render(
        <PropertyField
          label="Address"
          type="text"
          value="M0001"
          onChange={onChange}
          disabled
        />
      );

      expect(screen.getByLabelText('Address')).toBeDisabled();
    });

    it('should show error message', () => {
      const onChange = vi.fn();
      render(
        <PropertyField
          label="Address"
          type="text"
          value="INVALID"
          onChange={onChange}
          error="Invalid address format"
        />
      );

      expect(screen.getByText('Invalid address format')).toBeInTheDocument();
    });

    it('should show device button when showDeviceButton is true', () => {
      const onChange = vi.fn();
      const onDeviceClick = vi.fn();
      render(
        <PropertyField
          label="Address"
          type="text"
          value="M0001"
          onChange={onChange}
          showDeviceButton
          onDeviceButtonClick={onDeviceClick}
        />
      );

      const button = screen.getByTitle('Select device');
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(onDeviceClick).toHaveBeenCalled();
    });
  });

  describe('Number Input', () => {
    it('should render number input', () => {
      const onChange = vi.fn();
      render(
        <PropertyField
          label="Preset"
          type="number"
          value={1000}
          onChange={onChange}
        />
      );

      expect(screen.getByLabelText('Preset')).toHaveAttribute('type', 'number');
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    });

    it('should call onChange with number value', () => {
      const onChange = vi.fn();
      render(
        <PropertyField
          label="Preset"
          type="number"
          value={1000}
          onChange={onChange}
        />
      );

      const input = screen.getByLabelText('Preset');
      fireEvent.change(input, { target: { value: '2000' } });

      expect(onChange).toHaveBeenCalledWith(2000);
    });

    it('should respect min and max constraints', () => {
      const onChange = vi.fn();
      render(
        <PropertyField
          label="Preset"
          type="number"
          value={100}
          onChange={onChange}
          min={0}
          max={1000}
        />
      );

      const input = screen.getByLabelText('Preset');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '1000');
    });

    it('should debounce numeric input when debounceMs is set', async () => {
      const onChange = vi.fn();
      render(
        <PropertyField
          label="Preset"
          type="number"
          value={100}
          onChange={onChange}
          debounceMs={300}
        />
      );

      const input = screen.getByLabelText('Preset');
      fireEvent.change(input, { target: { value: '200' } });

      // Should not be called immediately
      expect(onChange).not.toHaveBeenCalled();

      // Advance timers
      vi.advanceTimersByTime(300);

      expect(onChange).toHaveBeenCalledWith(200);
    });
  });

  describe('Select Input', () => {
    const options = [
      { value: 'contact_no', label: 'NO' },
      { value: 'contact_nc', label: 'NC' },
      { value: 'contact_p', label: 'P' },
    ];

    it('should render select with options', () => {
      const onChange = vi.fn();
      render(
        <PropertyField
          label="Type"
          type="select"
          value="contact_no"
          onChange={onChange}
          options={options}
        />
      );

      const select = screen.getByLabelText('Type');
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('contact_no');

      // Check all options are rendered
      expect(screen.getByText('NO')).toBeInTheDocument();
      expect(screen.getByText('NC')).toBeInTheDocument();
      expect(screen.getByText('P')).toBeInTheDocument();
    });

    it('should call onChange when option is selected', () => {
      const onChange = vi.fn();
      render(
        <PropertyField
          label="Type"
          type="select"
          value="contact_no"
          onChange={onChange}
          options={options}
        />
      );

      const select = screen.getByLabelText('Type');
      fireEvent.change(select, { target: { value: 'contact_nc' } });

      expect(onChange).toHaveBeenCalledWith('contact_nc');
    });
  });

  describe('Value Synchronization', () => {
    it('should update local value when prop value changes', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <PropertyField
          label="Address"
          type="text"
          value="M0001"
          onChange={onChange}
        />
      );

      expect(screen.getByDisplayValue('M0001')).toBeInTheDocument();

      rerender(
        <PropertyField
          label="Address"
          type="text"
          value="M0002"
          onChange={onChange}
        />
      );

      expect(screen.getByDisplayValue('M0002')).toBeInTheDocument();
    });
  });
});
