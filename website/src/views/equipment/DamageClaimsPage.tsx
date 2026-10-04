import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import {
  createDamageClaim,
  fetchDamageClaims,
  fetchMyEquipment,
  type DamageClaim,
  type EquipmentItem,
} from '../../lib/api/equipmentOwner';
import { useT } from '../../lib/i18n';
import '../../theme/saas_personas.css';
import '../../theme/trade.css';

const CLAIM_STATUS_META: Record<string, { cls: string; key: string }> = {
  open: { cls: 'saas-badge-warning', key: 'status_open' },
  resolved: { cls: 'saas-badge-success', key: 'eqStatusResolved' },
};

/**
 * Damage claims (equipment owner) — claim list plus the file-claim form
 * (equipment, booking reference, description, estimated cost) moved out of
 * the EquipmentOwnerHomeBoard monolith.
 */
export default function DamageClaimsPage() {
  const t = useT();
  useEnsureProfile('equipmentRental');

  const [claims, setClaims] = useState<DamageClaim[] | null>(null);
  const [fleet, setFleet] = useState<EquipmentItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    equipmentId: '',
    bookingId: '',
    incidentDate: new Date().toISOString().slice(0, 10),
    description: '',
    estimatedRepairCostRupees: '',
  });

  const load = useCallback(() => {
    setFailed(false);
    fetchDamageClaims()
      .then(setClaims)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    fetchMyEquipment()
      .then(setFleet)
      .catch(() => setFleet([]));
  }, []);

  const handleCreateClaim = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createDamageClaim({
        equipmentId: form.equipmentId,
        bookingId: form.bookingId,
        incidentDate: form.incidentDate,
        description: form.description,
        estimatedRepairCostRupees: Number(form.estimatedRepairCostRupees),
      });
      setClaimOpen(false);
      setForm({
        equipmentId: '',
        bookingId: '',
        incidentDate: new Date().toISOString().slice(0, 10),
        description: '',
        estimatedRepairCostRupees: '',
      });
      toast(t('eqClaimFiled'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const statusMeta = (c: DamageClaim): { cls: string; key: string } =>
    CLAIM_STATUS_META[c.status] ?? { cls: 'saas-badge-warning', key: '' };

  return (
    <>
      <div className="saas-container" style={{ padding: 0 }}>
        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>{t('eqClaimsTitle')}</span>
            <button type="button" className="saas-btn-secondary" onClick={() => setClaimOpen(true)}>
              ＋ {t('eqFileClaim')}
            </button>
          </div>

          {claims === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

          {claims !== null && claims.length === 0 ? (
            <EmptyState icon="🛡️" titleKey="eqNoClaims" />
          ) : null}

          {claims !== null && claims.length > 0 ? (
            <div className="saas-table-container">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>{t('eqClaimId')}</th>
                    <th>{t('eqEquipment')}</th>
                    <th>{t('eqIncidentDate')}</th>
                    <th>{t('eqIncidentDescription')}</th>
                    <th>{t('eqEstimatedCost')}</th>
                    <th>{t('eqPhotos')}</th>
                    <th>{t('eqStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => {
                    const meta = statusMeta(c);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.id}</td>
                        <td>{c.equipmentName}</td>
                        <td>{c.incidentDate}</td>
                        <td>{c.description}</td>
                        <td style={{ fontWeight: 600 }}>₹{c.estimatedRepairCostRupees.toLocaleString('en-IN')}</td>
                        <td>{c.photoEvidenceUrls?.length ?? 0}</td>
                        <td>
                          <span className={`saas-badge ${meta.cls}`}>
                            {meta.key ? t(meta.key) : c.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <ModalSheet open={claimOpen} onClose={() => setClaimOpen(false)} title={t('eqFileClaimTitle')}>
        <form onSubmit={handleCreateClaim}>
          <div className="saas-form-group">
            <label className="saas-form-label" htmlFor="eq-claim-equipment">
              {t('eqSelectEquipment')}
            </label>
            <select
              id="eq-claim-equipment"
              className="saas-select"
              value={form.equipmentId}
              onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}
              required
            >
              <option value="">{t('eqSelectEquipment')}</option>
              {fleet.map((f) => (
                <option key={f.equipmentId} value={f.equipmentId}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="saas-form-group">
            <label className="saas-form-label" htmlFor="eq-claim-booking">
              {t('eqBookingRef')}
            </label>
            <input
              id="eq-claim-booking"
              type="text"
              className="saas-input"
              value={form.bookingId}
              onChange={(e) => setForm({ ...form, bookingId: e.target.value })}
              required
            />
          </div>
          <div className="saas-form-group">
            <label className="saas-form-label" htmlFor="eq-claim-date">
              {t('eqIncidentDate')}
            </label>
            <input
              id="eq-claim-date"
              type="date"
              className="saas-input"
              value={form.incidentDate}
              onChange={(e) => setForm({ ...form, incidentDate: e.target.value })}
              required
            />
          </div>
          <div className="saas-form-group">
            <label className="saas-form-label" htmlFor="eq-claim-description">
              {t('eqIncidentDescription')}
            </label>
            <textarea
              id="eq-claim-description"
              className="saas-textarea"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>
          <div className="saas-form-group">
            <label className="saas-form-label" htmlFor="eq-claim-cost">
              {t('eqEstimatedCost')} (₹)
            </label>
            <input
              id="eq-claim-cost"
              type="number"
              min={0}
              className="saas-input"
              value={form.estimatedRepairCostRupees}
              onChange={(e) => setForm({ ...form, estimatedRepairCostRupees: e.target.value })}
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="saas-btn-secondary" onClick={() => setClaimOpen(false)} disabled={busy}>
              {t('commonCancel')}
            </button>
            <button type="submit" className="saas-btn-primary" disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('eqSubmitClaim')}
            </button>
          </div>
        </form>
      </ModalSheet>
    </>
  );
}
