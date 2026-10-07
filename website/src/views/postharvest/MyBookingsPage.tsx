import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { listMyColdStorageBookings, type MyColdStorageBooking } from '../../lib/api/postHarvest';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * The farmer's cold-storage bookings (robust.md §7.14) — status + slot details
 * from `/users/me/bookings` (shaped under `coldStorage`).
 */
export default function MyBookingsPage() {
  const t = useT();
  const [bookings, setBookings] = useState<MyColdStorageBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setBookings(await listMyColdStorageBookings());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ToolShell toolId="myBookings" backTo="/dashboard/p/postHarvest">
      <section className="dash-section">
        <h3>{t('myBookingsTitle')}</h3>
        {loading ? <p className="trade-hint">{t('commonLoading')}</p> : null}
        {failed ? <p className="trade-hint">{t('myBookingsLoadFailed')}</p> : null}
        {!loading && !failed && bookings.length === 0 ? (
          <EmptyState icon="📦" titleKey="myBookingsEmpty" />
        ) : null}

        {bookings.map((booking) => (
          <div className="trade-card" key={booking.id} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{booking.facilityName}</span>
              <span className="trade-card-amount">{booking.status}</span>
            </div>
            <p className="trade-card-sub">
              {t('myBookingsQty', { qty: booking.quantityQuintals })} ·{' '}
              {t('myBookingsMonths', { months: booking.months })}
            </p>
            <p className="trade-card-sub">
              {t('myBookingsFrom', { date: booking.fromDate })} · {t('myBookingsStatus')}: {booking.status}
            </p>
          </div>
        ))}
      </section>
    </ToolShell>
  );
}
