import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { isApiError } from '../../lib/api/client';
import {
  coinLedger,
  gamificationStatus,
  type GamificationStatus,
  type LedgerEntry,
} from '../../lib/api/gamification';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Krishi Ratna coin wallet (robust.md §7.15): balance, tier progress, streaks,
 * badges and the coin ledger (legacy page envelope). Read-only — redemption
 * lives in RewardsStorePage. Everything renders from the API response; zero-data
 * shows an honest empty state (rule 1).
 */
export default function WalletPage() {
  const t = useT();
  const [status, setStatus] = useState<GamificationStatus | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [s, ledger] = await Promise.all([gamificationStatus(), coinLedger(1, 20)]);
      setStatus(s);
      setEntries(ledger.data);
      setTotal(ledger.total);
      setPage(ledger.page);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    try {
      const next = await coinLedger(page + 1, 20);
      setEntries((prev) => [...prev, ...next.data]);
      setPage(next.page);
      setTotal(next.total);
    } catch (e) {
      if (isApiError(e)) setFailed(true);
    }
  };

  return (
    <ToolShell toolId="krishiRatna">
      <section className="dash-section">
        <h3>{t('gamificationWalletTitle')}</h3>
        <p className="trade-hint">{t('gamificationWalletHint')}</p>
        {loading ? <p className="trade-hint">{t('commonLoading')}</p> : null}
        {failed ? <p className="trade-hint">{t('gamificationWalletLoadFailed')}</p> : null}

        {status ? (
          <>
            <div className="trade-card" style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{t('gamificationBalance')}</span>
                <span className="trade-card-amount">{status.agriCoins}</span>
              </div>
              <p className="trade-card-sub">
                {t('gamificationLevel', { tier: status.level.title })}
              </p>
              <p className="trade-card-sub">
                {status.level.nextTier
                  ? t('gamificationNextTier', { coins: status.level.coinsToNextTier })
                  : t('gamificationTopTier')}
              </p>
              <p className="trade-card-sub">
                {t('gamificationStreakCurrent')}:{' '}
                {t('gamificationDays', { count: status.dailyStreak.current })} ·{' '}
                {t('gamificationStreakLongest')}:{' '}
                {t('gamificationDays', { count: status.dailyStreak.longest })}
              </p>
              <p className="trade-card-sub">
                {t('gamificationEarnedTotal')}: {status.stats.coinsEarnedTotal}
              </p>
            </div>

            <h4>{t('gamificationBadgesTitle')}</h4>
            <div className="trade-list">
              {status.badges.map((badge) => (
                <div className="trade-card" key={badge.id} style={{ cursor: 'default' }}>
                  <div className="trade-card-row">
                    <span className="trade-card-title">
                      {badge.icon} {badge.title}
                    </span>
                    <span className="trade-card-sub">
                      {t('gamificationBadgeProgress', {
                        progress: badge.progress,
                        target: badge.target,
                      })}
                    </span>
                  </div>
                  <p className="trade-card-sub">{badge.description}</p>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <h4>{t('gamificationLedgerTitle')}</h4>
        {entries.length === 0 && !loading ? (
          <EmptyState icon="🪙" titleKey="gamificationLedgerEmpty" />
        ) : (
          <div className="trade-list">
            {entries.map((entry) => (
              <div className="trade-card" key={entry.id} style={{ cursor: 'default' }}>
                <div className="trade-card-row">
                  <span className="trade-card-sub">{entry.reason}</span>
                  <span className="trade-card-amount">
                    {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                  </span>
                </div>
                <p className="trade-card-sub">
                  {entry.at} · {entry.balanceAfter}
                </p>
              </div>
            ))}
          </div>
        )}
        {entries.length < total ? (
          <div className="trade-actions-row">
            <button type="button" className="av-btn av-btn-ghost" onClick={() => void loadMore()}>
              {t('gamificationLedgerLoadMore')}
            </button>
          </div>
        ) : null}
      </section>
    </ToolShell>
  );
}
