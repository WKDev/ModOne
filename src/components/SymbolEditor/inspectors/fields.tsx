// 심볼 에디터 인스펙터들이 공유하는 섹션·필드·입력 스타일 프리미티브
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export const inputClass = (hasError?: boolean) =>
  `w-full px-2 py-1.5 bg-neutral-900 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
    hasError ? 'border-red-500' : 'border-neutral-700'
  }`;

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

export function Section({ title, children, defaultOpen = true, badge }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-neutral-700 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-neutral-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">{title}</span>
          {badge && (
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-600/40 text-blue-300 font-medium">
              {badge}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown size={12} className="text-neutral-500" />
        ) : (
          <ChevronRight size={12} className="text-neutral-500" />
        )}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

export function Field({ id: _id, label, required, error, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-neutral-400">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
