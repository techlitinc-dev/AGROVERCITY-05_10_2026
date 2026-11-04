import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Globe2, Loader2, MapPin, Package, BadgeCheck, CalendarDays } from 'lucide-react';
import { exporter } from '../../lib/api/exporter';
import { apiErrorMessage } from '../../lib/api';
import { isKycError } from '../../lib/api/leads';
import type { ExportRfq } from '../../types';
import { ModalSheet } from '../../components/common/ModalSheet';
import { VerificationBadges, EXPORT_DIRECT_CONNECT_TERMS, ExportStatusBadge } from '../export/shared';

/**
 * Farmer — Export Opportunities (spec §3.1, §6).
 * Browse open export requirements and apply with available supply.
 * Contacts stay hidden; identity/export-business badges come from the server.
 */
export const ExportOpportunitiesView: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [rfqs, setRfqs] = useState<ExportRfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [cropFilter, setCropFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [certFilter, setCertFilter] = useState('');
  const [minQty, setMinQty] = useState('');
  const [maxQty, setMaxQty] = useState('');
  const [requiredBy, setRequiredBy] = useState('');

  const [selected, setSelected] = useState<ExportRfq | null>(null);
  const [detail, setDetail] = useState<ExportRfq | null>(null);

  // application form state
  const [quantityOffered, setQuantityOffered] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('quintal');
  const [price, setPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState('quintal');
  const [currency, setCurrency] = useState('INR');
  const [supplyBasis, setSupplyBasis] = useState<'farmGate' | 'collectionCentre' | 'mandi' | 'other'>('farmGate');
  const [availableDate, setAvailableDate] = useState('');
  const [supplyLocation, setSupplyLocation] = useState('');
  const [qualityDetails, setQualityDetails] = useState('');
  const [certificationNames, setCertificationNames] = useState('');
  const [packagingCapability, setPackagingCapability] = useState('');
  const [previousExperience, setPreviousExperience] = useState('');
  const [message, setMessage] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (cropFilter) params.crop = cropFilter;
      if (districtFilter) params.district = districtFilter;
      if (certFilter) params.certification = certFilter;
      if (minQty) params.minQuantity = Number(minQty);
      if (maxQty) params.maxQuantity = Number(maxQty);
      if (requiredBy) params.requiredBy = requiredBy;
      setRfqs(await exporter.opportunities(params));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [cropFilter, districtFilter, certFilter, minQty, maxQty, requiredBy]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openApply = (rfq: ExportRfq) => {
    setSelected(rfq);
    setQuantityOffered(String(Math.min(20, rfq.quantityQuintals)));
    setQuantityUnit(rfq.quantityUnit || 'quintal');
    setPrice(rfq.maxRatePerQuintal ? String(Math.max(1, rfq.maxRatePerQuintal - 150)) : '');
    setPriceUnit(rfq.quantityUnit || 'quintal');
    setSupplyBasis('farmGate');
    setAvailableDate('');
    setSupplyLocation(rfq.deliveryLocation || '');
    setQualityDetails('');
    setCertificationNames((rfq.requiredCertifications || []).join(', '));
    setPackagingCapability('');
    setPreviousExperience('');
    setMessage('');
    setTermsAccepted(false);
    setApplyError(null);
    setApplySuccess(false);
  };

  const closeApply = () => {
    setSelected(null);
    setApplyError(null);
    setApplySuccess(false);
  };

  const submitApplication = async () => {
    if (!selected) return;
    setSending(true);
    setApplyError(null);
    try {
      await exporter.applyOnRfq(selected.id, {
        quantityOffered: Number(quantityOffered),
        quantityUnit,
        price: Number(price),
        priceUnit,
        currency,
        supplyBasis,
        availableDate,
        supplyLocation,
        qualityDetails: qualityDetails || undefined,
        certificationNames: certificationNames
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        packagingCapability: packagingCapability || undefined,
        previousExperience: previousExperience || undefined,
        message: message || undefined,
        termsAccepted: true,
      });
      setApplySuccess(true);
      setNotice(
        `Application sent for ${selected.crop}. If the exporter shortlists you, contact details unlock on both sides after their verification.`,
      );
      setTimeout(closeApply, 1400);
    } catch (err) {
      if (isKycError(err)) {
        setApplyError('Complete your identity verification (KYC) before applying — your application was not sent.');
      } else {
        setApplyError(apiErrorMessage(err));
      }
    } finally {
      setSending(false);
    }
  };

  const openDetail = async (rfq: ExportRfq) => {
    try {
      setDetail(await exporter.opportunity(rfq.id));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const visible = useMemo(() => rfqs, [rfqs]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        {!embedded && (
          <>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <Globe2 className="w-7 h-7 text-emerald-600" />
              Export Opportunities
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              International exporters post crop requirements. Apply with your available quantity, price,
              quality, and supply details. When an exporter selects you, contacts unlock after their
              verification so you can negotiate and settle directly. Agrovercity never holds export
              payments and is not part of your deal.
            </p>
          </>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          <input
            type="text"
            placeholder="Crop"
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-32"
          />
          <input
            type="text"
            placeholder="District / area"
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-36"
          />
          <input
            type="text"
            placeholder="Certification"
            value={certFilter}
            onChange={(e) => setCertFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-36"
          />
          <input
            type="number"
            placeholder="Min qty (q)"
            value={minQty}
            onChange={(e) => setMinQty(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-28"
          />
          <input
            type="number"
            placeholder="Max qty (q)"
            value={maxQty}
            onChange={(e) => setMaxQty(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-28"
          />
          <input
            type="date"
            value={requiredBy}
            onChange={(e) => setRequiredBy(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5"
          />
        </div>
      </div>

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

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading export requirements…
        </div>
      ) : visible.length === 0 ? (
        <div className="p-10 text-center rounded-3xl border-2 border-dashed border-slate-200">
          <Globe2 className="w-10 h-10 mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-600">No open export requirements right now</p>
          <p className="mt-1 text-xs text-slate-400">
            Check back soon — exporters publish fresh sourcing requirements regularly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visible.map((rfq) => (
            <div
              key={rfq.id}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {rfq.crop}
                    {rfq.variety ? ` — ${rfq.variety}` : ''}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {rfq.exporter?.companyName || rfq.exporter?.name || 'Exporter'} ·{' '}
                    {rfq.destinationCountry ? `ships to ${rfq.destinationCountry}` : 'destination on request'}
                  </p>
                </div>
                <ExportStatusBadge status={rfq.applicationsReceived ? 'contacted' : 'open'} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  {rfq.quantityQuintals} {rfq.quantityUnit || 'quintals'} needed
                </span>
                <span className="flex items-center gap-1.5">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {rfq.partialQuantityAllowed ? 'Partial quantity OK' : 'Full quantity only'}
                  {rfq.multiFarmerAllowed ? ' · multiple farmers' : ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                  by {rfq.deliveryWindow?.to || '—'}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  {rfq.deliveryLocation}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {rfq.gradeSpec && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                    {rfq.gradeSpec}
                  </span>
                )}
                {(rfq.requiredCertifications || []).map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[10px] font-bold"
                  >
                    {c}
                  </span>
                ))}
                {rfq.packing && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                    {rfq.packing}
                  </span>
                )}
                {rfq.targetPrice && rfq.currency && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-bold">
                    target {rfq.currency} {rfq.targetPrice}/{rfq.quantityUnit || 'quintal'}
                  </span>
                )}
              </div>

              <div className="mt-3">
                <VerificationBadges
                  identityVerified={rfq.exporter?.identityVerified}
                  businessVerified={rfq.exporter?.businessVerified}
                  compact
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => openDetail(rfq)}
                  className="flex-1 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold py-2 hover:bg-slate-50 transition"
                >
                  View Details
                </button>
                <button
                  type="button"
                  onClick={() => openApply(rfq)}
                  className="flex-1 rounded-xl bg-emerald-600 text-white text-xs font-bold py-2 hover:bg-emerald-700 transition"
                >
                  Apply
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal — farmer-friendly requirement explanation (spec §6) */}
      <ModalSheet
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.crop} requirement details` : ''}
        maxWidth="2xl"
      >
        {detail && (
          <div className="space-y-4 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <VerificationBadges
                identityVerified={detail.exporter?.identityVerified}
                businessVerified={detail.exporter?.businessVerified}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Info label="Produce" value={`${detail.crop}${detail.variety ? ` — ${detail.variety}` : ''}`} />
              <Info label="Quantity" value={`${detail.quantityQuintals} ${detail.quantityUnit || 'quintals'}`} />
              <Info
                label="Partial quantity"
                value={detail.partialQuantityAllowed ? 'Allowed' : 'Not accepted — full quantity only'}
              />
              <Info
                label="Multiple farmers"
                value={detail.multiFarmerAllowed ? 'Yes — collective fulfilment OK' : 'Single farmer preferred'}
              />
              <Info label="Ready by" value={detail.deliveryWindow?.to || '—'} />
              <Info label="Supply window" value={`${detail.deliveryWindow?.from || '—'} → ${detail.deliveryWindow?.to || '—'}`} />
              <Info label="Deliver to" value={detail.deliveryLocation} />
              <Info label="Price basis" value={detail.priceBasis || 'As quoted by farmer (farm-gate / collection)'} />
              {detail.targetPrice && detail.currency && (
                <Info label="Target price" value={`${detail.currency} ${detail.targetPrice}`} />
              )}
              {detail.gradeSpec && <Info label="Grade" value={detail.gradeSpec} />}
              {detail.qualityParams && <Info label="Quality parameters" value={detail.qualityParams} />}
              {detail.moistureRequirement && <Info label="Moisture" value={detail.moistureRequirement} />}
              {detail.sizeSpec && <Info label="Size" value={detail.sizeSpec} />}
              {detail.residueRequirements && <Info label="Residue / MRL" value={detail.residueRequirements} />}
              {(detail.requiredCertifications || []).length > 0 && (
                <Info label="Certifications required" value={(detail.requiredCertifications || []).join(', ')} />
              )}
              {detail.inspectionRequirements && <Info label="Inspection / testing" value={detail.inspectionRequirements} />}
              {detail.sampleRequirements && <Info label="Samples" value={detail.sampleRequirements} />}
              {detail.rejectionConditions && (
                <Info label="Rejection conditions (exporter-stated)" value={detail.rejectionConditions} />
              )}
              {detail.packagingRequirements && <Info label="Packaging" value={detail.packagingRequirements} />}
              {detail.labellingRequirements && <Info label="Labelling" value={detail.labellingRequirements} />}
              {detail.destinationCountry && <Info label="Destination country" value={detail.destinationCountry} />}
              {(detail.requiredExportDocuments || []).length > 0 && (
                <Info label="Export documents" value={(detail.requiredExportDocuments || []).join(', ')} />
              )}
              {detail.notes && <Info label="Notes" value={detail.notes} />}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-1">
              <p className="font-extrabold text-slate-700 text-[11px] uppercase">Who does what</p>
              <p>Farmer: supply the produce, stated quality, and certifications at the agreed supply point (farm gate / collection centre).</p>
              <p>Exporter: collection from the supply point onward — aggregation beyond the farm, export contracts, customs, international freight, insurance, and payment.</p>
              <p>You never need to quote international freight, customs duty, insurance, or foreign delivery.</p>
            </div>
            {detail.termsText && (
              <p className="text-[11px] text-slate-400 leading-relaxed">{detail.termsText}</p>
            )}
            <button
              type="button"
              onClick={() => {
                setDetail(null);
                openApply(detail);
              }}
              className="w-full rounded-xl bg-emerald-600 text-white text-sm font-bold py-2.5 hover:bg-emerald-700 transition"
            >
              Apply with your supply
            </button>
          </div>
        )}
      </ModalSheet>

      {/* Apply modal */}
      <ModalSheet
        isOpen={!!selected}
        onClose={closeApply}
        title={selected ? `Apply — ${selected.crop}` : ''}
        maxWidth="2xl"
      >
        {selected && (
          <div className="space-y-3">
            {applySuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                Application submitted. Track it under My Export Applications.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <label className="text-[11px] font-bold text-slate-500">
                    Quantity offered *
                    <input
                      type="number"
                      min="0"
                      value={quantityOffered}
                      onChange={(e) => setQuantityOffered(e.target.value)}
                      className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </label>
                  <label className="text-[11px] font-bold text-slate-500">
                    Unit *
                    <select
                      value={quantityUnit}
                      onChange={(e) => setQuantityUnit(e.target.value)}
                      className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="quintal">quintal</option>
                      <option value="MT">MT</option>
                      <option value="kg">kg</option>
                    </select>
                  </label>
                  <label className="text-[11px] font-bold text-slate-500">
                    Supply basis *
                    <select
                      value={supplyBasis}
                      onChange={(e) => setSupplyBasis(e.target.value as typeof supplyBasis)}
                      className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="farmGate">Farm gate</option>
                      <option value="collectionCentre">Collection centre</option>
                      <option value="mandi">Mandi</option>
                      <option value="other">Other local basis</option>
                    </select>
                  </label>
                  <label className="text-[11px] font-bold text-slate-500">
                    Price *
                    <input
                      type="number"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </label>
                  <label className="text-[11px] font-bold text-slate-500">
                    Price unit *
                    <select
                      value={priceUnit}
                      onChange={(e) => setPriceUnit(e.target.value)}
                      className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="quintal">per quintal</option>
                      <option value="MT">per MT</option>
                      <option value="kg">per kg</option>
                    </select>
                  </label>
                  <label className="text-[11px] font-bold text-slate-500">
                    Currency *
                    <input
                      type="text"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                      className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </label>
                  <label className="text-[11px] font-bold text-slate-500">
                    Available / harvest date *
                    <input
                      type="date"
                      value={availableDate}
                      onChange={(e) => setAvailableDate(e.target.value)}
                      className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </label>
                  <label className="text-[11px] font-bold text-slate-500 col-span-2">
                    Farm / supply location *
                    <input
                      type="text"
                      value={supplyLocation}
                      onChange={(e) => setSupplyLocation(e.target.value)}
                      className="mt-1 w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </label>
                </div>
                <textarea
                  rows={2}
                  placeholder="Quality details (grade, moisture, size…)"
                  value={qualityDetails}
                  onChange={(e) => setQualityDetails(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Your certifications (comma separated)"
                  value={certificationNames}
                  onChange={(e) => setCertificationNames(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Packaging capability"
                    value={packagingCapability}
                    onChange={(e) => setPackagingCapability(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Previous export-supply experience (optional)"
                    value={previousExperience}
                    onChange={(e) => setPreviousExperience(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <textarea
                  rows={2}
                  placeholder="Short message to the exporter (optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
                />
                <label className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>{EXPORT_DIRECT_CONNECT_TERMS}</span>
                </label>
                {applyError && (
                  <p className="text-xs font-semibold text-rose-700">{applyError}</p>
                )}
                <button
                  type="button"
                  onClick={submitApplication}
                  disabled={sending || !termsAccepted || !quantityOffered || !price || !availableDate || !supplyLocation}
                  className="w-full rounded-xl bg-emerald-600 text-white text-sm font-bold py-2.5 hover:bg-emerald-700 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {sending && <Loader2 className="w-4 h-4 animate-spin" />} Submit Application
                </button>
              </>
            )}
          </div>
        )}
      </ModalSheet>
    </div>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">{label}</p>
    <p className="mt-0.5 font-semibold text-slate-700">{value}</p>
  </div>
);
