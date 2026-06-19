/**
 * ExportFormatMenu Component Tests
 *
 * Verifies the export format selection dropdown renders
 * CSV, JSON, and NodeSet2 XML options, handles selection,
 * and supports outside-click and Escape key dismissal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ExportFormatMenu } from '../ExportFormatMenu';
import type { ExportFormat } from '../ExportFormatMenu';

describe('ExportFormatMenu', () => {
  const mockOnSelectFormat = vi.fn<(format: ExportFormat) => void>();
  const mockOnClose = vi.fn();
  let anchorEl: HTMLButtonElement;
  let anchorRef: React.RefObject<HTMLButtonElement | null>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create anchor element in the DOM
    anchorEl = document.createElement('button');
    anchorEl.getBoundingClientRect = () => ({
      x: 100,
      y: 50,
      width: 28,
      height: 28,
      top: 50,
      right: 128,
      bottom: 78,
      left: 100,
      toJSON: () => {},
    });
    document.body.appendChild(anchorEl);
    // Use a mutable ref object
    anchorRef = { current: anchorEl };
  });

  afterEach(() => {
    cleanup();
    if (anchorEl.parentNode) {
      anchorEl.parentNode.removeChild(anchorEl);
    }
  });

  it('does not render when isOpen is false', () => {
    render(
      <ExportFormatMenu
        isOpen={false}
        anchorRef={anchorRef}
        onSelectFormat={mockOnSelectFormat}
        onClose={mockOnClose}
      />,
    );
    expect(screen.queryByTestId('export-format-menu')).not.toBeInTheDocument();
  });

  it('renders menu with all three format options when open', () => {
    render(
      <ExportFormatMenu
        isOpen={true}
        anchorRef={anchorRef}
        onSelectFormat={mockOnSelectFormat}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByTestId('export-format-menu')).toBeInTheDocument();
    expect(screen.getByTestId('export-format-csv')).toBeInTheDocument();
    expect(screen.getByTestId('export-format-json')).toBeInTheDocument();
    expect(screen.getByTestId('export-format-nodeset2')).toBeInTheDocument();
  });

  it('displays correct labels for each format', () => {
    render(
      <ExportFormatMenu
        isOpen={true}
        anchorRef={anchorRef}
        onSelectFormat={mockOnSelectFormat}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('NodeSet2 XML')).toBeInTheDocument();
  });

  it('calls onSelectFormat with "csv" when CSV option is clicked', () => {
    render(
      <ExportFormatMenu
        isOpen={true}
        anchorRef={anchorRef}
        onSelectFormat={mockOnSelectFormat}
        onClose={mockOnClose}
      />,
    );

    fireEvent.click(screen.getByTestId('export-format-csv'));
    expect(mockOnSelectFormat).toHaveBeenCalledWith('csv');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onSelectFormat with "json" when JSON option is clicked', () => {
    render(
      <ExportFormatMenu
        isOpen={true}
        anchorRef={anchorRef}
        onSelectFormat={mockOnSelectFormat}
        onClose={mockOnClose}
      />,
    );

    fireEvent.click(screen.getByTestId('export-format-json'));
    expect(mockOnSelectFormat).toHaveBeenCalledWith('json');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onSelectFormat with "nodeset2" when NodeSet2 XML option is clicked', () => {
    render(
      <ExportFormatMenu
        isOpen={true}
        anchorRef={anchorRef}
        onSelectFormat={mockOnSelectFormat}
        onClose={mockOnClose}
      />,
    );

    fireEvent.click(screen.getByTestId('export-format-nodeset2'));
    expect(mockOnSelectFormat).toHaveBeenCalledWith('nodeset2');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes menu on Escape key', () => {
    render(
      <ExportFormatMenu
        isOpen={true}
        anchorRef={anchorRef}
        onSelectFormat={mockOnSelectFormat}
        onClose={mockOnClose}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes menu on outside click', () => {
    render(
      <ExportFormatMenu
        isOpen={true}
        anchorRef={anchorRef}
        onSelectFormat={mockOnSelectFormat}
        onClose={mockOnClose}
      />,
    );

    // Click on the body (outside menu and anchor)
    fireEvent.mouseDown(document.body);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not close menu when clicking inside the menu', () => {
    render(
      <ExportFormatMenu
        isOpen={true}
        anchorRef={anchorRef}
        onSelectFormat={mockOnSelectFormat}
        onClose={mockOnClose}
      />,
    );

    const menu = screen.getByTestId('export-format-menu');
    fireEvent.mouseDown(menu);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('has correct ARIA attributes for accessibility', () => {
    render(
      <ExportFormatMenu
        isOpen={true}
        anchorRef={anchorRef}
        onSelectFormat={mockOnSelectFormat}
        onClose={mockOnClose}
      />,
    );

    const menu = screen.getByTestId('export-format-menu');
    expect(menu).toHaveAttribute('role', 'menu');
    expect(menu).toHaveAttribute('aria-label', 'Export format selection');

    // Each option should have menuitem role
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems).toHaveLength(3);
  });

  it('displays Korean description text for each option', () => {
    render(
      <ExportFormatMenu
        isOpen={true}
        anchorRef={anchorRef}
        onSelectFormat={mockOnSelectFormat}
        onClose={mockOnClose}
      />,
    );

    // Check descriptions exist (Korean text)
    expect(screen.getByText('태그 필드 및 OPC UA 매핑 포함')).toBeInTheDocument();
    expect(screen.getByText('폴더 트리 구조로 내보내기')).toBeInTheDocument();
    expect(screen.getByText('OPC UA NodeSet2 XML 형식')).toBeInTheDocument();
  });
});
