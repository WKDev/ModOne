import { memo } from 'react';
import type { CategorySectionProps } from '../types';

export const InfoSection = memo(function InfoSection({
  config,
  extra,
}: CategorySectionProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-xs text-[var(--color-text-muted)]">
      <span>{extra?.projectPath || 'Unsaved project'}</span>
      <span>Updated {new Date(config.project.updated_at).toLocaleString()}</span>
    </div>
  );
});
