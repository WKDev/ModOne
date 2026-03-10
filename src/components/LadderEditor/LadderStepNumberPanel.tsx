import { memo, useMemo } from 'react';
import { useLadderUIStore } from '../../stores/ladderUIStore';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useLadderDocument } from '../../stores/hooks/useLadderDocument';
import { cn } from '../../lib/utils';

interface LadderStepNumberPanelProps {
    className?: string;
    /** Width of the panel in pixels */
    width?: number;
}

/**
 * LadderStepNumberPanel
 *
 * Left-side gutter that displays step numbers for each ladder rung.
 * Scrolls in sync with the Pixi canvas via viewportY from ladderUIStore.
 */
export const LadderStepNumberPanel = memo(function LadderStepNumberPanel({
    className,
    width = 40,
}: LadderStepNumberPanelProps) {
    const { documentId } = useDocumentContext();
    const ladderDoc = useLadderDocument(documentId);
    const viewportY = useLadderUIStore((state) => state.viewportY);

    const cellHeight = ladderDoc?.gridConfig.cellHeight ?? 60;

    // We can't easily know the total number of rows from elements alone (they can be sparse).
    // For now, let's render enough numbers for a large range or based on the furthest element.
    const rowCount = useMemo(() => {
        if (!ladderDoc) return 0;
        let maxRow = 20; // Default minimum
        for (const el of ladderDoc.elements.values()) {
            maxRow = Math.max(maxRow, el.position.row + 5);
        }
        return maxRow;
    }, [ladderDoc]);

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
                "relative overflow-hidden bg-neutral-800 border-r border-neutral-700 select-none",
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
                {rows.map((row) => (
                    <div
                        key={row}
                        className="flex items-center justify-center text-[10px] text-neutral-500 border-b border-neutral-700/30"
                        style={{ height: cellHeight }}
                    >
                        {row * 10}
                    </div>
                ))}
            </div>
        </div>
    );
});
