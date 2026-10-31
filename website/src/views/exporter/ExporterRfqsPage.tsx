import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ship,
  Plus,
  Loader2,
  Pause,
  Play,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil,
  Phone,
} from 'lucide-react';
import { exporter } from '../../lib/api/exporter';
import { apiErrorMessage } from '../../lib/api';
import type { ExportApplication, ExportRfq } from '../../types';
import { ModalSheet } from '../../components/common/ModalSheet';
import { isKycError } from '../../lib/api/leads';
import {
  ContactActions,
  ContactUnlockModal,
  ExportStatusBadge,
  NegotiationChecklist,
  VerificationBadges,
} from '../export/shared';

const EMPTY_FORM: Record<string, unknown> = {
  crop: '',
  variety: '',
  gradeSpec: '',
  quantityQuintals: '',
  quantityUnit: 'quintal',
  partialQuantityAllowed: true,
  multiFarmerAllowed: true,
  packing: '',
  deliveryWindowFrom: '',
  deliveryWindowTo: '',
  deliveryLocation: '',
  paymentTermsDays: 30,
  notes: '',
  moistureRequirement: '',
  sizeSpec: '',
  qualityParams: '',
  residueRequirements: '',
  requiredCertifications: '',
  inspectionRequirements: '',
  sampleRequirements: '',
  rejectionConditions: '',
  packagingRequirements: '',
  labellingRequirements: '',
  shipmentWindow: '',
  targetPrice: '',
  currency: 'INR',
  priceBasis: '',
  destinationCountry: '',
  requiredExportDocuments: '',
  buyerNotes: '',
  publish: true,
};

/**
 * Exporter — My Export Requirements (spec §4.2/4.3, §5).
 * Create/edit structured sourcing RFQs and review applications per RFQ.
 */
export const ExporterRfqsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rfqs, setRfqs] = useState<ExportRfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExportRfq | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [reviewRfq, setReviewRfq] = useState<ExportRfq | null>(null);
  const [applications, setApplications] = useState<ExportApplication[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  const [contactApp, setContactApp] = useState<ExportApplication | null>(null);
  const [unlockedApp, setUnlockedApp] = useState<ExportApplication | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRfqs(await exporter.rfqs(statusFilter ? { status: statusFilter } : undefined));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreate();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (rfq: ExportRfq) => {
    setEditing(rfq);
    setForm({
      ...EMPTY_FORM,
      crop: rfq.crop,
      variety: rfq.variety || '',
      gradeSpec: rfq.gradeSpec || '',
      quantityQuintals: String(rfq.quantityQuintals),
      quantityUnit: rfq.quantityUnit || 'quintal',
      partialQuantityAllowed: rfq.partialQuantityAllowed !== false,
      multiFarmerAllowed: rfq.multiFarmerAllowed !== false,
      packing: rfq.packing || '',
      deliveryWindowFrom: rfq.deliveryWindow?.from || '',
      deliveryWindowTo: rfq.deliveryWindow?.to || '',
      deliveryLocation: rfq.deliveryLocation,
      paymentTermsDays: rfq.paymentTermsDays,
      notes: rfq.notes || '',
      moistureRequirement: rfq.moistureRequirement || '',
      sizeSpec: rfq.sizeSpec || '',
      qualityParams: rfq.qualityParams || '',
      residueRequirements: rfq.residueRequirements || '',
      requiredCertifications: (rfq.requiredCertifications || []).join(', '),
      inspectionRequirements: rfq.inspectionRequirements || '',
      sampleRequirements: rfq.sampleRequirements || '',
      rejectionConditions: rfq.rejectionConditions || '',
      packagingRequirements: rfq.packagingRequirements || '',
      labellingRequirements: rfq.labellingRequirements || '',
      shipmentWindow: rfq.shipmentWindow || '',
      targetPrice: rfq.targetPrice ? String(rfq.targetPrice) : '',
      currency: rfq.currency || 'INR',
      priceBasis: rfq.priceBasis || '',
      destinationCountry: rfq.destinationCountry || '',
      requiredExportDocuments: (rfq.requiredExportDocuments || []).join(', '),
      buyerNotes: rfq.buyerNotes || '',
      publish: rfq.status !== 'draft',
    });
    setFormError(null);
    setShowForm(true);
  };

  const saveForm = async () => {
    setSaving(true);
    setFormError(null);
    const payload: Record<string, unknown> = {
      crop: String(form.crop || '').trim(),
      variety: form.variety || undefined,
      gradeSpec: form.gradeSpec || undefined,
      quantityQuintals: Number(form.quantityQuintals),
      quantityUnit: form.quantityUnit,
      partialQuantityAllowed: !!form.partialQuantityAllowed,
      multiFarmerAllowed: !!form.multiFarmerAllowed,
      packing: form.packing || undefined,
      deliveryWindow: { from: form.deliveryWindowFrom, to: form.deliveryWindowTo },
      deliveryLocation: String(form.deliveryLocation || '').trim(),
      paymentTermsDays: Number(form.paymentTermsDays ?? 0),
      notes: form.notes || undefined,
      moistureRequirement: form.moistureRequirement || undefined,
      sizeSpec: form.sizeSpec || undefined,
      qualityParams: form.qualityParams || undefined,
      residueRequirements: form.residueRequirements || undefined,
      requiredCertifications: String(form.requiredCertifications || '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      inspectionRequirements: form.inspectionRequirements || undefined,
      sampleRequirements: form.sampleRequirements || undefined,
      rejectionConditions: form.rejectionConditions || undefined,
      packagingRequirements: form.packagingRequirements || undefined,
      labellingRequirements: form.labellingRequirements || undefined,
      shipmentWindow: form.shipmentWindow || undefined,
      targetPrice: form.targetPrice ? Number(form.targetPrice) : undefined,
      currency: form.currency || undefined,
      priceBasis: form.priceBasis || undefined,
      destinationCountry: form.destinationCountry || undefined,
      requiredExportDocuments: String(form.requiredExportDocuments || '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      buyerNotes: form.buyerNotes || undefined,
      publish: !!form.publish,
    };
    try {
      if (editing) {
        const updated = await exporter.updateRfq(editing.id, payload);
        setNotice(`Requirement ${updated.status === 'draft' ? 'saved as draft' : 'updated'}.`);
      } else {
        const created = await exporter.createRfq(payload);
        setNotice(
          created.status === 'draft'
            ? 'Requirement saved as draft — publish it when ready.'
            : 'Requirement published. Farmers can now apply.',
        );
      }
      setShowForm(false);
      await load();
    } catch (err) {
      if (isKycError(err)) {
        setFormError('Complete your identity verification (KYC) before publishing export requirements.');
      } else {
        setFormError(apiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const act = async (rfq: ExportRfq, action: () => Promise<ExportRfq>, success: string) => {
    setBusyId(rfq.id);
    try {
      await action();
      setNotice(success);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const openReview = async (rfq: ExportRfq) => {
    setReviewRfq(rfq);
    setReviewLoading(true);
    setApplications([]);
    try {
      setApplications(await exporter.rfqApplications(rfq.id));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setReviewLoading(false);
    }
  };

  const dismiss = async (app: ExportApplication) => {
    try {
      const updated = await exporter.dismissApplication(app.id);
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setNotice('Application dismissed. The farmer is informed.');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openUnlock = (app: ExportApplication) => setContactApp(app);

  const onUnlocked = (updated: ExportApplication) => {
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setUnlockedApp(updated);
    setContactApp(null);
    setNotice('Contact unlocked — call, WhatsApp, and chat are now open for both parties.');
  };

  const visible = useMemo(() => rfqs, [rfqs]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Ship className="w-7 h-7 text-emerald-600" />
            My Export Requirements
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Structured sourcing requirements. Partial-quantity and multi-farmer fulfilment are
            supported — you decide when sourcing is complete. Contacts unlock per application after
            terms and MPIN verification; no order or payment is created on this platform.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 hover:bg-emerald-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Post Requirement
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'draft', 'open', 'paused', 'closed', 'fulfilled'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`text-xs font-bold rounded-xl px-3 py-1.5 border transition ${
              statusFilter === s
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {s === '' ? 'All' : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-start justify-between gap-4">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-600 font-bold shrink-0">
            Close
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading requirements…
        </div>
      ) : visible.length === 0 ? (
        <div className="p-10 text-center rounded-3xl border-2 border-dashed border-slate-200">
          <Ship className="w-10 h-10 mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-600">No requirements here</p>
          <p className="mt-1 text-xs text-slate-400">
            Post a structured requirement and farmers will apply with their available supply.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((rfq) => (
            <div key={rfq.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {rfq.crop}
                    {rfq.variety ? ` — ${rfq.variety}` : ''}
                    <span className="ml-2 text-xs font-semibold text-slate-400">
                      {rfq.quantityQuintals} {rfq.quantityUnit || 'quintals'} · {rfq.deliveryLocation}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    ready {rfq.deliveryWindow?.from || '—'} → {rfq.deliveryWindow?.to || '—'} ·{' '}
                    {rfq.partialQuantityAllowed ? 'partial OK' : 'full quantity only'} ·{' '}
                    {rfq.multiFarmerAllowed ? 'multi-farmer allowed' : 'single farmer'}
                    {rfq.destinationCountry ? ` · ships to ${rfq.destinationCountry}` : ''}
                  </p>
                </div>
                <ExportStatusBadge status={rfq.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openReview(rfq)}
                  className="rounded-xl bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 hover:bg-emerald-700 transition"
                >
                  View Applications ({rfq.applicationsCount ?? rfq.quoteCount ?? 0})
                </button>
                {rfq.status === 'draft' && (
                  <button
                    type="button"
                    disabled={busyId === rfq.id}
                    onClick={() => act(rfq, () => exporter.publishRfq(rfq.id), 'Requirement published.')}
                    className="rounded-xl border border-emerald-300 text-emerald-700 text-[11px] font-bold px-3 py-1.5 hover:bg-emerald-50 transition"
                  >
                    Publish
                  </button>
                )}
                {(rfq.status === 'open' || rfq.status === 'paused') && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(rfq)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold px-3 py-1.5 hover:bg-slate-50 transition"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    {rfq.status === 'open' ? (
                      <button
                        type="button"
                        disabled={busyId === rfq.id}
                        onClick={() => act(rfq, () => exporter.pauseRfq(rfq.id), 'Requirement paused.')}
                        className="inline-flex items-center gap-1 rounded-xl border border-amber-200 text-amber-700 text-[11px] font-bold px-3 py-1.5 hover:bg-amber-50 transition"
                      >
                        <Pause className="w-3 h-3" /> Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === rfq.id}
                        onClick={() => act(rfq, () => exporter.resumeRfq(rfq.id), 'Requirement resumed.')}
                        className="inline-flex items-center gap-1 rounded-xl border border-amber-200 text-amber-700 text-[11px] font-bold px-3 py-1.5 hover:bg-amber-50 transition"
                      >
                        <Play className="w-3 h-3" /> Resume
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === rfq.id}
                      onClick={() => act(rfq, () => exporter.fulfillRfq(rfq.id), 'Marked fulfilled — sourcing complete.')}
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 text-emerald-700 text-[11px] font-bold px-3 py-1.5 hover:bg-emerald-50 transition"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Mark Fulfilled
                    </button>
                    <button
                      type="button"
                      disabled={busyId === rfq.id}
                      onClick={() => act(rfq, () => exporter.closeRfq(rfq.id), 'Requirement closed.')}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 text-slate-500 text-[11px] font-bold px-3 py-1.5 hover:bg-slate-50 transition"
                    >
                      <XCircle className="w-3 h-3" /> Close
                    </button>
                    <button
                      type="button"
                      disabled={busyId === rfq.id}
                      onClick={() => {
                        if (window.confirm('Delete this requirement permanently?')) {
                          void act(rfq, () => exporter.deleteRfq(rfq.id).then(() => rfq), 'Requirement deleted.');
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 text-rose-600 text-[11px] font-bold px-3 py-1.5 hover:bg-rose-50 transition"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </>
                )}
                {(rfq.status === 'closed' || rfq.status === 'fulfilled') && (
                  <button
                    type="button"
                    disabled={busyId === rfq.id}
                    onClick={() => act(rfq, () => exporter.reopenRfq(rfq.id), 'Requirement reopened.')}
                    className="rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold px-3 py-1.5 hover:bg-slate-50 transition"
                  >
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit requirement */}
      <ModalSheet
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `Edit requirement — ${editing.crop}` : 'Post Export Requirement'}
        description="Describe produce, quality, supply window, and collection expectations. Farmers only quote farm-gate / collection-level supply — never international freight or customs."
        maxWidth="2xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Section title="A. Produce">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Field label="Crop / commodity *" value={form.crop} onChange={(v) => setForm((f) => ({ ...f, crop: v }))} />
              <Field label="Variety" value={form.variety} onChange={(v) => setForm((f) => ({ ...f, variety: v }))} />
              <Field label="Grade" value={form.gradeSpec} onChange={(v) => setForm((f) => ({ ...f, gradeSpec: v }))} />
              <Field label="Quality specification" value={form.qualityParams} onChange={(v) => setForm((f) => ({ ...f, qualityParams: v }))} />
              <Field label="Required quantity *" type="number" value={form.quantityQuintals} onChange={(v) => setForm((f) => ({ ...f, quantityQuintals: v }))} />
              <label className="text-[10px] font-bold text-slate-400 uppercase">
                Unit *
                <select
                  value={String(form.quantityUnit)}
                  onChange={(e) => setForm((f) => ({ ...f, quantityUnit: e.target.value }))}
                  className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2"
                >
                  <option value="quintal">quintal</option>
                  <option value="MT">MT</option>
                  <option value="kg">kg</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-4 mt-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={!!form.partialQuantityAllowed}
                  onChange={(e) => setForm((f) => ({ ...f, partialQuantityAllowed: e.target.checked }))}
                />
                Partial-quantity applications allowed
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={!!form.multiFarmerAllowed}
                  onChange={(e) => setForm((f) => ({ ...f, multiFarmerAllowed: e.target.checked }))}
                />
                Multiple farmers can collectively fulfil
              </label>
            </div>
          </Section>

          <Section title="B. Quality & compliance (optional)">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Moisture / parameters" value={form.moistureRequirement} onChange={(v) => setForm((f) => ({ ...f, moistureRequirement: v }))} />
              <Field label="Size spec" value={form.sizeSpec} onChange={(v) => setForm((f) => ({ ...f, sizeSpec: v }))} />
              <Field label="Residue / contaminant requirements" value={form.residueRequirements} onChange={(v) => setForm((f) => ({ ...f, residueRequirements: v }))} />
              <Field label="Required certifications (comma separated)" value={form.requiredCertifications} onChange={(v) => setForm((f) => ({ ...f, requiredCertifications: v }))} />
              <Field label="Inspection / testing requirements" value={form.inspectionRequirements} onChange={(v) => setForm((f) => ({ ...f, inspectionRequirements: v }))} />
              <Field label="Sample requirements" value={form.sampleRequirements} onChange={(v) => setForm((f) => ({ ...f, sampleRequirements: v }))} />
            </div>
            <Field label="Rejection conditions (as stated by you)" value={form.rejectionConditions} onChange={(v) => setForm((f) => ({ ...f, rejectionConditions: v }))} textarea />
          </Section>

          <Section title="C. Supply">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Field label="Available from *" type="date" value={form.deliveryWindowFrom} onChange={(v) => setForm((f) => ({ ...f, deliveryWindowFrom: v }))} />
              <Field label="Required by *" type="date" value={form.deliveryWindowTo} onChange={(v) => setForm((f) => ({ ...f, deliveryWindowTo: v }))} />
              <Field label="Collection / delivery location *" value={form.deliveryLocation} onChange={(v) => setForm((f) => ({ ...f, deliveryLocation: v }))} span={2} />
              <Field label="Packaging requirements" value={form.packagingRequirements} onChange={(v) => setForm((f) => ({ ...f, packagingRequirements: v }))} />
              <Field label="Labelling requirements" value={form.labellingRequirements} onChange={(v) => setForm((f) => ({ ...f, labellingRequirements: v }))} />
              <Field label="Shipment window" value={form.shipmentWindow} onChange={(v) => setForm((f) => ({ ...f, shipmentWindow: v }))} />
              <Field label="Price basis expected from farmer" value={form.priceBasis} onChange={(v) => setForm((f) => ({ ...f, priceBasis: v }))} />
              <Field label="Target price" type="number" value={form.targetPrice} onChange={(v) => setForm((f) => ({ ...f, targetPrice: v }))} />
              <Field label="Currency" value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: v.toUpperCase() }))} />
              <Field label="Max rate / quintal (₹, reference)" type="number" value={form.maxRatePerQuintal ?? ''} onChange={(v) => setForm((f) => ({ ...f, maxRatePerQuintal: v }))} />
              <Field label="Payment terms (days)" type="number" value={form.paymentTermsDays} onChange={(v) => setForm((f) => ({ ...f, paymentTermsDays: v }))} />
            </div>
            <Field label="Additional notes" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} textarea />
          </Section>

          <Section title="D. Export context (optional — keep buyer details confidential)">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Destination country" value={form.destinationCountry} onChange={(v) => setForm((f) => ({ ...f, destinationCountry: v }))} />
              <Field label="Required export documents (comma separated)" value={form.requiredExportDocuments} onChange={(v) => setForm((f) => ({ ...f, requiredExportDocuments: v }))} />
            </div>
            <Field label="Buyer / specification notes (never share private buyer contacts)" value={form.buyerNotes} onChange={(v) => setForm((f) => ({ ...f, buyerNotes: v }))} textarea />
          </Section>

          {!editing && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={!!form.publish}
                onChange={(e) => setForm((f) => ({ ...f, publish: e.target.checked }))}
              />
              Publish immediately (uncheck to save as draft)
            </label>
          )}

          {formError && <p className="text-xs font-semibold text-rose-700">{formError}</p>}
          <button
            type="button"
            onClick={saveForm}
            disabled={saving || !form.crop || !form.quantityQuintals || !form.deliveryWindowFrom || !form.deliveryWindowTo || !form.deliveryLocation}
            className="w-full rounded-xl bg-emerald-600 text-white text-sm font-bold py-2.5 hover:bg-emerald-700 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? 'Save Changes' : form.publish ? 'Publish Requirement' : 'Save Draft'}
          </button>
        </div>
      </ModalSheet>

      {/* Applications review (comparison) */}
      <ModalSheet
        isOpen={!!reviewRfq}
        onClose={() => setReviewRfq(null)}
        title={reviewRfq ? `Applications — ${reviewRfq.crop}` : ''}
        maxWidth="4xl"
      >
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {reviewLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading applications…
            </div>
          ) : applications.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">
              No farmer applications yet. Share your requirement with farmer networks.
            </p>
          ) : (
            applications.map((app) => (
              <div key={app.id} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">
                      {app.farmer?.name || app.sellerName || 'Farmer'}
                      <span className="ml-2 text-xs font-semibold text-slate-400">
                        {app.farmer?.district ? `${app.farmer.district}` : ''}
                        {app.farmer?.state ? `, ${app.farmer.state}` : ''}
                      </span>
                    </p>
                    <VerificationBadges identityVerified={app.farmer?.identityVerified} compact />
                  </div>
                  <ExportStatusBadge status={app.status} />
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px] text-slate-600">
                  <span>
                    <strong>{app.quantityOffered} {app.quantityUnit}</strong> offered
                  </span>
                  <span>
                    <strong>{app.currency} {app.price}</strong>/{app.priceUnit}
                  </span>
                  <span>{app.supplyBasis === 'farmGate' ? 'Farm gate' : app.supplyBasis}</span>
                  <span>available {app.availableDate}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                  {app.qualityDetails && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">{app.qualityDetails}</span>
                  )}
                  {(app.certificationNames || []).map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-bold">{c}</span>
                  ))}
                  {(app.documents || []).map((d) => (
                    <span
                      key={d.id}
                      className={`px-2 py-0.5 rounded-full font-bold border ${
                        d.verified
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                      title={d.verified ? 'Certificate reviewed' : 'Uploaded — review pending; never auto-verified'}
                    >
                      {d.fileName || d.docType || 'Document'} {d.verified ? '✓ verified' : '(unreviewed)'}
                    </span>
                  ))}
                  {app.packagingCapability && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">{app.packagingCapability}</span>
                  )}
                  {app.previousExperience && (
                    <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold">Experience: {app.previousExperience}</span>
                  )}
                </div>
                {app.message && <p className="mt-1.5 text-[11px] italic text-slate-500">"{app.message}"</p>}
                {app.sourceLot && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Referenced produce lot: {app.sourceLot.crop} · {app.sourceLot.quantityQuintals} q · harvest {app.sourceLot.harvestDate || '—'}
                  </p>
                )}

                {app.contactReveal ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-[10px] font-extrabold text-emerald-700 uppercase flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Farmer contact unlocked
                      </p>
                      <p className="text-xs font-bold text-slate-800 mt-1">{app.contactReveal.farmer.fullName}</p>
                      <p className="text-[11px] text-slate-500">{app.contactReveal.farmer.phone}</p>
                    </div>
                    <ContactActions contact={app.contactReveal.farmer} chatRoomId={app.chatRoomId} vertical />
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {app.status === 'submitted' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openUnlock(app)}
                          className="rounded-xl bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 hover:bg-emerald-700 transition"
                        >
                          Contact Farmer
                        </button>
                        <button
                          type="button"
                          onClick={() => dismiss(app)}
                          className="rounded-xl border border-slate-200 text-slate-500 text-[11px] font-bold px-3 py-1.5 hover:bg-slate-50 transition"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                    {app.status === 'contacted' && (
                      <span className="text-[11px] font-semibold text-amber-700">Contacted — see My Connections</span>
                    )}
                  </div>
                )}
                {app.contactReveal && app.negotiationChecklist && app.negotiationChecklist.length > 0 && (
                  <div className="mt-3">
                    <NegotiationChecklist items={app.negotiationChecklist} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ModalSheet>

      <ContactUnlockModal application={contactApp} onClose={() => setContactApp(null)} onUnlocked={onUnlocked} />

      {/* Unlocked confirmation */}
      <ModalSheet
        isOpen={!!unlockedApp}
        onClose={() => setUnlockedApp(null)}
        title="Contact unlocked"
        maxWidth="lg"
      >
        {unlockedApp?.contactReveal && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[10px] font-extrabold text-emerald-700 uppercase">Farmer contact</p>
              <p className="text-sm font-bold text-slate-900">{unlockedApp.contactReveal.farmer.fullName}</p>
              <p className="text-xs text-slate-600">{unlockedApp.contactReveal.farmer.phone}</p>
            </div>
            <ContactActions contact={unlockedApp.contactReveal.farmer} chatRoomId={unlockedApp.chatRoomId} vertical />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Quote, samples, inspection, price, payment, packaging, transport, export contracts, customs,
              freight, and insurance are settled directly with the farmer. This platform never holds export
              payments and never creates a contract from this unlock.
            </p>
            <button
              type="button"
              onClick={() => setUnlockedApp(null)}
              className="w-full rounded-xl bg-slate-800 text-white text-sm font-bold py-2.5 hover:bg-slate-900 transition"
            >
              Done
            </button>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
    <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide">{title}</h3>
    {children}
  </section>
);

const Field: React.FC<{
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  type?: string;
  textarea?: boolean;
  span?: number;
}> = ({ label, value, onChange, type = 'text', textarea, span }) => {
  const spanCls = span === 2 ? 'col-span-2' : span === 4 ? 'col-span-4' : '';
  const cls = `mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 ${spanCls}`;
  return (
    <label className={`text-[10px] font-bold text-slate-400 uppercase ${spanCls}`}>
      {label}
      {textarea ? (
        <textarea rows={2} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <input type={type} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  );
};
