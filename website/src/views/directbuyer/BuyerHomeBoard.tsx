import { ZERO } from '../../lib/numDefaults';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import InsightsPanel from '../../components/intelligence/InsightsPanel';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { buyerProfile, type BuyerProfileStats } from '../../lib/api/discovery';
import {
  contractFormulaLabel,
  listContractsMine,
  type Contract,
} from '../../lib/api/intelligence';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';
import '../../theme/contracts.css';

/** Non-terminal statuses counted as "active" on the board. */
const ACTIVE_STATUSES = ['offered', 'active', 'accepted', 'open'];

interface BoardData {
  stats: BuyerProfileStats | null;
  contracts: Contract[];
}

/**
 * Direct-buyer home board — profile stats (spend / purchases / demands), live
 * active-contracts count, recent contracts and the persona intelligence
 * panel. Board is an enhancement: any failure renders nothing but the panel.
 */
export default function BuyerHomeBoard({ embedded }: { embedded?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('directBuyer');

  const [data, setData] = useState<BoardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const [profile, contracts] = await Promise.all([
          buyerProfile().catch(() => null),
          listContractsMine('buyer').catch(() => ({ data: [], total: 0 })),
        ]);
        if (!live) return;
        setData({ stats: profile?.stats ?? null, contracts: contracts.data });
      } catch {
        if (live) setFailed(true);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, []);

  if (failed) return null; // board is an enhancement — never block the home page

  const activeContracts = (data?.contracts ?? []).filter((c) =>
    ACTIVE_STATUSES.includes(c.status)
  );
  const recent = (data?.contracts ?? [])
    .slice()
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 3);

  const body = (
    <>
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => navigate('/dashboard/p/contracts/new')}
        >
          ＋ {t('dbNewContract')}
        </button>
        <button
          type="button"
          className="av-btn av-btn-ghost"
          onClick={() => navigate('/dashboard/p/demands/new')}
        >
          📣 {t('dbPostDemand')}
        </button>
      </div>

      <div className="trade-stats-grid">
        <Link className="trade-stat" to="/dashboard/p/purchases">
          <p className="trade-stat-label">{t('dbHomeSpend')}</p>
          <p className="trade-stat-value">
            {data ? inr(data.stats?.totalSpend ?? ZERO) : '…'}
          </p>
        </Link>
        <Link className="trade-stat" to="/dashboard/p/purchases">
          <p className="trade-stat-label">{t('dbHomePurchases')}</p>
          <p className="trade-stat-value">{data?.stats?.totalPurchases ?? '…'}</p>
        </Link>
        <Link className="trade-stat" to="/dashboard/p/demands">
          <p className="trade-stat-label">{t('dbHomeDemands')}</p>
          <p className="trade-stat-value">{data?.stats?.activeDemands ?? '…'}</p>
        </Link>
        <Link className="trade-stat" to="/dashboard/p/contracts">
          <p className="trade-stat-label">{t('dbHomeContracts')}</p>
          <p className="trade-stat-value">{data ? activeContracts.length : '…'}</p>
        </Link>
      </div>

      <p className="trade-section-title" style={{ marginTop: 6 }}>
        {t('dbRecentContracts')}
      </p>
      {recent.length === 0 && data ? (
        <p className="trade-hint">{t('ctEmpty')}</p>
      ) : (
        <div className="trade-list" style={{ marginTop: 0 }}>
          {recent.map((c) => (
            <Link key={c.id} className="trade-card" to={`/dashboard/p/contracts/${c.id}`}>
              <div className="trade-card-row">
                <span className="trade-card-title">
                  {c.crop}
                  {c.quantityTotal ? ` · ${t('ctQtyTotal', { qty: c.quantityTotal })}` : ''}
                </span>
                <StatusPill status={c.status} />
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">
                  {c.farmerId ? `${t('ctFarmer')}: ${c.farmerId}` : t('ctFarmer')}
                </span>
                <span className="ct-formula-chip">{contractFormulaLabel(t, c)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && recent.length > 0 ? (
        <div className="trade-actions-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={() => navigate('/dashboard/p/contracts')}
          >
            📜 {t('dbViewAllContracts')} →
          </button>
        </div>
      ) : null}

      <InsightsPanel />
    </>
  );

  if (embedded) return body;
  return <ToolShell toolId="directBuyerHome">{body}</ToolShell>;
}
