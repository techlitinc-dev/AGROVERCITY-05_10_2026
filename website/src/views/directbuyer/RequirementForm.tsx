import React, { useEffect, useState } from 'react';
import { Repeat } from 'lucide-react';
import type { BuyerDemand } from '../../types';
import { FREQUENCY_LABEL } from '../trade/directConnect';

export interface RequirementFormValue {
  crop: string;
  variety: string;
  quantity: number;
  unit: string;
  qualityGrade: 'A' | 'B' | 'C';
  gradeNotes: string;
  supplyType: 'oneTime' | 'recurring';
  neededBy: string;
  quantityPerDelivery: number;
  frequency: 'weekly' | 'fortnightly' | 'monthly';
  startDate: string;
  endDate: string;
  deliveryMode: 'delivery' | 'collection';
  deliveryLocation: string;
  district: string;
  transportArrangement: string;
  packagingRequirements: string;
  labellingRequirements: string;
  partialAllowed: boolean;
  multipleFarmersAllowed: boolean;
  targetPrice: number;
  targetUnit: string;
  samplingRequirements: string;
  qualityConditions: string;
  notes: string;
}

export const emptyRequirementForm = (): RequirementFormValue => ({
  crop: '',
  variety: '',
  quantity: 100,
  unit: 'quintal',
  qualityGrade: 'A',
  gradeNotes: '',
  supplyType: 'oneTime',
  neededBy: '',
  quantityPerDelivery: 10,
  frequency: 'weekly',
  startDate: '',
  endDate: '',
  deliveryMode: 'delivery',
  deliveryLocation: '',
  district: '',
  transportArrangement: '',
  packagingRequirements: '',
  labellingRequirements: '',
  partialAllowed: true,
  multipleFarmersAllowed: true,
  targetPrice: 0,
  targetUnit: 'quintal',
  samplingRequirements: '',
  qualityConditions: '',
  notes: '',
});

export const formFromDemand = (d: BuyerDemand): RequirementFormValue => ({
  crop: d.crop ?? '',
  variety: d.variety ?? '',
  quantity: d.quantity ?? d.requiredQuantityQuintal ?? 0,
  unit: d.unit ?? 'quintal',
  qualityGrade: d.qualityGrade ?? 'A',
  gradeNotes: d.gradeNotes ?? '',
  supplyType: d.supplyType ?? ((d.frequency ?? 'oneTime') !== 'oneTime' ? 'recurring' : 'oneTime'),
  neededBy: d.neededBy ?? d.validUntil ?? '',
  quantityPerDelivery: d.quantityPerDelivery ?? 10,
  frequency: (d.frequency as 'weekly' | 'fortnightly' | 'monthly') ?? 'weekly',
  startDate: d.startDate ?? '',
  endDate: d.endDate ?? '',
  deliveryMode: d.deliveryMode ?? 'delivery',
  deliveryLocation: d.deliveryLocation ?? '',
  district: d.district ?? '',
  transportArrangement: d.transportArrangement ?? '',
  packagingRequirements: d.packagingRequirements ?? d.packaging ?? '',
  labellingRequirements: d.labellingRequirements ?? '',
  partialAllowed: d.partialAllowed !== false,
  multipleFarmersAllowed: d.multipleFarmersAllowed !== false,
  targetPrice: d.targetPrice ?? d.maxPrice ?? d.maxPricePerQuintal ?? 0,
  targetUnit: d.targetUnit ?? d.unit ?? 'quintal',
  samplingRequirements: d.samplingRequirements ?? '',
  qualityConditions: d.qualityConditions ?? d.qualitySpecs ?? '',
  notes: d.notes ?? '',
});

export const toDemandPayload = (f: RequirementFormValue): Record<string, unknown> => ({
  crop: f.crop,
  variety: f.variety,
  quantity: f.quantity,
  unit: f.unit,
  qualityGrade: f.qualityGrade,
  gradeNotes: f.gradeNotes,
  supplyType: f.supplyType,
  frequency: f.supplyType === 'recurring' ? f.frequency : 'oneTime',
  neededBy: f.supplyType === 'oneTime' ? f.neededBy : '',
  quantityPerDelivery: f.supplyType === 'recurring' ? f.quantityPerDelivery : undefined,
  startDate: f.supplyType === 'recurring' ? f.startDate : '',
  endDate: f.supplyType === 'recurring' ? f.endDate : '',
  deliveryMode: f.deliveryMode,
  deliveryLocation: f.deliveryLocation,
  district: f.district,
  transportArrangement: f.transportArrangement,
  packagingRequirements: f.packagingRequirements,
  labellingRequirements: f.labellingRequirements,
  partialAllowed: f.partialAllowed,
  multipleFarmersAllowed: f.multipleFarmersAllowed,
  targetPrice: f.targetPrice,
  targetUnit: f.targetUnit,
  samplingRequirements: f.samplingRequirements,
  qualityConditions: f.qualityConditions,
  notes: f.notes,
});

const inputCls =
  'w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none';
const labelCls = 'block text-xs font-bold text-slate-700 mb-1';

interface Props {
  value: RequirementFormValue;
  onChange: (next: RequirementFormValue) => void;
}

/** One-time / recurring industrial sourcing requirement form (spec §5).
 * Advanced quality fields stay collapsed unless needed. */
export const RequirementForm: React.FC<Props> = ({ value: f, onChange }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const set = <K extends keyof RequirementFormValue>(k: K, v: RequirementFormValue[K]) =>
    onChange({ ...f, [k]: v });

  // When switching to one-time, carry the per-delivery unit forward.
  useEffect(() => {
    if (f.supplyType === 'recurring' && !f.quantityPerDelivery) {
      onChange({ ...f, quantityPerDelivery: Math.max(1, Math.round(f.quantity / 4)) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.supplyType]);

  return (
    <div className="space-y-4">
      {/* A. Produce */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Crop *</label>
          <input className={inputCls} value={f.crop} onChange={(e) => set('crop', e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Variety</label>
          <input className={inputCls} value={f.variety} onChange={(e) => set('variety', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Total quantity *</label>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={f.quantity || ''}
            onChange={(e) => set('quantity', Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className={labelCls}>Unit *</label>
          <select className={`${inputCls} bg-white`} value={f.unit} onChange={(e) => set('unit', e.target.value)}>
            <option value="quintal">Quintal</option>
            <option value="tonne">Tonne</option>
            <option value="kg">Kg</option>
            <option value="crate">Crate</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Grade</label>
          <select
            className={`${inputCls} bg-white`}
            value={f.qualityGrade}
            onChange={(e) => set('qualityGrade', e.target.value as 'A' | 'B' | 'C')}
          >
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
            <option value="C">Grade C</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Target price (₹, optional)</label>
          <input
            type="number"
            min={0}
            className={`${inputCls} text-emerald-800`}
            value={f.targetPrice || ''}
            onChange={(e) => set('targetPrice', Number(e.target.value))}
          />
        </div>
      </div>

      {/* B. Supply type */}
      <div>
        <label className={labelCls}>Supply type *</label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { key: 'oneTime', label: 'One-time', hint: 'Single delivery / purchase' },
              { key: 'recurring', label: 'Recurring', hint: 'Sourcing interest only — no auto orders' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => set('supplyType', t.key)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                f.supplyType === t.key
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                {t.key === 'recurring' && <Repeat className="w-3.5 h-3.5 text-violet-600" />}
                {t.label}
              </span>
              <span className="text-[10px] text-slate-500">{t.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {f.supplyType === 'oneTime' ? (
        <div>
          <label className={labelCls}>Required-by date *</label>
          <input
            type="date"
            className={inputCls}
            value={f.neededBy}
            onChange={(e) => set('neededBy', e.target.value)}
            required
          />
        </div>
      ) : (
        <div className="p-3 bg-violet-50 border border-violet-200 rounded-2xl space-y-3">
          <p className="text-[10px] text-violet-700 font-bold">
            Recurring requirements describe sourcing interest only — they never create recurring orders, invoices,
            deliveries or payments automatically.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Quantity per delivery *</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={f.quantityPerDelivery || ''}
                onChange={(e) => set('quantityPerDelivery', Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Frequency *</label>
              <select
                className={`${inputCls} bg-white`}
                value={f.frequency}
                onChange={(e) => set('frequency', e.target.value as 'weekly' | 'fortnightly' | 'monthly')}
              >
                <option value="weekly">{FREQUENCY_LABEL.weekly}</option>
                <option value="fortnightly">{FREQUENCY_LABEL.fortnightly}</option>
                <option value="monthly">{FREQUENCY_LABEL.monthly}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Start date *</label>
              <input
                type="date"
                className={inputCls}
                value={f.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls}>End date (optional)</label>
              <input
                type="date"
                className={inputCls}
                value={f.endDate}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* C. Delivery / collection */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Delivery mode *</label>
          <select
            className={`${inputCls} bg-white`}
            value={f.deliveryMode}
            onChange={(e) => set('deliveryMode', e.target.value as 'delivery' | 'collection')}
          >
            <option value="delivery">Buyer delivery address</option>
            <option value="collection">We collect from farmers</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{f.deliveryMode === 'collection' ? 'Collection location *' : 'Delivery location *'}</label>
          <input
            className={inputCls}
            value={f.deliveryLocation}
            onChange={(e) => set('deliveryLocation', e.target.value)}
            placeholder="Nashik APMC Yard"
            required
          />
        </div>
        <div>
          <label className={labelCls}>District</label>
          <input className={inputCls} value={f.district} onChange={(e) => set('district', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Transport arrangement</label>
          <input
            className={inputCls}
            value={f.transportArrangement}
            onChange={(e) => set('transportArrangement', e.target.value)}
            placeholder="Buyer trucks / farmer brings / third party"
          />
        </div>
      </div>

      {/* D. Sourcing preferences */}
      <div className="space-y-2">
        <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
          <input
            type="checkbox"
            checked={f.partialAllowed}
            onChange={(e) => set('partialAllowed', e.target.checked)}
            className="w-4 h-4 accent-emerald-600"
          />
          Partial quantity allowed
        </label>
        <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
          <input
            type="checkbox"
            checked={f.multipleFarmersAllowed}
            onChange={(e) => set('multipleFarmersAllowed', e.target.checked)}
            className="w-4 h-4 accent-emerald-600"
          />
          Multiple farmers allowed
        </label>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        className="text-xs font-bold text-emerald-700 hover:underline"
      >
        {showAdvanced ? '− Hide packaging & quality details' : '+ Add packaging / quality details (optional)'}
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="col-span-2">
            <label className={labelCls}>Packaging requirements</label>
            <input
              className={inputCls}
              value={f.packagingRequirements}
              onChange={(e) => set('packagingRequirements', e.target.value)}
              placeholder="50kg gunny bags, dry & ventilated"
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Labelling requirements</label>
            <input
              className={inputCls}
              value={f.labellingRequirements}
              onChange={(e) => set('labellingRequirements', e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Sampling / inspection requirements</label>
            <input
              className={inputCls}
              value={f.samplingRequirements}
              onChange={(e) => set('samplingRequirements', e.target.value)}
              placeholder="Third-party inspection at collection"
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Quality acceptance / rejection conditions</label>
            <textarea
              rows={2}
              className={inputCls}
              value={f.qualityConditions}
              onChange={(e) => set('qualityConditions', e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Detailed quality notes</label>
            <textarea
              rows={2}
              className={inputCls}
              value={f.gradeNotes}
              onChange={(e) => set('gradeNotes', e.target.value)}
            />
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>Additional notes</label>
        <textarea rows={2} className={inputCls} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
    </div>
  );
};
