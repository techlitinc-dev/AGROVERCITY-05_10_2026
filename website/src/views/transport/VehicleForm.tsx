import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createVehicle,
  myVehicles,
  updateVehicle,
  vehicleCatalog,
  type VehicleType,
} from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import { ensureProfile } from '../../stores/dashboard';
import '../../theme/trade.css';

const PERMIT_TYPES = ['state', 'national'] as const;

/**
 * Add / edit a fleet vehicle (transporter, plan §5.2-B1) — type from the
 * platform catalog, registration no., capacity, permit, doc expiry dates and
 * driver name. Doc status is shown read-only (set by the backend).
 */
export default function VehicleForm() {
  const t = useT();
  const navigate = useNavigate();
  const { vehicleId } = useParams();
  const editing = Boolean(vehicleId);
  useEnsureProfile('transport');

  const [catalog, setCatalog] = useState<VehicleType[]>([]);
  const [vehicleType, setVehicleType] = useState('');
  const [regNo, setRegNo] = useState('');
  const [capacity, setCapacity] = useState('');
  const [permitType, setPermitType] = useState<string>('state');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [fitnessExpiry, setFitnessExpiry] = useState('');
  const [driverName, setDriverName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    vehicleCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  // Edit mode: hydrate from the fleet list (draft-free, backend is authoritative).
  useEffect(() => {
    if (!vehicleId) return;
    myVehicles()
      .then((list) => {
        const v = list.find((item) => item.id === vehicleId);
        if (!v) {
          toast(t('tradeLoadFailed'), { error: true });
          return;
        }
        setVehicleType(v.vehicleType);
        setRegNo(v.registrationNo);
        setCapacity(String(v.capacityTonnes));
        setPermitType(v.permitType === 'national' ? 'national' : 'state');
        setInsuranceExpiry(v.insuranceExpiry ?? '');
        setFitnessExpiry(v.fitnessExpiry ?? '');
        setDriverName(v.driverName ?? '');
      })
      .catch(() => toast(t('tradeLoadFailed'), { error: true }))
      .finally(() => setLoading(false));
  }, [vehicleId, t]);

  const permitLabel = (p: string): string =>
    p === 'national' ? t('trPermitNational') : t('trPermitState');

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!vehicleType) next.vehicleType = t('commonRequired');
    if (!regNo.trim()) next.regNo = t('commonRequired');
    if (!(Number(capacity) > 0)) next.capacity = t('commonRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (retried = false) => {
    if (!validate()) return;
    setBusy(true);
    const payload = {
      vehicleType,
      registrationNo: regNo.trim(),
      capacityTonnes: Number(capacity),
      permitType,
      insuranceExpiry: insuranceExpiry || undefined,
      fitnessExpiry: fitnessExpiry || undefined,
      driverName: driverName.trim() || undefined,
    };
    try {
      if (vehicleId) {
        await updateVehicle(vehicleId, payload);
      } else {
        await createVehicle(payload);
      }
      toast(t('trVehicleSaved'));
      navigate('/dashboard/p/vehicleManage');
    } catch (e) {
      if (isApiError(e) && e.code === 'FORBIDDEN_ROLE' && !retried) {
        // Local/backend persona drift — re-activate transporter and try once more.
        const fixed = await ensureProfile('transport');
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
      <ToolShell toolId="vehicleManage" backTo="/dashboard/p/vehicleManage">
        <p className="trade-hint">{t('commonLoading')}</p>
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="vehicleManage" backTo="/dashboard/p/vehicleManage">
      <div className="av-field">
        <span className="av-label">{t('trVehicleType')}</span>
        <ChipSelect
          options={catalog.map((v) => v.type)}
          selected={catalog.filter((v) => v.type === vehicleType).map((v) => v.type)}
          onToggle={(label) => {
            setVehicleType(label);
            setErrors((prev) => ({ ...prev, vehicleType: '' }));
          }}
          single
        />
        {errors.vehicleType ? <p className="av-field-error">{errors.vehicleType}</p> : null}
      </div>

      <LabeledTextField
        label={t('trRegNo')}
        value={regNo}
        onChange={setRegNo}
        required
        error={errors.regNo}
      />
      <LabeledTextField
        label={t('trCapacityTonnes')}
        value={capacity}
        onChange={setCapacity}
        type="number"
        inputMode="decimal"
        required
        error={errors.capacity}
      />

      <div className="av-field">
        <span className="av-label">{t('trPermitType')}</span>
        <ChipSelect
          options={PERMIT_TYPES.map(permitLabel)}
          selected={[permitLabel(permitType)]}
          onToggle={(label) =>
            setPermitType(PERMIT_TYPES.find((p) => permitLabel(p) === label) ?? 'state')
          }
          single
        />
      </div>

      <LabeledTextField
        label={t('trInsuranceExpiry')}
        value={insuranceExpiry}
        onChange={setInsuranceExpiry}
        type="date"
      />
      <LabeledTextField
        label={t('trFitnessExpiry')}
        value={fitnessExpiry}
        onChange={setFitnessExpiry}
        type="date"
      />
      <LabeledTextField label={t('trDriverName')} value={driverName} onChange={setDriverName} />

      <div className="trade-actions">
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => void submit()}
          disabled={busy}
        >
          {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
        </button>
        <button
          type="button"
          className="av-btn av-btn-ghost"
          onClick={() => navigate('/dashboard/p/vehicleManage')}
          disabled={busy}
        >
          {t('commonCancel')}
        </button>
      </div>
    </ToolShell>
  );
}
