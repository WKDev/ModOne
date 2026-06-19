import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Info, Eye, EyeOff, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { useTagStore, selectTagRegistry, selectWatchedTagIds } from '../../../../stores/tagStore';
import { useTagSubscription } from '../../../../hooks/useTagSubscription';
import { useDeleteTag } from '../../../../hooks/useDeleteTag';
import type { TagDefinition, TagTypedValue } from '../../../../types/tags';
import { toast } from 'sonner';
import { MonitoringDropZone } from './MonitoringDropZone';
import { WatchListTable } from './WatchListTable';
import { TagReadOnlyFields } from './TagReadOnlyFields';
import { OpcUaMappingSection } from './OpcUaMappingSection';

// ============================================================================
// Types
// ============================================================================

interface TagDetailPanelProps {
  selectedTagId: string | null;
  /** Called after a tag is successfully deleted, so parent can clear selection */
  onTagDeleted?: (tagId: string) => void;
  /** Whether the create-tag form is shown */
  isCreating?: boolean;
  /** Cancel creation mode */
  onCancelCreate?: () => void;
  /** Called after a tag is successfully created, with the new tag ID */
  onTagCreated?: (tagId: string) => void;
}

// ============================================================================
// Sub-components
// ============================================================================

/** Property row for the detail view */
const PropertyRow = memo(function PropertyRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-xs text-[var(--color-text-muted)] w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <span
        className={`text-xs break-all ${
          muted
            ? 'text-[var(--color-text-muted)] italic'
            : 'text-[var(--color-text-primary)]'
        }`}
      >
        {value}
      </span>
    </div>
  );
});

/**
 * Single editable property field with blur-triggered auto-save.
 *
 * Renders an inline input that looks like a static label until focused.
 * On blur or Enter, calls onSave if the trimmed value differs from the original.
 * Escape reverts to the original value and blurs the field.
 * A commit guard prevents double-save when Enter triggers blur.
 */
const EditableField = memo(function EditableField({
  label,
  value,
  placeholder,
  onSave,
  multiline = false,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (newValue: string) => void;
  multiline?: boolean;
}) {
  const [localValue, setLocalValue] = useState(value);
  const prevValueRef = useRef(value);
  // Guard against double-commit when Enter handler triggers blur synchronously
  const isCommittingRef = useRef(false);

  // Sync local state when external value changes (e.g. after backend save or tag switch)
  useEffect(() => {
    if (value !== prevValueRef.current) {
      setLocalValue(value);
      prevValueRef.current = value;
    }
  }, [value]);

  const commitIfChanged = useCallback(() => {
    if (isCommittingRef.current) return;
    const trimmed = localValue.trim();
    if (trimmed !== value) {
      isCommittingRef.current = true;
      onSave(trimmed);
      prevValueRef.current = trimmed;
      // Reset guard after microtask so blur (which fires synchronously
      // after the Enter keydown handler) is safely de-duped
      queueMicrotask(() => {
        isCommittingRef.current = false;
      });
    }
  }, [localValue, value, onSave]);

  const handleBlur = useCallback(() => {
    commitIfChanged();
  }, [commitIfChanged]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault();
        commitIfChanged();
        (e.target as HTMLElement).blur();
      } else if (e.key === 'Escape') {
        setLocalValue(value);
        (e.target as HTMLElement).blur();
      }
    },
    [value, multiline, commitIfChanged],
  );

  const inputClassName =
    'w-full text-xs bg-[var(--color-bg-tertiary)] border border-transparent ' +
    'focus:border-[var(--color-accent)] rounded px-2 py-1 ' +
    'text-[var(--color-text-primary)] outline-none transition-colors ' +
    'placeholder:text-[var(--color-text-muted)] placeholder:italic';

  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-xs text-[var(--color-text-muted)] w-28 shrink-0 pt-1">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className={inputClassName + ' resize-none'}
        />
      ) : (
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClassName}
        />
      )}
    </div>
  );
});

/**
 * Editable fields section for semantic tag metadata.
 *
 * Uses the store's updateTagDefinition action for efficient
 * in-place registry update (no full refetch needed).
 */
const EditableTagFields = memo(function EditableTagFields({
  tag,
}: {
  tag: TagDefinition;
}) {
  const updateTagDefinition = useTagStore((s) => s.updateTagDefinition);

  const handleSaveField = useCallback(
    async (field: 'displayName' | 'description' | 'engineeringUnit' | 'folderPath', newValue: string) => {
      // Validate displayName is not empty
      if (field === 'displayName' && !newValue) {
        toast.error('표시 이름 필수', { description: '표시 이름은 비워둘 수 없습니다' });
        return;
      }

      const request: { tagId: string; displayName?: string; description?: string | null; engineeringUnit?: string | null; folderPath?: string | null } = {
        tagId: tag.tagId,
      };

      if (field === 'displayName') {
        request.displayName = newValue;
      } else if (field === 'description') {
        // Empty string clears the field (sends null to backend)
        request.description = newValue || null;
      } else if (field === 'engineeringUnit') {
        request.engineeringUnit = newValue || null;
      } else if (field === 'folderPath') {
        request.folderPath = newValue || null;
      }

      // Store action calls service (with toast error) and updates registry in-place
      await updateTagDefinition(request);
    },
    [tag.tagId, updateTagDefinition],
  );

  const handleSaveDisplayName = useCallback(
    (v: string) => handleSaveField('displayName', v),
    [handleSaveField],
  );
  const handleSaveDescription = useCallback(
    (v: string) => handleSaveField('description', v),
    [handleSaveField],
  );
  const handleSaveUnit = useCallback(
    (v: string) => handleSaveField('engineeringUnit', v),
    [handleSaveField],
  );
  const handleSaveFolderPath = useCallback(
    (v: string) => handleSaveField('folderPath', v),
    [handleSaveField],
  );

  return (
    <>
      <EditableField
        label="표시 이름"
        value={tag.displayName}
        placeholder="표시 이름 입력"
        onSave={handleSaveDisplayName}
      />
      <EditableField
        label="폴더 경로"
        value={tag.folderPath ?? ''}
        placeholder="예: Plant.Area1.Motors"
        onSave={handleSaveFolderPath}
      />
      <EditableField
        label="설명"
        value={tag.description ?? ''}
        placeholder="설명 입력 (선택사항)"
        onSave={handleSaveDescription}
        multiline
      />
      <EditableField
        label="엔지니어링 단위"
        value={tag.engineeringUnit ?? ''}
        placeholder="예: \u00B0C, bar, mm"
        onSave={handleSaveUnit}
      />
    </>
  );
});

// ============================================================================
// Create Tag Form
// ============================================================================

const CreateTagForm = memo(function CreateTagForm({
  onCreated,
  onCancel,
}: {
  onCreated: (tagId: string) => void;
  onCancel: () => void;
}) {
  const createTag = useTagStore((s) => s.createTag);
  const registry = useTagStore(selectTagRegistry);

  const [displayName, setDisplayName] = useState('');
  const [area, setArea] = useState('DataWord');
  const [index, setIndex] = useState('0');
  const [bitIndex, setBitIndex] = useState('');
  const [access, setAccess] = useState<'read' | 'readwrite'>('readwrite');
  const [description, setDescription] = useState('');
  const [engineeringUnit, setEngineeringUnit] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!displayName.trim()) {
      setError('표시 이름은 필수입니다');
      return;
    }
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0) {
      setError('인덱스는 0 이상의 정수여야 합니다');
      return;
    }
    const bit = bitIndex.trim() ? parseInt(bitIndex, 10) : undefined;
    if (bit !== undefined && (isNaN(bit) || bit < 0 || bit > 15)) {
      setError('비트 인덱스는 0-15 범위여야 합니다');
      return;
    }

    // Duplicate address check (client-side)
    const addrStr = `${area}:${idx}${bit !== undefined ? `.${bit}` : ''}`;
    const dup = registry.find((t) => {
      const ta = t.canonicalAddress;
      const tAddr = `${ta.area}:${ta.index}${ta.bitIndex !== undefined ? `.${ta.bitIndex}` : ''}`;
      return tAddr === addrStr;
    });
    if (dup) {
      setError(`주소 ${addrStr}는 이미 "${dup.displayName}" 태그에 사용 중입니다`);
      return;
    }

    setIsSubmitting(true);
    const created = await createTag({
      displayName: displayName.trim(),
      area,
      index: idx,
      bitIndex: bit,
      access,
      description: description.trim() || undefined,
      engineeringUnit: engineeringUnit.trim() || undefined,
      folderPath: folderPath.trim() || undefined,
    });
    setIsSubmitting(false);

    if (created) {
      onCreated(created.tagId);
    }
  }, [displayName, area, index, bitIndex, access, description, engineeringUnit, folderPath, registry, createTag, onCreated]);

  const inputClass =
    'w-full text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] ' +
    'focus:border-[var(--color-accent)] rounded px-2 py-1.5 ' +
    'text-[var(--color-text-primary)] outline-none transition-colors ' +
    'placeholder:text-[var(--color-text-muted)] placeholder:italic';

  const AREA_OPTIONS = [
    'InputBit', 'OutputBit', 'InternalBit', 'RetentiveBit', 'SpecialBit',
    'DataWord', 'RetentiveWord', 'IndexWord',
    'TimerDoneBit', 'TimerValueWord', 'CounterDoneBit', 'CounterValueWord',
    'SystemBit', 'SystemWord',
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <Plus size={12} className="text-[var(--color-accent)]" />
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
          새 태그 생성
        </span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {error && (
          <div className="text-xs text-red-400 bg-red-400/10 rounded px-2 py-1.5">
            {error}
          </div>
        )}

        <div>
          <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">
            표시 이름 *
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="예: motor_run"
            className={inputClass}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">
              영역 (Area) *
            </label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className={inputClass + ' cursor-pointer'}
            >
              {AREA_OPTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">
              인덱스 *
            </label>
            <input
              type="number"
              value={index}
              onChange={(e) => setIndex(e.target.value)}
              min={0}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">
              비트 인덱스 (선택)
            </label>
            <input
              type="number"
              value={bitIndex}
              onChange={(e) => setBitIndex(e.target.value)}
              min={0}
              max={15}
              placeholder="0-15"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">
              접근 권한
            </label>
            <select
              value={access}
              onChange={(e) => setAccess(e.target.value as 'read' | 'readwrite')}
              className={inputClass + ' cursor-pointer'}
            >
              <option value="readwrite">Read/Write</option>
              <option value="read">Read Only</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">
            설명 (선택)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="태그 설명"
            rows={2}
            className={inputClass + ' resize-none'}
          />
        </div>

        <div>
          <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">
            엔지니어링 단위 (선택)
          </label>
          <input
            type="text"
            value={engineeringUnit}
            onChange={(e) => setEngineeringUnit(e.target.value)}
            placeholder="예: °C, bar, mm"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">
            폴더 경로 (선택)
          </label>
          <input
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="예: Plant.Area1.Motors"
            className={inputClass}
          />
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
            OPC UA Address Space 계층 구조 (점으로 구분)
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? '생성 중...' : '태그 생성'}
          </button>
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
});

/** Format tag value for display */
function formatTagValue(value: TagTypedValue | undefined): string {
  if (!value) return '\u2014';
  if (value.type === 'bool') return value.data ? 'TRUE' : 'FALSE';
  return String(value.data);
}

/** Get CSS class for value display based on type */
function getValueColorClass(value: TagTypedValue | undefined): string {
  if (!value) return 'text-[var(--color-text-muted)]';
  if (value.type === 'bool') {
    return value.data
      ? 'text-green-400'
      : 'text-[var(--color-text-muted)]';
  }
  return 'text-[var(--color-text-primary)]';
}

// ============================================================================
// Tag Monitor Subpanel
// ============================================================================

const TagMonitorView = memo(function TagMonitorView({
  tag,
}: {
  tag: TagDefinition;
}) {
  const tagIds = useMemo(() => [tag.tagId], [tag.tagId]);
  const { values } = useTagSubscription(tagIds);
  const writeTag = useTagStore((s) => s.writeTag);
  const watchedTagIds = useTagStore(selectWatchedTagIds);
  const addWatchedTags = useTagStore((s) => s.addWatchedTags);
  const removeWatchedTags = useTagStore((s) => s.removeWatchedTags);

  const currentValue = values.get(tag.tagId);
  const isWatched = watchedTagIds.has(tag.tagId);
  const isWritable = tag.access === 'readwrite';

  // Toggle bool value
  const handleToggleBool = useCallback(async () => {
    if (!isWritable || !currentValue || currentValue.type !== 'bool') return;
    try {
      await writeTag(tag.tagId, { type: 'bool', data: !currentValue.data });
    } catch {
      // Error already toasted by service
    }
  }, [isWritable, currentValue, writeTag, tag.tagId]);

  // Write u16 value on Enter
  const [editingValue, setEditingValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEdit = useCallback(() => {
    if (!isWritable || !currentValue || currentValue.type !== 'u16') return;
    setEditingValue(String(currentValue.data));
    setIsEditing(true);
  }, [isWritable, currentValue]);

  const handleCommitWrite = useCallback(async () => {
    setIsEditing(false);
    const num = parseInt(editingValue, 10);
    if (isNaN(num) || num < 0 || num > 65535) {
      toast.error('\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uAC12', {
        description: 'u16 \uAC12\uC740 0-65535 \uBC94\uC704\uC5EC\uC57C \uD569\uB2C8\uB2E4',
      });
      return;
    }
    try {
      await writeTag(tag.tagId, { type: 'u16', data: num });
    } catch {
      // Error already toasted by service
    }
  }, [editingValue, writeTag, tag.tagId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCommitWrite();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
      }
    },
    [handleCommitWrite],
  );

  // Toggle watch status
  const handleToggleWatch = useCallback(() => {
    if (isWatched) {
      removeWatchedTags([tag.tagId]);
    } else {
      addWatchedTags([tag.tagId]);
    }
  }, [isWatched, tag.tagId, addWatchedTags, removeWatchedTags]);

  return (
    <div className="border-t border-[var(--color-border)]">
      {/* Monitor header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-1.5">
          <Activity size={12} className="text-[var(--color-accent)]" />
          <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
            모니터링
          </span>
        </div>
        <button
          onClick={handleToggleWatch}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs hover:bg-[var(--color-bg-tertiary)] transition-colors"
          title={isWatched ? '감시 해제' : '감시 추가'}
        >
          {isWatched ? (
            <Eye size={12} className="text-[var(--color-accent)]" />
          ) : (
            <EyeOff size={12} className="text-[var(--color-text-muted)]" />
          )}
          <span className={isWatched ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}>
            {isWatched ? '감시 중' : '감시'}
          </span>
        </button>
      </div>

      {/* Value display */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--color-text-muted)]">현재 값</span>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase">
            {currentValue?.type ?? '\u2014'}
          </span>
        </div>

        {/* Large value display */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <input
              type="number"
              min={0}
              max={65535}
              step={1}
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={handleCommitWrite}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-1 text-2xl font-mono bg-[var(--color-bg-tertiary)] border border-[var(--color-accent)] rounded px-2 py-1 text-[var(--color-text-primary)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          ) : (
            <span
              className={`text-2xl font-mono flex-1 ${getValueColorClass(currentValue)} ${
                isWritable && currentValue?.type === 'u16' ? 'cursor-pointer hover:underline' : ''
              }`}
              onClick={handleStartEdit}
              title={isWritable && currentValue?.type === 'u16' ? '클릭하여 값 편집' : undefined}
            >
              {formatTagValue(currentValue)}
            </span>
          )}

          {/* Toggle button for bool values */}
          {isWritable && currentValue?.type === 'bool' && (
            <button
              onClick={handleToggleBool}
              className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
              title="값 토글"
            >
              {currentValue.data ? (
                <ToggleRight size={24} className="text-green-400" />
              ) : (
                <ToggleLeft size={24} className="text-[var(--color-text-muted)]" />
              )}
            </button>
          )}
        </div>

        {/* Engineering unit */}
        {currentValue && (
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            {tag.engineeringUnit || ''}
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// Tag Detail Panel
// ============================================================================

/**
 * Tag Detail Panel (right side of master-detail layout)
 *
 * Shows tag metadata, live value monitoring, and edit controls
 * for the currently selected tag. Semantic tags have editable
 * displayName, description, and engineeringUnit fields that
 * auto-save on blur via the store's updateTagDefinition action.
 */
export const TagDetailPanel = memo(function TagDetailPanel({
  selectedTagId,
  onTagDeleted,
  isCreating,
  onCancelCreate,
  onTagCreated,
}: TagDetailPanelProps) {
  const registry = useTagStore(selectTagRegistry);

  const { deleteTag } = useDeleteTag({
    onDeleted: onTagDeleted,
  });

  const selectedTag = useMemo(
    () => registry.find((t) => t.tagId === selectedTagId) ?? null,
    [registry, selectedTagId],
  );

  const handleDeleteTag = useCallback(() => {
    if (selectedTag) {
      deleteTag(selectedTag.tagId, selectedTag.displayName);
    }
  }, [selectedTag, deleteTag]);

  // Create mode
  if (isCreating) {
    return (
      <CreateTagForm
        onCreated={onTagCreated ?? (() => {})}
        onCancel={onCancelCreate ?? (() => {})}
      />
    );
  }

  // Empty state - no selection (still a droppable zone)
  if (!selectedTagId || !selectedTag) {
    return (
      <MonitoringDropZone className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2 text-[var(--color-text-muted)]">
          <Info size={32} strokeWidth={1.5} />
          <p className="text-sm">태그를 선택하면 상세 정보가 표시됩니다</p>
          <p className="text-[10px]">태그를 끌어다 놓아 감시 목록에 추가하세요</p>
        </div>
      </MonitoringDropZone>
    );
  }

  const isSemantic = selectedTag.class === 'semantic';

  return (
    <div className="flex flex-col h-full">
      {/* Detail header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <Info size={12} className="text-[var(--color-text-muted)]" />
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
          상세 정보
        </span>
        {/* Only semantic tags can be deleted (raw tags are immutable) */}
        {isSemantic && (
          <button
            onClick={handleDeleteTag}
            className="ml-auto p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="태그 삭제"
            aria-label="Delete tag"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Detail content - scrollable */}
      <div className="flex-1 overflow-auto">
        {/* Properties section */}
        <div className="p-3 space-y-0.5">
          {/* Tag ID is always read-only after creation */}
          <div className="flex items-start gap-2 py-1.5">
            <span className="text-xs text-[var(--color-text-muted)] w-28 shrink-0 pt-1">
              태그 ID
            </span>
            <input
              type="text"
              value={selectedTag.tagId}
              disabled
              className="w-full text-xs bg-[var(--color-bg-tertiary)] border border-transparent rounded px-2 py-1 text-[var(--color-text-muted)] outline-none cursor-not-allowed opacity-70 font-mono"
              title="태그 ID는 생성 후 변경할 수 없습니다"
            />
          </div>

          {/* Semantic tags: editable fields with blur-save; Raw tags: read-only display */}
          {isSemantic ? (
            <EditableTagFields tag={selectedTag} />
          ) : (
            <>
              <PropertyRow label="표시 이름" value={selectedTag.displayName} />
              <PropertyRow
                label="폴더 경로"
                value={selectedTag.folderPath || '없음'}
                muted={!selectedTag.folderPath}
              />
              <PropertyRow
                label="설명"
                value={selectedTag.description || '없음'}
                muted={!selectedTag.description}
              />
              <PropertyRow
                label="엔지니어링 단위"
                value={selectedTag.engineeringUnit || '없음'}
                muted={!selectedTag.engineeringUnit}
              />
            </>
          )}
        </div>

        {/* Read-only fields section (class, address, access, vendor aliases) */}
        <div className="px-3 pb-3 pt-1 border-t border-[var(--color-border)]/50">
          <TagReadOnlyFields tag={selectedTag} />
        </div>

        {/* Collapsible OPC UA Mapping section */}
        <OpcUaMappingSection tag={selectedTag} />

        {/* Monitor subpanel - droppable zone for watch list */}
        <MonitoringDropZone>
          <TagMonitorView tag={selectedTag} />
        </MonitoringDropZone>

        {/* Virtualized watch list table for all watched tags */}
        <div className="border-t border-[var(--color-border)]">
          <WatchListTable />
        </div>
      </div>
    </div>
  );
});

export default TagDetailPanel;
