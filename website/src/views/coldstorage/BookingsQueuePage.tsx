import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  listProviderBookings,
  reviewProviderBooking,
  type ColdStorageBooking,
} from '../../lib/api/coldStorage';
import { isApiError } from '../../lib/api/client';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.coldstorage';
import '../../lib/i18n/locales/hi.coldstorage';
import './coldstorage.css';

const FILTERS = [
  { value: 'pending', labelKey: 'csBookingsFilterPending' },
  { value: 'approved', labelKey: 'csBookingsFilterApproved' },
  { value: 'all', labelKey: 'csBookingsFilterAll' },
] as const;

function StatusPill({ status, label }: { status: string; label: string }) {
  const cls =
    status === 'rejected'
      ? 'cs-pill-bad'
      : status === 'approved' || status === 'inwarded' || status === 'released'
        ? 'cs-pill-ok'
        : 'cs-pill-warn';
  return <span className={`cs-pill ${cls}`}>{label}</span>;
}

export default function BookingsQueuePage() {
  const t = useT();
  const [status, setStatus] = useState<string>('pending');
  const [query, setQuery] = useState('');
  const [bookings, setBookings] = useState<ColdStorageBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [chambers, setChambers] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    listProviderBookings({ status, q: query.trim() || undefined, pageSize: 100 })
      .then((page) => setBookings(page.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [status, query]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (booking: ColdStorageBooking, action: 'approve' | 'reject') => {
    if (busyId) return;
    const reason = (reasons[booking.id] ?? '').trim();
    if (action === 'reject' && !reason) {
      toast(t('csReasonRequired'), { error: true });
      return;
    }
    setBusyId(booking.id);
    try {
      await reviewProviderBooking(booking.id, {
        action,
        notes: (notes[booking.id] ?? '').trim() || undefined,
        rejectionReason: action === 'reject' ? reason : undefined,
        allocatedChamberId: action === 'approve' ? (chambers[booking.id] ?? '').trim() || undefined : undefined,
      });
      toast(action === 'approve' ? t('csApproveDone') : t('csRejectDone'));
      setReasons((prev) => ({ ...prev, [booking.id]: '' }));
      setChambers((prev) => ({ ...prev, [booking.id]: '' }));
      setNotes((prev) => ({ ...prev, [booking.id]: '' }));
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  const statusLabel = (s: string) => {
    const key = `csStatus_${s}`;
    const label = t(key);
    return label === key ? s : label;
  };

  return (
    <ToolShell toolId="coldStorageHome" backTo="/dashboard">
      <div className="cs-wrap">
        <div className="cs-section">
          <span className="cs-section-title">📥 {t('csBookingsTitle')}</span>
          <div className="cs-actions" style={{ marginBottom: 8 }}>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`av-btn ${status === f.value ? 'av-btn-primary' : 'av-btn-ghost'}`}
                onClick={() => setStatus(f.value)}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>
          <LabeledTextField label={t('csSearchHint')} value={query} onChange={setQuery} />
        </div>

        {loading ? <p className="cs-hint">{t('commonLoading')}</p> : null}
        {failed ? <p className="cs-hint">{t('csLoadFailed')}</p> : null}
        {!loading && !failed && bookings.length === 0 ? (
          <p className="cs-empty">📥 {t('csBookingsEmpty')}</p>
        ) : null}

        <div className="cs-list">
          {bookings.map((b) => (
            <div key={b.id} className="cs-card">
              <div className="cs-row-head">
                <strong>
                  {b.farmerName} · {b.cropName}
                </strong>
                <StatusPill status={b.status} label={statusLabel(b.status)} />
              </div>
              <div className="cs-hint">
                {b.facilityName} · {b.quantityQuintals} {t('csUnitQuintals')} · {b.fromDate} × {b.months} ·{' '}
                {t('csColBooked')}: {b.bookedAt?.slice(0, 10)}
              </div>
              {b.releaseRequest ? (
                <div className="cs-hint">
                  {t('csReleaseRequested')}: {b.releaseRequest.requestedQuintals} {t('csUnitQuintals')} ·{' '}
                  {b.releaseRequest.pickupDate}
                </div>
              ) : null}
              {b.status === 'pending' || b.status === 'booked' ? (
                <>
                  <div className="cs-field-grid">
                    <LabeledTextField
                      label={t('csAllocatedChamber')}
                      value={chambers[b.id] ?? ''}
                      onChange={(v) => setChambers((prev) => ({ ...prev, [b.id]: v }))}
                    />
                    <LabeledTextField
                      label={t('csReviewNotes')}
                      value={notes[b.id] ?? ''}
                      onChange={(v) => setNotes((prev) => ({ ...prev, [b.id]: v }))}
                    />
                    <LabeledTextField
                      label={t('csRejectReason')}
                      value={reasons[b.id] ?? ''}
                      onChange={(v) => setReasons((prev) => ({ ...prev, [b.id]: v }))}
                    />
                  </div>
                  <div className="cs-actions">
                    <button
                      type="button"
                      className="av-btn av-btn-primary"
                      disabled={busyId === b.id}
                      onClick={() => void review(b, 'approve')}
                    >
                      {t('csApprove')}
                    </button>
                    <button
                      type="button"
                      className="av-btn av-btn-ghost"
                      disabled={busyId === b.id}
                      onClick={() => void review(b, 'reject')}
                    >
                      {t('csReject')}
                    </button>
                  </div>
                </>
              ) : null}
              {b.rejectionReason ? (
                <div className="cs-hint">
                  {t('csRejectReason')}: {b.rejectionReason}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </ToolShell>
  );
}
