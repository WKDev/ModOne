/**
 * Visual State Tab Management — State Management Unit Tests
 *
 * Sub-AC 2a: 상태 탭 클릭 시 활성 상태(active state)를 업데이트하는
 *            상태 관리 로직 구현 (탭 선택 이벤트 → 에디터 상태 변경)
 *
 * Tests verify:
 *  1. editorReducer correctly handles SET_VISUAL_STATE actions
 *  2. State transitions: null→string, string→null, string→string
 *  3. SET_VISUAL_STATE does not mutate unrelated state fields
 *  4. Initial state has activeVisualState = null (base view)
 *  5. Free-form string state names are accepted (not limited to predefined 11)
 *  6. handleAddVisualState / handleRemoveVisualState activation logic
 */
import { describe, expect, it } from 'vitest';
import {
  editorReducer,
  INITIAL_EDITOR_STATE,
  type EditorState,
  type EditorAction,
} from '../components/SymbolEditor/SymbolEditor';

// ============================================================================
// Helpers
// ============================================================================

/** Dispatch a single action and return the new state */
function dispatch(state: EditorState, action: EditorAction): EditorState {
  return editorReducer(state, action);
}

// ============================================================================
// 1. Initial state
// ============================================================================

describe('editorReducer — initial state', () => {
  it('starts with activeVisualState = null (base view)', () => {
    expect(INITIAL_EDITOR_STATE.activeVisualState).toBeNull();
  });

  it('has correct default tool and zoom', () => {
    expect(INITIAL_EDITOR_STATE.currentTool).toBe('select');
    expect(INITIAL_EDITOR_STATE.zoom).toBe(1);
    expect(INITIAL_EDITOR_STATE.isDirty).toBe(false);
  });
});

// ============================================================================
// 2. SET_VISUAL_STATE — null → named state (tab click: Base → State)
// ============================================================================

describe('editorReducer — SET_VISUAL_STATE', () => {
  it('transitions from null to a named visual state', () => {
    const next = dispatch(INITIAL_EDITOR_STATE, {
      type: 'SET_VISUAL_STATE',
      state: 'energized',
    });
    expect(next.activeVisualState).toBe('energized');
  });

  it('transitions from a named state back to null (Base tab click)', () => {
    const withState = dispatch(INITIAL_EDITOR_STATE, {
      type: 'SET_VISUAL_STATE',
      state: 'running',
    });
    expect(withState.activeVisualState).toBe('running');

    const backToBase = dispatch(withState, {
      type: 'SET_VISUAL_STATE',
      state: null,
    });
    expect(backToBase.activeVisualState).toBeNull();
  });

  it('transitions between two different named states', () => {
    const stateA = dispatch(INITIAL_EDITOR_STATE, {
      type: 'SET_VISUAL_STATE',
      state: 'open',
    });
    expect(stateA.activeVisualState).toBe('open');

    const stateB = dispatch(stateA, {
      type: 'SET_VISUAL_STATE',
      state: 'closed',
    });
    expect(stateB.activeVisualState).toBe('closed');
  });

  it('setting the same state name again is idempotent', () => {
    const stateA = dispatch(INITIAL_EDITOR_STATE, {
      type: 'SET_VISUAL_STATE',
      state: 'pressed',
    });
    const stateB = dispatch(stateA, {
      type: 'SET_VISUAL_STATE',
      state: 'pressed',
    });
    expect(stateB.activeVisualState).toBe('pressed');
  });

  it('accepts free-form state names (not limited to predefined 11 values)', () => {
    const freeFormNames = [
      'fault',
      'tripped',
      'detecting',
      'my_custom_state',
      'STATE_WITH_CAPS',
      'state-with-dashes',
      '12345',
    ];

    for (const name of freeFormNames) {
      const next = dispatch(INITIAL_EDITOR_STATE, {
        type: 'SET_VISUAL_STATE',
        state: name,
      });
      expect(next.activeVisualState).toBe(name);
    }
  });
});

// ============================================================================
// 3. Isolation — unrelated state fields must not be mutated
// ============================================================================

describe('editorReducer — field isolation during SET_VISUAL_STATE', () => {
  it('does not change currentTool', () => {
    const withTool = dispatch(INITIAL_EDITOR_STATE, { type: 'SET_TOOL', tool: 'rect' });
    const next = dispatch(withTool, { type: 'SET_VISUAL_STATE', state: 'energized' });
    expect(next.currentTool).toBe('rect');
  });

  it('does not change zoom', () => {
    const withZoom = dispatch(INITIAL_EDITOR_STATE, { type: 'SET_ZOOM', zoom: 2.5 });
    const next = dispatch(withZoom, { type: 'SET_VISUAL_STATE', state: 'running' });
    expect(next.zoom).toBe(2.5);
  });

  it('does not change isDirty', () => {
    const dirty = dispatch(INITIAL_EDITOR_STATE, { type: 'MARK_DIRTY' });
    expect(dirty.isDirty).toBe(true);
    const next = dispatch(dirty, { type: 'SET_VISUAL_STATE', state: 'stopped' });
    expect(next.isDirty).toBe(true);
  });

  it('does not change pan', () => {
    const withPan = dispatch(INITIAL_EDITOR_STATE, { type: 'SET_PAN', pan: { x: 100, y: 200 } });
    const next = dispatch(withPan, { type: 'SET_VISUAL_STATE', state: 'active' });
    expect(next.pan).toEqual({ x: 100, y: 200 });
  });

  it('does not change selectedIds', () => {
    const withSel = dispatch(INITIAL_EDITOR_STATE, { type: 'SELECT', ids: ['g-0', 'g-1'] });
    expect(withSel.selectedIds.size).toBe(2);
    const next = dispatch(withSel, { type: 'SET_VISUAL_STATE', state: 'lit' });
    expect(next.selectedIds.size).toBe(2);
  });

  it('returns a new object reference (immutability)', () => {
    const next = dispatch(INITIAL_EDITOR_STATE, {
      type: 'SET_VISUAL_STATE',
      state: 'energized',
    });
    expect(next).not.toBe(INITIAL_EDITOR_STATE);
  });
});

// ============================================================================
// 4. Tab click simulation — sequential dispatch chain
// ============================================================================

describe('visual state tab click sequence', () => {
  /**
   * Simulates the user clicking tabs in this order:
   *   Base → energized → running → Base → closed
   * and verifies activeVisualState updates accordingly.
   */
  it('handles a full tab-click sequence correctly', () => {
    let state = INITIAL_EDITOR_STATE;

    // Initial: Base is active
    expect(state.activeVisualState).toBeNull();

    // Click "energized" tab
    state = dispatch(state, { type: 'SET_VISUAL_STATE', state: 'energized' });
    expect(state.activeVisualState).toBe('energized');

    // Click "running" tab
    state = dispatch(state, { type: 'SET_VISUAL_STATE', state: 'running' });
    expect(state.activeVisualState).toBe('running');

    // Click "Base" tab (null)
    state = dispatch(state, { type: 'SET_VISUAL_STATE', state: null });
    expect(state.activeVisualState).toBeNull();

    // Click "closed" tab
    state = dispatch(state, { type: 'SET_VISUAL_STATE', state: 'closed' });
    expect(state.activeVisualState).toBe('closed');
  });

  it('handles "remove active state" pattern — switches back to Base', () => {
    let state = dispatch(INITIAL_EDITOR_STATE, {
      type: 'SET_VISUAL_STATE',
      state: 'energized',
    });
    expect(state.activeVisualState).toBe('energized');

    // Simulates handleRemoveVisualState: after deletion, always switch to base
    state = dispatch(state, { type: 'SET_VISUAL_STATE', state: null });
    expect(state.activeVisualState).toBeNull();
  });

  it('handles "add new state" pattern — switches to the new state', () => {
    let state = INITIAL_EDITOR_STATE;

    // Simulates handleAddVisualState dispatching SET_VISUAL_STATE with new name
    state = dispatch(state, { type: 'SET_VISUAL_STATE', state: 'custom_new_state' });
    expect(state.activeVisualState).toBe('custom_new_state');
  });
});

// ============================================================================
// 5. Other actions do not reset activeVisualState
// ============================================================================

describe('editorReducer — activeVisualState persistence across other actions', () => {
  it('SET_TOOL does not reset activeVisualState', () => {
    let state = dispatch(INITIAL_EDITOR_STATE, { type: 'SET_VISUAL_STATE', state: 'lit' });
    state = dispatch(state, { type: 'SET_TOOL', tool: 'circle' });
    expect(state.activeVisualState).toBe('lit');
  });

  it('MARK_DIRTY does not reset activeVisualState', () => {
    let state = dispatch(INITIAL_EDITOR_STATE, { type: 'SET_VISUAL_STATE', state: 'dark' });
    state = dispatch(state, { type: 'MARK_DIRTY' });
    expect(state.activeVisualState).toBe('dark');
  });

  it('SELECT does not reset activeVisualState', () => {
    let state = dispatch(INITIAL_EDITOR_STATE, { type: 'SET_VISUAL_STATE', state: 'open' });
    state = dispatch(state, { type: 'SELECT', ids: ['g-0'] });
    expect(state.activeVisualState).toBe('open');
  });

  it('DESELECT_ALL does not reset activeVisualState', () => {
    let state = dispatch(INITIAL_EDITOR_STATE, { type: 'SET_VISUAL_STATE', state: 'closed' });
    state = dispatch(state, { type: 'DESELECT_ALL' });
    expect(state.activeVisualState).toBe('closed');
  });

  it('PAN_BY does not reset activeVisualState', () => {
    let state = dispatch(INITIAL_EDITOR_STATE, { type: 'SET_VISUAL_STATE', state: 'pressed' });
    state = dispatch(state, { type: 'PAN_BY', dx: 10, dy: 20 });
    expect(state.activeVisualState).toBe('pressed');
  });
});
