import { useCallback, useEffect, useMemo, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  listProviderBookings,
  releaseProviderBooking,
  type ColdStorageBooking,
} from '../../lib/api/coldStorage';
import { isApiError } from '../../lib/api/client';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.coldstorage';
import '../../lib/i18n/locales/hi.coldstorage';
import './coldstorage.css';

interface ReleaseForm {
  releaseQuintals: string;
  vehicleNumber: string;
  driverName: string;
  gatePassRemarks: string;
  amountPaid: string;
}

/**
 * Release workflow — execute gate-pass releases against the farmer's
 * `request-release`, then list released lots with timestamps.
 */
export default function ReleasePage() {
  const t = useT();
  const [bookings, setBookings] = useState<ColdStorageBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, ReleaseForm>>({});

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    listProviderBookings({ pageSize: 100 })
      .then((page) => setBookings(page.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pending = useMemo(() => bookings.filter((b) => b.status === 'release_requested'), [bookings]);
  const released = useMemo(() => bookings.filter((b) => !!b.outwardDate), [bookings]);

  const formFor = (b: ColdStorageBooking): ReleaseForm =>
    forms[b.id] ?? {
      releaseQuintals: String(b.releaseRequest?.requestedQuintals ?? b.remainingQuintals ?? ''),
      vehicleNumber: b.releaseRequest?.vehicleNumber ?? '',
      driverName: '',
      gatePassRemarks: '',
      amountPaid: '',
    };

  const setField = (id: string, key: keyof ReleaseForm, value: string) =>
    setForms((prev) => ({ ...prev, [id]: { ...formFor(bookings.find((b) => b.id === id)!), [key]: value } }));

  const execute = async (b: ColdStorageBooking) => {
    if (busyId) return;
    const form = formFor(b);
    const qty = Number(form.releaseQuintals);
    if (Number.isNaN(qty) || qty <= 0) {
      toast(t('commonRequired'), { error: true });
      return;
    }
    setBusyId(b.id);
    try {
      await releaseProviderBooking(b.id, {
        releaseQuintals: qty,
        vehicleNumber: form.vehicleNumber.trim() || undefined,
        driverName: form.driverName.trim() || undefined,
        gatePassRemarks: form.gatePassRemarks.trim() || undefined,
        amountPaid: form.amountPaid.trim() === '' ? 0 : Number(form.amountPaid),
      });
      toast(t('csReleaseDone'));
      setForms((prev) => {
        const next = { ...prev };
        delete next[b.id];
        return next;
      });
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ToolShell toolId="coldStorageHome" backTo="/dashboard">
      <div className="cs-wrap">
        <div className="cs-section">
          <span className="cs-section-title">🚚 {t('csReleasePending')}</span>
          {loading ? <p className="cs-hint">{t('commonLoading')}</p> : null}
          {failed ? <p className="cs-hint">{t('csLoadFailed')}</p> : null}
          {!loading && !failed && pending.length === 0 ? (
            <p className="cs-empty">🚚 {t('csReleaseEmpty')}</p>
          ) : null}
          <div className="cs-list">
            {pending.map((b) => {
              const form = formFor(b);
              return (
                <div key={b.id} className="cs-card">
                  <div className="cs-row-head">
                    <strong>
                      {b.farmerName} · {b.cropName}
                    </strong>
                    <span className="cs-pill cs-pill-warn">{t('csReleaseRequested')}</span>
                  </div>
                  <div className="cs-hint">
                    {b.facilityName} · {t('csReleaseRequested')}: {b.releaseRequest?.requestedQuintals} {t('csUnitQuintals')} ·{' '}
                    {b.releaseRequest?.pickupDate} · {t('csMyLot')}: {b.lotNumber ?? '—'}
                  </div>
                  <div className="cs-field-grid">
                    <LabeledTextField label={t('csReleaseQty')} value={form.releaseQuintals} onChange={(v) => setField(b.id, 'releaseQuintals', v)} type="number" inputMode="decimal" required />
                    <LabeledTextField label={t('csReleaseVehicle')} value={form.vehicleNumber} onChange={(v) => setField(b.id, 'vehicleNumber', v)} />
                    <LabeledTextField label={t('csReleaseDriver')} value={form.driverName} onChange={(v) => setField(b.id, 'driverName', v)} />
                    <LabeledTextField label={t('csReleaseRemarks')} value={form.gatePassRemarks} onChange={(v) => setField(b.id, 'gatePassRemarks', v)} />
                    <LabeledTextField label={t('csReleaseAmount')} value={form.amountPaid} onChange={(v) => setField(b.id, 'amountPaid', v)} type="number" inputMode="decimal" />
                  </div>
                  <div className="cs-actions">
                    <button
                      type="button"
                      className="av-btn av-btn-primary"
                      disabled={busyId === b.id}
                      onClick={() => void execute(b)}
                    >
                      {busyId === b.id ? <span className="av-spinner" aria-hidden /> : t('csReleaseExecute')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cs-section">
          <span className="cs-section-title">{t('csReleaseReleasedLots')}</span>
          {released.length === 0 ? (
            <p className="cs-empty">🚚 {t('csReleaseEmpty')}</p>
          ) : (
            <table className="cs-table">
              <thead>
                <tr>
                  <th>{t('csColFarmer')}</th>
                  <th>{t('csReleaseGatePass')}</th>
                  <th>{t('csReleaseReleased')}</th>
                  <th>{t('csReleaseRemaining')}</th>
                  <th>{t('csColStatus')}</th>
                  <th>{t('csInwardColTime')}</th>
                </tr>
              </thead>
              <tbody>
                {released.map((b) => {
                  const label = t(`csStatus_${b.status}`);
                  return (
                    <tr key={b.id}>
                      <td>
                        {b.farmerName}
                        <div className="cs-hint">{b.cropName}</div>
                      </td>
                      <td>{b.gatePassNumber}</td>
                      <td>{b.outwardReleasedQuintals} {t('csUnitQuintals')}</td>
                      <td>{b.remainingQuintals} {t('csUnitQuintals')}</td>
                      <td>
                        <span className={`cs-pill ${b.status === 'released' ? 'cs-pill-ok' : 'cs-pill-warn'}`}>
                          {label === `csStatus_${b.status}` ? b.status : label}
                        </span>
                      </td>
                      <td>{b.outwardDate?.slice(0, 16).replace('T', ' ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
