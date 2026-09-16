import type { InputHTMLAttributes } from 'react';
import { Mic, Search } from 'lucide-react';
import { cx } from '@/lib/format';

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onMic?: () => void;
}

export function SearchInput({ onMic, className, ...rest }: SearchInputProps) {
  return (
    <div className={cx('glass-card flex items-center gap-2 px-3', className)}>
      <Search size={18} className="shrink-0 text-muted" aria-hidden />
      <input
        type="search"
        className="min-h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        {...rest}
      />
      <button
        type="button"
        onClick={onMic}
        aria-label="Voice search"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-primary hover:bg-accent"
      >
        <Mic size={18} />
      </button>
    </div>
  );
}
