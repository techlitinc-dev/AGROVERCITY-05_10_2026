import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { cx } from '@/lib/format';

export type StepStatus = 'done' | 'current' | 'pending' | 'failed';

export interface TimelineStep {
  title: string;
  subtitle?: string;
  status: StepStatus;
}

interface TimelineProps {
  steps: TimelineStep[];
}

const ICONS: Record<StepStatus, { icon: typeof Circle; cls: string }> = {
  done: { icon: CheckCircle2, cls: 'text-success' },
  current: { icon: Circle, cls: 'text-primary' },
  pending: { icon: Circle, cls: 'text-ink/25' },
  failed: { icon: XCircle, cls: 'text-danger' },
};

export function Timeline({ steps }: TimelineProps) {
  return (
    <ol className="relative space-y-0">
      {steps.map((step, i) => {
        const { icon: Icon, cls } = ICONS[step.status];
        const last = i === steps.length - 1;
        return (
          <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span className="absolute left-[11px] top-6 h-full w-0.5 bg-ink/10" aria-hidden />}
            <Icon size={24} className={cx('z-10 shrink-0 bg-white', cls, step.status === 'current' && 'beacon-pulse rounded-full')} aria-hidden />
            <div>
              <p className={cx('text-sm font-semibold', step.status === 'pending' ? 'text-muted' : 'text-ink')}>
                {step.title}
              </p>
              {step.subtitle && <p className="text-xs text-muted">{step.subtitle}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
