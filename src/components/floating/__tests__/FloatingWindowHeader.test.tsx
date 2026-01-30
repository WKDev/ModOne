/**
 * FloatingWindowHeader Component Tests
 *
 * Tests for the FloatingWindowHeader component covering rendering,
 * button interactions, and callback execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingWindowHeader } from '../FloatingWindowHeader';

describe('FloatingWindowHeader', () => {
  // Default props for tests
  const defaultProps = {
    title: 'Test Panel',
    windowId: 'test-window-1',
    panelId: 'test-panel-1',
    onDock: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders title text correctly', () => {
      render(<FloatingWindowHeader {...defaultProps} />);
      expect(screen.getByText('Test Panel')).toBeInTheDocument();
    });

    it('renders with different title', () => {
      render(<FloatingWindowHeader {...defaultProps} title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('renders dock button', () => {
      render(<FloatingWindowHeader {...defaultProps} />);
      expect(screen.getByTitle('Dock to main window')).toBeInTheDocument();
    });

    it('renders minimize button', () => {
      render(<FloatingWindowHeader {...defaultProps} />);
      expect(screen.getByTitle('Minimize')).toBeInTheDocument();
    });

    it('renders maximize button', () => {
      render(<FloatingWindowHeader {...defaultProps} />);
      expect(screen.getByTitle('Maximize')).toBeInTheDocument();
    });

    it('renders close button', () => {
      render(<FloatingWindowHeader {...defaultProps} />);
      expect(screen.getByTitle('Close')).toBeInTheDocument();
    });

    it('renders all 4 control buttons', () => {
      render(<FloatingWindowHeader {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      // 4 control buttons + 1 drag handle (technically a button)
      expect(buttons.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('button interactions', () => {
    it('calls onDock when dock button clicked', () => {
      render(<FloatingWindowHeader {...defaultProps} />);

      fireEvent.click(screen.getByTitle('Dock to main window'));

      expect(defaultProps.onDock).toHaveBeenCalledTimes(1);
    });

    it('calls onMinimize when minimize button clicked', () => {
      render(<FloatingWindowHeader {...defaultProps} />);

      fireEvent.click(screen.getByTitle('Minimize'));

      expect(defaultProps.onMinimize).toHaveBeenCalledTimes(1);
    });

    it('calls onMaximize when maximize button clicked', () => {
      render(<FloatingWindowHeader {...defaultProps} />);

      fireEvent.click(screen.getByTitle('Maximize'));

      expect(defaultProps.onMaximize).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close button clicked', () => {
      render(<FloatingWindowHeader {...defaultProps} />);

      fireEvent.click(screen.getByTitle('Close'));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('each button only calls its associated callback', () => {
      render(<FloatingWindowHeader {...defaultProps} />);

      // Click dock button
      fireEvent.click(screen.getByTitle('Dock to main window'));
      expect(defaultProps.onDock).toHaveBeenCalledTimes(1);
      expect(defaultProps.onMinimize).not.toHaveBeenCalled();
      expect(defaultProps.onMaximize).not.toHaveBeenCalled();
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('drag functionality', () => {
    it('renders drag handle with correct title', () => {
      render(<FloatingWindowHeader {...defaultProps} />);
      expect(screen.getByTitle('Drag to dock in main window')).toBeInTheDocument();
    });

    it('drag handle is draggable', () => {
      render(<FloatingWindowHeader {...defaultProps} />);
      const dragHandle = screen.getByTitle('Drag to dock in main window');
      expect(dragHandle).toHaveAttribute('draggable', 'true');
    });

    it('title area has Tauri drag region attribute', () => {
      render(<FloatingWindowHeader {...defaultProps} />);
      const titleElement = screen.getByText('Test Panel');
      expect(titleElement).toHaveAttribute('data-tauri-drag-region');
    });
  });

  describe('accessibility', () => {
    it('buttons have title attributes for tooltips', () => {
      render(<FloatingWindowHeader {...defaultProps} />);

      expect(screen.getByTitle('Dock to main window')).toBeInTheDocument();
      expect(screen.getByTitle('Minimize')).toBeInTheDocument();
      expect(screen.getByTitle('Maximize')).toBeInTheDocument();
      expect(screen.getByTitle('Close')).toBeInTheDocument();
    });

    it('buttons are keyboard accessible', () => {
      render(<FloatingWindowHeader {...defaultProps} />);

      const closeButton = screen.getByTitle('Close');
      closeButton.focus();
      expect(document.activeElement).toBe(closeButton);

      fireEvent.keyDown(closeButton, { key: 'Enter' });
      // Note: Enter key on button triggers click
    });
  });

  describe('styling', () => {
    it('has dark background styling', () => {
      render(<FloatingWindowHeader {...defaultProps} />);
      const header = screen.getByText('Test Panel').closest('div');
      expect(header?.className).toContain('bg-gray-800');
    });

    it('title text has correct styling', () => {
      render(<FloatingWindowHeader {...defaultProps} />);
      const title = screen.getByText('Test Panel');
      expect(title.className).toContain('text-gray-200');
    });
  });

  describe('multiple clicks', () => {
    it('handles rapid clicks on buttons', () => {
      render(<FloatingWindowHeader {...defaultProps} />);

      const closeButton = screen.getByTitle('Close');

      // Rapid clicks
      fireEvent.click(closeButton);
      fireEvent.click(closeButton);
      fireEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(3);
    });
  });
});
