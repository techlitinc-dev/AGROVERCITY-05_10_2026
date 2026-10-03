import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createAdoption,
  fmtINR,
  getMyGaushala,
  listGaushalaAdoptions,
  updateAdoptionStatus,
  type AdoptionBillingCycle,
  type AdoptionStatus,
  type AdoptionTier,
  type CowAdoption,
  type GaushalaReceipt,
} from '../../lib/api/gaushala';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.gaushala';
import '../../lib/i18n/locales/hi.gaushala';
import '../../theme/gaushala.css';

const STATUS_FILTERS: { value: AdoptionStatus | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'commonAll' },
  { value: 'active', labelKey: 'gaushala_status_active' },
  { value: 'approved', labelKey: 'gaushala_status_approved' },
  { value: 'completed', labelKey: 'gaushala_status_completed' },
  { value: 'rejected', labelKey: 'gaushala_status_rejected' },
];

const STATUS_COLORS: Record<string, string> = {
  active: '#D97706',
  approved: '#2563EB',
  completed: '#16A34A',
  rejected: '#DC2626',
};

const TIERS: AdoptionTier[] = ['gau_gras', 'gau_seva', 'purna_dattak', 'lifetime'];
const BILLING: AdoptionBillingCycle[] = ['monthly', 'annual', 'one_time'];

const fmtDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Adoptions queue (P8) — status filter, record offline adoption, approve/reject/complete with 80G receipt sheet. */
export default function AdoptionsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const [gaushalaId, setGaushalaId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [adoptions, setAdoptions] = useState<CowAdoption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<AdoptionStatus | 'all'>('all');

  const [recordOpen, setRecordOpen] = useState(false);
  const [receipt, setReceipt] = useState<GaushalaReceipt | null>(null);
  const [busy, setBusy] = useState(false);

  const [cowTagId, setCowTagId] = useState('');
  const [cowName, setCowName] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [donorCity, setDonorCity] = useState('');
  const [tier, setTier] = useState<AdoptionTier>('gau_gras');
  const [amount, setAmount] = useState('');
  const [billingCycle, setBillingCycle] = useState<AdoptionBillingCycle>('monthly');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setFailed(false);
    getMyGaushala()
      .then((p) => {
        setGaushalaId(p.id);
        return listGaushalaAdoptions(p.id);
      })
      .then((rows) => setAdoptions(rows))
      .catch((e) => {
        if (isApiError(e) && e.status === 404) setNeedsSetup(true);
        else setFailed(true);
      });
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(
    () => (adoptions ?? []).filter((a) => status === 'all' || a.status === status),
    [adoptions, status]
  );

  const openRecord = () => {
    setCowTagId('');
    setCowName('');
    setDonorName('');
    setDonorPhone('');
    setDonorCity('');
    setTier('gau_gras');
    setAmount('');
    setBillingCycle('monthly');
    setErrors({});
    setRecordOpen(true);
  };

  const submitRecord = async () => {
    if (busy || !gaushalaId) return;
    const nextErrors: Record<string, string> = {};
    if (!cowTagId.trim()) nextErrors.cowTagId = t('commonRequired');
    if (!cowName.trim()) nextErrors.cowName = t('commonRequired');
    if (!donorName.trim()) nextErrors.donorName = t('commonRequired');
    if (!donorPhone.trim()) nextErrors.donorPhone = t('commonRequired');
    if (amount.trim() === '' || Number.isNaN(Number(amount))) nextErrors.amountInr = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await createAdoption({
        gaushalaId,
        cowTagId: cowTagId.trim(),
        cowName: cowName.trim(),
        donorName: donorName.trim(),
        donorPhone: donorPhone.trim(),
        donorCity: donorCity.trim(),
        tier,
        amountInr: Math.floor(Number(amount)) || 0,
        billingCycle,
      });
      toast(t('gaushalaAdoptCreated'));
      setRecordOpen(false);
      load();
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const act = async (adoption: CowAdoption, next: 'approved' | 'rejected' | 'completed') => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await updateAdoptionStatus(adoption.id, next);
      toast(
        t(
          next === 'approved'
            ? 'gaushalaAdoptApproved'
            : next === 'completed'
              ? 'gaushalaAdoptCompleted'
              : 'gaushalaAdoptRejected'
        )
      );
      if (next === 'approved' && res.receipt) setReceipt(res.receipt);
      load();
    } catch (e) {
      if (isApiError(e) && e.status === 409) {
        toast(t('gaushalaAdoptTransitionFailed'), { error: true });
        load();
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const setupPrompt = (
    <div className="gaushala-empty">
      <span className="gaushala-empty-icon" aria-hidden>
        🛕
      </span>
      <p className="gaushala-empty-title">{t('gaushalaCattleSetupFirst')}</p>
      <p className="gaushala-empty-body">{t('gaushalaCattleSetupBody')}</p>
      <div className="gaushala-empty-action">
        <button type="button" className="av-btn av-btn-primary" onClick={() => navigate('/gaushala/console')}>
          {t('gaushalaCattleSetupCta')}
        </button>
      </div>
    </div>
  );

  return (
    <ToolShell toolId="gaushalaConsole" backTo="/gaushala/console">
      <div className="gaushala-wrap">
        {needsSetup ? (
          setupPrompt
        ) : (
          <>
            <div className="gaushala-actions" style={{ marginTop: 4 }}>
              <button type="button" className="av-btn av-btn-primary" onClick={openRecord}>
                ＋ {t('gaushalaAdoptRecord')}
              </button>
            </div>

            <div className="gaushala-chip-row">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`av-chip${status === f.value ? ' selected' : ''}`}
                  onClick={() => setStatus(f.value)}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>

            {adoptions === null && !failed ? <p className="gaushala-hint">{t('commonLoading')}</p> : null}

            {failed ? (
              <div className="gaushala-empty">
                <span className="gaushala-empty-icon" aria-hidden>
                  📡
                </span>
                <p className="gaushala-empty-title">{t('gaushalaLoadFailed')}</p>
                <div className="gaushala-empty-action">
                  <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                    ↻ {t('retry')}
                  </button>
                </div>
              </div>
            ) : null}

            {adoptions !== null && visible.length === 0 ? (
              <div className="gaushala-empty">
                <span className="gaushala-empty-icon" aria-hidden>
                  🤝
                </span>
                <p className="gaushala-empty-title">{t('gaushalaAdoptEmpty')}</p>
                <p className="gaushala-empty-body">{t('gaushalaAdoptEmptyBody')}</p>
              </div>
            ) : null}

            <div className="gaushala-list">
              {visible.map((a) => {
                const color = STATUS_COLORS[a.status] ?? '#64748B';
                const tierLabel =
                  t(`gaushalaTier_${a.tier}`) !== `gaushalaTier_${a.tier}` ? t(`gaushalaTier_${a.tier}`) : a.tier;
                const billingLabel =
                  t(`gaushalaBilling_${a.billingCycle}`) !== `gaushalaBilling_${a.billingCycle}`
                    ? t(`gaushalaBilling_${a.billingCycle}`)
                    : a.billingCycle;
                return (
                  <div key={a.id} className="gaushala-card">
                    <div className="gaushala-card-row">
                      <span className="gaushala-card-title">
                        {a.cowName} <span className="gaushala-card-sub">· {a.cowTagId}</span>
                      </span>
                      <span className="gaushala-card-amount">{fmtINR(a.amountInr)}</span>
                    </div>
                    <div className="gaushala-card-row">
                      <span className="gaushala-card-sub">
                        {t('gaushalaAdoptDonor')}: {a.donorName}
                        {a.donorPhone ? ` · ${a.donorPhone}` : ''}
                        {a.donorCity ? ` · ${a.donorCity}` : ''}
                      </span>
                    </div>
                    <div className="gaushala-card-row">
                      <span className="gaushala-pill gaushala-pill-ok">{tierLabel}</span>
                      <span className="gaushala-card-sub">{billingLabel}</span>
                      <span
                        className="gaushala-pill"
                        style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
                      >
                        {t(`gaushala_status_${a.status}`) !== `gaushala_status_${a.status}`
                          ? t(`gaushala_status_${a.status}`)
                          : a.status}
                      </span>
                    </div>
                    <span className="gaushala-card-sub">
                      {fmtDate(a.createdAt)}
                      {a.certificateNumber ? ` · ${a.certificateNumber}` : ''}
                    </span>
                    {a.status === 'active' || a.status === 'approved' ? (
                      <div className="gaushala-actions-row">
                        {a.status === 'active' ? (
                          <button
                            type="button"
                            className="av-btn av-btn-primary"
                            onClick={() => void act(a, 'approved')}
                            disabled={busy}
                          >
                            ✔ {t('gaushalaAdoptApprove')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="av-btn av-btn-primary"
                            onClick={() => void act(a, 'completed')}
                            disabled={busy}
                          >
                            ✔ {t('gaushalaAdoptComplete')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="av-btn av-btn-plain"
                          style={{ background: 'var(--av-error)' }}
                          onClick={() => void act(a, 'rejected')}
                          disabled={busy}
                        >
                          ✕ {t('gaushalaAdoptReject')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ModalSheet open={recordOpen} onClose={() => !busy && setRecordOpen(false)} title={t('gaushalaAdoptRecord')}>
        <div className="gaushala-form">
          <LabeledTextField
            label={t('gaushalaFieldCowTag')}
            value={cowTagId}
            onChange={setCowTagId}
            error={errors.cowTagId}
            required
          />
          <LabeledTextField
            label={t('gaushalaFieldCowName')}
            value={cowName}
            onChange={setCowName}
            error={errors.cowName}
            required
          />
          <LabeledTextField
            label={t('gaushalaFieldDonorName')}
            value={donorName}
            onChange={setDonorName}
            error={errors.donorName}
            required
          />
          <LabeledTextField
            label={t('gaushalaFieldDonorPhone')}
            value={donorPhone}
            onChange={setDonorPhone}
            type="tel"
            inputMode="tel"
            error={errors.donorPhone}
            required
          />
          <LabeledTextField
            label={t('gaushalaFieldDonorCity')}
            value={donorCity}
            onChange={setDonorCity}
            error={errors.donorCity}
          />
          <div className="av-field">
            <label className="av-label">{t('gaushalaFieldTier')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              {TIERS.map((tr) => (
                <button
                  key={tr}
                  type="button"
                  className={`av-chip${tier === tr ? ' selected' : ''}`}
                  onClick={() => setTier(tr)}
                >
                  {t(`gaushalaTier_${tr}`)}
                </button>
              ))}
            </div>
          </div>
          <LabeledTextField
            label={t('gaushalaFieldAmount')}
            value={amount}
            onChange={setAmount}
            type="number"
            inputMode="numeric"
            error={errors.amountInr}
            required
          />
          <div className="av-field">
            <label className="av-label">{t('gaushalaFieldBilling')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              {BILLING.map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`av-chip${billingCycle === b ? ' selected' : ''}`}
                  onClick={() => setBillingCycle(b)}
                >
                  {t(`gaushalaBilling_${b}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="gaushala-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitRecord()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setRecordOpen(false)} disabled={busy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>

      <ModalSheet open={receipt !== null} onClose={() => setReceipt(null)} title={t('gaushalaReceiptTitle')}>
        {receipt ? (
          <div className="gaushala-receipt">
            <span className="gaushala-receipt-badge">{t('gaushalaReceipt80g')}</span>
            <div>
              <div className="gaushala-detail-cell-label">{t('gaushalaReceiptCert')}</div>
              <div className="gaushala-receipt-cert">{receipt.certificateNumber}</div>
            </div>
            <div className="gaushala-receipt-row">
              <span>{t('gaushalaReceiptPerson')}</span>
              <span>{receipt.personName}</span>
            </div>
            <div className="gaushala-receipt-row">
              <span>{t('gaushalaReceiptAmount')}</span>
              <span>{fmtINR(receipt.amount)}</span>
            </div>
            <div className="gaushala-receipt-row">
              <span>{t('gaushalaReceiptIssued')}</span>
              <span>{fmtDate(receipt.issuedAt)}</span>
            </div>
            <div className="gaushala-actions">
              <button type="button" className="av-btn av-btn-primary" onClick={() => setReceipt(null)}>
                {t('gaushalaReceiptClose')}
              </button>
            </div>
          </div>
        ) : null}
      </ModalSheet>
    </ToolShell>
  );
}
