import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  coinLeaderboard,
  gamificationStatus,
  redeemReward,
  rewardsCatalog,
  type CoinLeaderboard,
  type RewardItem,
} from '../../lib/api/gamification';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Krishi Ratna rewards store + coin leaderboard (robust.md §7.15). Redemption
 * posts with `Idempotency-Key` (client.ts) and renders the returned voucher
 * code. The regulatory label `coinsNoCashRedemption` is always visible — coins
 * are never redeemable for cash.
 */
export default function RewardsStorePage() {
  const t = useT();
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [board, setBoard] = useState<CoinLeaderboard | null>(null);
  const [period, setPeriod] = useState<'all' | 'month'>('all');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyType, setBusyType] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [store, status] = await Promise.all([rewardsCatalog(), gamificationStatus()]);
      setRewards(store.data);
      setBalance(status.agriCoins);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBoard = useCallback(async (next: 'all' | 'month') => {
    try {
      setBoard(await coinLeaderboard(next));
    } catch {
      setBoard(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadBoard(period);
  }, [loadBoard, period]);

  const redeem = async (reward: RewardItem) => {
    setBusyType(reward.type);
    try {
      const result = await redeemReward({ rewardType: reward.type, coins: reward.coinsCost });
      setBalance(result.balance);
      toast(t('gamificationRedeemed', { code: result.voucherCode }));
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusyType(null);
    }
  };

  return (
    <ToolShell toolId="krishiRatna">
      <section className="dash-section">
        <h3>{t('gamificationStoreTitle')}</h3>
        <p className="trade-hint">{t('gamificationStoreHint')}</p>
        <p className="trade-hint">⚠️ {t('coinsNoCashRedemption')}</p>
        {loading ? <p className="trade-hint">{t('commonLoading')}</p> : null}
        {failed ? <p className="trade-hint">{t('gamificationStoreLoadFailed')}</p> : null}
        {balance !== null ? (
          <p className="trade-card-sub">
            {t('gamificationBalance')}: <strong>{balance}</strong>
          </p>
        ) : null}

        {!loading && !failed && rewards.length === 0 ? (
          <EmptyState icon="🎁" titleKey="gamificationStoreLoadFailed" />
        ) : null}

        <div className="trade-list">
          {rewards.map((reward) => (
            <div className="trade-card" key={reward.type} style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">
                  {reward.icon} {reward.title}
                </span>
                <span className="trade-card-amount">{reward.coinsCost}</span>
              </div>
              {reward.description ? (
                <p className="trade-card-sub">{reward.description}</p>
              ) : null}
              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  disabled={busyType === reward.type || !reward.available}
                  onClick={() => void redeem(reward)}
                >
                  {busyType === reward.type ? (
                    <span className="av-spinner" aria-hidden />
                  ) : (
                    t('gamificationRedeem')
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <h4>{t('gamificationLeaderboardTitle')}</h4>
        <p className="trade-hint">{t('gamificationLeaderboardHint')}</p>
        <div className="trade-actions-row">
          <button
            type="button"
            className={period === 'all' ? 'av-btn av-btn-primary' : 'av-btn av-btn-ghost'}
            onClick={() => setPeriod('all')}
          >
            {t('gamificationLeaderboardAll')}
          </button>
          <button
            type="button"
            className={period === 'month' ? 'av-btn av-btn-primary' : 'av-btn av-btn-ghost'}
            onClick={() => setPeriod('month')}
          >
            {t('gamificationLeaderboardMonth')}
          </button>
        </div>

        {board && board.data.length === 0 ? (
          <EmptyState icon="🏅" titleKey="gamificationLeaderboardEmpty" />
        ) : null}
        {board && board.data.length > 0 ? (
          <div className="trade-list">
            {board.data.map((row) => (
              <div className="trade-card" key={row.userId} style={{ cursor: 'default' }}>
                <div className="trade-card-row">
                  <span className="trade-card-title">
                    #{row.rank} {row.name}
                    {row.isMe ? ` (${t('gamificationYou')})` : ''}
                  </span>
                  <span className="trade-card-amount">{row.coinsEarned}</span>
                </div>
                <p className="trade-card-sub">{row.village}</p>
              </div>
            ))}
          </div>
        ) : null}
        {board?.myRank ? (
          <p className="trade-card-sub">{t('gamificationRank', { rank: board.myRank.rank })}</p>
        ) : null}
      </section>
    </ToolShell>
  );
}
