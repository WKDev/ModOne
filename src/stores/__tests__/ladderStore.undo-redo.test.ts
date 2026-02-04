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

    it('should be able to undo after adding an element', () => {
      const { addElement } = useLadderStore.getState();
      addElement('contact_no', { row: 0, col: 0 });

      const state = useLadderStore.getState();
      expect(selectCanUndo(state)).toBe(true);
    });

    it('should undo addElement correctly', () => {
      const { addElement, undo } = useLadderStore.getState();

      // Initial state: no elements
      expect(useLadderStore.getState().elements.size).toBe(0);

      // Add an element
      addElement('contact_no', { row: 0, col: 0 });
      expect(useLadderStore.getState().elements.size).toBe(1);

      // Undo
      undo();
      expect(useLadderStore.getState().elements.size).toBe(0);
    });

    it('should redo after undo correctly', () => {
      const { addElement, undo, redo } = useLadderStore.getState();

      addElement('contact_no', { row: 0, col: 0 });
      expect(useLadderStore.getState().elements.size).toBe(1);

      undo();
      expect(useLadderStore.getState().elements.size).toBe(0);

      redo();
      expect(useLadderStore.getState().elements.size).toBe(1);
    });

    it('should handle multiple undo/redo cycles', () => {
      const { addElement, undo, redo } = useLadderStore.getState();

      addElement('contact_no', { row: 0, col: 0 });
      addElement('contact_no', { row: 1, col: 0 });
      expect(useLadderStore.getState().elements.size).toBe(2);

      // Undo twice
      undo();
      expect(useLadderStore.getState().elements.size).toBe(1);
      undo();
      expect(useLadderStore.getState().elements.size).toBe(0);

      // Redo twice
      redo();
      expect(useLadderStore.getState().elements.size).toBe(1);
      redo();
      expect(useLadderStore.getState().elements.size).toBe(2);
    });
  });

  describe('Boundary Cases', () => {
    it('should not crash when undoing with empty history', () => {
      const { undo } = useLadderStore.getState();
      expect(() => undo()).not.toThrow();
    });

    it('should not crash when redoing at most recent state', () => {
      const { addElement, redo } = useLadderStore.getState();
      addElement('contact_no', { row: 0, col: 0 });
      expect(() => redo()).not.toThrow();
    });

    it('should report canUndo/canRedo correctly at boundaries', () => {
      const { addElement, undo, redo } = useLadderStore.getState();

      // Empty history
      expect(selectCanUndo(useLadderStore.getState())).toBe(false);
      expect(selectCanRedo(useLadderStore.getState())).toBe(false);

      // After adding
      addElement('contact_no', { row: 0, col: 0 });
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
      const { addElement, undo } = useLadderStore.getState();

      addElement('contact_no', { row: 0, col: 0 });
      addElement('contact_no', { row: 1, col: 0 });

      // Undo to create redo history
      undo();
      expect(selectCanRedo(useLadderStore.getState())).toBe(true);

      // New action should clear redo history
      addElement('contact_no', { row: 2, col: 0 });
      expect(selectCanRedo(useLadderStore.getState())).toBe(false);
    });

    it('should enforce MAX_HISTORY_SIZE limit', () => {
      const { addElement } = useLadderStore.getState();
      const MAX_HISTORY_SIZE = 50;

      // Add more than MAX_HISTORY_SIZE actions (each at different position)
      for (let i = 0; i < MAX_HISTORY_SIZE + 10; i++) {
        addElement('contact_no', { row: i, col: 0 });
      }

      // History should be capped
      const state = useLadderStore.getState();
      expect(state.history.length).toBeLessThanOrEqual(MAX_HISTORY_SIZE + 1);
    });

    it('should maintain correct historyIndex when history is trimmed', () => {
      const { addElement, undo } = useLadderStore.getState();
      const MAX_HISTORY_SIZE = 50;

      // Add exactly MAX_HISTORY_SIZE actions
      for (let i = 0; i < MAX_HISTORY_SIZE; i++) {
        addElement('contact_no', { row: i, col: 0 });
      }

      // Add one more to trigger trim
      addElement('contact_no', { row: MAX_HISTORY_SIZE, col: 0 });

      // Should still be able to undo
      expect(selectCanUndo(useLadderStore.getState())).toBe(true);
      undo();
      expect(useLadderStore.getState().elements.size).toBe(MAX_HISTORY_SIZE);
    });
  });

  describe('All Modifying Actions Push History', () => {
    it('addElement pushes history', () => {
      const { addElement } = useLadderStore.getState();
      const initialHistoryLength = useLadderStore.getState().history.length;

      addElement('contact_no', { row: 0, col: 0 });
      expect(useLadderStore.getState().history.length).toBeGreaterThan(initialHistoryLength);
    });

    it('removeElement pushes history', () => {
      const { addElement, removeElement } = useLadderStore.getState();
      const elementId = addElement('contact_no', { row: 0, col: 0 });
      const historyLengthBefore = useLadderStore.getState().history.length;

      if (elementId) {
        removeElement(elementId);
        expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
      }
    });

    it('moveElement pushes history', () => {
      const { addElement, moveElement } = useLadderStore.getState();
      const elementId = addElement('contact_no', { row: 0, col: 0 });
      const historyLengthBefore = useLadderStore.getState().history.length;

      if (elementId) {
        moveElement(elementId, { row: 1, col: 0 });
        expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
      }
    });

    it('updateElement pushes history', () => {
      const { addElement, updateElement } = useLadderStore.getState();
      const elementId = addElement('contact_no', { row: 0, col: 0 });
      const historyLengthBefore = useLadderStore.getState().history.length;

      if (elementId) {
        updateElement(elementId, { label: 'Updated' });
        expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
      }
    });

    it('cutSelection pushes history', () => {
      const { addElement, setSelection, cutSelection } = useLadderStore.getState();
      const elementId = addElement('contact_no', { row: 0, col: 0 });
      if (elementId) {
        setSelection([elementId]);
      }
      const historyLengthBefore = useLadderStore.getState().history.length;

      cutSelection();
      expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
    });

    it('pasteFromClipboard pushes history', () => {
      const { addElement, setSelection, copyToClipboard, pasteFromClipboard } = useLadderStore.getState();
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
      const { addElement, clearAll } = useLadderStore.getState();
      addElement('contact_no', { row: 0, col: 0 });
      const historyLengthBefore = useLadderStore.getState().history.length;

      clearAll();
      expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
    });

    it('updateComment pushes history', () => {
      const { updateComment } = useLadderStore.getState();
      const historyLengthBefore = useLadderStore.getState().history.length;

      updateComment('Test comment');
      expect(useLadderStore.getState().history.length).toBeGreaterThan(historyLengthBefore);
    });
  });

  describe('State Restoration', () => {
    it('should correctly restore elements Map after undo', () => {
      const { addElement, undo } = useLadderStore.getState();

      const elementId = addElement('contact_no', { row: 0, col: 0 });
      expect(useLadderStore.getState().elements.get(elementId!)).toBeDefined();

      undo();
      expect(useLadderStore.getState().elements.get(elementId!)).toBeUndefined();
    });

    it('should clear selection on undo', () => {
      const { addElement, setSelection, undo } = useLadderStore.getState();

      const elementId = addElement('contact_no', { row: 0, col: 0 });
      if (elementId) {
        setSelection([elementId]);
        expect(useLadderStore.getState().selectedElementIds.size).toBe(1);
      }

      undo();
      expect(useLadderStore.getState().selectedElementIds.size).toBe(0);
    });

    it('should clear selection on redo', () => {
      const { addElement, setSelection, undo, redo } = useLadderStore.getState();

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
      const { addElement, undo } = useLadderStore.getState();

      // Initial state
      const { result } = renderHook(() => useCanUndo());
      expect(result.current).toBe(false);

      // After adding
      act(() => {
        addElement('contact_no', { row: 0, col: 0 });
      });
      expect(result.current).toBe(true);

      // After undo
      act(() => {
        undo();
      });
      expect(result.current).toBe(false);
    });

    it('useCanRedo returns correct value', () => {
      const { addElement, undo, redo } = useLadderStore.getState();

      // Initial state
      const { result } = renderHook(() => useCanRedo());
      expect(result.current).toBe(false);

      // After adding
      act(() => {
        addElement('contact_no', { row: 0, col: 0 });
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
