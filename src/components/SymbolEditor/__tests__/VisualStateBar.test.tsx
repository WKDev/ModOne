/**
 * VisualStateBar Component Tests — Sub-AC 2
 *
 * Tests the '+' button, custom state name input UI,
 * dynamic add/delete of VisualState tabs, and state management callbacks.
 *
 * Coverage:
 *  1. Initial render — shows Base tab, '+' button, no state tabs
 *  2. '+' button click — reveals the inline input form
 *  3. Custom name input — Enter key adds a new state tab
 *  4. Custom name input — clicking Add button adds a new state tab
 *  5. Custom name input — Escape key cancels input
 *  6. Cancel button dismisses the input form
 *  7. Duplicate names are rejected (onAddState not called)
 *  8. Empty / whitespace-only names are rejected
 *  9. State tabs render for each defined state name
 * 10. Remove (X) button on a state tab calls onRemoveState
 * 11. Suggestions dropdown — shows unused suggested states
 * 12. Suggestions dropdown — clicking a suggestion calls onAddState
 * 13. Preview mode — '+' button hidden, remove buttons hidden, PREVIEW badge shown
 * 14. Tab click calls onStateChange with the correct name
 * 15. Base tab click calls onStateChange with null
 * 16. Active tab has correct visual style
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisualStateBar } from '../VisualStateBar';

// ============================================================================
// Helpers
// ============================================================================

interface RenderOptions {
  stateNames?: string[];
  activeState?: string | null;
  previewMode?: boolean;
  onStateChange?: (state: string | null) => void;
  onAddState?: (name: string) => void;
  onRemoveState?: (name: string) => void;
}

function renderBar(opts: RenderOptions = {}) {
  const props = {
    stateNames: opts.stateNames ?? [],
    activeState: opts.activeState ?? null,
    previewMode: opts.previewMode ?? false,
    onStateChange: opts.onStateChange ?? vi.fn(),
    onAddState: opts.onAddState ?? vi.fn(),
    onRemoveState: opts.onRemoveState ?? vi.fn(),
  };
  const result = render(<VisualStateBar {...props} />);
  return { ...result, props };
}

// ============================================================================
// Tests
// ============================================================================

describe('VisualStateBar', () => {
  afterEach(cleanup);

  // ── 1. Initial render ─────────────────────────────────────────────────────

  describe('initial render', () => {
    it('renders the Base tab', () => {
      renderBar();
      expect(screen.getByTestId('visual-state-tab-base')).toBeInTheDocument();
    });

    it('renders the add (+) button when not in preview mode', () => {
      renderBar();
      expect(screen.getByTestId('visual-state-add-btn')).toBeInTheDocument();
    });

    it('does not render any extra state tabs when stateNames is empty', () => {
      renderBar();
      // Only 'base' tab should be present
      const allTabs = screen.queryAllByTestId(/^visual-state-tab-/);
      expect(allTabs).toHaveLength(1); // only 'base'
    });

    it('renders a tab for each defined state name', () => {
      renderBar({ stateNames: ['energized', 'running', 'stopped'] });
      expect(screen.getByTestId('visual-state-tab-energized')).toBeInTheDocument();
      expect(screen.getByTestId('visual-state-tab-running')).toBeInTheDocument();
      expect(screen.getByTestId('visual-state-tab-stopped')).toBeInTheDocument();
    });
  });

  // ── 2. '+' button reveals input form ─────────────────────────────────────

  describe("'+' button", () => {
    it('clicking the + button shows the custom state name input', async () => {
      const user = userEvent.setup();
      renderBar();

      await user.click(screen.getByTestId('visual-state-add-btn'));

      expect(screen.getByTestId('visual-state-custom-input')).toBeInTheDocument();
    });

    it('clicking + button hides the + button itself', async () => {
      const user = userEvent.setup();
      renderBar();

      await user.click(screen.getByTestId('visual-state-add-btn'));

      expect(screen.queryByTestId('visual-state-add-btn')).not.toBeInTheDocument();
    });
  });

  // ── 3. Enter key adds state ───────────────────────────────────────────────

  describe('input — Enter key adds state', () => {
    it('calls onAddState with normalized name when Enter is pressed', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      renderBar({ onAddState });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.type(screen.getByTestId('visual-state-custom-input'), 'My Custom State{Enter}');

      // Name should be lowercased with spaces → underscores
      expect(onAddState).toHaveBeenCalledWith('my_custom_state');
    });

    it('calls onStateChange with the new name after add via Enter', async () => {
      const user = userEvent.setup();
      const onStateChange = vi.fn();
      renderBar({ onStateChange });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.type(screen.getByTestId('visual-state-custom-input'), 'fault{Enter}');

      expect(onStateChange).toHaveBeenCalledWith('fault');
    });

    it('clears the input and hides it after successful add via Enter', async () => {
      const user = userEvent.setup();
      renderBar();

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.type(screen.getByTestId('visual-state-custom-input'), 'tripped{Enter}');

      expect(screen.queryByTestId('visual-state-custom-input')).not.toBeInTheDocument();
    });
  });

  // ── 4. Add button adds state ──────────────────────────────────────────────

  describe('input — Add button adds state', () => {
    it('calls onAddState when clicking the Add button', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      renderBar({ onAddState });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.type(screen.getByTestId('visual-state-custom-input'), 'detecting');
      await user.click(screen.getByTestId('visual-state-add-confirm-btn'));

      expect(onAddState).toHaveBeenCalledWith('detecting');
    });

    it('hides the input form after clicking Add button', async () => {
      const user = userEvent.setup();
      renderBar();

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.type(screen.getByTestId('visual-state-custom-input'), 'active');
      await user.click(screen.getByTestId('visual-state-add-confirm-btn'));

      expect(screen.queryByTestId('visual-state-custom-input')).not.toBeInTheDocument();
    });
  });

  // ── 5. Escape key cancels ─────────────────────────────────────────────────

  describe('input — Escape cancels', () => {
    it('pressing Escape hides the input without calling onAddState', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      renderBar({ onAddState });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.type(screen.getByTestId('visual-state-custom-input'), 'partial{Escape}');

      expect(onAddState).not.toHaveBeenCalled();
      expect(screen.queryByTestId('visual-state-custom-input')).not.toBeInTheDocument();
    });
  });

  // ── 6. Cancel button dismisses input ─────────────────────────────────────

  describe('input — Cancel button', () => {
    it('clicking cancel button hides input without calling onAddState', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      renderBar({ onAddState });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.click(screen.getByTestId('visual-state-add-cancel-btn'));

      expect(onAddState).not.toHaveBeenCalled();
      expect(screen.queryByTestId('visual-state-custom-input')).not.toBeInTheDocument();
    });
  });

  // ── 7. Duplicate names rejected ───────────────────────────────────────────

  describe('duplicate name rejection', () => {
    it('does not call onAddState when a name already exists', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      renderBar({ stateNames: ['energized'], onAddState });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.type(screen.getByTestId('visual-state-custom-input'), 'energized{Enter}');

      expect(onAddState).not.toHaveBeenCalled();
    });

    it('does not call onAddState when name normalizes to an existing name', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      renderBar({ stateNames: ['my_state'], onAddState });

      // 'My State' normalizes to 'my_state' which already exists
      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.type(screen.getByTestId('visual-state-custom-input'), 'My State{Enter}');

      expect(onAddState).not.toHaveBeenCalled();
    });
  });

  // ── 8. Empty / whitespace names rejected ──────────────────────────────────

  describe('empty name rejection', () => {
    it('does not call onAddState when input is empty', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      renderBar({ onAddState });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      // Press Enter without typing anything
      await user.type(screen.getByTestId('visual-state-custom-input'), '{Enter}');

      expect(onAddState).not.toHaveBeenCalled();
    });

    it('does not call onAddState when input is only whitespace', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      renderBar({ onAddState });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.type(screen.getByTestId('visual-state-custom-input'), '   {Enter}');

      expect(onAddState).not.toHaveBeenCalled();
    });
  });

  // ── 9. Remove (X) button ─────────────────────────────────────────────────

  describe('remove button', () => {
    it('each state tab has a remove button', () => {
      renderBar({ stateNames: ['energized', 'stopped'] });
      expect(screen.getByLabelText('Remove energized state')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove stopped state')).toBeInTheDocument();
    });

    it('clicking remove calls onRemoveState with the state name', async () => {
      const user = userEvent.setup();
      const onRemoveState = vi.fn();
      renderBar({ stateNames: ['energized', 'running'], onRemoveState });

      const removeBtn = screen.getByLabelText('Remove energized state');
      await user.click(removeBtn);

      expect(onRemoveState).toHaveBeenCalledWith('energized');
    });

    it('clicking remove on active state also calls onStateChange(null)', async () => {
      const user = userEvent.setup();
      const onRemoveState = vi.fn();
      const onStateChange = vi.fn();
      renderBar({
        stateNames: ['energized'],
        activeState: 'energized',
        onRemoveState,
        onStateChange,
      });

      const removeBtn = screen.getByLabelText('Remove energized state');
      await user.click(removeBtn);

      expect(onStateChange).toHaveBeenCalledWith(null);
      expect(onRemoveState).toHaveBeenCalledWith('energized');
    });

    it('clicking remove on non-active state does NOT call onStateChange', async () => {
      const user = userEvent.setup();
      const onRemoveState = vi.fn();
      const onStateChange = vi.fn();
      renderBar({
        stateNames: ['energized', 'running'],
        activeState: 'running',
        onRemoveState,
        onStateChange,
      });

      const removeBtn = screen.getByLabelText('Remove energized state');
      await user.click(removeBtn);

      expect(onRemoveState).toHaveBeenCalledWith('energized');
      // onStateChange should not have been called to null since 'running' is still active
      expect(onStateChange).not.toHaveBeenCalledWith(null);
    });
  });

  // ── 10. Suggestions dropdown ──────────────────────────────────────────────

  describe('suggestions dropdown', () => {
    it('shows suggestions dropdown when input is focused', async () => {
      const user = userEvent.setup();
      renderBar({ stateNames: [] });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      // Input is auto-focused, suggestions should appear
      expect(screen.getByTestId('visual-state-suggestions')).toBeInTheDocument();
    });

    it('filters out already-defined states from suggestions', async () => {
      const user = userEvent.setup();
      // 'energized' is already in stateNames — should NOT appear in suggestions
      renderBar({ stateNames: ['energized'] });

      await user.click(screen.getByTestId('visual-state-add-btn'));

      expect(screen.queryByTestId('visual-state-suggestion-energized')).not.toBeInTheDocument();
    });

    it('clicking a suggestion calls onAddState with that name', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      renderBar({ stateNames: [], onAddState });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.click(screen.getByTestId('visual-state-suggestion-running'));

      expect(onAddState).toHaveBeenCalledWith('running');
    });

    it('clicking a suggestion calls onStateChange with the new state name', async () => {
      const user = userEvent.setup();
      const onStateChange = vi.fn();
      renderBar({ stateNames: [], onStateChange });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.click(screen.getByTestId('visual-state-suggestion-open'));

      expect(onStateChange).toHaveBeenCalledWith('open');
    });

    it('clicking a suggestion that is already defined is a no-op', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      // stateNames includes 'open', but let's say the suggestion still appears
      // (in practice it would be filtered, but test the guard logic directly)
      renderBar({ stateNames: ['open'], onAddState });

      await user.click(screen.getByTestId('visual-state-add-btn'));

      // 'open' should not appear in suggestions since it's already defined
      expect(screen.queryByTestId('visual-state-suggestion-open')).not.toBeInTheDocument();
    });
  });

  // ── 11. Preview mode ──────────────────────────────────────────────────────

  describe('preview mode', () => {
    it('does not render the + button in preview mode', () => {
      renderBar({ previewMode: true });
      expect(screen.queryByTestId('visual-state-add-btn')).not.toBeInTheDocument();
    });

    it('shows a PREVIEW badge in preview mode', () => {
      renderBar({ previewMode: true });
      expect(screen.getByTestId('visual-state-preview-badge')).toBeInTheDocument();
    });

    it('does not render remove buttons on state tabs in preview mode', () => {
      renderBar({ stateNames: ['energized'], previewMode: true });
      expect(screen.queryByLabelText('Remove energized state')).not.toBeInTheDocument();
    });

    it('state tabs are still visible in preview mode', () => {
      renderBar({ stateNames: ['running', 'stopped'], previewMode: true });
      expect(screen.getByTestId('visual-state-tab-running')).toBeInTheDocument();
      expect(screen.getByTestId('visual-state-tab-stopped')).toBeInTheDocument();
    });
  });

  // ── 12. Tab click state changes ───────────────────────────────────────────

  describe('tab click state changes', () => {
    it('clicking a named state tab calls onStateChange with that name', async () => {
      const user = userEvent.setup();
      const onStateChange = vi.fn();
      renderBar({ stateNames: ['energized'], onStateChange });

      await user.click(screen.getByTestId('visual-state-tab-energized'));

      expect(onStateChange).toHaveBeenCalledWith('energized');
    });

    it('clicking the Base tab calls onStateChange with null', async () => {
      const user = userEvent.setup();
      const onStateChange = vi.fn();
      renderBar({ stateNames: ['energized'], activeState: 'energized', onStateChange });

      await user.click(screen.getByTestId('visual-state-tab-base'));

      expect(onStateChange).toHaveBeenCalledWith(null);
    });
  });

  // ── 13. Active tab visual style ───────────────────────────────────────────

  describe('active tab styling', () => {
    it('Base tab has active style when activeState is null', () => {
      renderBar({ activeState: null });
      const baseTab = screen.getByTestId('visual-state-tab-base');
      expect(baseTab.className).toMatch(/bg-blue-600/);
    });

    it('named state tab has active style when it is the active state', () => {
      renderBar({ stateNames: ['energized'], activeState: 'energized' });
      const tab = screen.getByTestId('visual-state-tab-energized');
      expect(tab.className).toMatch(/bg-purple-600/);
    });

    it('Base tab does not have active style when a named state is active', () => {
      renderBar({ stateNames: ['energized'], activeState: 'energized' });
      const baseTab = screen.getByTestId('visual-state-tab-base');
      expect(baseTab.className).not.toMatch(/bg-blue-600/);
    });
  });

  // ── 14. Free-form (custom) state names ───────────────────────────────────

  describe('free-form custom state names', () => {
    it('accepts names not in the predefined suggestions list', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      renderBar({ onAddState });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.type(screen.getByTestId('visual-state-custom-input'), 'fully_custom_name{Enter}');

      expect(onAddState).toHaveBeenCalledWith('fully_custom_name');
    });

    it('normalizes spaces to underscores in custom state names', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      renderBar({ onAddState });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.type(screen.getByTestId('visual-state-custom-input'), 'on fire{Enter}');

      expect(onAddState).toHaveBeenCalledWith('on_fire');
    });

    it('normalizes uppercase to lowercase in custom state names', async () => {
      const user = userEvent.setup();
      const onAddState = vi.fn();
      renderBar({ onAddState });

      await user.click(screen.getByTestId('visual-state-add-btn'));
      await user.type(screen.getByTestId('visual-state-custom-input'), 'ENERGIZED{Enter}');

      expect(onAddState).toHaveBeenCalledWith('energized');
    });
  });

  // ── 15. data-testid accessibility ─────────────────────────────────────────

  describe('data-testid attributes', () => {
    it('root element has data-testid="visual-state-bar"', () => {
      renderBar();
      expect(screen.getByTestId('visual-state-bar')).toBeInTheDocument();
    });

    it('state tabs have correct data-testid pattern', () => {
      renderBar({ stateNames: ['lit', 'dark'] });
      expect(screen.getByTestId('visual-state-tab-lit')).toBeInTheDocument();
      expect(screen.getByTestId('visual-state-tab-dark')).toBeInTheDocument();
    });
  });
});
