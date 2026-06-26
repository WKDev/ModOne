/**
 * isEditableTarget — the single source of truth for "is the user typing?".
 *
 * Every keyboard handler in the app must skip its shortcuts when focus is on a
 * text-entry surface, otherwise typing into a field would trigger canvas
 * actions (Delete erasing the selection while editing a label, `r` switching
 * tools mid-word, etc.). This guard was previously copy-pasted into each
 * handler (OneCanvas `KeyboardShortcuts`, `useCanvasKeyboardShortcuts`, the
 * global `useKeyboardShortcuts`, and the Symbol editor) with subtly different
 * implementations — one even threw on a null target. This is the keyboard
 * counterpart of `normalizePointer`: one shared normalization primitive that
 * the distinct dispatchers all build on.
 */

/**
 * Returns true when the event target is a text-entry surface where keyboard
 * shortcuts should be suppressed: <input>, <textarea>, <select>, or any
 * `contenteditable` element.
 *
 * Null/non-element targets return false (no surface to protect).
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;

  // `isContentEditable` is a boolean in browsers but can be undefined in some
  // DOM implementations (jsdom) — coerce so callers always get a real boolean.
  return target.isContentEditable === true;
}
