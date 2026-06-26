// ============================================================================
// Selection Types
// ============================================================================

/** Type of selectable items on canvas */
export type SelectableType = 'block' | 'wire' | 'junction';

/** A selected item with its type */
export interface Selection {
  type: SelectableType;
  id: string;
}

/** Typed selection state (plain object, works with Zustand immer) */
export interface SelectionState {
  /** Map of selected items by ID */
  items: Map<string, Selection>;
}

/** Create a new empty selection state */
export function createSelectionState(selections: Selection[] = []): SelectionState {
  return {
    items: new Map(selections.map(s => [s.id, s])),
  };
}

/** Get all selected block IDs */
export function getSelectedBlocks(state: SelectionState): string[] {
  return Array.from(state.items.values())
    .filter(s => s.type === 'block')
    .map(s => s.id);
}

/** Get all selected wire IDs */
export function getSelectedWires(state: SelectionState): string[] {
  return Array.from(state.items.values())
    .filter(s => s.type === 'wire')
    .map(s => s.id);
}

/** Get all selected junction IDs */
export function getSelectedJunctions(state: SelectionState): string[] {
  return Array.from(state.items.values())
    .filter(s => s.type === 'junction')
    .map(s => s.id);
}

/** Get all selected items */
export function getAllSelections(state: SelectionState): Selection[] {
  return Array.from(state.items.values());
}

/** Get all selected IDs (regardless of type) */
export function getAllSelectedIds(state: SelectionState): string[] {
  return Array.from(state.items.keys());
}

/** Check if an item is selected */
export function isSelected(state: SelectionState, id: string): boolean {
  return state.items.has(id);
}

/** Check if selection is empty */
export function isSelectionEmpty(state: SelectionState): boolean {
  return state.items.size === 0;
}

/** Get number of selected items */
export function getSelectionSize(state: SelectionState): number {
  return state.items.size;
}

/** Add an item to selection (immutable) */
export function addToSelectionState(state: SelectionState, selection: Selection): SelectionState {
  const newItems = new Map(state.items);
  newItems.set(selection.id, selection);
  return { items: newItems };
}

/** Remove an item from selection (immutable) */
export function removeFromSelectionState(state: SelectionState, id: string): SelectionState {
  const newItems = new Map(state.items);
  newItems.delete(id);
  return { items: newItems };
}

/** Toggle an item in selection (immutable) */
export function toggleInSelectionState(state: SelectionState, selection: Selection): SelectionState {
  if (isSelected(state, selection.id)) {
    return removeFromSelectionState(state, selection.id);
  } else {
    return addToSelectionState(state, selection);
  }
}

/** Clear all selections (immutable) */
export function clearSelectionState(): SelectionState {
  return { items: new Map() };
}

/** Convert selection state to plain array for serialization */
export function selectionStateToArray(state: SelectionState): Selection[] {
  return getAllSelections(state);
}

