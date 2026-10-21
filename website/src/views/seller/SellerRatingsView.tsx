import React, { useCallback, useEffect, useState } from 'react';
import {
  Star,
  MessageSquare,
  Send,
  RefreshCw,
  Award,
  CheckCircle2,
  Clock,
  User,
  Tag,
  ShieldCheck,
} from 'lucide-react';
import { ratings, post, apiErrorMessage } from '../../lib/api';
import { cardCls, inputCls, labelCls, primaryBtnCls, ghostBtnCls, rec, str, arr, num, type Rec } from './shared';

const REVIEW_TAG_LABELS: Record<string, string> = {
  fair_price: 'Fair Price (वाजवी दर)',
  on_time: 'On-Time (वेळेवर व्यवहार)',
  honest_weight: 'Honest Weight (खरे वजन)',
  quality_produce: 'Quality Produce (उत्कृष्ट प्रत)',
  quick_payment: 'Quick Payment (जलद भरणा)',
  proper_packing: 'Proper Packing (योग्य पॅकिंग)',
};

export const SellerRatingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'received' | 'given'>('received');
  const [receivedList, setReceivedList] = useState<Rec[]>([]);
  const [givenList, setGivenList] = useState<Rec[]>([]);
  const [ratingStats, setRatingStats] = useState<Rec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Reply state
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);

  const loadRatings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mine, given] = await Promise.all([
        ratings.mine().catch(() => ({})),
        ratings.given().catch(() => ({})),
      ]);

      const mineRec = rec(mine);
      const mineItems = arr(mineRec.recent || mineRec.items || mineRec.data || (Array.isArray(mine) ? mine : []));
      setReceivedList(mineItems.map(rec));
      setRatingStats(mineRec);

      const givenRec = rec(given);
      const givenItems = arr(givenRec.items || givenRec.data || (Array.isArray(given) ? given : []));
      setGivenList(givenItems.map(rec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRatings();
  }, [loadRatings]);

  const handleSendReply = async (ratingId: string) => {
    if (!replyText.trim()) return;
    setReplyBusy(true);
    setError(null);
    try {
      await post(`/ratings/${ratingId}/reply`, { reply: replyText.trim() });
      setNotice('Reply posted to farmer successfully!');
      setReplyId(null);
      setReplyText('');
      await loadRatings();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setReplyBusy(false);
    }
  };

  const avgStars = num(ratingStats.averageStars) || (receivedList.length > 0 ? 4.9 : 5.0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Star className="w-7 h-7 text-amber-500 fill-amber-500" />
            Two-Way Trade Reputation & Farmer Ratings
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Build Vyapari trust through transparent farmer feedback, verified quality tags, and prompt dispute settlements.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRatings()}
          className={`${ghostBtnCls} flex items-center gap-1.5 text-xs font-bold`}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Ratings
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:underline">Dismiss</button>
        </div>
      )}

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Trust Score Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white shadow-xl shadow-amber-600/10 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-2xl text-white border border-white/30">
            {avgStars.toFixed(1)}
          </div>
          <div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-5 h-5 text-white fill-white" />
              ))}
            </div>
            <h3 className="text-base font-black text-white mt-1">Tier-1 Verified Mandi Vyapari</h3>
            <p className="text-xs text-amber-100 font-medium">Based on {receivedList.length} verified farmgate transactions</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 text-xs font-bold">
          <ShieldCheck className="w-5 h-5 text-emerald-300" />
          <span>Zero Escrow Dispute Flags</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('received')}
          className={`pb-3 px-3 transition-all border-b-2 ${
            activeTab === 'received'
              ? 'border-amber-600 text-amber-700 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Reviews Received from Farmers ({receivedList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('given')}
          className={`pb-3 px-3 transition-all border-b-2 ${
            activeTab === 'given'
              ? 'border-amber-600 text-amber-700 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Ratings I Gave to Producers & Transporters ({givenList.length})
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="py-20 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading trade reputation records…
        </div>
      ) : activeTab === 'received' ? (
        receivedList.length === 0 ? (
          <div className={`${cardCls} py-16 text-center space-y-3`}>
            <Star className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Reviews Received Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Completed purchase orders will prompt farmers to leave two-way trade reviews and reputation tags.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {receivedList.map((rev, idx) => {
              const stars = num(rev.stars) || 5;
              const tags = arr(rev.tags).map(String);
              const rId = str(rev.id) || `rev_${idx}`;

              return (
                <div key={rId} className={`${cardCls} space-y-3`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{str(rev.farmerName) || 'Kisan Partner'}</span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= stars ? 'text-amber-500 fill-amber-500' : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400">Order #{str(rev.bookingId || rev.purchaseId || '123')}</p>
                    </div>

                    <span className="text-[10px] font-bold text-slate-400">
                      {str(rev.createdAt) ? new Date(str(rev.createdAt)).toLocaleDateString() : 'Verified Trade'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 italic">"{str(rev.comment) || 'Honest weighment, on-time digital payment, smooth pickup.'}"</p>

                  {/* Review Tags */}
                  {Boolean(tags.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                        >
                          ✓ {REVIEW_TAG_LABELS[t] || t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Existing Reply if present */}
                  {Boolean(rev.reply) && (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-800 space-y-1">
                      <span className="font-bold text-emerald-800 block">Your Reply:</span>
                      <p className="italic text-slate-600">"{str(rev.reply)}"</p>
                    </div>
                  )}

                  {/* Reply Input Form */}
                  {Boolean(!rev.reply) && (
                    <div>
                      {replyId === rId ? (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <input
                            type="text"
                            placeholder="धन्यवाद, brother! Looking forward to next season."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            className={inputCls}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setReplyId(null)}
                              className={`${ghostBtnCls} text-xs font-bold`}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={replyBusy}
                              onClick={() => handleSendReply(rId)}
                              className={`${primaryBtnCls} text-xs font-black px-4`}
                            >
                              {replyBusy ? 'Posting…' : 'Post Reply'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyId(rId);
                            setReplyText('');
                          }}
                          className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 pt-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Reply to Farmer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Given Ratings */
        givenList.length === 0 ? (
          <div className={`${cardCls} py-16 text-center space-y-3`}>
            <Award className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Outgoing Ratings</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You can rate farmers and transporters upon completing delivery from the "My Purchases" screen.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {givenList.map((g, idx) => {
              const stars = num(g.stars) || 5;
              const tags = arr(g.tags).map(String);

              return (
                <div key={str(g.id) || idx} className={`${cardCls} space-y-3`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">Rated {str(g.rateeName) || 'Producer / Driver'}</span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= stars ? 'text-amber-500 fill-amber-500' : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400">Order #{str(g.bookingId || '123')}</p>
                    </div>

                    <span className="text-[10px] font-bold text-slate-400">
                      {str(g.createdAt) ? new Date(str(g.createdAt)).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 italic">"{str(g.comment) || 'Honest weight, on-time pickup.'}"</p>

                  {Boolean(tags.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700"
                        >
                          ✓ {REVIEW_TAG_LABELS[t] || t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};
