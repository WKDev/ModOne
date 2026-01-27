import { Activity, Wifi, WifiOff, Cpu, Sun, Moon } from 'lucide-react';
import { useLayoutStore, SimulationStatus } from '../../stores/layoutStore';
import { useTheme } from '../../providers/ThemeProvider';

interface StatusIndicatorProps {
  status: SimulationStatus;
}

function StatusIndicator({ status }: StatusIndicatorProps) {
  const colorMap: Record<SimulationStatus, string> = {
    running: 'bg-green-500',
    paused: 'bg-yellow-500',
    stopped: 'bg-gray-500',
  };

  const labelMap: Record<SimulationStatus, string> = {
    running: 'Running',
    paused: 'Paused',
    stopped: 'Stopped',
  };

  return (
    <div className="flex items-center gap-2" title={`Simulation: ${labelMap[status]}`}>
      <div className={`w-2 h-2 rounded-full ${colorMap[status]}`} />
      <span>{labelMap[status]}</span>
    </div>
  );
}

export function StatusBar() {
  const {
    simulationStatus,
    scanTime,
    modbusConnected,
    modbusPort,
    memoryUsageMb,
  } = useLayoutStore();

  const { isDark, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <div data-testid="status-bar" className="h-6 bg-gray-800 border-t border-gray-700 flex items-center justify-between px-4 text-xs font-mono">
      {/* Left Section: Simulation Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Activity size={12} className="text-gray-400" />
          <StatusIndicator status={simulationStatus} />
        </div>
      </div>

      {/* Center Section: Scan Time */}
      <div className="flex items-center gap-1.5 text-gray-400">
        <span>Scan:</span>
        <span className="text-gray-200">{scanTime}ms</span>
      </div>

      {/* Right Section: Modbus + Memory */}
      <div className="flex items-center gap-4">
        {/* Modbus Status */}
        <div
          className="flex items-center gap-1.5"
          title={modbusConnected ? 'Modbus Connected' : 'Modbus Disconnected'}
        >
          {modbusConnected ? (
            <Wifi size={12} className="text-green-500" />
          ) : (
            <WifiOff size={12} className="text-gray-500" />
          )}
          <span className={modbusConnected ? 'text-gray-200' : 'text-gray-500'}>
            TCP:{modbusPort}
          </span>
        </div>

        {/* Memory Usage */}
        <div className="flex items-center gap-1.5" title="Memory Usage">
          <Cpu size={12} className="text-gray-400" />
          <span className="text-gray-400">{memoryUsageMb}MB</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-gray-700 transition-colors"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? (
            <Sun size={12} className="text-yellow-400" />
          ) : (
            <Moon size={12} className="text-gray-400" />
          )}
        </button>
      </div>
    </div>
  );
}
