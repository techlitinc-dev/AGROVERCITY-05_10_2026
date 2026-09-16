import { cx } from '@/lib/format';

interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 28, className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cx('inline-flex', className)}>
      <span
        className="animate-spin rounded-full border-[3px] border-primary/20 border-t-primary"
        style={{ width: size, height: size }}
      />
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton h-4 w-full', className)} aria-hidden />;
}
