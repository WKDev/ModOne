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
        return 'text-[var(--color-info)]';
      case 'warn':
        return 'text-[var(--color-warning)]';
      case 'error':
        return 'text-[var(--color-error)]';
      default:
        return 'text-[var(--color-text-muted)]';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-primary)]">
      {/* Console Toolbar */}
      <div className="h-8 flex items-center justify-between px-2 border-b border-[var(--color-border)] flex-shrink-0">
        <span className="text-xs text-[var(--color-text-muted)]">Output</span>
        <button
          className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
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
          <div className="text-[var(--color-text-muted)] text-center py-4">
            No output
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-2">
              <span className="text-[var(--color-text-muted)] flex-shrink-0">
                [{formatTimestamp(log.timestamp)}]
              </span>
              <span className={`flex-shrink-0 ${getLevelColor(log.level)}`}>
                [{log.level.toUpperCase()}]
              </span>
              <span className="text-[var(--color-text-secondary)]">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
