import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  getBooking,
  listMyColdStorageBookings,
  requestBookingRelease,
  type ColdStorageBooking,
} from '../../lib/api/coldStorage';
import { isApiError } from '../../lib/api/client';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.coldstorage';
import '../../lib/i18n/locales/hi.coldstorage';
import '../coldstorage/coldstorage.css';

interface ReleaseForm {
  requestedQuintals: string;
  pickupDate: string;
  vehicleNumber: string;
  notes: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const ACTIVE_STATUSES = new Set(['approved', 'inwarded', 'partially_released', 'release_requested']);

export default function MyStorageBookingsPage() {
  const t = useT();
  const [bookings, setBookings] = useState<ColdStorageBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, ReleaseForm>>({});

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    listMyColdStorageBookings()
      .then((rows) => Promise.all(rows.map((r) => getBooking(r.id))))
      .then(setBookings)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formFor = (id: string, booking: ColdStorageBooking): ReleaseForm =>
    forms[id] ?? {
      requestedQuintals: String(booking.remainingQuintals ?? booking.quantityQuintals),
      pickupDate: today(),
      vehicleNumber: '',
      notes: '',
    };

  const submitRelease = async (booking: ColdStorageBooking) => {
    if (busyId) return;
    const form = formFor(booking.id, booking);
    const qty = Number(form.requestedQuintals);
    if (Number.isNaN(qty) || qty <= 0) {
      toast(t('commonRequired'), { error: true });
      return;
    }
    setBusyId(booking.id);
    try {
      await requestBookingRelease(booking.id, {
        requestedQuintals: qty,
        pickupDate: form.pickupDate,
        vehicleNumber: form.vehicleNumber.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      toast(t('csMyReleaseRequested'));
      setForms((prev) => {
        const next = { ...prev };
        delete next[booking.id];
        return next;
      });
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

  const receipts = bookings.filter((b) => b.receiptNumber);

  return (
    <ToolShell toolId="myBookings" backTo="/dashboard">
      <div className="cs-wrap">
        <div className="cs-section">
          <span className="cs-section-title">📦 {t('csMyTitle')}</span>
          {loading ? <p className="cs-hint">{t('commonLoading')}</p> : null}
          {failed ? <p className="cs-hint">{t('csLoadFailed')}</p> : null}
          {!loading && !failed && bookings.length === 0 ? (
            <p className="cs-empty">📦 {t('csMyEmpty')}</p>
          ) : null}
          <div className="cs-list">
            {bookings.map((b) => {
              const form = formFor(b.id, b);
              return (
                <div key={b.id} className="cs-card">
                  <div className="cs-row-head">
                    <strong>
                      {b.facilityName} · {b.cropName}
                    </strong>
                    <span className={`cs-pill ${b.status === 'rejected' ? 'cs-pill-bad' : 'cs-pill-warn'}`}>
                      {statusLabel(b.status)}
                    </span>
                  </div>
                  <div className="cs-hint">
                    {b.quantityQuintals} {t('csUnitQuintals')} · {b.fromDate} × {b.months} ·{' '}
                    {b.lotNumber ? `${t('csMyLot')}: ${b.lotNumber}` : ''}
                    {b.remainingQuintals !== undefined ? ` · ${t('csMyRemaining')}: ${b.remainingQuintals}` : ''}
                  </div>
                  {b.receiptNumber ? (
                    <div className="cs-actions">
                      <Link className="av-link" to={`/storage/receipts/${b.receiptNumber}`}>
                        📜 {t('csMyViewReceipt')} ({b.receiptNumber})
                      </Link>
                    </div>
                  ) : null}

                  {ACTIVE_STATUSES.has(b.status) && b.status !== 'release_requested' ? (
                    <>
                      <div className="cs-field-grid">
                        <LabeledTextField
                          label={t('csMyRequestedQuintals')}
                          value={form.requestedQuintals}
                          onChange={(v) => setForms((prev) => ({ ...prev, [b.id]: { ...form, requestedQuintals: v } }))}
                          type="number"
                          inputMode="decimal"
                          required
                        />
                        <LabeledTextField
                          label={t('csMyPickupDate')}
                          value={form.pickupDate}
                          onChange={(v) => setForms((prev) => ({ ...prev, [b.id]: { ...form, pickupDate: v } }))}
                          type="date"
                          required
                        />
                        <LabeledTextField
                          label={t('csMyVehicle')}
                          value={form.vehicleNumber}
                          onChange={(v) => setForms((prev) => ({ ...prev, [b.id]: { ...form, vehicleNumber: v } }))}
                        />
                        <LabeledTextField
                          label={t('csMyReleaseNotes')}
                          value={form.notes}
                          onChange={(v) => setForms((prev) => ({ ...prev, [b.id]: { ...form, notes: v } }))}
                        />
                      </div>
                      <div className="cs-actions">
                        <button
                          type="button"
                          className="av-btn av-btn-primary"
                          disabled={busyId === b.id}
                          onClick={() => void submitRelease(b)}
                        >
                          {busyId === b.id ? <span className="av-spinner" aria-hidden /> : t('csMySubmitRelease')}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="cs-section">
          <span className="cs-section-title">📜 {t('csMyReceiptsTitle')}</span>
          {receipts.length === 0 ? (
            <p className="cs-empty">📜 {t('csMyNoReceipts')}</p>
          ) : (
            <table className="cs-table">
              <thead>
                <tr>
                  <th>{t('csReceiptNumber')}</th>
                  <th>{t('csMyLot')}</th>
                  <th>{t('csMyChamber')}</th>
                  <th>{t('csColFacility')}</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link className="av-link" to={`/storage/receipts/${b.receiptNumber}`}>
                        {b.receiptNumber}
                      </Link>
                    </td>
                    <td>{b.lotNumber}</td>
                    <td>{b.allocatedChamberName ?? b.chamberId}</td>
                    <td>{b.facilityName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
