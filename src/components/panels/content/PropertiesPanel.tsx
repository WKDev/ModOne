/**
 * Properties Panel
 *
 * Shows property editor for currently selected canvas element.
 * Routes to appropriate type-specific editor based on component type.
 */

import { memo, useCallback, useMemo } from 'react';
import { Settings2 } from 'lucide-react';
import { useCanvasStore, selectSelectedComponents } from '../../../stores/canvasStore';
import type { Block } from '../../OneCanvas/types';
import {
  PlcOutProperties,
  PlcInProperties,
  LedProperties,
  ButtonProperties,
  ScopeProperties,
  BasicProperties,
} from './properties';

// ============================================================================
// Component
// ============================================================================

export const PropertiesPanel = memo(function PropertiesPanel() {
  // Get selected components from canvas store
  const selectedComponents = useCanvasStore(selectSelectedComponents);
  const updateComponent = useCanvasStore((state) => state.updateComponent);

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

  // Empty state - no selection
  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-neutral-500 p-4">
        <Settings2 size={48} className="mb-4 text-neutral-600" />
        <h3 className="text-lg font-medium mb-2">Properties</h3>
        <p className="text-sm text-center">
          {selectedComponents.length > 1
            ? 'Select a single element to edit properties'
            : 'Select an element to view its properties'}
        </p>
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
  component,
  onChange,
}: PropertyEditorRouterProps) {
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

    case 'power_24v':
    case 'power_12v':
    case 'gnd':
      return (
        <BasicProperties
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
