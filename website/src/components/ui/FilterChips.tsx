import { cx } from '@/lib/format';

export interface ChipOption {
  value: string;
  label: string;
}

interface FilterChipsProps {
  options: ChipOption[];
  selected: string;
  onSelect: (value: string) => void;
  className?: string;
}

export function FilterChips({ options, selected, onSelect, className }: FilterChipsProps) {
  return (
    <div className={cx('flex gap-2 overflow-x-auto pb-1', className)} role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={opt.value === selected}
          onClick={() => onSelect(opt.value)}
          className={cx(
            'min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors',
            opt.value === selected
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white text-ink border border-ink/10 hover:bg-accent',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
