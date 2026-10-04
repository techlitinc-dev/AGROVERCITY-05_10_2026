import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { fetchEquipmentList, type EquipmentListItem } from '../../lib/api/equipmentOwner';
import { useT } from '../../lib/i18n';
import '../../theme/saas_personas.css';
import '../../theme/trade.css';

const TYPE_FILTERS = ['Tractor', 'Harvester', 'Rotavator', 'Sprayer', 'Thresher'] as const;

const TYPE_LABEL_KEY: Record<(typeof TYPE_FILTERS)[number], string> = {
  Tractor: 'eqTypeTractor',
  Harvester: 'eqTypeHarvester',
  Rotavator: 'eqTypeRotavator',
  Sprayer: 'eqTypeSprayer',
  Thresher: 'eqTypeThresher',
};

/**
 * Farmer machine browse (toolId equipment) — verified machines for hire with
 * a category filter; each card links into the slot calendar / booking flow
 * at /dashboard/p/equipment/:equipmentId/slots.
 */
export default function EquipmentBrowsePage() {
  const t = useT();
  useEnsureProfile('farmer');

  const [machines, setMachines] = useState<EquipmentListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const load = useCallback(
    (type: string | null) => {
      setFailed(false);
      fetchEquipmentList(type ?? undefined)
        .then(setMachines)
        .catch(() => setFailed(true));
    },
    [],
  );

  useEffect(() => {
    load(typeFilter);
  }, [load, typeFilter]);

  return (
    <div className="saas-container" style={{ padding: 0 }}>
      <div className="saas-panel">
        <div className="saas-panel-title">
          <span>{t('eqBrowseTitle')}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button
            type="button"
            className={`saas-btn-secondary ${typeFilter === null ? 'active' : ''}`}
            style={typeFilter === null ? { background: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' } : undefined}
            onClick={() => setTypeFilter(null)}
          >
            {t('eqBrowseFilterAll')}
          </button>
          {TYPE_FILTERS.map((type) => (
            <button
              key={type}
              type="button"
              className="saas-btn-secondary"
              style={typeFilter === type ? { background: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' } : undefined}
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
            >
              {t(TYPE_LABEL_KEY[type])}
            </button>
          ))}
        </div>

        {machines === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <EmptyState
            icon="📡"
            titleKey="tradeLoadFailed"
            action={
              <button type="button" className="saas-btn-secondary" onClick={() => load(typeFilter)}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {machines !== null && machines.length === 0 ? <EmptyState icon="🚜" titleKey="eqNoMachines" /> : null}

        {machines !== null && machines.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '0.875rem',
            }}
          >
            {machines.map((m) => (
              <div
                key={m.id}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{m.name}</span>
                  <span className="saas-badge saas-badge-success">{t('eqVerifiedBadge')}</span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                  {TYPE_LABEL_KEY[m.type as keyof typeof TYPE_LABEL_KEY]
                    ? t(TYPE_LABEL_KEY[m.type as keyof typeof TYPE_LABEL_KEY])
                    : m.type}
                  {' · '}
                  <span className={`saas-badge ${m.ownerType === 'fpo' ? 'saas-badge-info' : 'saas-badge-warning'}`}>
                    {m.ownerType === 'fpo' ? t('eqOwnerBadgeFpo') : t('eqOwnerBadgePrivate')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{t('eqRatePerHour', { rate: m.hourlyRate })}</span>
                  {m.perAcreRate ? (
                    <span style={{ color: '#94a3b8' }}>{t('eqRatePerAcre', { rate: m.perAcreRate })}</span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span>{t('eqDistanceAway', { km: m.distanceKm })}</span>
                  {m.ratingAvg !== null && m.ratingAvg !== undefined ? (
                    <span>
                      {t('eqRatingValue', { rating: m.ratingAvg })}
                      {m.ratingCount ? ` ${t('eqRatingCount', { count: m.ratingCount })}` : ''}
                    </span>
                  ) : null}
                </div>
                <div style={{ marginTop: '0.25rem' }}>
                  <Link
                    to={`/dashboard/p/equipment/${m.id}/slots`}
                    className="saas-btn-primary"
                    style={{ textDecoration: 'none', fontSize: '0.8125rem' }}
                  >
                    {t('eqViewSlots')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
