import { useCallback, useEffect, useState } from 'react';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { createPlot, fetchMyPlots, type Plot } from '../../lib/api/landlord';
import { useT } from '../../lib/i18n';

const EMPTY = { name: '', village: '', district: '', areaAcres: '', gatNumber: '', soilType: '' };

/** LandBank — plots list + add-plot form (phase-02 WS-01 task 1.3). */
export default function PlotsPage() {
  const t = useT();
  const [plots, setPlots] = useState<Plot[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchMyPlots()
      .then(setPlots)
      .catch(() => toast(t('llLoadFailed'), { error: true }));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createPlot({
        name: form.name,
        village: form.village,
        district: form.district,
        areaAcres: Number(form.areaAcres),
        gatNumber: form.gatNumber || undefined,
        soilType: form.soilType || undefined,
      });
      setForm(EMPTY);
      toast(t('llCreated'));
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('llActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dash-section">
      <div className="dash-module-card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>{t('llAddPlot')}</h3>
        <div className="dash-grid-3">
          <input className="av-input" placeholder={t('llPlotName')} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="av-input" placeholder={t('llVillage')} value={form.village}
            onChange={(e) => setForm({ ...form, village: e.target.value })} />
          <input className="av-input" placeholder={t('llDistrict')} value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })} />
          <input className="av-input" placeholder={t('llAreaAcres')} type="number" value={form.areaAcres}
            onChange={(e) => setForm({ ...form, areaAcres: e.target.value })} />
          <input className="av-input" placeholder={t('llGat')} value={form.gatNumber}
            onChange={(e) => setForm({ ...form, gatNumber: e.target.value })} />
          <input className="av-input" placeholder={t('llSoil')} value={form.soilType}
            onChange={(e) => setForm({ ...form, soilType: e.target.value })} />
        </div>
        <button
          type="button"
          className="av-btn av-btn-primary"
          style={{ marginTop: 10 }}
          disabled={busy || !form.name || !form.village || !form.district || !Number(form.areaAcres)}
          onClick={() => void submit()}
        >
          {busy ? <span className="av-spinner" /> : t('llSave')}
        </button>
      </div>

      <h3>{t('llPlotsTitle')}</h3>
      {plots === null ? (
        <p className="dash-empty-line">…</p>
      ) : plots.length === 0 ? (
        <p className="dash-empty-line">🌾 {t('llEmpty')}</p>
      ) : (
        <div className="dash-grid-3">
          {plots.map((plot) => (
            <div key={plot.id} className="dash-module-card">
              <span className="dash-module-name">{plot.name}</span>
              <span className="dash-module-count clear">
                {plot.village} · {plot.areaAcres} {t('llAreaAcres')}
                {plot.gatNumber ? ` · ${t('llGat')} ${plot.gatNumber}` : ''}
              </span>
              <span className={`dash-module-count${plot.status === 'vacant' ? ' clear' : ''}`}>
                {plot.status === 'vacant' ? t('llStatusVacant') : t('llStatusLeased')}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
