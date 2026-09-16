import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Card, PageHeader, Tabs } from '@/components/ui';
import { useSession } from '@/state/SessionContext';
import { useT } from '@/i18n';
import { ShgTab } from './ShgTab';
import { GardenTab } from './GardenTab';
import { LivestockTab } from './LivestockTab';
import { EnterpriseTab } from './EnterpriseTab';

type TabKey = 'shg' | 'garden' | 'livestock' | 'enterprise';

export default function WomenHubPage() {
  const t = useT();
  const { womenMode } = useSession();
  const [tab, setTab] = useState<TabKey>('shg');

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={t('महिला किसान हब', 'Women Farmer Hub')}
        subtitle={t('बचत · पोषण · आजीविका', 'Savings · Nutrition · Livelihood')}
      />

      {!womenMode && (
        <Card className="animate-fade-up mb-4 flex items-center gap-3 border-l-4 !border-l-women">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-women/10 text-women">
            <Sparkles size={22} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">
              {t('महिला मोड के लिए बना हब', 'Built for Women Mode')}
            </p>
            <p className="text-xs text-muted">
              {t(
                'बेहतर अनुभव के लिए सेटिंग्स में महिला मोड चालू करें।',
                'Enable Women Mode in settings for a tailored experience.',
              )}
            </p>
          </div>
          <Link
            to="/account/settings"
            className="flex min-h-11 shrink-0 items-center rounded-xl bg-women px-4 text-sm font-semibold text-white transition-colors hover:bg-women/90"
          >
            {t('चालू करें', 'Enable')}
          </Link>
        </Card>
      )}

      <Tabs
        tabs={[
          { value: 'shg', label: t('SHG बचत', 'SHG Savings') },
          { value: 'garden', label: t('किचन गार्डन', 'Kitchen Garden') },
          { value: 'livestock', label: t('पशु स्वास्थ्य', 'Livestock') },
          { value: 'enterprise', label: t('होम एंटरप्राइज़', 'Home Enterprise') },
        ]}
        active={tab}
        onChange={(v) => setTab(v as TabKey)}
      />

      <div className="mt-4">
        {tab === 'shg' && <ShgTab />}
        {tab === 'garden' && <GardenTab />}
        {tab === 'livestock' && <LivestockTab />}
        {tab === 'enterprise' && <EnterpriseTab />}
      </div>
    </div>
  );
}
