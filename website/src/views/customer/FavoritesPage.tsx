import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  addFavoriteSupplier,
  createSubscription,
  deleteSubscription,
  fetchFavoriteSuppliers,
  getSubscriptions,
  type CustomerSubscription,
  type FavoriteSupplier,
  type SubscriptionFrequency,
} from '../../lib/api/emarketCustomer';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const FREQUENCIES: Array<{ key: SubscriptionFrequency; labelKey: string }> = [
  { key: 'daily', labelKey: 'emarketFrequencyDaily' },
  { key: 'weekly', labelKey: 'emarketFrequencyWeekly' },
  { key: 'seasonal', labelKey: 'emarketFrequencySeasonal' },
];

/** ₹ → integer paisa (money is integer paisa everywhere on the rail). */
function paisaFromRupees(value: string): number {
  return Math.round(Number(value) * 100);
}

/**
 * Favorites + standing demands (WS-03 task 3.9, spec C2) — favorite suppliers
 * via GET/POST /v1/customer/suppliers/favorites and the subscription layer
 * (crop, grade, qty, target price band, delivery window, recurring frequency)
 * over the selected favorite farmers, with the next run date rendered.
 */
export default function FavoritesPage() {
  const t = useT();
  const [favorites, setFavorites] = useState<FavoriteSupplier[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[] | null>(null);
  const [favoriteForm, setFavoriteForm] = useState({
    farmerId: '',
    farmerName: '',
    primaryCrops: '',
    location: '',
  });
  const [subForm, setSubForm] = useState({
    crop: '',
    grade: 'A',
    qtyKg: '',
    bandMin: '',
    bandMax: '',
    deliveryWindow: 'Weekly, 8am-11am',
    frequency: 'weekly' as SubscriptionFrequency,
  });
  const [selectedFarmers, setSelectedFarmers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchFavoriteSuppliers()
      .then(setFavorites)
      .catch(() => {
        setFavorites([]);
        toast(t('emarketLoadFailed'), { error: true });
      });
    getSubscriptions()
      .then(setSubscriptions)
      .catch(() => {
        setSubscriptions([]);
        toast(t('emarketLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddFavorite = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await addFavoriteSupplier({
        farmerId: favoriteForm.farmerId.trim(),
        farmerName: favoriteForm.farmerName.trim(),
        primaryCrops: favoriteForm.primaryCrops
          .split(',')
          .map((crop) => crop.trim())
          .filter(Boolean),
        location: favoriteForm.location.trim(),
      });
      setFavoriteForm({ farmerId: '', farmerName: '', primaryCrops: '', location: '' });
      toast(t('emarketFavoriteAdded'));
      load();
    } catch {
      toast(t('emarketActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const toggleFarmer = (farmerId: string) => {
    setSelectedFarmers((current) =>
      current.includes(farmerId) ? current.filter((id) => id !== farmerId) : [...current, farmerId]
    );
  };

  const handleCreateSubscription = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedFarmers.length === 0) return;
    setBusy(true);
    try {
      await createSubscription({
        farmerIds: selectedFarmers,
        crop: subForm.crop.trim(),
        grade: subForm.grade.trim(),
        qtyKg: Number(subForm.qtyKg),
        targetPriceBandPaisa: {
          min: paisaFromRupees(subForm.bandMin),
          max: paisaFromRupees(subForm.bandMax),
        },
        deliveryWindow: subForm.deliveryWindow,
        frequency: subForm.frequency,
      });
      setSubForm({ ...subForm, crop: '', qtyKg: '', bandMin: '', bandMax: '' });
      setSelectedFarmers([]);
      toast(t('emarketSubscriptionCreated'));
      load();
    } catch {
      toast(t('emarketSubscriptionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSubscription = async (subscriptionId: string) => {
    try {
      await deleteSubscription(subscriptionId);
      toast(t('emarketSubscriptionCancelled'));
      load();
    } catch {
      toast(t('emarketSubscriptionFailed'), { error: true });
    }
  };

  return (
    <ToolShell toolId="favorites">
      <section className="dash-section">
        <h3>{t('emarketFavorites')}</h3>
        {favorites === null ? (
          <p className="dash-empty-line">{t('emarketLoading')}</p>
        ) : favorites.length === 0 ? (
          <p className="dash-empty-line">⭐ {t('emarketNoFavorites')}</p>
        ) : (
          favorites.map((favorite) => (
            <div
              key={favorite.id}
              style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gap: 4 }}
            >
              <strong>{favorite.farmerName}</strong>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                {t('emarketFarmerId')}: {favorite.farmerId}
                {favorite.location ? ` • ${t('emarketLocation')}: ${favorite.location}` : ''}
                {favorite.primaryCrops.length > 0 ? ` • ${favorite.primaryCrops.join(', ')}` : ''}
              </div>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedFarmers.includes(favorite.farmerId)}
                  onChange={() => toggleFarmer(favorite.farmerId)}
                />
                {t('emarketSelectFarmers')}
              </label>
            </div>
          ))
        )}
      </section>

      <section className="dash-section">
        <h3>{t('emarketAddFavorite')}</h3>
        <form onSubmit={handleAddFavorite} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <input
            className="av-input"
            placeholder={t('emarketFarmerId')}
            value={favoriteForm.farmerId}
            onChange={(e) => setFavoriteForm({ ...favoriteForm, farmerId: e.target.value })}
            required
          />
          <input
            className="av-input"
            placeholder={t('emarketFarmerName')}
            value={favoriteForm.farmerName}
            onChange={(e) => setFavoriteForm({ ...favoriteForm, farmerName: e.target.value })}
            required
          />
          <input
            className="av-input"
            placeholder={t('emarketPrimaryCrops')}
            value={favoriteForm.primaryCrops}
            onChange={(e) => setFavoriteForm({ ...favoriteForm, primaryCrops: e.target.value })}
          />
          <input
            className="av-input"
            placeholder={t('emarketLocation')}
            value={favoriteForm.location}
            onChange={(e) => setFavoriteForm({ ...favoriteForm, location: e.target.value })}
          />
          <button type="submit" className="av-btn" disabled={busy}>
            {t('emarketAddFavorite')}
          </button>
        </form>
      </section>

      <section className="dash-section">
        <h3>{t('emarketSubscriptions')}</h3>
        <form
          onSubmit={handleCreateSubscription}
          style={{ display: 'grid', gap: 8, maxWidth: 420, marginBottom: 12 }}
        >
          <input
            className="av-input"
            placeholder={t('emarketCrop')}
            value={subForm.crop}
            onChange={(e) => setSubForm({ ...subForm, crop: e.target.value })}
            required
          />
          <input
            className="av-input"
            placeholder={t('emarketGrade')}
            value={subForm.grade}
            onChange={(e) => setSubForm({ ...subForm, grade: e.target.value })}
          />
          <input
            className="av-input"
            type="number"
            step="0.1"
            placeholder={t('emarketQuantityKg')}
            value={subForm.qtyKg}
            onChange={(e) => setSubForm({ ...subForm, qtyKg: e.target.value })}
            required
          />
          <input
            className="av-input"
            type="number"
            step="0.01"
            placeholder={t('emarketTargetBandMin')}
            value={subForm.bandMin}
            onChange={(e) => setSubForm({ ...subForm, bandMin: e.target.value })}
            required
          />
          <input
            className="av-input"
            type="number"
            step="0.01"
            placeholder={t('emarketTargetBandMax')}
            value={subForm.bandMax}
            onChange={(e) => setSubForm({ ...subForm, bandMax: e.target.value })}
            required
          />
          <input
            className="av-input"
            placeholder={t('emarketDeliveryWindow')}
            value={subForm.deliveryWindow}
            onChange={(e) => setSubForm({ ...subForm, deliveryWindow: e.target.value })}
          />
          <select
            className="av-input"
            value={subForm.frequency}
            onChange={(e) =>
              setSubForm({ ...subForm, frequency: e.target.value as SubscriptionFrequency })
            }
          >
            {FREQUENCIES.map((frequency) => (
              <option key={frequency.key} value={frequency.key}>
                {t(frequency.labelKey)}
              </option>
            ))}
          </select>
          <button type="submit" className="av-btn" disabled={busy || selectedFarmers.length === 0}>
            {t('emarketCreateSubscription')}
          </button>
        </form>

        {subscriptions === null ? (
          <p className="dash-empty-line">{t('emarketLoading')}</p>
        ) : subscriptions.length === 0 ? (
          <p className="dash-empty-line">🔁 {t('emarketNoSubscriptions')}</p>
        ) : (
          subscriptions.map((subscription) => (
            <div
              key={subscription.id}
              style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gap: 4 }}
            >
              <strong>
                {subscription.crop} • {subscription.qtyKg} {t('emarketQuantityKg')}
              </strong>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                {t('emarketSelectFarmers')}: {subscription.farmerIds.join(', ')}
              </div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                {t('emarketFrequency')}: {t(
                  FREQUENCIES.find((item) => item.key === subscription.frequency)?.labelKey ??
                    'emarketFrequencyWeekly'
                )}{' '}
                • {t('emarketNextRun')}: {subscription.nextRunAt}
              </div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                {t('emarketSubscriptionStatus')}:{' '}
                {subscription.status === 'active'
                  ? t('emarketStatusActive')
                  : t('emarketStatusCancelled')}
              </div>
              <button
                type="button"
                className="av-btn"
                style={{ justifySelf: 'start' }}
                onClick={() => handleDeleteSubscription(subscription.id)}
              >
                {t('emarketCancel')}
              </button>
            </div>
          ))
        )}
      </section>
    </ToolShell>
  );
}
