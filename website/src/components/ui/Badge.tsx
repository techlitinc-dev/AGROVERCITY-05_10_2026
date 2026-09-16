import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'info';

interface BadgeProps {
  tone?: Tone;
  shimmer?: boolean;
  children: ReactNode;
  className?: string;
}

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink/5 text-ink',
  success: 'bg-success/10 text-success',
  warn: 'bg-warn/10 text-warn',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-transport/10 text-transport',
};

export function Badge({ tone = 'neutral', shimmer = false, children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        shimmer && 'shimmer',
        className,
      )}
    >
      {children}
    </span>
  );
}
