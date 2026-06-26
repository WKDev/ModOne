// 심볼 에디터의 클립보드(복사/붙여넣기/잘라내기/복제)와 명령 키보드 단축키를 담당하는 훅
import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import type { GraphicPrimitive, SymbolPin } from '../../../types/symbol';
import type { EditorAction } from '../editorModel';
import { translatePrimitive } from '../history';
import { GRID_MODULE_MM, isEditableTarget } from '@/canvas-core';

export interface SymbolClipboardParams {
  selectedIds: Set<string>;
  getActiveGeometry: () => { graphics: GraphicPrimitive[]; pins: SymbolPin[] };
  handleAddPrimitive: (prim: GraphicPrimitive) => void;
  handleAddPin: (pin: SymbolPin) => void;
  handleDeleteSelected: () => void;
  dispatch: Dispatch<EditorAction>;
  previewMode: boolean;
  handleUndo: () => void;
  handleRedo: () => void;
}

/**
 * In-editor clipboard (copy/paste/cut/duplicate), select-all, and the Ctrl/Cmd
 * command keyboard shortcuts. Mirrors OneCanvas's command set; tool-switch +
 * delete + per-tool keys live in SymbolEditorHost.
 */
export function useSymbolClipboard({
  selectedIds,
  getActiveGeometry,
  handleAddPrimitive,
  handleAddPin,
  handleDeleteSelected,
  dispatch,
  previewMode,
  handleUndo,
  handleRedo,
}: SymbolClipboardParams) {
  /** In-editor clipboard (per session). Holds deep copies so later edits to the
   *  source don't mutate the clipboard. */
  const clipboardRef = useRef<{ graphics: GraphicPrimitive[]; pins: SymbolPin[] }>({
    graphics: [],
    pins: [],
  });

  const handleCopySelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const { graphics, pins } = getActiveGeometry();
    const copiedGraphics = graphics.filter((_, i) => selectedIds.has(`g-${i}`));
    const copiedPins = pins.filter((p) => selectedIds.has(p.id));
    if (copiedGraphics.length === 0 && copiedPins.length === 0) return;
    clipboardRef.current = {
      graphics: copiedGraphics.map((g) => structuredClone(g)),
      pins: copiedPins.map((p) => structuredClone(p)),
    };
  }, [selectedIds, getActiveGeometry]);

  const handlePaste = useCallback(() => {
    const { graphics, pins } = clipboardRef.current;
    if (graphics.length === 0 && pins.length === 0) return;
    // Offset the paste so it doesn't sit exactly on the source, staying grid-aligned.
    const offset = GRID_MODULE_MM * 2;
    graphics.forEach((g) => {
      const moved = translatePrimitive(structuredClone(g), offset, offset);
      // Strip the id so handleAddPrimitive assigns a fresh one.
      const { id: _id, ...rest } = moved as GraphicPrimitive & { id?: string };
      handleAddPrimitive(rest as GraphicPrimitive);
    });
    pins.forEach((p) => {
      const newPin: SymbolPin = {
        ...structuredClone(p),
        id: crypto.randomUUID(),
        position: { x: p.position.x + offset, y: p.position.y + offset },
        locked: false,
      };
      handleAddPin(newPin);
    });
  }, [handleAddPrimitive, handleAddPin]);

  const handleCutSelected = useCallback(() => {
    handleCopySelected();
    handleDeleteSelected();
  }, [handleCopySelected, handleDeleteSelected]);

  const handleDuplicateSelected = useCallback(() => {
    handleCopySelected();
    handlePaste();
  }, [handleCopySelected, handlePaste]);

  const handleSelectAll = useCallback(() => {
    const { graphics, pins } = getActiveGeometry();
    const ids = [...graphics.map((_, i) => `g-${i}`), ...pins.map((p) => p.id)];
    if (ids.length > 0) dispatch({ type: 'SELECT', ids });
  }, [getActiveGeometry, dispatch]);

  // ── Command keyboard shortcuts (undo/redo/clipboard/select-all) ─────────────
  // Tool-switch + delete + per-tool keys live in SymbolEditorHost; this handles
  // the Ctrl/Cmd command set so it matches OneCanvas. Skips text-entry fields
  // via the shared isEditableTarget guard.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
          break;
        case 'y':
          e.preventDefault();
          handleRedo();
          break;
        case 'a':
          e.preventDefault();
          handleSelectAll();
          break;
        case 'c':
          e.preventDefault();
          handleCopySelected();
          break;
        case 'v':
          if (previewMode) break;
          e.preventDefault();
          handlePaste();
          break;
        case 'x':
          if (previewMode) break;
          e.preventDefault();
          handleCutSelected();
          break;
        case 'd':
          if (previewMode) break;
          e.preventDefault();
          handleDuplicateSelected();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    previewMode,
    handleUndo,
    handleRedo,
    handleSelectAll,
    handleCopySelected,
    handlePaste,
    handleCutSelected,
    handleDuplicateSelected,
  ]);

  return {
    handleCopySelected,
    handlePaste,
    handleCutSelected,
    handleDuplicateSelected,
    handleSelectAll,
  };
}
