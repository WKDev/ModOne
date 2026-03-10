import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { useLadderUIStore } from '../../../stores/ladderUIStore';
import { isLadderDocument } from '../../../types/document';
import type { LadderElement, GridPosition, LadderGridConfig } from '../../../types/ladder';
import { isWireType } from '../../../types/ladder';
import { updateAdjacentWires, recalculateWireType, applyWireTypeUpdate } from './wireGenerator';

function cloneElementDeep(element: LadderElement): LadderElement {
    return JSON.parse(JSON.stringify(element)) as LadderElement;
}

function generateElementId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isValidPosition(
    elements: Map<string, LadderElement>,
    position: GridPosition,
    gridConfig: LadderGridConfig
): boolean {
    if (position.col < 0 || position.col >= gridConfig.columns) {
        return false;
    }
    if (position.row < 0) {
        return false;
    }

    for (const element of elements.values()) {
        if (element.position.row === position.row && element.position.col === position.col) {
            return false;
        }
    }

    return true;
}

export const ladderActions = {
    deleteSelected: (documentId: string) => {
        const uiStore = useLadderUIStore.getState();
        const selectedElementIds = uiStore.selectedElementIds;
        const mode = uiStore.mode;

        if (mode !== 'edit' || !documentId) return;

        const idsToDelete = Array.from(selectedElementIds);
        if (idsToDelete.length === 0) return;

        const registry = useDocumentRegistry.getState();
        const doc = registry.getDocument(documentId);
        if (!doc || !isLadderDocument(doc)) return;

        const deletedPositions: GridPosition[] = [];
        idsToDelete.forEach((id) => {
            const el = doc.data.elements.get(id);
            if (el) {
                deletedPositions.push({ ...el.position });
            }
        });

        registry.pushHistory(documentId, `Delete ${idsToDelete.length} element(s)`);
        registry.updateLadderData(documentId, (data) => {
            idsToDelete.forEach((id) => {
                data.elements.delete(id);
            });
            data.wires = data.wires.filter(
                (wire) => !idsToDelete.includes(wire.from.elementId) && !idsToDelete.includes(wire.to.elementId)
            );

            for (const pos of deletedPositions) {
                const adjacentUpdates = updateAdjacentWires(pos, data.elements, data.gridConfig);
                for (const update of adjacentUpdates) {
                    const adjElement = data.elements.get(update.elementId);
                    if (adjElement && isWireType(adjElement.type)) {
                        applyWireTypeUpdate(adjElement, update);
                    }
                }
            }
        });
        uiStore.clearSelection();
    },

    copySelected: (documentId: string) => {
        if (!documentId) return;
        const registry = useDocumentRegistry.getState();
        const doc = registry.getDocument(documentId);
        if (!doc || !isLadderDocument(doc)) return;

        const uiStore = useLadderUIStore.getState();
        const selectedElements: LadderElement[] = [];
        uiStore.selectedElementIds.forEach((id) => {
            const element = doc.data.elements.get(id);
            if (element) {
                const cloned = cloneElementDeep(element);
                cloned.selected = false;
                selectedElements.push(cloned);
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
        const mode = uiStore.mode;
        if (mode !== 'edit' || !documentId) return;

        const clipboard = uiStore.clipboard;
        if (clipboard.length === 0) return;

        const registry = useDocumentRegistry.getState();
        const doc = registry.getDocument(documentId);
        if (!doc || !isLadderDocument(doc)) return;

        const firstElement = clipboard[0];
        const baseRow = firstElement.position.row;
        const baseCol = firstElement.position.col;

        let offsetRow = 1;
        const maxAttempts = 20;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const testRow = baseRow + offsetRow;
            const testCol = baseCol;
            const occupied = [...doc.data.elements.values()].some(
                (el) => el.position.row === testRow && el.position.col === testCol
            );
            if (!occupied) break;
            offsetRow++;
        }

        const newIds: string[] = [];
        registry.pushHistory(documentId, `Paste ${clipboard.length} element(s)`);
        registry.updateLadderData(documentId, (data) => {
            const pastedPositions: GridPosition[] = [];

            clipboard.forEach((element) => {
                const newPosition = {
                    row: element.position.row + offsetRow,
                    col: element.position.col,
                };
                if (!isValidPosition(data.elements, newPosition, data.gridConfig)) return;

                const newId = generateElementId(element.type);
                const cloned = cloneElementDeep(element);
                cloned.id = newId;
                cloned.position = newPosition;
                cloned.selected = false;
                data.elements.set(newId, cloned);
                newIds.push(newId);
                pastedPositions.push(newPosition);
            });

            for (const newId of newIds) {
                const pastedEl = data.elements.get(newId);
                if (pastedEl && isWireType(pastedEl.type)) {
                    const selfUpdate = recalculateWireType(pastedEl, data.elements, data.gridConfig);
                    if (selfUpdate) applyWireTypeUpdate(pastedEl, selfUpdate);
                }
            }

            for (const pos of pastedPositions) {
                const adjacentUpdates = updateAdjacentWires(pos, data.elements, data.gridConfig);
                for (const update of adjacentUpdates) {
                    const adjElement = data.elements.get(update.elementId);
                    if (adjElement && isWireType(adjElement.type)) {
                        applyWireTypeUpdate(adjElement, update);
                    }
                }
            }
        });

        uiStore.setSelection(newIds);
    },

    duplicateSelected: (documentId: string) => {
        const uiStore = useLadderUIStore.getState();
        const mode = uiStore.mode;
        if (mode !== 'edit' || !documentId) return;

        const ids = Array.from(uiStore.selectedElementIds);
        const registry = useDocumentRegistry.getState();

        ids.forEach((id) => {
            const doc = registry.getDocument(documentId);
            if (!doc || !isLadderDocument(doc)) return;

            const element = doc.data.elements.get(id);
            if (!element) return;

            const candidatePositions: GridPosition[] = [
                { row: element.position.row, col: element.position.col + 1 },
                { row: element.position.row + 1, col: element.position.col },
                { row: element.position.row, col: element.position.col - 1 },
                { row: element.position.row - 1, col: element.position.col },
            ];

            const availablePosition = candidatePositions.find((position) =>
                isValidPosition(doc.data.elements, position, doc.data.gridConfig)
            );
            if (!availablePosition) return;

            const newId = generateElementId(element.type);
            const cloned = cloneElementDeep(element);
            cloned.id = newId;
            cloned.position = availablePosition;
            cloned.selected = false;

            registry.pushHistory(documentId, `Duplicate ${element.type}`);
            registry.updateLadderData(documentId, (data) => {
                data.elements.set(newId, cloned);
                if (isWireType(cloned.type)) {
                    const selfUpdate = recalculateWireType(cloned, data.elements, data.gridConfig);
                    if (selfUpdate) applyWireTypeUpdate(cloned, selfUpdate);
                }
                const adjacentUpdates = updateAdjacentWires(availablePosition, data.elements, data.gridConfig);
                for (const update of adjacentUpdates) {
                    const adjElement = data.elements.get(update.elementId);
                    if (adjElement && isWireType(adjElement.type)) {
                        applyWireTypeUpdate(adjElement, update);
                    }
                }
            });
        });
    },

    selectAll: (documentId: string) => {
        if (!documentId) return;
        const registry = useDocumentRegistry.getState();
        const doc = registry.getDocument(documentId);
        if (!doc || !isLadderDocument(doc)) return;

        useLadderUIStore.getState().selectAll(Array.from(doc.data.elements.keys()));
    },
};
