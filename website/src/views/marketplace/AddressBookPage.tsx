import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
  type Address,
  type AddressPayload,
} from '../../lib/api/marketplace';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Address book (phase-05 WS-03 task 3.9, X6) — CRUD over /addresses with a
 * set-default action. Writes carry Idempotency-Key (via client).
 */
const EMPTY_FORM: AddressPayload = {
  label: '',
  line1: '',
  village: '',
  district: '',
  state: '',
  pincode: '',
  lat: null,
  lng: null,
  isDefault: false,
};

export default function AddressBookPage() {
  const t = useT();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<AddressPayload>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setAddresses(await listAddresses());
    } catch {
      setAddresses([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!/^\d{6}$/.test(form.pincode)) {
      toast(t('marketplaceAddressPincodeInvalid'), { error: true });
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await updateAddress(editingId, form);
      } else {
        await createAddress(form);
      }
      toast(t('marketplaceAddressSaved'));
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (address: Address) => {
    try {
      await updateAddress(address.id, { ...address, isDefault: true });
      await load();
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    }
  };

  const remove = async (address: Address) => {
    if (confirmDeleteId !== address.id) {
      setConfirmDeleteId(address.id);
      return;
    }
    setConfirmDeleteId(null);
    try {
      await deleteAddress(address.id);
      toast(t('marketplaceAddressDeleted'));
      await load();
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    }
  };

  const field = (key: keyof AddressPayload, labelKey: string, type = 'text') => (
    <label className="trade-field">
      <span className="trade-hint">{t(labelKey)}</span>
      <input
        type={type}
        value={(form[key] as string | number | null | undefined)?.toString() ?? ''}
        onChange={(e) =>
          setForm((current) => ({
            ...current,
            [key]: key === 'lat' || key === 'lng' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value,
          }))
        }
      />
    </label>
  );

  return (
    <ToolShell toolId="marketplace">
      <section className="dash-section">
        <h3>{t('marketplaceAddresses')}</h3>

        {addresses.length === 0 ? (
          <EmptyState icon="📒" titleKey="marketplaceAddressEmpty" bodyKey="marketplaceAddressEmptyBody" />
        ) : (
          addresses.map((address) => (
            <div className="trade-card" key={address.id} style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{address.label}</span>
                {address.isDefault ? (
                  <span className="trade-pill">{t('marketplaceAddressDefaultBadge')}</span>
                ) : null}
              </div>
              <p className="trade-card-sub">
                {address.line1}, {address.village}, {address.district}, {address.state} — {address.pincode}
              </p>
              <div className="trade-actions-row">
                {!address.isDefault ? (
                  <button type="button" className="av-btn av-btn-ghost" onClick={() => void setDefault(address)}>
                    {t('marketplaceAddressSetDefault')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => {
                    setEditingId(address.id);
                    setForm({ ...address });
                  }}
                >
                  {t('marketplaceAddressEdit')}
                </button>
                <button type="button" className="av-btn av-btn-plain" onClick={() => void remove(address)}>
                  {confirmDeleteId === address.id ? t('marketplaceAddressDeleteConfirm') : t('marketplaceRemove')}
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="dash-section">
        <h3>{editingId ? t('marketplaceAddressEdit') : t('marketplaceAddressNew')}</h3>
        {field('label', 'marketplaceAddressLabel')}
        {field('line1', 'marketplaceAddressLine1')}
        {field('village', 'marketplaceAddressVillage')}
        {field('district', 'marketplaceAddressDistrict')}
        {field('state', 'marketplaceAddressState')}
        {field('pincode', 'marketplaceAddressPincode')}
        {field('lat', 'marketplaceAddressLat', 'number')}
        {field('lng', 'marketplaceAddressLng', 'number')}
        <label className="trade-field">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm((current) => ({ ...current, isDefault: e.target.checked }))}
          />{' '}
          {t('marketplaceAddressIsDefault')}
        </label>
        <div className="trade-actions">
          <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={() => void save()}>
            {t('marketplaceAddressSave')}
          </button>
        </div>
      </section>
    </ToolShell>
  );
}
