import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '@/lib/format';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cx('glass-card animate-fade-up relative w-full max-w-lg p-5', className)}
      >
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-lg font-bold text-ink">{title}</h2>}
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-accent"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
