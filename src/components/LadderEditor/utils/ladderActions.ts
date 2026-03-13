import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { useLadderUIStore } from '../../../stores/ladderUIStore';
import { isLadderDocument } from '../../../types/document';
import type { LadderElement } from '../../../types/ladder';

function cloneElementDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const ladderActions = {
  deleteSelected: (documentId: string) => {
    const uiStore = useLadderUIStore.getState();
    const selectedIds = Array.from(uiStore.selectedElementIds);
    if (selectedIds.length === 0 || uiStore.mode !== 'edit') return;

    const registry = useDocumentRegistry.getState();
    const doc = registry.getDocument(documentId);
    if (!doc || !isLadderDocument(doc)) return;

    registry.pushHistory(documentId, `Delete ${selectedIds.length} ladder entities`);
    registry.updateLadderData(documentId, (data) => {
      for (const id of selectedIds) {
        data.elements.delete(id);
        data.horizontalEdges.delete(id);
        data.verticalEdges.delete(id);
      }
    });
    uiStore.clearSelection();
  },

  copySelected: (documentId: string) => {
    const registry = useDocumentRegistry.getState();
    const doc = registry.getDocument(documentId);
    if (!doc || !isLadderDocument(doc)) return;

    const uiStore = useLadderUIStore.getState();
    const selectedElements: LadderElement[] = [];
    uiStore.selectedElementIds.forEach((id) => {
      const element = doc.data.elements.get(id);
      if (element) {
        selectedElements.push(cloneElementDeep(element));
      }
    });
    uiStore.setClipboard(selectedElements);
  },

  cutSelected: (documentId: string) => {
    ladderActions.copySelected(documentId);
    ladderActions.deleteSelected(documentId);
  },

  pasteFromClipboard: (documentId: string) => {
    const uiStore = useLadderUIStore.getState();
    if (uiStore.mode !== 'edit' || uiStore.clipboard.length === 0) return;

    const registry = useDocumentRegistry.getState();
    const doc = registry.getDocument(documentId);
    if (!doc || !isLadderDocument(doc)) return;

    const offsetRow = 1;
    const newIds: string[] = [];
    registry.pushHistory(documentId, `Paste ${uiStore.clipboard.length} ladder cells`);
    registry.updateLadderData(documentId, (data) => {
      uiStore.clipboard.forEach((element) => {
        const id = `${element.type}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        data.elements.set(id, {
          ...cloneElementDeep(element),
          id,
          position: {
            row: element.position.row + offsetRow,
            col: element.position.col,
          },
          selected: false,
        });
        newIds.push(id);
      });
    });

    uiStore.setSelection(newIds);
  },

  duplicateSelected: (documentId: string) => {
    const registry = useDocumentRegistry.getState();
    const doc = registry.getDocument(documentId);
    if (!doc || !isLadderDocument(doc)) return;

    const uiStore = useLadderUIStore.getState();
    const ids = Array.from(uiStore.selectedElementIds);
    const newIds: string[] = [];

    registry.pushHistory(documentId, `Duplicate ${ids.length} ladder cells`);
    registry.updateLadderData(documentId, (data) => {
      ids.forEach((id) => {
        const element = data.elements.get(id);
        if (!element) return;

        const newId = `${element.type}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        data.elements.set(newId, {
          ...cloneElementDeep(element),
          id: newId,
          position: {
            row: element.position.row + 1,
            col: element.position.col,
          },
          selected: false,
        });
        newIds.push(newId);
      });
    });

    uiStore.setSelection(newIds);
  },

  selectAll: (documentId: string) => {
    const registry = useDocumentRegistry.getState();
    const doc = registry.getDocument(documentId);
    if (!doc || !isLadderDocument(doc)) return;

    useLadderUIStore.getState().selectAll([
      ...Array.from(doc.data.elements.keys()),
      ...Array.from(doc.data.horizontalEdges.keys()),
      ...Array.from(doc.data.verticalEdges.keys()),
    ]);
  },
};
