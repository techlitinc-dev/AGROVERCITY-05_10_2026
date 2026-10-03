import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DealChatDoor from '../../components/broker/DealChatDoor';
import DealMathCard from '../../components/broker/DealMathCard';
import DealStatusPill from '../../components/broker/DealStatusPill';
import DealTimeline from '../../components/broker/DealTimeline';
import EContractCard from '../../components/broker/EContractCard';
import EvidenceSection from '../../components/broker/EvidenceSection';
import OfferCard from '../../components/broker/OfferCard';
import { checkBlockedText } from '../../components/broker/D4TextGuard';
import ModalSheet from '../../components/ModalSheet';
import LabeledTextField from '../../components/LabeledTextField';
import CounterOfferForm from '../../components/trade/CounterOfferForm';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import {
  getFarmerDeal,
  inr,
  listFarmerDealMessages,
  respondToDeal,
  sendFarmerDealMessage,
  type Deal,
  type DealMessage,
} from '../../lib/api/broker';
import { mandiCompare } from '../../lib/api/mandi';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';
import '../../theme/broker.css';

const POLL_MS = 15000;
const RATING_TAGS = ['foTagFairWeighing', 'foTagOnTimePickup', 'foTagFairPrice'];

interface LocalRating {
  stars: number;
  tags: string[];
}

const ratingKey = (dealId: string) => `agvc-deal-rating-${dealId}`;

function loadRating(dealId: string): LocalRating | null {
  try {
    const raw = localStorage.getItem(ratingKey(dealId));
    return raw ? (JSON.parse(raw) as LocalRating) : null;
  } catch {
    return null;
  }
}

/**
 * Farmer offer detail — one card, one decision (plan §2.12): Accept / Counter
 * / Decline per the §5.4 farmer column, e-contract on contract_issued, chat
 * door after acceptance, timeline milestones, evidence upload, payout receipt
 * and a localStorage rating (two-sided ratings API is future work, §11).
 */
export default function FarmerDealDetailPage() {
  const t = useT();
  const { dealId = '' } = useParams();
  useEnsureProfile('farmer');

  const [deal, setDeal] = useState<Deal | null>(null);
  const [messages, setMessages] = useState<DealMessage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [benchmark, setBenchmark] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [rated, setRated] = useState(false);

  const load = useCallback(() => {
    getFarmerDeal(dealId)
      .then((d) => setDeal(d))
      .catch(() => setFailed(true));
    listFarmerDealMessages(dealId)
      .then((res) => setMessages(res.data))
      .catch(() => undefined);
  }, [dealId]);

  useEffect(load, [load]);

  useEffect(() => {
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!deal || deal.quantityQuintals <= 0) return;
    let live = true;
    mandiCompare(deal.commodity, deal.quantityQuintals)
      .then((res) => live && setBenchmark(res.data[0]?.modalPrice ?? null))
      .catch(() => live && setBenchmark(null));
    return () => {
      live = false;
    };
  }, [deal]);

  useEffect(() => {
    const saved = loadRating(dealId);
    if (saved) {
      setStars(saved.stars);
      setTags(saved.tags);
      setRated(true);
    }
  }, [dealId]);

  const run = async (fn: () => Promise<unknown>, successKey: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast(t(successKey));
      setAcceptOpen(false);
      setDeclineOpen(false);
      setCounterOpen(false);
      setDeclineReason('');
      load();
    } catch (e) {
      console.error(e);
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const accept = () => deal && void run(() => respondToDeal(deal.id, { action: 'accept' }), 'foAcceptedToast');

  const decline = () => {
    if (!deal || !declineReason.trim()) return;
    void run(
      () => respondToDeal(deal.id, { action: 'decline', reason: declineReason.trim() }),
      'foDeclinedToast'
    );
  };

  const counter = (price: number, note: string) => {
    if (!deal) return;
    const guard = checkBlockedText(note);
    if (guard.blocked) {
      toast(t('d4BlockedToast', { rule: t(guard.rule!) }), { error: true });
      return;
    }
    void run(
      () =>
        sendFarmerDealMessage(deal.id, {
          text: note || t('ddOfferAutoText', { price: inr(price) }),
          amountOffer: price,
        }),
      'foCounterSent'
    );
  };

  const saveRating = () => {
    if (stars === 0) {
      toast(t('foRatePickStars'), { error: true });
      return;
    }
    try {
      localStorage.setItem(ratingKey(dealId), JSON.stringify({ stars, tags }));
    } catch {
      // storage full — non-fatal
    }
    setRated(true);
    toast(t('foRateThanks'));
  };

  const toggleTag = (key: string) =>
    setTags((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  if (failed) {
    return (
      <ToolShell toolId="brokerOffers" backTo="/dashboard/p/brokerOffers">
        <div className="trade-empty">
          <span className="trade-empty-icon" aria-hidden>
            📡
          </span>
          <p className="trade-empty-title">{t('foDealNotFound')}</p>
          <div className="trade-empty-action">
            <Link className="av-btn av-btn-primary" to="/dashboard/p/brokerOffers">
              ← {t('tool_brokerOffers')}
            </Link>
          </div>
        </div>
      </ToolShell>
    );
  }

  const thread = messages ?? [];
  const decisionOpen =
    deal !== null && ['negotiating', 'contract_issued'].includes(deal.status);

  return (
    <ToolShell toolId="brokerOffers" backTo="/dashboard/p/brokerOffers">
      {deal === null ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {deal !== null ? (
        <>
          <div className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {deal.commodity}
                {deal.variety ? ` · ${deal.variety}` : ''}
                {deal.grade ? ` · ${deal.grade}` : ''}
              </span>
              <DealStatusPill status={deal.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('foOfferFrom')}: <strong>{deal.brokerName ?? t('commonNotAvailable')}</strong>
              </span>
              <span className="trade-card-amount">
                {inr(deal.agreedRate)}
                {t('perQuintal')}
              </span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {deal.quantityQuintals} {t('unitQuintalShort')}
                {deal.deliveryLocation ? ` · 📍 ${deal.deliveryLocation}` : ''}
              </span>
            </div>
            <PriceWithBenchmarkStrip deal={deal} benchmark={benchmark} />
          </div>

          {deal.status === 'cancelled' ? (
            <p className="trade-hint">
              ❌ {t('foCancelledBody')}
              {deal.cancelReason ? ` ${t('ddCancelReasonShown', { reason: deal.cancelReason })}` : ''}
            </p>
          ) : null}

          <p className="trade-section-title">{t('foPayoutTitle')}</p>
          <DealMathCard
            quantityQuintals={deal.quantityQuintals}
            agreedRate={deal.agreedRate}
            pct={deal.brokerCommissionPct}
            variant="farmer"
          />
          {deal.paymentTerms ? (
            <p className="trade-hint">
              💳 {t('foPaymentTerms')}: {deal.paymentTerms}
            </p>
          ) : null}

          {/* ---- One-tap decision (§5.4 farmer column) ---- */}
          {decisionOpen ? (
            <div className="trade-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => setAcceptOpen(true)}
              >
                ✅ {t('foAccept')}
              </button>
              {deal.status === 'negotiating' ? (
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => setCounterOpen(true)}
                >
                  ⇄ {t('foCounter')}
                </button>
              ) : null}
              <button
                type="button"
                className="av-btn av-btn-plain"
                style={{ background: 'var(--av-error)' }}
                onClick={() => setDeclineOpen(true)}
              >
                {t('foDecline')}
              </button>
            </div>
          ) : null}

          {deal.status === 'accepted' ? (
            <div className="trade-invoice-box">
              <p className="trade-benchmark-title">🔓 {t('foWhatNext')}</p>
              <p className="trade-card-sub">{t('foWhatNextBody')}</p>
              {deal.notes ? (
                <p className="trade-card-sub" style={{ whiteSpace: 'pre-line', marginTop: 6 }}>
                  {deal.notes}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* ---- Negotiation thread ---- */}
          {thread.length > 0 ? (
            <>
              <p className="trade-section-title">{t('ddOfferThread')}</p>
              <div className="chat-wrap">
                <div className="chat-scroll">
                  {thread.map((m) => (
                    <OfferCard key={m.id} message={m} viewer="farmer" benchmark={benchmark} />
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {['contract_issued', 'accepted', 'in_transit', 'completed'].includes(deal.status) ? (
            <EContractCard deal={deal} />
          ) : null}

          <p className="trade-section-title">{t('purchaseTimeline')}</p>
          <DealTimeline deal={deal} />

          {deal.status === 'completed' ? (
            <>
              <p className="trade-section-title">{t('foReceiptTitle')}</p>
              <div className="broker-receipt">
                <EContractCard deal={deal} />
              </div>

              <p className="trade-section-title">{t('foRateBroker')}</p>
              <div className="trade-card" style={{ cursor: 'default' }}>
                <div className="broker-stars" role="radiogroup" aria-label={t('foRateBroker')}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`broker-star${stars >= n ? ' filled' : ''}`}
                      disabled={rated}
                      onClick={() => setStars(n)}
                      aria-label={String(n)}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <div className="broker-pipeline-chips">
                  {RATING_TAGS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`av-chip${tags.includes(key) ? ' selected' : ''}`}
                      disabled={rated}
                      onClick={() => toggleTag(key)}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
                <div className="trade-actions">
                  {rated ? (
                    <p className="trade-hint">
                      🙏 {t('foRateThanks')} · {t('foRatingSyncNote')}
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="av-btn av-btn-primary"
                      onClick={saveRating}
                      disabled={stars === 0}
                    >
                      {t('foRateSubmit')}
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : null}

          <EvidenceSection deal={deal} role="farmer" onUploaded={load} />

          <p className="trade-section-title">{t('chatTitle')}</p>
          <DealChatDoor deal={deal} viewer="farmer" />
        </>
      ) : null}

      {/* ---- Accept ---- */}
      <ModalSheet open={acceptOpen} onClose={() => setAcceptOpen(false)} title={t('foAccept')}>
        <p className="trade-hint" style={{ marginBottom: 12 }}>
          {t('foAcceptConfirmBody')}
        </p>
        {deal ? (
          <DealMathCard
            quantityQuintals={deal.quantityQuintals}
            agreedRate={deal.agreedRate}
            pct={deal.brokerCommissionPct}
            variant="farmer"
          />
        ) : null}
        <div className="trade-actions">
          <button type="button" className="av-btn av-btn-primary" onClick={accept} disabled={busy}>
            {busy ? <span className="av-spinner" aria-hidden /> : t('commonConfirm')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setAcceptOpen(false)} disabled={busy}>
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>

      {/* ---- Counter ---- */}
      <ModalSheet open={counterOpen} onClose={() => setCounterOpen(false)} title={t('foCounter')}>
        {deal ? (
          <CounterOfferForm
            currentPrice={deal.agreedRate}
            unit={t('unitQuintal')}
            onSubmit={(price, note) => counter(price, note)}
            onCancel={() => setCounterOpen(false)}
            busy={busy}
          />
        ) : null}
      </ModalSheet>

      {/* ---- Decline ---- */}
      <ModalSheet open={declineOpen} onClose={() => setDeclineOpen(false)} title={t('foDecline')}>
        <p className="trade-hint" style={{ marginBottom: 12 }}>
          {t('foDeclineBody')}
        </p>
        <LabeledTextField
          label={t('foDeclineReason')}
          value={declineReason}
          onChange={setDeclineReason}
          required
        />
        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-plain"
            style={{ background: 'var(--av-error)' }}
            onClick={decline}
            disabled={busy || !declineReason.trim()}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('foDeclineConfirm')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setDeclineOpen(false)} disabled={busy}>
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}

/** Benchmark strip that hides itself on error (hard rule: no fabricated numbers). */
function PriceWithBenchmarkStrip({ deal, benchmark }: { deal: Deal; benchmark: number | null }) {
  const t = useT();
  if (benchmark === null || benchmark <= 0) return null;
  const delta = deal.agreedRate - benchmark;
  return (
    <p className={delta <= 0 ? 'trade-benchmark-good' : 'trade-benchmark-warn'}>
      {delta <= 0
        ? t('benchmarkBelow', { amount: inr(Math.abs(delta)) })
        : t('benchmarkAbove', { amount: inr(delta) })}
    </p>
  );
}
