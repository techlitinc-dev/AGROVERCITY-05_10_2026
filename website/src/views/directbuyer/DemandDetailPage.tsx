import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ModalSheet from '../../components/ModalSheet';
import CounterOfferForm from '../../components/trade/CounterOfferForm';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { getDemand, type Demand } from '../../lib/api/demands';
import {
  acceptOffer,
  counterOffer,
  myOffers,
  rejectOffer,
  type Offer,
} from '../../lib/api/offers';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const unitLabel = (t: (key: string) => string, unit: string): string =>
  unit === 'kg' ? t('unitKg') : t('unitQuintal');

const OPEN_STATUSES = ['pending', 'countered'];

interface AcceptResponse {
  purchase?: { id?: string };
}

/**
 * DemandDetailPage (P12) — a spot-RFQ buyer's demand with the received
 * BidTable (one row per offer: rate, quantity, date, actions) and the shared
 * P2 counter loop (CounterOfferForm with the round n/3 cap).
 */
export default function DemandDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { demandId } = useParams();
  const uid = useSessionStore((s) => s.user?.id ?? s.user?.uid);

  const [demand, setDemand] = useState<Demand | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [counterTarget, setCounterTarget] = useState<Offer | null>(null);

  const load = useCallback(() => {
    if (!demandId) return;
    setFailed(false);
    getDemand(demandId)
      .then(setDemand)
      .catch(() => setFailed(true));
    myOffers('received', 'demand')
      .then((res) => setOffers(res.data.filter((o) => o.targetId === demandId)))
      .catch(() => setOffers([]));
  }, [demandId]);

  useEffect(load, [load]);

  const sortedOffers = useMemo(
    () => [...offers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [offers]
  );

  const failToast = (e: unknown) => {
    if (isApiError(e) && e.code === 'NEGOTIATION_CLOSED') {
      toast(t('offerNegotiationClosed'), { error: true });
    } else {
      toast(t('actionFailed'), { error: true });
    }
  };

  const doAccept = async (offer: Offer) => {
    setBusy(true);
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
      setBusy(false);
    }
  };

  const doReject = async (offer: Offer) => {
    setBusy(true);
    try {
      await rejectOffer(offer.id);
      toast(t('offerDeclinedToast'));
      load();
    } catch (e) {
      failToast(e);
    } finally {
      setBusy(false);
    }
  };

  const submitCounter = async (pricePerUnit: number, note: string) => {
    if (!counterTarget) return;
    setBusy(true);
    try {
      await counterOffer(counterTarget.id, { pricePerUnit, note: note || undefined });
      toast(t('offerCounteredToast'));
      setCounterTarget(null);
      load();
    } catch (e) {
      failToast(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="demands" backTo="/dashboard/p/demands">
      {demand === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {demand ? (
        <>
          <div className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {demand.crop}
                {demand.variety ? ` · ${demand.variety}` : ''}
              </span>
              <StatusPill status={demand.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('demandsFor')} {demand.quantity} {unitLabel(t, demand.unit)}
              </span>
              <span className="trade-card-amount">
                ≤ {inr(demand.maxPrice)}/{unitLabel(t, demand.unit)}
              </span>
            </div>
          </div>

          <div className="trade-detail-grid">
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('demandsMaxPrice')}</div>
              <div className="trade-detail-value">
                {inr(demand.maxPrice)}/{unitLabel(t, demand.unit)}
              </div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('demandsGrade')}</div>
              <div className="trade-detail-value">{demand.qualityGrade}</div>
            </div>
            <div className="trade-detail-item">
              <div className="trade-detail-label">{t('demandsFrequency')}</div>
              <div className="trade-detail-value">{t(`freq_${demand.frequency}`)}</div>
            </div>
            {demand.neededBy ? (
              <div className="trade-detail-item">
                <div className="trade-detail-label">{t('demandsNeededBy')}</div>
                <div className="trade-detail-value">{fmtDate(demand.neededBy)}</div>
              </div>
            ) : null}
            {demand.deliveryLocation ? (
              <div className="trade-detail-item">
                <div className="trade-detail-label">{t('demandsLocation')}</div>
                <div className="trade-detail-value">{demand.deliveryLocation}</div>
              </div>
            ) : null}
          </div>
          {demand.notes ? <p className="trade-hint">{demand.notes}</p> : null}

          <p className="trade-section-title">{t('ddBidsTitle')}</p>

          {sortedOffers.length === 0 ? (
            <EmptyState icon="💬" titleKey="ddNoBids" bodyKey="ddNoBidsBody" />
          ) : (
            <div
              style={{
                background: '#fff',
                border: '1.5px solid var(--av-border-grey-soft)',
                borderRadius: 'var(--av-radius-card)',
                overflowX: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--av-border-grey-soft)' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 700 }}>{t('offerFrom')}</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700 }}>{t('ddBidRate')}</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700 }}>{t('offerQty')}</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700 }}>{t('ddBidDate')}</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700 }}>{t('ddBidStatus')}</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right' }}>
                      {t('ddBidActions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOffers.map((offer) => {
                    const isTarget = !!uid && offer.toId === uid;
                    const open = OPEN_STATUSES.includes(offer.status);
                    return (
                      <tr key={offer.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px' }}>{offer.fromName}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                          {inr(offer.pricePerUnit)}/{unitLabel(t, offer.unit)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {offer.quantity} {unitLabel(t, offer.unit)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>{fmtDate(offer.createdAt)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <StatusPill status={offer.status} />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          {open && isTarget ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="av-btn av-btn-primary"
                                style={{ padding: '4px 10px' }}
                                disabled={busy}
                                onClick={() => void doAccept(offer)}
                              >
                                {t('offerAccept')}
                              </button>
                              <button
                                type="button"
                                className="av-btn av-btn-ghost"
                                style={{ padding: '4px 10px' }}
                                disabled={busy}
                                onClick={() => setCounterTarget(offer)}
                              >
                                {t('offerCounter')}
                              </button>
                              <button
                                type="button"
                                className="av-btn av-btn-plain"
                                style={{ padding: '4px 10px', background: 'var(--av-error)' }}
                                disabled={busy}
                                onClick={() => void doReject(offer)}
                              >
                                {t('offerDecline')}
                              </button>
                            </div>
                          ) : offer.status === 'accepted' ? (
                            <Link className="av-link" to="/dashboard/p/purchases">
                              {t('offerViewPurchase')} →
                            </Link>
                          ) : (
                            <Link className="av-link" to={`/dashboard/p/myOffers/${offer.id}`}>
                              {t('ddBidOpen')} →
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      <ModalSheet
        open={counterTarget !== null}
        onClose={() => setCounterTarget(null)}
        title={t('offerCounterTitle')}
      >
        {counterTarget ? (
          <CounterOfferForm
            currentPrice={counterTarget.counter?.pricePerUnit ?? counterTarget.pricePerUnit}
            unit={unitLabel(t, counterTarget.unit)}
            rounds={counterTarget.rounds ?? 0}
            onAccept={() => {
              const target = counterTarget;
              setCounterTarget(null);
              void doAccept(target);
            }}
            onReject={() => {
              const target = counterTarget;
              setCounterTarget(null);
              void doReject(target);
            }}
            onSubmit={(price, note) => void submitCounter(price, note)}
            onCancel={() => setCounterTarget(null)}
            busy={busy}
          />
        ) : null}
      </ModalSheet>
    </ToolShell>
  );
}
