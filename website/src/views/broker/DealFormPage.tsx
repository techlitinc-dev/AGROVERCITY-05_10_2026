import { DEFAULT_BROKER_PCT } from '../../lib/numDefaults';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CommissionStepper from '../../components/broker/CommissionStepper';
import DealMathCard from '../../components/broker/DealMathCard';
import LabeledTextField from '../../components/LabeledTextField';
import QuantityStepper from '../../components/trade/QuantityStepper';
import PriceWithBenchmark from '../../components/trade/PriceWithBenchmark';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createDeal,
  getDeal,
  updateDeal,
  updateLead,
  type Deal,
} from '../../lib/api/broker';
import { mandiCompare, mandiPrices } from '../../lib/api/mandi';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';
import '../../theme/broker.css';

interface DealDraft {
  buyerName: string;
  buyerPhone: string;
  buyerCompany: string;
  sellerName: string;
  sellerPhone: string;
  commodity: string;
  variety: string;
  grade: string;
  quantityQuintals: number;
  agreedRate: number;
  brokerCommissionPct: number;
  paymentTerms: string;
  deliveryLocation: string;
  notes: string;
}

const EMPTY_DRAFT: DealDraft = {
  buyerName: '',
  buyerPhone: '',
  buyerCompany: '',
  sellerName: '',
  sellerPhone: '',
  commodity: '',
  variety: '',
  grade: 'Grade A',
  quantityQuintals: 10,
  agreedRate: 0,
  brokerCommissionPct: 2,
  paymentTerms: '100% Bank Transfer on Delivery',
  deliveryLocation: '',
  notes: '',
};

const GRADES = ['Grade A', 'Grade B', 'Grade C'];

const prefsKey = (uid: string) => `agvc-broker-prefs-${uid}`;

function loadPrefs(uid: string): { pct: number; paymentTerms: string } {
  try {
    const raw = localStorage.getItem(prefsKey(uid));
    if (raw) {
      const parsed = JSON.parse(raw) as { pct?: number; paymentTerms?: string };
      return { pct: parsed.pct ?? DEFAULT_BROKER_PCT, paymentTerms: parsed.paymentTerms ?? EMPTY_DRAFT.paymentTerms };
    }
  } catch {
    // fall through to defaults
  }
  return { pct: 2, paymentTerms: EMPTY_DRAFT.paymentTerms };
}

/**
 * New / edit deal — 3-step wizard (Parties → Produce → Terms, plan §5.1 B4).
 * Crop names come from the live /mandi/prices list (datalist, never a
 * hardcoded list); the rate can be seeded from the mandi modal price with the
 * benchmark strip beside it; the math card is live on every step. Drafts
 * autosave to localStorage per uid (C12) and lead "Make deal" pre-fills via
 * query params.
 */
export default function DealFormPage() {
  const t = useT();
  const navigate = useNavigate();
  const { dealId } = useParams();
  const [searchParams] = useSearchParams();
  useEnsureProfile('broker');

  const uid = useSessionStore((s) => s.user?.id ?? s.user?.uid ?? 'anon');
  const draftKey = `agvc-broker-deal-draft-${uid}`;
  const editing = Boolean(dealId);

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DealDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingDeal, setLoadingDeal] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [cropOptions, setCropOptions] = useState<string[]>([]);
  const [mandiModal, setMandiModal] = useState<number | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  // Crop datalist from the live mandi price feed.
  useEffect(() => {
    mandiPrices({ page: 1, pageSize: 100 })
      .then((res) => {
        const crops = Array.from(new Set(res.data.map((p) => p.commodity).filter(Boolean)));
        setCropOptions(crops);
      })
      .catch(() => setCropOptions([]));
  }, []);

  // Seed: prefs defaults + lead prefill + saved draft (prefill wins over draft).
  useEffect(() => {
    const prefs = loadPrefs(uid);
    const fromQuery: Partial<DealDraft> = {};
    const q = (name: string) => searchParams.get(name);
    if (q('buyerName')) fromQuery.buyerName = q('buyerName')!;
    if (q('buyerPhone')) fromQuery.buyerPhone = q('buyerPhone')!;
    if (q('buyerCompany')) fromQuery.buyerCompany = q('buyerCompany')!;
    if (q('sellerName')) fromQuery.sellerName = q('sellerName')!;
    if (q('sellerPhone')) fromQuery.sellerPhone = q('sellerPhone')!;
    if (q('commodity')) fromQuery.commodity = q('commodity')!;
    if (q('quantityQuintals')) fromQuery.quantityQuintals = Number(q('quantityQuintals'));
    if (q('targetRate')) fromQuery.agreedRate = Number(q('targetRate'));

    if (editing) {
      getDeal(dealId!)
        .then((deal: Deal) => {
          setDraft({
            buyerName: deal.buyerName,
            buyerPhone: deal.buyerPhone,
            buyerCompany: deal.buyerCompany ?? '',
            sellerName: deal.sellerName,
            sellerPhone: deal.sellerPhone,
            commodity: deal.commodity,
            variety: deal.variety ?? '',
            grade: deal.grade ?? 'Grade A',
            quantityQuintals: deal.quantityQuintals,
            agreedRate: deal.agreedRate,
            brokerCommissionPct: deal.brokerCommissionPct,
            paymentTerms: deal.paymentTerms ?? EMPTY_DRAFT.paymentTerms,
            deliveryLocation: deal.deliveryLocation ?? '',
            notes: deal.notes ?? '',
          });
          setLoadingDeal(false);
          setSeeded(true);
        })
        .catch(() => {
          toast(t('dealNotFound'), { error: true });
          navigate('/dashboard/p/deals');
        });
      return;
    }

    let saved: Partial<DealDraft> = {};
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) saved = JSON.parse(raw) as Partial<DealDraft>;
    } catch {
      // corrupted draft — start fresh
    }
    setDraft((prev) => ({
      ...prev,
      ...saved,
      brokerCommissionPct: saved.brokerCommissionPct ?? prefs.pct,
      paymentTerms: saved.paymentTerms ?? prefs.paymentTerms,
      ...fromQuery,
    }));
    setSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, dealId, editing]);

  // Draft autosave (C12) — cleared on successful submit. Waits for seeding so
  // the saved draft is never clobbered by the empty initial state.
  useEffect(() => {
    if (editing || !seeded) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // storage full — non-fatal
    }
  }, [draft, draftKey, editing, seeded]);

  // Mandi modal seed for the chosen crop + qty.
  useEffect(() => {
    if (!draft.commodity || draft.quantityQuintals <= 0) {
      setMandiModal(null);
      return;
    }
    let live = true;
    mandiCompare(draft.commodity, draft.quantityQuintals)
      .then((res) => live && setMandiModal(res.data[0]?.modalPrice ?? null))
      .catch(() => live && setMandiModal(null));
    return () => {
      live = false;
    };
  }, [draft.commodity, draft.quantityQuintals]);

  const patch = (p: Partial<DealDraft>) => {
    setDraft((prev) => ({ ...prev, ...p }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(p)) delete next[k];
      return next;
    });
  };

  const validStep = useCallback(
    (s: number): Record<string, string> => {
      const next: Record<string, string> = {};
      if (s === 0) {
        if (!draft.buyerName.trim()) next.buyerName = t('commonRequired');
        if (!draft.buyerPhone.trim()) next.buyerPhone = t('commonRequired');
        if (!draft.sellerName.trim()) next.sellerName = t('commonRequired');
        if (!draft.sellerPhone.trim()) next.sellerPhone = t('commonRequired');
      }
      if (s === 1) {
        if (!draft.commodity.trim()) next.commodity = t('commonRequired');
        if (!(draft.quantityQuintals > 0)) next.quantityQuintals = t('commonRequired');
        if (!(draft.agreedRate > 0)) next.agreedRate = t('commonRequired');
      }
      return next;
    },
    [draft, t]
  );

  const nextStep = () => {
    const next = validStep(step);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast(t('dfInvalid'), { error: true });
      return;
    }
    setStep((s) => Math.min(2, s + 1));
  };

  const submit = async () => {
    const next = { ...validStep(0), ...validStep(1) };
    setErrors(next);
    if (Object.keys(next).length > 0 || busy) {
      if (Object.keys(next).length > 0) {
        toast(t('dfInvalid'), { error: true });
        setStep(Object.keys(validStep(0)).length > 0 ? 0 : 1);
      }
      return;
    }
    setBusy(true);
    const body = {
      buyerName: draft.buyerName.trim(),
      buyerPhone: draft.buyerPhone.trim(),
      buyerCompany: draft.buyerCompany.trim() || undefined,
      sellerName: draft.sellerName.trim(),
      sellerPhone: draft.sellerPhone.trim(),
      commodity: draft.commodity.trim(),
      variety: draft.variety.trim() || undefined,
      grade: draft.grade,
      quantityQuintals: draft.quantityQuintals,
      agreedRate: draft.agreedRate,
      brokerCommissionPct: draft.brokerCommissionPct,
      paymentTerms: draft.paymentTerms.trim(),
      deliveryLocation: draft.deliveryLocation.trim() || undefined,
      notes: draft.notes.trim() || undefined,
    };
    try {
      const saved = editing ? await updateDeal(dealId!, body) : await createDeal(body);
      const leadId = searchParams.get('leadId');
      if (!editing && leadId) {
        await updateLead(leadId, { status: 'converted' }).catch(() => undefined);
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      toast(editing ? t('dfUpdatedToast') : t('dfCreatedToast'));
      navigate(`/dashboard/p/broker/deals/${saved.id}`);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors) {
        setErrors(e.fieldErrors);
        toast(t('dfInvalid'), { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const steps = useMemo(
    () => [t('dfStep1'), t('dfStep2'), t('dfStep3')],
    [t]
  );

  return (
    <ToolShell toolId="deals" backTo="/dashboard/p/deals">
      <p className="av-progress-label">
        {t('dfStep', { n: step + 1 })} — {steps[step]}
      </p>
      <div className="av-progress-track" style={{ marginBottom: 16 }}>
        {steps.map((s, i) => (
          <span key={s} className={`av-progress-segment${i <= step ? ' filled' : ''}`} />
        ))}
      </div>

      {loadingDeal ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {!loadingDeal ? (
        <>
          {step === 0 ? (
            <>
              <LabeledTextField
                label={t('dfBuyerName')}
                value={draft.buyerName}
                onChange={(v) => patch({ buyerName: v })}
                error={errors.buyerName}
                required
              />
              <LabeledTextField
                label={t('dfBuyerPhone')}
                value={draft.buyerPhone}
                onChange={(v) => patch({ buyerPhone: v })}
                prefix="+91"
                inputMode="tel"
                error={errors.buyerPhone}
                required
              />
              <LabeledTextField
                label={t('dfBuyerCompany')}
                value={draft.buyerCompany}
                onChange={(v) => patch({ buyerCompany: v })}
              />
              <LabeledTextField
                label={t('dfSellerName')}
                value={draft.sellerName}
                onChange={(v) => patch({ sellerName: v })}
                error={errors.sellerName}
                required
              />
              <LabeledTextField
                label={t('dfSellerPhone')}
                value={draft.sellerPhone}
                onChange={(v) => patch({ sellerPhone: v })}
                prefix="+91"
                inputMode="tel"
                error={errors.sellerPhone}
                required
              />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="av-field">
                <label className="av-label" htmlFor="deal-commodity">
                  {t('dfCommodity')} *
                </label>
                <input
                  id="deal-commodity"
                  className={`av-input${errors.commodity ? ' invalid' : ''}`}
                  list="deal-crop-options"
                  value={draft.commodity}
                  onChange={(e) => patch({ commodity: e.target.value })}
                  placeholder={t('lotsCropPlaceholder')}
                />
                <datalist id="deal-crop-options">
                  {cropOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {errors.commodity ? <p className="av-field-error">{errors.commodity}</p> : null}
              </div>
              <LabeledTextField
                label={t('dfVariety')}
                value={draft.variety}
                onChange={(v) => patch({ variety: v })}
              />
              <div className="av-field">
                <label className="av-label" htmlFor="deal-grade">
                  {t('dfGrade')}
                </label>
                <select
                  id="deal-grade"
                  className="av-input"
                  value={draft.grade}
                  onChange={(e) => patch({ grade: e.target.value })}
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="av-field">
                <span className="av-label">
                  {t('dfQty')} *
                </span>
                <QuantityStepper
                  value={draft.quantityQuintals}
                  onChange={(v) => patch({ quantityQuintals: v })}
                  min={1}
                  step={1}
                  unit={t('unitQuintalShort')}
                />
                {errors.quantityQuintals ? (
                  <p className="av-field-error">{errors.quantityQuintals}</p>
                ) : null}
              </div>
              <LabeledTextField
                label={t('dfRate')}
                value={draft.agreedRate ? String(draft.agreedRate) : ''}
                onChange={(v) => patch({ agreedRate: Number(v) || 0 })}
                type="number"
                inputMode="numeric"
                prefix="₹"
                error={errors.agreedRate}
                required
              />
              {mandiModal !== null ? (
                <button
                  type="button"
                  className="av-chip"
                  onClick={() => patch({ agreedRate: mandiModal })}
                >
                  📈 {t('dfUseMandiRate', { rate: mandiModal })}
                </button>
              ) : null}
              <PriceWithBenchmark
                crop={draft.commodity}
                quantityQuintals={draft.quantityQuintals}
                price={draft.agreedRate}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <CommissionStepper
                value={draft.brokerCommissionPct}
                onChange={(v) => patch({ brokerCommissionPct: v })}
                quantityQuintals={draft.quantityQuintals}
                agreedRate={draft.agreedRate}
              />
              <LabeledTextField
                label={t('dfPaymentTerms')}
                value={draft.paymentTerms}
                onChange={(v) => patch({ paymentTerms: v })}
              />
              <LabeledTextField
                label={t('dfDeliveryLocation')}
                value={draft.deliveryLocation}
                onChange={(v) => patch({ deliveryLocation: v })}
              />
              <LabeledTextField
                label={t('dfNotes')}
                value={draft.notes}
                onChange={(v) => patch({ notes: v })}
                maxLength={500}
              />
            </>
          ) : null}

          <p className="trade-section-title">{t('dfMathTitle')}</p>
          <DealMathCard
            quantityQuintals={draft.quantityQuintals}
            agreedRate={draft.agreedRate}
            pct={draft.brokerCommissionPct}
          />

          {offline ? <p className="trade-hint">📴 {t('dfWillSendOffline')}</p> : null}

          <div className="trade-actions">
            {step > 0 ? (
              <button type="button" className="av-btn av-btn-ghost" onClick={() => setStep(step - 1)}>
                ← {t('dfBack')}
              </button>
            ) : null}
            {step < 2 ? (
              <button type="button" className="av-btn av-btn-primary" onClick={nextStep}>
                {t('dfNext')} →
              </button>
            ) : (
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => void submit()}
                disabled={busy || offline}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : editing ? t('dfUpdate') : t('dfSubmit')}
              </button>
            )}
          </div>
        </>
      ) : null}
    </ToolShell>
  );
}
