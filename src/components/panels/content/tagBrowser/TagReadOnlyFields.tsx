import { memo } from 'react';
import { Lock } from 'lucide-react';
import type { TagDefinition } from '../../../../types/tags';

// ============================================================================
// Helper
// ============================================================================

/** Format canonical address for display */
export function formatCanonicalAddress(addr: TagDefinition['canonicalAddress']): string {
  const base = `${addr.area}[${addr.index}]`;
  return addr.bitIndex !== undefined ? `${base}.${addr.bitIndex}` : base;
}

// ============================================================================
// Sub-components
// ============================================================================

/** A single read-only property row with label and value */
const ReadOnlyRow = memo(function ReadOnlyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-xs text-[var(--color-text-muted)] w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-xs text-[var(--color-text-primary)]">{children}</span>
    </div>
  );
});

/** Badge pill for class and access fields */
const Badge = memo(function Badge({
  text,
  variant,
}: {
  text: string;
  variant: 'blue' | 'gray' | 'green' | 'yellow';
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-300',
    gray: 'bg-gray-500/20 text-gray-300',
    green: 'bg-green-500/20 text-green-300',
    yellow: 'bg-yellow-500/20 text-yellow-300',
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colorMap[variant]}`}
    >
      {text}
    </span>
  );
});

// ============================================================================
// TagReadOnlyFields
// ============================================================================

interface TagReadOnlyFieldsProps {
  tag: TagDefinition;
}

/**
 * Read-only fields section of the tag detail panel.
 *
 * Displays non-editable metadata: class, canonicalAddress, access,
 * and vendorAliases. These fields are determined by the PLC driver
 * or tag registration and cannot be changed via the UI.
 */
export const TagReadOnlyFields = memo(function TagReadOnlyFields({
  tag,
}: TagReadOnlyFieldsProps) {
  return (
    <div className="space-y-0.5">
      {/* Section header */}
      <div className="flex items-center gap-1.5 pb-1">
        <Lock size={10} className="text-[var(--color-text-muted)]" />
        <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
          읽기 전용
        </span>
      </div>

      {/* Class */}
      <ReadOnlyRow label="클래스">
        <Badge
          text={tag.class}
          variant={tag.class === 'semantic' ? 'blue' : 'gray'}
        />
      </ReadOnlyRow>

      {/* Canonical Address */}
      <ReadOnlyRow label="주소">
        <code className="text-xs font-mono bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded">
          {formatCanonicalAddress(tag.canonicalAddress)}
        </code>
      </ReadOnlyRow>

      {/* Access */}
      <ReadOnlyRow label="접근">
        <Badge
          text={tag.access}
          variant={tag.access === 'readwrite' ? 'green' : 'yellow'}
        />
      </ReadOnlyRow>

      {/* Vendor Aliases */}
      <ReadOnlyRow label="벤더 별칭">
        {tag.vendorAliases && tag.vendorAliases.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tag.vendorAliases.map((alias) => (
              <span
                key={alias}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              >
                {alias}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-[var(--color-text-muted)] italic">없음</span>
        )}
      </ReadOnlyRow>
    </div>
  );
});

export default TagReadOnlyFields;
