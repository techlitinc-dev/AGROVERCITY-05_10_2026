import React, { useCallback, useEffect, useState } from 'react';
import { Inbox as InboxIcon, Check, X, RefreshCcw, Send } from 'lucide-react';
import { offers, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight, formatDate } from '../../lib/utils';
import type { TradeOffer } from '../../types';
import {
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  primaryBtnCls,
} from './shared';

/** Buyer offer inbox: farmer quotes on the buyer's demands — counter, accept, reject. */
export const OfferInboxPage: React.FC = () => {
  const [received, setReceived] = useState<TradeOffer[]>([]);
  const [sent, setSent] = useState<TradeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, s] = await Promise.all([
        offers.mine({ filter: 'received' }).catch(() => [] as TradeOffer[]),
        offers.mine({ filter: 'sent' }).catch(() => [] as TradeOffer[]),
      ]);
      setReceived(r);
      setSent(s);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      setActionError(null);
      try {
        await fn();
        await load();
      } catch (err) {
        setActionError(apiErrorMessage(err));
      }
    },
    [load]
  );

  const [counterTarget, setCounterTarget] = useState<TradeOffer | null>(null);
  const [counterPrice, setCounterPrice] = useState(4700);
  const [counterMsg, setCounterMsg] = useState('');

  const pendingReceived = received.filter((o) => o.status === 'pending' || o.status === 'countered');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <InboxIcon className="w-7 h-7 text-emerald-600" />
            Offer Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Farmer supply quotes against your demands — accept to convert into a purchase, or counter (one round)
          </p>
        </div>
        <button onClick={() => void load()} className={ghostBtnCls}>
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {loading && <LoadingBlock />}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Received Offers ({pendingReceived.length} pending)</h3>
            {received.length === 0 ? (
              <div className={cardCls}>
                <EmptyState label="No offers received yet — post a demand to attract farmer quotes" />
              </div>
            ) : (
              received.map((o) => (
                <div key={o.id} className={`${cardCls} p-5 space-y-2.5`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{o.senderName}</p>
                      <p className="text-[11px] text-slate-400">
                        {o.lotCrop || o.targetType} · {formatDate(o.createdAt)}
                        {o.counterRound > 0 ? ` · round ${o.counterRound}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="text-xs text-slate-700">
                    Quotes <strong className="text-emerald-800">{formatCurrency(o.pricePerUnit)}</strong> for{' '}
                    <strong>{formatWeight(o.quantity)}</strong>
                    {o.counterPrice ? (
                      <span className="block text-[11px] text-slate-500">
                        Countered at {formatCurrency(o.counterPrice)}
                      </span>
                    ) : null}
                  </p>
                  {o.message && <p className="text-[11px] text-slate-500 italic">“{o.message}”</p>}
                  {(o.status === 'pending' || o.status === 'countered') && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => void act(() => offers.accept(o.id))} className={`${primaryBtnCls} flex-1`}>
                        <Check className="w-3.5 h-3.5 inline mr-1" /> Accept
                      </button>
                      <button
                        onClick={() => {
                          setCounterTarget(o);
                          setCounterPrice(o.counterPrice || o.pricePerUnit);
                          setCounterMsg('');
                        }}
                        className={`${ghostBtnCls} flex-1`}
                      >
                        Counter
                      </button>
                      <button onClick={() => void act(() => offers.reject(o.id, 'Price/terms not acceptable'))} className={`${ghostBtnCls} flex-1`}>
                        <X className="w-3.5 h-3.5 inline mr-1" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Offers I Sent ({sent.length})</h3>
            {sent.length === 0 ? (
              <div className={cardCls}>
                <EmptyState label="No offers sent to farmers yet" />
              </div>
            ) : (
              sent.map((o) => (
                <div key={o.id} className={`${cardCls} p-4 flex items-center justify-between gap-3`}>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {o.lotCrop || o.targetType} → {o.receiverName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatCurrency(o.pricePerUnit)}/unit · Qty {o.quantity}
                      {o.counterPrice ? ` · countered at ${formatCurrency(o.counterPrice)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={o.status} />
                    {(o.status === 'pending' || o.status === 'countered') && (
                      <button onClick={() => void act(() => offers.withdraw(o.id))} className={ghostBtnCls}>
                        <Send className="w-3.5 h-3.5 rotate-45" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ModalSheet isOpen={Boolean(counterTarget)} onClose={() => setCounterTarget(null)} title="Counter Offer" description={counterTarget ? `One counter round against ${counterTarget.senderName}` : undefined} maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!counterTarget) return;
            void act(() => offers.counter(counterTarget.id, { pricePerUnit: counterPrice, message: counterMsg || undefined }));
            setCounterTarget(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Counter Price (₹/unit)</label>
            <input type="number" className={`${inputCls} font-bold text-emerald-800`} value={counterPrice} onChange={(e) => setCounterPrice(Number(e.target.value))} required />
          </div>
          <div>
            <label className={labelCls}>Message</label>
            <textarea rows={2} className={inputCls} value={counterMsg} onChange={(e) => setCounterMsg(e.target.value)} />
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Send Counter</button>
        </form>
      </ModalSheet>
    </div>
  );
};
