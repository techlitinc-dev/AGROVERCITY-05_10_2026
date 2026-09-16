import { Bell, CloudSun, Coins, Sprout } from 'lucide-react';
import { Card, LiveBadge, StatPill } from '@/components/ui';
import { useSession } from '@/state/SessionContext';
import { useT } from '@/i18n';
import { formatNumber } from '@/lib/format';

export default function FarmerHome() {
  const { user } = useSession();
  const t = useT();

  return (
    <div className="animate-fade-up space-y-4">
      <Card className="bg-gradient-to-br from-primary to-success text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm opacity-90">{t('नमस्ते', 'Namaste')}</p>
            <h1 className="text-2xl font-extrabold">{user?.vernacularName ?? '—'}</h1>
            <p className="text-sm opacity-90">
              {user?.village} · {formatNumber(user?.landAreaAcres ?? 0)} {t('एकड़', 'acres')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <LiveBadge label={t('LIVE APMC', 'LIVE APMC')} />
            <span className="animate-spin-slow flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <Sprout size={20} aria-hidden />
            </span>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatPill label={t('मौसम', 'Weather')} value="28°C · 10% बारिश" icon={CloudSun} trend={1} />
        <StatPill
          label={t('एग्री कॉइन्स', 'AgriCoins')}
          value={formatNumber(user?.agriCoins ?? 0)}
          icon={Coins}
          trend={1}
        />
        <StatPill label={t('आज का काम', "Today's task")} value={t('1 ज़रूरी', '1 urgent')} icon={Bell} toneClass="bg-danger/10 text-danger" />
      </div>
    </div>
  );
}
