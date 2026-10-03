import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { inr } from '../../lib/api/trade';
import {
  createBooking,
  createLoad,
  fareEstimate,
  vehicleCatalog,
  type FareEstimate,
  type VehicleType,
} from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import { ensureProfile } from '../../stores/dashboard';
import { useTransportStore } from '../../stores/transport';
import '../../theme/trade.css';

const STEP_COUNT = 3;

/**
 * Post-a-Load wizard (farmer, plan §5.1-A1) — three steps: what (crop, qty,
 * packaging, perishable), where & when (route, date, vehicle type, distance),
 * price path (instant quote with a live fare breakdown, or open auction at a
 * target fare). Draft-backed so an interrupted wizard survives offline.
 */
export default function LoadForm() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('farmer');

  const loadDraft = useTransportStore((s) => s.loadDraft);
  const saveLoadDraft = useTransportStore((s) => s.saveLoadDraft);

  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<VehicleType[]>([]);
  const [crop, setCrop] = useState(loadDraft?.crop ?? '');
  const [qty, setQty] = useState(loadDraft?.quantityQuintals ?? '');
  const [packaging, setPackaging] = useState(loadDraft?.packaging ?? '');
  const [perishable, setPerishable] = useState(loadDraft?.perishable ?? false);
  const [pickup, setPickup] = useState(loadDraft?.pickupLocation ?? '');
  const [drop, setDrop] = useState(loadDraft?.dropLocation ?? '');
  const [pickupDate, setPickupDate] = useState(
    loadDraft?.pickupDate ?? new Date().toISOString().slice(0, 10)
  );
  const [distanceKm, setDistanceKm] = useState(loadDraft?.distanceKm ?? '');
  const [vehicleType, setVehicleType] = useState(loadDraft?.preferredVehicleType ?? '');
  const [pricePath, setPricePath] = useState<'instant' | 'auction'>(loadDraft?.pricePath ?? 'instant');
  const [targetFare, setTargetFare] = useState(loadDraft?.targetFare ?? '');
  const [notes, setNotes] = useState(loadDraft?.notes ?? '');
  const [fare, setFare] = useState<FareEstimate | null>(null);
  const [fareLoading, setFareLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    vehicleCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  // Draft autosave (offline-tolerant).
  useEffect(() => {
    saveLoadDraft({
      crop,
      quantityQuintals: qty,
      packaging,
      perishable,
      pickupLocation: pickup,
      dropLocation: drop,
      pickupDate,
      distanceKm,
      preferredVehicleType: vehicleType,
      pricePath,
      targetFare,
      notes,
    });
  }, [crop, qty, packaging, perishable, pickup, drop, pickupDate, distanceKm, vehicleType, pricePath, targetFare, notes, saveLoadDraft]);

  // Live fare estimate for the instant-quote path.
  useEffect(() => {
    if (step !== 2 || pricePath !== 'instant') return;
    const d = Number(distanceKm);
    if (!vehicleType || !(d > 0)) {
      setFare(null);
      return;
    }
    let stale = false;
    setFareLoading(true);
    fareEstimate(vehicleType, d)
      .then((f) => {
        if (!stale) setFare(f);
      })
      .catch(() => {
        if (!stale) setFare(null);
      })
      .finally(() => {
        if (!stale) setFareLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [step, pricePath, vehicleType, distanceKm]);

  const vehicleLabel = (v: VehicleType): string =>
    `${v.type} · ${t('trVehicleCapacity', { tonnes: v.capacityTonnes })}`;

  const validateStep = (): boolean => {
    const next: Record<string, string> = {};
    if (step === 0) {
      if (!crop.trim()) next.crop = t('commonRequired');
      if (!(Number(qty) > 0)) next.qty = t('commonRequired');
    }
    if (step === 1) {
      if (!pickup.trim()) next.pickup = t('commonRequired');
      if (!drop.trim()) next.drop = t('commonRequired');
      if (!pickupDate) next.pickupDate = t('commonRequired');
      if (!vehicleType) next.vehicleType = t('commonRequired');
      if (!(Number(distanceKm) > 0)) next.distanceKm = t('commonRequired');
    }
    if (step === 2 && pricePath === 'auction') {
      if (!(Number(targetFare) > 0)) next.targetFare = t('commonRequired');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  };

  const submit = async (retried = false) => {
    if (!validateStep()) return;
    setBusy(true);
    try {
      if (pricePath === 'instant') {
        const booking = await createBooking({
          vehicleType,
          distanceKm: Math.round(Number(distanceKm)),
          pickup: pickup.trim(),
          drop: drop.trim(),
          date: pickupDate,
          commodity: crop.trim(),
          weightQuintals: Number(qty),
          packaging: packaging.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        saveLoadDraft(null);
        toast(t('trBookingCreated'));
        navigate(`/dashboard/p/transport/trips/${booking.id}`);
      } else {
        const load = await createLoad({
          pickupLocation: pickup.trim(),
          dropLocation: drop.trim(),
          crop: crop.trim(),
          quantityQuintals: Number(qty),
          packaging: packaging.trim() || undefined,
          perishable,
          preferredVehicleType: vehicleType,
          pickupDate,
          targetFare: Math.round(Number(targetFare)),
          notes: notes.trim() || undefined,
        });
        saveLoadDraft(null);
        toast(t('trLoadPosted'));
        navigate(`/dashboard/p/loadBoard/${load.id}`);
      }
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

  return (
    <ToolShell toolId="loadBoard" backTo="/dashboard/p/loadBoard">
      {step === 0 ? (
        <>
          <LabeledTextField
            label={t('trCommodity')}
            value={crop}
            onChange={setCrop}
            required
            error={errors.crop}
          />
          <LabeledTextField
            label={`${t('trWeight')} (${t('unitQuintal')})`}
            value={qty}
            onChange={setQty}
            type="number"
            inputMode="decimal"
            required
            error={errors.qty}
          />
          <LabeledTextField label={t('trPackaging')} value={packaging} onChange={setPackaging} />
          <div className="av-field">
            <div className="trade-filter-row">
              <ChipSelect
                options={[t('trPerishable')]}
                selected={perishable ? [t('trPerishable')] : []}
                onToggle={() => setPerishable((p) => !p)}
              />
            </div>
          </div>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <LabeledTextField
            label={t('trPickup')}
            value={pickup}
            onChange={setPickup}
            required
            error={errors.pickup}
          />
          <LabeledTextField
            label={t('trDrop')}
            value={drop}
            onChange={setDrop}
            required
            error={errors.drop}
          />
          <LabeledTextField
            label={t('trPickupDate')}
            value={pickupDate}
            onChange={setPickupDate}
            type="date"
            required
            error={errors.pickupDate}
          />
          <LabeledTextField
            label={`${t('trDistance')} (${t('trKm')})`}
            value={distanceKm}
            onChange={setDistanceKm}
            type="number"
            inputMode="decimal"
            required
            error={errors.distanceKm}
          />
          <div className="av-field">
            <span className="av-label">{t('trPreferredVehicle')}</span>
            <ChipSelect
              options={catalog.map(vehicleLabel)}
              selected={catalog.filter((v) => v.type === vehicleType).map(vehicleLabel)}
              onToggle={(label) => {
                const found = catalog.find((v) => vehicleLabel(v) === label);
                setVehicleType(found?.type ?? '');
                setErrors((prev) => ({ ...prev, vehicleType: '' }));
              }}
              single
            />
            {errors.vehicleType ? <p className="av-field-error">{errors.vehicleType}</p> : null}
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div className="av-field">
            <ChipSelect
              options={[t('trInstantQuote'), t('trAuction')]}
              selected={[pricePath === 'instant' ? t('trInstantQuote') : t('trAuction')]}
              onToggle={(label) =>
                setPricePath(label === t('trAuction') ? 'auction' : 'instant')
              }
              single
            />
          </div>
          <p className="trade-hint">{t('trPricePathHint')}</p>

          {pricePath === 'auction' ? (
            <LabeledTextField
              label={t('trTargetFare')}
              value={targetFare}
              onChange={setTargetFare}
              type="number"
              inputMode="numeric"
              prefix="₹"
              required
              error={errors.targetFare}
            />
          ) : fareLoading ? (
            <p className="trade-hint">{t('commonLoading')}</p>
          ) : fare ? (
            <div className="trade-invoice-box">
              <div className="trade-invoice-row">
                <span>{t('trBaseFare')}</span>
                <span>{inr(fare.baseFare)}</span>
              </div>
              <div className="trade-invoice-row">
                <span>{t('trDistanceFare', { km: distanceKm })}</span>
                <span>{inr(fare.distanceFare)}</span>
              </div>
              <div className="trade-invoice-row">
                <span>{t('trLoadingLabor')}</span>
                <span>{inr(fare.loadingLabor)}</span>
              </div>
              <div className="trade-invoice-row">
                <span>{t('trTollEstimate')}</span>
                <span>{inr(fare.tollEstimate)}</span>
              </div>
              {fare.perishableSurcharge ? (
                <div className="trade-invoice-row">
                  <span>{t('trPerishable')}</span>
                  <span>{inr(fare.perishableSurcharge)}</span>
                </div>
              ) : null}
              <div className="trade-invoice-total trade-invoice-row">
                <span>{t('trFareEstimate')}</span>
                <span>{inr(fare.totalFare)}</span>
              </div>
            </div>
          ) : (
            <p className="trade-hint">{t('tradeLoadFailed')}</p>
          )}

          <LabeledTextField label={t('commonNotes')} value={notes} onChange={setNotes} />
        </>
      ) : null}

      <div className="trade-actions">
        {step < STEP_COUNT - 1 ? (
          <button type="button" className="av-btn av-btn-primary" onClick={next}>
            →
          </button>
        ) : (
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? (
              <span className="av-spinner" aria-hidden />
            ) : pricePath === 'instant' ? (
              t('trCreateBooking')
            ) : (
              t('trPublishLoad')
            )}
          </button>
        )}
        {step > 0 ? (
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}>
            ←
          </button>
        ) : (
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={() => navigate('/dashboard/p/loadBoard')}
            disabled={busy}
          >
            {t('commonCancel')}
          </button>
        )}
      </div>
      <p className="trade-hint">{t('lotsDraftSaved')}</p>
    </ToolShell>
  );
}
