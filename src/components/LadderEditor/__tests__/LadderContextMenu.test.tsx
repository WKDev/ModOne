/**
 * LadderContextMenu Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LadderContextMenu } from '../LadderContextMenu';
import type { ContactElement } from '../../../types/ladder';

// Mock element
const mockElement: ContactElement = {
  id: 'contact-1',
  type: 'contact_no',
  address: 'M0000',
  position: { row: 0, col: 1 },
  properties: {},
};

describe('LadderContextMenu', () => {
  const mockOnClose = vi.fn();
  const mockOnAction = vi.fn();

  const defaultProps = {
    position: { x: 100, y: 100 },
    element: null as ContactElement | null,
    hasSelection: false,
    hasClipboard: false,
    isEditMode: true,
    onClose: mockOnClose,
    onAction: mockOnAction,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders at the specified position', () => {
    render(<LadderContextMenu {...defaultProps} />);

    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '100px', top: '100px' });
  });

  it('shows Edit Properties when element is provided', () => {
    render(<LadderContextMenu {...defaultProps} element={mockElement} />);

    expect(screen.getByText('Edit Properties')).toBeInTheDocument();
  });

  it('does not show Edit Properties when no element', () => {
    render(<LadderContextMenu {...defaultProps} element={null} />);

    expect(screen.queryByText('Edit Properties')).not.toBeInTheDocument();
  });

  it('shows clipboard operations', () => {
    render(<LadderContextMenu {...defaultProps} />);

    expect(screen.getByText('Cut')).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByText('Paste')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('disables Cut/Copy/Delete when no selection', () => {
    render(<LadderContextMenu {...defaultProps} hasSelection={false} />);

    const cutButton = screen.getByText('Cut').closest('button');
    const copyButton = screen.getByText('Copy').closest('button');
    const deleteButton = screen.getByText('Delete').closest('button');

    expect(cutButton).toBeDisabled();
    expect(copyButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
  });

  it('enables Cut/Copy/Delete when has selection', () => {
    render(<LadderContextMenu {...defaultProps} hasSelection={true} />);

    const cutButton = screen.getByText('Cut').closest('button');
    const copyButton = screen.getByText('Copy').closest('button');
    const deleteButton = screen.getByText('Delete').closest('button');

    expect(cutButton).not.toBeDisabled();
    expect(copyButton).not.toBeDisabled();
    expect(deleteButton).not.toBeDisabled();
  });

  it('disables Paste when clipboard is empty', () => {
    render(<LadderContextMenu {...defaultProps} hasClipboard={false} />);

    const pasteButton = screen.getByText('Paste').closest('button');
    expect(pasteButton).toBeDisabled();
  });

  it('enables Paste when clipboard has content', () => {
    render(<LadderContextMenu {...defaultProps} hasClipboard={true} />);

    const pasteButton = screen.getByText('Paste').closest('button');
    expect(pasteButton).not.toBeDisabled();
  });

  it('shows insert options in edit mode', () => {
    render(<LadderContextMenu {...defaultProps} isEditMode={true} />);

    expect(screen.getByText('Insert NO Contact')).toBeInTheDocument();
    expect(screen.getByText('Insert NC Contact')).toBeInTheDocument();
    expect(screen.getByText('Insert Coil (OUT)')).toBeInTheDocument();
    expect(screen.getByText('Insert Timer')).toBeInTheDocument();
    expect(screen.getByText('Insert Counter')).toBeInTheDocument();
  });

  it('shows Cross Reference options when element is selected', () => {
    render(<LadderContextMenu {...defaultProps} element={mockElement} />);

    expect(screen.getByText('Cross Reference')).toBeInTheDocument();
    expect(screen.getByText('Go to Definition')).toBeInTheDocument();
  });

  it('calls onAction with correct action when menu item clicked', () => {
    render(<LadderContextMenu {...defaultProps} hasSelection={true} />);

    fireEvent.click(screen.getByText('Copy'));

    expect(mockOnAction).toHaveBeenCalledWith('copy');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not call onAction for disabled items', () => {
    render(<LadderContextMenu {...defaultProps} hasSelection={false} />);

    fireEvent.click(screen.getByText('Cut'));

    expect(mockOnAction).not.toHaveBeenCalled();
  });

  it('shows keyboard shortcuts', () => {
    render(<LadderContextMenu {...defaultProps} element={mockElement} />);

    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+X')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+C')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+V')).toBeInTheDocument();
    expect(screen.getByText('Del')).toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    render(<LadderContextMenu {...defaultProps} />);

    // Wait for event listener to be attached
    await new Promise((resolve) => setTimeout(resolve, 10));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows Duplicate option when has selection in edit mode', () => {
    render(
      <LadderContextMenu {...defaultProps} hasSelection={true} isEditMode={true} />
    );

    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('shows Add Parallel Branch when element is selected in edit mode', () => {
    render(
      <LadderContextMenu
        {...defaultProps}
        element={mockElement}
        isEditMode={true}
      />
    );

    expect(screen.getByText('Add Parallel Branch')).toBeInTheDocument();
  });

  it('calls correct action for edit', () => {
    render(<LadderContextMenu {...defaultProps} element={mockElement} />);

    fireEvent.click(screen.getByText('Edit Properties'));

    expect(mockOnAction).toHaveBeenCalledWith('edit');
  });

  it('calls correct action for insert NO contact', () => {
    render(<LadderContextMenu {...defaultProps} isEditMode={true} />);

    fireEvent.click(screen.getByText('Insert NO Contact'));
    expect(mockOnAction).toHaveBeenCalledWith('insert_contact_no');
  });

  it('calls correct action for insert NC contact', () => {
    render(<LadderContextMenu {...defaultProps} isEditMode={true} />);

    fireEvent.click(screen.getByText('Insert NC Contact'));
    expect(mockOnAction).toHaveBeenCalledWith('insert_contact_nc');
  });

  it('adjusts position to stay within viewport', () => {
    // Position that would overflow
    render(
      <LadderContextMenu
        {...defaultProps}
        position={{ x: window.innerWidth - 50, y: window.innerHeight - 50 }}
      />
    );

    const menu = screen.getByRole('menu');
    const style = menu.style;

    // Should be adjusted to fit
    expect(parseInt(style.left)).toBeLessThan(window.innerWidth - 200);
  });
});
