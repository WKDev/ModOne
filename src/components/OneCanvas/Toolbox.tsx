/**
 * Toolbox Component
 *
 * Sidebar panel with categorized block types for dragging onto the canvas.
 */

import { memo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, Zap, Cpu, Lightbulb, Activity } from 'lucide-react';
import type { BlockType } from './types';
import type { Block } from './types';

// ============================================================================
// Types
// ============================================================================

interface BlockCategory {
  name: string;
  icon: React.ReactNode;
  blocks: Array<{
    type: BlockType;
    label: string;
    description: string;
    /** Preset properties to apply when this item is dropped */
    presetProps?: Partial<Block>;
  }>;
}

interface ToolboxProps {
  /** Additional CSS classes */
  className?: string;
}

interface DraggableBlockItemProps {
  type: BlockType;
  label: string;
  description: string;
  presetProps?: Partial<Block>;
}

// ============================================================================
// Constants
// ============================================================================

const BLOCK_CATEGORIES: BlockCategory[] = [
  {
    name: 'Power',
    icon: <Zap size={16} />,
    blocks: [
      {
        type: 'powersource',
        label: '+24V',
        description: '24V power supply',
        presetProps: { voltage: 24, polarity: 'positive', label: '+24V', maxCurrent: 1000 } as Partial<Block>,
      },
      {
        type: 'powersource',
        label: 'GND',
        description: 'Ground reference (0V)',
        presetProps: { voltage: 0, polarity: 'ground', label: 'GND' } as Partial<Block>,
      },
      {
        type: 'powersource',
        label: '+12V',
        description: '12V power supply (custom)',
        presetProps: { voltage: 12, polarity: 'positive', label: '+12V', maxCurrent: 1000 } as Partial<Block>,
      },
    ],
  },
  {
    name: 'PLC I/O',
    icon: <Cpu size={16} />,
    blocks: [
      { type: 'plc_out', label: 'PLC Output', description: 'Coil/relay output' },
      { type: 'plc_in', label: 'PLC Input', description: 'Discrete input sensor' },
    ],
  },
  {
    name: 'Components',
    icon: <Lightbulb size={16} />,
    blocks: [
      { type: 'led', label: 'LED', description: 'LED indicator' },
      { type: 'button', label: 'Button', description: 'Push button / switch' },
    ],
  },
  {
    name: 'Instruments',
    icon: <Activity size={16} />,
    blocks: [
      { type: 'scope', label: 'Scope', description: 'Oscilloscope' },
    ],
  },
];

// ============================================================================
// Draggable Block Item
// ============================================================================

const DraggableBlockItem = memo(function DraggableBlockItem({
  type,
  label,
  description,
  presetProps,
}: DraggableBlockItemProps) {
  // Use label as part of draggable id so presets with same type have distinct ids
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `toolbox-${type}-${label}`,
    data: {
      type: 'toolbox-item',
      blockType: type,
      presetProps,
      presetLabel: label,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        px-3 py-2 rounded cursor-grab active:cursor-grabbing
        bg-neutral-800 hover:bg-neutral-700
        border border-transparent hover:border-neutral-600
        transition-colors duration-150
        ${isDragging ? 'ring-2 ring-blue-500' : ''}
      `}
      title={description}
    >
      <div className="text-sm text-white font-medium">{label}</div>
      <div className="text-xs text-neutral-400 truncate">{description}</div>
    </div>
  );
});

// ============================================================================
// Category Section
// ============================================================================

interface CategorySectionProps {
  category: BlockCategory;
  isExpanded: boolean;
  onToggle: () => void;
}

const CategorySection = memo(function CategorySection({
  category,
  isExpanded,
  onToggle,
}: CategorySectionProps) {
  return (
    <div className="border-b border-neutral-700 last:border-b-0">
      {/* Category header */}
      <button
        type="button"
        className="
          w-full px-3 py-2 flex items-center gap-2
          text-sm text-neutral-300 font-medium
          hover:bg-neutral-800 transition-colors
        "
        onClick={onToggle}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {category.icon}
        <span>{category.name}</span>
        <span className="ml-auto text-xs text-neutral-500">
          {category.blocks.length}
        </span>
      </button>

      {/* Category blocks */}
      {isExpanded && (
        <div className="px-2 pb-2 space-y-1">
          {category.blocks.map((block) => (
            <DraggableBlockItem
              key={`${block.type}-${block.label}`}
              type={block.type}
              label={block.label}
              description={block.description}
              presetProps={block.presetProps}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Toolbox Component
// ============================================================================

/**
 * Toolbox panel with draggable block items.
 */
export const Toolbox = memo(function Toolbox({ className = '' }: ToolboxProps) {
  // Track expanded categories (all expanded by default)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(BLOCK_CATEGORIES.map((c) => c.name))
  );

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return (
    <div
      className={`
        w-48 bg-neutral-900 border-r border-neutral-700
        flex flex-col overflow-hidden
        ${className}
      `}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-neutral-700">
        <h3 className="text-sm font-semibold text-white">Toolbox</h3>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {BLOCK_CATEGORIES.map((category) => (
          <CategorySection
            key={category.name}
            category={category}
            isExpanded={expandedCategories.has(category.name)}
            onToggle={() => toggleCategory(category.name)}
          />
        ))}
      </div>
    </div>
  );
});

export default Toolbox;
