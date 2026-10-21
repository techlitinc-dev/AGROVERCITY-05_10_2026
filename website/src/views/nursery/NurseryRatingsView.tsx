import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, Star, User } from 'lucide-react';
import { nursery } from '../../lib/api';

const REVIEW_TAGS: Record<string, string> = {
  HEALTHY_PLANTS: 'Healthy Plants',
  SECURE_PACKING: 'Secure Packing',
  ON_TIME_DELIVERY: 'On-Time Delivery',
};

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`}
        />
      ))}
    </div>
  );
}

export const NurseryRatingsView: React.FC = () => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [openReplyBox, setOpenReplyBox] = useState<string | null>(null);

  const loadRatings = () => {
    setLoading(true);
    nursery
      .ratings()
      .then((res) => setData((res as Record<string, unknown>) || {}))
      .catch(() => setError('Failed to load customer reviews'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRatings();
  }, []);

  const items = (data?.items as Array<Record<string, unknown>>) || [];
  const average = Number(data?.average || 0);
  const count = Number(data?.count || 0);

  const handleReply = async (ratingId: string) => {
    const text = (replyDrafts[ratingId] || '').trim();
    if (!text) return;
    setReplyingId(ratingId);
    setError(null);
    try {
      await nursery.replyToRating(ratingId, { reply: text });
      setOpenReplyBox(null);
      setReplyDrafts((prev) => ({ ...prev, [ratingId]: '' }));
      loadRatings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to post reply';
      setError(msg);
    } finally {
      setReplyingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500" />
            Customer Reviews & Ratings
          </h1>
          <p className="text-xs text-slate-500">
            Reviews received from farmers & landscapers for your nursery orders. Reply to build trust with buyers.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="text-center sm:text-left">
          <div className="text-4xl font-black text-slate-900">
            {average ? average.toFixed(1) : '—'}
          </div>
          <div className="mt-1 flex justify-center sm:justify-start">
            <StarRow value={Math.round(average)} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{count} review{count === 1 ? '' : 's'} received</p>
        </div>
        <div className="flex-1 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6">
          <p className="text-xs text-slate-600 leading-relaxed">
            Responding to reviews improves your nursery's visibility in the farmer directory and builds buyer
            confidence for bulk sapling orders.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
          {error}
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 font-bold">Loading reviews…</div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Reviews Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Reviews appear here once delivered orders are rated by buyers.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((rv) => {
            const rvId = String(rv.id || '');
            const rating = Number(rv.rating || 0);
            const tags = (rv.tags as string[]) || [];
            const productTitles = (rv.productTitles as string[]) || [];
            const reply = rv.reply ? String(rv.reply) : '';
            const replyBoxOpen = openReplyBox === rvId;
            return (
              <div
                key={rvId}
                className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{String(rv.raterName || 'Buyer')}</p>
                      <p className="text-[10px] text-slate-400">
                        {String(rv.createdAt || '').slice(0, 10)} • Order #{String(rv.orderId || '').slice(-8).toUpperCase()}
                        {productTitles.length > 0 && ` • ${productTitles.join(', ')}`}
                      </p>
                    </div>
                  </div>
                  <StarRow value={rating} />
                </div>

                {Boolean(rv.comment) && (
                  <p className="text-xs text-slate-700 leading-relaxed">“{String(rv.comment)}”</p>
                )}

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200"
                      >
                        {REVIEW_TAGS[t] || t}
                      </span>
                    ))}
                  </div>
                )}

                {reply ? (
                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs">
                    <p className="font-bold text-emerald-900 mb-0.5">Your Reply</p>
                    <p className="text-emerald-900/80">{reply}</p>
                  </div>
                ) : replyBoxOpen ? (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={replyDrafts[rvId] || ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [rvId]: e.target.value }))
                      }
                      placeholder="Write a polite thank-you reply…"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setOpenReplyBox(null)}
                        className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleReply(rvId)}
                        disabled={replyingId === rvId || !(replyDrafts[rvId] || '').trim()}
                        className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {replyingId === rvId ? 'Posting…' : 'Post Reply'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setOpenReplyBox(rvId)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    Reply to this review →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
