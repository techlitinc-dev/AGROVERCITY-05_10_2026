import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

export interface TabItem {
  value: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (value: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps): ReactNode {
  return (
    <div className="flex gap-4 overflow-x-auto border-b border-ink/10" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={tab.value === active}
          onClick={() => onChange(tab.value)}
          className={cx(
            'min-h-11 shrink-0 border-b-2 px-1 text-sm font-semibold transition-colors',
            tab.value === active
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
