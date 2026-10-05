import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  createFacility,
  fmtINR,
  listProviderFacilities,
  updateFacility,
  type ColdStorageFacility,
  type FacilityInput,
} from '../../lib/api/coldStorage';
import { isApiError } from '../../lib/api/client';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.coldstorage';
import '../../lib/i18n/locales/hi.coldstorage';
import './coldstorage.css';

const FACILITY_TYPES = [
  { value: 'cold_storage', labelKey: 'csFacilityTypeColdStorage' },
  { value: 'dry_godown', labelKey: 'csFacilityTypeDryGodown' },
  { value: 'godown', labelKey: 'csFacilityTypeGodown' },
  { value: 'silo', labelKey: 'csFacilityTypeSilo' },
  { value: 'multi_chamber', labelKey: 'csFacilityTypeMultiChamber' },
] as const;

interface FormState {
  name: string;
  facilityType: string;
  capacityMT: string;
  ratePerQuintalMonth: string;
  address: string;
  district: string;
  state: string;
  managerName: string;
  contactPhone: string;
  tempRange: string;
  distanceKm: string;
  wdraRegistered: boolean;
  wdraRegNo: string;
  supportedCrops: string;
}

const EMPTY: FormState = {
  name: '',
  facilityType: 'cold_storage',
  capacityMT: '',
  ratePerQuintalMonth: '',
  address: '',
  district: '',
  state: '',
  managerName: '',
  contactPhone: '',
  tempRange: '2-8°C',
  distanceKm: '',
  wdraRegistered: true,
  wdraRegNo: '',
  supportedCrops: '',
};

export default function FacilitiesPage() {
  const t = useT();
  const [facilities, setFacilities] = useState<ColdStorageFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    listProviderFacilities()
      .then(setFacilities)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const startEdit = (facility: ColdStorageFacility) => {
    setEditingId(facility.id);
    setErrors({});
    setForm({
      name: facility.name,
      facilityType: facility.facilityType,
      capacityMT: String(facility.totalCapacityMT),
      ratePerQuintalMonth: String(facility.ratePerQuintalMonth),
      address: facility.address ?? '',
      district: facility.district,
      state: facility.state,
      managerName: facility.managerName ?? '',
      contactPhone: facility.contactPhone ?? '',
      tempRange: facility.tempRange,
      distanceKm: String(facility.distanceKm),
      wdraRegistered: facility.wdraRegistered,
      wdraRegNo: facility.wdraRegNo ?? '',
      supportedCrops: facility.supportedCrops.join(', '),
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY);
    setErrors({});
  };

  const submit = async () => {
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = t('commonRequired');
    const capacity = Number(form.capacityMT);
    if (!form.capacityMT.trim() || Number.isNaN(capacity) || capacity <= 0) {
      nextErrors.capacityMT = t('commonRequired');
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const payload: FacilityInput = {
      name: form.name.trim(),
      facilityType: form.facilityType,
      capacityMT: capacity,
      ratePerQuintalMonth: form.ratePerQuintalMonth.trim() === '' ? undefined : Number(form.ratePerQuintalMonth),
      address: form.address.trim() || undefined,
      district: form.district.trim() || undefined,
      state: form.state.trim() || undefined,
      managerName: form.managerName.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      tempRange: form.tempRange.trim() || undefined,
      distanceKm: form.distanceKm.trim() === '' ? undefined : Number(form.distanceKm),
      wdraRegistered: form.wdraRegistered,
      wdraRegNo: form.wdraRegNo.trim() || undefined,
      supportedCrops: form.supportedCrops
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    };
    setBusy(true);
    setErrors({});
    try {
      if (editingId) {
        await updateFacility(editingId, payload);
        toast(t('csFacilityUpdated'));
      } else {
        await createFacility(payload);
        toast(t('csFacilitySaved'));
      }
      resetForm();
      load();
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else {
        toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="coldStorageHome" backTo="/dashboard">
      <div className="cs-wrap">
        <div className="cs-section">
          <span className="cs-section-title">
            🏢 {editingId ? t('csFacilityEdit') : t('csFacilityNew')}
          </span>
          <div className="cs-field-grid">
            <LabeledTextField label={t('csFacilityName')} value={form.name} onChange={(v) => set('name', v)} error={errors.name} required />
            <label className="av-field">
              <span className="av-label">{t('csFacilityType')}</span>
              <select className="av-input" value={form.facilityType} onChange={(e) => set('facilityType', e.target.value)}>
                {FACILITY_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>
                    {t(ft.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <LabeledTextField label={t('csFacilityCapacity')} value={form.capacityMT} onChange={(v) => set('capacityMT', v)} type="number" inputMode="decimal" error={errors.capacityMT} required />
            <LabeledTextField label={t('csFacilityRate')} value={form.ratePerQuintalMonth} onChange={(v) => set('ratePerQuintalMonth', v)} type="number" inputMode="decimal" />
            <LabeledTextField label={t('csFacilityDistrict')} value={form.district} onChange={(v) => set('district', v)} />
            <LabeledTextField label={t('csFacilityState')} value={form.state} onChange={(v) => set('state', v)} />
            <LabeledTextField label={t('csFacilityAddress')} value={form.address} onChange={(v) => set('address', v)} />
            <LabeledTextField label={t('csFacilityManager')} value={form.managerName} onChange={(v) => set('managerName', v)} />
            <LabeledTextField label={t('csFacilityPhone')} value={form.contactPhone} onChange={(v) => set('contactPhone', v)} type="tel" inputMode="tel" />
            <LabeledTextField label={t('csFacilityTemp')} value={form.tempRange} onChange={(v) => set('tempRange', v)} />
            <LabeledTextField label={t('csFacilityDistance')} value={form.distanceKm} onChange={(v) => set('distanceKm', v)} type="number" inputMode="decimal" />
            <LabeledTextField label={t('csFacilityWdraNo')} value={form.wdraRegNo} onChange={(v) => set('wdraRegNo', v)} />
            <LabeledTextField label={t('csFacilityCrops')} value={form.supportedCrops} onChange={(v) => set('supportedCrops', v)} />
          </div>
          <label className="av-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.wdraRegistered} onChange={(e) => set('wdraRegistered', e.target.checked)} />
            {t('csFacilityWdra')}
          </label>
          <div className="cs-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submit()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('csFacilitySave')}
            </button>
            {editingId ? (
              <button type="button" className="av-btn av-btn-ghost" onClick={resetForm} disabled={busy}>
                {t('commonCancel')}
              </button>
            ) : null}
          </div>
        </div>

        <div className="cs-section">
          <span className="cs-section-title">{t('csFacilitiesTitle')}</span>
          {loading ? <p className="cs-hint">{t('commonLoading')}</p> : null}
          {failed ? <p className="cs-hint">{t('csLoadFailed')}</p> : null}
          {!loading && !failed && facilities.length === 0 ? (
            <p className="cs-empty">🏢 {t('csFacilityEmpty')}</p>
          ) : null}
          <div className="cs-list">
            {facilities.map((f) => (
              <div key={f.id} className="cs-card">
                <div className="cs-row-head">
                  <strong>{f.name}</strong>
                  <span className="cs-pill">{t(`csFacilityType${f.facilityType === 'cold_storage' ? 'ColdStorage' : f.facilityType === 'dry_godown' ? 'DryGodown' : f.facilityType === 'godown' ? 'Godown' : f.facilityType === 'silo' ? 'Silo' : 'MultiChamber'}`)}</span>
                </div>
                <div className="cs-hint">
                  {t('csFacilityCapacityLabel')}: {f.totalCapacityMT} {t('csUnitMT')} · {t('csFacilityRateShort')}: {fmtINR(f.ratePerQuintalMonth)} ·{' '}
                  {t('csFacilityChambers')}: {f.chambers.length} · {t('csFacilityDistance')}: {f.distanceKm} km
                </div>
                <div className="cs-hint">
                  {f.district}, {f.state}
                  {f.wdraRegNo ? ` · WDRA: ${f.wdraRegNo}` : ''}
                </div>
                <div className="cs-actions">
                  <button type="button" className="av-btn av-btn-ghost" onClick={() => startEdit(f)}>
                    {t('csFacilityEdit')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
