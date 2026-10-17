import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ScrollText,
  ShieldCheck,
  RefreshCw,
  BadgeCheck,
  XCircle,
  Scale,
} from 'lucide-react';
import { postHarvest, apiErrorMessage } from '../../../lib/api';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { str, num, type Row } from './types';

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    <div className="text-sm font-semibold text-slate-800 mt-0.5">{value || '—'}</div>
  </div>
);

/** e-NWR lookup — warehouse receipt with verifiable certificate hash (pledge collateral). */
export const ReceiptLookupView: React.FC = () => {
  const { receiptNumber } = useParams<{ receiptNumber: string }>();
  const [receipt, setReceipt] = useState<Row | null>(null);
  const [certificate, setCertificate] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [certError, setCertError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!receiptNumber) return;
    setLoading(true);
    setError(null);
    setCertError(null);
    try {
      const decoded = decodeURIComponent(receiptNumber);
      const [r, c] = await Promise.all([
        postHarvest.receipt(decoded) as Promise<unknown>,
        postHarvest.receiptCertificate(decoded) as Promise<unknown>,
      ]);
      setReceipt(r as Row);
      setCertificate(c as Row);
    } catch (e) {
      setError(apiErrorMessage(e));
      setReceipt(null);
      setCertificate(null);
    } finally {
      setLoading(false);
    }
  }, [receiptNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const verification = (certificate?.verification ?? null) as Row | null;
  const valid = certificate?.valid === true;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <Link to="/coldStorageProvider/bookings" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to bookings
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <ScrollText className="w-7 h-7 text-emerald-600" />
          Electronic Negotiable Warehouse Receipt
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          WDRA e-NWR — pledgeable collateral for warehouse-receipt financing
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="min-h-[30vh] flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
        </div>
      ) : receipt ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Receipt Number</span>
                <div className="text-lg font-black font-mono text-slate-900">{str(receipt.receiptNumber)}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={str(receipt.status, 'active')} />
                  <span className="text-[11px] text-slate-500">Issued {formatDate(str(receipt.issueDate))}</span>
                </div>
              </div>
              {receipt.pledgeFinancingEligible ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Scale className="w-3.5 h-3.5" /> Pledge-financing eligible
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <XCircle className="w-3.5 h-3.5" /> Not pledge eligible
                </span>
              )}
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Depositor" value={str(receipt.depositorName)} />
              <Field label="Phone" value={str(receipt.depositorPhone)} />
              <Field label="Facility" value={str(receipt.facilityName)} />
              <Field label="WDRA Reg No" value={str(receipt.wdraRegNo)} />
              <Field label="Commodity" value={`${str(receipt.cropName)}${receipt.variety ? ` · ${str(receipt.variety)}` : ''}`} />
              <Field label="Net Quantity" value={`${num(receipt.netQuintals)} q in ${num(receipt.bagsCount)} bags`} />
              <Field label="QC Grade" value={str(receipt.qcGrade)} />
              <Field label="Moisture" value={receipt.moisturePercent !== undefined ? `${num(receipt.moisturePercent)}%` : '—'} />
              <Field label="Chamber" value={str(receipt.chamberName)} />
              <Field label="Lot Number" value={str(receipt.lotNumber)} />
              <Field label="Agreed Valuation" value={formatCurrency(num(receipt.valuationRupees))} />
              <Field label="Linked Booking" value={str(receipt.bookingId)} />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden h-fit">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Verifiable Certificate
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {certError && (
                <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {certError}
                </p>
              )}
              {certificate ? (
                <>
                  <div className={`rounded-2xl p-4 text-center border ${valid ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                    {valid ? (
                      <BadgeCheck className="w-8 h-8 text-emerald-600 mx-auto" />
                    ) : (
                      <XCircle className="w-8 h-8 text-rose-600 mx-auto" />
                    )}
                    <div className={`mt-1.5 text-sm font-black ${valid ? 'text-emerald-800' : 'text-rose-800'}`}>
                      {valid ? 'Certificate Valid' : 'Certificate Void'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold">HMAC-SHA256 over immutable issuance fields</div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Certificate Hash</span>
                      <div className="mt-0.5 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 font-mono text-[10px] break-all text-slate-700">
                        {str(verification?.certificateHash)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-bold">Issued At</span>
                      <span className="font-semibold text-slate-800">{formatDate(str(verification?.issuedAt))}</span>
                    </div>
                    {verification?.verifyUrl ? (
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Public Verify URL</span>
                        <div className="mt-0.5 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 font-mono text-[10px] break-all text-slate-700">
                          {str(verification.verifyUrl)}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Anyone can call this endpoint without a token to verify authenticity (redacted view).
                        </p>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400">Certificate unavailable.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
