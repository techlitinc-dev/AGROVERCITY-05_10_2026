import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useT } from '@/i18n';
import { cx } from '@/lib/format';

export const inputCls =
  'min-h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-primary';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function StepIndicator({
  step,
  total,
  labels,
}: {
  step: number;
  total: number;
  labels?: string[];
}) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={n} className="flex items-center gap-2">
            <span
              className={cx(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                done && 'bg-primary text-white',
                active && 'bg-primary text-white ring-4 ring-primary/20',
                !done && !active && 'bg-ink/10 text-muted',
              )}
            >
              {done ? <Check size={14} aria-hidden /> : n}
            </span>
            {labels?.[i] && (
              <span
                className={cx(
                  'hidden text-xs font-semibold sm:block',
                  active ? 'text-ink' : 'text-muted',
                )}
              >
                {labels[i]}
              </span>
            )}
            {n < total && <span className="h-0.5 w-4 rounded bg-ink/10" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}

export function OnboardingShell({
  step,
  total,
  title,
  subtitle,
  children,
  wide,
}: {
  step?: number;
  total?: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useT();
  return (
    <div className="min-h-dvh bg-gradient-to-b from-accent/60 to-bg px-4 py-6">
      <div className={cx('mx-auto flex flex-col gap-4', wide ? 'max-w-3xl' : 'max-w-md')}>
        {step && total && (
          <div className="flex items-center justify-between">
            <StepIndicator step={step} total={total} />
            <span className="text-xs font-semibold text-muted">
              {t(`चरण ${step} / ${total}`, `Step ${step} of ${total}`)}
            </span>
          </div>
        )}
        <header>
          <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </header>
        {children}
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
      {message}
    </p>
  );
}
