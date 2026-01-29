/**
 * useLadderKeyboardShortcuts Hook Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLadderKeyboardShortcuts } from '../useLadderKeyboardShortcuts';
import { useLadderStore } from '../../../../stores/ladderStore';

// Mock the store
vi.mock('../../../../stores/ladderStore', () => ({
  useLadderStore: vi.fn(),
}));

describe('useLadderKeyboardShortcuts', () => {
  const mockRemoveElement = vi.fn();
  const mockCopyToClipboard = vi.fn();
  const mockCutSelection = vi.fn();
  const mockPasteFromClipboard = vi.fn();
  const mockSelectAll = vi.fn();
  const mockClearSelection = vi.fn();
  const mockUndo = vi.fn();
  const mockRedo = vi.fn();
  const mockDuplicateElement = vi.fn();
  const mockCopyNetwork = vi.fn();
  const mockPasteNetwork = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useLadderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedElementIds: new Set(['element-1', 'element-2']),
      mode: 'edit',
      removeElement: mockRemoveElement,
      copyToClipboard: mockCopyToClipboard,
      cutSelection: mockCutSelection,
      pasteFromClipboard: mockPasteFromClipboard,
      selectAll: mockSelectAll,
      clearSelection: mockClearSelection,
      undo: mockUndo,
      redo: mockRedo,
      duplicateElement: mockDuplicateElement,
      copyNetwork: mockCopyNetwork,
      pasteNetwork: mockPasteNetwork,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to simulate key events
  function simulateKeyDown(
    key: string,
    options: { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {}
  ) {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: options.ctrlKey || false,
      shiftKey: options.shiftKey || false,
      metaKey: options.metaKey || false,
      bubbles: true,
    });
    window.dispatchEvent(event);
  }

  describe('Delete operations', () => {
    it('should remove selected elements on Delete key', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('Delete');
      });

      expect(mockRemoveElement).toHaveBeenCalledTimes(2);
      expect(mockRemoveElement).toHaveBeenCalledWith('element-1');
      expect(mockRemoveElement).toHaveBeenCalledWith('element-2');
    });

    it('should remove selected elements on Backspace key', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('Backspace');
      });

      expect(mockRemoveElement).toHaveBeenCalledTimes(2);
    });

    it('should not delete in monitor mode', () => {
      (useLadderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        selectedElementIds: new Set(['element-1']),
        mode: 'monitor',
        removeElement: mockRemoveElement,
        copyToClipboard: mockCopyToClipboard,
        cutSelection: mockCutSelection,
        pasteFromClipboard: mockPasteFromClipboard,
        selectAll: mockSelectAll,
        clearSelection: mockClearSelection,
        undo: mockUndo,
        redo: mockRedo,
        duplicateElement: mockDuplicateElement,
        copyNetwork: mockCopyNetwork,
        pasteNetwork: mockPasteNetwork,
      });

      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('Delete');
      });

      expect(mockRemoveElement).not.toHaveBeenCalled();
    });
  });

  describe('Undo/Redo operations', () => {
    it('should undo on Ctrl+Z', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('z', { ctrlKey: true });
      });

      expect(mockUndo).toHaveBeenCalledTimes(1);
    });

    it('should redo on Ctrl+Y', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('y', { ctrlKey: true });
      });

      expect(mockRedo).toHaveBeenCalledTimes(1);
    });

    it('should redo on Ctrl+Shift+Z', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('z', { ctrlKey: true, shiftKey: true });
      });

      expect(mockRedo).toHaveBeenCalledTimes(1);
    });
  });

  describe('Clipboard operations', () => {
    it('should copy on Ctrl+C', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('c', { ctrlKey: true });
      });

      expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
    });

    it('should cut on Ctrl+X', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('x', { ctrlKey: true });
      });

      expect(mockCutSelection).toHaveBeenCalledTimes(1);
    });

    it('should paste on Ctrl+V', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('v', { ctrlKey: true });
      });

      expect(mockPasteFromClipboard).toHaveBeenCalledTimes(1);
    });

    it('should not cut in monitor mode', () => {
      (useLadderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        selectedElementIds: new Set(['element-1']),
        mode: 'monitor',
        removeElement: mockRemoveElement,
        copyToClipboard: mockCopyToClipboard,
        cutSelection: mockCutSelection,
        pasteFromClipboard: mockPasteFromClipboard,
        selectAll: mockSelectAll,
        clearSelection: mockClearSelection,
        undo: mockUndo,
        redo: mockRedo,
        duplicateElement: mockDuplicateElement,
        copyNetwork: mockCopyNetwork,
        pasteNetwork: mockPasteNetwork,
      });

      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('x', { ctrlKey: true });
      });

      expect(mockCutSelection).not.toHaveBeenCalled();
    });

    it('should copy network on Ctrl+Shift+C', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('c', { ctrlKey: true, shiftKey: true });
      });

      expect(mockCopyNetwork).toHaveBeenCalledTimes(1);
      expect(mockCopyToClipboard).not.toHaveBeenCalled();
    });

    it('should paste network on Ctrl+Shift+V', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('v', { ctrlKey: true, shiftKey: true });
      });

      expect(mockPasteNetwork).toHaveBeenCalledTimes(1);
      expect(mockPasteFromClipboard).not.toHaveBeenCalled();
    });

    it('should not paste network in monitor mode', () => {
      (useLadderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        selectedElementIds: new Set(['element-1']),
        mode: 'monitor',
        removeElement: mockRemoveElement,
        copyToClipboard: mockCopyToClipboard,
        cutSelection: mockCutSelection,
        pasteFromClipboard: mockPasteFromClipboard,
        selectAll: mockSelectAll,
        clearSelection: mockClearSelection,
        undo: mockUndo,
        redo: mockRedo,
        duplicateElement: mockDuplicateElement,
        copyNetwork: mockCopyNetwork,
        pasteNetwork: mockPasteNetwork,
      });

      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('v', { ctrlKey: true, shiftKey: true });
      });

      expect(mockPasteNetwork).not.toHaveBeenCalled();
    });
  });

  describe('Selection operations', () => {
    it('should select all on Ctrl+A', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('a', { ctrlKey: true });
      });

      expect(mockSelectAll).toHaveBeenCalledTimes(1);
    });

    it('should clear selection on Escape', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('Escape');
      });

      expect(mockClearSelection).toHaveBeenCalledTimes(1);
    });
  });

  describe('Duplicate operation', () => {
    it('should duplicate on Ctrl+D', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('d', { ctrlKey: true });
      });

      expect(mockDuplicateElement).toHaveBeenCalledTimes(2);
    });
  });

  describe('Navigation', () => {
    it('should call onNavigate for arrow keys', () => {
      const onNavigate = vi.fn();
      renderHook(() => useLadderKeyboardShortcuts({ onNavigate }));

      act(() => {
        simulateKeyDown('ArrowUp');
      });
      expect(onNavigate).toHaveBeenCalledWith('up');

      act(() => {
        simulateKeyDown('ArrowDown');
      });
      expect(onNavigate).toHaveBeenCalledWith('down');

      act(() => {
        simulateKeyDown('ArrowLeft');
      });
      expect(onNavigate).toHaveBeenCalledWith('left');

      act(() => {
        simulateKeyDown('ArrowRight');
      });
      expect(onNavigate).toHaveBeenCalledWith('right');
    });
  });

  describe('Edit element', () => {
    it('should call onEditElement on Enter with single selection', () => {
      (useLadderStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        selectedElementIds: new Set(['element-1']),
        mode: 'edit',
        removeElement: mockRemoveElement,
        copyToClipboard: mockCopyToClipboard,
        cutSelection: mockCutSelection,
        pasteFromClipboard: mockPasteFromClipboard,
        selectAll: mockSelectAll,
        clearSelection: mockClearSelection,
        undo: mockUndo,
        redo: mockRedo,
        duplicateElement: mockDuplicateElement,
        copyNetwork: mockCopyNetwork,
        pasteNetwork: mockPasteNetwork,
      });

      const onEditElement = vi.fn();
      renderHook(() => useLadderKeyboardShortcuts({ onEditElement }));

      act(() => {
        simulateKeyDown('Enter');
      });

      expect(onEditElement).toHaveBeenCalledWith('element-1');
    });

    it('should not call onEditElement on Enter with multiple selection', () => {
      const onEditElement = vi.fn();
      renderHook(() => useLadderKeyboardShortcuts({ onEditElement }));

      act(() => {
        simulateKeyDown('Enter');
      });

      expect(onEditElement).not.toHaveBeenCalled();
    });
  });

  describe('Disabled state', () => {
    it('should not handle shortcuts when disabled', () => {
      renderHook(() => useLadderKeyboardShortcuts({ enabled: false }));

      act(() => {
        simulateKeyDown('Delete');
        simulateKeyDown('z', { ctrlKey: true });
      });

      expect(mockRemoveElement).not.toHaveBeenCalled();
      expect(mockUndo).not.toHaveBeenCalled();
    });
  });
});
