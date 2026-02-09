/**
 * Toolbox Component
 *
 * Sidebar panel with categorized block types for dragging onto the canvas.
 */

import { memo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, Zap, Cpu, Lightbulb, Activity, Type, Cog, Shield, Link2, FolderOpen, ArrowRightLeft } from 'lucide-react';
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
  /** Callback to open the circuit library */
  onOpenLibrary?: () => void;
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
  {
    name: 'Industrial',
    icon: <Cog size={16} />,
    blocks: [
      { type: 'relay', label: 'Relay (K)', description: 'Relay / Contactor' },
      { type: 'contactor', label: 'Contactor (KM)', description: 'Main contactor' },
      { type: 'fuse', label: 'Fuse (F)', description: 'Fuse / Circuit breaker' },
      { type: 'overload_relay', label: 'Overload (F)', description: 'Thermal overload relay' },
      { type: 'motor', label: 'Motor (M)', description: '3-phase motor' },
      { type: 'disconnect_switch', label: 'Disconnect (Q)', description: 'Main disconnect switch' },
      { type: 'transformer', label: 'Transformer (T)', description: 'Control transformer' },
      { type: 'terminal_block', label: 'Terminal (X)', description: 'Terminal block' },
      { type: 'pilot_lamp', label: 'Pilot Lamp', description: 'Indicator light' },
      { type: 'emergency_stop', label: 'E-Stop', description: 'Emergency stop button' },
      { type: 'solenoid_valve', label: 'Solenoid', description: 'Solenoid valve' },
    ],
  },
  {
    name: 'Sensors & Switches',
    icon: <Shield size={16} />,
    blocks: [
      { type: 'sensor', label: 'Sensor', description: 'Proximity / Photoelectric sensor' },
      { type: 'selector_switch', label: 'Selector', description: 'Selector switch' },
    ],
  },
  {
    name: 'Schematic',
    icon: <ArrowRightLeft size={16} />,
    blocks: [
      {
        type: 'off_page_connector',
        label: 'Off-Page Out',
        description: 'Signal continues on another page (outgoing)',
        presetProps: { signalLabel: 'SIGNAL', direction: 'outgoing', dangling: true } as Partial<Block>,
      },
      {
        type: 'off_page_connector',
        label: 'Off-Page In',
        description: 'Signal arrives from another page (incoming)',
        presetProps: { signalLabel: 'SIGNAL', direction: 'incoming', dangling: true } as Partial<Block>,
      },
    ],
  },
  {
    name: 'Connections',
    icon: <Link2 size={16} />,
    blocks: [
      {
        type: 'net_label',
        label: '+24V Net',
        description: 'Virtual connection to +24V net',
        presetProps: { netName: '+24V', direction: 'bidirectional' } as Partial<Block>,
      },
      {
        type: 'net_label',
        label: 'GND Net',
        description: 'Virtual connection to GND net',
        presetProps: { netName: 'GND', direction: 'bidirectional' } as Partial<Block>,
      },
      {
        type: 'net_label',
        label: 'Net Label',
        description: 'Custom net label (edit name)',
        presetProps: { netName: 'NET1', direction: 'bidirectional' } as Partial<Block>,
      },
      {
        type: 'net_label',
        label: 'Input Net',
        description: 'Net label (input direction)',
        presetProps: { netName: 'INPUT', direction: 'input' } as Partial<Block>,
      },
      {
        type: 'net_label',
        label: 'Output Net',
        description: 'Net label (output direction)',
        presetProps: { netName: 'OUTPUT', direction: 'output' } as Partial<Block>,
      },
    ],
  },
  {
    name: 'Annotation',
    icon: <Type size={16} />,
    blocks: [
      {
        type: 'text',
        label: 'Label',
        description: 'Simple text label',
        presetProps: { content: 'Label', textStyle: 'label', fontSize: 14 } as Partial<Block>,
      },
      {
        type: 'text',
        label: 'Title',
        description: 'Section title (bold)',
        presetProps: { content: 'Title', textStyle: 'title', fontSize: 18, showBorder: false } as Partial<Block>,
      },
      {
        type: 'text',
        label: 'Note',
        description: 'Annotation note (italic)',
        presetProps: { content: 'Note...', textStyle: 'note', fontSize: 12, showBorder: true } as Partial<Block>,
      },
      {
        type: 'text',
        label: 'Section',
        description: 'Section divider header',
        presetProps: { content: 'SECTION', textStyle: 'section', fontSize: 12, showBorder: true } as Partial<Block>,
      },
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
export const Toolbox = memo(function Toolbox({ className = '', onOpenLibrary }: ToolboxProps) {
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
        w-48 min-h-0 bg-neutral-900 border-r border-neutral-700
        flex flex-col overflow-hidden
        ${className}
      `}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-neutral-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Toolbox</h3>
        {onOpenLibrary && (
          <button
            onClick={onOpenLibrary}
            className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
            title="Open Circuit Library"
          >
            <FolderOpen size={16} />
          </button>
        )}
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
