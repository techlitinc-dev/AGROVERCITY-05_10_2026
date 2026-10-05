import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { fmtINR, getReceipt, type WarehouseReceipt } from '../../lib/api/coldStorage';
import { isApiError } from '../../lib/api/client';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.coldstorage';
import '../../lib/i18n/locales/hi.coldstorage';
import '../coldstorage/coldstorage.css';

/**
 * Verifiable warehouse receipt (e-NWR) — renders `GET /post-harvest/receipts/
 * {receipt_number}` in full. The endpoint is owner/provider-gated server-side;
 * a foreign farmer gets a 404/403 and this page shows the not-found state.
 */
export default function WarehouseReceiptPage() {
  const t = useT();
  const { receiptNumber: routeNumber } = useParams();
  const [lookup, setLookup] = useState(routeNumber ?? '');
  const [receipt, setReceipt] = useState<WarehouseReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);

  const fetchReceipt = useCallback(
    (number: string) => {
      const value = number.trim();
      if (!value) return;
      setLoading(true);
      setMissing(false);
      getReceipt(value)
        .then(setReceipt)
        .catch((e) => {
          setReceipt(null);
          if (isApiError(e) && (e.status === 404 || e.status === 403)) setMissing(true);
          else toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
        })
        .finally(() => setLoading(false));
    },
    [t]
  );

  useEffect(() => {
    if (routeNumber) fetchReceipt(routeNumber);
  }, [routeNumber, fetchReceipt]);

  const row = (label: string, value: string | number | null | undefined) => (
    <tr>
      <th>{label}</th>
      <td>{value === null || value === undefined || value === '' ? '—' : value}</td>
    </tr>
  );

  return (
    <ToolShell toolId="myBookings" backTo="/dashboard">
      <div className="cs-wrap">
        <div className="cs-section">
          <span className="cs-section-title">📜 {t('csReceiptTitle')}</span>
          <p className="cs-hint">{t('csReceiptOwnerNote')}</p>
          <div className="cs-actions" style={{ alignItems: 'flex-end' }}>
            <LabeledTextField label={t('csReceiptLookup')} value={lookup} onChange={setLookup} />
            <button
              type="button"
              className="av-btn av-btn-primary"
              style={{ width: 'auto', padding: '0 16px' }}
              disabled={loading || !lookup.trim()}
              onClick={() => fetchReceipt(lookup)}
            >
              {t('csReceiptFetch')}
            </button>
          </div>
        </div>

        {loading ? <p className="cs-hint">{t('commonLoading')}</p> : null}
        {missing ? <p className="cs-empty">📜 {t('csReceiptNotFound')}</p> : null}

        {receipt ? (
          <div className="cs-section">
            <span className="cs-section-title">{receipt.receiptNumber}</span>
            <table className="cs-table">
              <tbody>
                {row(t('csReceiptNumber'), receipt.receiptNumber)}
                {row(t('csReceiptStatus'), receipt.status)}
                {row(t('csReceiptDepositor'), receipt.depositorName)}
                {row(t('csReceiptFacility'), receipt.facilityName)}
                {row(t('csReceiptWdra'), receipt.wdraRegNo)}
                {row(t('csReceiptCrop'), receipt.cropName)}
                {row(t('csReceiptVariety'), receipt.variety)}
                {row(t('csReceiptNet'), receipt.netQuintals)}
                {row(t('csReceiptBags'), receipt.bagsCount)}
                {row(t('csReceiptGrade'), receipt.qcGrade)}
                {row(t('csReceiptMoisture'), receipt.moisturePercent)}
                {row(t('csReceiptChamber'), receipt.chamberName)}
                {row(t('csReceiptLot'), receipt.lotNumber)}
                {row(t('csReceiptValuation'), fmtINR(receipt.valuationRupees))}
                {row(t('csReceiptIssued'), receipt.issueDate?.slice(0, 10))}
                {row(t('csReceiptPledge'), receipt.pledgeFinancingEligible ? t('csReceiptYes') : t('csReceiptNo'))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </ToolShell>
  );
}
