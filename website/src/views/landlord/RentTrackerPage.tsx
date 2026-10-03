import { useCallback, useEffect, useState } from 'react';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  downloadRentLedger,
  downloadRentReceipt,
  fetchLeasePayments,
  fetchLeases,
  recordRentPayment,
  type Lease,
} from '../../lib/api/landlord';
import { useT } from '../../lib/i18n';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** LandBank — rent tracker with partial payments + receipt/ledger PDFs (task 1.7). */
export default function RentTrackerPage() {
  const t = useT();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [selected, setSelected] = useState<Lease | null>(null);
  const [payments, setPayments] = useState<Array<{ id: string; month: string; amountRupees: number; method: string; paidAt: string }>>([]);
  const [pendingMonths, setPendingMonths] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [method, setMethod] = useState<'cash' | 'upi' | 'bank'>('upi');
  const [busy, setBusy] = useState(false);

  const loadLeases = useCallback(() => {
    fetchLeases()
      .then((rows) => {
        setLeases(rows);
        if (rows.length > 0) setSelected((current) => current ?? rows[0]);
      })
      .catch(() => toast(t('llLoadFailed'), { error: true }));
  }, [t]);

  useEffect(() => {
    loadLeases();
  }, [loadLeases]);

  const loadPayments = useCallback(() => {
    if (!selected) return;
    fetchLeasePayments(selected.id)
      .then((res) => {
        setPayments(res.data);
        setPendingMonths(res.pendingMonths);
      })
      .catch(() => toast(t('llLoadFailed'), { error: true }));
  }, [selected, t]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const submit = async () => {
    if (!selected || busy || !Number(amount)) return;
    setBusy(true);
    try {
      await recordRentPayment(selected.id, {
        amountRupees: Number(amount),
        month,
        method,
        paidAt: new Date().toISOString(),
      });
      setAmount('');
      toast(t('llCreated'));
      loadPayments();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('llActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const receipt = async (paymentId: string) => {
    try {
      download(await downloadRentReceipt(paymentId), `rent-receipt-${paymentId}.pdf`);
    } catch (e) {
      toast(isApiError(e) ? e.message : t('llUpgradeRequired'), { error: true });
    }
  };

  const ledger = async () => {
    if (!selected) return;
    try {
      download(await downloadRentLedger(selected.id), `rent-ledger-${selected.id}.pdf`);
    } catch (e) {
      toast(isApiError(e) ? e.message : t('llUpgradeRequired'), { error: true });
    }
  };

  return (
    <section className="dash-section">
      <h3>{t('llRentTitle')}</h3>
      {leases.length > 0 ? (
        <select className="av-input" style={{ maxWidth: 320 }} value={selected?.id ?? ''}
          onChange={(e) => setSelected(leases.find((lease) => lease.id === e.target.value) ?? null)}>
          {leases.map((lease) => (
            <option key={lease.id} value={lease.id}>
              {lease.tenantName} · ₹{lease.monthlyRentRupees}/{t('llMonth')}
            </option>
          ))}
        </select>
      ) : (
        <p className="dash-empty-line">📜 {t('llEmpty')}</p>
      )}

      {selected ? (
        <>
          {pendingMonths.length > 0 ? (
            <p className="dash-empty-line">
              ⏳ {t('llPendingMonths')}: {pendingMonths.join(', ')}
            </p>
          ) : null}

          <div className="dash-grid-3" style={{ marginTop: 10 }}>
            <input className="av-input" type="number" placeholder={t('llAmount')} value={amount}
              onChange={(e) => setAmount(e.target.value)} />
            <input className="av-input" type="month" value={month}
              onChange={(e) => setMonth(e.target.value)} />
            <select className="av-input" value={method}
              onChange={(e) => setMethod(e.target.value as 'cash' | 'upi' | 'bank')}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="av-btn av-btn-primary" style={{ width: 'auto', padding: '0 16px' }}
              disabled={busy || !Number(amount)} onClick={() => void submit()}>
              {busy ? <span className="av-spinner" /> : t('llRecordPayment')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" style={{ width: 'auto', padding: '0 16px' }}
              onClick={() => void ledger()}>
              📄 {t('llLedger')}
            </button>
          </div>

          <div className="dash-task-list" style={{ marginTop: 12 }}>
            {payments.map((payment) => (
              <div key={payment.id} className="dash-task-row">
                <div className="dash-task-main">
                  <div className="dash-task-title">
                    {payment.month} · ₹{payment.amountRupees}
                  </div>
                  <div className="dash-task-sub">
                    {payment.method} · {payment.paidAt}
                  </div>
                </div>
                <button type="button" className="dash-task-open" onClick={() => void receipt(payment.id)}>
                  🧾 {t('llReceipt')}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
