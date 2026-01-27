import { Database } from 'lucide-react';

export function MemoryVisualizerPanel() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-500 p-4">
      <Database size={48} className="mb-4 text-gray-600" />
      <h3 className="text-lg font-medium mb-2">Memory Visualizer</h3>
      <p className="text-sm text-center">
        Will integrate with Unit 3
      </p>
      <p className="text-xs text-gray-600 mt-2 text-center">
        View and edit Modbus registers, coils, and discrete inputs
      </p>
    </div>
  );
}
