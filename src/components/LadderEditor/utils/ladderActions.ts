import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { useLadderUIStore } from '../../../stores/ladderUIStore';
import { isLadderDocument } from '../../../types/document';
import type { LadderElement, GridPosition, LadderGridConfig } from '../../../types/ladder';
import { isWireType } from '../../../types/ladder';
import { analyzeNeighborDirections, updateAdjacentWires, recalculateWireType, applyWireTypeUpdate } from './wireGenerator';

function cloneElementDeep(element: LadderElement): LadderElement {
    return JSON.parse(JSON.stringify(element)) as LadderElement;
}

function generateElementId(prefix: string): string {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
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

function refreshVerticalLinkNeighbors(
    data: { elements: Map<string, LadderElement>; verticalLinks: Map<string, { position: { row: number; col: number } }>; gridConfig: LadderGridConfig },
    positions: Array<{ row: number; col: number }>
): void {
    const visited = new Set<string>();

    for (const pos of positions) {
        const affectedCells = [
            { row: pos.row - 1, col: pos.col },
            { row: pos.row, col: pos.col },
        ].filter((cell) => cell.row >= 0 && cell.col >= 0 && cell.col < data.gridConfig.columns);

        for (const cell of affectedCells) {
            const key = cell.row + '-' + cell.col;
            if (visited.has(key)) continue;
            visited.add(key);

            const current = Array.from(data.elements.values()).find(
                (element) => element.position.row === cell.row && element.position.col === cell.col
            );

            if (current) {
                if (isWireType(current.type)) {
                    const selfUpdate = recalculateWireType(current, data.elements, data.gridConfig, undefined, data.verticalLinks as any);
                    if (selfUpdate) {
                        applyWireTypeUpdate(current, selfUpdate);
                    }
                } else {
                    current.properties.connectedDirections = analyzeNeighborDirections(
                        cell,
                        data.elements,
                        data.gridConfig,
                        undefined,
                        data.verticalLinks as any
                    );
                }
            }

            const adjacentUpdates = updateAdjacentWires(cell, data.elements, data.gridConfig, undefined, data.verticalLinks as any);
            for (const update of adjacentUpdates) {
                const adjElement = data.elements.get(update.elementId);
                if (adjElement && isWireType(adjElement.type)) {
                    applyWireTypeUpdate(adjElement, update);
                }
            }
        }
    }
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
        const deletedVerticalPositions: Array<{ row: number; col: number }> = [];
        idsToDelete.forEach((id) => {
            const el = doc.data.elements.get(id);
            if (el) {
                deletedPositions.push({ ...el.position });
                return;
            }

            const verticalLink = doc.data.verticalLinks.get(id);
            if (verticalLink) {
                deletedVerticalPositions.push({ ...verticalLink.position });
            }
        });

        registry.pushHistory(documentId, 'Delete ' + idsToDelete.length + ' element(s)');
        registry.updateLadderData(documentId, (data) => {
            idsToDelete.forEach((id) => {
                data.elements.delete(id);
                data.verticalLinks.delete(id);
            });
            data.wires = data.wires.filter(
                (wire) => !idsToDelete.includes(wire.from.elementId) && !idsToDelete.includes(wire.to.elementId)
            );

            for (const pos of deletedPositions) {
                const adjacentUpdates = updateAdjacentWires(pos, data.elements, data.gridConfig, undefined, data.verticalLinks as any);
                for (const update of adjacentUpdates) {
                    const adjElement = data.elements.get(update.elementId);
                    if (adjElement && isWireType(adjElement.type)) {
                        applyWireTypeUpdate(adjElement, update);
                    }
                }
            }

            if (deletedVerticalPositions.length > 0) {
                refreshVerticalLinkNeighbors(data as any, deletedVerticalPositions);
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
        registry.pushHistory(documentId, 'Paste ' + clipboard.length + ' element(s)');
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
                    const selfUpdate = recalculateWireType(pastedEl, data.elements, data.gridConfig, undefined, data.verticalLinks as any);
                    if (selfUpdate) applyWireTypeUpdate(pastedEl, selfUpdate);
                }
            }

            for (const pos of pastedPositions) {
                const adjacentUpdates = updateAdjacentWires(pos, data.elements, data.gridConfig, undefined, data.verticalLinks as any);
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

            registry.pushHistory(documentId, 'Duplicate ' + element.type);
            registry.updateLadderData(documentId, (data) => {
                data.elements.set(newId, cloned);
                if (isWireType(cloned.type)) {
                    const selfUpdate = recalculateWireType(cloned, data.elements, data.gridConfig, undefined, data.verticalLinks as any);
                    if (selfUpdate) applyWireTypeUpdate(cloned, selfUpdate);
                }
                const adjacentUpdates = updateAdjacentWires(availablePosition, data.elements, data.gridConfig, undefined, data.verticalLinks as any);
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

        useLadderUIStore.getState().selectAll([
            ...Array.from(doc.data.elements.keys()),
            ...Array.from(doc.data.verticalLinks.keys()),
        ]);
    },
};
