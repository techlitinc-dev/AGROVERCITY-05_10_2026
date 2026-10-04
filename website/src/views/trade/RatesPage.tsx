import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { myRates, postRate, type PendingRate } from '../../lib/api/seller';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDate = (iso?: string): string =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

/**
 * Post rates — the vyapari's own mandi rate board (spec V-suite). Inline
 * form (crop / ₹-per-kg rate / mandi) with an out-of-band guard around the
 * mandi modal, plus the seller's pending-rate list.
 */
export default function RatesPage() {
  const t = useT();
  useEnsureProfile('seller');

  const [rates, setRates] = useState<PendingRate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [crop, setCrop] = useState('');
  const [ratePerKg, setRatePerKg] = useState('');
  const [mandiName, setMandiName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [aiBandWarning, setAiBandWarning] = useState<{
    message: string;
    band?: string;
    minAllowed?: number;
    maxAllowed?: number;
  } | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    myRates()
      .then((res) => setRates(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!crop.trim()) next.crop = t('commonRequired');
    if (!(Number(ratePerKg) > 0)) next.ratePerKg = t('commonRequired');
    if (!mandiName.trim()) next.mandiName = t('commonRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    setAiBandWarning(null);
    try {
      await postRate({
        crop: crop.trim(),
        ratePerKg: Math.round(Number(ratePerKg) * 100) / 100,
        mandiName: mandiName.trim(),
      });
      toast(t('ratesPosted'));
      setCrop('');
      setRatePerKg('');
      setMandiName('');
      setErrors({});
      setAiBandWarning(null);
      load();
    } catch (e) {
      if (isApiError(e)) {
        if (e.code === 'RATE_OUT_OF_BAND') {
          // render the server's AI-enriched band inline in the form
          const msg = e.fieldErrors?.ratePerKg ?? t('ratesOutOfBand');
          setErrors((prev) => ({
            ...prev,
            ratePerKg: msg,
          }));
          setAiBandWarning({
            message: msg,
            band: typeof e.fieldErrors?.band === 'string' ? e.fieldErrors.band : undefined,
            minAllowed: e.fieldErrors?.minAllowed ? Number(e.fieldErrors.minAllowed) : undefined,
            maxAllowed: e.fieldErrors?.maxAllowed ? Number(e.fieldErrors.maxAllowed) : undefined,
          });
        } else if (e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
          setErrors(e.fieldErrors);
        } else {
          toast(t('actionFailed'), { error: true });
        }
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="rates">
      <p className="trade-section-title">{t('tool_rates_sub')}</p>
      <LabeledTextField
        label={t('ratesCropLabel')}
        value={crop}
        onChange={(v) => {
          setCrop(v);
          setAiBandWarning(null);
        }}
        placeholder={t('lotsCropPlaceholder')}
        required
        error={errors.crop}
      />
      <LabeledTextField
        label={t('ratesRateLabel')}
        value={ratePerKg}
        onChange={(v) => {
          setRatePerKg(v);
          setAiBandWarning(null);
        }}
        type="number"
        inputMode="decimal"
        prefix="₹"
        required
        error={errors.ratePerKg}
      />
      {aiBandWarning ? (
        <div
          className="trade-band-warning"
          style={{
            margin: '8px 0 12px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'var(--av-err-bg, #fde8e8)',
            color: 'var(--av-err, #9b1c1c)',
            border: '1px solid var(--av-err-border, #f8b4b4)',
            fontSize: '0.875rem',
            lineHeight: '1.4',
          }}
        >
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚠️</span>
            <span>{t('ratesAiBandWarningTitle')}</span>
          </div>
          <div style={{ marginTop: 4 }}>{aiBandWarning.message}</div>
          {aiBandWarning.band ? (
            <div style={{ marginTop: 2, fontSize: '0.8rem', opacity: 0.9 }}>
              {t('ratesAiBandRange', { band: aiBandWarning.band })}
            </div>
          ) : null}
          {aiBandWarning.minAllowed !== undefined && aiBandWarning.maxAllowed !== undefined ? (
            <div style={{ marginTop: 2, fontSize: '0.8rem', fontWeight: 500 }}>
              {t('ratesAiBandAllowed', {
                min: String(aiBandWarning.minAllowed),
                max: String(aiBandWarning.maxAllowed),
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      <LabeledTextField
        label={t('ratesMandiLabel')}
        value={mandiName}
        onChange={(v) => {
          setMandiName(v);
          setAiBandWarning(null);
        }}
        required
        error={errors.mandiName}
      />
      <div className="trade-actions">
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => void submit()}
          disabled={busy}
        >
          {busy ? <span className="av-spinner" aria-hidden /> : t('ratesSubmit')}
        </button>
      </div>

      {rates === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {rates !== null && rates.length === 0 ? (
        <EmptyState icon="🏷️" titleKey="ratesEmpty" />
      ) : null}

      <div className="trade-list">
        {rates?.map((rate, i) => (
          <div key={`${rate.crop}-${rate.mandiName}-${i}`} className="trade-card">
            <div className="trade-card-row">
              <span className="trade-card-title">{rate.crop}</span>
              <StatusPill status={rate.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {rate.mandiName}
                {rate.createdAt ? ` · ${fmtDate(rate.createdAt)}` : ''}
              </span>
              <span className="trade-card-amount">
                {inr(rate.ratePerKg)}/{t('unitKg')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
