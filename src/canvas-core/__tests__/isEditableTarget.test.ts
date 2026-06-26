import { describe, it, expect } from 'vitest';
import { isEditableTarget } from '../input/isEditableTarget';

/**
 * Locks the editable-target guard shared by every keyboard handler. Subtle
 * divergences here (uppercase tagName, missing null guard, no contenteditable
 * check) were the bugs that motivated extracting this primitive — so pin them.
 */
describe('isEditableTarget', () => {
  it('returns false for null / non-element targets', () => {
    expect(isEditableTarget(null)).toBe(false);
    // A non-DOM EventTarget (e.g. window) is not an editable surface.
    expect(isEditableTarget(window as unknown as EventTarget)).toBe(false);
  });

  it('detects input, textarea and select (case-insensitive)', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      const el = document.createElement(tag);
      expect(isEditableTarget(el)).toBe(true);
    }
  });

  it('detects contenteditable elements', () => {
    const div = document.createElement('div');
    expect(isEditableTarget(div)).toBe(false);
    // jsdom does not derive isContentEditable from the attribute, so set the
    // property directly to model a focused contenteditable surface.
    Object.defineProperty(div, 'isContentEditable', {
      value: true,
      configurable: true,
    });
    expect(isEditableTarget(div)).toBe(true);
  });

  it('returns false for ordinary canvas / div targets', () => {
    expect(isEditableTarget(document.createElement('canvas'))).toBe(false);
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
  });
});
