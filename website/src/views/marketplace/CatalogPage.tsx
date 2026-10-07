import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  MARKETPLACE_ROUTES,
  addCartItem,
  addWishlistItem,
  formatPaisa,
  listCatalog,
  productMrpPaisa,
  productPricePaisa,
  type MarketplaceProduct,
} from '../../lib/api/marketplace';
import { currentLanguage, useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Marketplace catalog (phase-05 WS-03 task 3.5).
 *
 * Category tabs (seeds / fertilizer / pesticide / tools / vehicles) + a search
 * box. The grid is cursor-paginated through the opaque `nextCursor` returned by
 * `lib/api/marketplace.ts` — the UI never shows page numbers (rule 7); "load
 * more" is the only paging control.
 */

interface CategoryTab {
  /** Empty string = "All"; otherwise the slug sent to `GET /products?category=`. */
  slug: string;
  labelKey: string;
}

const CATEGORY_TABS: CategoryTab[] = [
  { slug: '', labelKey: 'marketplaceCatAll' },
  { slug: 'seeds', labelKey: 'marketplaceCatSeeds' },
  { slug: 'fertilizer', labelKey: 'marketplaceCatFertilizer' },
  { slug: 'pesticide', labelKey: 'marketplaceCatPesticide' },
  { slug: 'tools', labelKey: 'marketplaceCatTools' },
  { slug: 'vehicles', labelKey: 'marketplaceCatVehicles' },
];

const PAGE_SIZE = 12;

/** Localized product title: the vernacular title is preferred in non-English locales. */
function productTitle(product: MarketplaceProduct): string {
  if (currentLanguage() !== 'en' && product.vernacularTitle) return product.vernacularTitle;
  return product.title;
}

export default function CatalogPage() {
  const t = useT();
  const [category, setCategory] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<MarketplaceProduct[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (cursor: string | null, append: boolean) => {
      setBusy(true);
      setFailed(false);
      try {
        const page = await listCatalog({ category, query: search, cursor, pageSize: PAGE_SIZE });
        setProducts((current) => (append && current ? [...current, ...page.data] : page.data));
        setNextCursor(page.nextCursor);
        setTotal(page.total);
      } catch {
        if (!append) setProducts(null);
        setFailed(true);
        toast(t('marketplaceLoadFailed'), { error: true });
      } finally {
        setBusy(false);
      }
    },
    [category, search, t]
  );

  // A category tab or a new search always restarts from the first page.
  useEffect(() => {
    void load(null, false);
  }, [load]);

  const onSubmitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setCategory('');
  };

  const addToCart = async (product: MarketplaceProduct) => {
    try {
      await addCartItem(product.id, 1);
      toast(t('marketplaceAddedToCart'));
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    }
  };

  const saveToWishlist = async (product: MarketplaceProduct) => {
    try {
      await addWishlistItem(product.id);
      toast(t('marketplaceWishlistAdded'));
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    }
  };

  return (
    <ToolShell toolId="marketplace">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <Link className="av-btn av-btn-ghost" to={MARKETPLACE_ROUTES.cart}>
          🛒 {t('marketplaceCart')}
        </Link>
        <Link className="av-btn av-btn-ghost" to={MARKETPLACE_ROUTES.orders}>
          📦 {t('marketplaceOrders')}
        </Link>
        <Link className="av-btn av-btn-ghost" to="/dashboard/p/wishlist">
          💝 {t('marketplaceWishlist')}
        </Link>
        <Link className="av-btn av-btn-ghost" to="/dashboard/p/addressBook">
          📒 {t('marketplaceAddresses')}
        </Link>
        <Link className="av-btn av-btn-ghost" to={MARKETPLACE_ROUTES.returns}>
          ↩️ {t('marketplaceReturns')}
        </Link>
      </div>

      <section className="dash-section">
        <h3>{t('marketplaceCatalog')}</h3>

        <form className="trade-actions" onSubmit={onSubmitSearch}>
          <label htmlFor="marketplace-search" className="trade-hint">
            {t('marketplaceSearchPlaceholder')}
          </label>
          <input
            id="marketplace-search"
            type="search"
            value={searchInput}
            placeholder={t('marketplaceSearchPlaceholder')}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="av-btn av-btn-primary">
            🔍 {t('marketplaceSearchAction')}
          </button>
          <button type="button" className="av-btn av-btn-ghost" onClick={clearFilters}>
            {t('marketplaceClearFilters')}
          </button>
        </form>

        <div className="trade-actions" role="tablist" aria-label={t('marketplaceCatalog')}>
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.slug || 'all'}
              type="button"
              role="tab"
              aria-selected={category === tab.slug}
              className={category === tab.slug ? 'av-btn av-btn-primary' : 'av-btn av-btn-ghost'}
              onClick={() => setCategory(tab.slug)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <p className="trade-hint">{t('marketplaceResultCount', { count: total })}</p>
      </section>

      {failed && products === null ? (
        <EmptyState
          icon="📡"
          titleKey="marketplaceLoadFailed"
          action={
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={() => void load(null, false)}
            >
              ↻ {t('marketplaceRetry')}
            </button>
          }
        />
      ) : null}

      {products === null && !failed ? (
        <p className="trade-hint">{t('marketplaceLoading')}</p>
      ) : null}

      {products !== null && products.length === 0 ? (
        <EmptyState icon="🛒" titleKey="marketplaceCatalogEmpty" />
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {products?.map((product) => {
          const pricePaisa = productPricePaisa(product);
          const mrpPaisa = productMrpPaisa(product);
          return (
            <div key={product.id} className="trade-card">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={productTitle(product)}
                  loading="lazy"
                  style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8 }}
                />
              ) : null}
              <div className="trade-card-row">
                <span className="trade-card-title">{productTitle(product)}</span>
                <span className="trade-pill">{product.inStock ? t('marketplaceInStock') : t('marketplaceOutOfStock')}</span>
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">
                  {product.brand ? `${t('marketplaceBrand')}: ${product.brand}` : product.category}
                </span>
                <span className="trade-card-amount">{formatPaisa(pricePaisa)}</span>
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">
                  {t('marketplaceMrpLabel')}: {formatPaisa(mrpPaisa)}
                  {mrpPaisa > pricePaisa
                    ? ` · ${t('marketplaceYouSave', { amount: formatPaisa(mrpPaisa - pricePaisa) })}`
                    : ''}
                </span>
                <span className="trade-card-sub">
                  {t('marketplaceRating')}: {product.rating ?? t('commonNotAvailable')}
                </span>
              </div>
              <div className="trade-actions-row">
                <Link className="av-btn av-btn-ghost" to={MARKETPLACE_ROUTES.productDetail(product.id)}>
                  {t('marketplaceView')}
                </Link>
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  disabled={!product.inStock}
                  onClick={() => void addToCart(product)}
                >
                  {t('marketplaceAddToCart')}
                </button>
                <button
                  type="button"
                  className="av-btn av-btn-plain"
                  onClick={() => void saveToWishlist(product)}
                >
                  {t('marketplaceWishlistAdd')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {products !== null && nextCursor !== null ? (
        <div className="trade-actions" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            disabled={busy}
            onClick={() => void load(nextCursor, true)}
          >
            {busy ? t('marketplaceLoading') : t('marketplaceLoadMore')}
          </button>
        </div>
      ) : null}

      {products !== null && products.length > 0 && nextCursor === null ? (
        <p className="trade-hint" style={{ textAlign: 'center' }}>
          {t('marketplaceAllLoaded')}
        </p>
      ) : null}
    </ToolShell>
  );
}
