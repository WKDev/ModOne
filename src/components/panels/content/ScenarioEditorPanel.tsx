import { PlayCircle } from 'lucide-react';

export function ScenarioEditorPanel() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-500 p-4">
      <PlayCircle size={48} className="mb-4 text-gray-600" />
      <h3 className="text-lg font-medium mb-2">Scenario Editor</h3>
      <p className="text-sm text-center">
        Coming in Unit 6
      </p>
      <p className="text-xs text-gray-600 mt-2 text-center">
        Create test scenarios for automated simulation testing
      </p>
    </div>
  );
}
