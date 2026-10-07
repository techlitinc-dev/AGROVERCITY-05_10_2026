import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  bookColdStorage,
  formatRupees,
  listColdStorage,
  type ColdStorageFacility,
} from '../../lib/api/postHarvest';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

interface BookForm {
  quantityQuintals: string;
  fromDate: string;
  months: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY: BookForm = { quantityQuintals: '', fromDate: today(), months: '1' };

/**
 * Cold-storage directory with LIVE remaining capacity (robust.md §7.14, F11).
 * Booking posts to the atomic reservation path (the server decrements capacity
 * transactionally); the capacity shown is always the server's.
 */
export default function ColdStoragePage() {
  const t = useT();
  const [facilities, setFacilities] = useState<ColdStorageFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, BookForm>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setFacilities(await listColdStorage());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const form = (id: string) => forms[id] ?? EMPTY;

  const submit = async (facility: ColdStorageFacility) => {
    const current = form(facility.id);
    const qty = Number(current.quantityQuintals);
    const months = Number(current.months);
    if (!(qty > 0) || !(months >= 1)) {
      toast(t('commonRequired'), { error: true });
      return;
    }
    setBusyId(facility.id);
    try {
      await bookColdStorage(facility.id, {
        quantityQuintals: qty,
        fromDate: current.fromDate,
        months,
      });
      toast(t('coldStorageBooked'));
      setForms((prev) => ({ ...prev, [facility.id]: EMPTY }));
      setOpenId(null);
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('coldStorageBookingFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ToolShell toolId="postHarvest">
      <section className="dash-section">
        <h3>{t('coldStorageTitle')}</h3>
        <p className="trade-hint">{t('coldStorageHint')}</p>
        <div className="trade-actions-row">
          <Link className="av-btn av-btn-ghost" to="/dashboard/p/storageBookings">
            {t('myBookingsTitle')}
          </Link>
          <Link className="av-btn av-btn-ghost" to="/dashboard/p/receiptsVault">
            {t('receiptsVaultTitle')}
          </Link>
          <Link className="av-btn av-btn-ghost" to="/dashboard/p/grading">
            {t('gradingTitle')}
          </Link>
        </div>

        {loading ? <p className="trade-hint">{t('commonLoading')}</p> : null}
        {failed ? <p className="trade-hint">{t('coldStorageLoadFailed')}</p> : null}
        {!loading && !failed && facilities.length === 0 ? (
          <EmptyState icon="❄️" titleKey="coldStorageEmpty" />
        ) : null}

        {facilities.map((facility) => {
          const current = form(facility.id);
          return (
            <div className="trade-card" key={facility.id} style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{facility.name}</span>
                <span className="trade-card-amount">
                  {t('coldStorageCapacityLeft', { available: facility.availableMT })}
                </span>
              </div>
              <p className="trade-card-sub">
                {t('coldStorageDistance', { distance: facility.distanceKm })} ·{' '}
                {t('coldStorageTemp', { range: facility.tempRange })} ·{' '}
                {t('coldStorageRate', { rate: facility.ratePerQuintalMonth })}
              </p>
              <p className="trade-card-sub">
                {facility.district}, {facility.state} · {t('coldStorageSupportedCrops')}:{' '}
                {facility.supportedCrops.join(', ')}
              </p>

              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => setOpenId((prev) => (prev === facility.id ? null : facility.id))}
                >
                  {t('coldStorageBook')}
                </button>
              </div>

              {openId === facility.id ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <LabeledTextField
                      label={t('coldStorageQuantity')}
                      value={current.quantityQuintals}
                      onChange={(value) =>
                        setForms((prev) => ({ ...prev, [facility.id]: { ...current, quantityQuintals: value } }))
                      }
                      type="number"
                      inputMode="decimal"
                      required
                    />
                    <LabeledTextField
                      label={t('coldStorageFrom')}
                      value={current.fromDate}
                      onChange={(value) =>
                        setForms((prev) => ({ ...prev, [facility.id]: { ...current, fromDate: value } }))
                      }
                      type="date"
                      required
                    />
                    <LabeledTextField
                      label={t('coldStorageMonths')}
                      value={current.months}
                      onChange={(value) =>
                        setForms((prev) => ({ ...prev, [facility.id]: { ...current, months: value } }))
                      }
                      type="number"
                      inputMode="numeric"
                      required
                    />
                  </div>
                  <p className="trade-card-sub">
                    {t('coldStorageEstimatedRent', {
                      amount: formatRupees(
                        facility.ratePerQuintalMonth *
                          (Number(current.quantityQuintals) || 0) *
                          (Number(current.months) || 0)
                      ),
                    })}
                  </p>
                  <div className="trade-actions-row">
                    <button
                      type="button"
                      className="av-btn av-btn-primary"
                      disabled={busyId === facility.id}
                      onClick={() => void submit(facility)}
                    >
                      {busyId === facility.id ? <span className="av-spinner" aria-hidden /> : t('coldStorageBookSubmit')}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </section>
    </ToolShell>
  );
}
