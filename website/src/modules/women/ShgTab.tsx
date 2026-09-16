import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { HandCoins, Users, Wallet, PiggyBank } from 'lucide-react';
import { Button, Card, EmptyState, Skeleton, StatPill } from '@/components/ui';
import { api, EP, isApiError } from '@/api/client';
import type { ShgGroup } from '@/api/types';
import { useToast } from '@/state/ToastContext';
import { useT } from '@/i18n';
import { formatInr } from '@/lib/format';

export function ShgTab() {
  const t = useT();
  const { toast } = useToast();
  const [group, setGroup] = useState<ShgGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depositing, setDepositing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGroup(await api.get<ShgGroup>(EP.women.shg));
    } catch (e) {
      setError(isApiError(e) ? e.message : t('कुछ गड़बड़ हुई।', 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const deposit = async () => {
    if (!group || depositing) return;
    setDepositing(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      const updated = await api.post<ShgGroup>(EP.women.shgDeposit, { month });
      setGroup(updated);
      toast(t(`जमा सफल — नई कोष राशि ${formatInr(updated.corpus)}`, `Deposit successful — new corpus ${formatInr(updated.corpus)}`), 'success');
    } catch (e) {
      // Handles 409 DUPLICATE_DEPOSIT_MONTH with the localized server message.
      toast(isApiError(e) ? e.message : t('जमा असफल रही।', 'Deposit failed.'), 'error');
    } finally {
      setDepositing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <Card>
        <EmptyState
          title={t('SHG विवरण नहीं मिला', 'Could not load SHG details')}
          message={error ?? undefined}
        />
        <div className="flex justify-center pb-2">
          <Button variant="ghost" onClick={() => void load()}>
            {t('पुनः प्रयास करें', 'Retry')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="animate-fade-up border-l-4 !border-l-women">
        <p className="text-xs font-semibold uppercase tracking-wide text-women">
          {t('स्वयं सहायता समूह', 'Self Help Group')}
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink">{group.name}</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              { label: t('सदस्य', 'Members'), value: String(group.memberCount), icon: Users },
              { label: t('कोष (कॉर्पस)', 'Corpus'), value: formatInr(group.corpus), icon: PiggyBank },
              { label: t('लोन फंड', 'Loan Fund'), value: formatInr(group.loanFund), icon: Wallet },
            ] as const
          ).map((s, i) => (
            <div key={s.label} className="animate-fade-up" style={{ '--stagger': `${i * 60}ms` } as CSSProperties}>
              <StatPill label={s.label} value={s.value} icon={s.icon} toneClass="bg-women/10 text-women" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="animate-fade-up flex flex-wrap items-center gap-3" style={{ '--stagger': '180ms' } as CSSProperties}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-women/10 text-women">
          <HandCoins size={22} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">
            {t('मासिक जमा', 'Monthly deposit')}: {formatInr(group.monthlyDeposit)}
          </p>
          <p className="text-xs text-muted">
            {t('इस महीने की बचत जमा करें — कोष में तुरंत जुड़ेगी।', 'Deposit this month’s saving — added to the corpus instantly.')}
          </p>
        </div>
        <Button
          className="!bg-women hover:!bg-women/90"
          disabled={depositing}
          onClick={() => void deposit()}
        >
          {depositing ? t('जमा हो रही है…', 'Depositing…') : t('मासिक जमा करें', 'Deposit now')}
        </Button>
      </Card>
    </div>
  );
}
