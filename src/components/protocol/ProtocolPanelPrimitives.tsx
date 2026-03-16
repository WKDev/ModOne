import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

interface SectionProps extends PropsWithChildren {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PanelShell({ children }: PropsWithChildren) {
  return <div className="p-4 space-y-4">{children}</div>;
}

export function PanelSection({ title, description, actions, children }: SectionProps) {
  return (
    <section className="rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-4 shadow-[var(--panel-shadow)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

interface FieldProps extends PropsWithChildren {
  label: string;
  hint?: string;
}

export function PanelField({ label, hint, children }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-xs text-[var(--color-text-muted)]">{hint}</span> : null}
    </label>
  );
}

export function PanelInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)] ${props.className ?? ''}`}
    />
  );
}

export function PanelSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)] ${props.className ?? ''}`}
    />
  );
}

interface ButtonProps
  extends PropsWithChildren,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  tone?: 'primary' | 'danger' | 'neutral';
}

export function PanelButton({
  tone = 'neutral',
  disabled = false,
  onClick,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const toneClasses =
    tone === 'primary'
      ? 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
      : tone === 'danger'
        ? 'bg-[var(--color-error)] text-white hover:opacity-95'
        : 'bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]';

  return (
    <button
      {...rest}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses} ${className}`}
    >
      {children}
    </button>
  );
}

interface StatusBadgeProps {
  tone: 'success' | 'warning' | 'muted';
  children: ReactNode;
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  const toneClasses =
    tone === 'success'
      ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
      : tone === 'warning'
        ? 'bg-[var(--color-warning)]/12 text-[var(--color-warning)]'
        : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]';

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
