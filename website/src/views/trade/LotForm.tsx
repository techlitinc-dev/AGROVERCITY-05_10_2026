import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import PriceWithBenchmark from '../../components/trade/PriceWithBenchmark';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { createLot, getLot, updateLot, type LotLocation } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import { ensureProfile } from '../../stores/dashboard';
import { useSessionStore } from '../../stores/session';
import { useTradeStore } from '../../stores/trade';
import '../../theme/trade.css';

/**
 * Create / edit a produce lot — quick and low-bandwidth: crop, quantity,
 * rate (with a live mandi benchmark), harvest date and pickup location.
 * Draft-backed (offline-tolerant). Photos are not part of the flow.
 */
export default function LotForm() {
  const t = useT();
  const navigate = useNavigate();
  const { lotId } = useParams();
  const editing = Boolean(lotId);
  useEnsureProfile('farmer');

  const user = useSessionStore((s) => s.user);
  const lotDraft = useTradeStore((s) => s.lotDraft);
  const saveLotDraft = useTradeStore((s) => s.saveLotDraft);

  const [crop, setCrop] = useState(lotDraft?.crop ?? '');
  const [qty, setQty] = useState(lotDraft?.quantityQuintals ?? '');
  const [rate, setRate] = useState(lotDraft?.expectedRate ?? '');
  const [harvestDate, setHarvestDate] = useState(
    lotDraft?.harvestDate ?? new Date().toISOString().slice(0, 10)
  );
  // Kept only so edits never wipe photos stored on older lots; never edited in UI.
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [village, setVillage] = useState(
    lotDraft?.location?.village ?? user?.village ?? ''
  );
  const [district, setDistrict] = useState(
    lotDraft?.location?.district ?? user?.district ?? ''
  );
  const [state, setState] = useState(lotDraft?.location?.state ?? user?.state ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);

  // Edit mode: hydrate from the backend (draft wins for unsaved new lots only).
  useEffect(() => {
    if (!lotId) return;
    getLot(lotId)
      .then((lot) => {
        setCrop(lot.crop);
        setQty(String(lot.quantityQuintals));
        setRate(String(lot.expectedRate));
        setHarvestDate(lot.harvestDate);
        setExistingPhotos(lot.photos ?? []);
        setVillage(lot.location?.village ?? '');
        setDistrict(lot.location?.district ?? '');
        setState(lot.location?.state ?? '');
      })
      .catch(() => toast(t('tradeLoadFailed'), { error: true }))
      .finally(() => setLoading(false));
  }, [lotId, t]);

  // Draft autosave (offline-tolerant).
  useEffect(() => {
    if (editing) return;
    const location: LotLocation = { village, district, state };
    saveLotDraft({ crop, quantityQuintals: qty, expectedRate: rate, harvestDate, location });
  }, [editing, crop, qty, rate, harvestDate, village, district, state, saveLotDraft]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!crop.trim()) next.crop = t('commonRequired');
    if (!(Number(qty) > 0)) next.qty = t('commonRequired');
    if (!(Number(rate) >= 0) || rate === '') next.rate = t('commonRequired');
    if (!harvestDate) next.harvestDate = t('commonRequired');
    if (!village.trim()) next.village = t('commonRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (retried = false) => {
    if (!validate()) return;
    setBusy(true);
    const payload = {
      crop: crop.trim(),
      quantityQuintals: Number(qty),
      expectedRate: Math.round(Number(rate)),
      harvestDate,
      photos: editing ? existingPhotos : [],
      location: { village: village.trim(), district: district.trim(), state: state.trim() },
    };
    try {
      if (lotId) {
        await updateLot(lotId, payload);
        toast(t('lotsUpdate'));
      } else {
        await createLot(payload);
        saveLotDraft(null);
        toast(t('lotsSubmit'));
      }
      navigate('/dashboard/p/sellProduce');
    } catch (e) {
      if (isApiError(e) && e.code === 'FORBIDDEN_ROLE' && !retried) {
        // Local/backend persona drift — re-activate farmer and try once more.
        const fixed = await ensureProfile('farmer');
        if (fixed) {
          setBusy(false);
          await submit(true);
          return;
        }
      }
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
      <ToolShell toolId="sellProduce">
        <p className="trade-hint">{t('commonLoading')}</p>
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="sellProduce">
      <LabeledTextField
        label={t('lotsCropLabel')}
        value={crop}
        onChange={setCrop}
        placeholder={t('lotsCropPlaceholder')}
        required
        error={errors.crop}
      />
      <LabeledTextField
        label={t('lotsQtyLabel')}
        value={qty}
        onChange={setQty}
        type="number"
        inputMode="decimal"
        required
        error={errors.qty}
      />
      <LabeledTextField
        label={t('lotsRateLabel')}
        value={rate}
        onChange={setRate}
        type="number"
        inputMode="numeric"
        prefix="₹"
        required
        error={errors.rate}
      />
      <PriceWithBenchmark crop={crop.trim()} quantityQuintals={Number(qty) || 0} price={Number(rate) || 0} />
      <LabeledTextField
        label={t('lotsHarvestLabel')}
        value={harvestDate}
        onChange={setHarvestDate}
        type="date"
        required
        error={errors.harvestDate}
      />
      <div className="av-field">
        <span className="av-label">{t('lotsLocationLabel')}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input
            className="av-input"
            value={village}
            onChange={(e) => setVillage(e.target.value)}
            placeholder={t('lotsVillage')}
            aria-label={t('lotsVillage')}
          />
          <input
            className="av-input"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder={t('lotsDistrict')}
            aria-label={t('lotsDistrict')}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <input
            className="av-input"
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder={t('lotsState')}
            aria-label={t('lotsState')}
          />
        </div>
        {errors.village ? <p className="av-field-error">{errors.village}</p> : null}
      </div>

      <div className="trade-actions">
        <button type="button" className="av-btn av-btn-primary" onClick={() => void submit()} disabled={busy}>
          {busy ? <span className="av-spinner" aria-hidden /> : editing ? t('lotsUpdate') : t('lotsSubmit')}
        </button>
        <button type="button" className="av-btn av-btn-ghost" onClick={() => navigate('/dashboard/p/sellProduce')} disabled={busy}>
          {t('commonCancel')}
        </button>
      </div>
      {!editing ? <p className="trade-hint">{t('lotsDraftSaved')}</p> : null}
    </ToolShell>
  );
}
