/**
 * Comprehensive tests for ladderStore undo/redo system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useLadderStore, selectCanUndo, selectCanRedo, useCanUndo, useCanRedo } from '../ladderStore';
import { act, renderHook } from '@testing-library/react';

describe('ladderStore undo/redo', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useLadderStore.getState().reset();
  });

  describe('Basic Operations', () => {
    it('should not be able to undo with empty history', () => {
      const state = useLadderStore.getState();
      expect(selectCanUndo(state)).toBe(false);
    });

    it('should be able to undo after adding a network', () => {
      const { addNetwork } = useLadderStore.getState();
      addNetwork('Test Network');

      const state = useLadderStore.getState();
      expect(selectCanUndo(state)).toBe(true);
    });

    it('should undo addNetwork correctly', () => {
      const { addNetwork, undo } = useLadderStore.getState();

      // Initial state: no networks
      expect(useLadderStore.getState().networks.size).toBe(0);

      // Add a network
      addNetwork('Test Network');
      expect(useLadderStore.getState().networks.size).toBe(1);

      // Undo
      undo();
      expect(useLadderStore.getState().networks.size).toBe(0);
    });

    it('should redo after undo correctly', () => {
      const { addNetwork, undo, redo } = useLadderStore.getState();

      addNetwork('Test Network');
      expect(useLadderStore.getState().networks.size).toBe(1);

      undo();
      expect(useLadderStore.getState().networks.size).toBe(0);

      redo();
      expect(useLadderStore.getState().networks.size).toBe(1);
    });

    it('should handle multiple undo/redo cycles', () => {
      const { addNetwork, undo, redo } = useLadderStore.getState();

      addNetwork('Network 1');
      addNetwork('Network 2');
      expect(useLadderStore.getState().networks.size).toBe(2);

      // Undo twice
      undo();
      expect(useLadderStore.getState().networks.size).toBe(1);
      undo();
      expect(useLadderStore.getState().networks.size).toBe(0);

      // Redo twice
      redo();
      expect(useLadderStore.getState().networks.size).toBe(1);
      redo();
      expect(useLadderStore.getState().networks.size).toBe(2);
    });
  });

  describe('Boundary Cases', () => {
    it('should not crash when undoing with empty history', () => {
      const { undo } = useLadderStore.getState();
      expect(() => undo()).not.toThrow();
    });

    it('should not crash when redoing at most recent state', () => {
      const { addNetwork, redo } = useLadderStore.getState();
      addNetwork('Test');
      expect(() => redo()).not.toThrow();
    });

    it('should report canUndo/canRedo correctly at boundaries', () => {
      const { addNetwork, undo, redo } = useLadderStore.getState();

      // Empty history
      expect(selectCanUndo(useLadderStore.getState())).toBe(false);
      expect(selectCanRedo(useLadderStore.getState())).toBe(false);

      // After adding
      addNetwork('Test');
      expect(selectCanUndo(useLadderStore.getState())).toBe(true);
      expect(selectCanRedo(useLadderStore.getState())).toBe(false);

      // After undo
      undo();
      expect(selectCanUndo(useLadderStore.getState())).toBe(false);
      expect(selectCanRedo(useLadderStore.getState())).toBe(true);

      // After redo
      redo();
      expect(selectCanUndo(useLadderStore.getState())).toBe(true);
      expect(selectCanRedo(useLadderStore.getState())).toBe(false);
    });
  });

  describe('History Stack Management', () => {
    it('should clear redo stack when new action is performed', () => {
      const { addNetwork, undo } = useLadderStore.getState();

      addNetwork('Network 1');
      addNetwork('Network 2');

      // Undo to create redo history
      undo();
      expect(selectCanRedo(useLadderStore.getState())).toBe(true);

      // New action should clear redo history
      addNetwork('Network 3');
      expect(selectCanRedo(useLadderStore.getState())).toBe(false);
    });

    it('should enforce MAX_HISTORY_SIZE limit', () => {
      const { addNetwork } = useLadderStore.getState();
      const MAX_HISTORY_SIZE = 50;

      // Add more than MAX_HISTORY_SIZE actions
      for (let i = 0; i < MAX_HISTORY_SIZE + 10; i++) {
        addNetwork(`Network ${i}`);
      }

      // History should be capped
      const state = useLadderStore.getState();
      expect(state.history.length).toBeLessThanOrEqual(MAX_HISTORY_SIZE + 1);
    });

    it('should maintain correct historyIndex when history is trimmed', () => {
      const { addNetwork, undo } = useLadderStore.getState();
      const MAX_HISTORY_SIZE = 50;

      // Add exactly MAX_HISTORY_SIZE actions
      for (let i = 0; i < MAX_HISTORY_SIZE; i++) {
        addNetwork(`Network ${i}`);
      }

      // Add one more to trigger trim
      addNetwork('Extra Network');

      // Should still be able to undo
      expect(selectCanUndo(useLadderStore.getState())).toBe(true);
      undo();
      expect(useLadderStore.getState().networks.size).toBe(MAX_HISTORY_SIZE);
    });
  });

  describe('All Modifying Actions Push History', () => {
    it('addNetwork pushes history', () => {
      const { addNetwork } = useLadderStore.getState();
      const initialHistoryLength = useLadderStore.getState().history.length;

      addNetwork('Test');
      expect(useLadderStore.getState().history.length).toBeGreaterThan(initialHistoryLength);
    });

    it('removeNetwork pushes history', () => {
      const { addNetwork, removeNetwork } = useLadderStore.getState();
      addNetwork('Network 1');
      const networkId = addNetwork('Network 2');
      const historyLengthBefore = useLadderStore.getState().history.length;

      removeNetwork(networkId);
      expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
    });

    it('updateNetwork pushes history', () => {
      const { addNetwork, updateNetwork } = useLadderStore.getState();
      const networkId = addNetwork('Test');
      const historyLengthBefore = useLadderStore.getState().history.length;

      updateNetwork(networkId, { label: 'Updated' });
      expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
    });

    it('reorderNetworks pushes history', () => {
      const { addNetwork, reorderNetworks } = useLadderStore.getState();
      addNetwork('Network 1');
      addNetwork('Network 2');
      const historyLengthBefore = useLadderStore.getState().history.length;

      reorderNetworks(0, 1);
      expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
    });

    it('addElement pushes history', () => {
      const { addNetwork, addElement } = useLadderStore.getState();
      addNetwork('Test');
      const historyLengthBefore = useLadderStore.getState().history.length;

      addElement('contact_no', { row: 0, col: 0 });
      expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
    });

    it('removeElement pushes history', () => {
      const { addNetwork, addElement, removeElement } = useLadderStore.getState();
      addNetwork('Test');
      const elementId = addElement('contact_no', { row: 0, col: 0 });
      const historyLengthBefore = useLadderStore.getState().history.length;

      if (elementId) {
        removeElement(elementId);
        expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
      }
    });

    it('moveElement pushes history', () => {
      const { addNetwork, addElement, moveElement } = useLadderStore.getState();
      addNetwork('Test');
      const elementId = addElement('contact_no', { row: 0, col: 0 });
      const historyLengthBefore = useLadderStore.getState().history.length;

      if (elementId) {
        moveElement(elementId, { row: 1, col: 0 });
        expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
      }
    });

    it('updateElement pushes history', () => {
      const { addNetwork, addElement, updateElement } = useLadderStore.getState();
      addNetwork('Test');
      const elementId = addElement('contact_no', { row: 0, col: 0 });
      const historyLengthBefore = useLadderStore.getState().history.length;

      if (elementId) {
        updateElement(elementId, { label: 'Updated' });
        expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
      }
    });

    it('cutSelection pushes history', () => {
      const { addNetwork, addElement, setSelection, cutSelection } = useLadderStore.getState();
      addNetwork('Test');
      const elementId = addElement('contact_no', { row: 0, col: 0 });
      if (elementId) {
        setSelection([elementId]);
      }
      const historyLengthBefore = useLadderStore.getState().history.length;

      cutSelection();
      expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
    });

    it('pasteFromClipboard pushes history', () => {
      const { addNetwork, addElement, setSelection, copyToClipboard, pasteFromClipboard } = useLadderStore.getState();
      addNetwork('Test');
      const elementId = addElement('contact_no', { row: 0, col: 0 });
      if (elementId) {
        setSelection([elementId]);
        copyToClipboard();
      }
      const historyLengthBefore = useLadderStore.getState().history.length;

      pasteFromClipboard({ row: 2, col: 0 });
      expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
    });

    it('clearAll pushes history', () => {
      const { addNetwork, clearAll } = useLadderStore.getState();
      addNetwork('Test');
      const historyLengthBefore = useLadderStore.getState().history.length;

      clearAll();
      expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
    });
  });

  describe('State Restoration', () => {
    it('should correctly restore networks Map after undo', () => {
      const { addNetwork, undo } = useLadderStore.getState();

      const networkId = addNetwork('Test Network');
      const networkBefore = useLadderStore.getState().networks.get(networkId);
      expect(networkBefore).toBeDefined();

      undo();
      const networkAfter = useLadderStore.getState().networks.get(networkId);
      expect(networkAfter).toBeUndefined();
    });

    it('should correctly restore currentNetworkId after undo', () => {
      const { addNetwork, undo } = useLadderStore.getState();

      addNetwork('Test');
      expect(useLadderStore.getState().currentNetworkId).not.toBeNull();

      undo();
      expect(useLadderStore.getState().currentNetworkId).toBeNull();
    });

    it('should clear selection on undo', () => {
      const { addNetwork, addElement, setSelection, undo } = useLadderStore.getState();

      addNetwork('Test');
      const elementId = addElement('contact_no', { row: 0, col: 0 });
      if (elementId) {
        setSelection([elementId]);
        expect(useLadderStore.getState().selectedElementIds.size).toBe(1);
      }

      undo();
      expect(useLadderStore.getState().selectedElementIds.size).toBe(0);
    });

    it('should clear selection on redo', () => {
      const { addNetwork, addElement, setSelection, undo, redo } = useLadderStore.getState();

      addNetwork('Test');
      const elementId = addElement('contact_no', { row: 0, col: 0 });
      if (elementId) {
        setSelection([elementId]);
      }

      undo();
      redo();
      expect(useLadderStore.getState().selectedElementIds.size).toBe(0);
    });
  });

  describe('Custom Hooks', () => {
    it('useCanUndo returns correct value', () => {
      const { addNetwork, undo } = useLadderStore.getState();

      // Initial state
      const { result } = renderHook(() => useCanUndo());
      expect(result.current).toBe(false);

      // After adding
      act(() => {
        addNetwork('Test');
      });
      expect(result.current).toBe(true);

      // After undo
      act(() => {
        undo();
      });
      expect(result.current).toBe(false);
    });

    it('useCanRedo returns correct value', () => {
      const { addNetwork, undo, redo } = useLadderStore.getState();

      // Initial state
      const { result } = renderHook(() => useCanRedo());
      expect(result.current).toBe(false);

      // After adding
      act(() => {
        addNetwork('Test');
      });
      expect(result.current).toBe(false);

      // After undo
      act(() => {
        undo();
      });
      expect(result.current).toBe(true);

      // After redo
      act(() => {
        redo();
      });
      expect(result.current).toBe(false);
    });
  });
});
