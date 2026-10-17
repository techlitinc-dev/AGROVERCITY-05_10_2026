import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, FileText, Download, RefreshCcw, Gift } from 'lucide-react';
import { seller, purchases, referrals, apiClient, apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  arr,
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  LoadingBlock,
  num,
  paisaToRupees,
  primaryBtnCls,
  rec,
  str,
  type Rec,
} from './shared';

/** Seller compliance: TDS 194-O statements, GSTR-style sales register, platform commission invoices, referrals. */
export const SellerCompliancePage: React.FC = () => {
  const [tds, setTds] = useState<Rec[]>([]);
  const [gst, setGst] = useState<Rec>({});
  const [purchasesMine, setPurchasesMine] = useState<Rec[]>([]);
  const [commissionInvoices, setCommissionInvoices] = useState<Map<string, Rec>>(new Map());
  const [referral, setReferral] = useState<Rec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, p, ref] = await Promise.all([
        seller.tdsStatements().catch(() => [] as unknown[]),
        purchases.mine({ role: 'buyer' }).catch(() => [] as unknown[]),
        referrals.summary().catch(() => ({})),
      ]);
      setTds((t as unknown[]).map(rec));
      setPurchasesMine((p as unknown[]).map(rec));
      setReferral(rec(ref));
      // GST returns an object envelope with records — fetch raw to keep summary.
      const gstRes = await apiClient.get('/seller/gst-reports').catch(() => null);
      if (gstRes) setGst(rec(gstRes.data?.data ?? gstRes.data));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadTds = async () => {
    setActionError(null);
    try {
      const blob = await seller.tdsStatementPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tds-194o-statement.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const viewCommission = async (purchaseId: string) => {
    setActionError(null);
    try {
      const inv = rec(await seller.commissionInvoice(purchaseId));
      setCommissionInvoices((prev) => new Map(prev).set(purchaseId, inv));
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const gstSummary = rec(gst.summary);
  const gstRecords = arr(gst.records).map(rec);
  const invite = async () => {
    setActionError(null);
    setNotice(null);
    try {
      await referrals.invite({ channel: 'whatsapp' });
      setNotice('Referral invite prepared — share it from your registered channels');
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-emerald-600" />
            Compliance & Tax Centre
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            TDS 194-O statements, GSTR-style sales register, platform commission invoices and referrals
          </p>
        </div>
        <button onClick={() => void load()} className={ghostBtnCls}>
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">{notice}</div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TDS */}
          <div className={`${cardCls} p-6 space-y-4`}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">TDS 194-O Statements ({tds.length})</h3>
              <button onClick={() => void downloadTds()} className={ghostBtnCls}>
                <Download className="w-3.5 h-3.5 inline mr-1" /> Statement PDF
              </button>
            </div>
            {tds.length === 0 ? (
              <EmptyState label="No TDS statements issued yet" />
            ) : (
              <div className="space-y-2">
                {tds.map((t) => (
                  <div key={str(t.id ?? t.period)} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-xs">
                    <div>
                      <p className="font-bold text-slate-800">Period {str(t.period, '—')}</p>
                      <p className="text-[10px] text-slate-400">
                        Gross {formatCurrency(num(t.grossAmount, paisaToRupees(t.grossPaisa)))} · rate {num(t.tdsRatePct, 1)}%
                      </p>
                    </div>
                    <span className="font-black text-rose-700">−{formatCurrency(paisaToRupees(t.tdsPaisa))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GST */}
          <div className={`${cardCls} p-6 space-y-4`}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">GSTR-Style Sales Register</h3>
              <span className="text-[11px] text-slate-400 font-mono">{str(gst.sellerGstin)}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Taxable', value: formatCurrency(num(gstSummary.totalTaxable)) },
                { label: 'CGST + SGST', value: formatCurrency(num(gstSummary.totalCgst) + num(gstSummary.totalSgst)) },
                { label: 'Total Sales', value: formatCurrency(num(gstSummary.totalSales)) },
              ].map((s) => (
                <div key={s.label} className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">{s.label}</span>
                  <span className="text-sm font-black text-slate-900">{s.value}</span>
                </div>
              ))}
            </div>
            {gstRecords.length === 0 ? (
              <EmptyState label="No GST records in the selected period" />
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {gstRecords.map((r) => (
                  <div key={str(r.id)} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{str(r.buyer)} · {str(r.crop)}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(str(r.date))} · taxable {formatCurrency(num(r.taxableValue))}</p>
                    </div>
                    <span className="font-bold text-slate-900">{formatCurrency(num(r.invoiceValue))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Commission invoices */}
          <div className={`${cardCls} p-6 space-y-4`}>
            <h3 className="font-bold text-sm text-slate-900">Platform Commission Invoices</h3>
            <p className="text-[11px] text-slate-400">
              2% platform commission is invoiced per produce purchase. Pick a purchase to view its invoice.
            </p>
            {purchasesMine.length === 0 ? (
              <EmptyState label="No purchases to invoice yet" />
            ) : (
              <div className="space-y-2">
                {purchasesMine.slice(0, 6).map((p) => {
                  const inv = commissionInvoices.get(str(p.id));
                  return (
                    <div key={str(p.id)} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">
                          #{str(p.id)} · {str(p.crop)}
                        </span>
                        <button onClick={() => void viewCommission(str(p.id))} className={ghostBtnCls}>
                          <FileText className="w-3.5 h-3.5 inline mr-1" /> View Invoice
                        </button>
                      </div>
                      {inv && (
                        <p className="text-[11px] text-slate-500">
                          Commission {formatCurrency(num(inv.commissionAmount, paisaToRupees(inv.commissionPaisa)))} · GST{' '}
                          {formatCurrency(num(inv.gstAmount, paisaToRupees(inv.gstPaisa)))} · Total{' '}
                          <strong className="text-emerald-800">
                            {formatCurrency(num(inv.totalAmount, paisaToRupees(inv.totalPaisa)))}
                          </strong>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Referrals */}
          <div className={`${cardCls} p-6 space-y-4`}>
            <h3 className="font-bold text-sm text-slate-900">Refer & Earn</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Invited', value: num(referral.invitedCount ?? referral.totalInvited) },
                { label: 'Joined', value: num(referral.joinedCount ?? referral.totalJoined) },
                { label: 'Kisan Coins', value: num(referral.kisanCoins ?? referral.coinsEarned) },
              ].map((s) => (
                <div key={s.label} className="p-3 bg-emerald-50 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">{s.label}</span>
                  <span className="text-lg font-black text-emerald-900">{s.value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => void invite()} className={`${primaryBtnCls} w-full flex items-center justify-center gap-1.5`}>
              <Gift className="w-4 h-4" /> Invite a Fellow Vyapari
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
