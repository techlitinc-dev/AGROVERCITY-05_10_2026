import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { listCustomers, type CustomerType, type EntityStatus, type MilkSaleCustomer } from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import '../../../lib/i18n/locales/en.dairy-sales';
import '../../../lib/i18n/locales/hi.dairy-sales';
import '../../../theme/dairy-sales.css';
import EmptyState from '../components/EmptyState';
import StatusChip from '../components/StatusChip';

const STATUS_FILTERS: { value: EntityStatus | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'commonAll' },
  { value: 'active', labelKey: 'dairy_status_active' },
  { value: 'inactive', labelKey: 'dairy_status_inactive' },
];

const TYPE_COLORS: Record<CustomerType, string> = {
  household: '#16A34A',
  shop: '#2563EB',
  hotel: '#7C3AED',
};

/** Milk-sale customer book (P6) — search + status chips, row opens the edit form. */
export default function CustomersPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const [customers, setCustomers] = useState<MilkSaleCustomer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<EntityStatus | 'all'>('all');

  const load = useCallback(() => {
    setFailed(false);
    listCustomers({ pageSize: 500 })
      .then((res) => setCustomers(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (customers ?? []).filter((c) => {
      if (status !== 'all' && c.status !== status) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.route || '').toLowerCase().includes(q);
    });
  }, [customers, query, status]);

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console">
      <div className="dairy-wrap">
        <div className="dairy-actions" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => navigate('/dairy/console/sales/customers/new')}
          >
            ＋ {t('dairyCustomerNew')}
          </button>
        </div>

        <input
          className="av-input"
          style={{ marginTop: 12 }}
          placeholder={t('dairyCustomersSearch')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

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

        {customers === null && !failed ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

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

        {customers !== null && visible.length === 0 ? (
          <EmptyState
            icon="🏪"
            titleKey="dairyCustomersEmpty"
            bodyKey="dairyCustomersEmptyBody"
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
        ) : null}

        <div className="dairy-list">
          {visible.map((c) => {
            const typeColor = TYPE_COLORS[c.type] ?? '#64748B';
            const meta = [
              c.route ? `${t('dairyCustomerRoute')}: ${c.route}` : '',
              c.phone ? `${t('dairyCustomerPhone')}: ${c.phone}` : '',
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <button
                key={c.id}
                type="button"
                className="dairy-card"
                onClick={() => navigate(`/dairy/console/sales/customers/new?id=${c.id}`)}
              >
                <span className="dairy-card-row">
                  <span className="dairy-card-title">{c.name}</span>
                  <span
                    className="dairy-pill"
                    style={{ background: `${typeColor}1A`, color: typeColor, borderColor: `${typeColor}55` }}
                  >
                    {t(`dairySalesType_${c.type}`)}
                  </span>
                </span>
                <span className="dairy-card-row">
                  <span className="dairy-card-sub">{meta || t('commonNotAvailable')}</span>
                  <StatusChip status={c.status} />
                </span>
                <span className="dairy-card-sub">
                  {t('dairyRatePerLiter')}: ₹{c.ratePerLiter} · {t('dairyCustomerDailyAm')}: {c.dailyLitersAM || 0} L
                  · {t('dairyCustomerDailyPm')}: {c.dailyLitersPM || 0} L
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </ToolShell>
  );
}
