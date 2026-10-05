import { useCallback, useEffect, useMemo, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  addChamber,
  fmtINR,
  listProviderFacilities,
  updateFacility,
  type ColdStorageChamber,
  type ColdStorageFacility,
} from '../../lib/api/coldStorage';
import { isApiError } from '../../lib/api/client';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.coldstorage';
import '../../lib/i18n/locales/hi.coldstorage';
import './coldstorage.css';

const CHAMBER_TYPES = [
  { value: 'cold_storage', labelKey: 'csChamberTypeColdStorage' },
  { value: 'dry_godown', labelKey: 'csChamberTypeDryGodown' },
  { value: 'silo', labelKey: 'csChamberTypeSilo' },
] as const;

/**
 * Chamber management per facility. Chamber create uses the exact fields the
 * router accepts (`name`, `chamberType`, `capacityMT`, `tempRange`, `status`);
 * the ₹/quintal/month price lives on the facility and is edited through
 * `PUT /provider/facilities/{id}`. Toggling a chamber's status re-sends the
 * whole `chambers` array (the PUT whitelist replaces it wholesale).
 */
export default function ChambersPage() {
  const t = useT();
  const [facilities, setFacilities] = useState<ColdStorageFacility[]>([]);
  const [facilityId, setFacilityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [chamberType, setChamberType] = useState('cold_storage');
  const [capacityMT, setCapacityMT] = useState('');
  const [tempRange, setTempRange] = useState('2-8°C');
  const [status, setStatus] = useState('active');
  const [rate, setRate] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    listProviderFacilities()
      .then((rows) => {
        setFacilities(rows);
        setFacilityId((prev) => prev || (rows[0]?.id ?? ''));
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const facility = useMemo(
    () => facilities.find((f) => f.id === facilityId) ?? null,
    [facilities, facilityId]
  );

  useEffect(() => {
    setRate(facility ? String(facility.ratePerQuintalMonth) : '');
  }, [facility]);

  const submitChamber = async () => {
    if (busy || !facility) return;
    const capacity = Number(capacityMT);
    if (!name.trim() || Number.isNaN(capacity) || capacity <= 0) {
      toast(t('commonRequired'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await addChamber(facility.id, {
        name: name.trim(),
        chamberType,
        capacityMT: capacity,
        tempRange: tempRange.trim() || undefined,
        status,
      });
      toast(t('csChamberAdded'));
      setName('');
      setCapacityMT('');
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const toggleChamber = async (chamber: ColdStorageChamber) => {
    if (busy || !facility) return;
    setBusy(true);
    try {
      const next: ColdStorageChamber[] = facility.chambers.map((c) =>
        c.id === chamber.id ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' } : c
      );
      await updateFacility(facility.id, { chambers: next });
      toast(t('csSaved'));
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const updateRate = async () => {
    if (busy || !facility) return;
    const value = Number(rate);
    if (Number.isNaN(value) || value <= 0) {
      toast(t('commonRequired'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await updateFacility(facility.id, { ratePerQuintalMonth: value });
      toast(t('csChamberRateUpdated'));
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="coldStorageHome" backTo="/dashboard">
      <div className="cs-wrap">
        <div className="cs-section">
          <span className="cs-section-title">🚪 {t('csChambersTitle')}</span>
          {loading ? <p className="cs-hint">{t('commonLoading')}</p> : null}
          {failed ? <p className="cs-hint">{t('csLoadFailed')}</p> : null}
          {!loading && !failed ? (
            <label className="av-field" style={{ maxWidth: 340 }}>
              <span className="av-label">{t('csChamberFacility')}</span>
              <select className="av-input" value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {facility ? (
          <>
            <div className="cs-section">
              <span className="cs-section-title">{t('csChamberRate')}</span>
              <div className="cs-field-grid">
                <LabeledTextField label={t('csChamberRate')} value={rate} onChange={setRate} type="number" inputMode="decimal" />
              </div>
              <div className="cs-hint">
                {t('csFacilityRateShort')}: {fmtINR(facility.ratePerQuintalMonth)}
              </div>
              <div className="cs-actions">
                <button type="button" className="av-btn av-btn-primary" onClick={() => void updateRate()} disabled={busy}>
                  {t('csChamberUpdateRate')}
                </button>
              </div>
            </div>

            <div className="cs-section">
              <span className="cs-section-title">{t('csChamberAdd')}</span>
              <div className="cs-field-grid">
                <LabeledTextField label={t('csChamberName')} value={name} onChange={setName} required />
                <label className="av-field">
                  <span className="av-label">{t('csChamberType')}</span>
                  <select className="av-input" value={chamberType} onChange={(e) => setChamberType(e.target.value)}>
                    {CHAMBER_TYPES.map((ct) => (
                      <option key={ct.value} value={ct.value}>
                        {t(ct.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <LabeledTextField label={t('csChamberCapacity')} value={capacityMT} onChange={setCapacityMT} type="number" inputMode="decimal" required />
                <LabeledTextField label={t('csChamberTemp')} value={tempRange} onChange={setTempRange} />
                <label className="av-field">
                  <span className="av-label">{t('csChamberStatus')}</span>
                  <select className="av-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">{t('csActive')}</option>
                    <option value="inactive">{t('csInactive')}</option>
                  </select>
                </label>
              </div>
              <div className="cs-actions">
                <button type="button" className="av-btn av-btn-primary" onClick={() => void submitChamber()} disabled={busy}>
                  {busy ? <span className="av-spinner" aria-hidden /> : t('csChamberAdd')}
                </button>
              </div>
            </div>

            <div className="cs-section">
              <span className="cs-section-title">{t('csFacilityChambers')}</span>
              {facility.chambers.length === 0 ? (
                <p className="cs-empty">🚪 {t('csChamberEmpty')}</p>
              ) : (
                <table className="cs-table">
                  <thead>
                    <tr>
                      <th>{t('csChamberName')}</th>
                      <th>{t('csChamberCapacity')}</th>
                      <th>{t('csChamberTemp')}</th>
                      <th>{t('csChamberOccupancy')}</th>
                      <th>{t('csChamberStatus')}</th>
                      <th>{t('csColActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facility.chambers.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.capacityMT} {t('csUnitMT')}</td>
                        <td>{c.tempRange}</td>
                        <td>{c.currentOccupancyMT} {t('csUnitMT')}</td>
                        <td>
                          <span className={`cs-pill ${c.status === 'active' ? 'cs-pill-ok' : 'cs-pill-warn'}`}>
                            {c.status === 'active' ? t('csActive') : t('csInactive')}
                          </span>
                        </td>
                        <td>
                          <button type="button" className="av-btn av-btn-ghost" onClick={() => void toggleChamber(c)} disabled={busy}>
                            {c.status === 'active' ? t('csInactive') : t('csActive')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}
