import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { buyerDirectory, type DirectoryBuyer } from '../../lib/api/seller';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Buyer directory (S5) — the vyapari's B2B network: buyers from the khata
 * ledger plus wholesale buyers who posted bulk orders, with activity counts.
 */
export default function BuyerDirectoryPage() {
  const t = useT();
  useEnsureProfile('seller');

  const [rows, setRows] = useState<DirectoryBuyer[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    buyerDirectory()
      .then((res) => setRows(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  return (
    <ToolShell toolId="buyerDirectory">
      <p className="trade-section-title">{t('bnDirectoryTitle')}</p>

      {rows === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {rows !== null && rows.length === 0 ? <EmptyState icon="🤝" titleKey="bnEmpty" /> : null}

      <div className="trade-list">
        {rows?.map((row) => (
          <div key={`${row.buyerName}_${row.buyerPhone ?? ''}`} className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{row.buyerName}</span>
              <span className="trade-card-amount">
                {row.bulkOrders + row.ledgerEntries} {t('bnActivityLabel')}
              </span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {row.companyName ? `${row.companyName} · ` : ''}
                {t('bnLedgerLabel')}: {row.ledgerEntries} · {t('bnBulkLabel')}: {row.bulkOrders}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
