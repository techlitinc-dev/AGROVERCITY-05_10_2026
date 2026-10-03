import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LabeledTextField from '../../../components/LabeledTextField';
import ModalSheet from '../../../components/ModalSheet';
import SegmentedControl from '../../../components/SegmentedControl';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { toast } from '../../../components/toast';
import { isApiError } from '../../../lib/api/client';
import {
  createOrder,
  fmtINR,
  fmtL,
  getSalesSummary,
  listCustomers,
  listOrders,
  type MilkSaleCustomer,
  type MilkSaleOrder,
  type SaleShift,
  type SaleOrderStatus,
  type SalesSummary,
} from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import '../../../lib/i18n/locales/en.dairy-sales';
import '../../../lib/i18n/locales/hi.dairy-sales';
import '../../../theme/dairy-sales.css';
import EmptyState from '../components/EmptyState';
import StatusChip from '../components/StatusChip';

const STATUS_FILTERS: { value: SaleOrderStatus | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'commonAll' },
  { value: 'scheduled', labelKey: 'dairy_status_scheduled' },
  { value: 'delivered', labelKey: 'dairy_status_delivered' },
  { value: 'billed', labelKey: 'dairy_status_billed' },
  { value: 'paid', labelKey: 'dairy_status_paid' },
];

const todayStr = (): string => new Date().toLocaleDateString('en-CA');

/** Milk-sale orders (P6) — summary strip, status filter, new-order sheet, row → detail. */
export default function OrdersPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const [orders, setOrders] = useState<MilkSaleOrder[] | null>(null);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [customers, setCustomers] = useState<MilkSaleCustomer[]>([]);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<SaleOrderStatus | 'all'>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [orderDate, setOrderDate] = useState(todayStr());
  const [shift, setShift] = useState<SaleShift>('am');
  const [liters, setLiters] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([
      listOrders({ pageSize: 500 }),
      getSalesSummary(),
      listCustomers({ pageSize: 500 }),
    ])
      .then(([ordersRes, summaryRes, customersRes]) => {
        setOrders(ordersRes.data);
        setSummary(summaryRes);
        setCustomers(customersRes.data);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(
    () => (orders ?? []).filter((o) => status === 'all' || o.status === status),
    [orders, status]
  );

  const activeCustomers = useMemo(
    () => customers.filter((c) => c.status === 'active'),
    [customers]
  );

  const selectedCustomer = useMemo(
    () => activeCustomers.find((c) => c.id === customerId) ?? null,
    [activeCustomers, customerId]
  );

  const litersNum = Number(liters);
  const previewAmount =
    selectedCustomer && litersNum > 0 ? litersNum * selectedCustomer.ratePerLiter : null;

  const openCreate = () => {
    setCustomerId('');
    setOrderDate(todayStr());
    setShift('am');
    setLiters('');
    setErrors({});
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (!customerId) nextErrors.customerId = t('commonRequired');
    if (!orderDate) nextErrors.orderDate = t('commonRequired');
    if (!(litersNum > 0)) nextErrors.liters = t('dairyOrderLitersInvalid');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await createOrder({ customerId, orderDate, shift, liters: litersNum });
      toast(t('dairyOrderCreated'));
      setCreateOpen(false);
      load();
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console">
      <div className="dairy-wrap">
        <div className="dairy-actions" style={{ marginTop: 4 }}>
          <button type="button" className="av-btn av-btn-primary" onClick={openCreate}>
            ＋ {t('dairyOrderNew')}
          </button>
        </div>

        {summary ? (
          <div className="dairy-sales-strip">
            <div className="dairy-sales-tile">
              <div className="dairy-sales-tile-label">{t('dairySalesOrders')}</div>
              <div className="dairy-sales-tile-value">{summary.totalOrders}</div>
            </div>
            <div className="dairy-sales-tile">
              <div className="dairy-sales-tile-label">{t('dairySalesLiters')}</div>
              <div className="dairy-sales-tile-value">{fmtL(summary.totalLiters)} L</div>
            </div>
            <div className="dairy-sales-tile">
              <div className="dairy-sales-tile-label">{t('dairySalesAmount')}</div>
              <div className="dairy-sales-tile-value">{fmtINR(summary.totalAmount)}</div>
            </div>
            <div className="dairy-sales-tile">
              <div className="dairy-sales-tile-label">{t('dairySalesCollected')}</div>
              <div className="dairy-sales-tile-value">{fmtINR(summary.collectedAmount)}</div>
            </div>
          </div>
        ) : null}

        <div className="dairy-chip-row">
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

        {orders === null && !failed ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <EmptyState
            icon="📡"
            titleKey="dairyLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {orders !== null && visible.length === 0 ? (
          <EmptyState
            icon="📦"
            titleKey="dairyOrdersEmpty"
            bodyKey="dairyOrdersEmptyBody"
            action={
              <button type="button" className="av-btn av-btn-primary" onClick={openCreate}>
                ＋ {t('dairyOrderNew')}
              </button>
            }
          />
        ) : null}

        <div className="dairy-list">
          {visible.map((o) => (
            <button
              key={o.id}
              type="button"
              className="dairy-card"
              onClick={() => navigate(`/dairy/console/sales/orders/${o.id}`)}
            >
              <span className="dairy-card-row">
                <span className="dairy-card-title">
                  {o.orderDate} · {t(`dairyShift_${o.shift}`)}
                </span>
                <StatusChip status={o.status} />
              </span>
              <span className="dairy-card-row">
                <span className="dairy-card-sub">{o.customerName}</span>
                <span className="dairy-card-amount">{fmtINR(o.amount)}</span>
              </span>
              <span className="dairy-card-sub">
                {t('dairyFormLiters')}: {fmtL(o.liters)} L
              </span>
            </button>
          ))}
        </div>
      </div>

      <ModalSheet open={createOpen} onClose={() => !busy && setCreateOpen(false)} title={t('dairyOrderSheetTitle')}>
        {activeCustomers.length === 0 ? (
          <EmptyState
            icon="🏪"
            titleKey="dairyOrderPickCustomerEmpty"
            bodyKey="dairyOrderPickCustomerEmptyBody"
            action={
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => navigate('/dairy/console/sales/customers/new')}
              >
                ＋ {t('dairyCustomerNew')}
              </button>
            }
          />
        ) : (
          <div className="dairy-form">
            <div className="av-field">
              <label className="av-label">{t('dairyOrderPickCustomer')}</label>
              <div className="dairy-list" style={{ marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                {activeCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`dairy-card${customerId === c.id ? ' selected' : ''}`}
                    style={customerId === c.id ? { borderColor: 'var(--av-primary)' } : undefined}
                    onClick={() => setCustomerId(c.id)}
                  >
                    <span className="dairy-card-row">
                      <span className="dairy-card-title">{c.name}</span>
                      <span className="dairy-card-sub">₹{c.ratePerLiter}/L</span>
                    </span>
                  </button>
                ))}
              </div>
              {errors.customerId ? <p className="av-field-error">{errors.customerId}</p> : null}
            </div>

            <div className="av-field">
              <label className="av-label">{t('dairyDate')}</label>
              <input
                className={`av-input${errors.orderDate ? ' invalid' : ''}`}
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
              {errors.orderDate ? <p className="av-field-error">{errors.orderDate}</p> : null}
            </div>

            <div className="av-field">
              <label className="av-label">{t('dairyFormShift')}</label>
              <SegmentedControl<SaleShift>
                value={shift}
                onChange={setShift}
                options={[
                  { value: 'am', label: `🌅 ${t('dairyShift_am')}` },
                  { value: 'pm', label: `🌇 ${t('dairyShift_pm')}` },
                ]}
              />
            </div>

            <LabeledTextField
              label={t('dairyFormLiters')}
              value={liters}
              onChange={setLiters}
              type="number"
              inputMode="decimal"
              error={errors.liters}
              required
            />

            {previewAmount !== null ? (
              <div className="dairy-preview">
                <div className="dairy-preview-title">{t('dairyOrderAmountPreview')}</div>
                <div className="dairy-preview-rate">{fmtINR(previewAmount)}</div>
                <div className="dairy-preview-formula">
                  {fmtL(litersNum)} L × ₹{selectedCustomer?.ratePerLiter}
                </div>
              </div>
            ) : null}

            <div className="dairy-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => void submitCreate()}
                disabled={busy}
              >
                {busy ? <span className="av-spinner" aria-hidden /> : t('dairyOrderNew')}
              </button>
              <button type="button" className="av-btn av-btn-ghost" onClick={() => setCreateOpen(false)} disabled={busy}>
                {t('commonCancel')}
              </button>
            </div>
          </div>
        )}
      </ModalSheet>
    </ToolShell>
  );
}
