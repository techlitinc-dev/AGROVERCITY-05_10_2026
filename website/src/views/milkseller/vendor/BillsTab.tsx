import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, IndianRupee, MessageCircle, Pencil, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { milkVendor, VendorBill, VendorClient } from '../../../lib/api';
import { buildWhatsappMessage, rupeesToPaisa, whatsappChatUrl } from '../../../lib/api/milkVendor';
import { ModalSheet } from '../../../components/common/ModalSheet';
import { SectionCard, EmptyState, ErrorBanner, inputCls, btnPrimary, btnGhost, btnDanger, saveBlob, sharePdfIfSupported, rec, recArr, str, num, bool, todayStr, fmtMl, fmtPaisa, BILL_STATUSES } from './shared';

interface Props {
  clients: VendorClient[];
  refreshKey: number;
  notify: (message: string) => void;
  onChanged: () => void;
}

export const BillsTab: React.FC<Props> = ({ clients, refreshKey, notify, onChanged }) => {
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [billForm, setBillForm] = useState({ clientId: '', cycle: 'monthly', start: '', end: '', adjustment: '0', notes: '' });
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [detail, setDetail] = useState<VendorBill | null>(null);
  const [shareState, setShareState] = useState<Record<string, string>>({});
  const [payFor, setPayFor] = useState<VendorBill | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', date: todayStr(), method: 'cash', reference: '', notes: '' });
  const [paySaving, setPaySaving] = useState(false);
  const [voidFor, setVoidFor] = useState<Record<string, unknown> | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [reviseFor, setReviseFor] = useState<VendorBill | null>(null);
  const [reviseReason, setReviseReason] = useState('');
  const [cancelFor, setCancelFor] = useState<VendorBill | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, p] = await Promise.all([milkVendor.bills(), milkVendor.payments()]);
      setBills(b);
      setPayments(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load bills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const openCreate = (clientId = '') => {
    const start = defaultPeriodStart(billForm.cycle);
    setBillForm({ clientId: clientId || str(clients[0]?.id), cycle: 'monthly', start, end: todayStr(), adjustment: '0', notes: '' });
    setPreview(null);
    setCreateOpen(true);
  };

  const doPreview = async () => {
    setPreviewing(true);
    setError(null);
    try {
      setPreview(
        await milkVendor.previewBill({
          clientId: billForm.clientId,
          periodStart: billForm.start,
          periodEnd: billForm.end,
          adjustmentsPaisa: rupeesToPaisa(billForm.adjustment || '0'),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const doGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const bill = await milkVendor.generateBill(
        {
          clientId: billForm.clientId,
          periodStart: billForm.start,
          periodEnd: billForm.end,
          adjustmentsPaisa: rupeesToPaisa(billForm.adjustment || '0'),
          notes: billForm.notes,
        },
        `bill-${billForm.clientId}-${billForm.start}-${Date.now()}`,
      );
      notify(`Bill ${bill.billNumber} generated`);
      setCreateOpen(false);
      await load();
      onChanged();
      setDetail(bill);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async (bill: VendorBill) => {
    const blob = await milkVendor.billPdf(bill.id);
    saveBlob(blob, `milk_bill_${bill.billNumber}.pdf`);
    notify('PDF downloaded');
  };

  const shareWhatsApp = async (bill: VendorBill) => {
    setError(null);
    try {
      const fresh = await milkVendor.bill(bill.id);
      const { url } = await milkVendor.shareLink(bill.id);
      const client = clients.find((c) => c.id === fresh.clientId);
      const clientName = str(fresh.clientName) || str(client?.name) || 'customer';
      const message = buildWhatsappMessage(fresh, clientName, str(fresh.vendorBusinessName, 'your milk vendor'), url);
      const phone = str(fresh.clientWhatsappNumber) || str(client?.whatsappNumber);

      // Device share sheet with the PDF where supported; click-to-chat
      // WhatsApp otherwise — the chat opens with the message + secure link,
      // it never auto-attaches the local PDF.
      let sharedViaSheet = false;
      try {
        const blob = await milkVendor.billPdf(bill.id);
        sharedViaSheet = await sharePdfIfSupported(blob, `milk_bill_${bill.billNumber}.pdf`, message);
      } catch {
        sharedViaSheet = false;
      }
      window.open(whatsappChatUrl(phone, message), '_blank', 'noopener,noreferrer');
      await milkVendor.shareEvent(bill.id, 'whatsapp');
      setShareState((s) => ({
        ...s,
        [bill.id]: sharedViaSheet ? 'Shared action started (share sheet + WhatsApp)' : 'Opened WhatsApp — attach the PDF manually if needed',
      }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start WhatsApp sharing');
    }
  };

  const copyLink = async (bill: VendorBill) => {
    const { url } = await milkVendor.shareLink(bill.id);
    await navigator.clipboard.writeText(url);
    await milkVendor.shareEvent(bill.id, 'link');
    setShareState((s) => ({ ...s, [bill.id]: 'Secure bill link copied' }));
    notify('Bill link copied');
  };

  const savePayment = async () => {
    if (!payFor) return;
    setPaySaving(true);
    setError(null);
    try {
      const amount = rupeesToPaisa(payForm.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be more than zero');
      await milkVendor.recordPayment({
        clientId: payFor.clientId,
        billId: payFor.id,
        amountPaisa: amount,
        paymentDate: payForm.date,
        method: payForm.method,
        externalReference: payForm.reference || undefined,
        notes: payForm.notes,
      });
      notify('Payment recorded (received outside Agrovercity)');
      setPayFor(null);
      setPayForm({ amount: '', date: todayStr(), method: 'cash', reference: '', notes: '' });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record payment');
    } finally {
      setPaySaving(false);
    }
  };

  const doVoid = async () => {
    if (!voidFor) return;
    try {
      await milkVendor.voidPayment(str(voidFor.id), voidReason);
      notify('Payment voided (audit record kept)');
      setVoidFor(null);
      setVoidReason('');
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Void failed');
    }
  };

  const doRevise = async () => {
    if (!reviseFor) return;
    try {
      const revised = await milkVendor.reviseBill(reviseFor.id, { reason: reviseReason });
      notify(`Revised as ${revised.billNumber} rev ${revised.revisionNumber} — old customer link revoked`);
      setReviseFor(null);
      setReviseReason('');
      setDetail(revised);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revision failed');
    }
  };

  const doCancel = async () => {
    if (!cancelFor) return;
    try {
      await milkVendor.cancelBill(cancelFor.id, { reason: cancelReason });
      notify('Bill cancelled — deliveries released, link revoked');
      setCancelFor(null);
      setCancelReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancellation failed');
    }
  };

  const voidablePayments = payments.slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => openCreate()} className={btnPrimary} disabled={clients.length === 0}>
          <Plus className="h-4 w-4" /> Create bill
        </button>
        {clients.length === 0 && <span className="text-sm text-slate-500 self-center">Add a client first.</span>}
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <EmptyState message="Loading bills…" />
      ) : bills.length === 0 ? (
        <EmptyState message="No bills yet. Create a bill from a client’s delivered entries." />
      ) : (
        <div className="space-y-2">
          {bills.map((bill) => (
            <div key={bill.id} className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <button className="min-w-0 text-left" onClick={() => setDetail(bill)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-slate-800">{bill.billNumber}</span>
                    {num(bill.revisionNumber, 1) > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">REV {num(bill.revisionNumber)}</span>
                    )}
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        bill.status === 'shared'
                          ? 'bg-sky-100 text-sky-700'
                          : bill.status === 'cancelled' || bill.status === 'revised'
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {BILL_STATUSES[bill.status || 'generated']?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {bill.clientName} · {bill.periodStart} → {bill.periodEnd}
                  </div>
                </button>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-slate-800">{fmtPaisa(num(bill.balancePaisa))}</div>
                  <div className="text-[11px] text-slate-500">balance</div>
                </div>
              </div>

              {shareState[bill.id] && (
                <div className="mt-2 rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1.5 text-xs text-sky-700">{shareState[bill.id]}</div>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={() => downloadPdf(bill)} className={btnGhost} title="Download PDF">
                  <Download className="h-3.5 w-3.5" /> PDF
                </button>
                {(bill.status === 'generated' || bill.status === 'shared') && (
                  <>
                    <button onClick={() => shareWhatsApp(bill)} className={btnPrimary}>
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </button>
                    <button onClick={() => copyLink(bill)} className={btnGhost} title="Copy secure bill link">
                      Link
                    </button>
                    <button onClick={() => setPayFor(bill)} className={btnGhost}>
                      <IndianRupee className="h-3.5 w-3.5" /> Payment
                    </button>
                    <button onClick={() => setReviseFor(bill)} className={btnGhost}>
                      <RotateCcw className="h-3.5 w-3.5" /> Revise
                    </button>
                    <button onClick={() => setCancelFor(bill)} className={btnDanger}>
                      <XCircle className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionCard
        title="Recorded payments (received outside Agrovercity)"
        action={
          <button
            onClick={() => {
              const first = clients.find((c) => str(c.status) === 'active') || clients[0];
              if (first) {
                setPayFor({ id: '', clientId: first.id } as VendorBill);
                setPayForm({ amount: '', date: todayStr(), method: 'cash', reference: '', notes: '' });
              }
            }}
            className={btnGhost}
            disabled={clients.length === 0}
          >
            <Plus className="h-3.5 w-3.5" /> Record payment
          </button>
        }
      >
        {voidablePayments.length === 0 ? (
          <p className="text-sm text-slate-500">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {voidablePayments.map((p) => {
              const client = clients.find((c) => c.id === str(p.clientId));
              const voided = bool(p.voidedAt);
              return (
                <li key={str(p.id)} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <div className={voided ? 'text-slate-400 line-through' : 'text-slate-700'}>
                      {str(client?.name) || 'Client'} · {fmtPaisa(num(p.amountPaisa))} · {str(p.method)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {str(p.paymentDate)}
                      {str(p.externalReference) ? ` · ref ${str(p.externalReference)}` : ''}
                      {voided ? ` · voided: ${str(p.voidReason)}` : ''}
                    </div>
                  </div>
                  {!voided && (
                    <button onClick={() => setVoidFor(p)} className={btnDanger}>
                      <Trash2 className="h-3.5 w-3.5" /> Void
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-slate-400">Payments are recorded as told by the vendor — they are not verified transactions.</p>
      </SectionCard>

      {/* create bill */}
      <ModalSheet isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create bill" maxWidth="xl">
        <div className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Client *</span>
            <select className={inputCls} value={billForm.clientId} onChange={(e) => { setBillForm({ ...billForm, clientId: e.target.value }); setPreview(null); }}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{str(c.name)}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Cycle</span>
              <select
                className={inputCls}
                value={billForm.cycle}
                onChange={(e) => {
                  const start = defaultPeriodStart(e.target.value);
                  setBillForm({ ...billForm, cycle: e.target.value, start });
                }}
              >
                <option value="weekly">Weekly</option>
                <option value="fifteenDays">Fifteen days</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Adjustment / discount (₹, − for discount)</span>
              <input type="number" step="0.5" className={inputCls} value={billForm.adjustment} onChange={(e) => { setBillForm({ ...billForm, adjustment: e.target.value }); setPreview(null); }} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Period start *</span>
              <input type="date" className={inputCls} value={billForm.start} onChange={(e) => { setBillForm({ ...billForm, start: e.target.value }); setPreview(null); }} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Period end *</span>
              <input type="date" className={inputCls} value={billForm.end} onChange={(e) => { setBillForm({ ...billForm, end: e.target.value }); setPreview(null); }} />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Notes (shown on bill)</span>
            <textarea rows={2} className={inputCls} value={billForm.notes} onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })} />
          </label>

          <div className="flex gap-2">
            <button onClick={doPreview} disabled={previewing || !billForm.clientId} className={btnGhost}>
              {previewing ? 'Calculating…' : 'Preview'}
            </button>
          </div>

          {preview && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1 text-sm">
              <Row label="Deliveries" value={`${recArr(preview.lineItems).length} entries`} />
              <Row label="Delivery total" value={fmtPaisa(num(preview.deliveryTotalPaisa))} />
              <Row label="Adjustments" value={fmtPaisa(num(preview.adjustmentsPaisa))} />
              <Row label="Opening balance" value={fmtPaisa(num(preview.openingBalancePaisa))} />
              <Row label="Payments recorded" value={`− ${fmtPaisa(num(preview.paymentsAppliedPaisa))}`} />
              <Row label="Balance" value={fmtPaisa(num(preview.balancePaisa))} strong />
              {recArr(preview.lineItems).length === 0 && (
                <p className="text-xs text-amber-700">No unbilled delivered deliveries in this period.</p>
              )}
              <div className="flex justify-end pt-2">
                <button onClick={doGenerate} disabled={generating || recArr(preview.lineItems).length === 0} className={btnPrimary}>
                  {generating ? 'Generating…' : 'Generate bill'}
                </button>
              </div>
            </div>
          )}
        </div>
      </ModalSheet>

      {/* bill detail */}
      <ModalSheet isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Bill ${detail.billNumber}` : 'Bill'} maxWidth="2xl">
        {detail && (
          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              {detail.clientName} · {detail.periodStart} → {detail.periodEnd} · {BILL_STATUSES[detail.status || 'generated']}
            </div>
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-emerald-600 text-white">
                  <tr>
                    <th className="text-left px-2 py-1.5">Date</th>
                    <th className="text-left px-2 py-1.5">Product</th>
                    <th className="text-right px-2 py-1.5">Qty</th>
                    <th className="text-right px-2 py-1.5">Rate</th>
                    <th className="text-right px-2 py-1.5">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recArr(detail.lineItems).map((item, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">{str(item.deliveryDate)}</td>
                      <td className="px-2 py-1.5">{str(item.productName)}</td>
                      <td className="px-2 py-1.5 text-right">{fmtMl(num(item.quantityMilliLitres))}</td>
                      <td className="px-2 py-1.5 text-right">{fmtPaisa(num(item.appliedRatePaisaPerUnit))}</td>
                      <td className="px-2 py-1.5 text-right">{fmtPaisa(num(item.amountPaisa))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1 text-sm">
              <Row label="Delivery total" value={fmtPaisa(num(detail.deliveryTotalPaisa))} />
              <Row label="Adjustments" value={fmtPaisa(num(detail.adjustmentsPaisa))} />
              <Row label="Opening balance" value={fmtPaisa(num(detail.openingBalancePaisa))} />
              <Row label="Payments recorded" value={`− ${fmtPaisa(num(detail.paymentsAppliedPaisa))}`} />
              <Row label="Balance due" value={fmtPaisa(num(detail.balancePaisa))} strong />
            </div>
            {num(detail.revisionNumber, 1) > 1 && (
              <p className="text-xs text-slate-500">Revision {num(detail.revisionNumber)} — supersedes an earlier version. The old PDF and link are no longer valid.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => downloadPdf(detail)} className={btnGhost}><Download className="h-3.5 w-3.5" /> Download PDF</button>
              {(detail.status === 'generated' || detail.status === 'shared') && (
                <button onClick={() => shareWhatsApp(detail)} className={btnPrimary}><MessageCircle className="h-3.5 w-3.5" /> Share on WhatsApp</button>
              )}
            </div>
          </div>
        )}
      </ModalSheet>

      {/* record payment */}
      <ModalSheet isOpen={!!payFor} onClose={() => setPayFor(null)} title={str(payFor?.billNumber) ? `Record payment — bill ${payFor?.billNumber}` : 'Record payment'} maxWidth="sm">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">This records money the customer paid you directly (cash/UPI/bank), outside Agrovercity. It is never marked “verified”.</p>
          {!str(payFor?.billNumber) && (
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Client *</span>
              <select className={inputCls} value={str(payFor?.clientId)} onChange={(e) => setPayFor({ ...(payFor as VendorBill), clientId: e.target.value })}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{str(c.name)}</option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Amount (₹) *</span>
              <input type="number" min="0" step="0.01" className={inputCls} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Date *</span>
              <input type="date" className={inputCls} value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Method</span>
            <select className={inputCls} value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bankTransfer">Bank transfer</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">External reference (optional)</span>
            <input className={inputCls} value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Notes</span>
            <textarea rows={2} className={inputCls} value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setPayFor(null)} className={btnGhost}>Cancel</button>
            <button onClick={savePayment} disabled={paySaving} className={btnPrimary}>{paySaving ? 'Saving…' : 'Record payment'}</button>
          </div>
        </div>
      </ModalSheet>

      {/* void payment */}
      <ModalSheet isOpen={!!voidFor} onClose={() => setVoidFor(null)} title="Void payment" maxWidth="sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Voiding keeps the audit record and recalculates balances. It never deletes history.</p>
          <textarea rows={2} className={inputCls} placeholder="Reason *" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setVoidFor(null)} className={btnGhost}>Cancel</button>
            <button onClick={doVoid} disabled={voidReason.trim().length < 3} className={btnDanger}>Void payment</button>
          </div>
        </div>
      </ModalSheet>

      {/* revise */}
      <ModalSheet isOpen={!!reviseFor} onClose={() => setReviseFor(null)} title={`Revise bill ${reviseFor?.billNumber ?? ''}`} maxWidth="sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">A new revision is created and the old bill + customer link stop working. Payments already recorded are kept.</p>
          <textarea rows={2} className={inputCls} placeholder="Revision reason *" value={reviseReason} onChange={(e) => setReviseReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setReviseFor(null)} className={btnGhost}>Cancel</button>
            <button onClick={doRevise} disabled={reviseReason.trim().length < 3} className={btnPrimary}>Create revision</button>
          </div>
        </div>
      </ModalSheet>

      {/* cancel */}
      <ModalSheet isOpen={!!cancelFor} onClose={() => setCancelFor(null)} title={`Cancel bill ${cancelFor?.billNumber ?? ''}`} maxWidth="sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Cancelling releases the deliveries (they can be billed again) and revokes the customer link. The bill record is preserved.</p>
          <textarea rows={2} className={inputCls} placeholder="Cancellation reason *" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setCancelFor(null)} className={btnGhost}>Keep bill</button>
            <button onClick={doCancel} disabled={cancelReason.trim().length < 3} className={btnDanger}>Cancel bill</button>
          </div>
        </div>
      </ModalSheet>
    </div>
  );
};

function defaultPeriodStart(cycle: string): string {
  const end = new Date();
  const start = new Date();
  if (cycle === 'weekly') start.setDate(end.getDate() - 6);
  else if (cycle === 'fifteenDays') start.setDate(end.getDate() - 14);
  else start.setDate(1);
  return start.toISOString().slice(0, 10);
}

const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className={`flex justify-between ${strong ? 'font-semibold text-slate-900 border-t border-slate-300 pt-1' : 'text-slate-600'}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);
