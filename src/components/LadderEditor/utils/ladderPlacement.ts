/**
 * ladderPlacement Utility
 *
 * Shared logic for placing ladder elements on the grid.
 * Used by both mouse interactions (useLadderPixiRenderer) and keyboard shortcuts.
 */

import { useLadderUIStore } from '../../../stores/ladderUIStore';
import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { isLadderDocument } from '../../../types/document';
import { isWireType } from '../../../types/ladder';
import { toast } from 'sonner';
import { validatePlacement } from './validation';
import type { LadderElementType, GridPosition, LadderElement } from '../../../types/ladder';
import {
    resolveWireElementType,
    updateAdjacentWires,
    applyWireTypeUpdate,
    mergeWireDirections,
} from './wireGenerator';

/**
 * Generate unique ID for ladder elements
 */
function generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Handle placement of a ladder element at a specific grid position.
 * This version is used within hooks (like useLadderPixiRenderer) where
 * the document operations are already provided.
 */
export function handlePlacement(
    doc: {
        elements: Map<string, LadderElement>;
        gridConfig: any;
        addElement: (type: LadderElementType, pos: GridPosition) => string | null;
        mergeWireElement: (id: string, type: 'wire_h' | 'wire_v') => void;
        placeVerticalWireSpan: (col: number, start: number, end: number) => void;
        getElementAt: (row: number, col: number) => LadderElement | undefined;
    },
    tool: LadderElementType,
    row: number,
    col: number,
    shiftKey: boolean = false,
): void {
    const existingElement = doc.getElementAt(row, col);

    // Wire tool: merge onto existing wire if applicable
    if (isWireType(tool) && existingElement && isWireType(existingElement.type)) {
        doc.mergeWireElement(existingElement.id, tool as 'wire_h' | 'wire_v');
        trackWireVPlacement(tool, row, col);
        return;
    }

    // Vertical wire + Shift → span from last placement
    if (tool === 'wire_v' && shiftKey) {
        const lastPos = useLadderUIStore.getState().lastWireVPlacement;
        if (lastPos && lastPos.col === col) {
            doc.placeVerticalWireSpan(col, lastPos.row, row);
            useLadderUIStore.getState().setLastWireVPlacement({ row, col });
            return;
        }
    }

    // Normal placement on empty cell
    if (!existingElement) {
        // IEC 61131-3 Placement Validation
        if (!isWireType(tool)) {
            const validation = validatePlacement(tool, { row, col }, doc.gridConfig.columns);
            if (!validation.valid) {
                toast.error(validation.error);
                return;
            }
        }

        const newId = doc.addElement(tool, { row, col });
        if (newId) {
            trackWireVPlacement(tool, row, col);
            // Auto-select placed element (non-wire)
            if (!isWireType(tool)) {
                useLadderUIStore.getState().setSelection([newId]);
            }
        }
    }
}

/**
 * Immediate placement at the current cursor position.
 * Used by global commands (shortcuts) where hooks are not available.
 */
export function placeElementAtCursor(documentId: string, tool: LadderElementType): void {
    const uiStore = useLadderUIStore.getState();
    const cursor = uiStore.cursorCell;
    const mode = uiStore.mode;

    if (!cursor || mode !== 'edit' || !documentId) return;

    const registry = useDocumentRegistry.getState();
    const doc = registry.getDocument(documentId);
    if (!doc || !isLadderDocument(doc)) return;

    const { row, col } = cursor;
    const data = doc.data;

    // Check if cell is occupied by a non-wire
    const existingElement = Array.from(data.elements.values()).find(
        (el) => el.position.row === row && el.position.col === col
    );

    // If already occupied by non-wire, don't overwrite (unless it's a wire merge)
    if (existingElement && !isWireType(existingElement.type)) {
        return;
    }

    // Handle wire merge
    if (isWireType(tool) && existingElement && isWireType(existingElement.type)) {
        registry.pushHistory(documentId, `Merge ${tool}`);
        registry.updateLadderData(documentId, (docData) => {
            const el = docData.elements.get(existingElement.id);
            if (!el) return;
            const mergeUpdate = mergeWireDirections(el, tool as 'wire_h' | 'wire_v', docData.elements, docData.gridConfig);
            if (mergeUpdate) applyWireTypeUpdate(el, mergeUpdate);

            const adjUpdates = updateAdjacentWires(el.position, docData.elements, docData.gridConfig);
            for (const u of adjUpdates) {
                const adj = docData.elements.get(u.elementId);
                if (adj && isWireType(adj.type)) applyWireTypeUpdate(adj, u);
            }
        });
        return;
    }

    // Normal placement
    if (!existingElement) {
        // IEC 61131-3 Placement Validation
        if (!isWireType(tool)) {
            const validation = validatePlacement(tool, { row, col }, data.gridConfig.columns);
            if (!validation.valid) {
                toast.error(validation.error);
                return;
            }
        }

        registry.pushHistory(documentId, `Add ${tool}`);
        registry.updateLadderData(documentId, (docData) => {
            // Resolve wire type
            let resolvedType = tool;
            let wireDirection: string | undefined;
            if (isWireType(tool)) {
                const resolved = resolveWireElementType(cursor, tool as 'wire_h' | 'wire_v', docData.elements, docData.gridConfig);
                resolvedType = resolved.type;
                wireDirection = resolved.direction;
            }

            const id = generateId(resolvedType);
            const newElement: LadderElement = {
                id,
                type: resolvedType,
                position: { ...cursor },
                properties: wireDirection ? { direction: wireDirection } : {},
            } as LadderElement;

            docData.elements.set(id, newElement);

            // Updates
            const adjUpdates = updateAdjacentWires(cursor, docData.elements, docData.gridConfig);
            for (const u of adjUpdates) {
                const adj = docData.elements.get(u.elementId);
                if (adj && isWireType(adj.type)) applyWireTypeUpdate(adj, u);
            }

            // Auto-select
            if (!isWireType(tool)) {
                uiStore.setSelection([id]);
            }
        });

        trackWireVPlacement(tool, row, col);
    }
}

/** Track last wire_v placement for Shift+Click spanning */
function trackWireVPlacement(
    tool: LadderElementType,
    row: number,
    col: number,
): void {
    if (tool === 'wire_v') {
        useLadderUIStore.getState().setLastWireVPlacement({ row, col });
    } else {
        useLadderUIStore.getState().setLastWireVPlacement(null);
    }
}
