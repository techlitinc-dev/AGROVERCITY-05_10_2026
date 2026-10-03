import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { fmtL, listAnimals, type Animal, type AnimalSpecies, type HealthStatus, type LactationStatus } from '../../lib/api/animals';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.animals';
import '../../lib/i18n/locales/hi.animals';
import '../../theme/animals.css';
import AnimalsEmpty from './AnimalsEmpty';
import { fmtAge } from './animalsUtils';

type SpeciesFilter = 'all' | AnimalSpecies;
type HealthFilter = 'all' | HealthStatus;
type LactFilter = 'all' | LactationStatus;

const SPECIES: AnimalSpecies[] = ['cow', 'buffalo', 'goat'];
const HEALTHS: HealthStatus[] = ['healthy', 'under_treatment', 'quarantined'];
const LACTATIONS: LactationStatus[] = ['lactating', 'dry', 'pregnant', 'heifer', 'calf'];

const PILL_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  healthy: { bg: '#e8f5e9', fg: '#1b5e20', border: '#a5d6a7' },
  under_treatment: { bg: '#fef3c7', fg: '#b45309', border: '#fde68a' },
  quarantined: { bg: '#fee2e2', fg: '#dc2626', border: '#fecaca' },
  lactating: { bg: '#e8f5e9', fg: '#1b5e20', border: '#a5d6a7' },
  pregnant: { bg: '#fdf2f8', fg: '#9d174d', border: '#f9a8d4' },
  heifer: { bg: '#f5f7fa', fg: '#334155', border: '#e2e8f0' },
  calf: { bg: '#f5f7fa', fg: '#334155', border: '#e2e8f0' },
  dry: { bg: '#fef3c7', fg: '#b45309', border: '#fde68a' },
};

const pillStyle = (key: string): CSSProperties => {
  const c = PILL_COLORS[key] ?? { bg: '#f5f7fa', fg: '#334155', border: '#e2e8f0' };
  return { background: c.bg, color: c.fg, borderColor: c.border };
};

/** Herd registry home (P10) — stats, search + species/health/lactation filters, animal cards. */
export default function AnimalsHomePage() {
  const t = useT();

  const [animals, setAnimals] = useState<Animal[] | null>(null);
  const [failed, setFailed] = useState(false);

  const [search, setSearch] = useState('');
  const [species, setSpecies] = useState<SpeciesFilter>('all');
  const [health, setHealth] = useState<HealthFilter>('all');
  const [lact, setLact] = useState<LactFilter>('all');

  const load = useCallback(() => {
    setFailed(false);
    listAnimals({ pageSize: 500 })
      .then((res) => setAnimals(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const stats = useMemo(() => {
    const all = animals ?? [];
    const yielding = all.filter((a) => a.dailyYieldLiters > 0);
    return {
      total: all.length,
      lactating: all.filter((a) => a.lactationStatus === 'lactating').length,
      treatment: all.filter((a) => a.healthStatus === 'under_treatment').length,
      avgYield: yielding.length > 0 ? yielding.reduce((s, a) => s + a.dailyYieldLiters, 0) / yielding.length : 0,
    };
  }, [animals]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (animals ?? []).filter(
      (a) =>
        (!q || a.tagId.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)) &&
        (species === 'all' || a.species === species) &&
        (health === 'all' || a.healthStatus === health) &&
        (lact === 'all' || a.lactationStatus === lact)
    );
  }, [animals, search, species, health, lact]);

  return (
    <ToolShell toolId="livestock" backTo="/dashboard">
      <div className="animals-wrap">
        <div className="animals-stats-grid">
          <div className="animals-stat">
            <div className="animals-stat-label">{t('animalsStatTotal')}</div>
            <div className="animals-stat-value">{stats.total}</div>
          </div>
          <div className="animals-stat">
            <div className="animals-stat-label">{t('animalsStatLactating')}</div>
            <div className="animals-stat-value">{stats.lactating}</div>
          </div>
          <div className="animals-stat">
            <div className="animals-stat-label">{t('animalsStatTreatment')}</div>
            <div className="animals-stat-value">{stats.treatment}</div>
          </div>
          <div className="animals-stat">
            <div className="animals-stat-label">{t('animalsStatAvgYield')}</div>
            <div className="animals-stat-value">
              {fmtL(stats.avgYield)} <small>L</small>
            </div>
          </div>
        </div>

        <input
          className="av-input animals-search"
          type="search"
          value={search}
          placeholder={t('animalsSearchPlaceholder')}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="animals-filter-label">{t('animalsFilterSpecies')}</div>
        <div className="animals-chip-row">
          <button type="button" className={`av-chip${species === 'all' ? ' selected' : ''}`} onClick={() => setSpecies('all')}>
            {t('animalsAll')}
          </button>
          {SPECIES.map((s) => (
            <button
              key={s}
              type="button"
              className={`av-chip${species === s ? ' selected' : ''}`}
              onClick={() => setSpecies(s)}
            >
              {t(`animalsSpecies_${s}`)}
            </button>
          ))}
        </div>

        <div className="animals-filter-label">{t('animalsFilterHealth')}</div>
        <div className="animals-chip-row">
          <button type="button" className={`av-chip${health === 'all' ? ' selected' : ''}`} onClick={() => setHealth('all')}>
            {t('animalsAll')}
          </button>
          {HEALTHS.map((h) => (
            <button
              key={h}
              type="button"
              className={`av-chip${health === h ? ' selected' : ''}`}
              onClick={() => setHealth(h)}
            >
              {t(`animalsHealth_${h}`)}
            </button>
          ))}
        </div>

        <div className="animals-filter-label">{t('animalsFilterLactation')}</div>
        <div className="animals-chip-row">
          <button type="button" className={`av-chip${lact === 'all' ? ' selected' : ''}`} onClick={() => setLact('all')}>
            {t('animalsAll')}
          </button>
          {LACTATIONS.map((l) => (
            <button
              key={l}
              type="button"
              className={`av-chip${lact === l ? ' selected' : ''}`}
              onClick={() => setLact(l)}
            >
              {t(`animalsLact_${l}`)}
            </button>
          ))}
        </div>

        <div className="animals-actions">
          <Link to="/livestock/animals/new" className="av-btn av-btn-primary" style={{ textAlign: 'center' }}>
            ＋ {t('animalsRegister')}
          </Link>
        </div>

        {animals === null && !failed ? <p className="animals-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <AnimalsEmpty
            icon="📡"
            titleKey="animalsLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {animals !== null && animals.length === 0 ? (
          <AnimalsEmpty
            icon="🐄"
            titleKey="animalsEmpty"
            bodyKey="animalsEmptyBody"
            action={
              <Link to="/livestock/animals/new" className="av-btn av-btn-primary" style={{ textAlign: 'center' }}>
                ＋ {t('animalsRegister')}
              </Link>
            }
          />
        ) : null}

        {animals !== null && animals.length > 0 && visible.length === 0 ? (
          <AnimalsEmpty icon="🔍" titleKey="animalsNoMatch" />
        ) : null}

        <div className="animals-list">
          {visible.map((a) => (
            <Link key={a.id} to={`/livestock/animals/${a.id}`} className="animals-card">
              <div className="animals-card-row">
                <span className="animals-tag">#{a.tagId}</span>
                <span className="animals-pill" style={pillStyle(a.healthStatus)}>
                  {t(`animalsHealth_${a.healthStatus}`)}
                </span>
              </div>
              <div className="animals-card-row">
                <span className="animals-card-title">{a.name}</span>
                <span className="animals-card-sub">
                  {a.breed} · {t(`animalsSpecies_${a.species}`)}
                </span>
              </div>
              <div className="animals-card-row">
                <span className="animals-pill" style={pillStyle(a.lactationStatus)}>
                  {t(`animalsLact_${a.lactationStatus}`)}
                </span>
                <span className="animals-card-amount">
                  {fmtL(a.dailyYieldLiters)} <small style={{ fontSize: 12 }}>L</small>
                </span>
                <span className="animals-card-sub">{fmtAge(a.ageMonths, t)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </ToolShell>
  );
}
