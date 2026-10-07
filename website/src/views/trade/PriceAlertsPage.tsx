import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createPriceAlert,
  deletePriceAlert,
  listPriceAlerts,
  type PriceAlert,
} from '../../lib/api/priceAlerts';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Price-alert management (mandi module) — list / create / delete the farmer's
 * alerts against backend/app/routers/price_alerts.py.
 *
 * Unit note: the backend compares `targetPrice` with the mandi modal price
 * (₹ per quintal), so the field collects whole rupees — an integer, never a
 * float. No invented numbers anywhere: an empty list renders an honest empty
 * state and a missing modal renders the standard "not available" dash.
 */
export default function PriceAlertsPage() {
  const t = useT();

  const [alerts, setAlerts] = useState<PriceAlert[] | null>(null);
  const [failed, setFailed] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [crop, setCrop] = useState('');
  const [target, setTarget] = useState('');
  const [above, setAbove] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<PriceAlert | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listPriceAlerts()
      .then((res) => setAlerts(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setCrop('');
    setTarget('');
    setAbove(true);
    setErrors({});
  };

  const submitCreate = async () => {
    const next: Record<string, string> = {};
    if (!crop.trim()) next.crop = t('commonRequired');
    const value = Number(target);
    if (!Number.isInteger(value) || value <= 0) next.targetPrice = t('counterPriceInvalid');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      const created = await createPriceAlert({ crop: crop.trim(), targetPrice: value, above });
      setAlerts((prev) => [created, ...(prev ?? [])]);
      toast(t('priceAlertsCreated'));
      setCreateOpen(false);
      resetForm();
    } catch (e) {
      if (isApiError(e) && e.fieldErrors) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deletePriceAlert(pendingDelete.id);
      setAlerts((prev) => (prev ?? []).filter((a) => a.id !== pendingDelete.id));
      toast(t('priceAlertsDeleted'));
      setPendingDelete(null);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ToolShell toolId="mandi">
      <p className="trade-section-title">{t('priceAlertsTitle')}</p>

      {alerts === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {alerts !== null && alerts.length === 0 ? (
        <EmptyState
          icon="🔔"
          titleKey="priceAlertsEmpty"
          action={
            <button type="button" className="av-btn av-btn-primary" onClick={() => setCreateOpen(true)}>
              ＋ {t('priceAlertsCreate')}
            </button>
          }
        />
      ) : null}

      {alerts !== null && alerts.length > 0 ? (
        <>
          <div className="trade-list">
            {alerts.map((a) => (
              <div key={a.id} className="trade-card" style={{ cursor: 'default' }}>
                <div className="trade-card-row">
                  <span className="trade-card-title">{a.crop}</span>
                  <span className="trade-card-amount">
                    {inr(a.targetPrice)}
                    {t('perQuintal')}
                  </span>
                </div>
                <div className="trade-card-row">
                  <span className="trade-card-sub">
                    {t('priceAlertsDirection')}: {a.above ? t('priceAlertsAbove') : t('priceAlertsBelow')}
                  </span>
                  <span className="trade-card-sub">
                    {t('mandiModal')}:{' '}
                    {a.currentModal !== null ? inr(a.currentModal) : t('commonNotAvailable')}
                  </span>
                </div>
                <div className="trade-card-row">
                  <span className="trade-card-sub">
                    {a.fired ? t('priceAlertsTargetReached') : t('commonNotAvailable')}
                  </span>
                  <button
                    type="button"
                    className="av-btn av-btn-ghost"
                    onClick={() => setPendingDelete(a)}
                  >
                    {t('priceAlertsDelete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="trade-actions" style={{ marginTop: 8 }}>
            <button type="button" className="av-btn av-btn-primary" onClick={() => setCreateOpen(true)}>
              ＋ {t('priceAlertsCreate')}
            </button>
          </div>
        </>
      ) : null}

      <ModalSheet
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetForm();
        }}
        title={t('priceAlertsCreate')}
      >
        <LabeledTextField
          label={t('lotsCropLabel')}
          value={crop}
          onChange={setCrop}
          placeholder={t('lotsCropPlaceholder')}
          error={errors.crop}
        />
        <LabeledTextField
          label={t('priceAlertsTargetPrice')}
          value={target}
          onChange={setTarget}
          type="number"
          inputMode="numeric"
          error={errors.targetPrice}
        />
        <div className="av-field">
          <label className="av-label" htmlFor="price-alert-direction">
            {t('priceAlertsDirection')}
          </label>
          <select
            id="price-alert-direction"
            className="av-input"
            value={above ? 'above' : 'below'}
            onChange={(e) => setAbove(e.target.value === 'above')}
          >
            <option value="above">{t('priceAlertsAbove')}</option>
            <option value="below">{t('priceAlertsBelow')}</option>
          </select>
        </div>
        <div className="trade-actions-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={() => {
              setCreateOpen(false);
              resetForm();
            }}
          >
            {t('commonCancel')}
          </button>
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void submitCreate()}
            disabled={saving}
          >
            {saving ? <span className="av-spinner" aria-hidden /> : t('priceAlertsCreate')}
          </button>
        </div>
      </ModalSheet>

      <ModalSheet
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t('priceAlertsDelete')}
      >
        <p className="trade-hint">
          {pendingDelete ? `${pendingDelete.crop} · ${inr(pendingDelete.targetPrice)}${t('perQuintal')}` : ''}
        </p>
        <div className="trade-actions-row">
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setPendingDelete(null)}>
            {t('commonCancel')}
          </button>
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void confirmDelete()}
            disabled={deleting}
          >
            {deleting ? <span className="av-spinner" aria-hidden /> : t('commonDelete')}
          </button>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
