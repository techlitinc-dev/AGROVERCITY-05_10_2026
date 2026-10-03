import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createGaushalaByproduct,
  fmtINR,
  getMyGaushala,
  listGaushalaByproducts,
  type PanchagavyaCategory,
  type PanchagavyaProduct,
} from '../../lib/api/gaushala';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.gaushala';
import '../../lib/i18n/locales/hi.gaushala';
import '../../theme/gaushala.css';

const CATEGORIES: PanchagavyaCategory[] = [
  'compost',
  'dung_cakes',
  'gomutra_ark',
  'panchagavya_tonic',
  'ghee',
  'dhoop',
];

const CATEGORY_COLORS: Record<string, string> = {
  compost: '#16A34A',
  dung_cakes: '#B45309',
  gomutra_ark: '#D97706',
  panchagavya_tonic: '#7C3AED',
  ghee: '#CA8A04',
  dhoop: '#0D9488',
};

const LOW_STOCK = 10;

/** Byproducts / panchagavya shelf (P8) — product cards with stock badges, add-product sheet. */
export default function ByproductsPage() {
  const t = useT();
  useEnsureProfile('dairyManager');

  const [products, setProducts] = useState<PanchagavyaProduct[] | null>(null);
  const [failed, setFailed] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState('');
  const [vernacular, setVernacular] = useState('');
  const [category, setCategory] = useState<PanchagavyaCategory>('compost');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('kg');
  const [stockQty, setStockQty] = useState('50');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    listGaushalaByproducts()
      .then(setProducts)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const openAdd = () => {
    setTitle('');
    setVernacular('');
    setCategory('compost');
    setPrice('');
    setUnit('kg');
    setStockQty('50');
    setDescription('');
    setImageUrl('');
    setErrors({});
    setAddOpen(true);
  };

  const submit = async () => {
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = t('commonRequired');
    if (price.trim() === '' || Number.isNaN(Number(price))) nextErrors.price = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      let gaushalaId = '';
      try {
        gaushalaId = (await getMyGaushala()).id;
      } catch {
        gaushalaId = '';
      }
      await createGaushalaByproduct({
        ...(gaushalaId ? { gaushalaId } : {}),
        title: title.trim(),
        vernacularTitle: vernacular.trim(),
        category,
        price: Math.floor(Number(price)) || 0,
        unit: unit.trim() || 'kg',
        stockQuantity: Math.max(0, Math.floor(Number(stockQty)) || 0),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
      });
      toast(t('gaushalaProdSaved'));
      setAddOpen(false);
      load();
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="gaushalaConsole" backTo="/gaushala/console">
      <div className="gaushala-wrap">
        <div className="gaushala-actions" style={{ marginTop: 4 }}>
          <button type="button" className="av-btn av-btn-primary" onClick={openAdd}>
            ＋ {t('gaushalaProdAdd')}
          </button>
        </div>

        {products === null && !failed ? <p className="gaushala-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <div className="gaushala-empty">
            <span className="gaushala-empty-icon" aria-hidden>
              📡
            </span>
            <p className="gaushala-empty-title">{t('gaushalaLoadFailed')}</p>
            <div className="gaushala-empty-action">
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            </div>
          </div>
        ) : null}

        {products !== null && products.length === 0 ? (
          <div className="gaushala-empty">
            <span className="gaushala-empty-icon" aria-hidden>
              🪔
            </span>
            <p className="gaushala-empty-title">{t('gaushalaProdEmpty')}</p>
            <p className="gaushala-empty-body">{t('gaushalaProdEmptyBody')}</p>
          </div>
        ) : null}

        <div className="gaushala-list">
          {(products ?? []).map((p) => {
            const color = CATEGORY_COLORS[p.category] ?? '#64748B';
            const catLabel =
              t(`gaushalaProd_${p.category}`) !== `gaushalaProd_${p.category}`
                ? t(`gaushalaProd_${p.category}`)
                : p.category;
            const low = p.stockQuantity < LOW_STOCK;
            return (
              <div key={p.id} className="gaushala-card">
                <div className="gaushala-card-row">
                  <span className="gaushala-card-title">
                    {p.title}
                    {p.vernacularTitle && p.vernacularTitle !== p.title ? (
                      <span className="gaushala-card-sub"> · {p.vernacularTitle}</span>
                    ) : null}
                  </span>
                  <span
                    className={`gaushala-pill ${p.inStock ? (low ? 'gaushala-pill-warn' : 'gaushala-pill-ok') : 'gaushala-pill-bad'}`}
                  >
                    {p.inStock ? (low ? t('gaushalaProdLowStock') : t('gaushalaProdInStock')) : t('gaushalaProdOutStock')}
                  </span>
                </div>
                <div className="gaushala-card-row">
                  <span
                    className="gaushala-pill"
                    style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
                  >
                    {catLabel}
                  </span>
                  <span className="gaushala-card-amount">
                    {fmtINR(p.price)}
                    <small style={{ fontSize: 12, fontWeight: 700, color: 'var(--av-slate-1)' }}> / {p.unit || 'kg'}</small>
                  </span>
                </div>
                <span className="gaushala-card-sub">
                  {t('gaushalaProdLeft', { qty: p.stockQuantity })}
                  {p.description ? ` · ${p.description}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <ModalSheet open={addOpen} onClose={() => !busy && setAddOpen(false)} title={t('gaushalaProdAdd')}>
        <div className="gaushala-form">
          <LabeledTextField
            label={t('gaushalaFieldTitle')}
            value={title}
            onChange={setTitle}
            error={errors.title}
            required
            maxLength={120}
          />
          <LabeledTextField
            label={t('gaushalaFieldVernacular')}
            value={vernacular}
            onChange={setVernacular}
            error={errors.vernacularTitle}
          />
          <div className="av-field">
            <label className="av-label">{t('gaushalaFieldCategory')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`av-chip${category === c ? ' selected' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {t(`gaushalaProd_${c}`)}
                </button>
              ))}
            </div>
          </div>
          <LabeledTextField
            label={t('gaushalaFieldPrice')}
            value={price}
            onChange={setPrice}
            type="number"
            inputMode="numeric"
            error={errors.price}
            required
          />
          <LabeledTextField
            label={t('gaushalaFieldUnit')}
            value={unit}
            onChange={setUnit}
            placeholder="kg / L / pcs"
            error={errors.unit}
          />
          <LabeledTextField
            label={t('gaushalaFieldStockQty')}
            value={stockQty}
            onChange={setStockQty}
            type="number"
            inputMode="numeric"
            error={errors.stockQuantity}
          />
          <LabeledTextField
            label={t('gaushalaFieldDescription')}
            value={description}
            onChange={setDescription}
            error={errors.description}
          />
          <LabeledTextField
            label={t('gaushalaFieldImageUrl')}
            value={imageUrl}
            onChange={setImageUrl}
            error={errors.imageUrl}
          />
          <div className="gaushala-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submit()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setAddOpen(false)} disabled={busy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
