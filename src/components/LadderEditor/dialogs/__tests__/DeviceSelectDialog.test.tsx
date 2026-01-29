/**
 * DeviceSelectDialog Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DeviceSelectDialog } from '../DeviceSelectDialog';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('DeviceSelectDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    // Clear localStorage mock before each test
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should not render when isOpen is false', () => {
      render(
        <DeviceSelectDialog
          isOpen={false}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should show the title', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          title="Custom Title"
        />
      );

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });
  });

  describe('Device Type Selection', () => {
    it('should show all device types by default', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // Check for device type buttons by their title
      expect(screen.getByTitle('Output Relay')).toBeInTheDocument();
      expect(screen.getByTitle('Internal Relay')).toBeInTheDocument();
      expect(screen.getByTitle('Keep Relay')).toBeInTheDocument();
      expect(screen.getByTitle('Data Register')).toBeInTheDocument();
      expect(screen.getByTitle('Timer Contact')).toBeInTheDocument();
      expect(screen.getByTitle('Counter Contact')).toBeInTheDocument();
    });

    it('should filter device types when allowedDeviceTypes is specified', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          allowedDeviceTypes={['M', 'K']}
        />
      );

      expect(screen.getByTitle('Internal Relay')).toBeInTheDocument();
      expect(screen.getByTitle('Keep Relay')).toBeInTheDocument();
      expect(screen.queryByTitle('Data Register')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Timer Contact')).not.toBeInTheDocument();
    });

    it('should change selected device type when clicked', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // M is selected by default
      // Click on D to select it
      const dataRegButton = screen.getByTitle('Data Register');
      fireEvent.click(dataRegButton);

      // Verify D is now selected (has bg-blue-600 class)
      expect(dataRegButton.className).toContain('bg-blue-600');
    });
  });

  describe('Address Input', () => {
    it('should accept numeric input', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      const input = screen.getByLabelText('Address Number');
      fireEvent.change(input, { target: { value: '1234' } });

      expect(input).toHaveValue('1234');
    });

    it('should strip non-numeric characters', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      const input = screen.getByLabelText('Address Number');
      fireEvent.change(input, { target: { value: 'abc123xyz' } });

      expect(input).toHaveValue('123');
    });

    it('should limit to 4 digits for most device types', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      const input = screen.getByLabelText('Address Number');
      fireEvent.change(input, { target: { value: '123456' } });

      expect(input).toHaveValue('1234');
    });

    it('should limit to 2 digits for Z device type', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // Select Z device type
      fireEvent.click(screen.getByText('Z'));

      const input = screen.getByLabelText('Address Number');
      fireEvent.change(input, { target: { value: '123' } });

      expect(input).toHaveValue('12');
    });
  });

  describe('Validation', () => {
    it('should show error for address out of range', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // M device range is 0-8191
      const input = screen.getByLabelText('Address Number');
      fireEvent.change(input, { target: { value: '9999' } });

      // Click Select to trigger validation
      fireEvent.click(screen.getByText('Select'));

      expect(screen.getByText(/Address must be between/)).toBeInTheDocument();
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('should accept valid address within range', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      const input = screen.getByLabelText('Address Number');
      fireEvent.change(input, { target: { value: '100' } });

      fireEvent.click(screen.getByText('Select'));

      expect(mockOnSelect).toHaveBeenCalledWith('M0100');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Initial Address', () => {
    it('should populate with initial address', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          initialAddress="D0500"
        />
      );

      // D should be selected
      const dButton = screen.getByTitle('Data Register');
      expect(dButton.className).toContain('bg-blue-600');

      // Address should be 0500
      const input = screen.getByLabelText('Address Number');
      expect(input).toHaveValue('0500');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close on Escape key', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      fireEvent.keyDown(screen.getByRole('dialog').parentElement!, {
        key: 'Escape',
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should confirm on Enter key', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      const input = screen.getByLabelText('Address Number');
      fireEvent.change(input, { target: { value: '0001' } });

      fireEvent.keyDown(screen.getByRole('dialog').parentElement!, {
        key: 'Enter',
      });

      expect(mockOnSelect).toHaveBeenCalledWith('M0001');
    });
  });

  describe('Recently Used', () => {
    it('should display recently used devices', () => {
      // Seed localStorage with recent devices
      localStorage.setItem(
        'modone:recentDevices',
        JSON.stringify(['M0100', 'D0200', 'T0001'])
      );

      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('M0100')).toBeInTheDocument();
      expect(screen.getByText('D0200')).toBeInTheDocument();
      expect(screen.getByText('T0001')).toBeInTheDocument();
    });

    it('should select recent device when clicked', () => {
      localStorage.setItem(
        'modone:recentDevices',
        JSON.stringify(['M0100'])
      );

      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      fireEvent.click(screen.getByText('M0100'));

      expect(mockOnSelect).toHaveBeenCalledWith('M0100');
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should filter recent devices by search query', () => {
      localStorage.setItem(
        'modone:recentDevices',
        JSON.stringify(['M0100', 'D0200', 'T0001'])
      );

      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Filter recent devices...');
      fireEvent.change(searchInput, { target: { value: 'M' } });

      expect(screen.getByText('M0100')).toBeInTheDocument();
      expect(screen.queryByText('D0200')).not.toBeInTheDocument();
      expect(screen.queryByText('T0001')).not.toBeInTheDocument();
    });
  });

  describe('Cancel', () => {
    it('should close without selecting on Cancel', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('should close when clicking backdrop', () => {
      render(
        <DeviceSelectDialog
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // Click the backdrop (parent of dialog)
      const backdrop = screen.getByRole('dialog').parentElement!;
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
