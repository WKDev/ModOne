import { PenTool } from 'lucide-react';

export function OneCanvasPanel() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-500 p-4">
      <PenTool size={48} className="mb-4 text-gray-600" />
      <h3 className="text-lg font-medium mb-2">One Canvas</h3>
      <p className="text-sm text-center">
        Coming in Unit 5
      </p>
      <p className="text-xs text-gray-600 mt-2 text-center">
        Design circuit diagrams with drag-and-drop components
      </p>
    </div>
  );
}
