import { DEFAULT_BROKER_PCT, ZERO } from '../../lib/numDefaults';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DealChatDoor from '../../components/broker/DealChatDoor';
import DealMathCard from '../../components/broker/DealMathCard';
import DealStatusPill from '../../components/broker/DealStatusPill';
import DealTimeline from '../../components/broker/DealTimeline';
import EContractCard from '../../components/broker/EContractCard';
import EvidenceSection from '../../components/broker/EvidenceSection';
import MaskedPhoneText from '../../components/broker/MaskedPhoneText';
import OfferCard from '../../components/broker/OfferCard';
import { checkBlockedText } from '../../components/broker/D4TextGuard';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import {
  cancelDeal,
  dealMath,
  getDeal,
  inr,
  listDealMessages,
  maskPlate,
  sendDealMessage,
  updateDeal,
  type Deal,
  type DealMessage,
} from '../../lib/api/broker';
import { mandiCompare } from '../../lib/api/mandi';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';
import '../../theme/broker.css';

const POLL_MS = 15000;

const fmtUpdated = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Deal desk detail — structured offer thread (15s poll while open), status
 * action bar per plan §5.4, e-contract card, timeline, evidence and the
 * post-acceptance chat door. The D4 guard runs on every free-text send.
 */
export default function DealDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { dealId = '' } = useParams();
  useEnsureProfile('broker');

  const [deal, setDeal] = useState<Deal | null>(null);
  const [messages, setMessages] = useState<DealMessage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [benchmark, setBenchmark] = useState<number | null>(null);

  // Composer
  const [offerAmount, setOfferAmount] = useState(0);
  const [offerNote, setOfferNote] = useState('');
  const [sending, setSending] = useState(false);

  // Sheets
  const [issueOpen, setIssueOpen] = useState(false);
  const [transitOpen, setTransitOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [weighedQty, setWeighedQty] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getDeal(dealId)
      .then((d) => {
        setDeal(d);
        setOfferAmount((prev) => (prev > 0 ? prev : d.agreedRate));
      })
      .catch(() => setFailed(true));
    listDealMessages(dealId)
      .then((res) => setMessages(res.data))
      .catch(() => undefined);
  }, [dealId]);

  useEffect(load, [load]);

  // Poll while the detail is open (plan §1.4: no realtime, REST polling v1).
  useEffect(() => {
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Mandi modal for offer-card deltas — hidden automatically when it fails.
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

  const refreshDeal = () => load();

  const runAction = async (fn: () => Promise<unknown>, successKey: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast(t(successKey));
      setIssueOpen(false);
      setTransitOpen(false);
      setCompleteOpen(false);
      setCancelOpen(false);
      setCancelReason('');
      load();
    } catch (e) {
      console.error(e);
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const sendOffer = async () => {
    if (!deal || sending) return;
    const text = offerNote.trim();
    const guard = checkBlockedText(text);
    if (guard.blocked) {
      toast(t('d4BlockedToast', { rule: t(guard.rule!) }), { error: true });
      return;
    }
    if (!(offerAmount > 0)) {
      toast(t('counterPriceInvalid'), { error: true });
      return;
    }
    setSending(true);
    try {
      await sendDealMessage(deal.id, {
        senderRole: 'broker',
        text: text || t('ddOfferAutoText', { price: inr(offerAmount) }),
        amountOffer: offerAmount,
      });
      setOfferNote('');
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setSending(false);
    }
  };

  const nudge = () => {
    if (!deal) return;
    void runAction(
      () =>
        sendDealMessage(deal.id, {
          senderRole: 'broker',
          text: t('ddNudgeText'),
        }),
      'ddNudgeSent'
    );
  };

  const vehicleNote = () => {
    const parts = [
      vehicleType.trim(),
      vehicleNumber.trim() ? maskPlate(vehicleNumber.trim()) : '',
      driverName.trim(),
    ].filter(Boolean);
    return parts.length ? `🚚 ${parts.join(' · ')}` : '';
  };

  const appendNote = (base: string | undefined, addition: string) =>
    [base?.trim(), addition].filter(Boolean).join('\n');

  const weighed = Number(weighedQty);
  const showProRata = deal !== null && weighed > 0 && weighed !== deal.quantityQuintals;

  const cancelAllowed =
    deal !== null && ['negotiating', 'contract_issued', 'accepted'].includes(deal.status);
  const composerAllowed =
    deal !== null && ['negotiating', 'contract_issued'].includes(deal.status);
  const contractVisible =
    deal !== null &&
    ['contract_issued', 'accepted', 'in_transit', 'completed'].includes(deal.status);

  const thread = useMemo(() => messages ?? [], [messages]);

  if (failed) {
    return (
      <ToolShell toolId="deals" backTo="/dashboard/p/deals">
        <div className="trade-empty">
          <span className="trade-empty-icon" aria-hidden>
            📡
          </span>
          <p className="trade-empty-title">{t('dealNotFound')}</p>
          <div className="trade-empty-action">
            <Link className="av-btn av-btn-primary" to="/dashboard/p/deals">
              ← {t('tool_deals')}
            </Link>
          </div>
        </div>
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="deals" backTo="/dashboard/p/deals">
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
                {deal.sellerName} → {deal.buyerName}
              </span>
              <span className="trade-card-amount">
                {deal.quantityQuintals} {t('unitQuintalShort')} × {inr(deal.agreedRate)}
              </span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                <MaskedPhoneText phone={deal.sellerPhone} /> →{' '}
                <MaskedPhoneText phone={deal.buyerPhone} />
              </span>
              <span className="trade-card-sub">{fmtUpdated(deal.updatedAt)}</span>
            </div>
            {deal.deliveryLocation ? (
              <p className="trade-card-sub">
                📍 {deal.deliveryLocation}
              </p>
            ) : null}
            {['negotiating', 'contract_issued'].includes(deal.status) ? (
              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => navigate(`/dashboard/p/broker/deals/${deal.id}/edit`)}
                >
                  {t('commonEdit')}
                </button>
              </div>
            ) : null}
          </div>

          {deal.status === 'completed' ? (
            <p className="trade-hint">🎉 {t('ddCompletedBanner')}</p>
          ) : null}
          {deal.status === 'cancelled' ? (
            <p className="trade-hint">
              ❌ {t('ddCancelledBanner')}
              {deal.cancelReason ? ` ${t('ddCancelReasonShown', { reason: deal.cancelReason })}` : ''}
            </p>
          ) : null}

          <DealMathCard
            quantityQuintals={deal.quantityQuintals}
            agreedRate={deal.agreedRate}
            pct={deal.brokerCommissionPct}
          />

          {/* ---- Structured negotiation thread (chat LOCKED pre-acceptance) ---- */}
          <p className="trade-section-title">{t('ddOfferThread')}</p>
          <div className="chat-wrap">
            <div className="chat-scroll">
              {thread.length === 0 ? <p className="trade-hint">{t('ddThreadEmpty')}</p> : null}
              {thread.map((m) => (
                <OfferCard key={m.id} message={m} viewer="broker" benchmark={benchmark} />
              ))}
            </div>
          </div>

          {composerAllowed ? (
            <div className="trade-card" style={{ cursor: 'default' }}>
              <p className="trade-section-title" style={{ margin: 0 }}>
                {t('ddComposerTitle')}
              </p>
              <div className="av-field" style={{ marginTop: 8 }}>
                <span className="av-label">{t('ddOfferAmount')}</span>
                <div className="trade-stepper">
                  <button
                    type="button"
                    className="trade-stepper-btn"
                    aria-label={t('qtyDecrease')}
                    onClick={() => setOfferAmount((v) => Math.max(1, v - 10))}
                  >
                    −
                  </button>
                  <span className="trade-stepper-value">
                    {offerAmount}
                    <small> ₹/{t('unitQuintalShort')}</small>
                  </span>
                  <button
                    type="button"
                    className="trade-stepper-btn"
                    aria-label={t('qtyIncrease')}
                    onClick={() => setOfferAmount((v) => v + 10)}
                  >
                    +
                  </button>
                </div>
                <p className="trade-hint">
                  {t('ddCommissionPreview', {
                    amount: inr(
                      dealMath(deal.quantityQuintals, offerAmount, deal.brokerCommissionPct)
                        .commission
                    ),
                  })}
                </p>
              </div>
              <LabeledTextField
                label={t('ddOfferNote')}
                value={offerNote}
                onChange={setOfferNote}
                maxLength={200}
              />
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => void sendOffer()}
                disabled={sending}
              >
                {sending ? <span className="av-spinner" aria-hidden /> : t('ddOfferSend')}
              </button>
            </div>
          ) : null}

          {/* ---- Status action bar (plan §5.4 broker column) ---- */}
          <div className="trade-actions">
            {deal.status === 'negotiating' ? (
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => setIssueOpen(true)}
              >
                📜 {t('ddIssueContract')}
              </button>
            ) : null}

            {deal.status === 'contract_issued' ? (
              <>
                <p className="trade-hint">⏳ {t('ddWaitingFarmer')}</p>
                <button type="button" className="av-btn av-btn-ghost" onClick={nudge} disabled={busy}>
                  {t('ddNudge')}
                </button>
              </>
            ) : null}

            {deal.status === 'accepted' ? (
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => setTransitOpen(true)}
              >
                🚚 {t('ddMarkTransit')}
              </button>
            ) : null}

            {deal.status === 'in_transit' ? (
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => setCompleteOpen(true)}
              >
                ✅ {t('ddMarkCompleted')}
              </button>
            ) : null}

            {cancelAllowed ? (
              <button
                type="button"
                className="av-btn av-btn-plain"
                style={{ background: 'var(--av-error)' }}
                onClick={() => setCancelOpen(true)}
              >
                {t('ddCancel')}
              </button>
            ) : null}
          </div>

          {contractVisible ? <EContractCard deal={deal} /> : null}

          <p className="trade-section-title">{t('purchaseTimeline')}</p>
          <DealTimeline deal={deal} />

          {deal.notes ? (
            <>
              <p className="trade-section-title">{t('commonNotes')}</p>
              <p className="trade-card-sub" style={{ whiteSpace: 'pre-line' }}>
                {deal.notes}
              </p>
            </>
          ) : null}

          <EvidenceSection deal={deal} role="broker" onUploaded={refreshDeal} />

          <p className="trade-section-title">{t('chatTitle')}</p>
          <DealChatDoor deal={deal} viewer="broker" />
        </>
      ) : null}

      {/* ---- Issue contract ---- */}
      <ModalSheet open={issueOpen} onClose={() => setIssueOpen(false)} title={t('ddIssueContract')}>
        <p className="trade-hint" style={{ marginBottom: 12 }}>
          {t('ddIssueContractBody')}
        </p>
        <DealMathCard
          quantityQuintals={deal?.quantityQuintals ?? ZERO}
          agreedRate={deal?.agreedRate ?? ZERO}
          pct={deal?.brokerCommissionPct ?? DEFAULT_BROKER_PCT}
        />
        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={busy}
            onClick={() => deal && void runAction(() => updateDeal(deal.id, { status: 'contract_issued' }), 'ddContractIssued')}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('commonConfirm')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setIssueOpen(false)} disabled={busy}>
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>

      {/* ---- Mark in-transit (vehicle note, B8 masked plate) ---- */}
      <ModalSheet open={transitOpen} onClose={() => setTransitOpen(false)} title={t('ddMarkTransit')}>
        <LabeledTextField
          label={t('ddVehicleType')}
          value={vehicleType}
          onChange={setVehicleType}
          placeholder={t('ddVehicleTypePlaceholder')}
        />
        <LabeledTextField
          label={t('ddVehicleNumber')}
          value={vehicleNumber}
          onChange={setVehicleNumber}
          placeholder="MH 12 AB 1234"
        />
        <LabeledTextField
          label={t('ddDriverName')}
          value={driverName}
          onChange={setDriverName}
        />
        <p className="trade-hint">{t('ddVehicleMaskNote')}</p>
        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={busy}
            onClick={() =>
              deal &&
              void runAction(
                () =>
                  updateDeal(deal.id, {
                    status: 'in_transit',
                    notes: appendNote(deal.notes, vehicleNote()),
                  }),
                'ddTransitMarked'
              )
            }
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('commonConfirm')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setTransitOpen(false)} disabled={busy}>
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>

      {/* ---- Complete with optional weighed qty (E6 pro-rata) ---- */}
      <ModalSheet open={completeOpen} onClose={() => setCompleteOpen(false)} title={t('ddMarkCompleted')}>
        <LabeledTextField
          label={t('ddWeighedQty', { qty: deal?.quantityQuintals ?? ZERO })}
          value={weighedQty}
          onChange={setWeighedQty}
          type="number"
          inputMode="decimal"
          placeholder={String(deal?.quantityQuintals ?? '')}
        />
        {deal && showProRata ? (
          <DealMathCard
            quantityQuintals={deal.quantityQuintals}
            agreedRate={deal.agreedRate}
            pct={deal.brokerCommissionPct}
            weighedQty={weighed}
          />
        ) : null}
        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={busy}
            onClick={() => {
              if (!deal) return;
              const addition =
                showProRata && weighed > 0
                  ? t('ddWeighedAdjustment', { booked: deal.quantityQuintals, weighed })
                  : '';
              void runAction(
                () =>
                  updateDeal(deal.id, {
                    status: 'completed',
                    notes: appendNote(deal.notes, addition),
                  }),
                'ddCompletedMarked'
              );
            }}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('commonConfirm')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setCompleteOpen(false)} disabled={busy}>
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>

      {/* ---- Cancel (mandatory reason; strike warning post-acceptance) ---- */}
      <ModalSheet open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('ddCancelTitle')}>
        {deal?.status === 'accepted' ? (
          <p className="trade-hint" style={{ marginBottom: 12 }}>
            ⚠️ {t('ddCancelStrikeWarning')}
          </p>
        ) : null}
        <LabeledTextField
          label={t('ddCancelReason')}
          value={cancelReason}
          onChange={setCancelReason}
          required
        />
        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-plain"
            style={{ background: 'var(--av-error)' }}
            disabled={busy || !cancelReason.trim()}
            onClick={() => deal && void runAction(() => cancelDeal(deal.id, cancelReason.trim()), 'ddCancelled')}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('ddCancelConfirm')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setCancelOpen(false)} disabled={busy}>
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
