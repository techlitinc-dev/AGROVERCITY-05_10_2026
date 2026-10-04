import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { acceptBid, listBids, type DairyBid } from '../../lib/api/dairyMarketplace';
import { useT } from '../../lib/i18n';
import '../../theme/dairy-ops.css';

export default function BidComparePage({ embedded }: { embedded?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const params = useParams<{ demandId?: string }>();
  const [searchParams] = useSearchParams();
  const demandId = params.demandId || searchParams.get('demandId') || '';

  const [bids, setBids] = useState<DairyBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    listBids(demandId)
      .then((data) => {
        if (mounted) setBids(data || []);
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
  }, [demandId, t]);

  const handleAccept = async (bidId: string) => {
    try {
      setAcceptingId(bidId);
      setError(null);
      const res = await acceptBid(bidId);
      if (res?.purchase?.id) {
        navigate(`/dashboard/p/purchases/${res.purchase.id}`);
      } else {
        navigate('/dashboard/p/purchases');
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: { message?: string } } } };
      setError(errObj?.response?.data?.error?.message || t('dairyActionFailed'));
      setAcceptingId(null);
    }
  };

  const content = (
    <div className="dairy-bid-compare-page" style={{ padding: '1rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              cursor: 'pointer',
              fontSize: '0.9rem',
              padding: 0,
              marginBottom: '0.5rem',
            }}
          >
            ← {t('dairyBack')}
          </button>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{t('dairyBidCompareTitle')}</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
            {demandId ? `${t('dairyDemandId')}: ${demandId}` : t('dairyAllBids')}
          </p>
        </div>
      </div>

      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>{t('dairyLoading')}</div>}
      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {!loading && !error && bids.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem' }}>{t('dairyNoBids')}</p>
        </div>
      )}

      {!loading && bids.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {bids.map((bid) => (
            <div
              key={bid.id}
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: bid.status === 'accepted' ? '#dcfce7' : '#f3f4f6',
                      color: bid.status === 'accepted' ? '#15803d' : '#374151',
                    }}
                  >
                    {t(`dairy_status_${bid.status}`)}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    {bid.pickupSlot || t('dairyStandardPickup')}
                  </span>
                </div>

                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 600 }}>
                  {bid.farmerName}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', margin: '1rem 0' }}>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('dairyOfferedRate')}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#16a34a' }}>
                      ₹{bid.offeredRatePerLiter}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('dairyDailyQuantity')}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                      {bid.dailyLiters} {t('dairyLiterUnit')}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div>
                    <span style={{ color: '#9ca3af' }}>{t('dairyMilkType')}: </span>
                    <span style={{ fontWeight: 500 }}>{bid.milkType}</span>
                  </div>
                  {bid.transportIncluded !== undefined && (
                    <div>
                      <span style={{ color: '#9ca3af' }}>{t('dairyTransport')}: </span>
                      <span style={{ fontWeight: 500 }}>
                        {bid.transportIncluded ? t('dairyTransportIncluded') : t('dairyTransportExcluded')}
                      </span>
                    </div>
                  )}
                  {bid.negotiationRound > 1 && (
                    <div>
                      <span style={{ color: '#9ca3af' }}>{t('dairyRound')}: </span>
                      <span style={{ fontWeight: 500 }}>{bid.negotiationRound}</span>
                    </div>
                  )}
                  {bid.terms && (
                    <div style={{ marginTop: '0.5rem', fontStyle: 'italic', color: '#6b7280' }}>
                      "{bid.terms}"
                    </div>
                  )}
                </div>
              </div>

              <div>
                {bid.status === 'accepted' ? (
                  <button
                    type="button"
                    disabled
                    style={{
                      width: '100%',
                      background: '#e2e8f0',
                      color: '#64748b',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.6rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'not-allowed',
                    }}
                  >
                    {t('dairyBidAccepted')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={acceptingId === bid.id}
                    onClick={() => handleAccept(bid.id)}
                    style={{
                      width: '100%',
                      background: acceptingId === bid.id ? '#93c5fd' : '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.6rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: acceptingId === bid.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {acceptingId === bid.id ? t('dairyAccepting') : t('dairyAcceptBid')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (embedded) return content;
  return <ToolShell toolId="dairyBidCompare">{content}</ToolShell>;
}
