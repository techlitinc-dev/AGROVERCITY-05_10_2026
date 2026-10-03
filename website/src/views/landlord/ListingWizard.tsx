import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { createListing, fetchMyPlots, type Plot } from '../../lib/api/landlord';
import { useT } from '../../lib/i18n';

const EMPTY = {
  village: '',
  district: '',
  lat: '',
  lng: '',
  areaAcres: '',
  expectedRentRupees: '',
  soilType: '',
  waterSource: '',
  plotId: '',
};

/** LandBank — create-listing wizard (phase-02 WS-01 task 1.4). */
export default function ListingWizard() {
  const t = useT();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchMyPlots()
      .then(setPlots)
      .catch(() => setPlots([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createListing({
        village: form.village,
        district: form.district,
        lat: Number(form.lat),
        lng: Number(form.lng),
        areaAcres: Number(form.areaAcres),
        expectedRentRupees: Number(form.expectedRentRupees),
        soilType: form.soilType || undefined,
        waterSource: form.waterSource || undefined,
        plotId: form.plotId || undefined,
      });
      toast(t('llCreated'));
      navigate('/dashboard/p/landListings');
    } catch (e) {
      toast(isApiError(e) ? e.message : t('llActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const valid =
    form.village && form.district && Number(form.lat) && Number(form.lng) &&
    Number(form.areaAcres) > 0 && Number(form.expectedRentRupees) > 0;

  return (
    <section className="dash-section">
      <h3>{t('llWizardTitle')}</h3>
      <div className="dash-grid-3">
        <input className="av-input" placeholder={t('llVillage')} value={form.village}
          onChange={(e) => setForm({ ...form, village: e.target.value })} />
        <input className="av-input" placeholder={t('llDistrict')} value={form.district}
          onChange={(e) => setForm({ ...form, district: e.target.value })} />
        <input className="av-input" placeholder={t('llAreaAcres')} type="number" value={form.areaAcres}
          onChange={(e) => setForm({ ...form, areaAcres: e.target.value })} />
        <input className="av-input" placeholder={t('llExpectedRent')} type="number" value={form.expectedRentRupees}
          onChange={(e) => setForm({ ...form, expectedRentRupees: e.target.value })} />
        <input className="av-input" placeholder={t('llLat')} value={form.lat}
          onChange={(e) => setForm({ ...form, lat: e.target.value })} />
        <input className="av-input" placeholder={t('llLng')} value={form.lng}
          onChange={(e) => setForm({ ...form, lng: e.target.value })} />
        <input className="av-input" placeholder={t('llSoil')} value={form.soilType}
          onChange={(e) => setForm({ ...form, soilType: e.target.value })} />
        <input className="av-input" placeholder={t('llWaterSource')} value={form.waterSource}
          onChange={(e) => setForm({ ...form, waterSource: e.target.value })} />
        <select className="av-input" value={form.plotId}
          onChange={(e) => setForm({ ...form, plotId: e.target.value })}>
          <option value="">{t('llPlotOptional')}</option>
          {plots.map((plot) => (
            <option key={plot.id} value={plot.id}>{plot.name}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="av-btn av-btn-primary"
        style={{ marginTop: 12 }}
        disabled={busy || !valid}
        onClick={() => void submit()}
      >
        {busy ? <span className="av-spinner" /> : t('llCreate')}
      </button>
    </section>
  );
}
