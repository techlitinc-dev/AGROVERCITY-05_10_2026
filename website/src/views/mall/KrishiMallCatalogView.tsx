import React from 'react';
import { ShoppingBag } from 'lucide-react';

/**
 * Agri Market — catalog not launched yet, so every persona sees a single
 * highlighted "Coming Soon" line. Cart/wishlist/orders pages still work via
 * direct links.
 */
export const KrishiMallCatalogView: React.FC = () => {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
      <ShoppingBag className="w-8 h-8 text-emerald-600" />
      <p className="text-lg font-extrabold text-slate-900">Coming Soon</p>
    </div>
  );
};
