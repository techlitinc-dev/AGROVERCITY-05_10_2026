import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Milk } from 'lucide-react';
import { milkVendor } from '../../lib/api';
import { saveBlob, rec, recArr, str, num, fmtMl, fmtPaisa } from '../milkseller/vendor/shared';

/**
 * Public customer-facing milk bill page — reachable only via the vendor's
 * secure share link (/public/milk-bills/{token}). Shows exactly the bill the
 * vendor shared: no login, no KYC, no account needed.
 */
export const PublicMilkBill: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [bill, setBill] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token) return;
    milkVendor
      .publicBill(token)
      .then(setBill)
      .catch((e) => setError(e instanceof Error ? e.message : 'This bill link is invalid or has expired.'));
  }, [token]);

  const downloadPdf = async () => {
    if (!token) return;
    setDownloading(true);
    try {
      const blob = await milkVendor.publicBillPdf(token);
      saveBlob(blob, `milk_bill_${str(bill?.billNumber, 'bill')}.pdf`);
    } catch {
      setError('Could not download the PDF.');
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <Milk className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <h1 className="text-lg font-semibold text-slate-800">Bill unavailable</h1>
          <p className="text-sm text-slate-500 mt-1">{error}</p>
          <p className="text-xs text-slate-400 mt-3">Ask your vendor to share the bill again.</p>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <p className="text-sm text-slate-500">Loading your bill…</p>
      </div>
    );
  }

  const vendor = rec(bill.vendor);
  const client = rec(bill.client);
  const lineItems = recArr(bill.lineItems);

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900">{str(vendor.businessName) || str(vendor.displayName) || 'Milk Vendor'}</h1>
              {str(vendor.address) && <p className="text-xs text-slate-500 mt-0.5">{str(vendor.address)}</p>}
              {str(vendor.phone) && <p className="text-xs text-slate-500">{str(vendor.phone)}</p>}
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-semibold text-slate-800">Bill {str(bill.billNumber)}</div>
              {num(bill.revisionNumber, 1) > 1 && <div className="text-[11px] text-slate-400">revision {num(bill.revisionNumber)}</div>}
              <div className="text-[11px] text-slate-500">{str(bill.generatedAt)?.slice(0, 10)}</div>
            </div>
          </div>
          <div className="mt-3 text-sm text-slate-600 border-t border-slate-100 pt-3">
            {str(client.name)}
            {str(client.area) ? ` · ${str(client.area)}` : ''}
            <span className="text-slate-400"> · {str(bill.periodStart)} to {str(bill.periodEnd)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-emerald-600 text-white">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-right px-3 py-2">Rate</th>
                <th className="text-right px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-600">{str(item.deliveryDate)}</td>
                  <td className="px-3 py-2">{str(item.productName)}</td>
                  <td className="px-3 py-2 text-right">{fmtMl(num(item.quantityMilliLitres))}</td>
                  <td className="px-3 py-2 text-right">{fmtPaisa(num(item.appliedRatePaisaPerUnit))}</td>
                  <td className="px-3 py-2 text-right">{fmtPaisa(num(item.amountPaisa))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lineItems.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">No deliveries in this period.</p>}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-1 text-sm">
          <SummaryRow label="Delivery total" value={fmtPaisa(num(bill.deliveryTotalPaisa))} />
          {num(bill.adjustmentsPaisa) !== 0 && <SummaryRow label="Adjustments" value={fmtPaisa(num(bill.adjustmentsPaisa))} />}
          <SummaryRow label="Bill amount" value={fmtPaisa(num(bill.grossTotalPaisa))} strong />
          {num(bill.openingBalancePaisa) !== 0 && <SummaryRow label="Opening balance" value={fmtPaisa(num(bill.openingBalancePaisa))} />}
          {num(bill.paymentsAppliedPaisa) !== 0 && <SummaryRow label="Payments recorded" value={`− ${fmtPaisa(num(bill.paymentsAppliedPaisa))}`} />}
          <SummaryRow label="Balance due" value={fmtPaisa(num(bill.balancePaisa))} strong accent />
        </div>

        {(str(bill.paymentInstructions) || str(bill.upiId)) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-1">Payment instructions</h2>
            {str(bill.paymentInstructions) && <p className="text-sm text-slate-600 whitespace-pre-line">{str(bill.paymentInstructions)}</p>}
            {str(bill.upiId) && <p className="text-sm text-slate-700 mt-1">UPI: {str(bill.upiId)}</p>}
          </div>
        )}

        {str(bill.notes) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-600">{str(bill.notes)}</div>
        )}

        <button onClick={downloadPdf} disabled={downloading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          <Download className="h-4 w-4" /> {downloading ? 'Preparing…' : 'Download bill PDF'}
        </button>
        <p className="text-center text-[11px] text-slate-400">Pay your vendor directly as instructed. This page shows only this bill.</p>
      </div>
    </div>
  );
};

const SummaryRow: React.FC<{ label: string; value: string; strong?: boolean; accent?: boolean }> = ({ label, value, strong, accent }) => (
  <div className={`flex justify-between ${accent ? 'text-emerald-700' : strong ? 'font-semibold text-slate-900 border-t border-slate-200 pt-1' : 'text-slate-600'}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);
