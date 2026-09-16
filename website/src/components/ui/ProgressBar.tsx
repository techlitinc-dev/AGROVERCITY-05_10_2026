import { cx } from '@/lib/format';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  toneClass?: string;
}

export function ProgressBar({ value, max = 100, label, toneClass = 'bg-primary' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div>
      {label && <p className="mb-1 text-xs font-medium text-muted">{label}</p>}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 w-full overflow-hidden rounded-full bg-ink/10"
      >
        <div className={cx('h-full rounded-full transition-all', toneClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
