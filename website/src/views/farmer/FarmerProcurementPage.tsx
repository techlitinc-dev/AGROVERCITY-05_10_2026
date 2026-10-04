import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import {
  myProcurementPayments,
  type ProcurementPayment,
} from '../../lib/api/seller';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDate = (iso?: string): string =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

/**
 * Farmer view of vyapari J-form procurements (S4): a "payment pending"
 * trust card while the vyapari owes money (udhaar), and the paid receipt
 * (amount, UTR, receipt number) once marked paid. Data comes from
 * /v1/seller/procurement/mine (farmer auth).
 */
export default function FarmerProcurementPage() {
  const t = useT();
  useEnsureProfile('farmer');

  const [rows, setRows] = useState<ProcurementPayment[] | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    myProcurementPayments()
      .then((res) => {
        setRows(res.data);
        setPendingCount(res.pendingCount);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  return (
    <ToolShell toolId="farmerProcurement">
      <p className="trade-section-title">{t('fpTitle')}</p>
      {pendingCount > 0 ? (
        <div className="trade-card" style={{ cursor: 'default', borderColor: 'var(--av-warning, #d97706)' }}>
          <div className="trade-card-row">
            <span className="trade-card-title">⏳ {t('fpPendingTitle')}</span>
            <span className="trade-card-amount">{pendingCount}</span>
          </div>
          <p className="trade-hint" style={{ margin: '6px 0 0' }}>
            {t('fpPendingHint')}
          </p>
        </div>
      ) : null}

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

      {rows !== null && rows.length === 0 ? <EmptyState icon="🧾" titleKey="fpEmpty" /> : null}

      <div className="trade-list">
        {rows?.map((row) => (
          <div key={row.id} className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {row.crop}
                {row.variety ? ` (${row.variety})` : ''}
              </span>
              {row.paymentStatus === 'udhaar' ? (
                <span
                  className="trade-pill"
                  style={{ color: 'var(--av-warning, #d97706)', borderColor: 'var(--av-warning, #d97706)' }}
                >
                  ⏳ {t('fpPendingPill')}
                </span>
              ) : (
                <span
                  className="trade-pill"
                  style={{ color: 'var(--av-success)', borderColor: 'var(--av-success)' }}
                >
                  ✓ {t('fpPaidPill')}
                </span>
              )}
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {row.jFormNumber ? `${row.jFormNumber} · ` : ''}
                {row.sellerName || t('commonNotAvailable')} · {fmtDate(row.createdAt)}
              </span>
              <span className="trade-card-amount">
                {row.finalAmount != null ? inr(row.finalAmount) : '—'}
              </span>
            </div>
            {row.paymentStatus === 'paid' ? (
              <div className="trade-detail-grid" style={{ marginTop: 6 }}>
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('fpReceiptNo')}</div>
                  <div className="trade-detail-value">{row.receiptNo || '—'}</div>
                </div>
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('fpUtr')}</div>
                  <div className="trade-detail-value">{row.utrNumber || '—'}</div>
                </div>
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('fpPaidAt')}</div>
                  <div className="trade-detail-value">{row.paidAt ? fmtDate(row.paidAt) : '—'}</div>
                </div>
                <div className="trade-detail-item">
                  <div className="trade-detail-label">{t('fpNetWeight')}</div>
                  <div className="trade-detail-value">
                    {row.netWeightQuintals != null ? `${row.netWeightQuintals} ${t('unitQuintal')}` : '—'}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
