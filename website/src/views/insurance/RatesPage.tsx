import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  fmtRupees,
  getRates,
  paisaToRupees,
  rupeesToPaisa,
  updateRates,
  type CropPremiumRate,
} from '../../lib/api/insurance';
import { useT } from '../../lib/i18n';
import InsEmptyState from './components/InsEmptyState';
import './insurance.css';

/**
 * Provider self-service rate-table editor (POST /insurance/provider/rates).
 * Carries the endpoint's effective-dating field (`cutoffDate`) and renders the
 * existing rate table from GET /insurance/rates. The sum-insured-per-acre
 * money input is held as integer paisa and shown in ₹.
 *
 * The *admin* rate approval editor is superadmin module 15 → phase-07.
 */

const SEASONS: Array<'Kharif' | 'Rabi' | 'Annual'> = ['Kharif', 'Rabi', 'Annual'];
const CATEGORIES = ['crop', 'livestock', 'weather', 'equipment'];

export default function RatesPage() {
  const t = useT();
  useEnsureProfile('insuranceProvider');

  const [rates, setRates] = useState<CropPremiumRate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [cropName, setCropName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [season, setSeason] = useState<'Kharif' | 'Rabi' | 'Annual'>('Kharif');
  const [sumInsuredPaisa, setSumInsuredPaisa] = useState(0);
  const [farmerShare, setFarmerShare] = useState('');
  const [actuarialRate, setActuarialRate] = useState('');
  const [cutoffDate, setCutoffDate] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    getRates()
      .then(setRates)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const submit = async () => {
    const farmerSharePercent = Number(farmerShare);
    const totalActuarialRatePercent = Number(actuarialRate);
    if (!cropName.trim()) {
      toast(t('insRateCropRequired'), { error: true });
      return;
    }
    if (sumInsuredPaisa <= 0) {
      toast(t('insRateSumInsuredRequired'), { error: true });
      return;
    }
    if (!Number.isFinite(farmerSharePercent) || !Number.isFinite(totalActuarialRatePercent)) {
      toast(t('insRatePercentInvalid'), { error: true });
      return;
    }
    if (!cutoffDate) {
      toast(t('insRateCutoffRequired'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await updateRates({
        cropName: cropName.trim(),
        category,
        season,
        sumInsuredPerAcre: paisaToRupees(sumInsuredPaisa),
        farmerSharePercent,
        totalActuarialRatePercent,
        cutoffDate,
      });
      toast(t('insRateSaved'));
      setCropName('');
      setSumInsuredPaisa(0);
      setFarmerShare('');
      setActuarialRate('');
      setCutoffDate('');
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('insActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="insuranceProviderHome" backTo="/insurance/console">
      <div className="ins-wrap">
        <div className="ins-section">
          <span className="ins-section-title">🏷️ {t('insRatesTitle')}</span>
          <p className="ins-hint">{t('insRatesSub')}</p>

          <div className="ins-form">
            <div className="av-field">
              <label className="av-label">{t('insRateCrop')}</label>
              <input className="av-input" value={cropName} onChange={(e) => setCropName(e.target.value)} />
            </div>
            <div className="ins-grid-2">
              <div className="av-field">
                <label className="av-label">{t('insRateCategory')}</label>
                <select className="av-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`insRateCategory_${c}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="av-field">
                <label className="av-label">{t('insRateSeason')}</label>
                <select
                  className="av-input"
                  value={season}
                  onChange={(e) => setSeason(e.target.value as 'Kharif' | 'Rabi' | 'Annual')}
                >
                  {SEASONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="av-field">
              <label className="av-label">{t('insRateSumInsured')}</label>
              <input
                className="av-input"
                type="number"
                min={0}
                value={paisaToRupees(sumInsuredPaisa)}
                onChange={(e) => setSumInsuredPaisa(rupeesToPaisa(Number(e.target.value)))}
              />
              <span className="ins-hint">{t('insRateSumInsuredHint', { amount: fmtRupees(paisaToRupees(sumInsuredPaisa)) })}</span>
            </div>
            <div className="ins-grid-2">
              <div className="av-field">
                <label className="av-label">{t('insRateFarmerShare')}</label>
                <input className="av-input" type="number" value={farmerShare} onChange={(e) => setFarmerShare(e.target.value)} />
              </div>
              <div className="av-field">
                <label className="av-label">{t('insRateActuarial')}</label>
                <input className="av-input" type="number" value={actuarialRate} onChange={(e) => setActuarialRate(e.target.value)} />
              </div>
            </div>
            <div className="av-field">
              <label className="av-label">{t('insRateCutoff')}</label>
              <input className="av-input" type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} />
            </div>
            <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={() => void submit()}>
              {busy ? <span className="av-spinner" /> : t('insRateSave')}
            </button>
          </div>
        </div>

        <div className="ins-section">
          <span className="ins-section-title">📑 {t('insRatesExisting')}</span>
          {failed ? (
            <InsEmptyState
              icon="📡"
              titleKey="insLoadFailed"
              action={
                <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                  ↻ {t('retry')}
                </button>
              }
            />
          ) : null}
          {rates === null && !failed ? <p className="ins-hint">{t('commonLoading')}</p> : null}
          {rates !== null && rates.length === 0 ? <InsEmptyState icon="🏷️" titleKey="insRatesEmpty" /> : null}
          {rates !== null && rates.length > 0 ? (
            <div className="ins-table-wrap">
              <table className="ins-table">
                <thead>
                  <tr>
                    <th>{t('insRateCrop')}</th>
                    <th>{t('insRateSeason')}</th>
                    <th>{t('insRateSumInsured')}</th>
                    <th>{t('insRateFarmerShare')}</th>
                    <th>{t('insRateCutoff')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => (
                    <tr key={rate.id}>
                      <td>{rate.cropName}</td>
                      <td>{rate.season}</td>
                      <td>{fmtRupees(rate.sumInsuredPerAcre)}</td>
                      <td>{rate.farmerSharePercent}%</td>
                      <td>{rate.cutoffDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </ToolShell>
  );
}
