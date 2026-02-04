/**
 * Canvas Keyboard Shortcuts Hook
 *
 * Handles all keyboard shortcuts for the canvas including:
 * - Selection operations (Ctrl+A)
 * - Clipboard operations (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+D)
 * - Edit operations (Delete, Backspace)
 * - History operations (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y)
 * - Canvas settings (G for grid, S for snap)
 */

import { useEffect, useCallback, useRef } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { isPortEndpoint } from '../types';

// ============================================================================
// Types
// ============================================================================

interface ClipboardData {
  type: 'circuit-components';
  components: unknown[];
  wires: unknown[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an element is an input element where shortcuts should be disabled.
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  // Check for contenteditable
  if (target.isContentEditable) {
    return true;
  }

  return false;
}

/**
 * Generate a new unique ID.
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Module-level Clipboard
// ============================================================================

// We use a module-level clipboard since the system clipboard API requires
// user interaction and has security restrictions
let clipboard: ClipboardData | null = null;

// ============================================================================
// Hook
// ============================================================================

interface UseCanvasKeyboardShortcutsOptions {
  /** Whether the canvas is focused/active */
  enabled?: boolean;
  /** Callback when components are deleted */
  onDelete?: () => void;
}

/**
 * Hook for handling canvas keyboard shortcuts.
 *
 * @param options - Configuration options
 */
export function useCanvasKeyboardShortcuts(options: UseCanvasKeyboardShortcutsOptions = {}) {
  const { enabled = true, onDelete } = options;

  // Store refs for latest values
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Get store actions
  const components = useCanvasStore((state) => state.components);
  const wires = useCanvasStore((state) => state.wires);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const selectAll = useCanvasStore((state) => state.selectAll);
  const clearSelection = useCanvasStore((state) => state.clearSelection);
  const removeComponent = useCanvasStore((state) => state.removeComponent);
  const removeWire = useCanvasStore((state) => state.removeWire);
  const addComponent = useCanvasStore((state) => state.addComponent);
  const addWire = useCanvasStore((state) => state.addWire);
  const toggleGrid = useCanvasStore((state) => state.toggleGrid);
  const toggleSnap = useCanvasStore((state) => state.toggleSnap);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const rotateSelectedComponents = useCanvasStore((state) => state.rotateSelectedComponents);

  // Store refs for callbacks
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const componentsRef = useRef(components);
  componentsRef.current = components;
  const wiresRef = useRef(wires);
  wiresRef.current = wires;

  // Delete selected items
  const deleteSelected = useCallback(() => {
    const ids = selectedIdsRef.current;
    if (ids.size === 0) return;

    ids.forEach((id) => {
      if (componentsRef.current.has(id)) {
        removeComponent(id);
      } else if (wiresRef.current.some((w) => w.id === id)) {
        removeWire(id);
      }
    });

    clearSelection();
    onDelete?.();
  }, [removeComponent, removeWire, clearSelection, onDelete]);

  // Rotate selected components
  const rotateSelected = useCallback(() => {
    const ids = selectedIdsRef.current;
    if (ids.size === 0) return;

    // Only rotate components (not wires)
    const hasComponents = Array.from(ids).some((id) =>
      componentsRef.current.has(id)
    );

    if (hasComponents) {
      rotateSelectedComponents(90);
    }
  }, [rotateSelectedComponents]);

  // Copy selected components to clipboard
  const copySelected = useCallback(() => {
    const ids = selectedIdsRef.current;
    if (ids.size === 0) return;

    const selectedComponents: unknown[] = [];
    const selectedWires: unknown[] = [];
    const componentIds = new Set<string>();

    // Collect selected components
    ids.forEach((id) => {
      const component = componentsRef.current.get(id);
      if (component) {
        selectedComponents.push({ ...component });
        componentIds.add(id);
      }
    });

    // Collect wires between selected components
    wiresRef.current.forEach((wire) => {
      const fromInSelection = isPortEndpoint(wire.from) && componentIds.has(wire.from.componentId);
      const toInSelection = isPortEndpoint(wire.to) && componentIds.has(wire.to.componentId);
      if (fromInSelection && toInSelection) {
        selectedWires.push({ ...wire });
      }
    });

    clipboard = {
      type: 'circuit-components',
      components: selectedComponents,
      wires: selectedWires,
    };
  }, []);

  // Paste from clipboard
  const paste = useCallback(() => {
    if (!clipboard || clipboard.type !== 'circuit-components') return;

    const PASTE_OFFSET = 20; // Offset to avoid exact overlap
    const idMap = new Map<string, string>();

    // Paste components with new IDs
    clipboard.components.forEach((comp: unknown) => {
      const c = comp as {
        id: string;
        type: string;
        position: { x: number; y: number };
        [key: string]: unknown;
      };
      const newId = generateId(c.type);
      idMap.set(c.id, newId);

      // Add component with offset position
      const { id: _oldId, position, ...rest } = c;
      addComponent(c.type as Parameters<typeof addComponent>[0], {
        x: position.x + PASTE_OFFSET,
        y: position.y + PASTE_OFFSET,
      }, {
        ...rest,
      } as Parameters<typeof addComponent>[2]);
    });

    // Paste wires with remapped IDs
    clipboard.wires.forEach((wire: unknown) => {
      const w = wire as {
        from: { componentId: string; portId: string };
        to: { componentId: string; portId: string };
      };
      const newFromId = idMap.get(w.from.componentId);
      const newToId = idMap.get(w.to.componentId);

      if (newFromId && newToId) {
        addWire(
          { componentId: newFromId, portId: w.from.portId },
          { componentId: newToId, portId: w.to.portId }
        );
      }
    });
  }, [addComponent, addWire]);

  // Cut = Copy + Delete
  const cutSelected = useCallback(() => {
    copySelected();
    deleteSelected();
  }, [copySelected, deleteSelected]);

  // Duplicate = Copy + Paste immediately
  const duplicateSelected = useCallback(() => {
    copySelected();
    paste();
  }, [copySelected, paste]);

  // Keyboard event handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if disabled or in input element
      if (!enabledRef.current || isInputElement(e.target)) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();

      switch (key) {
        // Delete selected
        case 'delete':
        case 'backspace':
          e.preventDefault();
          deleteSelected();
          break;

        // Select all
        case 'a':
          if (ctrl) {
            e.preventDefault();
            selectAll();
          }
          break;

        // Copy
        case 'c':
          if (ctrl) {
            e.preventDefault();
            copySelected();
          }
          break;

        // Paste
        case 'v':
          if (ctrl) {
            e.preventDefault();
            paste();
          }
          break;

        // Cut
        case 'x':
          if (ctrl) {
            e.preventDefault();
            cutSelected();
          }
          break;

        // Duplicate
        case 'd':
          if (ctrl) {
            e.preventDefault();
            duplicateSelected();
          }
          break;

        // Undo
        case 'z':
          if (ctrl) {
            e.preventDefault();
            if (shift) {
              redo();
            } else {
              undo();
            }
          }
          break;

        // Redo (alternate)
        case 'y':
          if (ctrl) {
            e.preventDefault();
            redo();
          }
          break;

        // Toggle grid visibility
        case 'g':
          if (!ctrl && !shift) {
            e.preventDefault();
            toggleGrid();
          }
          break;

        // Toggle snap to grid
        case 's':
          if (!ctrl && !shift) {
            e.preventDefault();
            toggleSnap();
          }
          break;

        // Rotate selected blocks
        case 'r':
          if (!ctrl && !shift) {
            e.preventDefault();
            rotateSelected();
          }
          break;

        // Escape - clear selection
        case 'escape':
          e.preventDefault();
          clearSelection();
          break;
      }
    },
    [
      deleteSelected,
      selectAll,
      copySelected,
      paste,
      cutSelected,
      duplicateSelected,
      undo,
      redo,
      toggleGrid,
      toggleSnap,
      rotateSelected,
      clearSelection,
    ]
  );

  // Register event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Return utilities for external use
  return {
    copySelected,
    paste,
    cutSelected,
    duplicateSelected,
    deleteSelected,
    hasClipboard: () => clipboard !== null,
  };
}

export default useCanvasKeyboardShortcuts;
