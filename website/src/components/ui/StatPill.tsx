import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { cx } from '@/lib/format';

interface StatPillProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  toneClass?: string;
}

export function StatPill({ label, value, icon: Icon, trend, toneClass = 'bg-accent text-primary' }: StatPillProps) {
  return (
    <div className="glass-card flex items-center gap-3 p-3">
      <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', toneClass)}>
        <Icon size={20} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted">{label}</p>
        <p className="flex items-center gap-1 text-base font-bold text-ink">
          {value}
          {typeof trend === 'number' &&
            (trend >= 0 ? (
              <TrendingUp size={14} className="text-success" aria-label="up" />
            ) : (
              <TrendingDown size={14} className="text-danger" aria-label="down" />
            ))}
        </p>
      </div>
    </div>
  );
}
