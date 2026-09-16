import { Coins } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { cx } from '@/lib/format';

interface CoinPillProps {
  count: number;
  className?: string;
}

export function CoinPill({ count, className }: CoinPillProps) {
  return (
    <span
      className={cx(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full bg-equipment/15 px-3 text-sm font-bold text-warn',
        className,
      )}
    >
      <Coins size={18} aria-hidden />
      {formatNumber(count)}
    </span>
  );
}
