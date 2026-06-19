/**
 * SessionMonitoringTable - Read-only table displaying active OPC UA client sessions.
 *
 * Modelled after the Prosys OPC UA Simulation Server session monitoring view with
 * columns: Session Name, Session ID, Client Description, Server URI, Connection Time,
 * Last Contact Time, Client Address, Secure Channel ID, State.
 *
 * Polls the backend periodically (every 5 seconds) for session data.
 * Only polls when the OPC UA server is running AND the browser tab is visible.
 * Automatically pauses polling when the page is hidden (Page Visibility API)
 * and resumes + fetches immediately when the page becomes visible again.
 */

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { RefreshCw, Users, Wifi, WifiOff } from 'lucide-react';
import { useOpcUaStore, selectRunning, selectSessions } from '../../stores/opcuaStore';
import type { OpcUaSessionInfo } from '../../types/project';

/** Polling interval in milliseconds */
const POLL_INTERVAL_MS = 5_000;

/** Column definition for the session table */
interface ColumnDef {
  key: string;
  label: string;
  /** Minimum CSS width */
  minWidth: string;
  /** Whether to use monospace font */
  mono?: boolean;
}

/**
 * Prosys-style column definitions matching the requested columns:
 * Session Name, Session ID, Client Description, Server URI, Connection Time,
 * Last Contact Time, Client Address, Secure Channel ID, State
 */
const COLUMNS: ColumnDef[] = [
  { key: 'clientName', label: 'Session Name', minWidth: '140px' },
  { key: 'sessionId', label: 'Session ID', minWidth: '160px', mono: true },
  { key: 'clientDescription', label: 'Client Description', minWidth: '140px' },
  { key: 'serverUri', label: 'Server URI', minWidth: '180px', mono: true },
  { key: 'connectedAt', label: 'Connection Time', minWidth: '150px' },
  { key: 'lastContactTime', label: 'Last Contact Time', minWidth: '150px' },
  { key: 'clientIp', label: 'Client Address', minWidth: '130px', mono: true },
  { key: 'secureChannelId', label: 'Secure Channel ID', minWidth: '130px', mono: true },
  { key: 'state', label: 'State', minWidth: '90px' },
];

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleString(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** State badge colour mapping */
function stateBadgeClasses(state: string): string {
  switch (state) {
    case 'Activated':
      return 'bg-[var(--color-success,#22c55e)]/15 text-[var(--color-success,#22c55e)]';
    case 'Created':
      return 'bg-[var(--color-warning,#d97706)]/15 text-[var(--color-warning,#d97706)]';
    case 'Closing':
      return 'bg-[var(--color-error,#ef4444)]/15 text-[var(--color-error,#ef4444)]';
    default:
      return 'bg-[var(--bg-secondary)] text-[var(--text-muted)]';
  }
}

function getCellValue(session: OpcUaSessionInfo, key: string): string {
  switch (key) {
    case 'clientName':
      return session.clientName || 'Unknown';
    case 'sessionId':
      return session.sessionId || 'N/A';
    case 'clientDescription':
      return session.clientDescription || '—';
    case 'serverUri':
      return session.serverUri || 'N/A';
    case 'connectedAt':
      return formatTimestamp(session.connectedAt);
    case 'lastContactTime':
      return formatTimestamp(session.lastContactTime);
    case 'clientIp':
      return session.clientIp || 'N/A';
    case 'secureChannelId':
      return session.secureChannelId || 'N/A';
    case 'state':
      return session.state || 'Unknown';
    default:
      return '';
  }
}

/** A single table row, memoized to avoid unnecessary re-renders */
const SessionRow = memo(function SessionRow({ session }: { session: OpcUaSessionInfo }) {
  return (
    <tr className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-tertiary)] transition-colors">
      {COLUMNS.map((col) => {
        const value = getCellValue(session, col.key);
        const isState = col.key === 'state';
        return (
          <td
            key={col.key}
            className={`px-2 py-1.5 text-xs text-[var(--text-secondary)] truncate ${
              col.mono ? 'font-mono' : ''
            }`}
            style={{ minWidth: col.minWidth, maxWidth: '260px' }}
            title={value}
          >
            {isState ? (
              <span
                className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${stateBadgeClasses(value)}`}
              >
                {value}
              </span>
            ) : (
              value
            )}
          </td>
        );
      })}
    </tr>
  );
});

export function SessionMonitoringTable() {
  const running = useOpcUaStore(selectRunning);
  const sessions = useOpcUaStore(selectSessions);
  const fetchSessions = useOpcUaStore((s) => s.fetchSessions);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Tracks whether the page is currently visible */
  const visibleRef = useRef(!document.hidden);

  /** Wrapped fetch that guards against calling when server is stopped */
  const doFetch = useCallback(async () => {
    // Double-check running state from the store to prevent stale-closure calls
    if (!useOpcUaStore.getState().status?.running) return;
    // Skip if the page is hidden — we'll catch up when it becomes visible
    if (document.hidden) return;
    setLoading(true);
    try {
      await fetchSessions();
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [fetchSessions]);

  // ---- Polling lifecycle: start/stop based on `running` state ----
  const startPolling = useCallback(() => {
    // Clear any existing interval before starting a new one
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(doFetch, POLL_INTERVAL_MS);
  }, [doFetch]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Main effect: manage polling based on running + visibility
  useEffect(() => {
    if (!running) {
      stopPolling();
      setLastRefresh(null);
      return;
    }

    // Fetch immediately when the server starts
    doFetch();
    startPolling();

    return stopPolling;
  }, [running, doFetch, startPolling, stopPolling]);

  // ---- Page Visibility API: pause/resume polling when tab hidden/shown ----
  useEffect(() => {
    function handleVisibilityChange() {
      const nowVisible = !document.hidden;
      const wasVisible = visibleRef.current;
      visibleRef.current = nowVisible;

      if (!useOpcUaStore.getState().status?.running) return;

      if (nowVisible && !wasVisible) {
        // Tab became visible — fetch immediately and restart polling
        doFetch();
        startPolling();
      } else if (!nowVisible && wasVisible) {
        // Tab hidden — pause polling to save resources
        stopPolling();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [doFetch, startPolling, stopPolling]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-[var(--text-muted)]" />
          <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            세션 모니터링
          </h4>
          {running && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
              {sessions.length}개 세션
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {lastRefresh.toLocaleTimeString()} 갱신
            </span>
          )}
          <button
            onClick={doFetch}
            disabled={!running || loading}
            className={`
              p-1 rounded transition-colors
              ${running
                ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                : 'text-[var(--text-muted)] cursor-not-allowed'}
            `}
            title="새로고침"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Server not running state */}
      {!running && (
        <div className="flex flex-col items-center justify-center py-6 text-[var(--text-muted)]">
          <WifiOff size={24} className="mb-2 opacity-50" />
          <p className="text-xs">서버가 실행 중이 아닙니다</p>
          <p className="text-[10px] mt-0.5">서버를 시작하면 세션 정보가 표시됩니다</p>
        </div>
      )}

      {/* Running but no sessions */}
      {running && sessions.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-6 text-[var(--text-muted)]">
          <Wifi size={24} className="mb-2 opacity-50" />
          <p className="text-xs">연결된 클라이언트가 없습니다</p>
          <p className="text-[10px] mt-0.5">OPC UA 클라이언트가 연결되면 세션 정보가 표시됩니다</p>
        </div>
      )}

      {/* Session table — horizontally scrollable for Prosys-style multi-column layout */}
      {running && sessions.length > 0 && (
        <div className="border border-[var(--border-color)] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: '1100px' }}>
              {/* Table header */}
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="px-2 py-1.5 text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider text-left whitespace-nowrap"
                      style={{ minWidth: col.minWidth }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table body */}
              <tbody>
                {sessions.map((session) => (
                  <SessionRow key={session.sessionId} session={session} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading overlay for initial load */}
      {running && loading && sessions.length === 0 && (
        <div className="flex items-center justify-center py-6 text-[var(--text-muted)]">
          <RefreshCw size={14} className="animate-spin mr-2" />
          <span className="text-xs">세션 정보 로딩 중...</span>
        </div>
      )}
    </div>
  );
}
