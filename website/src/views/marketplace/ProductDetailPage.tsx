import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  MARKETPLACE_ROUTES,
  addCartItem,
  addWishlistItem,
  formatPaisa,
  getCertificate,
  getProduct,
  productMrpPaisa,
  productPricePaisa,
  type Certificate,
  type MarketplaceProduct,
} from '../../lib/api/marketplace';
import { currentLanguage, useT } from '../../lib/i18n';
import ReviewsSection from './ReviewsSection';
import '../../theme/trade.css';

/**
 * Product detail (phase-05 WS-03 task 3.6) — details, QR authenticity
 * certificate viewer, add-to-cart, and the gated reviews section.
 */
export default function ProductDetailPage() {
  const t = useT();
  const { productId = '' } = useParams();
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setProduct(await getProduct(productId));
      setCertificate(await getCertificate(productId).catch(() => null));
    } catch {
      setFailed(true);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const title =
    product === null
      ? ''
      : currentLanguage() !== 'en' && product.vernacularTitle
        ? product.vernacularTitle
        : product.title;

  const addToCart = async () => {
    if (product === null) return;
    try {
      await addCartItem(product.id, 1);
      toast(t('marketplaceAddedToCart'));
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    }
  };

  const save = async () => {
    if (product === null) return;
    try {
      await addWishlistItem(product.id);
      toast(t('marketplaceWishlistAdded'));
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    }
  };

  if (failed) {
    return (
      <ToolShell toolId="marketplace">
        <EmptyState
          icon="📡"
          titleKey="marketplaceProductNotFound"
          action={
            <Link className="av-btn av-btn-ghost" to={MARKETPLACE_ROUTES.catalog}>
              {t('marketplaceBackToCatalog')}
            </Link>
          }
        />
      </ToolShell>
    );
  }

  if (product === null) {
    return (
      <ToolShell toolId="marketplace">
        <p className="trade-hint">{t('marketplaceLoading')}</p>
      </ToolShell>
    );
  }

  const pricePaisa = productPricePaisa(product);
  const mrpPaisa = productMrpPaisa(product);

  return (
    <ToolShell toolId="marketplace">
      <Link className="av-link" to={MARKETPLACE_ROUTES.catalog}>
        ← {t('marketplaceBackToCatalog')}
      </Link>

      <div className="trade-card" style={{ cursor: 'default' }}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={title}
            style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8 }}
          />
        ) : null}
        <div className="trade-card-row">
          <span className="trade-card-title">{title}</span>
          <span className="trade-pill">
            {product.inStock ? t('marketplaceInStock') : t('marketplaceOutOfStock')}
          </span>
        </div>
        <p className="trade-card-sub">
          {t('marketplaceBrand')}: {product.brand ?? product.category}
        </p>
        {product.dealerName ? (
          <p className="trade-card-sub">
            {t('marketplaceDealer')}: {product.dealerName}
          </p>
        ) : null}
        <p className="trade-card-amount">
          {formatPaisa(pricePaisa)} · {t('marketplaceMrpLabel')} {formatPaisa(mrpPaisa)}
        </p>
        {mrpPaisa > pricePaisa ? (
          <p className="trade-card-sub">
            {t('marketplaceYouSave', { amount: formatPaisa(mrpPaisa - pricePaisa) })}
          </p>
        ) : null}
        {product.description ? <p className="trade-card-sub">{product.description}</p> : null}
        <div className="trade-actions-row">
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={!product.inStock}
            onClick={() => void addToCart()}
          >
            {t('marketplaceAddToCart')}
          </button>
          <button type="button" className="av-btn av-btn-plain" onClick={() => void save()}>
            {t('marketplaceWishlistAdd')}
          </button>
        </div>
      </div>

      <section className="dash-section">
        <h3>{t('marketplaceQrTitle')}</h3>
        <p className="trade-hint">{t('marketplaceQrHint')}</p>
        {certificate === null ? (
          <p className="trade-hint">{t('marketplaceQrUnavailable')}</p>
        ) : (
          <div className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{certificate.certificateNo}</span>
              <span className="trade-pill">
                {certificate.valid ? t('marketplaceQrValid') : t('marketplaceQrInvalid')}
              </span>
            </div>
            <p className="trade-card-sub">
              {t('marketplaceQrBatch')}: {certificate.batchNo}
            </p>
            <p className="trade-card-sub">
              {t('marketplaceQrCertifier')}: {certificate.certifier}
            </p>
            <p className="trade-card-sub">
              {t('marketplaceQrVerifiedAt', { date: certificate.verifiedAt })}
            </p>
            <p className="trade-card-sub">
              {t('marketplaceQrPayload')}: <code>{certificate.certificateNo}</code>
            </p>
          </div>
        )}
      </section>

      <ReviewsSection productId={product.id} />
    </ToolShell>
  );
}
