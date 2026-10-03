import { useCallback, useEffect, useState } from 'react';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  fetchLeaseAgreement,
  fetchLeaseMilestones,
  fetchLeases,
  updateLeaseMilestone,
  type EscrowMilestone,
  type Lease,
} from '../../lib/api/landlord';
import { useT } from '../../lib/i18n';

/** LandBank — leases with agreement PDF, escrow milestones, dual e-sign (task 1.6). */
export default function LeasesPage() {
  const t = useT();
  const [leases, setLeases] = useState<Lease[] | null>(null);
  const [selected, setSelected] = useState<Lease | null>(null);
  const [milestones, setMilestones] = useState<EscrowMilestone[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchLeases()
      .then((rows) => {
        setLeases(rows);
        if (rows.length > 0) setSelected((current) => current ?? rows[0]);
      })
      .catch(() => toast(t('llLoadFailed'), { error: true }));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    fetchLeaseMilestones(selected.id)
      .then((res) => setMilestones(res.milestones))
      .catch(() => setMilestones([]));
  }, [selected]);

  const agreement = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const { agreementUrl } = await fetchLeaseAgreement(selected.id);
      const opened = window.open(agreementUrl, '_blank');
      if (!opened) toast(agreementUrl);
    } catch (e) {
      toast(isApiError(e) ? e.message : t('llUpgradeRequired'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const release = async (index: number) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const res = await updateLeaseMilestone(selected.id, { milestoneIndex: index, status: 'released' });
      setMilestones(res.milestones);
      toast(t('llRelease'));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('llActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const milestoneLabel = (status: EscrowMilestone['status']) =>
    status === 'released' ? t('llStatusAccepted') : status === 'disputed' ? t('llStatusRejected') : t('llStatusPending');

  return (
    <section className="dash-section">
      <h3>{t('llLeasesTitle')}</h3>
      {leases === null ? (
        <p className="dash-empty-line">…</p>
      ) : leases.length === 0 ? (
        <p className="dash-empty-line">📜 {t('llEmpty')}</p>
      ) : (
        <>
          <div className="dash-grid-3">
            {leases.map((lease) => (
              <button
                key={lease.id}
                type="button"
                className="dash-module-card"
                style={{ textAlign: 'left', cursor: 'pointer' }}
                onClick={() => setSelected(lease)}
              >
                <span className="dash-module-name">{lease.tenantName}</span>
                <span className="dash-module-count clear">₹{lease.monthlyRentRupees}/{t('llMonth')}</span>
                <span className="dash-module-count clear">
                  {lease.startDate} → {lease.endDate}
                </span>
                <span className={`ai-badge ${lease.verified ? 'ai-badge-high' : 'ai-badge-low'}`}>
                  {lease.verified ? t('llVerified') : t('llUnverified')}
                </span>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="dash-module-card" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="dash-module-name">
                  {t('llTenant')}: {selected.tenantName}
                </span>
                <button type="button" className="dash-task-open" disabled={busy} onClick={() => void agreement()}>
                  📄 {t('llAgreementPdf')}
                </button>
              </div>
              <h4>{t('llEscrowMilestones')}</h4>
              <div className="dash-task-list">
                {milestones.map((milestone) => (
                  <div key={milestone.index} className="dash-task-row">
                    <div className="dash-task-main">
                      <div className="dash-task-title">
                        {milestone.name} · {milestone.percentage}%
                      </div>
                      <div className="dash-task-sub">
                        ₹{milestone.amountRupees} · {milestone.targetWindow}
                      </div>
                    </div>
                    <span className="dash-module-count clear">{milestoneLabel(milestone.status)}</span>
                    {milestone.status === 'pending' ? (
                      <button type="button" className="dash-task-open" disabled={busy}
                        onClick={() => void release(milestone.index)}>
                        {t('llRelease')}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
