import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../../../components/LabeledTextField';
import ModalSheet from '../../../components/ModalSheet';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { toast } from '../../../components/toast';
import { isApiError } from '../../../lib/api/client';
import {
  adjustStock,
  createStockItem,
  fmtINR,
  listStock,
  type StockCategory,
  type StockItem,
  type StockItemInput,
} from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import '../../../lib/i18n/locales/en.dairy-sales';
import '../../../lib/i18n/locales/hi.dairy-sales';
import '../../../theme/dairy-sales.css';
import EmptyState from '../components/EmptyState';
import { fmtDate } from '../components/SlipCard';

const CATEGORIES: StockCategory[] = ['milk', 'curd', 'ghee', 'paneer', 'other'];

const CATEGORY_COLORS: Record<StockCategory, string> = {
  milk: '#2563EB',
  curd: '#D97706',
  ghee: '#B45309',
  paneer: '#0D9488',
  other: '#64748B',
};

const EXPIRY_WINDOW_DAYS = 3;

const todayStart = (): number => new Date(`${new Date().toLocaleDateString('en-CA')}T00:00:00`).getTime();

/** Days until expiry (negative = past). */
const daysToExpiry = (expiryDate: string): number =>
  Math.round((new Date(`${expiryDate}T00:00:00`).getTime() - todayStart()) / 86_400_000);

/** Stock items (P6) — list with expiry highlights, add-item sheet, per-item adjust sheet. */
export default function StockPage() {
  const t = useT();
  useEnsureProfile('dairyManager');

  const [items, setItems] = useState<StockItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<StockItem | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<StockCategory>('curd');
  const [unit, setUnit] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [expiry, setExpiry] = useState('');

  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setFailed(false);
    listStock({ pageSize: 500 })
      .then((res) => setItems(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const openAdd = () => {
    setName('');
    setCategory('curd');
    setUnit('');
    setQty('');
    setPrice('');
    setExpiry('');
    setErrors({});
    setAddOpen(true);
  };

  const openAdjust = (item: StockItem) => {
    setAdjustTarget(item);
    setDelta('');
    setReason('');
    setErrors({});
  };

  const submitAdd = async () => {
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    const payload: StockItemInput = {
      name: name.trim(),
      category,
      unit: unit.trim(),
      stockQty: Number(qty) || 0,
      unitPrice: Number(price) || 0,
      expiryDate: expiry || undefined,
    };
    try {
      await createStockItem(payload);
      toast(t('dairyStockItemCreated'));
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

  const submitAdjust = async () => {
    if (!adjustTarget || busy) return;
    const nextErrors: Record<string, string> = {};
    if (delta.trim() === '' || Number.isNaN(Number(delta))) nextErrors.delta = t('commonRequired');
    if (!reason.trim()) nextErrors.reason = t('dairyStockReasonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await adjustStock(adjustTarget.id, Number(delta), reason.trim());
      toast(t('dairyStockAdjusted'));
      setAdjustTarget(null);
      load();
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else if (isApiError(e) && e.status === 404) {
        toast(t('actionFailed'), { error: true });
        setAdjustTarget(null);
        load();
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console">
      <div className="dairy-wrap">
        <div className="dairy-actions" style={{ marginTop: 4 }}>
          <button type="button" className="av-btn av-btn-primary" onClick={openAdd}>
            ＋ {t('dairyStockAdd')}
          </button>
        </div>

        {items === null && !failed ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <EmptyState
            icon="📡"
            titleKey="dairyLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {items !== null && items.length === 0 ? (
          <EmptyState
            icon="🥣"
            titleKey="dairyStockEmpty"
            bodyKey="dairyStockEmptyBody"
            action={
              <button type="button" className="av-btn av-btn-primary" onClick={openAdd}>
                ＋ {t('dairyStockAdd')}
              </button>
            }
          />
        ) : null}

        <div className="dairy-list">
          {(items ?? []).map((item) => {
            const color = CATEGORY_COLORS[item.category] ?? '#64748B';
            const expiryDays = item.expiryDate ? daysToExpiry(item.expiryDate) : null;
            const adj = item.lastAdjustment;
            return (
              <div key={item.id} className="dairy-card">
                <div className="dairy-card-row">
                  <span className="dairy-card-title">{item.name}</span>
                  <span
                    className="dairy-pill"
                    style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
                  >
                    {t(`dairyStockCat_${item.category}`)}
                  </span>
                </div>
                <div className="dairy-card-row">
                  <span className="dairy-card-sub">
                    {item.stockQty} {item.unit || ''}
                    {item.unitPrice > 0 ? ` · ${fmtINR(item.unitPrice)}` : ''}
                  </span>
                  {expiryDays !== null ? (
                    expiryDays < 0 ? (
                      <span className="dairy-sales-expiry-bad">
                        {fmtDate(item.expiryDate || '')} · {t('dairyStockExpiredTag')}
                      </span>
                    ) : expiryDays <= EXPIRY_WINDOW_DAYS ? (
                      <span className="dairy-sales-expiry-warn">
                        {fmtDate(item.expiryDate || '')} · {t('dairyStockExpiresSoonTag', { days: expiryDays })}
                      </span>
                    ) : (
                      <span className="dairy-card-sub">{fmtDate(item.expiryDate || '')}</span>
                    )
                  ) : null}
                </div>
                {adj ? (
                  <span className="dairy-card-sub">
                    {t('dairyStockLastAdj')}: {adj.delta > 0 ? `+${adj.delta}` : adj.delta} · {adj.reason} ·{' '}
                    {fmtDate(adj.at)}
                  </span>
                ) : null}
                <div className="dairy-actions-row">
                  <button type="button" className="av-btn av-btn-ghost" onClick={() => openAdjust(item)}>
                    ⚖️ {t('dairyStockAdjust')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ModalSheet open={addOpen} onClose={() => !busy && setAddOpen(false)} title={t('dairyStockAdd')}>
        <div className="dairy-form">
          <LabeledTextField
            label={t('dairyStockName')}
            value={name}
            onChange={setName}
            error={errors.name}
            required
          />
          <div className="av-field">
            <label className="av-label">{t('dairyStockCategory')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`av-chip${category === c ? ' selected' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {t(`dairyStockCat_${c}`)}
                </button>
              ))}
            </div>
          </div>
          <LabeledTextField
            label={t('dairyStockUnit')}
            value={unit}
            onChange={setUnit}
            placeholder="L / kg / pcs"
            error={errors.unit}
          />
          <LabeledTextField
            label={t('dairyStockQty')}
            value={qty}
            onChange={setQty}
            type="number"
            inputMode="decimal"
            error={errors.stockQty}
          />
          <LabeledTextField
            label={t('dairyStockPrice')}
            value={price}
            onChange={setPrice}
            type="number"
            inputMode="decimal"
            error={errors.unitPrice}
          />
          <div className="av-field">
            <label className="av-label">{t('dairyStockExpiry')}</label>
            <input
              className={`av-input${errors.expiryDate ? ' invalid' : ''}`}
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
            {errors.expiryDate ? <p className="av-field-error">{errors.expiryDate}</p> : null}
          </div>
          <div className="dairy-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitAdd()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setAddOpen(false)} disabled={busy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>

      <ModalSheet
        open={adjustTarget !== null}
        onClose={() => !busy && setAdjustTarget(null)}
        title={`${t('dairyStockAdjust')} — ${adjustTarget?.name ?? ''}`}
      >
        <div className="dairy-form">
          <p className="dairy-hint" style={{ marginTop: 0 }}>
            {t('dairyStockQty')}: {adjustTarget ? `${adjustTarget.stockQty} ${adjustTarget.unit || ''}` : ''}
          </p>
          <LabeledTextField
            label={t('dairyStockDelta')}
            value={delta}
            onChange={setDelta}
            type="number"
            inputMode="decimal"
            error={errors.delta}
            required
          />
          <p className="dairy-hint" style={{ marginTop: -10 }}>
            {t('dairyStockDeltaHint')}
          </p>
          <LabeledTextField
            label={t('dairyStockReason')}
            value={reason}
            onChange={setReason}
            error={errors.reason}
            required
          />
          <div className="dairy-actions">
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => void submitAdjust()}
              disabled={busy}
            >
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={() => setAdjustTarget(null)}
              disabled={busy}
            >
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
