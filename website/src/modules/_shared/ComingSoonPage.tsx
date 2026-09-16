import type { LucideIcon } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ui';

interface ComingSoonPageProps {
  title: string;
  subtitle: string;
  bullets: string[];
  icon?: LucideIcon;
}

export function ComingSoonPage({ title, subtitle, bullets, icon }: ComingSoonPageProps) {
  return (
    <div className="animate-fade-up">
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <EmptyState
          icon={icon}
          title="जल्द आ रहा है · Coming soon"
          message={`${title} — ${subtitle}`}
          bullets={bullets}
        />
      </Card>
    </div>
  );
}
