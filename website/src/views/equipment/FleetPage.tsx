import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import {
  createEquipment,
  fetchMyEquipment,
  type EquipmentItem,
} from '../../lib/api/equipmentOwner';
import { useT } from '../../lib/i18n';
import '../../theme/saas_personas.css';
import '../../theme/trade.css';

const EQUIPMENT_TYPES = ['Tractor', 'Harvester', 'Rotavator', 'Sprayer', 'Thresher'] as const;

const TYPE_LABEL_KEY: Record<(typeof EQUIPMENT_TYPES)[number], string> = {
  Tractor: 'eqTypeTractor',
  Harvester: 'eqTypeHarvester',
  Rotavator: 'eqTypeRotavator',
  Sprayer: 'eqTypeSprayer',
  Thresher: 'eqTypeThresher',
};

/**
 * Machine fleet (equipment owner, features/farm_equipment owner.md) — fleet
 * table with doc/active status plus the add-machinery form (moved out of the
 * EquipmentOwnerHomeBoard monolith).
 */
export default function FleetPage() {
  const t = useT();
  useEnsureProfile('equipmentRental');

  const [fleet, setFleet] = useState<EquipmentItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Tractor', hourlyRate: '', perAcreRate: '' });

  const load = useCallback(() => {
    setFailed(false);
    fetchMyEquipment()
      .then(setFleet)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createEquipment({
        name: form.name,
        type: form.type,
        hourlyRate: Number(form.hourlyRate),
        perAcreRate: form.perAcreRate ? Number(form.perAcreRate) : undefined,
      });
      setAddOpen(false);
      setForm({ name: '', type: 'Tractor', hourlyRate: '', perAcreRate: '' });
      toast(t('eqMachineSaved'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="saas-container" style={{ padding: 0 }}>
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>{t('eqFleetTitle')}</span>
            <button type="button" className="saas-btn-primary" onClick={() => setAddOpen(true)}>
              ＋ {t('eqAddMachine')}
            </button>
          </div>

          {fleet === null && !failed ? (
            <p className="trade-hint">{t('commonLoading')}</p>
          ) : null}

          {failed ? (
            <EmptyState
              icon="📡"
              titleKey="tradeLoadFailed"
              action={
                <button type="button" className="saas-btn-secondary" onClick={load}>
                  ↻ {t('retry')}
                </button>
              }
            />
          ) : null}

          {fleet !== null && fleet.length === 0 ? (
            <EmptyState icon="🚜" titleKey="eqEmptyFleet" bodyKey="eqEmptyFleetBody" />
          ) : null}

          {fleet !== null && fleet.length > 0 ? (
            <div className="saas-table-container">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>{t('eqMachineName')}</th>
                    <th>{t('eqRcInsurance')}</th>
                    <th>{t('eqBookedHoursWeek')}</th>
                    <th>{t('eqWeeklyIncome')}</th>
                    <th>{t('eqStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.map((item) => (
                    <tr key={item.equipmentId}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>
                        <span
                          className={`saas-badge ${item.docStatus === 'verified' ? 'saas-badge-success' : 'saas-badge-warning'}`}
                        >
                          {item.docStatus === 'verified' ? t('eqRcVerified') : t('eqKycPending')}
                        </span>
                      </td>
                      <td>{item.bookedHoursThisWeek}</td>
                      <td style={{ fontWeight: 600 }}>₹{item.weeklyIncome.toLocaleString('en-IN')}</td>
                      <td>
                        <span className={`saas-badge ${item.status === 'active' ? 'saas-badge-success' : 'saas-badge-warning'}`}>
                          {item.status === 'active' ? t('eqActive') : t('eqInService')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <ModalSheet open={addOpen} onClose={() => setAddOpen(false)} title={t('eqAddMachine')}>
        <form onSubmit={handleCreate}>
          <div className="saas-form-group">
            <label className="saas-form-label" htmlFor="eq-name">
              {t('eqMachineName')}
            </label>
            <input
              id="eq-name"
              type="text"
              className="saas-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="saas-form-group">
            <label className="saas-form-label" htmlFor="eq-type">
              {t('eqCategory')}
            </label>
            <select
              id="eq-type"
              className="saas-select"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {EQUIPMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(TYPE_LABEL_KEY[type])}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="saas-form-group">
              <label className="saas-form-label" htmlFor="eq-hourly">
                {t('eqHourlyRate')}
              </label>
              <input
                id="eq-hourly"
                type="number"
                min={0}
                className="saas-input"
                value={form.hourlyRate}
                onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                required
              />
            </div>
            <div className="saas-form-group">
              <label className="saas-form-label" htmlFor="eq-per-acre">
                {t('eqPerAcreRate')}
              </label>
              <input
                id="eq-per-acre"
                type="number"
                min={0}
                className="saas-input"
                value={form.perAcreRate}
                onChange={(e) => setForm({ ...form, perAcreRate: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="saas-btn-secondary" onClick={() => setAddOpen(false)} disabled={busy}>
              {t('commonCancel')}
            </button>
            <button type="submit" className="saas-btn-primary" disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('eqSaveMachine')}
            </button>
          </div>
        </form>
      </ModalSheet>
    </>
  );
}
