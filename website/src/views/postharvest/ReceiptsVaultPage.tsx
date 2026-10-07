import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { formatRupees, listMyReceipts, type WarehouseReceipt } from '../../lib/api/postHarvest';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Warehouse receipts vault (robust.md §7.14). Lists the farmer's own e-NWR
 * documents; each is labelled loan-collateral-usable (`receiptCollateralLabel`)
 * and can be downloaded as a JSON document or opened in full.
 */
export default function ReceiptsVaultPage() {
  const t = useT();
  const [receipts, setReceipts] = useState<WarehouseReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setReceipts(await listMyReceipts());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const download = (receipt: WarehouseReceipt) => {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${receipt.receiptNumber}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast(t('receiptDownload'));
  };

  return (
    <ToolShell toolId="postHarvest" backTo="/dashboard/p/postHarvest">
      <section className="dash-section">
        <h3>{t('receiptsVaultTitle')}</h3>
        <p className="trade-hint">{t('receiptsVaultHint')}</p>
        {loading ? <p className="trade-hint">{t('commonLoading')}</p> : null}
        {failed ? <p className="trade-hint">{t('receiptsVaultLoadFailed')}</p> : null}
        {!loading && !failed && receipts.length === 0 ? (
          <EmptyState icon="📜" titleKey="receiptsVaultEmpty" />
        ) : null}

        {receipts.map((receipt) => (
          <div className="trade-card" key={receipt.receiptNumber} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {t('receiptNumberLabel')} {receipt.receiptNumber}
              </span>
              <span className="trade-card-amount">{receipt.status}</span>
            </div>
            <p className="trade-card-sub">
              {t('receiptFacilityLabel')}: {receipt.facilityName} · {t('receiptCropLabel')}: {receipt.cropName}
            </p>
            <p className="trade-card-sub">
              {t('receiptGradeLabel')}: {receipt.qcGrade} · {t('receiptNetLabel')}: {receipt.netQuintals}
            </p>
            <p className="trade-card-sub">
              {t('receiptIssuedLabel')}: {receipt.issueDate?.slice(0, 10)} ·{' '}
              {formatRupees(receipt.valuationRupees)}
            </p>
            <p className="trade-card-sub">
              {receipt.pledgeFinancingEligible ? `✅ ${t('receiptCollateralLabel')}` : ''}
            </p>
            <div className="trade-actions-row">
              <button type="button" className="av-btn av-btn-primary" onClick={() => download(receipt)}>
                {t('receiptDownload')}
              </button>
              <Link className="av-btn av-btn-ghost" to={`/storage/receipts/${receipt.receiptNumber}`}>
                {t('receiptNumberLabel')}
              </Link>
            </div>
          </div>
        ))}
      </section>
    </ToolShell>
  );
}
