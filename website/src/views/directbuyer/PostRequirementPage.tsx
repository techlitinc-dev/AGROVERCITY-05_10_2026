import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, ShieldAlert } from 'lucide-react';
import { demands, users, apiErrorMessage } from '../../lib/api';
import type { BuyerDemand } from '../../types';
import { RequirementForm, emptyRequirementForm, toDemandPayload } from './RequirementForm';

/** Buyer destination #2 — Post a one-time or recurring sourcing requirement. */
export const PostRequirementPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyRequirementForm);
  const [kycVerified, setKycVerified] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    users
      .getMe()
      .then((me) => {
        const m = me as { kycStatus?: string; vyapariVerified?: boolean };
        setKycVerified(m.kycStatus === 'verified' || m.vyapariVerified === true);
      })
      .catch(() => setKycVerified(true));
  }, []);

  const save = async (status: 'open' | 'draft') => {
    setSaving(true);
    setError(null);
    try {
      await demands.create({ ...toDemandPayload(form), status } as Partial<BuyerDemand>);
      navigate('/directbuyer/requirements');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const valid =
    form.crop.trim().length > 0 &&
    form.quantity > 0 &&
    form.deliveryLocation.trim().length > 0 &&
    (form.supplyType === 'oneTime'
      ? form.neededBy.length > 0
      : form.quantityPerDelivery > 0 && form.startDate.length > 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Megaphone className="w-7 h-7 text-emerald-600" />
          Post Requirement
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Publish what you need to source. Farmers apply with quantity, price, availability and supply basis — you
          compare applications and unlock contact only with the farmers you choose.
        </p>
      </div>

      {!kycVerified && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Complete your identity verification (KYC) before publishing — unverified buyers cannot publish requirements.
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <RequirementForm value={form} onChange={setForm} />
        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
            {error}
          </div>
        )}
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => void save('open')}
            disabled={!valid || saving || !kycVerified}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            {saving ? 'Publishing…' : 'Publish requirement'}
          </button>
          <button
            onClick={() => void save('draft')}
            disabled={saving}
            className="px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all disabled:opacity-50"
          >
            Save draft
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-3">
          Publishing requires verified KYC and a valid location/schedule. Recurring requirements are sourcing interest
          only — no orders, invoices or payments are ever generated from them.
        </p>
      </div>
    </div>
  );
};
