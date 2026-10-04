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
      load();
    } catch (e) {
      if (isApiError(e)) {
        if (e.code === 'RATE_OUT_OF_BAND') {
          // render the server's band (modal ±25%) inline in the form
          setErrors((prev) => ({
            ...prev,
            ratePerKg: e.fieldErrors?.ratePerKg ?? t('ratesOutOfBand'),
          }));
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
        onChange={setCrop}
        placeholder={t('lotsCropPlaceholder')}
        required
        error={errors.crop}
      />
      <LabeledTextField
        label={t('ratesRateLabel')}
        value={ratePerKg}
        onChange={setRatePerKg}
        type="number"
        inputMode="decimal"
        prefix="₹"
        required
        error={errors.ratePerKg}
      />
      <LabeledTextField
        label={t('ratesMandiLabel')}
        value={mandiName}
        onChange={setMandiName}
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
