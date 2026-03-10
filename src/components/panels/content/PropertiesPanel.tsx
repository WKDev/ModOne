/**
 * Properties Panel
 *
 * Shows property editor for currently selected canvas element.
 * Routes to appropriate type-specific editor based on component type.
 *
 * Supports two modes:
 * 1. Standalone: uses active canvas facade for selection/update
 * 2. Injected: receives selectedComponents/onUpdateComponent as props (e.g., OneCanvasPanel sidebar)
 */

import { memo, useCallback, useMemo } from 'react';
import { useCanvasFacade } from '../../../hooks/useCanvasFacade';
import { useEditorAreaStore } from '../../../stores/editorAreaStore';
import type { Block } from '../../OneCanvas/types';
import {
  PlcOutProperties,
  PlcInProperties,
  LedProperties,
  ButtonProperties,
  ScopeProperties,
  PowerSourceProperties,
  TextProperties,
  IndustrialProperties,
} from './properties';
import { CanvasProperties } from './properties/CanvasProperties';

// ============================================================================
// Types
// ============================================================================

interface PropertiesPanelProps {
  /** Externally supplied selected components (overrides global store) */
  selectedComponents?: Block[];
  /** Externally supplied update handler (overrides global store) */
  onUpdateComponent?: (id: string, updates: Partial<Block>) => void;
  /** Tab data (for TabContent compatibility) */
  data?: unknown;
}

// ============================================================================
// Component
// ============================================================================

export const PropertiesPanel = memo(function PropertiesPanel({
  selectedComponents: externalSelectedComponents,
  onUpdateComponent: externalUpdateComponent,
}: PropertiesPanelProps) {
  // Use external props if provided, otherwise fall back to active document state.
  const activeTabData = useEditorAreaStore((state) => {
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    return activeTab?.data as { documentId?: string } | undefined;
  });
  const documentId = activeTabData?.documentId ?? null;
  const facade = useCanvasFacade(documentId);

  const storeSelectedComponents = useMemo(() => {
    const selected: Block[] = [];
    facade.selectedIds.forEach((id) => {
      const component = facade.components.get(id);
      if (component) selected.push(component);
    });
    return selected;
  }, [facade.selectedIds, facade.components]);
  const storeUpdateComponent = facade.updateComponent;

  const selectedComponents = externalSelectedComponents ?? storeSelectedComponents;
  const updateComponent = externalUpdateComponent ?? storeUpdateComponent;

  // Get the first selected component (single selection for now)
  const selectedComponent = useMemo(() => {
    return selectedComponents.length === 1 ? selectedComponents[0] : null;
  }, [selectedComponents]);

  // Handle property changes
  const handleChange = useCallback(
    (updates: Partial<Block>) => {
      if (selectedComponent) {
        updateComponent(selectedComponent.id, updates);
      }
    },
    [selectedComponent, updateComponent]
  );

  // Empty state - no selection (Show Canvas Properties)
  if (!selectedComponent) {
    return (
      <div className="h-full overflow-y-auto p-3">
        <CanvasProperties documentId={documentId} />
      </div>
    );
  }

  // Render type-specific property editor
  return (
    <div className="h-full overflow-y-auto p-3">
      <PropertyEditorRouter
        component={selectedComponent}
        onChange={handleChange}
      />
    </div>
  );
});

// ============================================================================
// Property Editor Router
// ============================================================================

interface PropertyEditorRouterProps {
  component: Block;
  onChange: (updates: Partial<Block>) => void;
}

/**
 * Routes to the appropriate property editor based on component type.
 */
const PropertyEditorRouter = memo(function PropertyEditorRouter({
  component: initialComponent,
  onChange,
}: PropertyEditorRouterProps) {
  // Defensive check: normalize the component type to remove any invisible characters or whitespace
  // that may have been injected during symbol resolution or custom block creation.
  const cleanType = String(initialComponent.type).trim().replace(/[\u200B-\u200D\uFEFF]/g, '') as Block['type'];
  const component = (initialComponent.type === cleanType 
    ? initialComponent 
    : { ...initialComponent, type: cleanType }) as Block;

  switch (component.type) {
    case 'plc_out':
      return (
        <PlcOutProperties
          component={component}
          onChange={onChange}
        />
      );

    case 'plc_in':
      return (
        <PlcInProperties
          component={component}
          onChange={onChange}
        />
      );

    case 'led':
      return (
        <LedProperties
          component={component}
          onChange={onChange}
        />
      );

    case 'button':
      return (
        <ButtonProperties
          component={component}
          onChange={onChange}
        />
      );

    case 'scope':
      return (
        <ScopeProperties
          component={component}
          onChange={onChange}
        />
      );

    case 'powersource':
    case 'power_source':
    case 'power_source_dc_2p':
    case 'power_source_ac_1p':
    case 'power_source_ac_2p':
      return (
        <PowerSourceProperties
          component={component}
          onChange={onChange}
        />
      );

    case 'text':
      return (
        <TextProperties
          component={component}
          onChange={onChange}
        />
      );

    // Industrial components - use generic properties for now
    case 'relay':
    case 'fuse':
    case 'motor':
    case 'emergency_stop':
    case 'selector_switch':
    case 'solenoid_valve':
    case 'sensor':
    case 'pilot_lamp':
    case 'net_label':
    case 'transformer':
    case 'terminal_block':
    case 'overload_relay':
    case 'contactor':
    case 'disconnect_switch':
    case 'off_page_connector':
    case 'custom_symbol':
      return (
        <IndustrialProperties
          component={component}
          onChange={onChange}
        />
      );

    default: {
      // Exhaustive check - this should never be reached with proper typing
      const _exhaustiveCheck: never = component;
      return (
        <div className="text-neutral-500 text-sm">
          Unknown component type: {(_exhaustiveCheck as Block).type}
        </div>
      );
    }
  }
});

export default PropertiesPanel;
