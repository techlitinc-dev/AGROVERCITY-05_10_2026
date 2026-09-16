import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: LucideIcon;
  bullets?: string[];
}

export function EmptyState({ title, message, icon: Icon = Inbox, bullets }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <Icon size={28} aria-hidden />
      </span>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {message && <p className="max-w-sm text-sm text-muted">{message}</p>}
      {bullets && bullets.length > 0 && (
        <ul className="mt-2 space-y-1 text-left text-sm text-muted">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
