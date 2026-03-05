import { memo, type ReactNode } from 'react';
import {
  MousePointer2,
  Square,
  Circle,
  Pen,
  GitBranch,
  Type,
  MapPin,
} from 'lucide-react';
import type { EditorTool } from './SymbolEditor';

interface EditorToolbarProps {
  currentTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
}

interface ToolDef {
  tool: EditorTool;
  label: string;
  icon: ReactNode;
}

const TOOLS: ToolDef[] = [
  { tool: 'select', label: 'Select', icon: <MousePointer2 size={18} /> },
  { tool: 'rect', label: 'Rect', icon: <Square size={18} /> },
  { tool: 'circle', label: 'Circle', icon: <Circle size={18} /> },
  { tool: 'polyline', label: 'Polyline', icon: <Pen size={18} /> },
  { tool: 'arc', label: 'Arc', icon: <GitBranch size={18} /> },
  { tool: 'text', label: 'Text', icon: <Type size={18} /> },
  { tool: 'pin', label: 'Pin', icon: <MapPin size={18} /> },
];

export const EditorToolbar = memo(function EditorToolbar({
  currentTool,
  onToolChange,
}: EditorToolbarProps) {
  return (
    <div className="flex flex-col gap-1 p-2 bg-neutral-800 border-r border-neutral-700">
      {TOOLS.map(({ tool, label, icon }) => (
        <button
          key={tool}
          type="button"
          title={label}
            onClick={() => onToolChange(tool)}
          className={`w-9 h-9 rounded flex items-center justify-center transition-colors duration-150 ${
            currentTool === tool
              ? 'bg-blue-600 text-white'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
});

export default EditorToolbar;
