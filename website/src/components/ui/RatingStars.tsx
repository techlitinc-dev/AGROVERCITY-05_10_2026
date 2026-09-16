import { Star } from 'lucide-react';
import { cx } from '@/lib/format';

interface RatingStarsProps {
  rating: number;
  max?: number;
  size?: number;
  className?: string;
}

export function RatingStars({ rating, max = 5, size = 16, className }: RatingStarsProps) {
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)} aria-label={`${rating} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={size}
          aria-hidden
          className={i < Math.round(rating) ? 'fill-equipment text-equipment' : 'text-ink/20'}
        />
      ))}
    </span>
  );
}
