import { Play, Square, Wifi, WifiOff } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';

interface MemorySection {
  name: string;
  count: number;
  used: number;
}

// Mock memory data - will be replaced with actual Modbus store data
const mockMemorySections: MemorySection[] = [
  { name: 'Coils', count: 1000, used: 24 },
  { name: 'Discrete Inputs', count: 1000, used: 16 },
  { name: 'Holding Registers', count: 1000, used: 48 },
  { name: 'Input Registers', count: 1000, used: 32 },
];

export function ModbusPanel() {
  const { modbusConnected, modbusPort, setModbusConnected } = useLayoutStore();

  const handleStartServer = () => {
    setModbusConnected(true);
    // TODO: Actually start Modbus server
  };

  const handleStopServer = () => {
    setModbusConnected(false);
    // TODO: Actually stop Modbus server
  };

  return (
    <div className="p-3 space-y-4">
      {/* Connection Status */}
      <div className="bg-[var(--color-bg-primary)] rounded-lg p-3">
        <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-3">
          Server Status
        </h3>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {modbusConnected ? (
              <Wifi size={16} className="text-[var(--color-success)]" />
            ) : (
              <WifiOff size={16} className="text-[var(--color-text-muted)]" />
            )}
            <span data-testid="tcp-status" className={modbusConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}>
              {modbusConnected ? 'Running' : 'Stopped'}
            </span>
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">
            TCP:{modbusPort}
          </span>
        </div>

        {/* Server Controls */}
        <div className="flex gap-2">
          <button
            data-testid="modbus-start-tcp"
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm ${
              modbusConnected
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-success)] hover:bg-[var(--color-success)] text-white'
            }`}
            onClick={handleStartServer}
            disabled={modbusConnected}
          >
            <Play size={14} />
            Start
          </button>
          <button
            data-testid="modbus-stop-tcp"
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm ${
              !modbusConnected
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-error)] hover:bg-[var(--color-error)] text-white'
            }`}
            onClick={handleStopServer}
            disabled={!modbusConnected}
          >
            <Square size={14} />
            Stop
          </button>
        </div>
      </div>

      {/* Memory Overview */}
      <div className="bg-[var(--color-bg-primary)] rounded-lg p-3">
        <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-3">
          Memory Overview
        </h3>

        <div className="space-y-2">
          {mockMemorySections.map((section) => (
            <div key={section.name} className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">{section.name}</span>
              <span className="text-[var(--color-text-muted)]">
                {section.used} / {section.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Info */}
      <div className="text-xs text-[var(--color-text-muted)] text-center">
        <p>Modbus TCP Server</p>
        <p>Listening on port {modbusPort}</p>
      </div>
    </div>
  );
}
