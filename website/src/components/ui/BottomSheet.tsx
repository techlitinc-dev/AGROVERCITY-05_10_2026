import { useEffect, type ReactNode } from 'react';
import { cx } from '@/lib/format';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'animate-fade-up relative max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white/95 p-5 pb-8 shadow-2xl backdrop-blur-xl',
          className,
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/15" aria-hidden />
        {title && <h2 className="mb-3 text-center text-lg font-bold text-ink">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
