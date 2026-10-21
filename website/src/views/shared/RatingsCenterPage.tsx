import React, { useCallback, useEffect, useState } from 'react';
import { Award, Check, MessageSquare, RefreshCw, Send, Star, X } from 'lucide-react';
import { ratings, apiErrorMessage } from '../../lib/api';
import type {
  RatingGivenItem,
  RatingPendingItem,
  RatingReceivedItem,
  RatingsMine,
} from '../../lib/api/ratings';
import { RateUserModal } from '../../components/common/RateUserModal';
import { formatDate } from '../../lib/utils';

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

/** Prompt kind (WS-03) → bookingKind accepted by POST /ratings. */
const PROMPT_TO_BOOKING_KIND: Record<string, string> = {
  transport_delivery: 'transport',
  equipment_booking: 'equipment',
  course_enrollment: 'course_enrollment',
  marketplace_order: 'marketplace_order',
  lot_sale: 'lot_sale',
  lot_purchase: 'lot_purchase',
};

const KIND_LABELS: Record<string, string> = {
  transport_delivery: 'Transport delivery',
  transport_shipper: 'Transport trip (you carried)',
  equipment_booking: 'Equipment rental',
  course_enrollment: 'Course / training',
  marketplace_order: 'Marketplace order',
  lot_sale: 'Produce lot sale',
  lot_purchase: 'Produce lot purchase',
  land_lease: 'Land lease',
  dairy_collection: 'Dairy collection',
  contract_delivery: 'Contract delivery',
};

const kindLabel = (kind?: string): string => (kind && KIND_LABELS[kind]) || kind || 'Transaction';

/**
 * GET /ratings/given returns raw rating docs, so the tags the caller submitted
 * and any provider reply written by POST /ratings/{id}/reply ride along.
 */
type GivenRatingItem = RatingGivenItem & { reply?: string | null; repliedAt?: string };

type Tab = 'pending' | 'received' | 'given';

/** /ratings — cross-persona Ratings & Reviews center (SR 5). */
export const RatingsCenterPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<RatingPendingItem[]>([]);
  const [mine, setMine] = useState<RatingReceivedItem[]>([]);
  const [mineStats, setMineStats] = useState<{ average?: number | null; count?: number; trustTier?: string | null }>({});
  const [given, setGiven] = useState<GivenRatingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [rateFor, setRateFor] = useState<RatingPendingItem | null>(null);
  const [rateBusy, setRateBusy] = useState(false);

  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, m, g] = await Promise.all([
        ratings.pending().catch(() => [] as RatingPendingItem[]),
        ratings.mine().catch(() => ({}) as RatingsMine),
        ratings.given().catch(() => [] as RatingGivenItem[]),
      ]);
      setPending(Array.isArray(p) ? p : []);
      setMine(m?.recent ?? []);
      setMineStats({ average: m?.average, count: m?.count, trustTier: m?.trustTier });
      setGiven(Array.isArray(g) ? g : []);
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

  const submitPendingRating = async (stars: number, review: string, tags?: string[]) => {
    if (!rateFor) return;
    const bookingKind = PROMPT_TO_BOOKING_KIND[rateFor.kind];
    if (!bookingKind) throw new Error('This transaction type cannot be rated here yet.');
    setRateBusy(true);
    try {
      await ratings.submit({
        bookingKind,
        bookingId: rateFor.transactionId || rateFor.id,
        stars,
        ...(review ? { comment: review } : {}),
        ...(tags && tags.length > 0 ? { tags } : {}),
      });
      setRateFor(null);
      flash('Rating submitted — thank you for keeping the network honest.');
      await load();
    } finally {
      setRateBusy(false);
    }
  };

  const submitReply = async (ratingId: string) => {
    if (!replyText.trim()) return;
    setReplyBusy(true);
    setError(null);
    try {
      await ratings.reply(ratingId, { reply: replyText.trim() });
      setReplyingId(null);
      setReplyText('');
      flash('Reply posted on the review.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setReplyBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Award className="w-7 h-7 text-emerald-600" />
            Ratings & Reviews
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Rate transporters, equipment owners, instructors and trading partners — and reply to what they say about you
          </p>
        </div>
        <button
          onClick={load}
          className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 self-start sm:self-auto"
          title="Refresh"
        >
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

      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
        {[
          { id: 'pending', label: `Pending (${pending.length})` },
          { id: 'received', label: `Received (${mineStats.count ?? mine.length})` },
          { id: 'given', label: `Given by me (${given.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading ratings…</div>
      ) : tab === 'pending' ? (
        pending.length === 0 ? (
          <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">Nothing waiting for your rating</p>
            <p className="text-xs text-slate-500">
              When a delivery, rental, course or order completes, a rate prompt appears here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => {
              const rateable = Boolean(PROMPT_TO_BOOKING_KIND[p.kind]);
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{kindLabel(p.kind)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Ref {p.transactionId || p.id}
                      {p.createdAt ? ` · ${formatDate(p.createdAt)}` : ''}
                    </p>
                  </div>
                  {rateable ? (
                    <button
                      onClick={() => setRateFor(p)}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                    >
                      Rate now
                    </button>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400">Rate from the relevant module</span>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : tab === 'received' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-6">
            <div>
              <p className="text-2xl font-black text-slate-900">
                {mineStats.average != null ? mineStats.average.toFixed(1) : '—'}
              </p>
              <Stars value={Math.round(mineStats.average ?? 0)} />
            </div>
            <div className="text-xs text-slate-500 space-y-0.5">
              <p>
                <strong className="text-slate-800">{mineStats.count ?? 0}</strong> reviews received
              </p>
              {mineStats.trustTier && (
                <p>
                  Trust tier: <strong className="text-emerald-700 capitalize">{mineStats.trustTier}</strong>
                </p>
              )}
            </div>
          </div>

          {mine.length === 0 ? (
            <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700">No reviews received yet</p>
              <p className="text-xs text-slate-500">Complete bookings and ask your counterparty to rate you.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mine.map((r) => (
                <div key={r.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-slate-800">{r.raterName || 'Anonymous'}</span>
                    <Stars value={r.rating ?? 0} />
                  </div>
                  {r.comment ? <p className="text-slate-500">{r.comment}</p> : null}
                  {(r.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(r.tags ?? []).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-500 capitalize"
                        >
                          {t.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400">
                    {kindLabel(r.kind)} • {r.createdAt ? formatDate(r.createdAt) : ''}
                  </p>
                  {r.reply ? (
                    <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl">
                      <p className="text-[10px] font-bold text-sky-700 uppercase mb-0.5">Your reply</p>
                      <p className="text-slate-600">{r.reply}</p>
                    </div>
                  ) : replyingId === r.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder="Write a short, polite reply…"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => submitReply(r.id)}
                          disabled={replyBusy || !replyText.trim()}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] disabled:opacity-50 flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> Post reply
                        </button>
                        <button
                          onClick={() => {
                            setReplyingId(null);
                            setReplyText('');
                          }}
                          disabled={replyBusy}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 font-bold text-[11px] disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setReplyingId(r.id);
                        setReplyText('');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-sky-200 text-sky-700 hover:bg-sky-50 font-bold text-[11px] flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" /> Reply
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : given.length === 0 ? (
        <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
          <p className="text-sm font-bold text-slate-700">You have not rated anyone yet</p>
          <p className="text-xs text-slate-500">Open the Pending tab after a completed booking to leave your first rating.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {given.map((r) => (
            <div
              key={r.id}
              className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs text-xs space-y-2"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-slate-800">{kindLabel(r.bookingKind)}</span>
                <Stars value={r.stars ?? 0} />
              </div>
              {r.comment ? <p className="text-slate-500">{r.comment}</p> : null}
              {(r.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(r.tags ?? []).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-500 capitalize"
                    >
                      {t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-400">
                Ref {r.bookingId || r.id} • {r.createdAt ? formatDate(r.createdAt) : ''}
              </p>
              {r.reply ? (
                <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl">
                  <p className="text-[10px] font-bold text-sky-700 uppercase mb-0.5">Seller replied</p>
                  <p className="text-slate-600">{r.reply}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <RateUserModal
        open={Boolean(rateFor)}
        onClose={() => setRateFor(null)}
        title={rateFor ? `Rate this ${kindLabel(rateFor.kind).toLowerCase()}` : 'Rate'}
        subtitle={rateFor ? `Ref ${rateFor.transactionId || rateFor.id} — one rating per transaction` : undefined}
        submitLabel={rateBusy ? 'Submitting…' : 'Submit Rating'}
        onSubmit={submitPendingRating}
        {...(rateFor?.kind === 'marketplace_order'
          ? {
              tags: ['freshness', 'packing', 'on-time'],
              onSubmitTags: (stars: number, review: string, tags: string[]) =>
                submitPendingRating(stars, review, tags),
            }
          : {})}
      />
    </div>
  );
};
