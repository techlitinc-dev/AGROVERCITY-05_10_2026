import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { isApiError } from '../../lib/api/client';
import { listGaushalaCattle, type Animal, type CattleSpecies, type CattleStatus } from '../../lib/api/gaushala';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.gaushala';
import '../../lib/i18n/locales/hi.gaushala';
import '../../theme/gaushala.css';

const SPECIES_FILTERS: { value: CattleSpecies | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'commonAll' },
  { value: 'cow', labelKey: 'gaushalaSpecies_cow' },
  { value: 'buffalo', labelKey: 'gaushalaSpecies_buffalo' },
  { value: 'goat', labelKey: 'gaushalaSpecies_goat' },
];

const STATUS_FILTERS: { value: CattleStatus | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'commonAll' },
  { value: 'in-shelter', labelKey: 'gaushala_status_in_shelter' },
  { value: 'adopted-out', labelKey: 'gaushala_status_adopted_out' },
  { value: 'deceased', labelKey: 'gaushala_status_deceased' },
  { value: 'transferred', labelKey: 'gaushala_status_transferred' },
];

const STATUS_COLORS: Record<string, string> = {
  'in-shelter': '#16A34A',
  'adopted-out': '#0D9488',
  deceased: '#DC2626',
  transferred: '#D97706',
};

/** Cattle inventory (P8) — search + species/status chips (client-side), cards open the animal. */
export default function CattlePage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const [animals, setAnimals] = useState<Animal[] | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState<CattleSpecies | 'all'>('all');
  const [status, setStatus] = useState<CattleStatus | 'all'>('all');

  const load = useCallback(() => {
    setFailed(false);
    setNeedsSetup(false);
    listGaushalaCattle({ pageSize: 500 })
      .then((res) => setAnimals(res.data))
      .catch((e) => {
        if (isApiError(e) && e.status === 404) setNeedsSetup(true);
        else setFailed(true);
      });
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (animals ?? []).filter((a) => {
      if (species !== 'all' && a.species !== species) return false;
      if (status !== 'all' && a.cattleStatus !== status) return false;
      if (!q) return true;
      return (
        a.tagId.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.breed.toLowerCase().includes(q)
      );
    });
  }, [animals, query, species, status]);

  const setupPrompt = (
    <div className="gaushala-empty">
      <span className="gaushala-empty-icon" aria-hidden>
        🛕
      </span>
      <p className="gaushala-empty-title">{t('gaushalaCattleSetupFirst')}</p>
      <p className="gaushala-empty-body">{t('gaushalaCattleSetupBody')}</p>
      <div className="gaushala-empty-action">
        <button type="button" className="av-btn av-btn-primary" onClick={() => navigate('/gaushala/console')}>
          {t('gaushalaCattleSetupCta')}
        </button>
      </div>
    </div>
  );

  return (
    <ToolShell toolId="gaushalaConsole" backTo="/gaushala/console">
      <div className="gaushala-wrap">
        {needsSetup ? (
          setupPrompt
        ) : (
          <>
            <div className="gaushala-actions" style={{ marginTop: 4 }}>
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => navigate('/gaushala/console/cattle/new')}
              >
                ＋ {t('gaushalaCattleNew')}
              </button>
            </div>

            <input
              className="av-input"
              style={{ marginTop: 12 }}
              placeholder={t('gaushalaCattleSearch')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div className="gaushala-chip-row">
              {SPECIES_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`av-chip${species === f.value ? ' selected' : ''}`}
                  onClick={() => setSpecies(f.value)}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>
            <div className="gaushala-chip-row" style={{ marginTop: 0 }}>
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`av-chip${status === f.value ? ' selected' : ''}`}
                  onClick={() => setStatus(f.value)}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>

            {animals === null && !failed ? <p className="gaushala-hint">{t('commonLoading')}</p> : null}

            {failed ? (
              <div className="gaushala-empty">
                <span className="gaushala-empty-icon" aria-hidden>
                  📡
                </span>
                <p className="gaushala-empty-title">{t('gaushalaLoadFailed')}</p>
                <div className="gaushala-empty-action">
                  <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                    ↻ {t('retry')}
                  </button>
                </div>
              </div>
            ) : null}

            {animals !== null && visible.length === 0 ? (
              <div className="gaushala-empty">
                <span className="gaushala-empty-icon" aria-hidden>
                  🐄
                </span>
                <p className="gaushala-empty-title">{t('gaushalaCattleEmpty')}</p>
                <p className="gaushala-empty-body">{t('gaushalaCattleEmptyBody')}</p>
              </div>
            ) : null}

            <div className="gaushala-list">
              {visible.map((a) => {
                const color = STATUS_COLORS[a.cattleStatus] ?? '#64748B';
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`gaushala-card${a.cattleStatus === 'deceased' ? ' gaushala-deceased' : ''}`}
                    onClick={() => navigate(`/gaushala/console/cattle/${a.id}`)}
                  >
                    <span className="gaushala-card-row">
                      <span className="gaushala-card-title">
                        {a.name}{' '}
                        <span className="gaushala-card-sub">
                          · {t(`gaushalaSpecies_${a.species}`) !== `gaushalaSpecies_${a.species}`
                            ? t(`gaushalaSpecies_${a.species}`)
                            : a.species}
                        </span>
                      </span>
                      <span
                        className="gaushala-pill"
                        style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
                      >
                        {t(`gaushala_status_${a.cattleStatus}`) !== `gaushala_status_${a.cattleStatus}`
                          ? t(`gaushala_status_${a.cattleStatus}`)
                          : a.cattleStatus}
                      </span>
                    </span>
                    <span className="gaushala-card-sub">
                      {a.tagId} · {a.breed}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </ToolShell>
  );
}
