import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, RefreshCcw, Scale, Warehouse, HandCoins, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { seller, apiErrorMessage } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import {
  arr,
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  LoadingBlock,
  num,
  rec,
  str,
  type Rec,
} from './shared';

interface CropLine {
  crop: string;
  boughtQty: number;
  buyRate: number; // weighted ₹/q
  soldQty: number;
  sellRate: number; // weighted ₹/q
}

const cropKey = (name: string): string => name.trim().toLowerCase();

/**
 * Vyapari P&L: per-crop buy (J-form procurement) vs sell (POS sales + resale
 * listings) rates, stock value, khata credit outstanding, and a 12-month
 * cashflow chart — assembled from existing seller endpoints only.
 */
export const SellerPnlView: React.FC = () => {
  const [procurement, setProcurement] = useState<Rec[]>([]);
  const [sales, setSales] = useState<Rec[]>([]);
  const [resale, setResale] = useState<Rec[]>([]);
  const [stock, setStock] = useState<Rec[]>([]);
  const [stockTotals, setStockTotals] = useState<Rec>({});
  const [ledgers, setLedgers] = useState<Rec[]>([]);
  const [creditOutstanding, setCreditOutstanding] = useState(0);
  const [cashflow, setCashflow] = useState<Rec[]>([]);
  const [cashTotals, setCashTotals] = useState<Rec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [procRows, saleRows, resaleRows, stockRows, ledgerRows, cfRows] = await Promise.all([
        seller.procurement().catch(() => [] as unknown[]),
        seller.sales().catch(() => [] as unknown[]),
        seller.myResaleListings().catch(() => [] as unknown[]),
        seller.stock().catch(() => [] as unknown[]),
        seller.ledgers().catch(() => [] as unknown[]),
        seller.cashflow().catch(() => ({})),
      ]);
      const procList = arr(rec(procRows as object).data ?? procRows).map(rec);
      setProcurement(procList);
      const saleList = arr(rec(saleRows as object).data ?? saleRows).map(rec);
      setSales(saleList);
      setResale((resaleRows as unknown[]).map(rec));
      // readList unwraps the `data` envelope, so the stock summary is rebuilt
      // here from the entry lines (same weighted math as GET /seller/stock).
      const entries = (stockRows as unknown[]).map(rec);
      const groups = new Map<string, Rec>();
      for (const entry of entries) {
        const key = `${str(entry.crop, 'Unknown')}|${str(entry.grade)}`;
        const row = groups.get(key) || {
          crop: str(entry.crop, 'Unknown'),
          grade: str(entry.grade),
          availableQuintals: 0,
          value: 0,
        };
        const available = num(entry.availableQuintals);
        row.availableQuintals = Math.round((num(row.availableQuintals) + available) * 1000) / 1000;
        row.value = num(row.value) + Math.round(available * num(entry.ratePerQuintal));
        groups.set(key, row);
      }
      const byCrop = [...groups.values()].sort((a, b) => num(b.availableQuintals) - num(a.availableQuintals));
      setStock(byCrop);
      setStockTotals({ value: byCrop.reduce((sum, r) => sum + num(r.value), 0), availableQuintals: byCrop.reduce((sum, r) => sum + num(r.availableQuintals), 0) });
      // ledgers unwrap to the buyer rows; credit outstanding is the sum of
      // positive net balances (same number the khata endpoint reports).
      const buyers = (ledgerRows as unknown[]).map(rec);
      setLedgers(buyers);
      setCreditOutstanding(buyers.filter((b) => num(b.netBalance) > 0).reduce((sum, b) => sum + num(b.netBalance), 0));
      const cfPayload = rec(cfRows as object);
      setCashflow(arr(cfPayload.byMonth).map(rec));
      setCashTotals(rec(cfPayload.totals));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Per-crop weighted buy (procurement) vs sell (POS sales + resale) rates.
  const cropLines = useMemo<CropLine[]>(() => {
    const map = new Map<string, CropLine>();
    const line = (crop: string): CropLine => {
      const key = cropKey(crop);
      let row = map.get(key);
      if (!row) {
        row = { crop: crop.trim() || 'Unknown', boughtQty: 0, buyRate: 0, soldQty: 0, sellRate: 0 };
        map.set(key, row);
      }
      return row;
    };
    for (const lot of procurement) {
      const qty = num(lot.netWeightQuintals);
      const rate = num(lot.ratePerQuintal);
      if (qty <= 0 || rate <= 0) continue;
      const row = line(str(lot.crop, 'Unknown'));
      row.buyRate = (row.buyRate * row.boughtQty + rate * qty) / (row.boughtQty + qty);
      row.boughtQty += qty;
    }
    for (const sale of sales) {
      const qty = num(sale.quantity);
      const rate = num(sale.ratePerUnit);
      if (qty <= 0 || rate <= 0) continue;
      const row = line(str(sale.item, 'Unknown'));
      row.sellRate = (row.sellRate * row.soldQty + rate * qty) / (row.soldQty + qty);
      row.soldQty += qty;
    }
    for (const listing of resale) {
      const qty = num(listing.remainingQuintals, num(listing.quantityQuintals));
      const rate = num(listing.askingRatePerQuintal);
      if (qty <= 0 || rate <= 0) continue;
      const row = line(str(listing.crop, 'Unknown'));
      row.sellRate = (row.sellRate * row.soldQty + rate * qty) / (row.soldQty + qty);
      row.soldQty += qty;
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        buyRate: Math.round(r.buyRate * 100) / 100,
        sellRate: Math.round(r.sellRate * 100) / 100,
      }))
      .sort((a, b) => b.boughtQty + b.soldQty - (a.boughtQty + a.soldQty));
  }, [procurement, sales, resale]);

  const maxCash = Math.max(1, ...cashflow.map((m) => Math.max(num(m.inflow), num(m.outflow))));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
            P&amp;L — Buy vs Sell
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Per-crop margins across J-form procurement, POS sales and resale listings
          </p>
        </div>
        <button onClick={() => void load()} className={ghostBtnCls}>
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <ErrorBanner message={error} />
      {loading && <LoadingBlock />}

      {!loading && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${cardCls} p-4`}>
              <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Warehouse className="w-3.5 h-3.5" /> Stock Value
              </p>
              <p className="text-lg font-black text-slate-900">{formatCurrency(num(stockTotals.value))}</p>
              <p className="text-[11px] text-slate-400">{formatCurrency(num(stockTotals.availableQuintals))} q available</p>
            </div>
            <div className={`${cardCls} p-4`}>
              <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <HandCoins className="w-3.5 h-3.5" /> Credit Outstanding
              </p>
              <p className="text-lg font-black text-amber-700">{formatCurrency(creditOutstanding)}</p>
              <p className="text-[11px] text-slate-400">{ledgers.filter((b) => num(b.netBalance) > 0).length} buyers on khata</p>
            </div>
            <div className={`${cardCls} p-4`}>
              <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5" /> Cashflow (12m)
              </p>
              <p className={`text-lg font-black ${num(cashTotals.net) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(num(cashTotals.net))}
              </p>
              <p className="text-[11px] text-slate-400">net of inflow − outflow</p>
            </div>
            <div className={`${cardCls} p-4`}>
              <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Active Crops
              </p>
              <p className="text-lg font-black text-slate-900">{cropLines.length}</p>
              <p className="text-[11px] text-slate-400">with buy or sell activity</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Buy vs sell per crop */}
            <div className={`${cardCls} p-5 space-y-3`}>
              <h3 className="font-bold text-sm text-slate-900">Per-Crop Buy vs Sell Rate</h3>
              {cropLines.length === 0 ? (
                <EmptyState label="No procurement or sales yet — record a J-form or POS sale to see margins" />
              ) : (
                <div className="space-y-2">
                  {cropLines.map((row) => {
                    const margin = row.sellRate > 0 && row.buyRate > 0 ? row.sellRate - row.buyRate : null;
                    return (
                      <div key={row.crop} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-900">{row.crop}</span>
                          {margin !== null && (
                            <span className={`font-bold ${margin >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {margin >= 0 ? '+' : ''}{formatCurrency(margin)}/q margin
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                          <span>
                            Buy: <strong className="text-slate-800">{row.buyRate ? formatCurrency(row.buyRate) : '—'}</strong>
                            {row.boughtQty > 0 ? `/q · ${row.boughtQty} q` : ''}
                          </span>
                          <span>
                            Sell: <strong className="text-slate-800">{row.sellRate ? formatCurrency(row.sellRate) : '—'}</strong>
                            {row.soldQty > 0 ? `/q · ${row.soldQty} q` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stock value + credit outstanding */}
            <div className="space-y-6">
              <div className={`${cardCls} p-5 space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">Stock Value (by crop)</h3>
                  <Link to="/seller/stock" className="text-xs font-bold text-emerald-700 hover:underline">
                    Manage stock →
                  </Link>
                </div>
                {stock.length === 0 ? (
                  <EmptyState label="No stock on hand" />
                ) : (
                  <div className="space-y-2">
                    {stock.slice(0, 6).map((row) => (
                      <div key={`${str(row.crop)}-${str(row.grade)}`} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl text-xs">
                        <span className="font-bold text-slate-800">
                          {str(row.crop, 'Unknown')}
                          {str(row.grade) ? ` · Grade ${str(row.grade)}` : ''}
                          <span className="text-slate-400 font-normal"> · {num(row.availableQuintals)} q</span>
                        </span>
                        <span className="font-black text-emerald-800">{formatCurrency(num(row.value))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={`${cardCls} p-5 space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">Khata Credit Outstanding</h3>
                  <Link to="/seller/pos" className="text-xs font-bold text-emerald-700 hover:underline">
                    Open khata →
                  </Link>
                </div>
                {ledgers.length === 0 ? (
                  <EmptyState label="No buyer khata accounts yet" />
                ) : (
                  <div className="space-y-2">
                    {ledgers
                      .filter((b) => num(b.netBalance) > 0)
                      .slice(0, 5)
                      .map((b) => (
                        <div key={`${str(b.buyerName)}-${str(b.buyerPhone)}`} className="flex justify-between items-center p-2.5 bg-amber-50/60 rounded-xl text-xs border border-amber-100">
                          <span className="font-bold text-slate-800">{str(b.buyerName, 'Unknown buyer')}</span>
                          <span className="font-black text-amber-800">{formatCurrency(num(b.netBalance))}</span>
                        </div>
                      ))}
                    {ledgers.filter((b) => num(b.netBalance) > 0).length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2">All khata accounts settled 🎉</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cashflow chart */}
          <div className={`${cardCls} p-5 space-y-3`}>
            <h3 className="font-bold text-sm text-slate-900">Cashflow — Last 12 Months</h3>
            {cashflow.length === 0 ? (
              <EmptyState label="No cashflow recorded in this window" />
            ) : (
              <div className="space-y-1.5">
                {cashflow.map((m) => {
                  const inflow = num(m.inflow);
                  const outflow = num(m.outflow);
                  return (
                    <div key={str(m.month)} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 text-[11px]">
                      <span className="font-bold text-slate-500">{str(m.month)}</span>
                      <div className="space-y-1">
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.max(2, (inflow / maxCash) * 100)}%` }}
                          />
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-rose-400"
                            style={{ width: `${Math.max(2, (outflow / maxCash) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className={`font-black ${num(m.net) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatCurrency(num(m.net))}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-4 pt-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500" /> Inflow (sales, collections)
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowUpCircle className="w-3.5 h-3.5 text-rose-400" /> Outflow (procurement payouts, advances)
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
