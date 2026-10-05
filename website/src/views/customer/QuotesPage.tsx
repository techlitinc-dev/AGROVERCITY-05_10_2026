import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  acceptCustomerQuote,
  counterCustomerQuote,
  fetchCustomerQuotes,
  type CustomerOrder,
  type CustomerQuote,
  type FairPriceBand,
} from '../../lib/api/emarketCustomer';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const COUNTER_ROUND_CAP = 3;

const QUOTE_STATUS_KEYS: Record<string, string> = {
  pending: 'emarketStatusPending',
  countered: 'emarketStatusCountered',
  accepted: 'emarketStatusAccepted',
  rejected: 'emarketStatusRejected',
  quote_pending: 'emarketStatusQuotePending',
  expired: 'emarketStatusExpired',
};

const ESCROW_STATUS_KEYS: Record<string, string> = {
  unfunded: 'emarketEscrowUnfunded',
  funded: 'emarketEscrowFunded',
  partial_released: 'emarketEscrowPartialReleased',
  released: 'emarketEscrowReleased',
  frozen: 'emarketEscrowFrozen',
  refunded: 'emarketEscrowRefunded',
};

function rupees(paisa: number): string {
  return (paisa / 100).toFixed(2);
}

function formatTime(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleString();
}

/**
 * Quotes (WS-03 task 3.6, spec C5/E8) — list GET /v1/customer/quotes with the
 * fair-price band, counter offers capped at 3 rounds with the price-lock timer,
 * and accept (POST …/accept) surfacing the deposit-escrow requirement for
 * high-value orders.
 */
export default function QuotesPage() {
  const t = useT();
  const [quotes, setQuotes] = useState<CustomerQuote[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterReason, setCounterReason] = useState('');
  const [acceptedOrder, setAcceptedOrder] = useState<CustomerOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    fetchCustomerQuotes()
      .then(setQuotes)
      .catch(() => {
        setQuotes([]);
        toast(t('emarketLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // Price-lock countdown refresh (the lock is a rolling backend timestamp).
  useEffect(() => {
    const handle = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(handle);
  }, []);

  const bandLabel = (band: FairPriceBand | undefined): string => {
    if (!band || band.sampleSize === 0 || band.minUnitPaisa === null || band.maxUnitPaisa === null) {
      return t('emarketBandNone');
    }
    return `${t('emarketBandRange', {
      min: rupees(band.minUnitPaisa),
      max: rupees(band.maxUnitPaisa),
    })} · ${t('emarketBandSample', { count: band.sampleSize })}`;
  };

  const lockLabel = (quote: CustomerQuote): string | null => {
    if (!quote.priceLockUntil) return null;
    void tick;
    return t('emarketPriceLockUntil', { time: formatTime(quote.priceLockUntil) });
  };

  const handleCounter = async (event: React.FormEvent, quote: CustomerQuote) => {
    event.preventDefault();
    setBusy(true);
    try {
      await counterCustomerQuote(quote.id, {
        counterPricePerQuintal: Number(counterPrice),
        reason: counterReason.trim(),
      });
      setCounterPrice('');
      setCounterReason('');
      toast(t('emarketCounterSent'));
      load();
    } catch {
      toast(t('emarketActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async (quote: CustomerQuote) => {
    setBusy(true);
    try {
      const order = await acceptCustomerQuote(quote.id);
      setAcceptedOrder(order);
      toast(t('emarketQuoteAccepted'));
      load();
    } catch {
      toast(t('emarketActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="quotes">
      <section className="dash-section">
        <h3>{t('emarketQuotes')}</h3>
        {quotes === null ? (
          <p className="dash-empty-line">{t('emarketLoading')}</p>
        ) : quotes.length === 0 ? (
          <p className="dash-empty-line">💬 {t('emarketNoQuotes')}</p>
        ) : (
          quotes.map((quote) => {
            const usedRounds =
              quote.counterRounds !== undefined
                ? quote.counterRounds
                : Math.max(0, quote.negotiationRound - 1);
            const capReached = usedRounds >= COUNTER_ROUND_CAP;
            const open = quote.status === 'pending' || quote.status === 'countered';
            return (
              <div
                key={quote.id}
                style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gap: 4 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="av-btn"
                    style={{ background: 'none', color: '#111827', padding: 0, fontWeight: 600 }}
                    onClick={() => setActiveId(activeId === quote.id ? null : quote.id)}
                  >
                    {quote.crop} • {quote.farmerName}
                  </button>
                  <span className="av-chip" style={{ fontSize: 12 }}>
                    {t(QUOTE_STATUS_KEYS[quote.status] ?? 'emarketStatusPending')}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  {t('emarketOfferPrice')}: {quote.offeredPricePerQuintal} • {t('emarketQuantityQuintals')}:{' '}
                  {quote.quantityQuintals} • {t('emarketFarmerId')}: {quote.farmerId}
                </div>
                <div style={{ fontSize: 13 }}>
                  {t('emarketFairPriceBand')}: {bandLabel(quote.fairPriceBand)}
                </div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  {t('emarketCounterRounds', { used: usedRounds, total: COUNTER_ROUND_CAP })}
                  {quote.expiresAt ? ` • ${t('emarketExpiresAt', { time: formatTime(quote.expiresAt) })}` : ''}
                </div>
                {lockLabel(quote) ? (
                  <div style={{ fontSize: 13, color: '#6B7280' }}>⏱️ {lockLabel(quote)}</div>
                ) : null}

                {activeId === quote.id && open ? (
                  <div style={{ display: 'grid', gap: 8, maxWidth: 420, marginTop: 6 }}>
                    {capReached ? (
                      <p className="dash-empty-line">{t('emarketCounterCapReached')}</p>
                    ) : (
                      <form onSubmit={(event) => handleCounter(event, quote)} style={{ display: 'grid', gap: 8 }}>
                        <input
                          className="av-input"
                          type="number"
                          step="0.01"
                          placeholder={t('emarketCounterPrice')}
                          value={counterPrice}
                          onChange={(e) => setCounterPrice(e.target.value)}
                          required
                        />
                        <input
                          className="av-input"
                          placeholder={t('emarketCounterReason')}
                          value={counterReason}
                          onChange={(e) => setCounterReason(e.target.value)}
                        />
                        <button type="submit" className="av-btn" disabled={busy}>
                          {t('emarketSubmitCounter')}
                        </button>
                      </form>
                    )}
                    <p className="dash-empty-line">{t('emarketDepositRequired')}</p>
                    <button
                      type="button"
                      className="av-btn"
                      disabled={busy}
                      onClick={() => handleAccept(quote)}
                    >
                      {t('emarketAccept')}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      {acceptedOrder ? (
        <section className="dash-section">
          <h3>{t('emarketQuoteAccepted')}</h3>
          <div style={{ display: 'grid', gap: 4, fontSize: 14 }}>
            <div>
              {t('emarketEscrow')}:{' '}
              {t(ESCROW_STATUS_KEYS[acceptedOrder.escrowStatus] ?? 'emarketEscrowUnfunded')}
            </div>
            {acceptedOrder.depositPaisa ? (
              <div>{t('emarketDepositAmount', { amount: rupees(acceptedOrder.depositPaisa) })}</div>
            ) : null}
          </div>
        </section>
      ) : null}
    </ToolShell>
  );
}
