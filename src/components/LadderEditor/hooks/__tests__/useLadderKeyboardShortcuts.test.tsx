/**
 * useLadderKeyboardShortcuts Hook Tests
 *
 * After migration: mocks useDocumentContext, useLadderUIStore, and useDocumentRegistry.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLadderKeyboardShortcuts } from '../useLadderKeyboardShortcuts';

// --- Shared mock state (mutated per-test) ---

const mockClearSelection = vi.fn();
const mockSelectAll = vi.fn();
const mockSetClipboard = vi.fn();
const mockSetSelection = vi.fn();
const mockClearActiveTool = vi.fn();

let uiStoreState: Record<string, unknown> = {};

vi.mock('../../../../contexts/DocumentContext', () => ({
  useDocumentContext: () => ({ documentId: 'doc-1' }),
}));

vi.mock('../../../../stores/ladderUIStore', () => {
  const store = (selector: (s: Record<string, unknown>) => unknown) => selector(uiStoreState);
  store.getState = () => ({
    ...uiStoreState,
    activeTool: uiStoreState.activeTool ?? null,
    clearSelection: mockClearSelection,
    clearActiveTool: mockClearActiveTool,
    selectAll: mockSelectAll,
    setClipboard: mockSetClipboard,
    setSelection: mockSetSelection,
    clipboard: [],
  });
  return { useLadderUIStore: store };
});

const mockElements = new Map([
  [
    'element-1',
    {
      id: 'element-1',
      type: 'contact_no',
      position: { row: 0, col: 0 },
      address: 'M0001',
      properties: {},
    },
  ],
  [
    'element-2',
    {
      id: 'element-2',
      type: 'coil',
      position: { row: 0, col: 9 },
      address: 'M0010',
      properties: {},
    },
  ],
]);

const mockPushHistory = vi.fn();
const mockUpdateLadderData = vi.fn();
const mockUndo = vi.fn();
const mockRedo = vi.fn();
const mockCanUndo = vi.fn().mockReturnValue(true);
const mockCanRedo = vi.fn().mockReturnValue(true);

vi.mock('../../../../stores/documentRegistry', () => ({
  useDocumentRegistry: {
    getState: () => ({
      getDocument: (id: string) =>
        id === 'doc-1'
          ? {
              id: 'doc-1',
              type: 'ladder' as const,
              data: {
                elements: mockElements,
                wires: [],
                gridConfig: { columns: 12 },
              },
            }
          : null,
      pushHistory: mockPushHistory,
      updateLadderData: mockUpdateLadderData,
      undo: mockUndo,
      redo: mockRedo,
      canUndo: mockCanUndo,
      canRedo: mockCanRedo,
    }),
  },
}));

vi.mock('../../../../types/document', () => ({
  isLadderDocument: (doc: { type: string } | null) => doc?.type === 'ladder',
}));

describe('useLadderKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearActiveTool.mockClear();

    // Default UI store state
    uiStoreState = {
      selectedElementIds: new Set(['element-1', 'element-2']),
      mode: 'edit',
    };
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

      expect(mockPushHistory).toHaveBeenCalledWith('doc-1', 'Delete 2 element(s)');
      expect(mockUpdateLadderData).toHaveBeenCalledWith('doc-1', expect.any(Function));
    });

    it('should remove selected elements on Backspace key', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('Backspace');
      });

      expect(mockUpdateLadderData).toHaveBeenCalledWith('doc-1', expect.any(Function));
    });

    it('should not delete in monitor mode', () => {
      uiStoreState = {
        selectedElementIds: new Set(['element-1']),
        mode: 'monitor',
      };

      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('Delete');
      });

      expect(mockPushHistory).not.toHaveBeenCalled();
      expect(mockUpdateLadderData).not.toHaveBeenCalled();
    });
  });

  describe('Undo/Redo operations', () => {
    it('should undo on Ctrl+Z', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('z', { ctrlKey: true });
      });

      expect(mockUndo).toHaveBeenCalledWith('doc-1');
    });

    it('should redo on Ctrl+Y', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('y', { ctrlKey: true });
      });

      expect(mockRedo).toHaveBeenCalledWith('doc-1');
    });

    it('should redo on Ctrl+Shift+Z', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('z', { ctrlKey: true, shiftKey: true });
      });

      expect(mockRedo).toHaveBeenCalledWith('doc-1');
    });
  });

  describe('Clipboard operations', () => {
    it('should copy on Ctrl+C', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('c', { ctrlKey: true });
      });

      expect(mockSetClipboard).toHaveBeenCalledTimes(1);
    });

    it('should cut on Ctrl+X', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('x', { ctrlKey: true });
      });

      // Cut = copy + delete
      expect(mockSetClipboard).toHaveBeenCalledTimes(1);
      expect(mockUpdateLadderData).toHaveBeenCalled();
    });

    it('should paste on Ctrl+V', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('v', { ctrlKey: true });
      });

      // Clipboard is empty in mock → no-op, but handler runs without error
    });

    it('should not cut in monitor mode', () => {
      uiStoreState = {
        selectedElementIds: new Set(['element-1']),
        mode: 'monitor',
      };

      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('x', { ctrlKey: true });
      });

      expect(mockUpdateLadderData).not.toHaveBeenCalled();
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

    it('should clear selection on Escape when no active tool', () => {
      uiStoreState = {
        selectedElementIds: new Set(['element-1', 'element-2']),
        mode: 'edit',
        activeTool: null,
      };

      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('Escape');
      });

      expect(mockClearSelection).toHaveBeenCalledTimes(1);
      expect(mockClearActiveTool).not.toHaveBeenCalled();
    });

    it('should clear active tool on Escape when tool is active', () => {
      uiStoreState = {
        selectedElementIds: new Set(['element-1', 'element-2']),
        mode: 'edit',
        activeTool: 'contact_no',
      };

      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('Escape');
      });

      expect(mockClearActiveTool).toHaveBeenCalledTimes(1);
      expect(mockClearSelection).not.toHaveBeenCalled();
    });
  });

  describe('Duplicate operation', () => {
    it('should duplicate on Ctrl+D', () => {
      renderHook(() => useLadderKeyboardShortcuts());

      act(() => {
        simulateKeyDown('d', { ctrlKey: true });
      });

      // Each selected element triggers pushHistory + updateLadderData
      expect(mockPushHistory).toHaveBeenCalledTimes(2);
      expect(mockUpdateLadderData).toHaveBeenCalledTimes(2);
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
      uiStoreState = {
        selectedElementIds: new Set(['element-1']),
        mode: 'edit',
      };

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

      expect(mockPushHistory).not.toHaveBeenCalled();
      expect(mockUndo).not.toHaveBeenCalled();
    });
  });
});
