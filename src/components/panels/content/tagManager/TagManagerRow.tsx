// 우측 도크 Tag Manager의 단일 태그 행 (이름·주소·값·즐겨찾기 토글)

import { memo } from 'react';
import { Star } from 'lucide-react';
import type { TagDefinition, TagTypedValue } from '../../../../types/tags';

/** { area: "M", index: 0, bitIndex: 3 } => "M0.3" */
function formatAddress(addr: TagDefinition['canonicalAddress']): string {
  const base = `${addr.area}${addr.index}`;
  return addr.bitIndex != null ? `${base}.${addr.bitIndex}` : base;
}

function formatValue(value: TagTypedValue | undefined): string {
  if (!value) return '—';
  if (value.type === 'bool') return value.data ? 'true' : 'false';
  return String(value.data);
}

export interface TagManagerRowProps {
  tag: TagDefinition;
  isWatched: boolean;
  value: TagTypedValue | undefined;
  onToggleWatch: (tagId: string) => void;
}

export const TagManagerRow = memo(function TagManagerRow({
  tag,
  isWatched,
  value,
  onToggleWatch,
}: TagManagerRowProps) {
  return (
    <div className="group flex items-center gap-2 px-2 py-1 text-xs border-b border-[var(--color-border)]/40 hover:bg-[var(--color-bg-tertiary)]">
      <button
        className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors ${
          isWatched
            ? 'text-[var(--color-accent)]'
            : 'text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-text-primary)]'
        }`}
        title={isWatched ? 'Unwatch' : 'Watch'}
        onClick={() => onToggleWatch(tag.tagId)}
      >
        <Star size={13} fill={isWatched ? 'currentColor' : 'none'} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="truncate text-[var(--color-text-primary)]">{tag.displayName}</div>
        <div className="truncate text-[10px] text-[var(--color-text-muted)]">
          {formatAddress(tag.canonicalAddress)}
          <span className="ml-1 opacity-70">· {tag.class}</span>
        </div>
      </div>

      {isWatched && (
        <div className="flex-shrink-0 font-mono text-[var(--color-text-secondary)] tabular-nums">
          {formatValue(value)}
        </div>
      )}
    </div>
  );
});
