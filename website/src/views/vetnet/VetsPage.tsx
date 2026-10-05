import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModalSheet from '../../components/ModalSheet';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { fmtINR } from '../../lib/api/dairy';
import { deactivateManagedVet, listManagedVets, type ManagedVet } from '../../lib/api/vetnet';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.vetnet';
import '../../lib/i18n/locales/hi.vetnet';
import '../../theme/vetnet.css';
import EmptyState from './components/EmptyState';
import VetTabs from './components/VetTabs';

/** Managed vets directory (P9) — search, emergency filter, edit + soft delete. */
export default function VetsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const [vets, setVets] = useState<ManagedVet[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [deleting, setDeleting] = useState<ManagedVet | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listManagedVets({ pageSize: 500 })
      .then((res) => setVets(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (vets ?? []).filter((v) => {
      if (emergencyOnly && !v.emergencyAvailable) return false;
      if (!q) return true;
      const hay = [v.name, v.qualification, ...(v.specializations ?? []), ...(v.serviceDistricts ?? [])]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [vets, query, emergencyOnly]);

  const confirmDelete = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await deactivateManagedVet(deleting.id);
      toast(t('vetnetVetDeactivated'));
      setDeleting(null);
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="vetNetwork" backTo="/dashboard">
      <div className="vetnet-wrap">
        <VetTabs />

        <div className="vetnet-actions" style={{ marginTop: 4 }}>
          <button type="button" className="av-btn av-btn-primary" onClick={() => navigate('/vetnet/vets/new')}>
            ＋ {t('vetnetAddVet')}
          </button>
        </div>

        <div className="vetnet-filter">
          <input
            className="av-input"
            value={query}
            placeholder={t('vetnetVetsSearch')}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="vetnet-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
            <button
              type="button"
              className={`av-chip${emergencyOnly ? ' selected' : ''}`}
              onClick={() => setEmergencyOnly((v) => !v)}
            >
              🚨 {t('vetnetEmergencyOnly')}
            </button>
          </div>
        </div>

        {vets === null && !failed ? <p className="vetnet-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <EmptyState
            icon="📡"
            titleKey="vetnetLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {vets !== null && visible.length === 0 ? (
          <EmptyState
            icon="🩺"
            titleKey="vetnetVetsEmpty"
            bodyKey="vetnetVetsEmptyBody"
            action={
              <button type="button" className="av-btn av-btn-primary" onClick={() => navigate('/vetnet/vets/new')}>
                ＋ {t('vetnetAddVet')}
              </button>
            }
          />
        ) : null}

        <div className="vetnet-list">
          {visible.map((v) => (
            <div
              key={v.id}
              className="vetnet-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/vetnet/vets/new?id=${v.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/vetnet/vets/new?id=${v.id}`);
              }}
            >
              <div className="vetnet-card-row">
                <span className="vetnet-card-title">{v.name}</span>
                <span className={`vetnet-pill ${v.status === 'active' ? 'vetnet-pill-ok' : 'vetnet-pill-grey'}`}>
                  {t(`vetnetStatus_${v.status}`)}
                </span>
              </div>
              {v.credentialStatus === 'pending' ? (
                <div className="vetnet-card-row">
                  <span className="vetnet-pill vetnet-pill-warn">⚠ {t('vetnetVerificationPending')}</span>
                </div>
              ) : null}
              <div className="vetnet-card-row">
                <span className="vetnet-card-sub">
                  {[v.qualification, v.experienceYears > 0 ? t('vetnetExpYears', { years: v.experienceYears }) : '']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {v.ratingAvg !== null && v.ratingAvg !== undefined ? (
                  <span className="vetnet-pill vetnet-pill-warn">
                    {t('vetnetRatingLine', { rating: v.ratingAvg.toFixed(1), count: v.ratingCount })}
                  </span>
                ) : (
                  <span className="vetnet-card-sub">{t('vetnetNoRating')}</span>
                )}
              </div>
              {v.specializations?.length ? (
                <div className="vetnet-mini-chips">
                  {v.specializations.map((s) => (
                    <span key={s} className="vetnet-mini-chip">
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="vetnet-card-sub">
                {t('vetnetFeesLabel')}: {fmtINR(v.feeClinic)} {t('vetnetVisit_clinic')} · {fmtINR(v.feeFarm)}{' '}
                {t('vetnetVisit_farm')} · {fmtINR(v.feeTele)} {t('vetnetVisit_tele')}
              </div>
              {v.serviceDistricts?.length ? (
                <div className="vetnet-card-sub">
                  {t('vetnetDistrictsLabel')}: {v.serviceDistricts.join(' · ')}
                </div>
              ) : null}
              {v.languages?.length ? (
                <div className="vetnet-card-sub">
                  {t('vetnetLanguagesLabel')}: {v.languages.join(' · ')}
                </div>
              ) : null}
              <div className="vetnet-card-row">
                <span>
                  {v.emergencyAvailable ? (
                    <span className="vetnet-pill vetnet-pill-bad">🚨 {t('vetnetEmergencyBadge')}</span>
                  ) : null}{' '}
                  <span
                    className={`vetnet-pill ${v.claimed ? 'vetnet-pill-ok' : 'vetnet-pill-grey'}`}
                    style={{ marginLeft: 6 }}
                  >
                    {v.claimed ? t('vetnetClaimed') : t('vetnetUnclaimed')}
                  </span>
                </span>
                {v.status === 'active' ? (
                  <button
                    type="button"
                    className="av-btn av-btn-plain"
                    style={{ background: 'var(--av-error)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(v);
                    }}
                  >
                    {t('vetnetDeactivateVet')}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ModalSheet open={deleting !== null} onClose={() => !busy && setDeleting(null)} title={t('vetnetDeactivateVet')}>
        <p className="vetnet-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          {t('vetnetDeactivateVetBody')}
        </p>
        <div className="vetnet-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="av-btn av-btn-plain"
            style={{ background: 'var(--av-error)' }}
            onClick={() => void confirmDelete()}
            disabled={busy}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('vetnetDeactivateVet')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setDeleting(null)} disabled={busy}>
            {t('commonCancel')}
          </button>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
