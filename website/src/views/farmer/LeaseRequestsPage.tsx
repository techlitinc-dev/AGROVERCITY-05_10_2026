import { useCallback, useEffect, useState } from 'react';
import { toast } from '../../components/toast';
import { fetchMyLeaseRequests, type LeaseRequest } from '../../lib/api/landlord';
import { useT } from '../../lib/i18n';

/** Farmer-side lease-request tracking (phase-02 WS-01 task 1.20). */
export default function LeaseRequestsPage() {
  const t = useT();
  const [requests, setRequests] = useState<LeaseRequest[] | null>(null);

  const load = useCallback(() => {
    fetchMyLeaseRequests()
      .then(setRequests)
      .catch(() => toast(t('llLoadFailed'), { error: true }));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const statusLabel = (status: LeaseRequest['status']) =>
    status === 'accepted'
      ? t('llStatusAccepted')
      : status === 'rejected'
        ? t('llStatusRejected')
        : status === 'countered'
          ? t('llStatusCountered')
          : t('llStatusPending');

  return (
    <section className="dash-section">
      <h3>{t('llMyRequestsTitle')}</h3>
      {requests === null ? (
        <p className="dash-empty-line">…</p>
      ) : requests.length === 0 ? (
        <p className="dash-empty-line">📩 {t('llEmpty')}</p>
      ) : (
        <div className="dash-task-list">
          {requests.map((request) => (
            <div key={request.id} className="dash-task-row">
              <div className="dash-task-main">
                <div className="dash-task-title">
                  {statusLabel(request.status)} · {request.durationMonths} {t('llDurationMonths')}
                </div>
                <div className="dash-task-sub">
                  {request.counterRentRupees
                    ? `${t('llCounterRent')}: ₹${request.counterRentRupees}`
                    : request.proposedRentRupees
                      ? `${t('llProposedRent')}: ₹${request.proposedRentRupees}`
                      : request.message || '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
