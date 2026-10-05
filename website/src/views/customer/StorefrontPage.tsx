import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { getStorefront, type FarmerStorefront } from '../../lib/api/emarketCustomer';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Farmer storefront (WS-03 task 3.4, spec S1/S2) — every available lot from one
 * `farmerId` plus the farmer's rating and verified credentials. The farmerId
 * linkage is printed on the header and on every lot row (global rule 2).
 * Route: /dashboard/p/storefront/:farmerId
 */
export default function StorefrontPage() {
  const t = useT();
  const { farmerId = '' } = useParams();
  const [storefront, setStorefront] = useState<FarmerStorefront | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!farmerId) return;
    setFailed(false);
    getStorefront(farmerId)
      .then(setStorefront)
      .catch(() => {
        setStorefront(null);
        setFailed(true);
        toast(t('emarketLoadFailed'), { error: true });
      });
  }, [farmerId, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ToolShell toolId="storefront">
      <section className="dash-section">
        <h3>{t('emarketStorefrontTitle')}</h3>
        {failed ? (
          <p className="dash-empty-line">{t('emarketLoadFailed')}</p>
        ) : storefront === null ? (
          <p className="dash-empty-line">{t('emarketLoading')}</p>
        ) : (
          <div style={{ display: 'grid', gap: 4 }}>
            <strong style={{ fontSize: 18 }}>{storefront.farmerName}</strong>
            <div style={{ fontSize: 13, color: '#6B7280' }}>
              {t('emarketFarmerId')}: {storefront.farmerId} • {t('emarketRating')}:{' '}
              {storefront.farmerRating === null ? t('commonNotAvailable') : storefront.farmerRating}
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{t('emarketCredentials')}</div>
              {storefront.credentials.length === 0 ? (
                <p className="dash-empty-line">{t('emarketNoCredentials')}</p>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {storefront.credentials.map((credential) => (
                    <span key={credential.type} className="av-chip" style={{ fontSize: 12 }}>
                      ✅ {credential.type}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="dash-section">
        <h3>{t('emarketBrowse')}</h3>
        {storefront === null ? (
          <p className="dash-empty-line">{t('emarketLoading')}</p>
        ) : storefront.lots.length === 0 ? (
          <p className="dash-empty-line">🌾 {t('emarketNoLots')}</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {storefront.lots.map((lot) => (
              <div
                key={lot.lotId}
                style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 10, display: 'grid', gap: 4 }}
              >
                <strong>{lot.crop}</strong>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  {t('emarketFarmerId')}: {lot.farmerId}
                </div>
                <div>
                  {t('emarketPricePerQuintal', { price: (lot.pricePaisa / 100).toFixed(2) })}
                </div>
                <div style={{ fontSize: 13 }}>
                  {t('emarketGrade')}: {lot.grade} • {t('emarketAvailableQty', { count: lot.qtyAvailable })}
                </div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  {t('emarketHarvestDate')}: {lot.harvestDate}
                  {lot.freshnessDays === null
                    ? ''
                    : ` • ${
                        lot.freshnessDays === 0
                          ? t('emarketFreshToday')
                          : t('emarketFreshDays', { count: lot.freshnessDays })
                      }`}
                </div>
              </div>
            ))}
          </div>
        )}
        <Link className="av-btn" to="/dashboard/p/browse" style={{ marginTop: 12, display: 'inline-block' }}>
          {t('emarketBrowse')}
        </Link>
      </section>
    </ToolShell>
  );
}
