import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ModalSheet from '../../components/ModalSheet';
import ConfirmSheet from '../../components/trade/ConfirmSheet';
import CounterOfferForm from '../../components/trade/CounterOfferForm';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  acceptOffer,
  counterOffer,
  getOffer,
  rejectOffer,
  withdrawOffer,
  type Offer,
} from '../../lib/api/offers';
import { myPurchases } from '../../lib/api/purchases';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
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

interface AcceptResponse {
  purchase?: { id?: string };
}

/**
 * Offer detail — the negotiation state machine on one screen. The receiver
 * (target owner) accepts / declines / counters a pending offer; the maker can
 * withdraw, or accept / withdraw a counter. Accepting creates the booking.
 */
export default function OfferDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { offerId } = useParams();
  const uid = useSessionStore((s) => s.user?.id ?? s.user?.uid);

  const [offer, setOffer] = useState<Offer | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyAction, setBusyAction] = useState<null | 'accept' | 'decline' | 'withdraw' | 'counter'>(
    null
  );
  const [counterOpen, setCounterOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const load = useCallback(() => {
    if (!offerId) return;
    setFailed(false);
    getOffer(offerId)
      .then(setOffer)
      .catch(() => setFailed(true));
  }, [offerId]);

  useEffect(load, [load]);

  const failToast = (e: unknown) => {
    if (isApiError(e) && e.code === 'NEGOTIATION_CLOSED') {
      toast(t('offerOneRoundHint'), { error: true });
    } else {
      toast(t('actionFailed'), { error: true });
    }
  };

  const doAccept = async () => {
    if (!offer) return;
    setBusyAction('accept');
    try {
      const res = (await acceptOffer(offer.id)) as AcceptResponse | undefined;
      toast(t('offerAcceptedToast'));
      if (res?.purchase?.id) {
        navigate(`/dashboard/p/purchases/${res.purchase.id}`);
      } else {
        load();
      }
    } catch (e) {
      failToast(e);
    } finally {
      setBusyAction(null);
    }
  };

  const doDecline = async () => {
    if (!offer) return;
    setBusyAction('decline');
    try {
      await rejectOffer(offer.id);
      toast(t('offerDeclinedToast'));
      setDeclineOpen(false);
      load();
    } catch (e) {
      failToast(e);
    } finally {
      setBusyAction(null);
    }
  };

  const doWithdraw = async () => {
    if (!offer) return;
    setBusyAction('withdraw');
    try {
      await withdrawOffer(offer.id);
      toast(t('offerWithdrawnToast'));
      setWithdrawOpen(false);
      load();
    } catch (e) {
      failToast(e);
    } finally {
      setBusyAction(null);
    }
  };

  const submitCounter = async (pricePerUnit: number, note: string) => {
    if (!offer) return;
    setBusyAction('counter');
    try {
      await counterOffer(offer.id, { pricePerUnit, note: note || undefined });
      toast(t('offerCounteredToast'));
      setCounterOpen(false);
      load();
    } catch (e) {
      failToast(e);
    } finally {
      setBusyAction(null);
    }
  };

  const viewPurchase = async () => {
    if (!offer) return;
    try {
      const res = await myPurchases();
      const match = res.data.find((p) => p.source?.refId === offer.id);
      navigate(match ? `/dashboard/p/purchases/${match.id}` : '/dashboard/p/purchases');
    } catch {
      navigate('/dashboard/p/purchases');
    }
  };

  const isTarget = !!uid && offer?.toId === uid;
  const isMaker = !!uid && offer?.fromId === uid;
  const countdown =
    offer && (offer.status === 'pending' || offer.status === 'countered') && offer.expiresAt
      ? offerTimeLeft(offer.expiresAt)
      : null;

  return (
    <ToolShell toolId="myOffers" backTo="/dashboard/p/myOffers">
      {offer === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {offer ? (
        <>
          <div className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {offer.targetType === 'demand' ? t('offersOnDemand') : t('offersOnLot')}
                {' · '}
                {fmtDate(offer.createdAt)}
              </span>
              <StatusPill status={offer.status} />
            </div>
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

          <div className="trade-detail-grid">
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('offerFrom')}</div>
              <div className="trade-detail-value">{offer.fromName}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('offerTo')}</div>
              <div className="trade-detail-value">{offer.toName}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('offerPrice')}</div>
              <div className="trade-detail-value">
                {inr(offer.pricePerUnit)}/{unitLabel(t, offer.unit)}
              </div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('offerQty')}</div>
              <div className="trade-detail-value">
                {offer.quantity} {unitLabel(t, offer.unit)}
              </div>
            </div>
          </div>

          {offer.message ? (
            <div className="trade-detail-item" style={{ marginBottom: 4 }}>
              <div className="trade-detail-label">{t('offerMessage')}</div>
              <div className="trade-detail-value" style={{ fontWeight: 600 }}>
                {offer.message}
              </div>
            </div>
          ) : null}

          {offer.counter ? (
            <>
              <p className="trade-section-title">
                {t('offerCounterTitle')} · {fmtDate(offer.counter.at)}
              </p>
              <div className="trade-invoice-box">
                <div className="trade-invoice-row">
                  <span>{t('offerPrice')}</span>
                  <span>
                    {inr(offer.counter.pricePerUnit)}/{unitLabel(t, offer.unit)}
                  </span>
                </div>
                {offer.counter.note ? (
                  <div className="trade-invoice-row">
                    <span>{t('commonNotes')}</span>
                    <span>{offer.counter.note}</span>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {offer.status === 'pending' || offer.status === 'countered' ? (
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-ghost"
                onClick={() => navigate(`/dashboard/p/myOffers/${offer.id}/chat`)}
              >
                💬 {t('chatStartCta')}
              </button>
            </div>
          ) : null}

          {offer.status === 'pending' && isTarget ? (
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => void doAccept()}
                disabled={busyAction !== null}
              >
                {busyAction === 'accept' ? <span className="av-spinner" aria-hidden /> : t('offerAccept')}
              </button>
              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => setCounterOpen(true)}
                  disabled={busyAction !== null}
                >
                  {t('offerCounter')}
                </button>
                <button
                  type="button"
                  className="av-btn av-btn-plain"
                  style={{ background: 'var(--av-error)' }}
                  onClick={() => setDeclineOpen(true)}
                  disabled={busyAction !== null}
                >
                  {t('offerDecline')}
                </button>
              </div>
            </div>
          ) : null}

          {offer.status === 'pending' && isMaker ? (
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-plain"
                style={{ background: 'var(--av-error)' }}
                onClick={() => setWithdrawOpen(true)}
                disabled={busyAction !== null}
              >
                {t('offerWithdraw')}
              </button>
            </div>
          ) : null}

          {offer.status === 'countered' && isMaker ? (
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => void doAccept()}
                disabled={busyAction !== null}
              >
                {busyAction === 'accept' ? <span className="av-spinner" aria-hidden /> : t('offerAccept')}
              </button>
              <button
                type="button"
                className="av-btn av-btn-plain"
                style={{ background: 'var(--av-error)' }}
                onClick={() => setWithdrawOpen(true)}
                disabled={busyAction !== null}
              >
                {t('offerWithdraw')}
              </button>
            </div>
          ) : null}

          {offer.status === 'countered' && isTarget ? (
            <p className="trade-hint">{t('offerOneRoundHint')}</p>
          ) : null}

          {offer.status === 'accepted' ? (
            <div className="trade-actions">
              <button type="button" className="av-btn av-btn-primary" onClick={() => void viewPurchase()}>
                {t('offerViewPurchase')}
              </button>
            </div>
          ) : null}

          <ModalSheet
            open={counterOpen}
            onClose={() => setCounterOpen(false)}
            title={t('offerCounterTitle')}
          >
            <CounterOfferForm
              currentPrice={offer.counter?.pricePerUnit ?? offer.pricePerUnit}
              unit={unitLabel(t, offer.unit)}
              onSubmit={(price, note) => void submitCounter(price, note)}
              onCancel={() => setCounterOpen(false)}
              busy={busyAction === 'counter'}
            />
          </ModalSheet>

          <ConfirmSheet
            open={declineOpen}
            title={t('offerDecline')}
            confirmLabel={t('offerDecline')}
            onConfirm={() => void doDecline()}
            onClose={() => setDeclineOpen(false)}
            busy={busyAction === 'decline'}
          />

          <ConfirmSheet
            open={withdrawOpen}
            title={t('offerWithdraw')}
            confirmLabel={t('offerWithdraw')}
            onConfirm={() => void doWithdraw()}
            onClose={() => setWithdrawOpen(false)}
            busy={busyAction === 'withdraw'}
          />
        </>
      ) : null}
    </ToolShell>
  );
}
