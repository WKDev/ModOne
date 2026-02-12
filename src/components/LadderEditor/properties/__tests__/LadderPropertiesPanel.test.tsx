/**
 * LadderPropertiesPanel Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { LadderPropertiesPanel } from '../LadderPropertiesPanel';
import { useLadderDocument } from '../../../../stores/hooks/useLadderDocument';
import { useLadderUIStore } from '../../../../stores/ladderUIStore';
import type { ContactElement, CoilElement, TimerElement, CounterElement, LadderElement } from '../../../../types/ladder';

const { mockUIState, mockLadderDoc } = vi.hoisted(() => ({
  mockUIState: {
    selectedElementIds: new Set<string>(),
    mode: 'edit' as 'edit' | 'monitor',
  },
  mockLadderDoc: {
    elements: new Map<string, LadderElement>(),
    updateElement: vi.fn(),
  },
}));

vi.mock('../../../../contexts/DocumentContext', () => ({
  useDocumentContext: vi.fn(() => ({
    documentId: 'test-doc',
    documentType: 'ladder',
    tabId: 'test-tab',
  })),
}));

vi.mock('../../../../stores/hooks/useLadderDocument', () => ({
  useLadderDocument: vi.fn(() => mockLadderDoc),
}));

vi.mock('../../../../stores/ladderUIStore', () => ({
  useLadderUIStore: vi.fn(
    (selector: (state: { selectedElementIds: Set<string>; mode: 'edit' | 'monitor' }) => unknown) =>
      selector(mockUIState)
  ),
}));

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

function createMockElements(): Map<string, LadderElement> {
  const elements = new Map<string, LadderElement>();
  elements.set(mockContactElement.id, mockContactElement);
  elements.set(mockCoilElement.id, mockCoilElement);
  elements.set(mockTimerElement.id, mockTimerElement);
  elements.set(mockCounterElement.id, mockCounterElement);
  return elements;
}

describe('LadderPropertiesPanel', () => {
  function setSelection(ids: string[], mode: 'edit' | 'monitor' = 'edit') {
    mockUIState.selectedElementIds = new Set(ids);
    mockUIState.mode = mode;
  }

  beforeEach(() => {
    mockLadderDoc.elements = createMockElements();
    mockLadderDoc.updateElement = vi.fn();
    setSelection([], 'edit');
    vi.mocked(useLadderDocument).mockReturnValue(mockLadderDoc);
    vi.mocked(useLadderUIStore).mockImplementation(
      (selector: (state: { selectedElementIds: Set<string>; mode: 'edit' | 'monitor' }) => unknown) =>
        selector(mockUIState)
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should show empty state when no elements are selected', () => {
      setSelection([], 'edit');

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('Select an element to view properties')).toBeInTheDocument();
    });
  });

  describe('Single Element Selection', () => {
    it('should show contact properties for selected contact', () => {
      setSelection([mockContactElement.id], 'edit');

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('Contact (NO)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('M0001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Start Button')).toBeInTheDocument();
    });

    it('should show coil properties for selected coil', () => {
      setSelection([mockCoilElement.id], 'edit');

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('Coil (OUT)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('M0010')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Motor')).toBeInTheDocument();
    });

    it('should show timer properties for selected timer', () => {
      setSelection([mockTimerElement.id], 'edit');

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('Timer (TON)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('T0001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    });

    it('should show counter properties for selected counter', () => {
      setSelection([mockCounterElement.id], 'edit');

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('Counter (CTU)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('C0001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    });

    it('should show element address in header', () => {
      setSelection([mockContactElement.id], 'edit');

      render(<LadderPropertiesPanel />);

      const header = screen.getByText('Contact (NO)').closest('div');
      expect(header).toHaveTextContent('M0001');
    });
  });

  describe('Multi-Select', () => {
    it('should show multi-select view when multiple elements selected', () => {
      setSelection([mockContactElement.id, mockCoilElement.id], 'edit');

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('2 elements selected')).toBeInTheDocument();
      expect(screen.getByText('Select a single element to edit its properties.')).toBeInTheDocument();
    });

    it('should show type counts in multi-select view', () => {
      setSelection([mockContactElement.id, mockTimerElement.id], 'edit');

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('contact')).toBeInTheDocument();
      expect(screen.getByText('timer')).toBeInTheDocument();
    });
  });

  describe('Monitor Mode', () => {
    it('should show read-only message in monitor mode', () => {
      setSelection([mockContactElement.id], 'monitor');

      render(<LadderPropertiesPanel />);

      expect(screen.getByText('Properties are read-only in monitor mode')).toBeInTheDocument();
    });

    it('should disable inputs in monitor mode', () => {
      setSelection([mockContactElement.id], 'monitor');

      render(<LadderPropertiesPanel />);

      const addressInput = screen.getByDisplayValue('M0001');
      expect(addressInput).toBeDisabled();
    });
  });

  describe('Property Updates', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should update element when address changes', async () => {
      const updateElementSpy = vi.fn();
      mockLadderDoc.updateElement = updateElementSpy;
      setSelection([mockContactElement.id], 'edit');

      render(<LadderPropertiesPanel />);

      const addressInput = screen.getByDisplayValue('M0001');
      fireEvent.change(addressInput, { target: { value: 'M0002' } });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(updateElementSpy).toHaveBeenCalledWith(mockContactElement.id, {
        address: 'M0002',
      });
    });

    it('should update element when type changes', () => {
      const updateElementSpy = vi.fn();
      mockLadderDoc.updateElement = updateElementSpy;
      setSelection([mockContactElement.id], 'edit');

      render(<LadderPropertiesPanel />);

      const typeSelect = screen.getByDisplayValue('NO (Normally Open)');
      fireEvent.change(typeSelect, { target: { value: 'contact_nc' } });

      expect(updateElementSpy).toHaveBeenCalledWith(mockContactElement.id, {
        type: 'contact_nc',
      });
    });

    it('should update element when label changes', async () => {
      const updateElementSpy = vi.fn();
      mockLadderDoc.updateElement = updateElementSpy;
      setSelection([mockContactElement.id], 'edit');

      render(<LadderPropertiesPanel />);

      const labelInput = screen.getByDisplayValue('Start Button');
      fireEvent.change(labelInput, { target: { value: 'Stop Button' } });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(updateElementSpy).toHaveBeenCalledWith(mockContactElement.id, {
        label: 'Stop Button',
      });
    });
  });
});
