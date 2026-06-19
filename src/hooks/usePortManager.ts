/**
 * usePortManager — Port CRUD State Management Hook
 *
 * Centralises all Create / Read / Update / Delete operations on ports (pins)
 * within the Symbol Editor. Provides:
 *
 *   - A derived `ports: PortDef[]` array in sync with the current symbol state
 *   - Selection state (multi-select capable)
 *   - Undoable CRUD via the shared HistoryManager
 *   - Multi-unit support (activeUnit routing)
 *   - Validation helpers
 *
 * Usage:
 *
 *   const pm = usePortManager({ symbol, setSymbol, historyManager, activeUnit, onHistoryChange });
 *
 *   pm.ports          // PortDef[] sorted by sortOrder
 *   pm.addPort(def)   // add new port (undoable)
 *   pm.updatePort(id, { name: 'IN' }) // edit port (undoable)
 *   pm.deletePorts([id1, id2])        // delete ports (undoable)
 *   pm.movePort(id, { x, y })         // move port endpoint (undoable)
 *   pm.reorderPorts([id1, id2, ...])  // change sort order (undoable)
 */

import { useCallback, useMemo, useState } from 'react';
import type { SymbolDefinition, SymbolPin } from '../types/symbol';
import type { PortDef, PortValidationResult } from '../types/port';
import {
  createPortDef,
  symbolPinsToPortDefs,
  validatePortDef,
} from '../types/port';
import {
  AddPortCommand,
  RemovePinsCommand,
  UpdatePinCommand,
  MovePinsCommand,
  ReorderPinsCommand,
} from '../components/SymbolEditor/history/commands';
import type { HistoryManager } from '../components/SymbolEditor/history/HistoryManager';

// ============================================================================
// Types
// ============================================================================

export interface UsePortManagerOptions {
  /** Current symbol definition (source of truth for pin data) */
  symbol: SymbolDefinition;
  /**
   * Updater for the symbol state (same signature as React setState functional update).
   * All mutations go through this so the parent component stays in sync.
   */
  setSymbol: (updater: (prev: SymbolDefinition) => SymbolDefinition) => void;
  /** Shared HistoryManager instance for undo/redo support */
  historyManager: HistoryManager;
  /**
   * Active unit index for multi-unit symbols (0-based).
   * `null` means the root symbol level (single-unit mode).
   */
  activeUnit?: number | null;
  /**
   * Called after every history-tracked mutation so the parent can
   * bump any version counter that triggers re-renders (e.g. `bumpHistory`).
   */
  onHistoryChange?: () => void;
}

export interface UsePortManagerReturn {
  // ── Derived data ──────────────────────────────────────────────────────────

  /** All ports in the active unit / root symbol, sorted by sortOrder */
  ports: PortDef[];

  /** Ports that are currently selected */
  selectedPorts: PortDef[];

  /** Set of currently selected port IDs */
  selectedPortIds: Set<string>;

  // ── Selection ─────────────────────────────────────────────────────────────

  /** Replace the selection with the given IDs */
  selectPorts: (ids: string[]) => void;

  /** Clear all port selections */
  deselectAllPorts: () => void;

  /** Toggle selection of a single port (Shift-click style) */
  togglePortSelection: (id: string) => void;

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Add a new port.
   *
   * - Assigns `sortOrder` automatically (appended at end) unless specified.
   * - Converts PortDef → SymbolPin and records an undoable AddPortCommand.
   */
  addPort: (portDef?: Partial<PortDef>) => PortDef;

  /**
   * Update fields of an existing port by ID.
   *
   * - Accepts a partial PortDef (only changed fields needed).
   * - Records an undoable UpdatePinCommand.
   * - Returns the updated PortDef, or `null` if the ID was not found.
   */
  updatePort: (id: string, changes: Partial<Omit<PortDef, 'id'>>) => PortDef | null;

  /**
   * Delete one or more ports by ID.
   *
   * - Clears deleted IDs from selection.
   * - Records an undoable RemovePinsCommand.
   */
  deletePorts: (ids: string[]) => void;

  /** Convenience: delete currently selected ports */
  deleteSelectedPorts: () => void;

  /**
   * Move a port's connection-endpoint position.
   *
   * - Records an undoable MovePinsCommand.
   */
  movePort: (id: string, newPosition: { x: number; y: number }) => void;

  /**
   * Reorder all ports by providing a complete ordered list of IDs.
   *
   * - Sets `sortOrder` to the index in the provided array.
   * - Records an undoable ReorderPinsCommand.
   */
  reorderPorts: (orderedIds: string[]) => void;

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Validate a (partial) PortDef against the current ports in the symbol.
   * Checks required fields, ranges, and uniqueness constraints.
   */
  validatePort: (port: Partial<PortDef>) => PortValidationResult;

  /**
   * Get a single port by ID, or `undefined` if not found.
   */
  getPortById: (id: string) => PortDef | undefined;

  /**
   * Create a new PortDef with defaults pre-filled (does NOT add it to the symbol).
   * Use this to pre-populate an "Add Port" form.
   */
  buildNewPort: (overrides?: Partial<PortDef>) => PortDef;
}

// ============================================================================
// Implementation
// ============================================================================

export function usePortManager({
  symbol,
  setSymbol,
  historyManager,
  activeUnit = null,
  onHistoryChange,
}: UsePortManagerOptions): UsePortManagerReturn {
  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedPortIds, setSelectedPortIds] = useState<Set<string>>(new Set());

  // ── Derived: active pin array ─────────────────────────────────────────────

  /**
   * Resolves the current SymbolPin array from either the root symbol
   * or the active multi-unit entry, then converts to PortDef[].
   */
  const pins: SymbolPin[] = useMemo(() => {
    if (activeUnit !== null && symbol.units) {
      return symbol.units[activeUnit]?.pins ?? [];
    }
    return symbol.pins;
  }, [symbol, activeUnit]);

  const ports: PortDef[] = useMemo(
    () =>
      symbolPinsToPortDefs(pins).sort((a, b) => a.sortOrder - b.sortOrder),
    [pins],
  );

  const selectedPorts: PortDef[] = useMemo(
    () => ports.filter((p) => selectedPortIds.has(p.id)),
    [ports, selectedPortIds],
  );

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Returns the updater function to use for the HistoryManager commands.
   * In multi-unit mode this wraps the root setSymbol to route mutations
   * into the correct unit's pins array.
   */
  const getUpdater = useCallback(
    (): ((fn: (prev: SymbolDefinition) => SymbolDefinition) => void) => {
      if (activeUnit === null) {
        return setSymbol;
      }
      const unitIndex = activeUnit;
      return (fn) => {
        setSymbol((prev) => {
          // fn expects a SymbolDefinition; for multi-unit we need to apply the
          // mutation to a "flattened" view, then push changes back to the unit.
          const units = [...(prev.units ?? [])];
          const unit = units[unitIndex];
          if (!unit) return prev;

          // Build a temporary SymbolDefinition that looks like the unit
          const unitAsSymbol: SymbolDefinition = {
            ...prev,
            graphics: unit.graphics,
            pins: unit.pins,
          };
          const mutated = fn(unitAsSymbol);
          units[unitIndex] = {
            ...unit,
            graphics: mutated.graphics,
            pins: mutated.pins,
          };
          return { ...prev, units, updatedAt: new Date().toISOString() };
        });
      };
    },
    [activeUnit, setSymbol],
  );

  const execAndNotify = useCallback(
    (cmd: Parameters<HistoryManager['execute']>[0]) => {
      historyManager.execute(cmd);
      onHistoryChange?.();
    },
    [historyManager, onHistoryChange],
  );

  // ── Selection ops ─────────────────────────────────────────────────────────

  const selectPorts = useCallback((ids: string[]) => {
    setSelectedPortIds(new Set(ids));
  }, []);

  const deselectAllPorts = useCallback(() => {
    setSelectedPortIds(new Set());
  }, []);

  const togglePortSelection = useCallback((id: string) => {
    setSelectedPortIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ── CRUD ops ──────────────────────────────────────────────────────────────

  const addPort = useCallback(
    (overrides: Partial<PortDef> = {}): PortDef => {
      const nextSortOrder = ports.length > 0
        ? Math.max(...ports.map((p) => p.sortOrder)) + 1
        : 0;

      const newPort = createPortDef({
        sortOrder: nextSortOrder,
        ...overrides,
        // Never allow caller to override id without explicitly setting it
        id: overrides.id ?? crypto.randomUUID(),
      });

      execAndNotify(new AddPortCommand(getUpdater(), newPort));
      return newPort;
    },
    [ports, execAndNotify, getUpdater],
  );

  const updatePort = useCallback(
    (id: string, changes: Partial<Omit<PortDef, 'id'>>): PortDef | null => {
      const existing = ports.find((p) => p.id === id);
      if (!existing) return null;

      execAndNotify(new UpdatePinCommand(getUpdater(), id, changes));

      // Return the optimistic merged value (actual state update is async)
      return { ...existing, ...changes };
    },
    [ports, execAndNotify, getUpdater],
  );

  const deletePorts = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;

      execAndNotify(new RemovePinsCommand(getUpdater(), ids));

      // Remove deleted IDs from selection
      setSelectedPortIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    },
    [execAndNotify, getUpdater],
  );

  const deleteSelectedPorts = useCallback(() => {
    deletePorts(Array.from(selectedPortIds));
  }, [deletePorts, selectedPortIds]);

  const movePort = useCallback(
    (id: string, newPosition: { x: number; y: number }) => {
      execAndNotify(
        new MovePinsCommand(getUpdater(), [{ id, newPosition }]),
      );
    },
    [execAndNotify, getUpdater],
  );

  const reorderPorts = useCallback(
    (orderedIds: string[]) => {
      execAndNotify(new ReorderPinsCommand(getUpdater(), orderedIds));
    },
    [execAndNotify, getUpdater],
  );

  // ── Helpers ───────────────────────────────────────────────────────────────

  const validatePort = useCallback(
    (port: Partial<PortDef>): PortValidationResult => validatePortDef(port, ports),
    [ports],
  );

  const getPortById = useCallback(
    (id: string): PortDef | undefined => ports.find((p) => p.id === id),
    [ports],
  );

  const buildNewPort = useCallback(
    (overrides: Partial<PortDef> = {}): PortDef => {
      const nextSortOrder = ports.length > 0
        ? Math.max(...ports.map((p) => p.sortOrder)) + 1
        : 0;
      return createPortDef({ sortOrder: nextSortOrder, ...overrides });
    },
    [ports],
  );

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    ports,
    selectedPorts,
    selectedPortIds,
    selectPorts,
    deselectAllPorts,
    togglePortSelection,
    addPort,
    updatePort,
    deletePorts,
    deleteSelectedPorts,
    movePort,
    reorderPorts,
    validatePort,
    getPortById,
    buildNewPort,
  };
}

export default usePortManager;
