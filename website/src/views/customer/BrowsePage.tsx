import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  browseNearMe,
  checkoutCart,
  type CartLine,
  type LogisticsMode,
  type NearMeLot,
  type NearbySort,
} from '../../lib/api/emarketCustomer';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const SORTS: Array<{ key: NearbySort; labelKey: string }> = [
  { key: 'distance', labelKey: 'emarketSortDistance' },
  { key: 'price', labelKey: 'emarketSortPrice' },
  { key: 'grade', labelKey: 'emarketSortGrade' },
  { key: 'rating', labelKey: 'emarketSortRating' },
  { key: 'freshness', labelKey: 'emarketSortFreshness' },
];

const LOGISTICS_MODES: LogisticsMode[] = ['farmer_delivery', 'customer_pickup', 'platform_transport'];

const LOGISTICS_LABEL_KEYS: Record<LogisticsMode, string> = {
  farmer_delivery: 'emarketLogisticsFarmerDelivery',
  customer_pickup: 'emarketLogisticsCustomerPickup',
  platform_transport: 'emarketLogisticsPlatformTransport',
};

/** ₹ label from integer paisa — never invents a value when the field is absent. */
function rupeesFromPaisa(paisa: number): string {
  return (paisa / 100).toFixed(2);
}

/**
 * Produce near me (WS-03 tasks 3.3 + 3.12, spec S3) — GET
 * /v1/customer/browse/near-me ranked by price, distance, grade match, rating or
 * freshness. Every card links to the farmer storefront and carries the
 * `farmerId` linkage (global rule 2). Lots can be dropped into the C6 cart,
 * which splits one checkout into per-farmer child orders.
 */
export default function BrowsePage() {
  const t = useT();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [crop, setCrop] = useState('');
  const [sort, setSort] = useState<NearbySort>('distance');
  const [radiusKm, setRadiusKm] = useState('50');
  const [lots, setLots] = useState<NearMeLot[] | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => undefined,
      { timeout: 8000 }
    );
  }, []);

  const load = useCallback(() => {
    if (!coords) return;
    const radius = Number(radiusKm);
    browseNearMe({
      lat: coords.lat,
      lng: coords.lng,
      crop: crop.trim() ? crop.trim() : undefined,
      sort,
      radiusKm: Number.isFinite(radius) && radius > 0 ? radius : undefined,
    })
      .then((res) => setLots(res.data))
      .catch(() => {
        setLots([]);
        toast(t('emarketLoadFailed'), { error: true });
      });
  }, [coords, crop, radiusKm, sort, t]);

  useEffect(() => {
    load();
  }, [load]);

  const addToCart = (lot: NearMeLot) => {
    setCart((current) => {
      const existing = current.find((line) => line.lotId === lot.lotId);
      if (existing) {
        return current.map((line) =>
          line.lotId === lot.lotId ? { ...line, qty: line.qty + 1 } : line
        );
      }
      return [
        ...current,
        { farmerId: lot.farmerId, lotId: lot.lotId, qty: 1, logisticsMode: 'customer_pickup' },
      ];
    });
  };

  const setLineMode = (lotId: string, logisticsMode: LogisticsMode) => {
    setCart((current) => current.map((line) => (line.lotId === lotId ? { ...line, logisticsMode } : line)));
  };

  const handleCheckout = async () => {
    setBusy(true);
    try {
      const result = await checkoutCart(cart);
      setCart([]);
      toast(`${t('emarketCheckoutDone')} — ${result.orders.length} ${t('emarketChildOrder')}`);
    } catch {
      toast(t('emarketActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const freshnessChip = (lot: NearMeLot) =>
    lot.freshnessDays === null
      ? null
      : lot.freshnessDays === 0
        ? t('emarketFreshToday')
        : t('emarketFreshDays', { count: lot.freshnessDays });

  return (
    <ToolShell toolId="browse">
      <section className="dash-section">
        <h3>{t('emarketBrowseTitle')}</h3>
        {coords === null ? (
          <div>
            <p className="dash-empty-line">{t('emarketLocationNeeded')}</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const lat = Number(manualLat);
                const lng = Number(manualLng);
                if (Number.isFinite(lat) && Number.isFinite(lng)) setCoords({ lat, lng });
              }}
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
            >
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{t('emarketLatLabel')}</span>
                <input
                  className="av-input"
                  type="number"
                  step="0.0001"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  required
                />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{t('emarketLngLabel')}</span>
                <input
                  className="av-input"
                  type="number"
                  step="0.0001"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="av-btn">
                {t('emarketLoad')}
              </button>
            </form>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              load();
            }}
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
          >
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{t('emarketCropFilter')}</span>
              <input className="av-input" value={crop} onChange={(e) => setCrop(e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{t('emarketSortBy')}</span>
              <select
                className="av-input"
                value={sort}
                onChange={(e) => setSort(e.target.value as NearbySort)}
              >
                {SORTS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{t('emarketRadiusKm')}</span>
              <input
                className="av-input"
                type="number"
                min="1"
                value={radiusKm}
                onChange={(e) => setRadiusKm(e.target.value)}
              />
            </label>
            <button type="submit" className="av-btn">
              {t('emarketLoad')}
            </button>
          </form>
        )}
      </section>

      <section className="dash-section">
        {lots === null ? (
          <p className="dash-empty-line">{t('emarketLoading')}</p>
        ) : lots.length === 0 ? (
          <p className="dash-empty-line">🌾 {t('emarketNoLots')}</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {lots.map((lot) => (
              <div
                key={lot.lotId}
                style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 10, display: 'grid', gap: 4 }}
              >
                <strong>{lot.crop}</strong>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  {lot.farmerName} • {t('emarketFarmerId')}: {lot.farmerId}
                </div>
                <div>{t('emarketPricePerQuintal', { price: rupeesFromPaisa(lot.pricePaisa) })}</div>
                <div style={{ fontSize: 13 }}>
                  {t('emarketDistanceKm', { count: lot.distanceKm.toFixed(1) })} • {t('emarketGrade')}:{' '}
                  {lot.grade} • {t('emarketRating')}:{' '}
                  {lot.farmerRating === null ? t('commonNotAvailable') : lot.farmerRating}
                </div>
                <div style={{ fontSize: 13 }}>{t('emarketAvailableQty', { count: lot.qtyAvailable })}</div>
                {freshnessChip(lot) ? (
                  <span className="av-chip" style={{ fontSize: 12 }}>
                    🕒 {freshnessChip(lot)}
                  </span>
                ) : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  <Link className="av-btn" to={`/dashboard/p/storefront/${lot.farmerId}`}>
                    {t('emarketViewStorefront')}
                  </Link>
                  <button type="button" className="av-btn" onClick={() => addToCart(lot)}>
                    {t('emarketAddToCart')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dash-section">
        <h3>
          {t('emarketCart')} ({cart.length})
        </h3>
        {cart.length === 0 ? (
          <p className="dash-empty-line">🛒 {t('emarketCartEmpty')}</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {cart.map((line) => (
              <div
                key={line.lotId}
                style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <span style={{ fontSize: 13 }}>
                  {line.lotId} • {t('emarketFarmerId')}: {line.farmerId} • {t('emarketQuantityQuintals')}:{' '}
                  {line.qty}
                </span>
                <select
                  className="av-input"
                  value={line.logisticsMode}
                  onChange={(e) => setLineMode(line.lotId, e.target.value as LogisticsMode)}
                >
                  {LOGISTICS_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {t(LOGISTICS_LABEL_KEYS[mode])}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="av-btn"
                  onClick={() => setCart((current) => current.filter((item) => item.lotId !== line.lotId))}
                >
                  {t('emarketRemoveFromCart')}
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="av-btn" disabled={busy} onClick={handleCheckout}>
                {t('emarketCheckout')}
              </button>
            </div>
          </div>
        )}
      </section>
    </ToolShell>
  );
}
