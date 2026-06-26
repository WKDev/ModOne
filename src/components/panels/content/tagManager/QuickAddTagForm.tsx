// Tag Manager 인라인 빠른 추가 폼 (이름·영역·인덱스만 받아 태그 생성)

import { useState } from 'react';
import type { CreateTagRequest } from '../../../../types/tags';

export interface QuickAddTagFormProps {
  onAdd: (request: CreateTagRequest) => void;
  onCancel: () => void;
}

export function QuickAddTagForm({ onAdd, onCancel }: QuickAddTagFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [area, setArea] = useState('');
  const [index, setIndex] = useState('');

  const indexNum = Number(index);
  const isValid =
    displayName.trim() !== '' &&
    area.trim() !== '' &&
    index.trim() !== '' &&
    Number.isInteger(indexNum) &&
    indexNum >= 0;

  const submit = () => {
    if (!isValid) return;
    onAdd({ displayName: displayName.trim(), area: area.trim().toUpperCase(), index: indexNum });
    setDisplayName('');
    setArea('');
    setIndex('');
  };

  const inputCls =
    'px-1.5 py-1 text-xs rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none text-[var(--color-text-primary)]';

  return (
    <div className="flex flex-col gap-1.5 p-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <input
        autoFocus
        className={inputCls}
        placeholder="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <div className="flex gap-1.5">
        <input
          className={`${inputCls} w-16`}
          placeholder="Area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <input
          className={`${inputCls} flex-1`}
          placeholder="Index"
          inputMode="numeric"
          value={index}
          onChange={(e) => setIndex(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <div className="flex gap-1.5 justify-end">
        <button
          className="px-2 py-1 text-xs rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="px-2 py-1 text-xs rounded bg-[var(--color-accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!isValid}
          onClick={submit}
        >
          Add
        </button>
      </div>
    </div>
  );
}
