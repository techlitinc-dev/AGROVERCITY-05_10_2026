import React, { useCallback, useEffect, useState } from 'react';
import { DollarSign, Plus, Receipt, RefreshCcw, HandCoins } from 'lucide-react';
import { seller, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  arr,
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  num,
  paisaToRupees,
  primaryBtnCls,
  rec,
  str,
  type Rec,
} from './shared';

/** Seller POS: counter sales with GST invoice PDF, khata ledger, cashflow. */
export const SellerPosPage: React.FC = () => {
  const [sales, setSales] = useState<Rec[]>([]);
  const [ledgers, setLedgers] = useState<Rec[]>([]);
  const [cashflow, setCashflow] = useState<Rec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, l, c] = await Promise.all([
        seller.sales().catch(() => [] as unknown[]),
        seller.ledgers().catch(() => [] as unknown[]),
        seller.cashflow().catch(() => ({})),
      ]);
      setSales((s as unknown[]).map(rec));
      setLedgers((l as unknown[]).map(rec));
      setCashflow(rec(c));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      setActionError(null);
      try {
        await fn();
        await load();
      } catch (err) {
        setActionError(apiErrorMessage(err));
      }
    },
    [load]
  );

  const totalRevenue = sales.reduce((s, x) => s + num(x.netAmount), 0);
  const totalReceived = sales.reduce((s, x) => s + num(x.amountPaid), 0);
  const totalOutstanding = sales.reduce((s, x) => s + num(x.balanceDue), 0);

  // sale form
  const [saleModal, setSaleModal] = useState(false);
  const [buyer, setBuyer] = useState('');
  const [phone, setPhone] = useState('');
  const [item, setItem] = useState('');
  const [qty, setQty] = useState(1);
  const [rate, setRate] = useState(1000);
  const [mode, setMode] = useState('cash');
  const [paid, setPaid] = useState(0);
  const [feePct, setFeePct] = useState(0.5);

  // payment-received form
  const [payModal, setPayModal] = useState<Rec | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState('cash');

  const downloadInvoice = async (saleId: string) => {
    setActionError(null);
    try {
      const blob = await seller.saleInvoicePdf(saleId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gst-invoice-${saleId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const inflow = arr(cashflow.inflows ?? cashflow.data).map(rec);
  const outflow = arr(cashflow.outflows).map(rec);
  const net = num(cashflow.netBalance, num(cashflow.netPaisa) ? paisaToRupees(cashflow.netPaisa) : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-600" />
            POS Billing & Khata Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Counter sales with GST invoices, buyer credit ledger and daily cashflow
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => void load()} className={ghostBtnCls}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setSaleModal(true)} className={primaryBtnCls}>
            <Plus className="w-4 h-4 inline mr-1" /> New Sale
          </button>
        </div>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {loading && <LoadingBlock />}

      {!loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: formatCurrency(Math.round(totalRevenue)), tone: 'text-emerald-800' },
              { label: 'Received', value: formatCurrency(Math.round(totalReceived)), tone: 'text-sky-700' },
              { label: 'Udhar Outstanding', value: formatCurrency(Math.round(totalOutstanding)), tone: 'text-amber-700' },
              { label: 'Net Cash Position', value: formatCurrency(Math.round(net)), tone: 'text-slate-900' },
            ].map((k) => (
              <div key={k.label} className={`${cardCls} p-5`}>
                <span className="text-[10px] uppercase font-bold text-slate-400">{k.label}</span>
                <p className={`text-xl font-black mt-1 ${k.tone}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* sales + cashflow */}
            <div className="lg:col-span-3 space-y-4">
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900">Sales Invoices ({sales.length})</h3>
                {sales.length === 0 ? (
                  <div className={cardCls}>
                    <EmptyState label="No sales recorded yet" />
                  </div>
                ) : (
                  <div className={`${cardCls} overflow-hidden`}>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                          <th className="py-3 px-5">Bill & Buyer</th>
                          <th className="py-3 px-3">Items</th>
                          <th className="py-3 px-3">Net Amount</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-5 text-right">Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sales.map((s) => (
                          <tr key={str(s.id)} className="hover:bg-slate-50/60">
                            <td className="py-3 px-5 font-bold text-slate-900">
                              {str(s.billNumber, s.id)}
                              <span className="text-[10px] text-slate-400 block font-normal">
                                {str(s.buyerName)} · {formatDate(str(s.createdAt))}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600">{str(s.item)} × {num(s.quantity)}</td>
                            <td className="py-3 px-3 font-black text-emerald-800">{formatCurrency(num(s.netAmount))}</td>
                            <td className="py-3 px-3">
                              <StatusBadge status={str(s.status)} />
                            </td>
                            <td className="py-3 px-5 text-right">
                              <button onClick={() => void downloadInvoice(str(s.id))} className={ghostBtnCls}>
                                <Receipt className="w-3.5 h-3.5 inline mr-1" /> PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className={`${cardCls} p-5 space-y-3`}>
                <h3 className="font-bold text-sm text-slate-900">Cashflow</h3>
                {inflow.length === 0 && outflow.length === 0 ? (
                  <EmptyState label="No cashflow entries recorded yet" />
                ) : (
                  <div className="space-y-2">
                    {inflow.slice(0, 8).map((f, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl text-xs">
                        <span className="text-slate-600">{str(f.label || f.category || f.type, 'Entry')}</span>
                        <span className="font-bold text-emerald-700">+{formatCurrency(num(f.amount, paisaToRupees(f.amountPaisa)))}</span>
                      </div>
                    ))}
                    {outflow.slice(0, 8).map((f, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl text-xs">
                        <span className="text-slate-600">{str(f.label || f.category || f.type, 'Entry')}</span>
                        <span className="font-bold text-rose-700">−{formatCurrency(num(f.amount, paisaToRupees(f.amountPaisa)))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* khata */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Buyer Khata ({ledgers.length})</h3>
              {ledgers.length === 0 ? (
                <div className={cardCls}>
                  <EmptyState label="No khata accounts yet — credit sales create them" />
                </div>
              ) : (
                ledgers.map((b) => {
                  const balance = num(b.netBalance);
                  return (
                    <div key={`${str(b.buyerName)}-${str(b.buyerPhone)}`} className={`${cardCls} p-4 space-y-2`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900">{str(b.buyerName, 'Unknown buyer')}</p>
                        <span className={`text-sm font-black ${balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {formatCurrency(Math.abs(balance))} {balance > 0 ? 'due' : 'advance'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Credited {formatCurrency(num(b.totalCredit))} · Paid {formatCurrency(num(b.totalPaid))} · last {formatDate(str(b.lastTransaction))}
                      </p>
                      {balance > 0 && (
                        <button
                          onClick={() => {
                            setPayModal(b);
                            setPayAmount(balance);
                          }}
                          className={`${ghostBtnCls} w-full flex items-center justify-center gap-1.5`}
                        >
                          <HandCoins className="w-3.5 h-3.5" /> Record Payment Received
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* New sale modal */}
      <ModalSheet isOpen={saleModal} onClose={() => setSaleModal(false)} title="New Counter Sale" description="Unpaid balance is auto-posted to the buyer's khata" maxWidth="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() =>
              seller.recordSale({
                buyerName: buyer,
                buyerPhone: phone,
                item,
                quantity: qty,
                unit: 'Quintal',
                ratePerUnit: rate,
                paymentMode: mode,
                amountPaid: paid,
                mandiFeePct: feePct,
              })
            );
            setSaleModal(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Buyer Name</label>
              <input className={inputCls} value={buyer} onChange={(e) => setBuyer(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Item</label>
            <input className={inputCls} value={item} onChange={(e) => setItem(e.target.value)} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Qty</label>
              <input type="number" className={inputCls} value={qty} onChange={(e) => setQty(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Rate (₹/unit)</label>
              <input type="number" className={inputCls} value={rate} onChange={(e) => setRate(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Market Fee %</label>
              <input type="number" step="0.1" className={inputCls} value={feePct} onChange={(e) => setFeePct(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Payment Mode</label>
              <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit">Credit (Udhar)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount Paid (₹)</label>
              <input type="number" className={inputCls} value={paid} onChange={(e) => setPaid(Number(e.target.value))} />
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
            Gross {formatCurrency(qty * rate)} + fee → Net{' '}
            <strong className="text-emerald-800">{formatCurrency(qty * rate * (1 + feePct / 100))}</strong>
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Record Sale</button>
        </form>
      </ModalSheet>

      {/* Payment received modal */}
      <ModalSheet isOpen={Boolean(payModal)} onClose={() => setPayModal(null)} title="Record Khata Payment" description={payModal ? `Payment from ${str(payModal.buyerName)}` : undefined} maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!payModal) return;
            void act(() =>
              seller.addLedgerEntry({
                buyerName: str(payModal.buyerName),
                buyerPhone: str(payModal.buyerPhone),
                type: 'payment_received',
                amount: payAmount,
                paymentMode: payMode,
              })
            );
            setPayModal(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Amount (₹)</label>
            <input type="number" className={`${inputCls} font-bold text-emerald-800`} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} required />
          </div>
          <div>
            <label className={labelCls}>Mode</label>
            <select className={inputCls} value={payMode} onChange={(e) => setPayMode(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Record Payment</button>
        </form>
      </ModalSheet>
    </div>
  );
};
