// 우측 도크용 경량 Tag Manager — 태그 목록/검색/즐겨찾기(watch)/빠른 추가
// 전체화면 tag-browser와 역할 구분: 인스펙터로 상주하며 빠른 조회/감시에 집중한다.

import { useEffect, useMemo, useState } from 'react';
import { Plus, Star, RefreshCw } from 'lucide-react';
import {
  useTagStore,
  selectTagValues,
  selectWatchedTagIds,
  selectIsLoadingRegistry,
} from '../../../stores/tagStore';
import { useTagSearch } from '../../../hooks/useTagSearch';
import type { CreateTagRequest } from '../../../types/tags';
import { TagManagerRow } from './tagManager/TagManagerRow';
import { QuickAddTagForm } from './tagManager/QuickAddTagForm';

export function TagManagerPanel() {
  const fetchRegistry = useTagStore((s) => s.fetchRegistry);
  const registry = useTagStore((s) => s.registry);
  const addWatchedTags = useTagStore((s) => s.addWatchedTags);
  const removeWatchedTags = useTagStore((s) => s.removeWatchedTags);
  const createTag = useTagStore((s) => s.createTag);
  const watchedTagIds = useTagStore(selectWatchedTagIds);
  const tagValues = useTagStore(selectTagValues);
  const isLoading = useTagStore(selectIsLoadingRegistry);

  const [search, setSearch] = useState('');
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const { results } = useTagSearch(search);

  // Fetch the registry once if it hasn't been loaded yet.
  useEffect(() => {
    if (registry.length === 0) {
      fetchRegistry();
    }
  }, [registry.length, fetchRegistry]);

  const visible = useMemo(
    () => (watchedOnly ? results.filter((t) => watchedTagIds.has(t.tagId)) : results),
    [results, watchedOnly, watchedTagIds],
  );

  const toggleWatch = (tagId: string) => {
    if (watchedTagIds.has(tagId)) removeWatchedTags([tagId]);
    else addWatchedTags([tagId]);
  };

  const handleAdd = (request: CreateTagRequest) => {
    createTag(request);
    setShowAdd(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-1 p-1.5 border-b border-[var(--color-border)]">
        <input
          className="flex-1 min-w-0 px-2 py-1 text-xs rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none text-[var(--color-text-primary)]"
          placeholder="Search tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className={`w-7 h-7 flex-shrink-0 flex items-center justify-center rounded hover:bg-[var(--color-bg-tertiary)] ${
            watchedOnly ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
          }`}
          title="Show watched only"
          onClick={() => setWatchedOnly((v) => !v)}
        >
          <Star size={14} fill={watchedOnly ? 'currentColor' : 'none'} />
        </button>
        <button
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          title="Add tag"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus size={14} />
        </button>
      </div>

      {showAdd && <QuickAddTagForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && registry.length === 0 ? (
          <EmptyState icon={<RefreshCw size={16} className="animate-spin" />} text="Loading tags…" />
        ) : visible.length === 0 ? (
          <EmptyState text={watchedOnly ? 'No watched tags' : 'No tags'} />
        ) : (
          visible.map((tag) => (
            <TagManagerRow
              key={tag.tagId}
              tag={tag}
              isWatched={watchedTagIds.has(tag.tagId)}
              value={tagValues.get(tag.tagId)}
              onToggleWatch={toggleWatch}
            />
          ))
        )}
      </div>

      {/* Footer count */}
      <div className="flex-shrink-0 px-2 py-1 text-[10px] text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
        {visible.length} {visible.length === 1 ? 'tag' : 'tags'}
        {watchedTagIds.size > 0 && ` · ${watchedTagIds.size} watched`}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-[var(--color-text-muted)] text-xs">
      {icon}
      <span>{text}</span>
    </div>
  );
}
