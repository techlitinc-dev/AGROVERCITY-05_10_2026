import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Boxes, ClipboardCheck, FlaskConical, History, Loader2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { exporter, type ExportReadinessPayload } from '../../lib/api/exporter';
import { apiErrorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';

interface CropRow {
  crop: string;
  normalQuantity: string;
  unit: string;
  availableFrom: string;
  availableTo: string;
}

/**
 * Farmer — Export Readiness Profile (spec §3.4).
 * Farmer-supplied capability information (crops, quantities, calendar,
 * genuine certifications, residue/test references, packaging, experience).
 * Nothing here is platform-verified and it never creates a "Export Ready" badge.
 */
export const ExportReadinessView: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [rows, setRows] = useState<CropRow[]>([]);
  const [farmLocation, setFarmLocation] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [certifications, setCertifications] = useState('');
  const [residueTestRefs, setResidueTestRefs] = useState('');
  const [packagingCapability, setPackagingCapability] = useState('');
  const [previousExportExperience, setPreviousExportExperience] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** View mode shows the saved profile read-only; edit mode is the form. */
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const doc = (await exporter.getReadiness()) as ExportReadinessPayload & { updatedAt?: string };
      setSavedAt(doc.updatedAt || null);
      setRows(
        (doc.crops || []).map((c) => ({
          crop: c.crop || '',
          normalQuantity: c.normalQuantity ? String(c.normalQuantity) : '',
          unit: c.unit || 'quintal',
          availableFrom: c.availableFrom || '',
          availableTo: c.availableTo || '',
        })),
      );
      setFarmLocation(doc.farmLocation || '');
      setVillage(doc.village || '');
      setDistrict(doc.district || '');
      setState(doc.state || '');
      setCertifications((doc.certifications || []).join(', '));
      setResidueTestRefs((doc.residueTestRefs || []).join(', '));
      setPackagingCapability(doc.packagingCapability || '');
      setPreviousExportExperience(doc.previousExportExperience || '');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setRow = (index: number, patch: Partial<CropRow>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload: ExportReadinessPayload = {
      crops: rows
        .filter((r) => r.crop.trim())
        .map((r) => ({
          crop: r.crop.trim(),
          normalQuantity: r.normalQuantity ? Number(r.normalQuantity) : null,
          unit: r.unit || null,
          availableFrom: r.availableFrom || null,
          availableTo: r.availableTo || null,
        })),
      farmLocation: farmLocation || null,
      village: village || null,
      district: district || null,
      state: state || null,
      certifications: certifications.split(',').map((c) => c.trim()).filter(Boolean),
      residueTestRefs: residueTestRefs.split(',').map((c) => c.trim()).filter(Boolean),
      packagingCapability: packagingCapability || null,
      previousExportExperience: previousExportExperience || null,
    };
    try {
      const saved = (await exporter.saveReadiness(payload)) as ExportReadinessPayload & { updatedAt?: string };
      setSavedAt(saved.updatedAt || new Date().toISOString());
      setNotice('Export readiness profile saved. It is your own record — certifications are only marked verified after a real document review.');
      setMode('view');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const isEmpty =
    !rows.some((r) => r.crop.trim()) &&
    !farmLocation.trim() &&
    !village.trim() &&
    !district.trim() &&
    !state.trim() &&
    !certifications.trim() &&
    !residueTestRefs.trim() &&
    !packagingCapability.trim() &&
    !previousExportExperience.trim();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading your readiness profile…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-emerald-600" />
            Export Readiness Profile
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Keep your export capability on record so you can apply faster. Only list genuine
            certifications — a certificate shows "verified" only after an actual document review, never
            just because it was uploaded. This profile never guarantees export clearance or buyer
            acceptance.
          </p>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800">
          {notice}
        </div>
      )}

      {mode === 'view' ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-slate-800">Saved readiness profile</h2>
            {!isEmpty && (
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 hover:bg-emerald-700 transition"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Profile
              </button>
            )}
          </div>

          {isEmpty ? (
            <div className="py-10 text-center space-y-3">
              <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-500">No readiness profile saved yet</p>
              <p className="text-[11px] text-slate-400">
                Set it up once — your details prefill every time you apply to an export opportunity.
              </p>
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold px-4 py-2 hover:bg-emerald-700 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Set Up Readiness Profile
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {rows.filter((r) => r.crop.trim()).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Crops &amp; normal quantities
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {rows
                      .filter((r) => r.crop.trim())
                      .map((r, i) => (
                        <div key={i} className="rounded-2xl bg-slate-50 border border-slate-100 p-3 space-y-1">
                          <p className="text-xs font-extrabold text-slate-900">{r.crop}</p>
                          <p className="text-[11px] text-slate-600">
                            {r.normalQuantity ? `${r.normalQuantity} ${r.unit}` : 'Quantity on request'}
                          </p>
                          {(r.availableFrom || r.availableTo) && (
                            <p className="text-[11px] text-slate-400">
                              {r.availableFrom || '…'} → {r.availableTo || '…'}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {(village.trim() || district.trim() || state.trim() || farmLocation.trim()) && (
                <div className="space-y-1">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Farm location</h3>
                  <p className="text-xs text-slate-700 flex items-center gap-1.5 flex-wrap">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    {[village, district, state].map((s) => s.trim()).filter(Boolean).join(', ') || farmLocation}
                  </p>
                  {farmLocation.trim() && [village, district, state].some((s) => s.trim()) && (
                    <p className="text-[11px] text-slate-500 pl-5">{farmLocation}</p>
                  )}
                </div>
              )}

              {(certifications.trim() || residueTestRefs.trim() || packagingCapability.trim() || previousExportExperience.trim()) && (
                <div className="space-y-2.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quality &amp; capability</h3>
                  {certifications.trim() && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                      {certifications.split(',').map((c) => c.trim()).filter(Boolean).map((c) => (
                        <span key={c} className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {residueTestRefs.trim() && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5 text-sky-600" />
                      {residueTestRefs.split(',').map((c) => c.trim()).filter(Boolean).map((c) => (
                        <span key={c} className="text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {packagingCapability.trim() && (
                    <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> {packagingCapability}
                    </p>
                  )}
                  {previousExportExperience.trim() && (
                    <p className="text-[11px] text-slate-600 flex items-start gap-1.5">
                      <History className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" /> {previousExportExperience}
                    </p>
                  )}
                </div>
              )}

              {savedAt && <p className="text-[10px] text-slate-400">Last saved {formatDateTime(savedAt)}</p>}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800">Crops & normal quantities</h2>
          <button
            type="button"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { crop: '', normalQuantity: '', unit: 'quintal', availableFrom: '', availableTo: '' },
              ])
            }
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 hover:bg-emerald-700 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add crop
          </button>
        </div>
        {rows.length === 0 && (
          <p className="text-xs text-slate-400 italic">No crops added yet — add what you normally grow.</p>
        )}
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end rounded-2xl bg-slate-50 border border-slate-100 p-2.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase col-span-2 sm:col-span-1">
              Crop
              <input
                type="text"
                value={row.crop}
                onChange={(e) => setRow(i, { crop: e.target.value })}
                className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5"
              />
            </label>
            <label className="text-[10px] font-bold text-slate-400 uppercase">
              Normal qty
              <input
                type="number"
                min="0"
                value={row.normalQuantity}
                onChange={(e) => setRow(i, { normalQuantity: e.target.value })}
                className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5"
              />
            </label>
            <label className="text-[10px] font-bold text-slate-400 uppercase">
              Unit
              <select
                value={row.unit}
                onChange={(e) => setRow(i, { unit: e.target.value })}
                className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5"
              >
                <option value="quintal">quintal</option>
                <option value="MT">MT</option>
                <option value="kg">kg</option>
              </select>
            </label>
            <label className="text-[10px] font-bold text-slate-400 uppercase">
              Available from
              <input
                type="date"
                value={row.availableFrom}
                onChange={(e) => setRow(i, { availableFrom: e.target.value })}
                className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5"
              />
            </label>
            <label className="text-[10px] font-bold text-slate-400 uppercase">
              Available to
              <input
                type="date"
                value={row.availableTo}
                onChange={(e) => setRow(i, { availableTo: e.target.value })}
                className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5"
              />
            </label>
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 text-rose-600 text-[11px] font-bold px-2 py-1.5 hover:bg-rose-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-800">Farm location</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input
            type="text"
            placeholder="Village"
            value={village}
            onChange={(e) => setVillage(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
          />
          <input
            type="text"
            placeholder="District"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
          />
          <input
            type="text"
            placeholder="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
          />
          <input
            type="text"
            placeholder="Full farm address / area"
            value={farmLocation}
            onChange={(e) => setFarmLocation(e.target.value)}
            className="col-span-2 sm:col-span-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-800">Quality & capability</h2>
        <label className="block text-[11px] font-bold text-slate-500">
          Genuine certifications (comma separated)
          <input
            type="text"
            placeholder="e.g. GlobalGAP, Organic NPOP"
            value={certifications}
            onChange={(e) => setCertifications(e.target.value)}
            className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
          />
        </label>
        <label className="block text-[11px] font-bold text-slate-500">
          Residue / lab test references (comma separated)
          <input
            type="text"
            placeholder="e.g. NABL lab report IDs"
            value={residueTestRefs}
            onChange={(e) => setResidueTestRefs(e.target.value)}
            className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
          />
        </label>
        <label className="block text-[11px] font-bold text-slate-500">
          Packaging capability
          <input
            type="text"
            placeholder="e.g. Mesh bags, crates, palletized stacks"
            value={packagingCapability}
            onChange={(e) => setPackagingCapability(e.target.value)}
            className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
          />
        </label>
        <label className="block text-[11px] font-bold text-slate-500">
          Previous export-supply experience (optional)
          <textarea
            rows={2}
            value={previousExportExperience}
            onChange={(e) => setPreviousExportExperience(e.target.value)}
            className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
          />
        </label>
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode('view');
            void load();
          }}
          className="px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold py-2.5 hover:bg-slate-50 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-xl bg-emerald-600 text-white text-sm font-bold py-2.5 hover:bg-emerald-700 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Readiness Profile
        </button>
      </div>
        </>
      )}
    </div>
  );
};
