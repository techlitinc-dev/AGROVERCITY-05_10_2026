import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  PRODUCT_SURFACE_APIS,
  formatPaisa,
  getProduct,
  toPaisa,
  type MarketplaceProduct,
  type ProductSurface,
  type SellerProductPayload,
} from '../../lib/api/marketplace';
import { compressImage, uploadTradeImage } from '../../lib/firebase';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';

/**
 * Seller product create/edit (phase-05 WS-03 task 3.17).
 *
 * Runs on the surface named by `?surface=` (seller role vs my-products) using
 * `PRODUCT_SURFACE_APIS`. Images upload to Firebase Storage and are attached as
 * download URLs (same helper as trade photos). Prices are entered in rupees and
 * converted once to integer paisa for validation (rule 6).
 */
export default function ProductFormPage() {
  const t = useT();
  const navigate = useNavigate();
  const params = useSearchParams();
  const { productId } = useParams();
  const surface: ProductSurface = params[0].get('surface') === 'seller' ? 'seller' : 'myProducts';
  const user = useSessionStore((s) => s.user);

  const [form, setForm] = useState<SellerProductPayload>({
    title: '',
    category: 'seeds',
    brand: '',
    vernacularTitle: '',
    description: '',
    mrp: 0,
    discountedPrice: 0,
    stock: 0,
    unit: 'kg',
    imageUrl: '',
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadProduct = useCallback(
    async (id: string) => {
      try {
        const product: MarketplaceProduct = await getProduct(id);
        setForm({
          title: product.title,
          category: product.category,
          brand: product.brand ?? '',
          vernacularTitle: product.vernacularTitle ?? '',
          description: product.description ?? '',
          mrp: product.mrp,
          discountedPrice: product.discountedPrice,
          stock: product.inStock ? 1 : 0,
          unit: product.unit ?? 'kg',
          imageUrl: product.imageUrl ?? '',
          batchNo: product.batchNo,
        });
      } catch {
        toast(t('marketplaceLoadFailed'), { error: true });
      }
    },
    [t]
  );

  useEffect(() => {
    if (productId) void loadProduct(productId);
  }, [productId, loadProduct]);

  const upload = async (file: File) => {
    const uid = user?.id ?? '';
    if (!uid) {
      toast(t('marketplaceActionFailed'), { error: true });
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const url = await uploadTradeImage(uid, compressed);
      setForm((current) => ({ ...current, imageUrl: url }));
    } catch {
      toast(t('marketplaceProductImageFailed'), { error: true });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.category.trim() || form.mrp <= 0 || form.discountedPrice <= 0) {
      toast(t('marketplaceProductRequiredFields'), { error: true });
      return;
    }
    if (toPaisa(form.discountedPrice) > toPaisa(form.mrp)) {
      toast(t('marketplaceProductPriceExceedsMrp'), { error: true });
      return;
    }
    setBusy(true);
    try {
      if (productId) {
        await PRODUCT_SURFACE_APIS[surface].update(productId, form);
      } else {
        await PRODUCT_SURFACE_APIS[surface].create(form);
      }
      toast(t('marketplaceProductSaved'));
      navigate(`/dashboard/p/sellerProducts?surface=${surface}`);
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceProductSaveFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const text = (key: keyof SellerProductPayload, labelKey: string) => (
    <label className="trade-field">
      <span className="trade-hint">{t(labelKey)}</span>
      <input
        value={(form[key] as string | number | undefined)?.toString() ?? ''}
        onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
      />
    </label>
  );

  const numberField = (key: 'mrp' | 'discountedPrice' | 'stock', labelKey: string) => (
    <label className="trade-field">
      <span className="trade-hint">{t(labelKey)}</span>
      <input
        type="number"
        value={form[key]}
        onChange={(e) => setForm((current) => ({ ...current, [key]: Number(e.target.value) }))}
      />
    </label>
  );

  return (
    <ToolShell toolId="marketplace">
      <section className="dash-section">
        <h3>{productId ? t('marketplaceSellerEdit') : t('marketplaceSellerNew')}</h3>
        {text('title', 'marketplaceProductTitleLabel')}
        {text('vernacularTitle', 'marketplaceProductVernacularTitleLabel')}
        {text('category', 'marketplaceProductCategoryLabel')}
        {text('brand', 'marketplaceProductBrandLabel')}
        {numberField('mrp', 'marketplaceProductMrpLabel')}
        {numberField('discountedPrice', 'marketplaceProductPriceLabel')}
        {numberField('stock', 'marketplaceProductStockLabel')}
        {form.discountedPrice > 0 ? (
          <p className="trade-hint">{formatPaisa(toPaisa(form.discountedPrice))}</p>
        ) : null}
        {text('unit', 'marketplaceProductUnitLabel')}
        {text('description', 'marketplaceProductDescriptionLabel')}

        <label className="trade-field">
          <span className="trade-hint">{t('marketplaceProductImageLabel')}</span>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <span className="trade-hint">
            {uploading ? t('marketplaceProductImageUploading') : t('marketplaceProductImageUpload')}
          </span>
        </label>
        {form.imageUrl ? (
          <img src={form.imageUrl} alt="" style={{ maxWidth: 160, borderRadius: 8 }} />
        ) : null}

        <div className="trade-actions">
          <button type="button" className="av-btn av-btn-primary" disabled={busy || uploading} onClick={() => void save()}>
            {t('marketplaceAddressSave')}
          </button>
        </div>
      </section>
    </ToolShell>
  );
}
