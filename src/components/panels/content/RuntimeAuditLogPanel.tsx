// 런타임 운영 감사 로그 패널 — force·시뮬 제어 이벤트를 필터·조회해 표로 보여준다
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  runtimeAuditService,
  type AuditSeverity,
  type RuntimeAuditEntry,
} from '../../../services/runtimeAuditService';

const PAGE_SIZE = 200;

const SEVERITY_OPTIONS: ReadonlyArray<{ value: '' | AuditSeverity; label: string }> = [
  { value: '', label: '전체 심각도' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
];

const EVENT_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: '전체 이벤트' },
  { value: 'force_set', label: 'Force 설정' },
  { value: 'force_release', label: 'Force 해제' },
  { value: 'sim_start', label: '시뮬 시작' },
  { value: 'sim_stop', label: '시뮬 정지' },
  { value: 'sim_pause', label: '시뮬 일시정지' },
  { value: 'sim_resume', label: '시뮬 재개' },
  { value: 'sim_reset', label: '시뮬 리셋' },
];

function severityColor(severity: AuditSeverity): string {
  switch (severity) {
    case 'error':
      return 'text-[var(--color-error)]';
    case 'warning':
      return 'text-[var(--color-warning)]';
    default:
      return 'text-[var(--color-info)]';
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', { hour12: false });
}

export function RuntimeAuditLogPanel() {
  const [entries, setEntries] = useState<RuntimeAuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [severity, setSeverity] = useState<'' | AuditSeverity>('');
  const [eventType, setEventType] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await runtimeAuditService.query({
        severity: severity || undefined,
        eventType: eventType || undefined,
        search: search.trim() || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setEntries(result.entries);
      setTotalCount(result.totalCount);
    } catch {
      // 에러 토스트는 서비스에서 처리.
    } finally {
      setLoading(false);
    }
  }, [severity, eventType, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-primary)]">
      {/* 툴바 */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--color-border)] flex-shrink-0">
        <select
          className="h-7 px-1.5 text-xs rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
        >
          {EVENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="h-7 px-1.5 text-xs rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as '' | AuditSeverity)}
        >
          {SEVERITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="검색..."
          className="h-7 flex-1 min-w-0 px-2 text-xs rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          onClick={() => void load()}
          disabled={loading}
          title="새로고침"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-auto text-xs">
        {entries.length === 0 ? (
          <div className="text-[var(--color-text-muted)] text-center py-6">
            {loading ? '불러오는 중...' : '감사 기록 없음'}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[var(--color-bg-secondary)]">
              <tr className="text-left text-[var(--color-text-muted)]">
                <th className="px-2 py-1 font-medium">시각</th>
                <th className="px-2 py-1 font-medium">이벤트</th>
                <th className="px-2 py-1 font-medium">내용</th>
                <th className="px-2 py-1 font-medium">상세</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
                >
                  <td className="px-2 py-1 whitespace-nowrap text-[var(--color-text-muted)] font-mono">
                    {formatTimestamp(e.timestamp)}
                  </td>
                  <td className={`px-2 py-1 whitespace-nowrap font-medium ${severityColor(e.severity)}`}>
                    {e.eventType ?? '-'}
                  </td>
                  <td className="px-2 py-1 text-[var(--color-text-primary)]">{e.message}</td>
                  <td className="px-2 py-1 text-[var(--color-text-muted)] font-mono truncate max-w-[16rem]">
                    {e.detail ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 상태바 */}
      <div className="h-6 flex items-center px-2 border-t border-[var(--color-border)] flex-shrink-0 text-[10px] text-[var(--color-text-muted)]">
        {entries.length}/{totalCount}건 표시 (최대 {PAGE_SIZE})
      </div>
    </div>
  );
}
