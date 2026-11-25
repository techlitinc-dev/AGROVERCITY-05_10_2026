import React, { useEffect, useState } from 'react';
import { MapPin, ShoppingBag, Store, Truck } from 'lucide-react';
import { agriMarketSeller } from '../../lib/api';
import { asRecords, pickStr } from '../shared/records';

/**
 * Agri Market — catalog not launched yet, so every persona sees a single
 * "Coming Soon" line. Below it, the directory of seller shops that sellers
 * have added (shop profile + shop) is listed; bank details are never
 * exposed. Cart/wishlist/orders pages still work via direct links.
 */
export const KrishiMallCatalogView: React.FC = () => {
  const [shops, setShops] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    let mounted = true;
    agriMarketSeller
      .shops()
      .then((items) => mounted && setShops(asRecords(items)))
      .catch(() => mounted && setShops([])); // directory failure never blocks the page
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
        <ShoppingBag className="w-8 h-8 text-emerald-600" />
        <p className="text-lg font-extrabold text-slate-900">Coming Soon</p>
      </div>

      {shops !== null && shops.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-600" />
            Seller shops on Agri Market ({shops.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shops.map((shop) => (
              <div
                key={pickStr(shop, 'ownerUid')}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 truncate">{pickStr(shop, 'shopName')}</h3>
                    {pickStr(shop, 'sellerName') && (
                      <p className="text-[11px] text-slate-500">{pickStr(shop, 'sellerName')}</p>
                    )}
                  </div>
                </div>
                {pickStr(shop, 'deliveryArea') && (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    Delivers in {pickStr(shop, 'deliveryArea')}
                  </p>
                )}
                {pickStr(shop, 'pickupAddress') && (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {pickStr(shop, 'pickupAddress')}
                  </p>
                )}
                {pickStr(shop, 'createdAt') && (
                  <p className="text-[10px] text-slate-400">
                    Joined {pickStr(shop, 'createdAt').slice(0, 10)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
