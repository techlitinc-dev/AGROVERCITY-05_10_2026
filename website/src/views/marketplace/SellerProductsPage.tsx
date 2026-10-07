import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  MARKETPLACE_ROUTES,
  PRODUCT_SURFACE_APIS,
  deleteMyProduct,
  formatPaisa,
  productPricePaisa,
  type MarketplaceProduct,
  type ProductSurface,
} from '../../lib/api/marketplace';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Seller product list (phase-05 WS-03 task 3.17).
 *
 * Two surfaces: the seller-role catalog (`/seller/products`) and any user's own
 * listings (`/my-products`). Only the user surface supports delete (backend
 * refuses a seller delete). The surface is a `?surface=` query param.
 */
export default function SellerProductsPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const surface: ProductSurface = params.get('surface') === 'seller' ? 'seller' : 'myProducts';
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [restricted, setRestricted] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProducts(await PRODUCT_SURFACE_APIS[surface].list());
      setRestricted(false);
    } catch (error) {
      setProducts([]);
      setRestricted(isApiError(error) && (error.status === 403 || error.status === 401));
    }
  }, [surface]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (product: MarketplaceProduct) => {
    if (confirmId !== product.id) {
      setConfirmId(product.id);
      return;
    }
    setConfirmId(null);
    try {
      await deleteMyProduct(product.id);
      toast(t('marketplaceProductDeleted'));
      await load();
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    }
  };

  return (
    <ToolShell toolId="marketplace">
      <section className="dash-section">
        <h3>{t('marketplaceSellerTitle')}</h3>

        <div className="trade-actions" role="tablist">
          <button
            type="button"
            className={surface === 'seller' ? 'av-btn av-btn-primary' : 'av-btn av-btn-ghost'}
            onClick={() => setParams({ surface: 'seller' })}
          >
            {t('marketplaceSellerSurfaceSeller')}
          </button>
          <button
            type="button"
            className={surface === 'myProducts' ? 'av-btn av-btn-primary' : 'av-btn av-btn-ghost'}
            onClick={() => setParams({})}
          >
            {t('marketplaceSellerSurfaceMine')}
          </button>
          <Link className="av-btn av-btn-primary" to={`${MARKETPLACE_ROUTES.productNew}?surface=${surface}`}>
            {t('marketplaceSellerNew')}
          </Link>
        </div>

        {restricted ? <p className="trade-hint">{t('marketplaceSellerRestricted')}</p> : null}

        {products.length === 0 && !restricted ? (
          <EmptyState icon="🏷️" titleKey="marketplaceSellerEmpty" bodyKey="marketplaceSellerEmptyBody" />
        ) : (
          products.map((product) => (
            <div className="trade-card" key={product.id} style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{product.title}</span>
                <span className="trade-card-amount">{formatPaisa(productPricePaisa(product))}</span>
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">
                  {t('marketplaceSellerStock')}: {product.inStock ? t('marketplaceInStock') : t('marketplaceOutOfStock')}
                </span>
                <span className="trade-card-sub">{product.category}</span>
              </div>
              <div className="trade-actions-row">
                <Link
                  className="av-btn av-btn-ghost"
                  to={`${MARKETPLACE_ROUTES.productEdit(product.id)}?surface=${surface}`}
                >
                  {t('marketplaceSellerEdit')}
                </Link>
                {surface === 'myProducts' ? (
                  <button type="button" className="av-btn av-btn-plain" onClick={() => void remove(product)}>
                    {confirmId === product.id ? t('marketplaceProductDeleteConfirm') : t('marketplaceRemove')}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </section>
    </ToolShell>
  );
}
