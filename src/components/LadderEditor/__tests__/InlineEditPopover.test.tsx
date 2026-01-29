/**
 * InlineEditPopover Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineEditPopover } from '../InlineEditPopover';
import type { ContactElement, CoilElement, TimerElement } from '../../../types/ladder';

// Mock element data
const mockContactElement: ContactElement = {
  id: 'contact-1',
  type: 'contact_no',
  address: 'M0000',
  position: { row: 0, col: 1 },
  properties: {},
};

const mockCoilElement: CoilElement = {
  id: 'coil-1',
  type: 'coil',
  address: 'P0000',
  position: { row: 0, col: 10 },
  properties: {},
};

const mockTimerElement: TimerElement = {
  id: 'timer-1',
  type: 'timer_ton',
  address: 'T0000',
  position: { row: 0, col: 10 },
  properties: {
    presetTime: 1000,
    timeBase: 'ms',
  },
};

const defaultPosition = { x: 100, y: 100 };

describe('InlineEditPopover', () => {
  const mockOnApply = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnDeviceSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with element address', () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByDisplayValue('M0000')).toBeInTheDocument();
    expect(screen.getByText('Quick Edit')).toBeInTheDocument();
  });

  it('shows type selector for contact elements', () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('NO')).toBeInTheDocument();
    expect(screen.getByText('NC')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.getByText('N')).toBeInTheDocument();
  });

  it('shows type selector for coil elements', () => {
    render(
      <InlineEditPopover
        element={mockCoilElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('OUT')).toBeInTheDocument();
    expect(screen.getByText('SET')).toBeInTheDocument();
    expect(screen.getByText('RST')).toBeInTheDocument();
  });

  it('does not show type selector for timer elements', () => {
    render(
      <InlineEditPopover
        element={mockTimerElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    // Type selector should not be visible
    expect(screen.queryByText('NO')).not.toBeInTheDocument();
    expect(screen.queryByText('OUT')).not.toBeInTheDocument();
  });

  it('calls onApply with updated address when Apply button is clicked', async () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByDisplayValue('M0000');
    await userEvent.clear(input);
    await userEvent.type(input, 'M0100');

    fireEvent.click(screen.getByText('Apply'));

    expect(mockOnApply).toHaveBeenCalledWith({ address: 'M0100' });
  });

  it('calls onApply with updated type when type is changed', async () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    // Change type to NC
    fireEvent.click(screen.getByText('NC'));
    fireEvent.click(screen.getByText('Apply'));

    expect(mockOnApply).toHaveBeenCalledWith({
      address: 'M0000',
      type: 'contact_nc',
    });
  });

  it('calls onCancel when Cancel button is clicked', () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('calls onCancel when Escape key is pressed', async () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    await userEvent.keyboard('{Escape}');
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('calls onApply when Enter key is pressed with valid address', async () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    await userEvent.keyboard('{Enter}');
    expect(mockOnApply).toHaveBeenCalledWith({ address: 'M0000' });
  });

  it('shows validation error for invalid address', async () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByDisplayValue('M0000');
    await userEvent.clear(input);
    await userEvent.type(input, 'X9999');

    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => {
      expect(screen.getByText(/Invalid device type/i)).toBeInTheDocument();
    });
    expect(mockOnApply).not.toHaveBeenCalled();
  });

  it('shows validation error for address out of range', async () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByDisplayValue('M0000');
    await userEvent.clear(input);
    await userEvent.type(input, 'M9999');

    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => {
      expect(screen.getByText(/must be 0-8191/i)).toBeInTheDocument();
    });
    expect(mockOnApply).not.toHaveBeenCalled();
  });

  it('shows device select button when onDeviceSelect is provided', () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
        onDeviceSelect={mockOnDeviceSelect}
      />
    );

    const deviceButton = screen.getByTitle('Select device');
    expect(deviceButton).toBeInTheDocument();

    fireEvent.click(deviceButton);
    expect(mockOnDeviceSelect).toHaveBeenCalled();
  });

  it('converts address to uppercase', async () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByDisplayValue('M0000');
    await userEvent.clear(input);
    await userEvent.type(input, 'm0100');

    expect(input).toHaveValue('M0100');
  });

  it('focuses input on mount', () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByDisplayValue('M0000');
    expect(document.activeElement).toBe(input);
  });

  it('calls onCancel when clicking close button', () => {
    render(
      <InlineEditPopover
        element={mockContactElement}
        position={defaultPosition}
        onApply={mockOnApply}
        onCancel={mockOnCancel}
      />
    );

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    expect(mockOnCancel).toHaveBeenCalled();
  });
});
