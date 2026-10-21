import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Check,
  Handshake,
  RefreshCw,
  Scale,
  Sprout,
  Timer,
} from 'lucide-react';
import { apiErrorMessage, customer } from '../../lib/api';
import { formatCurrency, formatDateTime, formatPaisa } from '../../lib/utils';
import { asRecord, num, str, type AnyRecord } from './mallMappers';

const MAX_COUNTER_ROUNDS = 3;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Sent · awaiting farmer',
  countered: 'Countered',
  accepted: 'Accepted',
  quote_pending: 'Subscription quote',
  expired: 'Expired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

interface QuoteDoc extends AnyRecord {
  id?: string;
  crop?: string;
  offeredPricePerQuintal?: number;
  quantityQuintals?: number;
  totalValueRupees?: number;
  status?: string;
  counterRounds?: number;
  negotiationRound?: number;
  farmerName?: string;
  farmerId?: string;
  lotId?: string;
  deliveryMode?: string;
  notes?: string;
  expiresAt?: string;
  priceLockUntil?: string;
  fairPriceBand?: { minUnitPaisa?: number | null; maxUnitPaisa?: number | null; sampleSize?: number } | null;
}

function bandLabel(band: QuoteDoc['fairPriceBand']): string | null {
  if (!band || band.sampleSize === 0 || band.minUnitPaisa == null || band.maxUnitPaisa == null) return null;
  return `${formatPaisa(band.minUnitPaisa)} – ${formatPaisa(band.maxUnitPaisa)}`;
}

export const ProduceQuotesView: React.FC = () => {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<QuoteDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterReason, setCounterReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await customer.quotes();
      const list = (Array.isArray(payload) ? payload : []) as QuoteDoc[];
      list.sort((a, b) => str(b.createdAt).localeCompare(str(a.createdAt)));
      setQuotes(list);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCounter = (quote: QuoteDoc) => {
    setCounterFor(str(quote.id));
    setCounterPrice(String(num(quote.offeredPricePerQuintal)));
    setCounterReason('');
    setNotice(null);
  };

  const handleCounter = async () => {
    if (!counterFor || busy) return;
    const price = parseFloat(counterPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError('Enter a valid counter price per quintal.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await customer.counterQuote(counterFor, { counterPricePerQuintal: price, reason: counterReason });
      setCounterFor(null);
      setNotice('Counter sent — the farmer has 24h to respond.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async (quote: QuoteDoc) => {
    const id = str(quote.id);
    if (!id || acceptingId) return;
    setAcceptingId(id);
    setError(null);
    try {
      const order = asRecord(await customer.acceptQuote(id));
      setNotice(`Quote accepted — FarmGate order ${str(order.id) || 'created'} is now confirmed.`);
      setTimeout(() => navigate('/customer/procurements'), 900);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/customer/orders"
        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-700"
      >
        <ArrowLeft className="w-4 h-4" />
        All Orders
      </Link>

      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Handshake className="w-7 h-7 text-emerald-600" />
          Produce Quote Inbox
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Binding quote requests and farmer responses — max {MAX_COUNTER_ROUNDS} counter rounds per quote, 24h
          validity each.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          {notice}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-5 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3 mt-2" />
            </div>
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-400 flex items-center justify-center mx-auto">
            <Handshake className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-base text-slate-800">No quotes yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Request a binding quote from any farmer storefront — it will land here with the fair-price band
            annotated.
          </p>
          <Link
            to="/customer/produce"
            className="inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            Browse Produce
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => {
            const id = str(quote.id);
            const roundsUsed = num(quote.counterRounds);
            const remaining = MAX_COUNTER_ROUNDS - roundsUsed;
            const counterable = ['pending', 'countered'].includes(str(quote.status)) && remaining > 0;
            const acceptable = counterable;
            const band = bandLabel(quote.fairPriceBand);
            return (
              <div
                key={id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">{str(quote.crop, 'Produce')}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {quote.farmerName ? `${quote.farmerName} · ` : ''}
                      {num(quote.quantityQuintals)} q · {formatCurrency(num(quote.offeredPricePerQuintal))}/q
                      {quote.totalValueRupees ? ` · ${formatCurrency(num(quote.totalValueRupees))} total` : ''}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wide">
                    {STATUS_LABEL[str(quote.status)] ?? str(quote.status, '—')}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                  {band && (
                    <span className="px-2 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 flex items-center gap-1">
                      <Scale className="w-3 h-3" />
                      Fair band (90d): {band}
                    </span>
                  )}
                  <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    {remaining}/{MAX_COUNTER_ROUNDS} counter rounds left
                  </span>
                  {quote.expiresAt && (
                    <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 flex items-center gap-1">
                      <Timer className="w-3 h-3" />
                      Valid until {formatDateTime(quote.expiresAt)}
                    </span>
                  )}
                  {quote.deliveryMode && (
                    <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700">
                      {str(quote.deliveryMode).replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                {quote.notes && <p className="text-[11px] text-slate-500 italic">“{str(quote.notes)}”</p>}

                {(acceptable || counterable) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {acceptable && (
                      <button
                        type="button"
                        onClick={() => void handleAccept(quote)}
                        disabled={acceptingId !== null}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <BadgeCheck className="w-4 h-4" />
                        {acceptingId === id ? 'Accepting…' : 'Accept → create order'}
                      </button>
                    )}
                    {counterable && (
                      <button
                        type="button"
                        onClick={() => openCounter(quote)}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Counter
                      </button>
                    )}
                  </div>
                )}

                {counterFor === id && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="1"
                        value={counterPrice}
                        onChange={(e) => setCounterPrice(e.target.value)}
                        placeholder="Counter price (Rs / quintal)"
                        className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                      />
                      <input
                        type="text"
                        value={counterReason}
                        onChange={(e) => setCounterReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCounterFor(null)}
                        className="flex-1 py-2 rounded-xl bg-white border border-slate-200 font-bold text-xs text-slate-600"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCounter()}
                        disabled={busy}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white disabled:opacity-50"
                      >
                        {busy ? 'Sending…' : `Send counter (${remaining} left)`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-center">
        <Link
          to="/customer/produce"
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5"
        >
          <Sprout className="w-4 h-4 text-emerald-600" />
          Browse more produce
        </Link>
      </div>
    </div>
  );
};
