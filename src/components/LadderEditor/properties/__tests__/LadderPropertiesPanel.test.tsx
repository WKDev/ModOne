/**
 * LadderPropertiesPanel Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { LadderPropertiesPanel } from '../LadderPropertiesPanel';
import { useLadderStore } from '../../../../stores/ladderStore';
import type { ContactElement, CoilElement, TimerElement, CounterElement, LadderNetwork } from '../../../../types/ladder';

// Sample elements for testing
const mockContactElement: ContactElement = {
  id: 'contact-1',
  type: 'contact_no',
  position: { row: 0, col: 0 },
  address: 'M0001',
  label: 'Start Button',
  properties: {},
};

const mockCoilElement: CoilElement = {
  id: 'coil-1',
  type: 'coil',
  position: { row: 0, col: 9 },
  address: 'M0010',
  label: 'Motor',
  properties: {},
};

const mockTimerElement: TimerElement = {
  id: 'timer-1',
  type: 'timer_ton',
  position: { row: 1, col: 5 },
  address: 'T0001',
  properties: {
    presetTime: 1000,
    timeBase: 'ms',
  },
};

const mockCounterElement: CounterElement = {
  id: 'counter-1',
  type: 'counter_ctu',
  position: { row: 2, col: 5 },
  address: 'C0001',
  properties: {
    presetValue: 10,
  },
};

function createMockNetwork(): LadderNetwork {
  const elements = new Map<string, ContactElement | CoilElement | TimerElement | CounterElement>();
  elements.set(mockContactElement.id, mockContactElement);
  elements.set(mockCoilElement.id, mockCoilElement);
  elements.set(mockTimerElement.id, mockTimerElement);
  elements.set(mockCounterElement.id, mockCounterElement);

  return {
    id: 'network-1',
    label: 'Network 1',
    elements: elements as LadderNetwork['elements'],
    wires: [],
    enabled: true,
  };
}

describe('LadderPropertiesPanel', () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useLadderStore.getState().reset();
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should show empty state when no elements are selected', () => {
      // Set up store with network but no selection
      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set(),
          mode: 'edit',
        });
      });

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('Select an element to view properties')).toBeInTheDocument();
    });
  });

  describe('Single Element Selection', () => {
    it('should show contact properties for selected contact', () => {
      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set([mockContactElement.id]),
          mode: 'edit',
        });
      });

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('Contact (NO)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('M0001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Start Button')).toBeInTheDocument();
    });

    it('should show coil properties for selected coil', () => {
      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set([mockCoilElement.id]),
          mode: 'edit',
        });
      });

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('Coil (OUT)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('M0010')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Motor')).toBeInTheDocument();
    });

    it('should show timer properties for selected timer', () => {
      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set([mockTimerElement.id]),
          mode: 'edit',
        });
      });

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('Timer (TON)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('T0001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    });

    it('should show counter properties for selected counter', () => {
      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set([mockCounterElement.id]),
          mode: 'edit',
        });
      });

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('Counter (CTU)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('C0001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    });

    it('should show element address in header', () => {
      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set([mockContactElement.id]),
          mode: 'edit',
        });
      });

      render(<LadderPropertiesPanel />);

      // Address should appear in header (on the right side)
      const header = screen.getByText('Contact (NO)').closest('div');
      expect(header).toHaveTextContent('M0001');
    });
  });

  describe('Multi-Select', () => {
    it('should show multi-select view when multiple elements selected', () => {
      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set([mockContactElement.id, mockCoilElement.id]),
          mode: 'edit',
        });
      });

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('2 elements selected')).toBeInTheDocument();
      expect(screen.getByText('Select a single element to edit its properties.')).toBeInTheDocument();
    });

    it('should show type counts in multi-select view', () => {
      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set([mockContactElement.id, mockTimerElement.id]),
          mode: 'edit',
        });
      });

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('contact')).toBeInTheDocument();
      expect(screen.getByText('timer')).toBeInTheDocument();
    });
  });

  describe('Monitor Mode', () => {
    it('should show read-only message in monitor mode', () => {
      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set([mockContactElement.id]),
          mode: 'monitor',
        });
      });

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('Properties are read-only in monitor mode')).toBeInTheDocument();
    });

    it('should disable inputs in monitor mode', () => {
      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set([mockContactElement.id]),
          mode: 'monitor',
        });
      });

      render(<LadderPropertiesPanel />);

      const addressInput = screen.getByDisplayValue('M0001');
      expect(addressInput).toBeDisabled();
    });
  });

  describe('Property Updates', () => {
    it('should update element when address changes', () => {
      const updateElementSpy = vi.fn();

      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set([mockContactElement.id]),
          mode: 'edit',
        });
        // Spy on updateElement after setting state
        vi.spyOn(useLadderStore.getState(), 'updateElement').mockImplementation(updateElementSpy);
      });

      render(<LadderPropertiesPanel />);

      const addressInput = screen.getByDisplayValue('M0001');
      fireEvent.change(addressInput, { target: { value: 'M0002' } });

      expect(updateElementSpy).toHaveBeenCalledWith(mockContactElement.id, {
        address: 'M0002',
      });
    });

    it('should update element when type changes', () => {
      const updateElementSpy = vi.fn();

      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set([mockContactElement.id]),
          mode: 'edit',
        });
        vi.spyOn(useLadderStore.getState(), 'updateElement').mockImplementation(updateElementSpy);
      });

      render(<LadderPropertiesPanel />);

      const typeSelect = screen.getByDisplayValue('NO (Normally Open)');
      fireEvent.change(typeSelect, { target: { value: 'contact_nc' } });

      expect(updateElementSpy).toHaveBeenCalledWith(mockContactElement.id, {
        type: 'contact_nc',
      });
    });

    it('should update element when label changes', () => {
      const updateElementSpy = vi.fn();

      act(() => {
        const network = createMockNetwork();
        useLadderStore.setState({
          networks: new Map([[network.id, network]]),
          currentNetworkId: network.id,
          selectedElementIds: new Set([mockContactElement.id]),
          mode: 'edit',
        });
        vi.spyOn(useLadderStore.getState(), 'updateElement').mockImplementation(updateElementSpy);
      });

      render(<LadderPropertiesPanel />);

      const labelInput = screen.getByDisplayValue('Start Button');
      fireEvent.change(labelInput, { target: { value: 'Stop Button' } });

      expect(updateElementSpy).toHaveBeenCalledWith(mockContactElement.id, {
        label: 'Stop Button',
      });
    });
  });
});
