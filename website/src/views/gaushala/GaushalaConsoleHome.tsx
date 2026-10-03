import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createGaushalaProfile,
  fmtINR,
  getGaushalaDashboard,
  getMyGaushala,
  type GaushalaDashboard,
  type GaushalaProfile,
} from '../../lib/api/gaushala';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.gaushala';
import '../../lib/i18n/locales/hi.gaushala';
import '../../theme/gaushala.css';

/**
 * Gaushala console home (P8) — first-run setup gate: without a profile (404
 * GAUSHALA_NOT_FOUND) an inline create form renders; with a profile it is the
 * dashboard (stat cards, occupancy bar, by-category chips, quick actions,
 * donations-vs-expenses net for the month).
 */

const QUICK_ACTIONS = [
  { to: '/gaushala/console/cattle', icon: '🐄', labelKey: 'gaushalaQaCattle' },
  { to: '/gaushala/console/adoptions', icon: '🤝', labelKey: 'gaushalaQaAdoptions' },
  { to: '/gaushala/console/donations', icon: '🌾', labelKey: 'gaushalaQaDonations' },
  { to: '/gaushala/console/expenses', icon: '💸', labelKey: 'gaushalaQaExpenses' },
  { to: '/gaushala/console/byproducts', icon: '🪔', labelKey: 'gaushalaQaByproducts' },
  { to: '/gaushala/console/receipts', icon: '🧾', labelKey: 'gaushalaQaReceipts' },
  { to: '/gaushala/console/analytics', icon: '📊', labelKey: 'gaushalaQaAnalytics' },
] as const;

export default function GaushalaConsoleHome() {
  const t = useT();
  useEnsureProfile('dairyManager');

  const [profile, setProfile] = useState<GaushalaProfile | null | undefined>(undefined);
  const [dash, setDash] = useState<GaushalaDashboard | null>(null);
  const [failed, setFailed] = useState(false);

  // Setup form state
  const [name, setName] = useState('');
  const [trustName, setTrustName] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [capacity, setCapacity] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holder, setHolder] = useState('');
  const [eightyG, setEightyG] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadDash = useCallback(() => {
    getGaushalaDashboard()
      .then(setDash)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    getMyGaushala()
      .then((p) => {
        setProfile(p);
        loadDash();
      })
      .catch((e) => {
        if (isApiError(e) && e.status === 404) setProfile(null);
        else setFailed(true);
      });
  }, [loadDash]);

  const submitSetup = async () => {
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const created = await createGaushalaProfile({
        name: name.trim(),
        trustName: trustName.trim(),
        address: address.trim(),
        district: district.trim(),
        phone: phone.trim(),
        capacity: capacity.trim() === '' ? 0 : Math.max(0, Math.floor(Number(capacity)) || 0),
        certifications: eightyG ? { eightyGRegistered: true } : {},
        bankDetails: {
          accountNumber: account.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          holderName: holder.trim(),
        },
      });
      toast(t('gaushalaSetupDone'));
      setProfile(created);
      loadDash();
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else if (isApiError(e) && e.status === 409) {
        // Race: profile appeared between load and submit — adopt it.
        setProfile(null);
        getMyGaushala()
          .then((p) => {
            setProfile(p);
            loadDash();
          })
          .catch(() => setFailed(true));
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="gaushalaConsole" backTo="/dashboard">
      <div className="gaushala-wrap">
        {profile === undefined && !failed ? <p className="gaushala-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <div className="gaushala-empty">
            <span className="gaushala-empty-icon" aria-hidden>
              📡
            </span>
            <p className="gaushala-empty-title">{t('gaushalaLoadFailed')}</p>
            <div className="gaushala-empty-action">
              <button type="button" className="av-btn av-btn-ghost" onClick={() => window.location.reload()}>
                ↻ {t('retry')}
              </button>
            </div>
          </div>
        ) : null}

        {profile === null ? (
          <div className="gaushala-setup">
            <span className="gaushala-section-title">🛕 {t('gaushalaSetupTitle')}</span>
            <p className="gaushala-hint" style={{ marginTop: 0 }}>
              {t('gaushalaSetupBody')}
            </p>
            <div className="gaushala-form" style={{ marginTop: 4 }}>
              <LabeledTextField
                label={t('gaushalaFieldName')}
                value={name}
                onChange={setName}
                error={errors.name}
                required
              />
              <LabeledTextField
                label={t('gaushalaFieldTrust')}
                value={trustName}
                onChange={setTrustName}
                error={errors.trustName}
              />
              <LabeledTextField
                label={t('gaushalaFieldAddress')}
                value={address}
                onChange={setAddress}
                error={errors.address}
              />
              <LabeledTextField
                label={t('gaushalaFieldDistrict')}
                value={district}
                onChange={setDistrict}
                error={errors.district}
              />
              <LabeledTextField
                label={t('gaushalaFieldPhone')}
                value={phone}
                onChange={setPhone}
                type="tel"
                inputMode="tel"
                error={errors.phone}
              />
              <LabeledTextField
                label={t('gaushalaFieldCapacity')}
                value={capacity}
                onChange={setCapacity}
                type="number"
                inputMode="numeric"
                error={errors.capacity}
              />

              <div className="gaushala-section-title" style={{ margin: '10px 0 4px' }}>
                {t('gaushalaBankSection')}
              </div>
              <LabeledTextField
                label={t('gaushalaFieldAccount')}
                value={account}
                onChange={setAccount}
                inputMode="numeric"
                error={errors.accountNumber}
              />
              <LabeledTextField
                label={t('gaushalaFieldIfsc')}
                value={ifsc}
                onChange={setIfsc}
                error={errors.ifsc}
              />
              <LabeledTextField
                label={t('gaushalaFieldHolder')}
                value={holder}
                onChange={setHolder}
                error={errors.holderName}
              />

              <div className="gaushala-section-title" style={{ margin: '10px 0 4px' }}>
                {t('gaushalaCertSection')}
              </div>
              <label className="gaushala-check-row">
                <input type="checkbox" checked={eightyG} onChange={(e) => setEightyG(e.target.checked)} />
                {t('gaushalaCert80g')}
              </label>

              <div className="gaushala-actions">
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => void submitSetup()}
                  disabled={busy}
                >
                  {busy ? <span className="av-spinner" aria-hidden /> : t('gaushalaSetupSubmit')}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {profile ? (
          <>
            <div className="gaushala-section">
              <span className="gaushala-section-title">
                🛕 {t('gaushalaDashSnapshot')} — {profile.name}
              </span>
              <div className="gaushala-stats-grid">
                <div className="gaushala-stat">
                  <div className="gaushala-stat-label">{t('gaushalaStatHeadcount')}</div>
                  <div className="gaushala-stat-value">{dash ? dash.headcount : '—'}</div>
                </div>
                <div className="gaushala-stat">
                  <div className="gaushala-stat-label">{t('gaushalaStatCapacity')}</div>
                  <div className="gaushala-stat-value">
                    {dash ? dash.capacity : '—'}
                    <small> {t('gaushalaHead')}</small>
                  </div>
                  {dash && dash.occupancyPercent !== null ? (
                    <>
                      <div className="gaushala-progress">
                        <div
                          className={`gaushala-progress-fill${dash.occupancyPercent >= 100 ? ' gaushala-progress-full' : ''}`}
                          style={{ width: `${Math.min(100, dash.occupancyPercent)}%` }}
                        />
                      </div>
                      <div className="gaushala-stat-sub">
                        {t('gaushalaDashOccupancy', { occupied: dash.occupancy, capacity: dash.capacity })} ·{' '}
                        {dash.occupancyPercent}%
                      </div>
                    </>
                  ) : (
                    <div className="gaushala-stat-sub">{t('gaushalaDashOccupancyOpen')}</div>
                  )}
                </div>
                <div className="gaushala-stat">
                  <div className="gaushala-stat-label">{t('gaushalaStatActiveAdoptions')}</div>
                  <div className="gaushala-stat-value">{dash ? dash.activeAdoptions : '—'}</div>
                </div>
                <div className="gaushala-stat">
                  <div className="gaushala-stat-label">{t('gaushalaStatDonationsMonth')}</div>
                  <div className="gaushala-stat-value">{dash ? fmtINR(dash.donationsMonthTotal) : '—'}</div>
                </div>
                <div className="gaushala-stat">
                  <div className="gaushala-stat-label">{t('gaushalaStatExpensesMonth')}</div>
                  <div className="gaushala-stat-value">{dash ? fmtINR(dash.expensesMonthTotal) : '—'}</div>
                </div>
              </div>

              {dash ? (
                <div
                  className={`gaushala-net ${
                    dash.donationsMonthTotal - dash.expensesMonthTotal >= 0
                      ? 'gaushala-net-surplus'
                      : 'gaushala-net-burn'
                  }`}
                >
                  <span>{t('gaushalaDashNet')}</span>
                  <span style={{ marginLeft: 'auto' }}>
                    {dash.donationsMonthTotal - dash.expensesMonthTotal >= 0
                      ? t('gaushalaDashNetSurplus', {
                          amount: fmtINR(dash.donationsMonthTotal - dash.expensesMonthTotal),
                        })
                      : t('gaushalaDashNetBurn', {
                          amount: fmtINR(dash.expensesMonthTotal - dash.donationsMonthTotal),
                        })}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="gaushala-section">
              <span className="gaushala-section-title">{t('gaushalaDashCategories')}</span>
              {dash && Object.keys(dash.byCategory).length > 0 ? (
                <div className="gaushala-chip-row" style={{ marginTop: 0 }}>
                  {Object.entries(dash.byCategory).map(([cat, count]) => (
                    <span key={cat} className="gaushala-pill gaushala-pill-ok">
                      {t(`gaushalaLact_${cat}`) === `gaushalaLact_${cat}` ? cat : t(`gaushalaLact_${cat}`)} ·{' '}
                      {count}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="gaushala-hint" style={{ marginTop: 0 }}>
                  {t('gaushalaDashCategoriesEmpty')}
                </p>
              )}
            </div>

            <div className="gaushala-section">
              <span className="gaushala-section-title">{t('gaushalaDashQuick')}</span>
              <div className="gaushala-qa-grid" style={{ marginTop: 0 }}>
                {QUICK_ACTIONS.map((qa) => (
                  <Link key={qa.to} to={qa.to} className="gaushala-qa">
                    <span className="gaushala-qa-icon" aria-hidden>
                      {qa.icon}
                    </span>
                    <span>{t(qa.labelKey)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}
