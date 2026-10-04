import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ModalSheet from '../../components/ModalSheet';
import EmptyState from '../../components/trade/EmptyState';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import {
  confirmClaimEstimate,
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
  const [busyConfirmId, setBusyConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({
    equipmentId: '',
    bookingId: '',
    incidentDate: new Date().toISOString().slice(0, 10),
    description: '',
    estimatedRepairCostRupees: '',
    photoUrl: '',
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
        photoEvidenceUrls: form.photoUrl.trim() ? [form.photoUrl.trim()] : undefined,
      });
      setClaimOpen(false);
      setForm({
        equipmentId: '',
        bookingId: '',
        incidentDate: new Date().toISOString().slice(0, 10),
        description: '',
        estimatedRepairCostRupees: '',
        photoUrl: '',
      });
      toast(t('eqClaimFiled'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDeduction = async (id: string) => {
    setBusyConfirmId(id);
    try {
      await confirmClaimEstimate(id);
      toast(t('eqDeductionConfirmedToast'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusyConfirmId(null);
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
                    <th>{t('eqAiSeverityEstimate')}</th>
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
                          {c.aiEstimate ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span
                                className={`saas-badge ${
                                  c.aiEstimate.severity === 'minor'
                                    ? 'saas-badge-info'
                                    : c.aiEstimate.severity === 'severe'
                                      ? 'saas-badge-danger'
                                      : 'saas-badge-warning'
                                }`}
                              >
                                🤖 {t(c.aiEstimate.severity === 'minor' ? 'eqSeverityMinor' : c.aiEstimate.severity === 'severe' ? 'eqSeveritySevere' : 'eqSeverityModerate')}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {t('eqSuggestedDeduction')}: {c.aiEstimate.suggestedDeductionBand}
                              </span>
                              {c.confirmedDeductionPaisa || c.aiEstimate.confirmed ? (
                                <span className="saas-badge saas-badge-success" style={{ fontSize: '0.7rem' }}>
                                  ✓ {t('eqConfirmedDeduction')} (₹{Math.round((c.confirmedDeductionPaisa ?? c.aiEstimate.suggestedDeductionPaisa) / 100)})
                                </span>
                              ) : c.status === 'open' ? (
                                <button
                                  type="button"
                                  className="saas-btn-primary"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                  disabled={busyConfirmId === c.id}
                                  onClick={() => handleConfirmDeduction(c.id)}
                                >
                                  {busyConfirmId === c.id ? <span className="av-spinner" aria-hidden /> : `✓ ${t('eqConfirmDeduction')}`}
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                          )}
                        </td>
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
          <div className="saas-form-group">
            <label className="saas-form-label" htmlFor="eq-claim-photo">
              {t('eqPhotos')} URL
            </label>
            <input
              id="eq-claim-photo"
              type="url"
              className="saas-input"
              placeholder="https://..."
              value={form.photoUrl}
              onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
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
