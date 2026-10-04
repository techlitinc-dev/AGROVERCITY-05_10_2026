import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { myOffers, type Offer } from '../../lib/api/offers';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const unitLabel = (t: (key: string) => string, unit: string): string =>
  unit === 'kg' ? t('unitKg') : t('unitQuintal');

/** Humanized time left until an offer expires ("Xm" / "Xh Ym" / "Xd"); null when past. */
const offerTimeLeft = (iso: string): string | null => {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
};

/**
 * My offers — the negotiation inbox (spec G1). Received / Sent tabs over the
 * same card list; every card opens the offer detail where the state machine
 * (accept / decline / counter / withdraw) lives.
 */
export default function OffersPage() {
  const t = useT();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setOffers(null);
    myOffers(tab)
      .then((res) => setOffers(res.data))
      .catch(() => setFailed(true));
  }, [tab]);

  useEffect(load, [load]);

  return (
    <ToolShell toolId="myOffers">
      <div className="trade-filter-row">
        <button
          type="button"
          className={`av-chip${tab === 'received' ? ' selected' : ''}`}
          onClick={() => setTab('received')}
        >
          {t('offersReceived')}
        </button>
        <button
          type="button"
          className={`av-chip${tab === 'sent' ? ' selected' : ''}`}
          onClick={() => setTab('sent')}
        >
          {t('offersSent')}
        </button>
      </div>

      {offers === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {offers !== null && offers.length === 0 ? (
        <EmptyState icon="🤝" titleKey="offersEmpty" />
      ) : null}

      <div className="trade-list">
        {offers?.map((offer) => {
          const counterparty = tab === 'received' ? offer.fromName : offer.toName;
          const countdown =
            (offer.status === 'pending' || offer.status === 'countered') && offer.expiresAt
              ? offerTimeLeft(offer.expiresAt)
              : null;
          return (
            <div
              key={offer.id}
              className="trade-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/dashboard/p/myOffers/${offer.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/dashboard/p/myOffers/${offer.id}`);
              }}
            >
              <div className="trade-card-row">
                <span className="trade-card-title">
                  {tab === 'received'
                    ? `${t('offerFrom')} ${counterparty}`
                    : `${t('offerTo')} ${counterparty}`}
                  {tab === 'received' && offer.fromVerified ? (
                    <span
                      className="trade-pill"
                      style={{
                        marginLeft: 8,
                        color: 'var(--av-success)',
                        borderColor: 'var(--av-success)',
                      }}
                    >
                      ✓ {t('verifiedBadge')}
                    </span>
                  ) : null}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {offer.status === 'pending' || offer.status === 'countered' ? (
                    <button
                      type="button"
                      className="av-chip"
                      aria-label={t('chatOpenCta')}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dashboard/p/myOffers/${offer.id}/chat`);
                      }}
                    >
                      💬 {t('chatTitle')}
                    </button>
                  ) : null}
                  <StatusPill status={offer.status} />
                </span>
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">
                  {offer.targetType === 'demand' ? t('offersOnDemand') : t('offersOnLot')}
                  {' · '}
                  {t('offerQty')} {offer.quantity} {unitLabel(t, offer.unit)}
                  {' · '}
                  {fmtDate(offer.createdAt)}
                </span>
                <span className="trade-card-amount">
                  {inr(offer.pricePerUnit)}/{unitLabel(t, offer.unit)}
                </span>
              </div>
              {offer.counter ? (
                <div className="trade-card-row">
                  <span className="trade-card-sub">
                    {t('offerCounterInfo', { price: inr(offer.counter.pricePerUnit) })}
                  </span>
                </div>
              ) : null}
              {countdown ? (
                <div className="trade-card-row">
                  <span className="trade-card-sub">
                    ⏳ {t('offerExpiresIn', { time: countdown })}
                  </span>
                </div>
              ) : null}
              {offer.status === 'expired' ? (
                <div className="trade-card-row">
                  <span className="trade-card-sub">{t('offerExpiredNote')}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </ToolShell>
  );
}
