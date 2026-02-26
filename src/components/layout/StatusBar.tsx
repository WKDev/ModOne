import { Activity, Wifi, WifiOff, Cpu, Sun, Moon } from 'lucide-react';
import { useLayoutStore, SimulationStatus } from '../../stores/layoutStore';
import { useTheme } from '../../providers/ThemeProvider';

interface StatusIndicatorProps {
  status: SimulationStatus;
}

function StatusIndicator({ status }: StatusIndicatorProps) {
  const colorMap: Record<SimulationStatus, string> = {
    running: 'bg-[var(--color-success)]',
    paused: 'bg-[var(--color-warning)]',
    stopped: 'bg-[var(--color-text-muted)]',
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
    <div data-testid="status-bar" className="h-6 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] flex items-center justify-between px-4 text-xs font-mono">
      {/* Left Section: Simulation Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Activity size={12} className="text-[var(--color-text-muted)]" />
          <StatusIndicator status={simulationStatus} />
        </div>
      </div>

      {/* Center Section: Scan Time */}
      <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
        <span>Scan:</span>
        <span className="text-[var(--color-text-secondary)]">{scanTime}ms</span>
      </div>

      {/* Right Section: Modbus + Memory */}
      <div className="flex items-center gap-4">
        {/* Modbus Status */}
        <div
          className="flex items-center gap-1.5"
          title={modbusConnected ? 'Modbus Connected' : 'Modbus Disconnected'}
        >
          {modbusConnected ? (
            <Wifi size={12} className="text-[var(--color-success)]" />
          ) : (
            <WifiOff size={12} className="text-[var(--color-text-muted)]" />
          )}
          <span className={modbusConnected ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'}>
            TCP:{modbusPort}
          </span>
        </div>

        {/* Memory Usage */}
        <div className="flex items-center gap-1.5" title="Memory Usage">
          <Cpu size={12} className="text-[var(--color-text-muted)]" />
          <span className="text-[var(--color-text-muted)]">{memoryUsageMb}MB</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? (
            <Sun size={12} className="text-[var(--color-warning)]" />
          ) : (
            <Moon size={12} className="text-[var(--color-text-muted)]" />
          )}
        </button>
      </div>
    </div>
  );
}
