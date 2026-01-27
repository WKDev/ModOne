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
      <div className="bg-gray-900 rounded-lg p-3">
        <h3 className="text-xs font-semibold uppercase text-gray-400 mb-3">
          Server Status
        </h3>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {modbusConnected ? (
              <Wifi size={16} className="text-green-500" />
            ) : (
              <WifiOff size={16} className="text-gray-500" />
            )}
            <span data-testid="tcp-status" className={modbusConnected ? 'text-green-400' : 'text-gray-400'}>
              {modbusConnected ? 'Running' : 'Stopped'}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            TCP:{modbusPort}
          </span>
        </div>

        {/* Server Controls */}
        <div className="flex gap-2">
          <button
            data-testid="modbus-start-tcp"
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm ${
              modbusConnected
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
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
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
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
      <div className="bg-gray-900 rounded-lg p-3">
        <h3 className="text-xs font-semibold uppercase text-gray-400 mb-3">
          Memory Overview
        </h3>

        <div className="space-y-2">
          {mockMemorySections.map((section) => (
            <div key={section.name} className="flex items-center justify-between text-sm">
              <span className="text-gray-300">{section.name}</span>
              <span className="text-gray-500">
                {section.used} / {section.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Info */}
      <div className="text-xs text-gray-500 text-center">
        <p>Modbus TCP Server</p>
        <p>Listening on port {modbusPort}</p>
      </div>
    </div>
  );
}
