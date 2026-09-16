import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/format';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export function Card({ children, padded = true, className, ...rest }: CardProps) {
  return (
    <div className={cx('glass-card', padded && 'p-4', className)} {...rest}>
      {children}
    </div>
  );
}
