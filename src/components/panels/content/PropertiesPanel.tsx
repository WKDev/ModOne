import { Settings2 } from 'lucide-react';

export function PropertiesPanel() {
  // Will be connected to selection state to show properties of selected element
  const selectedElement = null;

  if (!selectedElement) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 p-4">
        <Settings2 size={48} className="mb-4 text-gray-600" />
        <h3 className="text-lg font-medium mb-2">Properties</h3>
        <p className="text-sm text-center">
          Select an element to view its properties
        </p>
      </div>
    );
  }

  // When element is selected, show property editor
  return (
    <div className="p-3 space-y-4">
      <div className="bg-gray-900 rounded p-3">
        <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">
          Element Properties
        </h4>
        {/* Property fields will be rendered here based on selected element type */}
      </div>
    </div>
  );
}
