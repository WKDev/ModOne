/**
 * LadderToolbox Component
 *
 * GxWorks-style compact horizontal toolbar with small icon buttons.
 * Click a button to select the active tool, then click grid cells to place elements.
 */

import { cn } from '../../lib/utils';
import { useLadderUIStore } from '../../stores/ladderUIStore';
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
  category: 'contact' | 'coil' | 'wire' | 'timer' | 'counter' | 'compare';
  /** Description for tooltip */
  description?: string;
}

export interface LadderToolboxProps {
  /** Whether toolbox is disabled (e.g., in monitor mode) */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
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

  // Wires
  {
    type: 'wire_h',
    label: 'Horizontal Line',
    icon: '───',
    category: 'wire',
    description: 'Horizontal connection line',
  },
  {
    type: 'wire_v',
    label: 'Vertical Line',
    icon: '│',
    category: 'wire',
    description: 'Vertical connection line',
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
    type: 'compare_ge',
    label: 'Greater or Equal',
    icon: '>=',
    category: 'compare',
    description: 'Greater than or equal comparison',
  },
  {
    type: 'compare_lt',
    label: 'Less Than',
    icon: '<',
    category: 'compare',
    description: 'Less than comparison',
  },
  {
    type: 'compare_le',
    label: 'Less or Equal',
    icon: '<=',
    category: 'compare',
    description: 'Less than or equal comparison',
  },
];

/** Category labels and order */
const CATEGORIES: { id: ToolboxItem['category']; label: string }[] = [
  { id: 'contact', label: 'Contacts' },
  { id: 'coil', label: 'Coils' },
  { id: 'wire', label: 'Lines' },
  { id: 'timer', label: 'Timers' },
  { id: 'counter', label: 'Counters' },
  { id: 'compare', label: 'Compare' },
];

// ============================================================================
// ToolboxButton — Compact icon button for a single element type
// ============================================================================

interface ToolboxButtonProps {
  item: ToolboxItem;
  isActive: boolean;
  disabled: boolean;
  onClick: () => void;
}

function ToolboxButton({ item, isActive, disabled, onClick }: ToolboxButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${item.label}${item.description ? ` — ${item.description}` : ''}`}
      className={cn(
        'flex items-center justify-center',
        'min-w-[30px] h-[28px] px-1.5 rounded',
        'font-mono text-[10px] leading-none',
        'transition-colors duration-100',
        'border border-transparent',
        disabled
          ? 'opacity-40 cursor-not-allowed text-neutral-500'
          : isActive
            ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500'
            : 'text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 hover:border-neutral-600'
      )}
    >
      {item.icon}
    </button>
  );
}

// ============================================================================
// ToolboxSeparator — Thin vertical divider between category groups
// ============================================================================

function ToolboxSeparator() {
  return <div className="w-px h-5 bg-neutral-600 mx-0.5 shrink-0" />;
}

// ============================================================================
// LadderToolbox Component
// ============================================================================

/**
 * LadderToolbox - GxWorks-style compact horizontal element toolbar
 *
 * Click a button to select it as the active placement tool.
 * Click again (or press Escape) to deselect.
 */
export function LadderToolbox({
  disabled = false,
  className,
}: LadderToolboxProps) {
  const activeTool = useLadderUIStore((state) => state.activeTool);
  const setActiveTool = useLadderUIStore((state) => state.setActiveTool);
  const clearActiveTool = useLadderUIStore((state) => state.clearActiveTool);

  const handleToolClick = (type: LadderElementType) => {
    if (disabled) return;
    if (activeTool === type) {
      clearActiveTool();
    } else {
      setActiveTool(type);
    }
  };

  // Group items by category
  const groups = CATEGORIES.map((category) => ({
    ...category,
    items: TOOLBOX_ITEMS.filter((item) => item.category === category.id),
  }));

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 px-2 py-1',
        'bg-neutral-800 border-b border-neutral-700',
        'overflow-x-auto',
        className
      )}
    >
      {groups.map((group, groupIndex) => (
        <div key={group.id} className="flex items-center gap-0.5 shrink-0">
          {/* Separator before group (skip first) */}
          {groupIndex > 0 && <ToolboxSeparator />}

          {/* Category label */}
          <span className="text-[9px] text-neutral-500 uppercase tracking-wider mr-0.5 select-none whitespace-nowrap">
            {group.label}
          </span>

          {/* Buttons */}
          {group.items.map((item) => (
            <ToolboxButton
              key={item.type}
              item={item}
              isActive={activeTool === item.type}
              disabled={disabled}
              onClick={() => handleToolClick(item.type)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default LadderToolbox;
