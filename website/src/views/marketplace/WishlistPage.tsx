import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  MARKETPLACE_ROUTES,
  addCartItem,
  formatPaisa,
  listWishlist,
  productPricePaisa,
  removeWishlistItem,
  type MarketplaceProduct,
} from '../../lib/api/marketplace';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/** Wishlist (phase-05 WS-03 task 3.13) — list/add/remove, writes idempotent. */
export default function WishlistPage() {
  const t = useT();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);

  const load = useCallback(async () => {
    try {
      setProducts(await listWishlist());
    } catch {
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (product: MarketplaceProduct) => {
    try {
      await removeWishlistItem(product.id);
      toast(t('marketplaceWishlistRemoved'));
      await load();
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    }
  };

  const addToCart = async (product: MarketplaceProduct) => {
    try {
      await addCartItem(product.id, 1);
      toast(t('marketplaceAddedToCart'));
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    }
  };

  return (
    <ToolShell toolId="marketplace">
      <section className="dash-section">
        <h3>{t('marketplaceWishlist')}</h3>
        {products.length === 0 ? (
          <EmptyState
            icon="💝"
            titleKey="marketplaceWishlistEmpty"
            bodyKey="marketplaceWishlistEmptyBody"
            action={
              <Link className="av-btn av-btn-primary" to={MARKETPLACE_ROUTES.catalog}>
                {t('marketplaceContinueShopping')}
              </Link>
            }
          />
        ) : (
          products.map((product) => (
            <div className="trade-card" key={product.id} style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{product.title}</span>
                <span className="trade-card-amount">{formatPaisa(productPricePaisa(product))}</span>
              </div>
              <div className="trade-actions-row">
                <Link className="av-btn av-btn-ghost" to={MARKETPLACE_ROUTES.productDetail(product.id)}>
                  {t('marketplaceView')}
                </Link>
                <button type="button" className="av-btn av-btn-primary" onClick={() => void addToCart(product)}>
                  {t('marketplaceAddToCart')}
                </button>
                <button type="button" className="av-btn av-btn-plain" onClick={() => void remove(product)}>
                  {t('marketplaceRemove')}
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </ToolShell>
  );
}
