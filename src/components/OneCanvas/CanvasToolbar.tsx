/**
 * Canvas Toolbar Component
 *
 * Provides alignment, distribution, flip, wire numbering, and print controls.
 * Appears below the simulation toolbar.
 */

import { memo } from 'react';
import {
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  GripHorizontal,
  GripVertical,
  FlipHorizontal,
  FlipVertical2,
  Hash,
  Printer,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface CanvasToolbarProps {
  /** Align selected blocks */
  onAlignSelected: (direction: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => void;
  /** Distribute selected blocks */
  onDistributeSelected: (direction: 'horizontal' | 'vertical') => void;
  /** Flip selected blocks */
  onFlipSelected: (axis: 'horizontal' | 'vertical') => void;
  /** Open wire numbering dialog */
  onOpenWireNumbering: () => void;
  /** Open print dialog */
  onOpenPrint: () => void;
  /** Whether blocks are selected */
  hasSelection?: boolean;
  /** Number of selected blocks */
  selectionCount?: number;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ToolButtonProps {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}

const ToolButton = memo(function ToolButton({
  onClick,
  title,
  disabled = false,
  children,
}: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-center w-8 h-8 rounded transition-colors
        ${disabled
          ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
          : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200'
        }
      `}
      title={title}
    >
      {children}
    </button>
  );
});

const Divider = () => <div className="w-px h-6 bg-neutral-600 mx-1" />;

// ============================================================================
// Component
// ============================================================================

export const CanvasToolbar = memo(function CanvasToolbar({
  onAlignSelected,
  onDistributeSelected,
  onFlipSelected,
  onOpenWireNumbering,
  onOpenPrint,
  hasSelection = false,
  selectionCount = 0,
}: CanvasToolbarProps) {
  const canAlign = hasSelection && selectionCount >= 2;
  const canDistribute = hasSelection && selectionCount >= 3;
  const canFlip = hasSelection && selectionCount >= 1;

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg">
      {/* Alignment Group */}
      <div className="flex items-center gap-0.5" title="Alignment">
        <ToolButton
          onClick={() => onAlignSelected('left')}
          title="Align Left"
          disabled={!canAlign}
        >
          <AlignLeft size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => onAlignSelected('centerH')}
          title="Align Center Horizontal"
          disabled={!canAlign}
        >
          <AlignCenterHorizontal size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => onAlignSelected('right')}
          title="Align Right"
          disabled={!canAlign}
        >
          <AlignRight size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => onAlignSelected('top')}
          title="Align Top"
          disabled={!canAlign}
        >
          <AlignStartVertical size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => onAlignSelected('centerV')}
          title="Align Center Vertical"
          disabled={!canAlign}
        >
          <AlignCenterVertical size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => onAlignSelected('bottom')}
          title="Align Bottom"
          disabled={!canAlign}
        >
          <AlignEndVertical size={16} />
        </ToolButton>
      </div>

      <Divider />

      {/* Distribution Group */}
      <div className="flex items-center gap-0.5" title="Distribution">
        <ToolButton
          onClick={() => onDistributeSelected('horizontal')}
          title="Distribute Horizontally (need 3+ selected)"
          disabled={!canDistribute}
        >
          <GripHorizontal size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => onDistributeSelected('vertical')}
          title="Distribute Vertically (need 3+ selected)"
          disabled={!canDistribute}
        >
          <GripVertical size={16} />
        </ToolButton>
      </div>

      <Divider />

      {/* Flip Group */}
      <div className="flex items-center gap-0.5" title="Flip">
        <ToolButton
          onClick={() => onFlipSelected('horizontal')}
          title="Flip Horizontal"
          disabled={!canFlip}
        >
          <FlipHorizontal size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => onFlipSelected('vertical')}
          title="Flip Vertical"
          disabled={!canFlip}
        >
          <FlipVertical2 size={16} />
        </ToolButton>
      </div>

      <Divider />

      {/* Tools Group */}
      <div className="flex items-center gap-0.5" title="Tools">
        <ToolButton
          onClick={onOpenWireNumbering}
          title="Wire Numbering (IEC 81346)"
        >
          <Hash size={16} />
        </ToolButton>
        <ToolButton
          onClick={onOpenPrint}
          title="Print Schematic"
        >
          <Printer size={16} />
        </ToolButton>
      </div>
    </div>
  );
});

export default CanvasToolbar;
