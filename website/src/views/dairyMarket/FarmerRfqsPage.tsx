import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { listOpenDemands, type DairyDemand } from '../../lib/api/dairyMarketplace';
import { useT } from '../../lib/i18n';
import '../../theme/dairy-ops.css';

export default function FarmerRfqsPage({ embedded }: { embedded?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const [demands, setDemands] = useState<DairyDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    listOpenDemands()
      .then((data) => {
        if (mounted) setDemands(data || []);
      })
      .catch((err) => {
        if (mounted) setError(err?.response?.data?.error?.message || t('dairyLoadFailed'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [t]);

  const content = (
    <div className="dairy-rfqs-page" style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{t('dairyFarmerRfqsTitle')}</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>{t('dairyFarmerRfqsSub')}</p>
        </div>
      </div>

      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>{t('dairyLoading')}</div>}
      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {!loading && !error && demands.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem' }}>{t('dairyNoDemands')}</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {demands.map((demand) => (
          <div
            key={demand.id}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: '#e0f2fe',
                    color: '#0369a1',
                    marginBottom: '0.5rem',
                  }}
                >
                  {demand.milkType}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{demand.managerName}</h3>
                {demand.procurementZone && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                    {demand.procurementZone}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a' }}>
                  ₹{demand.targetRatePerLiter}/{t('dairyLiterUnit')}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  {demand.dailyQuantityLiters} {t('dairyLitersDaily')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#4b5563', borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem' }}>
              <div>
                <span style={{ color: '#9ca3af' }}>{t('dairyFat')}: </span>
                <span style={{ fontWeight: 600 }}>≥{demand.minFatPercent}%</span>
              </div>
              <div>
                <span style={{ color: '#9ca3af' }}>{t('dairySnf')}: </span>
                <span style={{ fontWeight: 600 }}>≥{demand.minSnfPercent}%</span>
              </div>
              {demand.recurringFrequency && (
                <div>
                  <span style={{ color: '#9ca3af' }}>{t('dairyFrequency')}: </span>
                  <span style={{ fontWeight: 600 }}>{demand.recurringFrequency}</span>
                </div>
              )}
            </div>

            {demand.notes && (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>
                "{demand.notes}"
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => navigate(`/dairy-market/bids/compare/${demand.id}`)}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('dairyCompareBids')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (embedded) return content;
  return <ToolShell toolId="dairyFarmerRfqs">{content}</ToolShell>;
}
