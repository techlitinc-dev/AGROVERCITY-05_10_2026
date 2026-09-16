import type { LucideIcon } from 'lucide-react';
import { Card, StatPill } from '@/components/ui';
import { useT } from '@/i18n';
import { cx } from '@/lib/format';

interface StatDef {
  label: string;
  value: string;
  icon: LucideIcon;
}

interface PersonaHomeScaffoldProps {
  hi: string;
  en: string;
  bannerClass: string;
  stats: StatDef[];
}

export function PersonaHomeScaffold({ hi, en, bannerClass, stats }: PersonaHomeScaffoldProps) {
  const t = useT();
  return (
    <div className="animate-fade-up space-y-4">
      <Card className={cx('bg-gradient-to-br text-white', bannerClass)}>
        <p className="text-sm opacity-90">{t('नमस्ते', 'Namaste')}</p>
        <h1 className="text-2xl font-extrabold">
          {hi} <span className="text-base font-medium opacity-80">· {en}</span>
        </h1>
        <p className="mt-1 text-sm opacity-90">{t('डैशबोर्ड जल्द आ रहा है', 'Dashboard coming soon')}</p>
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <StatPill key={s.label} label={s.label} value={s.value} icon={s.icon} />
        ))}
      </div>
    </div>
  );
}
