// 연결된 클라이언트 목록 + 트래픽에서 파생한 요청수/마지막활동/예외 통계
import { useMemo } from 'react';
import { useModbusStore } from '../../../stores/modbusStore';
import {
  aggregateClientStats,
  useModbusTrafficStore,
  type ClientStat,
} from '../../../stores/modbusTrafficStore';

interface MergedClient {
  clientAddr: string;
  protocol: 'tcp' | 'rtu';
  connectedAt: string | null;
  stat: ClientStat | null;
}

export function ClientStatsPanel() {
  const connections = useModbusStore((s) => s.connections);
  const entries = useModbusTrafficStore((s) => s.entries);

  const statsByAddr = useMemo(() => {
    const map = new Map<string, ClientStat>();
    for (const stat of aggregateClientStats(entries)) {
      map.set(stat.clientAddr, stat);
    }
    return map;
  }, [entries]);

  // 연결된 클라이언트(연결 이벤트 기반) + 트래픽만 있는 클라이언트(이미 끊긴 경우)를 합친다.
  const merged = useMemo<MergedClient[]>(() => {
    const seen = new Set<string>();
    const rows: MergedClient[] = [];

    for (const conn of connections) {
      seen.add(conn.clientAddr);
      rows.push({
        clientAddr: conn.clientAddr,
        protocol: conn.protocol,
        connectedAt: conn.connectedAt,
        stat: statsByAddr.get(conn.clientAddr) ?? null,
      });
    }
    for (const stat of statsByAddr.values()) {
      if (seen.has(stat.clientAddr)) continue;
      rows.push({
        clientAddr: stat.clientAddr,
        protocol: stat.protocol,
        connectedAt: null,
        stat,
      });
    }
    return rows;
  }, [connections, statsByAddr]);

  if (merged.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
        No active Modbus clients.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {merged.map((client) => (
        <div
          key={`${client.protocol}-${client.clientAddr}`}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">{client.clientAddr}</span>
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
              {client.protocol}
              {client.connectedAt ? '' : ' · disconnected'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-text-muted)]">
            <span>{client.stat?.requestCount ?? 0} req</span>
            {client.stat && client.stat.exceptionCount > 0 ? (
              <span className="text-[var(--color-error)]">{client.stat.exceptionCount} ex</span>
            ) : null}
            {client.stat ? (
              <span>last {new Date(client.stat.lastActivity).toLocaleTimeString()}</span>
            ) : client.connectedAt ? (
              <span>since {new Date(client.connectedAt).toLocaleTimeString()}</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ClientStatsPanel;
