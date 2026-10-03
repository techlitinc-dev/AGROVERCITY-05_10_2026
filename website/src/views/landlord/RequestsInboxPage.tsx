import { useCallback, useEffect, useState } from 'react';
import ModalSheet from '../../components/ModalSheet';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  acceptLeaseRequest,
  counterLeaseRequest,
  fetchLeaseRequests,
  rejectLeaseRequest,
  type LeaseRequest,
} from '../../lib/api/landlord';
import { useT } from '../../lib/i18n';

type Mode = 'reject' | 'counter';

/** LandBank — lease-request inbox with accept / reject / counter (task 1.5). */
export default function RequestsInboxPage() {
  const t = useT();
  const [requests, setRequests] = useState<LeaseRequest[] | null>(null);
  const [active, setActive] = useState<LeaseRequest | null>(null);
  const [mode, setMode] = useState<Mode>('counter');
  const [reason, setReason] = useState('');
  const [counterRent, setCounterRent] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchLeaseRequests()
      .then(setRequests)
      .catch(() => toast(t('llLoadFailed'), { error: true }));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async (request: LeaseRequest) => {
    if (busy) return;
    setBusy(true);
    try {
      await acceptLeaseRequest(request.id);
      toast(t('llStatusAccepted'));
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('llActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const submitModal = async () => {
    if (!active || busy) return;
    setBusy(true);
    try {
      if (mode === 'reject') {
        await rejectLeaseRequest(active.id, reason);
      } else {
        await counterLeaseRequest(active.id, {
          counterRentRupees: Number(counterRent),
          note: reason || undefined,
        });
      }
      setActive(null);
      setReason('');
      setCounterRent('');
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('llActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

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
      <h3>{t('llRequestsTitle')}</h3>
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
                  {request.farmerName}{' '}
                  {request.farmerKycVerified ? (
                    <span className="ai-badge ai-badge-high">✅ {t('llKycVerified')}</span>
                  ) : null}
                </div>
                <div className="dash-task-sub">
                  {t('llDurationMonths')}: {request.durationMonths} ·{' '}
                  {request.proposedRentRupees
                    ? `${t('llProposedRent')}: ₹${request.proposedRentRupees}`
                    : `${t('llProposedRent')}: —`}
                </div>
                {request.message ? <div className="dash-task-sub">{request.message}</div> : null}
              </div>
              <span className="dash-module-count clear">{statusLabel(request.status)}</span>
              {request.status === 'pending' || request.status === 'countered' ? (
                <>
                  <button type="button" className="dash-task-open" disabled={busy} onClick={() => void accept(request)}>
                    {t('llAccept')}
                  </button>
                  <button type="button" className="dash-task-open" disabled={busy}
                    onClick={() => { setActive(request); setMode('counter'); }}>
                    {t('llCounter')}
                  </button>
                  <button type="button" className="dash-task-open" disabled={busy}
                    onClick={() => { setActive(request); setMode('reject'); }}>
                    {t('llReject')}
                  </button>
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <ModalSheet
        open={active !== null}
        onClose={() => setActive(null)}
        title={mode === 'reject' ? t('llReject') : t('llCounter')}
      >
        {mode === 'counter' ? (
          <input className="av-input" type="number" placeholder={t('llCounterRent')} value={counterRent}
            onChange={(e) => setCounterRent(e.target.value)} />
        ) : null}
        <input className="av-input" style={{ marginTop: 8 }}
          placeholder={mode === 'reject' ? t('llRejectReason') : t('llMessage')} value={reason}
          onChange={(e) => setReason(e.target.value)} />
        <button type="button" className="av-btn av-btn-primary" style={{ marginTop: 12 }}
          disabled={busy || (mode === 'reject' && !reason) || (mode === 'counter' && !Number(counterRent))}
          onClick={() => void submitModal()}>
          {busy ? <span className="av-spinner" /> : t('llSubmit')}
        </button>
      </ModalSheet>
    </section>
  );
}
