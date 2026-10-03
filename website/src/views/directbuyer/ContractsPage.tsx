import { ZERO } from '../../lib/numDefaults';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { listSavedFarmers } from '../../lib/api/discovery';
import {
  contractFormulaLabel,
  listContractsMine,
  type Contract,
  type ContractStatus,
} from '../../lib/api/intelligence';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';
import '../../theme/contracts.css';

const STATUS_FILTERS: Array<ContractStatus | 'all'> = [
  'all',
  'offered',
  'active',
  'accepted',
  'open',
  'fulfilled',
  'declined',
  'cancelled',
];

/**
 * Buyer's contract desk — status-filtered list of supply agreements with
 * farmers: crop/qty, counterparty, price formula chip with the server-computed
 * live currentPrice, status pill and deliveries progress.
 */
export default function ContractsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('directBuyer');

  const [status, setStatus] = useState<ContractStatus | 'all'>('all');
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [farmerNames, setFarmerNames] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setContracts(null);
    listContractsMine('buyer', status === 'all' ? undefined : status)
      .then((res) => setContracts(res.data))
      .catch(() => setFailed(true));
  }, [status]);

  useEffect(load, [load]);

  // Best-effort farmer-name resolution from the saved-farmers list.
  useEffect(() => {
    listSavedFarmers()
      .then((res) => {
        const map: Record<string, string> = {};
        for (const f of res.data) map[f.farmerId] = f.farmerName;
        setFarmerNames(map);
      })
      .catch(() => setFarmerNames({}));
  }, []);

  const filters = useMemo(() => STATUS_FILTERS, []);

  return (
    <ToolShell toolId="contracts">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => navigate('/dashboard/p/contracts/new')}
        >
          ＋ {t('ctNew')}
        </button>
      </div>

      <div className="trade-filter-row">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            className={`av-chip${status === f ? ' selected' : ''}`}
            onClick={() => setStatus(f)}
          >
            {f === 'all' ? t('commonAll') : t(`status_${f}`)}
          </button>
        ))}
      </div>

      {contracts === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {contracts !== null && contracts.length === 0 ? (
        <EmptyState
          icon="📜"
          titleKey="ctEmpty"
          bodyKey="ctEmptyBody"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => navigate('/dashboard/p/contracts/new')}
            >
              ＋ {t('ctNew')}
            </button>
          }
        />
      ) : null}

      <div className="trade-list">
        {contracts?.map((c) => (
          <div
            key={c.id}
            className="trade-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/dashboard/p/contracts/${c.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(`/dashboard/p/contracts/${c.id}`);
            }}
          >
            <div className="trade-card-row">
              <span className="trade-card-title">
                {c.crop}
                {c.quantityTotal ? ` · ${t('ctQtyTotal', { qty: c.quantityTotal })}` : ''}
              </span>
              <StatusPill status={c.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('ctFarmer')}: {farmerNames[c.farmerId ?? ''] ?? c.farmerId ?? t('commonNotAvailable')}
              </span>
              <span className="ct-formula-chip">{contractFormulaLabel(t, c)}</span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {c.deliveriesGenerated !== undefined
                  ? t('ctDeliveriesProgress', {
                      done: c.deliveriesGenerated,
                      total: c.schedule
                        ? Math.max(
                            c.deliveriesGenerated,
                            Math.ceil((c.quantityTotal ?? ZERO) / (c.schedule.qtyPerDelivery || 1))
                          )
                        : c.deliveriesGenerated,
                    })
                  : null}
              </span>
              {c.currentPrice != null ? (
                <span className="ct-formula-chip live">
                  {t('ctCurrentPrice', { price: c.currentPrice })}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
