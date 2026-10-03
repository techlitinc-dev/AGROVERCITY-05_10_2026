import { useCallback, useEffect, useState } from 'react';
import ModalSheet from '../../components/ModalSheet';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  browseLandListings,
  createLeaseRequest,
  type LandListing,
} from '../../lib/api/landlord';
import { useT } from '../../lib/i18n';

/** Farmer-side "land for rent near me" browser (phase-02 WS-01 task 1.19). */
export default function LandBrowsePage() {
  const t = useT();
  const [listings, setListings] = useState<LandListing[] | null>(null);
  const [active, setActive] = useState<LandListing | null>(null);
  const [months, setMonths] = useState('12');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    browseLandListings()
      .then(setListings)
      .catch(() => toast(t('llLoadFailed'), { error: true }));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = async () => {
    if (!active || busy || !Number(months)) return;
    setBusy(true);
    try {
      await createLeaseRequest({
        listingId: active.id,
        message,
        durationMonths: Number(months),
      });
      setActive(null);
      setMessage('');
      toast(t('llStatusPending'));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('llActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dash-section">
      <h3>{t('llBrowseTitle')}</h3>
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
              <span className="dash-module-count clear">{listing.landlordName}</span>
              <button type="button" className="dash-task-open" style={{ marginTop: 6 }}
                onClick={() => setActive(listing)}>
                {t('llApply')}
              </button>
            </div>
          ))}
        </div>
      )}

      <ModalSheet open={active !== null} onClose={() => setActive(null)} title={t('llApply')}>
        <input className="av-input" type="number" placeholder={t('llDurationMonths')} value={months}
          onChange={(e) => setMonths(e.target.value)} />
        <input className="av-input" style={{ marginTop: 8 }} placeholder={t('llApplyMessage')} value={message}
          onChange={(e) => setMessage(e.target.value)} />
        <button type="button" className="av-btn av-btn-primary" style={{ marginTop: 12 }}
          disabled={busy || !Number(months)} onClick={() => void apply()}>
          {busy ? <span className="av-spinner" /> : t('llSubmit')}
        </button>
      </ModalSheet>
    </section>
  );
}
