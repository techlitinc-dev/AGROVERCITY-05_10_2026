import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LabeledTextField from '../../../components/LabeledTextField';
import SegmentedControl from '../../../components/SegmentedControl';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { toast } from '../../../components/toast';
import { isApiError } from '../../../lib/api/client';
import {
  createCustomer,
  listCustomers,
  updateCustomer,
  type CustomerType,
  type EntityStatus,
  type MilkSaleCustomer,
  type MilkSaleCustomerInput,
} from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import '../../../lib/i18n/locales/en.dairy-sales';
import '../../../lib/i18n/locales/hi.dairy-sales';
import '../../../theme/dairy-sales.css';
import EmptyState from '../components/EmptyState';

/**
 * Create / edit milk-sale customer. Edit mode is addressed as
 * `/dairy/console/sales/customers/new?id=<customerId>` (no dedicated
 * :customerId route); the customer is resolved from the center's book.
 */
export default function CustomerFormPage() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('id');
  const isEdit = Boolean(customerId);
  useEnsureProfile('dairyManager');

  const [customer, setCustomer] = useState<MilkSaleCustomer | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<CustomerType>('household');
  const [address, setAddress] = useState('');
  const [route, setRoute] = useState('');
  const [dailyAm, setDailyAm] = useState('');
  const [dailyPm, setDailyPm] = useState('');
  const [rate, setRate] = useState('');
  const [status, setStatus] = useState<EntityStatus>('active');

  useEffect(() => {
    if (!customerId) return;
    listCustomers({ pageSize: 500 })
      .then((res) => {
        const found = res.data.find((c) => c.id === customerId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setCustomer(found);
        setName(found.name);
        setPhone(found.phone || '');
        setType(found.type);
        setAddress(found.address || '');
        setRoute(found.route || '');
        setDailyAm(found.dailyLitersAM > 0 ? String(found.dailyLitersAM) : '');
        setDailyPm(found.dailyLitersPM > 0 ? String(found.dailyLitersPM) : '');
        setRate(String(found.ratePerLiter));
        setStatus(found.status);
      })
      .catch(() => setNotFound(true));
  }, [customerId]);

  const save = async () => {
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = t('commonRequired');
    if (!(Number(rate) > 0)) nextErrors.ratePerLiter = t('dairyCustomerRateInvalid');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    const payload: MilkSaleCustomerInput = {
      name: name.trim(),
      phone: phone.trim(),
      type,
      address: address.trim(),
      route: route.trim(),
      dailyLitersAM: Number(dailyAm) || 0,
      dailyLitersPM: Number(dailyPm) || 0,
      ratePerLiter: Number(rate),
      status,
    };
    try {
      if (isEdit && customerId) await updateCustomer(customerId, payload);
      else await createCustomer(payload);
      toast(t(isEdit ? 'dairyCustomerUpdated' : 'dairyCustomerCreated'));
      navigate('/dairy/console/sales/customers', { replace: true });
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else if (isApiError(e) && e.status === 404) {
        setNotFound(true);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <ToolShell toolId="dairyConsole" backTo="/dairy/console/sales/customers">
        <EmptyState
          icon="🔍"
          titleKey="dairyCustomerNotFound"
          action={
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={() => navigate('/dairy/console/sales/customers')}
            >
              ← {t('dairyQaCustomers')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console/sales/customers">
      <div className="dairy-wrap">
        {isEdit && !customer ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

        <div className="dairy-form">
          <LabeledTextField
            label={t('dairyMemberName')}
            value={name}
            onChange={setName}
            error={errors.name}
            required
          />
          <LabeledTextField
            label={t('dairyCustomerPhone')}
            value={phone}
            onChange={setPhone}
            type="tel"
            inputMode="tel"
            error={errors.phone}
          />

          <div className="av-field">
            <label className="av-label">{t('dairyCustomerType')}</label>
            <SegmentedControl<CustomerType>
              value={type}
              onChange={setType}
              options={[
                { value: 'household', label: t('dairySalesType_household') },
                { value: 'shop', label: t('dairySalesType_shop') },
                { value: 'hotel', label: t('dairySalesType_hotel') },
              ]}
            />
          </div>
          {errors.type ? <p className="av-field-error">{errors.type}</p> : null}

          <LabeledTextField
            label={t('dairyCustomerAddress')}
            value={address}
            onChange={setAddress}
            error={errors.address}
          />
          <LabeledTextField
            label={t('dairyCustomerRoute')}
            value={route}
            onChange={setRoute}
            error={errors.route}
          />
          <LabeledTextField
            label={t('dairyCustomerDailyAm')}
            value={dailyAm}
            onChange={setDailyAm}
            type="number"
            inputMode="decimal"
            error={errors.dailyLitersAM}
          />
          <LabeledTextField
            label={t('dairyCustomerDailyPm')}
            value={dailyPm}
            onChange={setDailyPm}
            type="number"
            inputMode="decimal"
            error={errors.dailyLitersPM}
          />
          <LabeledTextField
            label={t('dairyCustomerRate')}
            value={rate}
            onChange={setRate}
            type="number"
            inputMode="decimal"
            error={errors.ratePerLiter}
            required
          />

          <div className="av-field">
            <label className="av-label">{t('dairyMemberStatus')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              {(['active', 'inactive'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`av-chip${status === s ? ' selected' : ''}`}
                  onClick={() => setStatus(s)}
                >
                  {t(`dairy_status_${s}`)}
                </button>
              ))}
            </div>
          </div>
          {errors.status ? <p className="av-field-error">{errors.status}</p> : null}

          <div className="dairy-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void save()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
