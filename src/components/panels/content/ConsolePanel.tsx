import { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

interface LogEntry {
  id: number;
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
}

let logIdCounter = 0;

export function ConsolePanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Add initial welcome message
  useEffect(() => {
    addLog('info', 'ModOne Console initialized');
    addLog('info', 'Ready for simulation output');
  }, []);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (level: LogEntry['level'], message: string) => {
    const entry: LogEntry = {
      id: ++logIdCounter,
      timestamp: new Date(),
      level,
      message,
    };
    setLogs((prev) => [...prev, entry]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const formatTimestamp = (date: Date) => {
    const timeStr = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${timeStr}.${ms}`;
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'info':
        return 'text-blue-400';
      case 'warn':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Console Toolbar */}
      <div className="h-8 flex items-center justify-between px-2 border-b border-gray-700 flex-shrink-0">
        <span className="text-xs text-gray-500">Output</span>
        <button
          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
          onClick={clearLogs}
          title="Clear Console"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Log Output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto font-mono text-xs p-2 space-y-0.5"
      >
        {logs.length === 0 ? (
          <div className="text-gray-600 text-center py-4">
            No output
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-2">
              <span className="text-gray-600 flex-shrink-0">
                [{formatTimestamp(log.timestamp)}]
              </span>
              <span className={`flex-shrink-0 ${getLevelColor(log.level)}`}>
                [{log.level.toUpperCase()}]
              </span>
              <span className="text-gray-300">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
