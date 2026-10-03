import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import ConfirmSheet from '../../components/trade/ConfirmSheet';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createProcurement,
  listProcurement,
  payProcurement,
  type ProcurementLot,
  type ProcurementStats,
} from '../../lib/api/seller';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Procurement — J-form weighbridge lots bought from farmers (spec V-suite).
 * Stats header, J-form cards with net weight / rate / payout and a
 * mark-paid confirmation, plus a create sheet with a live payout preview.
 */
export default function ProcurementPage() {
  const t = useT();
  useEnsureProfile('seller');

  const [lots, setLots] = useState<ProcurementLot[] | null>(null);
  const [stats, setStats] = useState<ProcurementStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [paying, setPaying] = useState<ProcurementLot | null>(null);
  const [farmerName, setFarmerName] = useState('');
  const [farmerPhone, setFarmerPhone] = useState('');
  const [crop, setCrop] = useState('');
  const [variety, setVariety] = useState('');
  const [grossWeightKg, setGrossWeightKg] = useState('');
  const [tareWeightKg, setTareWeightKg] = useState('');
  const [netWeightQuintals, setNetWeightQuintals] = useState('');
  const [ratePerQuintal, setRatePerQuintal] = useState('');
  const [qualityDeductionPct, setQualityDeductionPct] = useState('0');
  const [weighbridgeSlipNo, setWeighbridgeSlipNo] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listProcurement()
      .then((res) => {
        setLots(res.data);
        setStats(res.stats);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const grossKg = Number(grossWeightKg) || 0;
  const tareKg = Number(tareWeightKg) || 0;
  const derivedNetQ = Math.round(Math.max(0, grossKg - tareKg) * 100) / 100 / 100;
  const netQ = netWeightQuintals === '' ? derivedNetQ : Number(netWeightQuintals) || 0;
  const rate = Number(ratePerQuintal) || 0;
  const deductPct = Math.min(50, Math.max(0, Number(qualityDeductionPct) || 0));
  const grossValue = Math.round(netQ * rate * 100) / 100;
  const deductAmount = Math.round(grossValue * (deductPct / 100) * 100) / 100;
  const finalAmount = Math.round((grossValue - deductAmount) * 100) / 100;

  const resetForm = () => {
    setFarmerName('');
    setFarmerPhone('');
    setCrop('');
    setVariety('');
    setGrossWeightKg('');
    setTareWeightKg('');
    setNetWeightQuintals('');
    setRatePerQuintal('');
    setQualityDeductionPct('0');
    setWeighbridgeSlipNo('');
    setNotes('');
    setErrors({});
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!farmerName.trim()) next.farmerName = t('commonRequired');
    if (!crop.trim()) next.crop = t('commonRequired');
    if (!(grossKg > 0)) next.grossWeightKg = t('commonRequired');
    if (tareKg < 0 || tareKg >= grossKg) next.tareWeightKg = t('commonRequired');
    if (!(netQ > 0)) next.netWeightQuintals = t('commonRequired');
    if (!(rate > 0)) next.ratePerQuintal = t('commonRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      await createProcurement({
        farmerName: farmerName.trim(),
        farmerPhone: farmerPhone.trim() || undefined,
        crop: crop.trim(),
        variety: variety.trim() || undefined,
        grossWeightKg: Math.round(grossKg * 100) / 100,
        tareWeightKg: Math.round(tareKg * 100) / 100,
        netWeightQuintals: Math.round(netQ * 100) / 100,
        ratePerQuintal: Math.round(rate * 100) / 100,
        qualityDeductionPct: deductPct,
        weighbridgeSlipNo: weighbridgeSlipNo.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast(t('procAdded'));
      setFormOpen(false);
      resetForm();
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

  const confirmPay = async () => {
    if (!paying) return;
    setBusy(true);
    try {
      await payProcurement(paying.id);
      toast(t('procPayDone'));
      setPaying(null);
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="procurement">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button type="button" className="av-btn av-btn-primary" onClick={() => setFormOpen(true)}>
          ＋ {t('procNew')}
        </button>
      </div>

      {stats ? (
        <div className="trade-stats-grid">
          <div className="trade-stat">
            <div className="trade-stat-label">{t('procStatsQuintals')}</div>
            <div className="trade-stat-value">{stats.totalProcuredQuintals}</div>
          </div>
          <div className="trade-stat">
            <div className="trade-stat-label">{t('procStatsPayout')}</div>
            <div className="trade-stat-value">{inr(stats.totalPayoutAmount)}</div>
          </div>
          <div className="trade-stat">
            <div className="trade-stat-label">{t('procStatsPending')}</div>
            <div className="trade-stat-value">{inr(stats.pendingPayouts)}</div>
          </div>
          <div className="trade-stat">
            <div className="trade-stat-label">{t('procStatsLots')}</div>
            <div className="trade-stat-value">{stats.totalLots}</div>
          </div>
        </div>
      ) : null}

      {lots === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {lots !== null && lots.length === 0 ? (
        <EmptyState
          icon="🚜"
          titleKey="procEmpty"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => setFormOpen(true)}
            >
              ＋ {t('procNew')}
            </button>
          }
        />
      ) : null}

      <div className="trade-list">
        {lots?.map((lot) => (
          <div key={lot.id} className="trade-card">
            <div className="trade-card-row">
              <span className="trade-card-title">
                {t('procJform')} {lot.jFormNumber}
              </span>
              <StatusPill status={lot.paymentStatus} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {fmtDate(lot.createdAt)} · {lot.farmerName} · {lot.crop}
                {lot.variety ? ` (${lot.variety})` : ''}
              </span>
              <span className="trade-card-amount">{inr(lot.finalAmount)}</span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('procNetWeight')}: {lot.netWeightQuintals} {t('unitQuintal')} ·{' '}
                {inr(lot.ratePerQuintal)}
                {t('perQuintal')}
              </span>
            </div>
            {lot.paymentStatus !== 'paid' ? (
              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => setPaying(lot)}
                >
                  {t('procPay')}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <ModalSheet open={formOpen} onClose={() => setFormOpen(false)} title={t('procNew')}>
        <LabeledTextField
          label={t('procFarmer')}
          value={farmerName}
          onChange={setFarmerName}
          required
          error={errors.farmerName}
        />
        <LabeledTextField
          label={t('procFarmerPhone')}
          value={farmerPhone}
          onChange={setFarmerPhone}
          type="tel"
          inputMode="tel"
          maxLength={10}
        />
        <LabeledTextField
          label={t('procCrop')}
          value={crop}
          onChange={setCrop}
          required
          error={errors.crop}
        />
        <LabeledTextField
          label={t('procVariety')}
          value={variety}
          onChange={setVariety}
        />
        <LabeledTextField
          label={t('procGross')}
          value={grossWeightKg}
          onChange={(v) => {
            setGrossWeightKg(v);
            setNetWeightQuintals('');
          }}
          type="number"
          inputMode="decimal"
          required
          error={errors.grossWeightKg}
        />
        <LabeledTextField
          label={t('procTare')}
          value={tareWeightKg}
          onChange={(v) => {
            setTareWeightKg(v);
            setNetWeightQuintals('');
          }}
          type="number"
          inputMode="decimal"
          error={errors.tareWeightKg}
        />
        <LabeledTextField
          label={t('procNet')}
          value={netWeightQuintals === '' ? String(derivedNetQ) : netWeightQuintals}
          onChange={setNetWeightQuintals}
          type="number"
          inputMode="decimal"
          required
          error={errors.netWeightQuintals}
        />
        <LabeledTextField
          label={t('procRate')}
          value={ratePerQuintal}
          onChange={setRatePerQuintal}
          type="number"
          inputMode="decimal"
          prefix="₹"
          required
          error={errors.ratePerQuintal}
        />
        <LabeledTextField
          label={t('procDeduction')}
          value={qualityDeductionPct}
          onChange={setQualityDeductionPct}
          type="number"
          inputMode="decimal"
        />
        <LabeledTextField
          label={t('procSlip')}
          value={weighbridgeSlipNo}
          onChange={setWeighbridgeSlipNo}
        />
        <LabeledTextField label={t('procNotes')} value={notes} onChange={setNotes} />

        <div className="trade-invoice-box">
          <div className="trade-invoice-row">
            <span>{t('commonTotal')}</span>
            <span>{inr(grossValue)}</span>
          </div>
          <div className="trade-invoice-row">
            <span>{t('procDeduction')}</span>
            <span>−{inr(deductAmount)}</span>
          </div>
          <div className="trade-invoice-row trade-invoice-total">
            <span>{t('procFinal')}</span>
            <span>{inr(finalAmount)}</span>
          </div>
        </div>

        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('procSubmit')}
          </button>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={() => setFormOpen(false)}
            disabled={busy}
          >
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>

      <ConfirmSheet
        open={paying !== null}
        title={t('procPay')}
        body={
          paying
            ? `${paying.jFormNumber} · ${paying.farmerName} · ${inr(paying.finalAmount)}`
            : undefined
        }
        confirmLabel={t('procPay')}
        onConfirm={() => void confirmPay()}
        onClose={() => setPaying(null)}
        busy={busy}
      />
    </ToolShell>
  );
}
