import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Award, Check, RefreshCw, Star, X } from 'lucide-react';
import { ratings, transport, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ModalSheet } from '../../components/common/ModalSheet';
import { asArr, asRec, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

const FARMER_RATING_TAGS = [
  { id: 'load_ready_on_time', label: 'Load ready on time' },
  { id: 'accurate_weight', label: 'Accurate weight' },
  { id: 'good_communication', label: 'Good communication' },
  { id: 'delayed_loading', label: 'Delayed loading' },
  { id: 'load_not_as_described', label: 'Load not as described' },
];

const Stars: React.FC<{ value: number; size?: number }> = ({ value, size = 4 }) => (
  <span className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        style={{ width: size * 3.5, height: size * 3.5 }}
        className={i <= value ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}
      />
    ))}
  </span>
);

/** /transporter/ratings — two-way reputation: ratings received and given. */
export const TransporterRatingsView: React.FC = () => {
  const [tab, setTab] = useState<'received' | 'given'>('received');
  const [received, setReceived] = useState<Rec[]>([]);
  const [given, setGiven] = useState<Rec[]>([]);
  const [pending, setPending] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [rateFor, setRateFor] = useState<Rec | null>(null);
  const [rateStars, setRateStars] = useState(5);
  const [rateReview, setRateReview] = useState('');
  const [rateTags, setRateTags] = useState<string[]>([]);
  const [rateBusy, setRateBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, g, p] = await Promise.all([
        transport.ratings(),
        transport.ratingsGiven().catch(() => [] as unknown[]),
        ratings.pending().catch(() => [] as unknown[]),
      ]);
      setReceived(asArr(r).map(asRec));
      setGiven(asArr(g).map(asRec));
      setPending(asArr(p).map(asRec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const openRate = (p: Rec) => {
    setRateFor(p);
    setRateStars(5);
    setRateReview('');
    setRateTags([]);
  };

  const submitRating = async () => {
    if (!rateFor) return;
    const bookingId = firstStr(rateFor, ['bookingId', 'refId', 'id'], '');
    if (!bookingId) return;
    setRateBusy(true);
    setError(null);
    try {
      await transport.rateFarmer(bookingId, {
        rating: rateStars,
        ...(rateReview.trim() ? { review: rateReview.trim() } : {}),
        tags: rateTags,
      });
      setRateFor(null);
      flash('Farmer rated — thank you for keeping the network honest.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setRateBusy(false);
    }
  };

  const rows = tab === 'received' ? received : given;
  const avg = rows.length ? rows.reduce((s, r) => s + firstNum(r, ['stars', 'rating'], 0), 0) / rows.length : 0;

  const renderRow = (r: Rec, otherParty: string) => (
    <div key={str(r.id) || JSON.stringify(r).slice(0, 24)} className="p-4 bg-slate-50 rounded-2xl text-xs space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-bold text-slate-800">{otherParty}</span>
        <Stars value={firstNum(r, ['stars', 'rating'], 0)} />
      </div>
      {firstStr(r, ['comment', 'review'], '') !== '—' && <p className="text-slate-500">{firstStr(r, ['comment', 'review'])}</p>}
      {asArr(r.tags).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {asArr(r.tags).map((t) => (
            <span key={str(t)} className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-500 capitalize">
              {str(t).replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-400">
        Trip {firstStr(r, ['bookingId'], '—')} • {fmtDate(r.createdAt)}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/transporter" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Transporter Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Award className="w-7 h-7 text-emerald-600" />
            Ratings & Reputation
          </h1>
          <p className="text-xs text-slate-500 mt-1">Two-way feedback — what farmers say about you and what you reported back</p>
        </div>
        <button onClick={load} className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 self-start sm:self-auto" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pending farmer ratings */}
      {pending.length > 0 && (
        <div className="bg-amber-50/60 rounded-3xl p-5 border border-amber-100 space-y-3">
          <h3 className="font-bold text-sm text-amber-900">Pending — rate the farmer after delivery</h3>
          <div className="space-y-2">
            {pending.slice(0, 5).map((p) => (
              <div key={str(p.id) || JSON.stringify(p).slice(0, 24)} className="flex items-center justify-between gap-2 bg-white rounded-2xl p-3 border border-amber-100 text-xs">
                <div>
                  <p className="font-bold text-slate-800">{firstStr(p, ['label', 'title'], 'Rate this trip')}</p>
                  <p className="text-slate-400">
                    Trip {firstStr(p, ['bookingId', 'refId', 'id'], '—')} • {firstStr(p, ['counterpartyName', 'farmerName'], 'Farmer')}
                  </p>
                </div>
                <button
                  onClick={() => openRate(p)}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                >
                  Rate farmer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
        {[
          { id: 'received', label: `Received (${received.length})` },
          { id: 'given', label: `Given by me (${given.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'received' | 'given')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto self-center pr-3 flex items-center gap-1.5 text-xs">
          <Stars value={Math.round(avg)} />
          <span className="font-bold text-slate-700">{rows.length ? avg.toFixed(1) : '—'}</span>
        </div>
      </div>

      {rows.length === 0 && !loading ? (
        <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
          <p className="text-sm font-bold text-slate-700">
            {tab === 'received' ? 'No ratings received yet' : 'You have not rated any farmer yet'}
          </p>
          <p className="text-xs text-slate-500">
            {tab === 'received'
              ? 'Deliver trips and ask shippers to rate you — stars appear here.'
              : 'After a delivered trip, rate the farmer from the pending list above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) =>
            renderRow(
              r,
              tab === 'received'
                ? firstStr(r, ['farmerName', 'raterName', 'providerName'], `Trip ${firstStr(r, ['bookingId'], '')}`)
                : firstStr(r, ['farmerName', 'providerName'], `Farmer • Trip ${firstStr(r, ['bookingId'], '')}`)
            )
          )}
        </div>
      )}

      {/* Rate farmer modal */}
      <ModalSheet
        isOpen={!!rateFor}
        onClose={() => setRateFor(null)}
        title="Rate the farmer"
        description={rateFor ? `Trip ${firstStr(rateFor, ['bookingId', 'refId', 'id'], '—')} — one rating per trip` : undefined}
        maxWidth="sm"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-1.5 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} onClick={() => setRateStars(i)} type="button" title={`${i} star`}>
                <Star className={`w-8 h-8 ${i <= rateStars ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tags (optional)</label>
            <div className="flex flex-wrap gap-1.5">
              {FARMER_RATING_TAGS.map((t) => {
                const on = rateTags.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setRateTags((prev) => (on ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Review (optional)</label>
            <textarea value={rateReview} onChange={(e) => setRateReview(e.target.value)} rows={3} maxLength={500} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" placeholder="Load was ready on time, weight matched the slip…" />
          </div>
          <button
            onClick={submitRating}
            disabled={rateBusy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60"
          >
            Submit Rating
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
