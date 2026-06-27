// Modbus 요청/응답 트래픽을 Wireshark-lite 형태로 보여주는 로그 패널
import { Pause, Play, Trash2 } from 'lucide-react';
import { useModbusTrafficStore, type TrafficEntry } from '../../../stores/modbusTrafficStore';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

/** 주소 범위를 "addr–end (×qty)" 형태로 표기 */
function formatRange(entry: TrafficEntry): string {
  if (entry.start_address === null) return '—';
  const qty = entry.quantity ?? 1;
  if (qty <= 1) return `@${entry.start_address}`;
  return `@${entry.start_address}–${entry.start_address + qty - 1} (×${qty})`;
}

function TrafficRow({ entry }: { entry: TrafficEntry }) {
  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border px-2 py-1 text-xs ${
        entry.success
          ? 'border-[var(--color-border)] bg-[var(--color-surface-muted)]'
          : 'border-[var(--color-error)]/30 bg-[var(--color-error)]/8'
      }`}
    >
      <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
        {formatTime(entry.timestamp)}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[var(--color-text-secondary)]">
          <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
            FC{entry.function_code.toString(16).padStart(2, '0').toUpperCase()}
          </span>{' '}
          {entry.function_name}
        </div>
        <div className="truncate text-[10px] text-[var(--color-text-muted)]">
          {entry.protocol.toUpperCase()} · {entry.client_addr} · unit {entry.unit_id} ·{' '}
          {formatRange(entry)}
        </div>
      </div>
      {entry.success ? (
        <span className="rounded-full bg-[var(--color-success)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-success)]">
          OK
        </span>
      ) : (
        <span className="rounded-full bg-[var(--color-error)]/12 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-error)]">
          EX{entry.exception_code ?? '?'}
        </span>
      )}
    </div>
  );
}

export function TrafficLogPanel() {
  const entries = useModbusTrafficStore((s) => s.entries);
  const paused = useModbusTrafficStore((s) => s.paused);
  const setPaused = useModbusTrafficStore((s) => s.setPaused);
  const clearTraffic = useModbusTrafficStore((s) => s.clearTraffic);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-muted)]">
          {entries.length} {paused ? '(paused)' : ''}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-surface-muted)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-hover)]"
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={clearTraffic}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-surface-muted)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-hover)]"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
          No traffic yet. Connect a Modbus client and send a request.
        </div>
      ) : (
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {entries.map((entry) => (
            <TrafficRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

export default TrafficLogPanel;
