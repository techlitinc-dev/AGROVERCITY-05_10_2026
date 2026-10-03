import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from '../../components/toast';
import { fetchMyListings, type LandListing } from '../../lib/api/landlord';
import { useT } from '../../lib/i18n';

/** LandBank — land listings list (phase-02 WS-01 task 1.4). */
export default function ListingsPage() {
  const t = useT();
  const [listings, setListings] = useState<LandListing[] | null>(null);

  const load = useCallback(() => {
    fetchMyListings()
      .then(setListings)
      .catch(() => toast(t('llLoadFailed'), { error: true }));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="dash-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>{t('llListingsTitle')}</h3>
        <Link className="av-btn av-btn-primary" style={{ width: 'auto', padding: '0 16px' }} to="/dashboard/p/landlord/listings/new">
          ＋ {t('llNewListing')}
        </Link>
      </div>
      {listings === null ? (
        <p className="dash-empty-line">…</p>
      ) : listings.length === 0 ? (
        <p className="dash-empty-line">🏞️ {t('llEmpty')}</p>
      ) : (
        <div className="dash-grid-3">
          {listings.map((listing) => (
            <div key={listing.id} className="dash-module-card">
              <span className="dash-module-name">
                {listing.village}, {listing.district}
              </span>
              <span className="dash-module-count clear">
                {listing.areaAcres} {t('llAreaAcres')} · ₹{listing.expectedRentRupees}/{t('llMonth')}
              </span>
              {listing.soilType ? (
                <span className="dash-module-count clear">{listing.soilType}</span>
              ) : null}
              <span className={`dash-module-count${listing.status === 'open' ? '' : ' clear'}`}>
                {listing.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
