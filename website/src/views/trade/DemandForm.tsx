import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import PriceWithBenchmark from '../../components/trade/PriceWithBenchmark';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createDemand,
  getDemand,
  updateDemand,
  type DemandFrequency,
} from '../../lib/api/demands';
import { useT } from '../../lib/i18n';
import { useTradeStore } from '../../stores/trade';
import '../../theme/trade.css';

/**
 * Create / edit a demand (buyer "wanted order", spec V4). Draft-backed
 * (offline-tolerant, spec F4) with a live mandi benchmark beside the
 * max-price field.
 */

const GRADES = ['A', 'B', 'C'];
const FREQUENCIES: DemandFrequency[] = ['oneTime', 'weekly', 'monthly'];

export default function DemandForm() {
  const t = useT();
  const navigate = useNavigate();
  const { demandId } = useParams();
  const editing = Boolean(demandId);
  useEnsureProfile('seller');

  const demandDraft = useTradeStore((s) => s.demandDraft);
  const saveDemandDraft = useTradeStore((s) => s.saveDemandDraft);

  const [crop, setCrop] = useState(demandDraft?.crop ?? '');
  const [variety, setVariety] = useState(demandDraft?.variety ?? '');
  const [qty, setQty] = useState(demandDraft?.quantity ?? '');
  const [grade, setGrade] = useState<'A' | 'B' | 'C'>(demandDraft?.qualityGrade ?? 'A');
  const [maxPrice, setMaxPrice] = useState(demandDraft?.maxPrice ?? '');
  const [packaging, setPackaging] = useState(demandDraft?.packaging ?? '');
  const [deliveryLocation, setDeliveryLocation] = useState(demandDraft?.deliveryLocation ?? '');
  const [neededBy, setNeededBy] = useState(demandDraft?.neededBy ?? '');
  const [frequency, setFrequency] = useState<DemandFrequency>(demandDraft?.frequency ?? 'oneTime');
  const [notes, setNotes] = useState(demandDraft?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);

  // Edit mode: hydrate from the backend (draft wins for unsaved new demands only).
  useEffect(() => {
    if (!demandId) return;
    getDemand(demandId)
      .then((d) => {
        setCrop(d.crop);
        setVariety(d.variety ?? '');
        setQty(String(d.quantity));
        setGrade(d.qualityGrade);
        setMaxPrice(String(d.maxPrice));
        setPackaging(d.packaging ?? '');
        setDeliveryLocation(d.deliveryLocation ?? '');
        setNeededBy(d.neededBy ?? '');
        setFrequency(d.frequency);
        setNotes(d.notes ?? '');
      })
      .catch(() => toast(t('tradeLoadFailed'), { error: true }))
      .finally(() => setLoading(false));
  }, [demandId, t]);

  // Draft autosave (spec F4 — offline-tolerant drafts).
  useEffect(() => {
    if (editing) return;
    saveDemandDraft({
      crop,
      variety,
      quantity: qty,
      qualityGrade: grade,
      maxPrice,
      packaging,
      deliveryLocation,
      neededBy,
      frequency,
      notes,
    });
  }, [editing, crop, variety, qty, grade, maxPrice, packaging, deliveryLocation, neededBy, frequency, notes, saveDemandDraft]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!crop.trim()) next.crop = t('commonRequired');
    if (!(Number(qty) > 0)) next.quantity = t('commonRequired');
    if (maxPrice === '' || !(Number(maxPrice) >= 0)) next.maxPrice = t('commonRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    const payload = {
      crop: crop.trim(),
      variety: variety.trim() || undefined,
      quantity: Number(qty),
      unit: 'quintal',
      qualityGrade: grade,
      maxPrice: Math.round(Number(maxPrice)),
      packaging: packaging.trim() || undefined,
      deliveryLocation: deliveryLocation.trim() || undefined,
      neededBy: neededBy || undefined,
      frequency,
      notes: notes.trim() || undefined,
    };
    try {
      if (demandId) {
        await updateDemand(demandId, payload);
        toast(t('demandsUpdate'));
      } else {
        await createDemand(payload);
        saveDemandDraft(null);
        toast(t('demandsSubmit'));
      }
      navigate('/dashboard/p/demands');
    } catch (e) {
      if (isApiError(e) && e.fieldErrors) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <ToolShell toolId="demands" backTo="/dashboard/p/demands">
        <p className="trade-hint">{t('commonLoading')}</p>
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="demands" backTo="/dashboard/p/demands">
      <LabeledTextField
        label={t('demandsFor')}
        value={crop}
        onChange={setCrop}
        placeholder={t('lotsCropPlaceholder')}
        required
        error={errors.crop}
      />
      <LabeledTextField
        label={t('demandsVariety')}
        value={variety}
        onChange={setVariety}
      />
      <LabeledTextField
        label={t('commonQuantity')}
        value={qty}
        onChange={setQty}
        type="number"
        inputMode="decimal"
        required
        error={errors.quantity}
      />
      <LabeledTextField
        label={t('demandsMaxPrice')}
        value={maxPrice}
        onChange={setMaxPrice}
        type="number"
        inputMode="numeric"
        prefix="₹"
        required
        error={errors.maxPrice}
      />
      <PriceWithBenchmark crop={crop.trim()} quantityQuintals={Number(qty) || 0} price={Number(maxPrice) || 0} />
      <div className="av-field">
        <span className="av-label">{t('demandsGrade')}</span>
        <ChipSelect
          options={GRADES}
          selected={[grade]}
          single
          onToggle={(option) => setGrade(option as 'A' | 'B' | 'C')}
        />
      </div>
      <LabeledTextField
        label={t('demandsNeededBy')}
        value={neededBy}
        onChange={setNeededBy}
        type="date"
      />
      <div className="av-field">
        <span className="av-label">{t('demandsFrequency')}</span>
        <div className="av-chip-row">
          {FREQUENCIES.map((f) => (
            <button
              key={f}
              type="button"
              className={`av-chip${frequency === f ? ' selected' : ''}`}
              onClick={() => setFrequency(f)}
            >
              {t(`freq_${f}`)}
            </button>
          ))}
        </div>
      </div>
      <LabeledTextField
        label={t('demandsLocation')}
        value={deliveryLocation}
        onChange={setDeliveryLocation}
      />
      <LabeledTextField
        label={t('demandsPackaging')}
        value={packaging}
        onChange={setPackaging}
      />
      <LabeledTextField
        label={t('commonNotes')}
        value={notes}
        onChange={setNotes}
        maxLength={300}
      />

      <div className="trade-actions">
        <button type="button" className="av-btn av-btn-primary" onClick={() => void submit()} disabled={busy}>
          {busy ? <span className="av-spinner" aria-hidden /> : editing ? t('demandsUpdate') : t('demandsSubmit')}
        </button>
        <button type="button" className="av-btn av-btn-ghost" onClick={() => navigate('/dashboard/p/demands')} disabled={busy}>
          {t('commonCancel')}
        </button>
      </div>
      {!editing ? <p className="trade-hint">{t('lotsDraftSaved')}</p> : null}
    </ToolShell>
  );
}
