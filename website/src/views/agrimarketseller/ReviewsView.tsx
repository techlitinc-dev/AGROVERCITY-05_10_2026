import React, { useCallback, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller } from '../../lib/api';

interface Review {
  id: string;
  stars?: number;
  comment?: string;
  raterId?: string;
  createdAt?: string;
  sellerResponse?: string;
  sellerResponseStatus?: string;
}

export const ReviewsView: React.FC = () => {
  const [items, setItems] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [respondFor, setRespondFor] = useState<Review | null>(null);
  const [response, setResponse] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await agriMarketSeller.reviews()) as unknown as Review[]);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async () => {
    if (!respondFor || !response.trim()) return;
    setBusyId(respondFor.id);
    try {
      const res = (await agriMarketSeller.respondReview(respondFor.id, response.trim())) as { sellerResponseStatus?: string };
      setNotice(res.sellerResponseStatus === 'approved' ? 'Response published.' : 'Response rejected by moderation.');
      setRespondFor(null);
      setResponse('');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && <p className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</p>}
      {notice && <p className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800">{notice}</p>}

      {items.map((r) => (
        <div key={r.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1 text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-3.5 h-3.5 ${i < (r.stars ?? 0) ? 'fill-amber-400' : 'text-slate-200'}`} />
              ))}
              <span className="ml-2 text-[10px] font-bold text-slate-400">verified purchase</span>
            </p>
            <span className="text-[10px] text-slate-400">{r.createdAt?.slice(0, 10)}</span>
          </div>
          <p className="text-[11px] text-slate-600">{r.comment}</p>
          {r.sellerResponse ? (
            <p className="text-[11px] bg-emerald-50 rounded-xl p-2 text-emerald-900">
              Your response ({r.sellerResponseStatus}): {r.sellerResponse}
            </p>
          ) : (
            <button
              onClick={() => setRespondFor(r)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold"
            >
              Respond to review
            </button>
          )}
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No verified-purchase reviews yet.</p>}

      {respondFor && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs p-5 space-y-3">
          <p className="text-xs font-black text-slate-900">Respond to review</p>
          <textarea
            rows={3}
            className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Your public response — held subject to moderation before display."
          />
          <div className="flex gap-2">
            <button
              onClick={() => void respond()}
              disabled={busyId === respondFor.id || !response.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
            >
              Submit response
            </button>
            <button onClick={() => setRespondFor(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
