import React, { useCallback, useEffect, useState } from 'react';
import { IndianRupee, Milk, Pencil, Plus } from 'lucide-react';
import { milkVendor } from '../../../lib/api';
import { rupeesToPaisa } from '../../../lib/api/milkVendor';
import { ModalSheet } from '../../../components/common/ModalSheet';
import { SectionCard, EmptyState, ErrorBanner, inputCls, btnPrimary, btnGhost, rec, recArr, str, num, bool, todayStr, fmtPaisa } from './shared';

interface Props {
  products: Record<string, unknown>[];
  clients: Record<string, unknown>[];
  refreshKey: number;
  notify: (message: string) => void;
  onChanged: () => void;
}

export const RatesTab: React.FC<Props> = ({ products, clients, refreshKey, notify, onChanged }) => {
  const [rates, setRates] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productModal, setProductModal] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', unit: 'litre' });
  const [editingProduct, setEditingProduct] = useState<Record<string, unknown> | null>(null);

  const [rateModal, setRateModal] = useState(false);
  const [rateForm, setRateForm] = useState({ productId: '', clientId: '', rateRupees: '', effectiveFrom: todayStr() });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRates(await milkVendor.rates());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load rates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const saveProduct = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editingProduct) {
        await milkVendor.updateProduct(str(editingProduct.id), { name: productForm.name.trim(), unit: productForm.unit.trim() || 'litre' });
        notify('Product updated');
      } else {
        await milkVendor.addProduct({ name: productForm.name.trim(), unit: productForm.unit.trim() || 'litre' });
        notify('Product added');
      }
      setProductModal(false);
      setEditingProduct(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = async (p: Record<string, unknown>) => {
    try {
      await milkVendor.updateProduct(str(p.id), { active: !bool(p.active, true) });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const saveRate = async () => {
    setSaving(true);
    setError(null);
    try {
      const rate = rupeesToPaisa(rateForm.rateRupees);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Rate must be more than zero');
      await milkVendor.addRate({
        productId: rateForm.productId,
        clientId: rateForm.clientId || undefined,
        ratePaisaPerUnit: rate,
        effectiveFrom: rateForm.effectiveFrom,
      });
      notify('Rate saved');
      setRateModal(false);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const clientName = (id: unknown) => str(clients.find((c) => c.id === str(id))?.name) || '—';
  const productName = (id: unknown) => str(products.find((p) => str(p.id) === str(id))?.name) || '—';

  const defaultRates = rates.filter((r) => !str(r.clientId));
  const overrideRates = rates.filter((r) => str(r.clientId));

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      <SectionCard
        title="Products"
        action={
          <button
            onClick={() => {
              setEditingProduct(null);
              setProductForm({ name: '', unit: 'litre' });
              setProductModal(true);
            }}
            className={btnPrimary}
          >
            <Plus className="h-3.5 w-3.5" /> Add product
          </button>
        }
      >
        {products.length === 0 ? (
          <EmptyState message="No products yet — add Milk, Buffalo Milk, Curd, etc." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {products.map((p) => (
              <li key={str(p.id)} className="py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Milk className="h-4 w-4 text-emerald-600" />
                  <span className={bool(p.active, true) ? 'text-slate-800' : 'text-slate-400 line-through'}>
                    {str(p.name)} <span className="text-xs text-slate-500">({str(p.unit, 'litre')})</span>
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      setEditingProduct(p);
                      setProductForm({ name: str(p.name), unit: str(p.unit, 'litre') });
                      setProductModal(true);
                    }}
                    className={btnGhost}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => toggleProduct(p)} className={btnGhost}>
                    {bool(p.active, true) ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Default rates (per litre)"
        action={
          <button
            onClick={() => {
              setRateForm({ productId: str(products[0]?.id), clientId: '', rateRupees: '', effectiveFrom: todayStr() });
              setRateModal(true);
            }}
            className={btnPrimary}
            disabled={products.length === 0}
          >
            <Plus className="h-3.5 w-3.5" /> Set default rate
          </button>
        }
      >
        {loading ? (
          <EmptyState message="Loading rates…" />
        ) : defaultRates.length === 0 ? (
          <EmptyState message="No default rates yet. Rates are required before deliveries can be billed." />
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {defaultRates.map((r) => (
              <li key={str(r.id)} className="py-2 flex justify-between">
                <span className="text-slate-700">{productName(r.productId)}</span>
                <span className="text-slate-600">
                  {fmtPaisa(num(r.ratePaisaPerUnit))}/L · from {str(r.effectiveFrom)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Client-specific overrides"
        action={
          <button
            onClick={() => {
              setRateForm({ productId: str(products[0]?.id), clientId: str(clients[0]?.id), rateRupees: '', effectiveFrom: todayStr() });
              setRateModal(true);
            }}
            className={btnGhost}
            disabled={products.length === 0 || clients.length === 0}
          >
            <Plus className="h-3.5 w-3.5" /> Add override
          </button>
        }
      >
        {overrideRates.length === 0 ? (
          <p className="text-sm text-slate-500">No overrides — every client pays the default product rate.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {overrideRates.map((r) => (
              <li key={str(r.id)} className="py-2 flex justify-between">
                <span className="text-slate-700">
                  {clientName(r.clientId)} · {productName(r.productId)}
                </span>
                <span className="text-slate-600">
                  {fmtPaisa(num(r.ratePaisaPerUnit))}/L · from {str(r.effectiveFrom)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-slate-400">Rate changes never rewrite history — older deliveries keep the rate they were recorded with.</p>
      </SectionCard>

      <ModalSheet isOpen={productModal} onClose={() => setProductModal(false)} title={editingProduct ? 'Edit product' : 'Add product'} maxWidth="sm">
        <div className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Name *</span>
            <input className={inputCls} value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Buffalo Milk" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Unit</span>
            <input className={inputCls} value={productForm.unit} onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })} />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setProductModal(false)} className={btnGhost}>Cancel</button>
            <button onClick={saveProduct} disabled={saving || !productForm.name.trim()} className={btnPrimary}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </ModalSheet>

      <ModalSheet isOpen={rateModal} onClose={() => setRateModal(false)} title="Set rate" maxWidth="sm">
        <div className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Product *</span>
            <select className={inputCls} value={rateForm.productId} onChange={(e) => setRateForm({ ...rateForm, productId: e.target.value })}>
              {products.map((p) => (
                <option key={str(p.id)} value={str(p.id)}>{str(p.name)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Client (leave empty for vendor default)</span>
            <select className={inputCls} value={rateForm.clientId} onChange={(e) => setRateForm({ ...rateForm, clientId: e.target.value })}>
              <option value="">— Vendor default —</option>
              {clients.map((c) => (
                <option key={str(c.id)} value={str(c.id)}>{str(c.name)}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Rate (₹/L) *</span>
              <input type="number" min="0" step="0.5" className={inputCls} value={rateForm.rateRupees} onChange={(e) => setRateForm({ ...rateForm, rateRupees: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Effective from *</span>
              <input type="date" className={inputCls} value={rateForm.effectiveFrom} onChange={(e) => setRateForm({ ...rateForm, effectiveFrom: e.target.value })} />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setRateModal(false)} className={btnGhost}>Cancel</button>
            <button onClick={saveRate} disabled={saving} className={btnPrimary}>
              <IndianRupee className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save rate'}
            </button>
          </div>
        </div>
      </ModalSheet>
    </div>
  );
};
