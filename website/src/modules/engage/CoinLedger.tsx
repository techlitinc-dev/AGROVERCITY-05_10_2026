import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Coins, MinusCircle, PlusCircle } from 'lucide-react';
import { api, ApiError, EP, type CoinLedgerEntry, type Page } from '@/api/client';
import { Button, Card, EmptyState, SectionTitle, Skeleton } from '@/components/ui';
import { useT } from '@/i18n';
import { cx, formatDate, formatNumber } from '@/lib/format';

const REASON_LABELS: Record<string, [string, string]> = {
  urgentTask: ['जरूरी काम पूर्ण', 'Urgent task done'],
  diary: ['खेत डायरी एंट्री', 'Farm diary entry'],
  equipmentBooking: ['उपकरण बुकिंग', 'Equipment booking'],
  expertTalk: ['एक्सपर्ट टॉक नोंदणी', 'Expert-talk registration'],
  referral: ['रेफरल इनाम', 'Referral reward'],
  redeem: ['रिवॉर्ड रिडीम', 'Reward redeemed'],
};

interface CoinLedgerProps {
  reloadToken?: number;
}

export function CoinLedger({ reloadToken = 0 }: CoinLedgerProps) {
  const t = useT();
  const [entries, setEntries] = useState<CoinLedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .get<Page<CoinLedgerEntry>>(EP.gamification.ledger, { query: { pageSize: 50 } })
      .then((res) => setEntries(res.data))
      .catch((e) => setError(e instanceof ApiError ? e.message : t('काहीतरी चुकले', 'Something went wrong')));
  };

  useEffect(load, [reloadToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const map = new Map<string, CoinLedgerEntry[]>();
    for (const e of entries ?? []) {
      const key = formatDate(e.at);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [entries]);

  return (
    <section>
      <SectionTitle title={t('कॉइन इतिहास', 'Coin history')} subtitle={t('कमाई व खर्चाची नोंद', 'Earn & spend record')} />
      {error ? (
        <Card>
          <EmptyState title={t('इतिहास लोड झाला नाही', 'History failed to load')} message={error} icon={Coins} />
          <Button variant="ghost" className="mx-auto flex" onClick={load}>
            {t('पुन्हा प्रयत्न करा', 'Retry')}
          </Button>
        </Card>
      ) : entries === null ? (
        <Card className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            title={t('अजून कॉइन नोंद नाही', 'No coin activity yet')}
            message={t('कामे पूर्ण करा, डायरी लिहा — कॉइन्स मिळतील!', 'Finish tasks, write the diary — coins will follow!')}
            icon={Coins}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, list], gi) => (
            <Card key={date} className="animate-fade-up" style={{ '--stagger': gi * 60 } as CSSProperties}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{date}</p>
              <ul className="divide-y divide-ink/5">
                {list.map((e) => {
                  const earned = e.delta > 0;
                  const label = REASON_LABELS[e.reason];
                  return (
                    <li key={e.id} className="flex min-h-11 items-center gap-3 py-2">
                      <span className={cx('shrink-0', earned ? 'text-success' : 'text-danger')} aria-hidden>
                        {earned ? <PlusCircle size={20} /> : <MinusCircle size={20} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {label ? t(label[0], label[1]) : e.reason}
                        </p>
                        <p className="text-xs text-muted">
                          {t('शिल्लक', 'Balance')}: {formatNumber(e.balanceAfter)}
                        </p>
                      </div>
                      <span className={cx('text-sm font-bold', earned ? 'text-success' : 'text-danger')}>
                        {earned ? '+' : '−'}
                        {formatNumber(Math.abs(e.delta))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
