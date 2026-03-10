import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useLadderUIStore } from '../../stores/ladderUIStore';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useLadderDocument } from '../../stores/hooks/useLadderDocument';
import { cn } from '../../lib/utils';

interface LadderRungLabelPanelProps {
    className?: string;
    /** Width of the panel in pixels */
    width?: number;
}

/**
 * LadderRungLabelPanel
 *
 * Right-side panel for editing rung labels (row comments).
 * Scrolls in sync with the Pixi canvas via viewportY from ladderUIStore.
 */
export const LadderRungLabelPanel = memo(function LadderRungLabelPanel({
    className,
    width = 180,
}: LadderRungLabelPanelProps) {
    const { documentId } = useDocumentContext();
    const ladderDoc = useLadderDocument(documentId);
    const viewportY = useLadderUIStore((state) => state.viewportY);
    const mode = useLadderUIStore((state) => state.mode);

    const cellHeight = ladderDoc?.gridConfig.cellHeight ?? 60;
    const rungLabels = ladderDoc?.rungLabels ?? new Map<number, string>();
    const isReadOnly = mode === 'monitor';

    // State for the currently editing row
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const handleStartEdit = useCallback((row: number, currentVal: string) => {
        if (isReadOnly) return;
        setEditingRow(row);
        setEditValue(currentVal);
    }, [isReadOnly]);

    const handleCommitEdit = useCallback(() => {
        if (editingRow !== null && ladderDoc) {
            ladderDoc.updateRungLabel(editingRow, editValue);
        }
        setEditingRow(null);
    }, [editingRow, editValue, ladderDoc]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCommitEdit();
        } else if (e.key === 'Escape') {
            setEditingRow(null);
        }
    }, [handleCommitEdit]);

    useEffect(() => {
        if (editingRow !== null) {
            inputRef.current?.focus();
        }
    }, [editingRow]);

    // Determine row count for the overlay
    const rowCount = useMemo(() => {
        if (!ladderDoc) return 0;
        let maxRow = 20;
        for (const el of ladderDoc.elements.values()) {
            maxRow = Math.max(maxRow, el.position.row + 5);
        }
        // Also include rows that have labels
        for (const row of rungLabels.keys()) {
            maxRow = Math.max(maxRow, row + 2);
        }
        return maxRow;
    }, [ladderDoc, rungLabels]);

    const rows = useMemo(() => {
        const arr = [];
        for (let i = 0; i <= rowCount; i++) {
            arr.push(i);
        }
        return arr;
    }, [rowCount]);

    return (
        <div
            className={cn(
                "relative overflow-hidden bg-neutral-900 border-l border-neutral-700",
                className
            )}
            style={{ width }}
        >
            <div
                className="absolute top-0 left-0 w-full"
                style={{
                    transform: `translateY(${-viewportY}px)`,
                    willChange: 'transform',
                }}
            >
                {rows.map((row) => {
                    const label = rungLabels.get(row) || "";
                    const isEditing = editingRow === row;

                    return (
                        <div
                            key={row}
                            className={cn(
                                "group relative flex items-center px-2 border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors",
                                isEditing && "bg-neutral-800"
                            )}
                            style={{ height: cellHeight }}
                            onClick={() => handleStartEdit(row, label)}
                        >
                            {isEditing ? (
                                <input
                                    ref={inputRef}
                                    className="w-full bg-transparent text-xs text-blue-400 outline-none focus:ring-0 placeholder:text-neutral-700"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCommitEdit}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Add label..."
                                    autoComplete="off"
                                />
                            ) : (
                                <span className={cn(
                                    "text-[11px] truncate w-full",
                                    label ? "text-neutral-300 italic" : "text-neutral-700 group-hover:text-neutral-600 opacity-0 group-hover:opacity-100"
                                )}>
                                    {label || "Click to add label..."}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
