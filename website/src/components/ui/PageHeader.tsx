import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, backTo, actions }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        type="button"
        aria-label="Back"
        onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
        className="glass-card flex min-h-11 min-w-11 shrink-0 items-center justify-center !rounded-xl text-ink hover:bg-accent"
      >
        <ArrowLeft size={20} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
