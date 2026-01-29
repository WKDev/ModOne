/**
 * LadderPropertiesPanel Component
 *
 * Main properties panel that displays and allows editing of selected
 * ladder element properties. Handles empty, single, and multi-select states.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '../../../lib/utils';
import { useLadderStore, selectCurrentNetwork, selectMode } from '../../../stores/ladderStore';
import {
  isContactElement,
  isCoilElement,
  isTimerElement,
  isCounterElement,
  isCompareElement,
  type LadderElement,
  type ContactElement,
  type CoilElement,
  type TimerElement,
  type CounterElement,
} from '../../../types/ladder';
import { ContactProperties } from './ContactProperties';
import { CoilProperties } from './CoilProperties';
import { TimerProperties } from './TimerProperties';
import { CounterProperties } from './CounterProperties';

export interface LadderPropertiesPanelProps {
  /** Optional class name */
  className?: string;
}

/** Element type display names */
const ELEMENT_TYPE_NAMES: Record<string, string> = {
  contact_no: 'Contact (NO)',
  contact_nc: 'Contact (NC)',
  contact_p: 'Contact (P)',
  contact_n: 'Contact (N)',
  coil: 'Coil (OUT)',
  coil_set: 'Coil (SET)',
  coil_reset: 'Coil (RST)',
  timer_ton: 'Timer (TON)',
  timer_tof: 'Timer (TOF)',
  timer_tmr: 'Timer (TMR)',
  counter_ctu: 'Counter (CTU)',
  counter_ctd: 'Counter (CTD)',
  counter_ctud: 'Counter (CTUD)',
  compare_eq: 'Compare (=)',
  compare_gt: 'Compare (>)',
  compare_lt: 'Compare (<)',
  compare_ge: 'Compare (>=)',
  compare_le: 'Compare (<=)',
  compare_ne: 'Compare (<>)',
};

/** Get icon for element type */
function getElementIcon(type: string): string {
  if (type.startsWith('contact')) return '[ ]';
  if (type.startsWith('coil')) return '( )';
  if (type.startsWith('timer')) return '[T]';
  if (type.startsWith('counter')) return '[C]';
  if (type.startsWith('compare')) return '[?]';
  return '[#]';
}

/**
 * EmptyState - Shown when no elements are selected
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <div className="text-neutral-500 text-sm">{message}</div>
    </div>
  );
}

/**
 * MultiSelectProperties - Shown when multiple elements are selected
 */
function MultiSelectProperties({ elements }: { elements: LadderElement[] }) {
  const typeCount = useMemo(() => {
    const counts = new Map<string, number>();
    elements.forEach((el) => {
      const baseType = el.type.split('_')[0];
      counts.set(baseType, (counts.get(baseType) || 0) + 1);
    });
    return Array.from(counts.entries());
  }, [elements]);

  return (
    <div className="p-4 space-y-3">
      <div className="text-sm text-neutral-300 font-medium">
        {elements.length} elements selected
      </div>
      <div className="space-y-1">
        {typeCount.map(([type, count]) => (
          <div key={type} className="flex justify-between text-xs text-neutral-400">
            <span className="capitalize">{type}</span>
            <span>{count}</span>
          </div>
        ))}
      </div>
      <div className="pt-2 text-xs text-neutral-500">
        Select a single element to edit its properties.
      </div>
    </div>
  );
}

/**
 * SingleElementProperties - Property editor for a single selected element
 */
function SingleElementProperties({
  element,
  onUpdate,
  disabled,
}: {
  element: LadderElement;
  onUpdate: (updates: Partial<LadderElement>) => void;
  disabled: boolean;
}) {
  // Render appropriate property editor based on element type
  if (isContactElement(element)) {
    return (
      <ContactProperties
        element={element}
        onUpdate={onUpdate as (updates: Partial<ContactElement>) => void}
        disabled={disabled}
      />
    );
  }

  if (isCoilElement(element)) {
    return (
      <CoilProperties
        element={element}
        onUpdate={onUpdate as (updates: Partial<CoilElement>) => void}
        disabled={disabled}
      />
    );
  }

  if (isTimerElement(element)) {
    return (
      <TimerProperties
        element={element}
        onUpdate={onUpdate as (updates: Partial<TimerElement>) => void}
        disabled={disabled}
      />
    );
  }

  if (isCounterElement(element)) {
    return (
      <CounterProperties
        element={element}
        onUpdate={onUpdate as (updates: Partial<CounterElement>) => void}
        disabled={disabled}
      />
    );
  }

  if (isCompareElement(element)) {
    // Compare properties will be added in subtask 4
    return (
      <div className="p-4 text-sm text-neutral-400">
        Compare block properties (coming soon)
      </div>
    );
  }

  // Unsupported element type
  return (
    <div className="p-4 text-sm text-neutral-400">
      Properties not available for this element type.
    </div>
  );
}

/**
 * LadderPropertiesPanel - Main properties panel component
 */
export function LadderPropertiesPanel({ className }: LadderPropertiesPanelProps) {
  // Use shallow comparison for stable selection
  const { selectedElementIds, currentNetwork, mode, updateElement } = useLadderStore(
    useShallow((state) => ({
      selectedElementIds: state.selectedElementIds,
      currentNetwork: selectCurrentNetwork(state),
      mode: state.mode,
      updateElement: state.updateElement,
    }))
  );

  // Compute selected elements from IDs and current network
  const selectedElements = useMemo(() => {
    if (!currentNetwork) return [];
    const elements: LadderElement[] = [];
    selectedElementIds.forEach((id) => {
      const element = currentNetwork.elements.get(id);
      if (element) elements.push(element);
    });
    return elements;
  }, [selectedElementIds, currentNetwork]);

  const isMonitorMode = mode === 'monitor';

  const handleUpdate = useCallback(
    (updates: Partial<LadderElement>) => {
      if (selectedElements.length === 1) {
        updateElement(selectedElements[0].id, updates);
      }
    },
    [selectedElements, updateElement]
  );

  // Determine what to render based on selection state
  const content = useMemo(() => {
    if (selectedElements.length === 0) {
      return <EmptyState message="Select an element to view properties" />;
    }

    if (selectedElements.length > 1) {
      return <MultiSelectProperties elements={selectedElements} />;
    }

    const element = selectedElements[0];
    return (
      <div className="flex flex-col h-full">
        {/* Header with element type icon and name */}
        <div className="flex items-center gap-2 px-4 py-3 bg-neutral-800 border-b border-neutral-700">
          <span className="font-mono text-blue-400">{getElementIcon(element.type)}</span>
          <span className="text-sm font-medium text-neutral-200">
            {ELEMENT_TYPE_NAMES[element.type] || element.type}
          </span>
          {element.address && (
            <span className="ml-auto text-xs font-mono text-neutral-400">
              {element.address}
            </span>
          )}
        </div>

        {/* Property editor */}
        <div className="flex-1 overflow-y-auto p-4">
          <SingleElementProperties
            element={element}
            onUpdate={handleUpdate}
            disabled={isMonitorMode}
          />
        </div>

        {/* Monitor mode indicator */}
        {isMonitorMode && (
          <div className="px-4 py-2 bg-yellow-900/30 border-t border-yellow-700/50 text-xs text-yellow-300">
            Properties are read-only in monitor mode
          </div>
        )}
      </div>
    );
  }, [selectedElements, handleUpdate, isMonitorMode]);

  return (
    <div
      className={cn(
        'flex flex-col bg-neutral-900 border-l border-neutral-700',
        'min-w-[240px] max-w-[320px]',
        className
      )}
    >
      {/* Panel title */}
      <div className="px-4 py-2 bg-neutral-800 border-b border-neutral-700">
        <h3 className="text-sm font-medium text-neutral-200">Properties</h3>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {content}
      </div>
    </div>
  );
}

export default LadderPropertiesPanel;
