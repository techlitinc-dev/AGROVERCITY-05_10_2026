import React, { useCallback, useEffect, useState } from 'react';
import { ShoppingBag, RefreshCcw, Star, ShieldCheck, MapPin, Search } from 'lucide-react';
import { directBuyer, purchases, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import {
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  num,
  primaryBtnCls,
  rec,
  str,
  type Rec,
} from './shared';

/**
 * Farm-gate feed: matched lots (from saved farmers / demanded crops) plus the
 * full live farmer-post board with ratings — buy now materializes a purchase.
 */
export const BuyerFeedPage: React.FC = () => {
  const [feed, setFeed] = useState<Rec[]>([]);
  const [posts, setPosts] = useState<Rec[]>([]);
  const [saved, setSaved] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cropFilter, setCropFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, p, s] = await Promise.all([
        directBuyer.feed().catch(() => [] as unknown[]),
        directBuyer.farmerPosts({ crop: cropFilter || undefined }).catch(() => [] as unknown[]),
        directBuyer.savedFarmers().catch(() => [] as unknown[]),
      ]);
      setFeed((f as unknown[]).map(rec));
      setPosts((p as unknown[]).map(rec));
      setSaved((s as unknown[]).map(rec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [cropFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, successMsg?: string) => {
      setActionError(null);
      setNotice(null);
      try {
        await fn();
        if (successMsg) setNotice(successMsg);
        await load();
      } catch (err) {
        setActionError(apiErrorMessage(err));
      }
    },
    [load]
  );

  // buy-now
  const [buyTarget, setBuyTarget] = useState<Rec | null>(null);
  const [buyQty, setBuyQty] = useState(10);

  const savedIds = new Set(saved.map((s) => str(s.farmerId ?? s.id)));

  const LotCard: React.FC<{ lot: Rec; matched?: boolean }> = ({ lot, matched }) => {
    const farmerId = str(lot.farmerId);
    const rating = num(lot.farmerRating);
    return (
      <div className={`${cardCls} p-5 space-y-3`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm text-slate-900">{str(lot.crop)}</h4>
              <StatusBadge status={str(lot.status, 'open')} />
              {matched && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">MATCHED</span>}
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> {str(lot.farmerName)} · {str(lot.farmerVillage || lot.location)} {str(lot.district)}
              {rating > 0 && (
                <span className="flex items-center gap-0.5 text-amber-600 font-bold ml-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {rating.toFixed(1)}
                </span>
              )}
              {num(lot.farmerVerified) === 1 && (
                <span className="flex items-center gap-0.5 text-sky-600 font-bold">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-black text-emerald-800">
            {formatCurrency(num(lot.expectedRate ?? lot.expectedPricePerQuintal))}
            <span className="text-xs font-semibold text-slate-500">/q</span>
          </span>
          <span className="text-xs font-bold text-slate-600">{formatWeight(num(lot.quantityQuintals ?? lot.quantity))}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setBuyTarget(lot);
              setBuyQty(num(lot.quantityQuintals ?? lot.quantity, 10));
            }}
            className={`${primaryBtnCls} flex-1`}
          >
            Buy Now
          </button>
          {savedIds.has(farmerId) ? (
            <button onClick={() => void act(() => directBuyer.unsaveFarmer(farmerId))} className={ghostBtnCls}>
              Unsave
            </button>
          ) : (
            <button onClick={() => void act(() => directBuyer.saveFarmer(farmerId), 'Farmer saved')} className={ghostBtnCls}>
              Save Farmer
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-emerald-600" />
            Farm-gate Buying Feed
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Matched lots from your saved farmers and demanded crops, plus every live farmer post
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inputCls} pl-8 w-48`} placeholder="Filter crop…" value={cropFilter} onChange={(e) => setCropFilter(e.target.value)} />
          </div>
          <button onClick={() => void load()} className={ghostBtnCls}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> {notice}
        </div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Matched For You ({feed.length})</h3>
            {feed.length === 0 ? (
              <div className={cardCls}>
                <EmptyState label="No matched lots — save farmers or post demands to get matches" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {feed.map((lot) => (
                  <LotCard key={`f-${str(lot.id)}`} lot={lot} matched />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900">All Farmer Posts ({posts.length})</h3>
            {posts.length === 0 ? (
              <div className={cardCls}>
                <EmptyState label="No live farmer posts right now" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {posts.map((lot) => (
                  <LotCard key={`p-${str(lot.id)}`} lot={lot} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* buy now */}
      <ModalSheet isOpen={Boolean(buyTarget)} onClose={() => setBuyTarget(null)} title="Buy Now" description={buyTarget ? `${str(buyTarget.crop)} from ${str(buyTarget.farmerName)}` : undefined} maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!buyTarget) return;
            void act(() => purchases.create({ lotId: str(buyTarget.id), quantity: buyQty }), 'Purchase booked — track it from the home desk');
            setBuyTarget(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Quantity (q)</label>
            <input
              type="number"
              className={inputCls}
              value={buyQty}
              max={num(buyTarget?.quantityQuintals)}
              onChange={(e) => setBuyQty(Number(e.target.value))}
              required
            />
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
            Order value:{' '}
            <strong className="text-emerald-800">
              {buyTarget ? formatCurrency(buyQty * num(buyTarget.expectedRate ?? buyTarget.expectedPricePerQuintal)) : ''}
            </strong>{' '}
            — pay advance from the purchase detail to lock it in escrow.
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Confirm Purchase</button>
        </form>
      </ModalSheet>
    </div>
  );
};
