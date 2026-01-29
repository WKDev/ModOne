/**
 * LadderToolbox Component
 *
 * Provides a draggable toolbox with all ladder element types organized
 * by category. Elements can be dragged onto the ladder grid.
 */

import { useDraggable } from '@dnd-kit/core';
import { cn } from '../../lib/utils';
import type { LadderElementType } from '../../types/ladder';

// ============================================================================
// Types
// ============================================================================

/** Toolbox item definition */
export interface ToolboxItem {
  /** Element type for ladder diagram */
  type: LadderElementType;
  /** Display label */
  label: string;
  /** Visual icon/symbol */
  icon: string;
  /** Category for grouping */
  category: 'contact' | 'coil' | 'timer' | 'counter' | 'compare';
  /** Description for tooltip */
  description?: string;
}

export interface LadderToolboxProps {
  /** Whether toolbox is disabled (e.g., in monitor mode) */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Orientation: vertical (sidebar) or horizontal (toolbar) */
  orientation?: 'vertical' | 'horizontal';
}

// ============================================================================
// Toolbox Items
// ============================================================================

const TOOLBOX_ITEMS: ToolboxItem[] = [
  // Contacts
  {
    type: 'contact_no',
    label: 'NO Contact',
    icon: '─[ ]─',
    category: 'contact',
    description: 'Normally Open contact - ON when input is true',
  },
  {
    type: 'contact_nc',
    label: 'NC Contact',
    icon: '─[/]─',
    category: 'contact',
    description: 'Normally Closed contact - ON when input is false',
  },
  {
    type: 'contact_p',
    label: 'P Contact',
    icon: '─[↑]─',
    category: 'contact',
    description: 'Positive transition contact - ON on rising edge',
  },
  {
    type: 'contact_n',
    label: 'N Contact',
    icon: '─[↓]─',
    category: 'contact',
    description: 'Negative transition contact - ON on falling edge',
  },

  // Coils
  {
    type: 'coil',
    label: 'Coil',
    icon: '─( )─',
    category: 'coil',
    description: 'Output coil - follows input state',
  },
  {
    type: 'coil_set',
    label: 'Set Coil',
    icon: '─(S)─',
    category: 'coil',
    description: 'Set coil - latches ON when input is true',
  },
  {
    type: 'coil_reset',
    label: 'Reset Coil',
    icon: '─(R)─',
    category: 'coil',
    description: 'Reset coil - unlatches when input is true',
  },

  // Timers
  {
    type: 'timer_ton',
    label: 'TON Timer',
    icon: 'TON',
    category: 'timer',
    description: 'On-delay timer - starts timing when input is true',
  },
  {
    type: 'timer_tof',
    label: 'TOF Timer',
    icon: 'TOF',
    category: 'timer',
    description: 'Off-delay timer - times when input goes false',
  },
  {
    type: 'timer_tmr',
    label: 'TMR Timer',
    icon: 'TMR',
    category: 'timer',
    description: 'Accumulating timer - retains time when input is false',
  },

  // Counters
  {
    type: 'counter_ctu',
    label: 'CTU Counter',
    icon: 'CTU',
    category: 'counter',
    description: 'Count up - increments on rising edge',
  },
  {
    type: 'counter_ctd',
    label: 'CTD Counter',
    icon: 'CTD',
    category: 'counter',
    description: 'Count down - decrements on rising edge',
  },
  {
    type: 'counter_ctud',
    label: 'CTUD Counter',
    icon: 'CTUD',
    category: 'counter',
    description: 'Count up/down - both directions',
  },

  // Comparison
  {
    type: 'compare_eq',
    label: 'Equal',
    icon: '= =',
    category: 'compare',
    description: 'Equal comparison',
  },
  {
    type: 'compare_ne',
    label: 'Not Equal',
    icon: '< >',
    category: 'compare',
    description: 'Not equal comparison',
  },
  {
    type: 'compare_gt',
    label: 'Greater Than',
    icon: '>',
    category: 'compare',
    description: 'Greater than comparison',
  },
  {
    type: 'compare_lt',
    label: 'Less Than',
    icon: '<',
    category: 'compare',
    description: 'Less than comparison',
  },
];

/** Category labels and order */
const CATEGORIES: { id: ToolboxItem['category']; label: string }[] = [
  { id: 'contact', label: 'Contacts' },
  { id: 'coil', label: 'Coils' },
  { id: 'timer', label: 'Timers' },
  { id: 'counter', label: 'Counters' },
  { id: 'compare', label: 'Comparison' },
];

// ============================================================================
// Draggable Toolbox Item
// ============================================================================

interface DraggableToolboxItemProps {
  item: ToolboxItem;
  disabled?: boolean;
}

function DraggableToolboxItem({ item, disabled = false }: DraggableToolboxItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `toolbox-${item.type}`,
    data: {
      type: 'toolbox-item',
      elementType: item.type,
      item,
    },
    disabled,
  });

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded',
        'text-sm text-left w-full',
        'border border-transparent',
        'transition-all duration-150',
        disabled
          ? 'opacity-50 cursor-not-allowed bg-neutral-800'
          : 'hover:bg-neutral-700 hover:border-neutral-600 cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 ring-2 ring-blue-500'
      )}
      title={item.description}
      disabled={disabled}
      type="button"
    >
      <span className="font-mono text-xs text-neutral-400 w-12 text-center shrink-0">
        {item.icon}
      </span>
      <span className="text-neutral-200 truncate">{item.label}</span>
    </button>
  );
}

// ============================================================================
// LadderToolbox Component
// ============================================================================

/**
 * LadderToolbox - Draggable element toolbox for the Ladder Editor
 */
export function LadderToolbox({
  disabled = false,
  className,
  orientation = 'vertical',
}: LadderToolboxProps) {
  // Group items by category
  const itemsByCategory = CATEGORIES.map((category) => ({
    ...category,
    items: TOOLBOX_ITEMS.filter((item) => item.category === category.id),
  }));

  if (orientation === 'horizontal') {
    return (
      <div
        className={cn(
          'flex items-center gap-1 p-1',
          'bg-neutral-800 border-b border-neutral-700',
          className
        )}
      >
        {TOOLBOX_ITEMS.map((item) => (
          <DraggableToolboxItem key={item.type} item={item} disabled={disabled} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col w-48 h-full',
        'bg-neutral-800 border-r border-neutral-700',
        'overflow-y-auto',
        className
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-neutral-700">
        <h3 className="text-sm font-medium text-neutral-200">Elements</h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          Drag to grid
        </p>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {itemsByCategory.map((category) => (
          <div key={category.id}>
            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1 px-1">
              {category.label}
            </h4>
            <div className="space-y-0.5">
              {category.items.map((item) => (
                <DraggableToolboxItem
                  key={item.type}
                  item={item}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Help text */}
      <div className="px-3 py-2 border-t border-neutral-700">
        <p className="text-xs text-neutral-500">
          {disabled ? 'Disabled in monitor mode' : 'Double-click to configure'}
        </p>
      </div>
    </div>
  );
}

export default LadderToolbox;
