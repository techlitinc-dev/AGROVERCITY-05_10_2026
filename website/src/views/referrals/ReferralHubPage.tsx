import { useCallback, useEffect, useState, type FormEvent } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  inviteFarmer,
  referralHub,
  type ReferralHub,
} from '../../lib/api/referrals';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Refer & Earn hub (robust.md §7.16): code card, WhatsApp share deep-link,
 * milestone tracker, invite list, leaderboard and the X11 anti-fraud note —
 * the referrer is credited only after the invitee's first completed
 * transaction. `shareMessage`/`shareLink` arrive localized from the backend and
 * are rendered verbatim.
 */
export default function ReferralHubPage() {
  const t = useT();
  const [hub, setHub] = useState<ReferralHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setHub(await referralHub());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyCode = async () => {
    if (!hub) return;
    try {
      await navigator.clipboard.writeText(hub.referralCode);
      toast(t('referralsCopied'));
    } catch {
      toast(t('actionFailed'), { error: true });
    }
  };

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setBusy(true);
    try {
      await inviteFarmer({ name: name.trim(), phone: phone.trim() });
      toast(t('referralsInviteSent'));
      setName('');
      setPhone('');
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (status: string) =>
    status === 'credited'
      ? t('referralsReferredStatusCredited')
      : status === 'joined'
        ? t('referralsReferredStatusJoined')
        : t('referralsReferredStatusInvited');

  return (
    <ToolShell toolId="referEarn">
      <section className="dash-section">
        <h3>{t('referralsTitle')}</h3>
        <p className="trade-hint">{t('referralsHint')}</p>
        {loading ? <p className="trade-hint">{t('commonLoading')}</p> : null}
        {failed ? <p className="trade-hint">{t('referralsLoadFailed')}</p> : null}

        {hub ? (
          <>
            <div className="trade-card" style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{t('referralsCodeTitle')}</span>
              </div>
              <p className="trade-card-amount">{hub.referralCode}</p>
              <div className="trade-actions-row">
                <button type="button" className="av-btn av-btn-ghost" onClick={() => void copyCode()}>
                  {t('referralsCopy')}
                </button>
                <a
                  className="av-btn av-btn-primary"
                  href={`https://wa.me/?text=${encodeURIComponent(`${hub.shareMessage} ${hub.shareLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('referralsShareWhatsapp')}
                </a>
              </div>
              <p className="trade-card-sub">ℹ️ {t('referralsCreditAfterTransaction')}</p>
            </div>

            <h4>{t('referralsStatsTitle')}</h4>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('referralsStatInvited')}: <strong>{hub.stats.invited}</strong>
              </span>
              <span className="trade-card-sub">
                {t('referralsStatJoined')}: <strong>{hub.stats.joined}</strong>
              </span>
              <span className="trade-card-sub">
                {t('referralsStatEarned')}: <strong>{hub.stats.totalEarnedCoins}</strong>
              </span>
            </div>

            <h4>{t('referralsMilestonesTitle')}</h4>
            <div className="trade-list">
              {hub.milestones.map((milestone) => (
                <div className="trade-card" key={milestone.count} style={{ cursor: 'default' }}>
                  <div className="trade-card-row">
                    <span className="trade-card-sub">
                      {t('referralsMilestone', {
                        count: milestone.count,
                        coins: milestone.rewardCoins,
                      })}
                    </span>
                    <span className="trade-card-sub">
                      {milestone.achieved
                        ? t('referralsMilestoneAchieved')
                        : t('referralsMilestonePending')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <h4>{t('referralsReferredTitle')}</h4>
            {hub.referred.length === 0 ? (
              <EmptyState icon="🤝" titleKey="referralsReferredEmpty" />
            ) : (
              <div className="trade-list">
                {hub.referred.map((row, index) => (
                  <div className="trade-card" key={`${row.phone ?? row.name}-${index}`} style={{ cursor: 'default' }}>
                    <div className="trade-card-row">
                      <span className="trade-card-title">{row.name}</span>
                      <span className="trade-card-sub">{statusLabel(row.status)}</span>
                    </div>
                    <p className="trade-card-sub">
                      {row.phone} · {t('referralsRewardCoins', { coins: row.rewardCoins })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <form className="trade-card" style={{ cursor: 'default' }} onSubmit={(e) => void invite(e)}>
              <span className="trade-card-title">{t('referralsInviteTitle')}</span>
              <label className="trade-card-sub" htmlFor="referral-invite-name">
                {t('referralsInviteName')}
              </label>
              <input
                id="referral-invite-name"
                className="av-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <label className="trade-card-sub" htmlFor="referral-invite-phone">
                {t('referralsInvitePhone')}
              </label>
              <input
                id="referral-invite-phone"
                className="av-input"
                placeholder={t('referralsInvitePhonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div className="trade-actions-row">
                <button type="submit" className="av-btn av-btn-primary" disabled={busy}>
                  {busy ? <span className="av-spinner" aria-hidden /> : t('referralsInviteSubmit')}
                </button>
              </div>
            </form>

            <h4>{t('referralsLeaderboardTitle')}</h4>
            {hub.leaderboard.length === 0 ? (
              <EmptyState icon="🏅" titleKey="referralsLeaderboardEmpty" />
            ) : (
              <div className="trade-list">
                {hub.leaderboard.map((row) => (
                  <div className="trade-card" key={row.userId} style={{ cursor: 'default' }}>
                    <div className="trade-card-row">
                      <span className="trade-card-title">
                        #{row.rank} {row.name}
                        {row.isMe ? ` (${t('referralsYou')})` : ''}
                      </span>
                      <span className="trade-card-amount">{row.referralCount}</span>
                    </div>
                    <p className="trade-card-sub">{row.village}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>
    </ToolShell>
  );
}
