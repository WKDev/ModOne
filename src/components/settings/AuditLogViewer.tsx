/**
 * AuditLogViewer - Virtual-scrolled audit log viewer with filters
 *
 * Uses @tanstack/react-virtual to efficiently render only visible rows,
 * supporting thousands of audit log entries smoothly. Provides event type
 * filter, date range filter, category filter, severity filter, and search.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Filter,
  Info,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { opcuaService } from '../../services/opcuaService';
import {
  AUDIT_EVENT_TYPES,
  AUDIT_EVENT_TYPE_LABELS,
} from '../../services/opcuaService';
import type {
  AuditEventCategory,
  AuditEventType,
  AuditLogEntry,
  AuditLogQuery,
  AuditLogResult,
  AuditSeverity,
} from '../../services/opcuaService';

// ============================================================================
// Constants
// ============================================================================

/** Large batch size for virtual scroll — fetch many entries, let virtualizer handle display */
const BATCH_SIZE = 500;

/** Height of each audit log row in pixels (for virtualizer) */
const ROW_HEIGHT = 36;

const CATEGORY_LABELS: Record<AuditEventCategory, string> = {
  server_lifecycle: '서버 수명주기',
  session: '세션',
  authentication: '인증',
  configuration: '설정',
  security: '보안',
};

const CATEGORY_COLORS: Record<AuditEventCategory, string> = {
  server_lifecycle: 'bg-blue-500/15 text-blue-400',
  session: 'bg-purple-500/15 text-purple-400',
  authentication: 'bg-amber-500/15 text-amber-400',
  configuration: 'bg-emerald-500/15 text-emerald-400',
  security: 'bg-red-500/15 text-red-400',
};

const SEVERITY_ICONS: Record<AuditSeverity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

const SEVERITY_COLORS: Record<AuditSeverity, string> = {
  info: 'text-[var(--text-muted)]',
  warning: 'text-[var(--color-warning,#e5a100)]',
  error: 'text-[var(--color-error,#e53935)]',
};

const EVENT_TYPE_LABELS: Record<AuditEventType, string> = AUDIT_EVENT_TYPE_LABELS;

const EVENT_TYPE_COLORS: Record<AuditEventType, string> = {
  server_start: 'bg-blue-500/15 text-blue-400',
  server_stop: 'bg-blue-500/15 text-blue-300',
  client_connect: 'bg-purple-500/15 text-purple-400',
  client_disconnect: 'bg-purple-500/15 text-purple-300',
  auth_success: 'bg-emerald-500/15 text-emerald-400',
  auth_failure: 'bg-red-500/15 text-red-400',
  config_change: 'bg-amber-500/15 text-amber-400',
  security_event: 'bg-red-500/15 text-red-300',
  other: 'bg-gray-500/15 text-gray-400',
};

/** Map event types to their parent categories for contextual filtering. */
const EVENT_TYPE_TO_CATEGORY: Record<AuditEventType, AuditEventCategory> = {
  server_start: 'server_lifecycle',
  server_stop: 'server_lifecycle',
  client_connect: 'session',
  client_disconnect: 'session',
  auth_success: 'authentication',
  auth_failure: 'authentication',
  config_change: 'configuration',
  security_event: 'security',
  other: 'security',
};

/** Convert a local date input value (YYYY-MM-DD) to an ISO-8601 start-of-day timestamp. */
function dateToIsoStart(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toISOString();
}

/** Convert a local date input value (YYYY-MM-DD) to an ISO-8601 end-of-day timestamp. */
function dateToIsoEnd(dateStr: string): string {
  return new Date(dateStr + 'T23:59:59.999').toISOString();
}

/** Format a Date as YYYY-MM-DD in local timezone. */
function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format today's date as YYYY-MM-DD in local timezone. */
function todayStr(): string {
  return toDateInputValue(new Date());
}

// ============================================================================
// Component
// ============================================================================

interface AuditLogViewerProps {
  searchFilter?: string;
}

export function AuditLogViewer({ searchFilter = '' }: AuditLogViewerProps) {
  // Data state — entries accumulates for virtual scroll (infinite loading)
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<AuditEventCategory | ''>('');
  const [eventTypeFilter, setEventTypeFilter] = useState<AuditEventType | ''>('');
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | ''>('');
  const [userFilter, setUserFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Retention settings state
  const [showRetention, setShowRetention] = useState(false);
  const [retentionDays, setRetentionDays] = useState<number>(90);
  const [retentionInput, setRetentionInput] = useState<string>('90');
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const retentionSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll ref for virtualizer
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Build query from current filter state
  const buildQuery = useCallback(
    (offset: number): AuditLogQuery => {
      const query: AuditLogQuery = {
        limit: BATCH_SIZE,
        offset,
      };
      if (categoryFilter) query.category = categoryFilter;
      if (eventTypeFilter) query.eventType = eventTypeFilter;
      if (severityFilter) query.severity = severityFilter;
      if (dateFrom) query.from = dateToIsoStart(dateFrom);
      if (dateTo) query.to = dateToIsoEnd(dateTo);
      // Combine user filter with search text
      const searchParts: string[] = [];
      if (userFilter.trim()) searchParts.push(userFilter.trim());
      if (searchText.trim()) searchParts.push(searchText.trim());
      if (searchParts.length) query.search = searchParts.join(' ');
      return query;
    },
    [categoryFilter, eventTypeFilter, severityFilter, dateFrom, dateTo, userFilter, searchText]
  );

  // Initial fetch (resets entries for new filter state)
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = buildQuery(0);
      const data: AuditLogResult = await opcuaService.queryAuditLog(query);
      setEntries(data.entries);
      setTotalCount(data.totalCount);
      setHasMore(data.entries.length < data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  // Load more entries (append to existing — triggered by virtual scroll near bottom)
  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const query = buildQuery(entries.length);
      const data: AuditLogResult = await opcuaService.queryAuditLog(query);
      setEntries((prev) => [...prev, ...data.entries]);
      setTotalCount(data.totalCount);
      setHasMore(entries.length + data.entries.length < data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingMore(false);
    }
  }, [buildQuery, entries.length, loadingMore, hasMore]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When category changes, clear event type if it doesn't belong to selected category
  useEffect(() => {
    if (categoryFilter && eventTypeFilter) {
      if (EVENT_TYPE_TO_CATEGORY[eventTypeFilter] !== categoryFilter) {
        setEventTypeFilter('');
      }
    }
  }, [categoryFilter, eventTypeFilter]);

  /** Event types available for the dropdown, filtered by selected category. */
  const availableEventTypes = useMemo(() => {
    if (!categoryFilter) return AUDIT_EVENT_TYPES;
    return AUDIT_EVENT_TYPES.filter((t) => EVENT_TYPE_TO_CATEGORY[t] === categoryFilter);
  }, [categoryFilter]);

  /** Whether any filter is active (for badge indicator on the filter button). */
  const hasActiveFilters = !!(categoryFilter || eventTypeFilter || severityFilter || dateFrom || dateTo || userFilter || searchText);

  /** Active filter count for badge display. */
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (categoryFilter) count++;
    if (eventTypeFilter) count++;
    if (severityFilter) count++;
    if (userFilter) count++;
    if (searchText.trim()) count++;
    if (dateFrom || dateTo) count++;
    return count;
  }, [categoryFilter, eventTypeFilter, severityFilter, userFilter, searchText, dateFrom, dateTo]);

  /** Clear all filters at once. */
  const clearAllFilters = useCallback(() => {
    setCategoryFilter('');
    setEventTypeFilter('');
    setSeverityFilter('');
    setUserFilter('');
    setDateFrom('');
    setDateTo('');
    setSearchText('');
  }, []);

  /** Quick date preset: set date range to last N days. */
  const setDatePreset = useCallback((daysBack: number) => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - daysBack);
    setDateFrom(toDateInputValue(from));
    setDateTo(toDateInputValue(now));
  }, []);

  /** Clear date range filter. */
  const clearDateRange = useCallback(() => {
    setDateFrom('');
    setDateTo('');
  }, []);

  // Virtualizer for efficient rendering
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  });

  // Infinite scroll: load more when user scrolls near the bottom
  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    if (virtualItems.length === 0) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem && lastItem.index >= entries.length - 20 && hasMore && !loadingMore) {
      fetchMore();
    }
  }, [virtualItems, entries.length, hasMore, loadingMore, fetchMore]);

  const handleClear = useCallback(async () => {
    if (!window.confirm('모든 감사 로그를 삭제하시겠습니까?')) return;
    setClearing(true);
    try {
      await opcuaService.clearAuditLog();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClearing(false);
    }
  }, [fetchData]);

  // Fetch retention days on mount
  useEffect(() => {
    let cancelled = false;
    setRetentionLoading(true);
    opcuaService
      .getAuditRetentionDays()
      .then((days) => {
        if (!cancelled) {
          setRetentionDays(days);
          setRetentionInput(String(days));
        }
      })
      .catch(() => {
        // Silently fail — default stays at 90
      })
      .finally(() => {
        if (!cancelled) setRetentionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (retentionSaveTimeout.current) clearTimeout(retentionSaveTimeout.current);
    };
  }, []);

  const handleRetentionChange = useCallback(
    (value: string) => {
      setRetentionInput(value);
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed < 1) return;

      // Debounce save by 800ms
      if (retentionSaveTimeout.current) clearTimeout(retentionSaveTimeout.current);
      retentionSaveTimeout.current = setTimeout(async () => {
        setRetentionSaving(true);
        try {
          const deleted = await opcuaService.setAuditRetentionDays(parsed);
          setRetentionDays(parsed);
          if (deleted > 0) {
            // Refresh audit log to reflect deletions
            fetchData();
          }
        } catch {
          // Revert input on failure
          setRetentionInput(String(retentionDays));
        } finally {
          setRetentionSaving(false);
        }
      }, 800);
    },
    [retentionDays, fetchData]
  );

  const handleRetentionBlur = useCallback(() => {
    const parsed = parseInt(retentionInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      setRetentionInput(String(retentionDays));
    }
  }, [retentionInput, retentionDays]);

  // Apply parent search filter visibility
  const filter = searchFilter.toLowerCase();
  if (
    filter &&
    !['audit', 'log', '감사', '로그', 'event', '이벤트'].some((k) =>
      k.includes(filter)
    )
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-[var(--text-muted)]" />
          <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            감사 로그 (Audit Log)
          </h4>
          {totalCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
              {totalCount.toLocaleString()}건
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1 rounded transition-colors relative ${
              showFilters || hasActiveFilters
                ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
            }`}
            title="필터"
          >
            <Filter size={14} />
            {activeFilterCount > 0 && !showFilters && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--accent-color)] text-white text-[8px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowRetention(!showRetention)}
            className={`p-1 rounded transition-colors ${
              showRetention
                ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
            }`}
            title="보관 설정"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleClear}
            disabled={clearing || !totalCount}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--color-error,#e53935)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
            title="로그 삭제"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="space-y-2 px-3 py-2 rounded bg-[var(--bg-secondary)] shrink-0">
          {/* Row 1: Category, Event Type, Severity */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as AuditEventCategory | '')
              }
              className="text-xs px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)]"
            >
              <option value="">모든 카테고리</option>
              {(
                Object.entries(CATEGORY_LABELS) as [AuditEventCategory, string][]
              ).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={eventTypeFilter}
              onChange={(e) =>
                setEventTypeFilter(e.target.value as AuditEventType | '')
              }
              className="text-xs px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)]"
            >
              <option value="">모든 이벤트</option>
              {availableEventTypes.map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={(e) =>
                setSeverityFilter(e.target.value as AuditSeverity | '')
              }
              className="text-xs px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)]"
            >
              <option value="">모든 수준</option>
              <option value="info">Info 이상</option>
              <option value="warning">Warning 이상</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Row 2: Date range with presets */}
          <div className="flex flex-wrap items-center gap-2">
            <Calendar size={12} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || todayStr()}
              className="text-xs px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)]"
              title="시작 날짜"
            />
            <span className="text-xs text-[var(--text-muted)]">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              max={todayStr()}
              className="text-xs px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)]"
              title="종료 날짜"
            />
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => setDatePreset(1)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-colors"
              >
                1일
              </button>
              <button
                onClick={() => setDatePreset(7)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-colors"
              >
                7일
              </button>
              <button
                onClick={() => setDatePreset(30)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-colors"
              >
                30일
              </button>
              {(dateFrom || dateTo) && (
                <button
                  onClick={clearDateRange}
                  className="text-[10px] px-1.5 py-0.5 rounded text-[var(--text-muted)] hover:text-[var(--color-error,#e53935)] transition-colors"
                  title="날짜 필터 초기화"
                >
                  초기화
                </button>
              )}
            </div>
          </div>

          {/* Row 3: User filter + free-text search + clear */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[120px]">
              <User
                size={12}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="text"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="사용자..."
                className="w-full text-xs pl-6 pr-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] placeholder:text-[var(--text-muted)]"
              />
            </div>
            <div className="relative flex-1 min-w-[140px]">
              <Search
                size={12}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="검색..."
                className="w-full text-xs pl-6 pr-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] placeholder:text-[var(--text-muted)]"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
                title="필터 초기화"
              >
                <X size={10} />
                초기화
              </button>
            )}
          </div>
        </div>
      )}

      {/* Retention Settings */}
      {showRetention && (
        <div className="flex items-center gap-3 px-3 py-2 rounded bg-[var(--bg-secondary)] shrink-0">
          <Calendar size={14} className="text-[var(--text-muted)] shrink-0" />
          <label className="text-xs text-[var(--text-primary)] whitespace-nowrap">
            보관 기간
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={3650}
              value={retentionInput}
              onChange={(e) => handleRetentionChange(e.target.value)}
              onBlur={handleRetentionBlur}
              disabled={retentionLoading || retentionSaving}
              className="w-16 text-xs text-center px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] disabled:opacity-50
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-xs text-[var(--text-muted)]">일</span>
          </div>
          {retentionSaving && (
            <span className="text-[10px] text-[var(--text-muted)]">저장 중...</span>
          )}
          {!retentionSaving && retentionDays !== 90 && (
            <span className="text-[10px] text-[var(--text-muted)]">
              (기본: 90일)
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-[var(--color-error,#e53935)] px-3 py-2 rounded bg-[var(--color-error,#e53935)]/5 shrink-0">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Virtual-scrolled entries */}
      {loading && entries.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)] py-4 text-center">
          로딩 중...
        </div>
      ) : entries.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)] py-4 text-center">
          감사 로그가 없습니다.
        </div>
      ) : (
        <>
          {/* Scroll container for virtualized list */}
          <div
            ref={scrollContainerRef}
            className="overflow-auto rounded border border-[var(--border-color)]"
            style={{ maxHeight: '400px' }}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const entry = entries[virtualRow.index];
                return (
                  <VirtualAuditLogRow
                    key={entry.id}
                    entry={entry}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Footer info */}
          <div className="flex items-center justify-between pt-1 shrink-0">
            <span className="text-[10px] text-[var(--text-muted)]">
              {entries.length.toLocaleString()} / {totalCount.toLocaleString()}건 로드됨
            </span>
            <div className="flex items-center gap-2">
              {loadingMore && (
                <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                  <RefreshCw size={10} className="animate-spin" />
                  추가 로드 중...
                </span>
              )}
              {hasMore && !loadingMore && (
                <button
                  onClick={fetchMore}
                  className="text-[10px] text-[var(--accent-color)] hover:underline"
                >
                  더 불러오기
                </button>
              )}
              {!hasMore && entries.length > 0 && !loadingMore && (
                <span className="text-[10px] text-[var(--text-muted)]">
                  모든 항목 로드 완료
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Virtualized Row Component (memoized for performance)
// ============================================================================

const VirtualAuditLogRow = memo(function VirtualAuditLogRow({
  entry,
  style,
}: {
  entry: AuditLogEntry;
  style: React.CSSProperties;
}) {
  const [expanded, setExpanded] = useState(false);
  const SevIcon = SEVERITY_ICONS[entry.severity];
  const sevColor = SEVERITY_COLORS[entry.severity];

  // Prefer event type badge, fallback to category
  const badgeLabel = entry.eventType
    ? (EVENT_TYPE_LABELS[entry.eventType] ?? entry.eventType)
    : (CATEGORY_LABELS[entry.category] ?? entry.category);
  const badgeColor = entry.eventType
    ? (EVENT_TYPE_COLORS[entry.eventType] ?? 'bg-gray-500/15 text-gray-400')
    : (CATEGORY_COLORS[entry.category] ?? 'bg-gray-500/15 text-gray-400');

  const formattedTime = useMemo(() => {
    try {
      const d = new Date(entry.timestamp);
      return d.toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return entry.timestamp;
    }
  }, [entry.timestamp]);

  return (
    <div
      style={style}
      className="group flex flex-col px-2 py-1.5 rounded hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
      onClick={() => entry.detail && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <SevIcon size={13} className={`shrink-0 mt-0.5 ${sevColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${badgeColor}`}
            >
              {badgeLabel}
            </span>
            <span className="text-xs text-[var(--text-primary)] truncate">
              {entry.message}
            </span>
          </div>
          {expanded && entry.detail && (
            <div className="text-[11px] text-[var(--text-secondary)] mt-1 pl-0.5 break-all whitespace-pre-wrap">
              {entry.detail}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {entry.clientInfo?.ipAddress && (
            <span className="text-[10px] text-[var(--text-muted)] hidden group-hover:inline">
              {entry.clientInfo.ipAddress}
            </span>
          )}
          {entry.source && (
            <span className="text-[10px] text-[var(--text-muted)] hidden group-hover:inline">
              {entry.source}
            </span>
          )}
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums flex items-center gap-0.5">
            <Clock size={10} />
            {formattedTime}
          </span>
        </div>
      </div>
    </div>
  );
});
