import {
  FilePlus,
  FolderOpen,
  Save,
  Play,
  Pause,
  Square,
  StepForward,
  PanelLeft,
  PanelBottom,
} from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { commandRegistry } from '../CommandPalette/commandRegistry';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}

function ToolbarButton({ icon, tooltip, onClick, disabled, active }: ToolbarButtonProps) {
  return (
    <button
      className={`w-8 h-8 flex items-center justify-center rounded ${
        disabled
          ? 'opacity-50 cursor-not-allowed text-gray-500'
          : active
          ? 'bg-gray-600 text-white'
          : 'hover:bg-gray-700 text-gray-300 hover:text-white'
      }`}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
    >
      {icon}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="h-6 w-px bg-gray-600 mx-1" />;
}

export function Toolbar() {
  const {
    simulationStatus,
    sidebarVisible,
    toggleSidebar,
    panelVisible,
    togglePanel,
  } = useLayoutStore();

  const isRunning = simulationStatus === 'running';
  const isStopped = simulationStatus === 'stopped';
  const isPaused = simulationStatus === 'paused';

  return (
    <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-2 gap-0.5">
      {/* Project Group */}
      <ToolbarButton
        icon={<FilePlus size={18} />}
        tooltip="New Project (Ctrl+N)"
        onClick={() => commandRegistry.execute('file.new')}
      />
      <ToolbarButton
        icon={<FolderOpen size={18} />}
        tooltip="Open Project (Ctrl+O)"
        onClick={() => commandRegistry.execute('file.open')}
      />
      <ToolbarButton
        icon={<Save size={18} />}
        tooltip="Save (Ctrl+S)"
        onClick={() => commandRegistry.execute('file.save')}
      />

      <ToolbarSeparator />

      {/* Simulation Group */}
      <ToolbarButton
        icon={<Play size={18} />}
        tooltip={isPaused ? 'Resume Simulation (F6)' : 'Start Simulation (F5)'}
        disabled={isRunning}
        onClick={() => {
          if (isPaused) {
            commandRegistry.execute('simulation.resume');
          } else {
            commandRegistry.execute('simulation.start');
          }
        }}
      />
      <ToolbarButton
        icon={<Pause size={18} />}
        tooltip="Pause Simulation (F6)"
        disabled={isStopped || isPaused}
        onClick={() => commandRegistry.execute('simulation.pause')}
      />
      <ToolbarButton
        icon={<Square size={18} />}
        tooltip="Stop Simulation (Shift+F5)"
        disabled={isStopped}
        onClick={() => commandRegistry.execute('simulation.stop')}
      />
      <ToolbarButton
        icon={<StepForward size={18} />}
        tooltip="Step (F10)"
        disabled={!isPaused}
        onClick={() => commandRegistry.execute('simulation.step')}
      />

      <ToolbarSeparator />

      {/* View Group */}
      <ToolbarButton
        icon={<PanelLeft size={18} />}
        tooltip="Toggle Sidebar (Ctrl+B)"
        onClick={toggleSidebar}
        active={sidebarVisible}
      />
      <ToolbarButton
        icon={<PanelBottom size={18} />}
        tooltip="Toggle Panel (Ctrl+J)"
        onClick={togglePanel}
        active={panelVisible}
      />
    </div>
  );
}
